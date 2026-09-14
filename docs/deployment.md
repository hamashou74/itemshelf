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
- Healthcheck path: `/api/health`.
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

Itemshelf uses Railway native **PR Environments** as the single preview lifecycle. Do not add a repository workflow that creates or deletes Railway environments for pull requests; running both mechanisms creates duplicate preview environments.

Configure PR Environments in Railway under **Project Settings → Environments**:

1. Enable **PR Environments**.
2. Use the persistent `staging` environment as the PR Environment base so previews inherit the intended non-production services, networking, and variables.
3. Keep **Focused PR Environments** disabled unless a separate change intentionally adopts partial previews; the current preview contract is full-stack isolation.
4. Enable **Bot PR Environments** when PRs are opened by GitHub bot identities that Railway classifies as supported bots. Ordinary GitHub user accounts remain subject to Railway's project/workspace authorization rules.

Railway owns creation and teardown of the preview environment. When a pull request opens, Railway duplicates the base environment and deploys the pull-request branch for repository-connected services. When the pull request is merged or closed, Railway deletes the temporary environment automatically. Railway-provided domains on the base environment are also the prerequisite for automatic preview domains.

The preview lifecycle does not require a repository `RAILWAY_API_TOKEN`, `LINK_PROJECT_ID`, `DUPLICATE_FROM_ID`, or a GitHub deployment environment. Do not reintroduce those solely to create or delete PR environments.

Do not place production credentials in `staging`; preview environments inherit the base environment configuration. Railway also refuses to deploy a PR branch from an external GitHub user who is not authorized for the Railway project/workspace, so preview access should be granted deliberately rather than bypassed in repository automation.

## Preview verification

After the native lifecycle is the only PR Environment mechanism on `master`, verify with a pull request that:

1. Railway creates exactly one PR Environment using `staging` as its base.
2. PostgreSQL is isolated and has no public endpoint.
3. `frontend` and `backend` deploy the pull-request branch.
4. The backend migration and both healthchecks succeed.
5. Only the frontend is public and it reaches the backend through the private BFF path.
6. The repository's normal pull-request CI succeeds for the preview commit.
7. Closing or merging the PR removes the preview environment automatically.
8. If preview account data exists, login, `/home`, and logout work through the frontend URL.

A pull request that removes the old `pull_request_target` workflow can still receive both preview environments because GitHub loads that workflow from the base branch. Use the first subsequent pull request after this change reaches `master` as the authoritative duplicate-prevention check.

## Railway configuration source

Do not add `railway.toml` or `railway.json` for new services. Railway has deprecated Config as Code for new services in favor of Infrastructure as Code (`.railway/railway.ts`). Keep the initial service configuration in Railway while the topology stabilizes; adopting Railway IaC can be a separate change later.

## Primary references

- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway monorepos: https://docs.railway.com/deployments/monorepo
- Railway private networking: https://docs.railway.com/networking/private-networking
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks
- Railway pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Railway PR environments: https://docs.railway.com/guides/preview-deployments-with-pr-environments
- Railway environments: https://docs.railway.com/environments
- Railway GitHub autodeploys and Wait for CI: https://docs.railway.com/deployments/github-autodeploys
- Railway production security guidance: https://docs.railway.com/guides/lock-down-production-project
- Railway variables: https://docs.railway.com/variables
- Railway Config as Code deprecation: https://docs.railway.com/config-as-code
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
