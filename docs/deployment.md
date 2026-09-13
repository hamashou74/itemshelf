# Deployment

Itemshelf uses Docker as the repository-owned deployment runtime contract. Docker is not required for normal local development; the root `mise.toml` and `mise run dev` remain the canonical development workflow.

The deployed application keeps the existing responsibility boundary:

```text
Browser
   ↓
Next.js frontend / BFF (public)
   ↓ Railway private network
Django / DRF backend (private)
   ↓ Railway private network
PostgreSQL (private)
```

The browser must not call Django directly. Do not add CORS relaxation or a generic Next.js proxy to support deployment.

## Build the images locally

Run both builds from the repository root. The repository root is intentionally the Docker build context because the frontend generates its API client from the committed `backend/schema.yaml` contract.

```bash
docker build --file backend/Dockerfile --tag itemshelf-backend:local .
docker build --file frontend/Dockerfile --tag itemshelf-frontend:local .
```

The frontend image regenerates the Orval client before `next build`; generated client files remain uncommitted. The production image uses Next.js standalone output. The backend image installs application dependencies from `backend/uv.lock` and runs Gunicorn. PostgreSQL connectivity uses the Psycopg 3 binary implementation selected in `backend/pyproject.toml`.

## Verify deployment settings

Django deployment settings are configured entirely through process environment variables and do not load a committed `.env` file.

