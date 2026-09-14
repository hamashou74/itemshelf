# Deployment

Itemshelf uses Docker as the repository-owned deployment runtime contract. Docker is not required for normal local development; the root `mise.toml` and `mise run dev` remain the canonical development workflow.

Railway project topology for the persistent `staging` environment is source-controlled in `.railway/railway.ts`. The application Dockerfiles remain the production image build contract; Railway IaC does not replace them.

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

The persistent `staging` environment is represented by `.railway/railway.ts` as two application services plus Railway PostgreSQL. Review infrastructure changes with `railway config plan` before applying them. Do not apply a plan that unexpectedly recreates or deletes a service, variable, database, or volume.

### frontend

- Source: this GitHub repository, `master` branch.
- Root directory: repository root (leave the service root unset rather than setting `/frontend`).
- Dockerfile: `/frontend/Dockerfile`.
- Generate a Railway public domain.
- Healthcheck path: `/health`.
- Watch paths:
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

The IaC baseline uses `preserve()` for existing Railway-managed application variable values so secrets and other live values are not copied into source control.

### backend

- Source: this GitHub repository, `master` branch.
- Root directory: repository root (leave the service root unset rather than setting `/backend`).
- Dockerfile: `/backend/Dockerfile`.
- Do not generate a public domain.
- Healthcheck path: `/api/health`.
- Watch paths:
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

The existing `postgres-volume` is part of the imported staging baseline and must be preserved. Do not replace the managed database with a Compose-managed PostgreSQL container or create a second volume when changing the IaC definition.

## Railway Infrastructure as Code

Railway IaC uses the generally available TypeScript authoring surface in `.railway/railway.ts`. Repository-level tooling pins the `railway` SDK version in the root `package.json`; it is separate from both application dependency sets.

The committed file describes the existing `frontend`, `backend`, `Postgres`, and persistent volume topology. Docker remains responsible for building the frontend and backend images.

For local IaC work, install the repository-level dependency and link the Railway CLI to the Itemshelf `staging` environment:

```bash
npm install
railway login
railway link
railway config plan
```

`railway config plan` is read-only. Review its complete output before any apply. In particular, an initial or refreshed baseline must not show unexpected additions, updates, or destructive operations for `frontend`, `backend`, `Postgres`, or `postgres-volume`.

To refresh the authoring file from the current Railway environment, use:

```bash
railway config pull
```

Do not use `railway config pull --include-variables` for the committed baseline because that option can decrypt and inline non-sealed Railway values. Imported values that should remain managed on Railway are represented with `preserve()`.

Applying IaC is intentionally manual at this stage:

```bash
railway config apply
```

Do not run apply unless the plan contains only the changes intentionally reviewed for that operation. GitHub Actions plan/apply automation is a separate follow-up change.

Do not add `railway.toml` or `railway.json`. Railway Config as Code is deprecated; `.railway/railway.ts` is the project-level source of truth.

## PR environments

Itemshelf uses `.github/workflows/railway-pr-envs.yml` for Hobby-plan previews because Railway native PR Environments cannot deploy pull requests authored by `hamashou74-robot` without Railway project/workspace access. Keep Railway native **PR Environments** and **Bot PR Environments** disabled while this workflow owns the preview lifecycle.

### Required setup

1. Create the repository variable `LINK_PROJECT_ID` with the Itemshelf Railway project ID.
2. Create the repository variable `DUPLICATE_FROM_ID` with the persistent `staging` environment ID to copy.
3. Create a GitHub environment named `railway-pr-environment`.
4. Store the Railway credential in that GitHub environment as `RAILWAY_API_TOKEN`.

The workflow uses `pull_request_target` for `opened`, `reopened`, and `closed` events. Its jobs reference the GitHub environment with `deployment: false`, so the environment provides its protected configuration without creating a GitHub Deployment record. The workflow does not check out or execute pull-request code.

On `opened` or `reopened`, the create job links the Railway project, creates `pr-<number>` by copying `DUPLICATE_FROM_ID`, and sets the copied `backend` and `frontend` services' `source.branch` values to `github.head_ref`. On `closed`, the delete job removes the corresponding preview environment non-interactively with `--yes`.

The workflow uses `ghcr.io/railwayapp/cli:latest`, matching Railway's documented GitHub Actions pattern. It does not add repository or base-branch filters beyond the `pull_request_target` event itself.

The existing CI workflow continues to run on pushes to `master`. Its `pull_request` trigger is intentionally not restricted to a particular base branch, so pull requests handled by the preview workflow continue to receive the repository's normal PR checks.

Do not place production credentials in `staging`; preview environments inherit the copied staging configuration.

## Preview verification

After the workflow is present on `master`, verify with a test pull request that:

1. Railway creates `pr-<number>` from the environment configured by `DUPLICATE_FROM_ID`.
2. PostgreSQL is isolated and has no public endpoint.
3. `frontend` and `backend` use the PR head branch.
4. The backend migration and both healthchecks succeed.
5. Only the frontend is public and it reaches the backend through the private BFF path.
6. The repository's normal pull-request CI succeeds for the preview commit.
7. Closing or merging the PR removes the preview environment.
8. If preview account data exists, login, `/home`, and logout work through the frontend URL.

Because `pull_request_target` loads its workflow from the base repository, merge the workflow change before performing the first end-to-end preview test.

## Primary references

- Railway Infrastructure as Code: https://docs.railway.com/infrastructure-as-code
- Railway Infrastructure as Code reference: https://docs.railway.com/infrastructure-as-code/reference
- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway monorepos: https://docs.railway.com/deployments/monorepo
- Railway private networking: https://docs.railway.com/networking/private-networking
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks
- Railway pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Railway PR environments with GitHub Actions: https://docs.railway.com/cli/deploying#pr-environments-with-github-actions
- Railway GitHub autodeploys and Wait for CI: https://docs.railway.com/deployments/github-autodeploys
- Railway API tokens: https://docs.railway.com/integrations/api
- Railway production security guidance: https://docs.railway.com/guides/lock-down-production-project
- Railway variables: https://docs.railway.com/variables
- Railway Config as Code deprecation: https://docs.railway.com/config-as-code
- GitHub secure `pull_request_target` usage: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- GitHub deployment environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
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
