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
uv run python manage.py check --deploy
```

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

`BACKEND_API_ORIGIN` is server-only. The browser continues to talk only to Next.js.

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

The backend healthcheck is a DRF readiness endpoint with authentication disabled and `AllowAny` permission so deployment health does not depend on application sessions. It is intentionally excluded from the generated OpenAPI schema because it is an operational endpoint rather than part of the frontend/backend application contract. The endpoint performs a lightweight query against Django's default database connection and returns `503 Service Unavailable` if the database cannot be reached, so Railway only activates a backend deployment that can serve its required database-backed API.

Set the backend pre-deploy command to:

```bash
python manage.py migrate --noinput
```

Do not create preview users or credentials from deployment/application code. Test-account and fixture lifecycle is an environment/data-management responsibility and should be designed separately from service deployment. If authenticated preview testing is required, provision the required non-production data through an operator-controlled mechanism appropriate to that environment.

### Postgres

Use Railway's PostgreSQL service and keep it private. Do not add a public TCP proxy for application operation. The backend consumes `${{Postgres.DATABASE_URL}}` through a Railway reference variable.

## PR environments

Enable standard PR Environments and set `staging` as their base environment. Standard PR Environments copy the base environment's services, networking, and variables into an isolated ephemeral environment, which gives each PR its own frontend, backend, and PostgreSQL resources.

Keep Focused PR Environments disabled initially. The current goal is full-stack isolation rather than reusing unchanged services from staging.

If AI coding tools or other GitHub bots open pull requests, enable Railway's **Bot PR Environments** option.

Do not place production credentials in `staging`. Railway sealed variables are intentionally not copied into PR environments, so values needed by previews must be staging/test credentials rather than sealed production secrets.

After Railway is connected, enable **Wait for CI** so deployments wait for the repository checks before building a preview.

## Preview verification

For a test pull request, verify all of the following before relying on the workflow:

1. Railway creates an isolated PR environment from `staging`.
2. PostgreSQL is created without a public endpoint.
3. The backend pre-deploy migration completes successfully.
4. Backend `/api/health/` verifies the default database and frontend `/health` pass Railway healthchecks.
5. Only the frontend receives a public URL.
6. The frontend can communicate with the private backend through `BACKEND_API_ORIGIN`.
7. If the preview environment contains suitable non-production account data, login, `/home`, and logout work through the frontend URL.
8. Closing or merging the PR removes the ephemeral Railway environment.

## Railway configuration source

Do not add `railway.toml` or `railway.json` for new services. Railway has deprecated Config as Code for new services in favor of Infrastructure as Code (`.railway/railway.ts`). Keep the initial service configuration in Railway while the topology stabilizes; adopting Railway IaC can be a separate change later.

## Primary references

- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway monorepos: https://docs.railway.com/deployments/monorepo
- Railway private networking: https://docs.railway.com/networking/private-networking
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks
- Railway pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Railway PR environments: https://docs.railway.com/guides/preview-deployments-with-pr-environments
- Railway variables: https://docs.railway.com/variables
- Railway Config as Code deprecation: https://docs.railway.com/config-as-code
- Next.js output tracing / standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- uv Docker integration: https://docs.astral.sh/uv/guides/integration/docker/
- Django deployment checklist: https://docs.djangoproject.com/en/6.1/howto/deployment/checklist/
- Django PostgreSQL support: https://docs.djangoproject.com/en/6.1/ref/databases/#postgresql-notes
- Django REST framework authentication: https://www.django-rest-framework.org/api-guide/authentication/
- Django REST framework permissions: https://www.django-rest-framework.org/api-guide/permissions/
- drf-spectacular schema customization: https://drf-spectacular.readthedocs.io/en/stable/drf_spectacular.html
- Psycopg installation: https://www.psycopg.org/psycopg3/docs/basic/install.html