A local settings check can use an in-memory SQLite database because this command validates settings rather than the Railway PostgreSQL connection:

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.deployment \
DJANGO_SECRET_KEY='local-deployment-check-secret-that-is-long-enough' \
DJANGO_ALLOWED_HOSTS=localhost \
DATABASE_URL='sqlite:///:memory:' \
uv run python manage.py check --deploy --fail-level WARNING
```

The deployment settings intentionally silence only `security.W004`, `security.W008`, `security.W012`, and `security.W016`. Those checks assume a browser-facing HTTPS Django service, while Itemshelf keeps Django private and Next.js reaches it over Railway's WireGuard-encrypted private HTTP network. HSTS, Django-side HTTP-to-HTTPS redirects, and browser `Secure` cookie transport flags therefore do not apply to this service boundary. Any other deployment warning remains unsilenced and fails the strict check above. Re-evaluate these silences if Django ever becomes browser-facing or the network boundary changes.

The Railway deployment itself validates PostgreSQL connectivity during the pre-deploy migration and again through the backend readiness healthcheck before the deployment becomes active.

## Railway staging topology

Create a persistent `staging` environment and connect the repository to two application services plus a Railway PostgreSQL service.

### frontend

- Source: this GitHub repository, `master` branch.
- Root directory: repository root (leave the service root unset rather than setting `/frontend`).
- `RAILWAY_DOCKERFILE_PATH=/frontend/Dockerfile`.
- Generate a Railway public domain.
- Healthcheck path: `/health`.
- Suggested watch paths:
  - `/frontend/**`
  - `/backend/schema.yaml`
  - `/.dockerignore`

Variables:

```text
API_TIMEOUT_MS=10000
BACKEND_API_ORIGIN=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}
SESSION_SECRET=<staging-only random value of at least 32 characters>
```

`BACKEND_API_ORIGIN` is server-only. The browser continues to talk only to Next.js. The frontend `/health` route is a service-local Railway readiness endpoint: it validates the frontend's required runtime configuration without making the frontend health result depend on another service's availability.

### backend

- Source: this GitHub repository, `master` branch.
- Root directory: repository root (leave the service root unset rather than setting `/backend`).
- `RAILWAY_DOCKERFILE_PATH=/backend/Dockerfile`.
- Do not generate a public domain.
- Healthcheck path: `/api/health/`.
- Suggested watch paths:
  - `/backend/**`
  - `/.dockerignore`

Variables:

```text
DJANGO_SETTINGS_MODULE=config.settings.deployment
DJANGO_SECRET_KEY=<staging-only random value>
DJANGO_ALLOWED_HOSTS=${{backend.RAILWAY_PRIVATE_DOMAIN}},healthcheck.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

The backend healthcheck is a DRF readiness endpoint with authentication disabled and `AllowAny` permission so deployment health does not depend on application sessions. It is part of the committed OpenAPI contract and therefore generates a typed Orval health client for server-side frontend use. The endpoint performs a lightweight query against Django's default database connection and returns `503 Service Unavailable` if the database cannot be reached, so Railway only activates a backend deployment that can serve its required database-backed API.

Set the backend pre-deploy command to:

```bash
python manage.py migrate --noinput
```

Do not create preview users or credentials from deployment/application code. Test-account and fixture lifecycle is an environment/data-management responsibility and should be designed separately from service deployment. If authenticated preview testing is required, provision the required non-production data through an operator-controlled mechanism appropriate to that environment.

### Postgres

Use Railway's PostgreSQL service and keep it private. Do not add a public TCP proxy for application operation. The backend consumes `${{Postgres.DATABASE_URL}}` through a Railway reference variable.

## PR environments

Itemshelf currently uses Railway's Hobby plan. Railway native PR Environments only deploy pull requests whose author has access to the Railway workspace or project, while adding collaborators requires Pro or Enterprise. Because AI-assisted changes are opened by `hamashou74-robot`, Itemshelf manages previews with `.github/workflows/railway-pr-environment.yml` instead of Railway's native PR Environment feature.

Keep Railway's native **PR Environments** and **Bot PR Environments** disabled while this workflow owns the preview lifecycle. Enabling both mechanisms would create competing preview environments.

The workflow provisions previews only for same-repository `feature/**`, `fix/**`, and `chore/**` branches targeting `master`, matching the project's branch conventions. Fork pull requests, Dependabot branches, and other branch names do not receive Railway preview environments and continue through the regular `pull_request` CI path.

### GitHub Actions prerequisite

Create a dedicated GitHub deployment environment named `railway-pr-management` in the repository settings. Configure **Deployment branches and tags** to allow only the `master` branch.

Create an account-scoped Railway API token from Railway account settings by selecting **No workspace**, then add it to `railway-pr-management` as the environment secret `RAILWAY_API_TOKEN`. Do not create a repository-level secret with the same credential.

Do not use a Railway project token for this workflow. Project tokens are scoped to one existing environment, while this workflow must create and delete environments. The account token is therefore intentionally broader and is isolated behind the GitHub environment's deployment-branch policy.

The Railway project ID and `staging` environment ID are non-secret deployment identifiers and are kept explicitly in the workflow. Update them if the Railway project or base environment is recreated.

### Security boundary

The preview lifecycle workflow uses `pull_request_target` because it needs the Railway credential. GitHub loads that event's workflow definition from the trusted base branch, and its `GITHUB_REF` is the pull request's base branch. Because `railway-pr-management` allows only `master`, the privileged jobs can access the environment secret while ordinary PR-branch `push` and `pull_request` workflows cannot.

The workflow intentionally:

- references the protected `railway-pr-management` GitHub environment before the Railway secret is made available;
- never checks out pull-request code;
- never executes scripts, dependencies, configuration, or other content from the pull-request branch;
- runs privileged Railway jobs only for same-repository branches matching `feature/**`, `fix/**`, or `chore/**`;
- grants the workflow `contents: read` and no broader `GITHUB_TOKEN` permission;
- passes the PR branch name through an environment variable and quotes it as a CLI argument.

Do not move `RAILWAY_API_TOKEN` to a repository secret. A same-repository contributor can change ordinary PR workflows on a branch, whereas the deployment-branch restriction on `railway-pr-management` prevents those branch and pull-request refs from receiving this environment secret.

Do not add a PR-head checkout or execute PR-controlled code in this workflow. That would cross the trust boundary while `RAILWAY_API_TOKEN` is available.

### Preview lifecycle

When an eligible pull request targeting `master` is opened or reopened, the workflow:

1. links the Railway CLI to the persistent `staging` environment;
2. creates `pr-<number>` by copying `staging`;
3. overrides both `frontend` and `backend` `source.branch` values with the PR head branch as part of environment creation.

The copied environment therefore keeps isolated frontend, backend, PostgreSQL, networking, variables, healthchecks, and pre-deploy migration settings while both application services build the PR branch. Railway reference variables continue to resolve within the copied environment.

Subsequent pushes to the PR branch are handled by Railway's normal GitHub autodeploy behavior. Keep **Wait for CI** enabled on `frontend` and `backend`.

Railway Wait for CI evaluates workflow results for the commit being deployed. For that reason, CI runs on pushes to the repository's `feature/**`, `fix/**`, and `chore/**` branches. The duplicate `pull_request` CI jobs are skipped only for same-repository branches in those namespaces. Fork pull requests, Dependabot pull requests, and other branch names retain the regular unprivileged `pull_request` CI path.

When the pull request is closed or merged, the workflow deletes `pr-<number>` non-interactively. Railway CLI `5.54.0` is pinned by the workflow; its token-authentication path supports non-interactive environment deletion without an interactive 2FA prompt.

Do not place production credentials in `staging`. Preview environments are copies of `staging`, so values available there must remain suitable for non-production use.

## Preview verification

For a test pull request, verify all of the following before relying on the workflow:

1. The privileged workflow runs from the `master` base ref and can read `RAILWAY_API_TOKEN` from `railway-pr-management`.
2. Railway creates an isolated `pr-<number>` environment from `staging`.
3. PostgreSQL is created without a public endpoint.
4. Both `frontend` and `backend` use the PR head branch.
5. The backend pre-deploy migration completes successfully.
6. Backend `/api/health/` verifies the default database and frontend `/health` pass their respective Railway healthchecks.
7. Only the frontend receives a public URL.
8. The frontend can communicate with the private backend through `BACKEND_API_ORIGIN`, including the generated health client.
9. A later push to the PR branch is held by Wait for CI until branch-head CI succeeds.
10. A Dependabot or other non-managed branch PR still runs the regular `pull_request` CI and does not create a Railway preview.
11. If the preview environment contains suitable non-production account data, login, `/home`, and logout work through the frontend URL.
12. Closing or merging the PR removes the ephemeral Railway environment.

Also verify once that a normal `push` or `pull_request` job from a non-`master` ref cannot deploy to `railway-pr-management`; the environment's branch restriction is part of the credential boundary, not just documentation.

The `pull_request_target` workflow is loaded from `master`, so a pull request that introduces or changes the workflow cannot exercise its own new privileged workflow definition. Merge this infrastructure change first, then validate it with a different pull request or by reopening an existing eligible same-repository PR whose branch has been updated from the new `master`.

## Railway configuration source

Do not add `railway.toml` or `railway.json` for new services. Railway has deprecated Config as Code for new services in favor of Infrastructure as Code (`.railway/railway.ts`). Keep the initial service configuration in Railway while the topology stabilizes; adopting Railway IaC can be a separate change later.

## Primary references

- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway monorepos: https://docs.railway.com/deployments/monorepo
- Railway private networking: https://docs.railway.com/networking/private-networking
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks
- Railway pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Railway PR environments with GitHub Actions: https://docs.railway.com/cli/deploying#pr-environments-with-github-actions
- Railway CLI environments: https://docs.railway.com/cli/environment
- Railway GitHub autodeploys and Wait for CI: https://docs.railway.com/deployments/github-autodeploys
- Railway API tokens: https://docs.railway.com/integrations/api
- Railway variables: https://docs.railway.com/variables
- Railway Config as Code deprecation: https://docs.railway.com/config-as-code
- GitHub secure `pull_request_target` usage: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- GitHub deployment environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- GitHub variables and `GITHUB_REF`: https://docs.github.com/en/actions/reference/workflows-and-actions/variables
- Next.js output tracing / standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- uv Docker integration: https://docs.astral.sh/uv/guides/integration/docker/
- Django deployment checklist: https://docs.djangoproject.com/en/6.1/howto/deployment/checklist/
- Django system checks: https://docs.djangoproject.com/en/6.1/ref/checks/
- Django settings: https://docs.djangoproject.com/en/6.1/ref/settings/#silenced-system-checks
- Django PostgreSQL support: https://docs.djangoproject.com/en/6.1/ref/databases/#postgresql-notes
- Django REST framework authentication: https://www.django-rest-framework.org/api-guide/authentication/
- Django REST framework permissions: https://www.django-rest-framework.org/api-guide/permissions/
- drf-spectacular schema customization: https://drf-spectacular.readthedocs.io/en/stable/drf_spectacular.html
- Psycopg installation: https://www.psycopg.org/psycopg3/docs/basic/install.html
