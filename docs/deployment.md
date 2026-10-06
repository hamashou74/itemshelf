# Deployment

Itemshelf uses Docker as the repository-owned deployment runtime contract. Docker is not required for normal local development; the root `mise.toml` and `mise run dev` remain the canonical development workflow.

Railway project topology for the persistent `staging` environment is source-controlled in `.railway/railway.ts`. The application Dockerfiles remain the production image build contract, while the root `compose.yaml` remains the independent self-host topology; Railway IaC does not replace either contract.

## Deployment security contract

The repository-owned Django deployment settings are platform-independent. A hosted platform, reverse proxy, or self-host ingress may implement the outer network boundary, but it must preserve the following contract:

```text
Public client
   ↓ HTTPS
Trusted TLS-terminating ingress
   ├──→ Next.js Web / BFF
   └──→ supported Itemshelf API ingress
             ↓
          Django / DRF
             ↓ private network
          PostgreSQL
```

The Django container port must not be reachable directly from the public Internet. Public requests must first pass through a trusted ingress that:

- terminates TLS and exposes public application traffic only over HTTPS;
- redirects public HTTP traffic to HTTPS before it reaches Django;
- removes any client-supplied `X-Forwarded-Proto` value and sets it from the actual external connection;
- preserves the original public `Host` value when forwarding a public API request;
- applies HSTS at the public boundary only after the operator has confirmed that the affected hostname is HTTPS-only.

Django uses `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` to interpret the trusted ingress scheme. This setting is safe only while untrusted clients cannot bypass the ingress and supply that header directly.

Trusted private service-to-service traffic may use HTTP. This is intentional for environments such as Railway private networking and a future private Compose network. Therefore Django does not enable `SECURE_SSL_REDIRECT`; the public ingress owns HTTP-to-HTTPS redirect behavior. HSTS is also owned by the ingress so it can cover the complete public origin rather than only Django responses.

Django always marks its session and CSRF cookies `Secure` in deployment settings. The current Web/BFF continues to keep Django session and CSRF transport on the server side; the Browser receives only the Next.js-owned browser session described in [`../frontend/README.md`](../frontend/README.md).

`DJANGO_ALLOWED_HOSTS` remains deployment-provided. It must contain every hostname that can legitimately reach Django in that deployment, including required private service names or platform healthcheck hosts and, once enabled, the public API host presented by the trusted ingress. Do not use a wildcard merely to avoid maintaining this list.

PostgreSQL remains private and must not be exposed as part of the public application ingress. The Browser continues to use the Next.js Web/BFF rather than Django directly, so first-party device/API access does not by itself require CORS. A future browser-to-Django cross-origin flow would require a separate explicit design.

## Current Railway topology

The current Railway staging deployment keeps the following topology:

```text
Browser
   ↓
Next.js frontend / BFF (public)
   ↓ Railway private network
Django / DRF backend (private)
   ↓ Railway private network
PostgreSQL (private)
```

This is the current deployment state, not the complete Itemshelf API client architecture. First-party non-browser clients may be direct consumers of the Itemshelf API as defined in [`api-architecture.md`](api-architecture.md), but the Railway backend remains private until device authentication and an intentional public ingress are implemented.

Do not add CORS relaxation or a generic Next.js proxy merely to bypass the current deployment boundary.

## Build the images locally

Run both builds from the repository root. The repository root is intentionally the Docker build context because the frontend generates its API client from the committed `backend/schema.yaml` contract.

```bash
docker build --file backend/Dockerfile --tag itemshelf-backend:local .
docker build --file frontend/Dockerfile --tag itemshelf-frontend:local .
```

The frontend image regenerates the Orval client before `next build`; generated client files remain uncommitted. The production image uses Next.js standalone output. The backend image installs application dependencies from `backend/uv.lock` and runs Gunicorn. PostgreSQL connectivity uses the Psycopg 3 binary implementation selected in `backend/pyproject.toml`.

## Self-host Docker Compose topology

The root `compose.yaml` is the repository-owned source-build topology for self-hosting. It reuses the same production Dockerfiles used by hosted deployment and keeps service boundaries explicit:

```text
Host loopback / trusted ingress
             ↓
        Next.js frontend
             ↓ Compose network
         Django / DRF
             ↓
          PostgreSQL

PostgreSQL healthy
        ↓
migration job completed
        ↓
backend healthy
        ↓
frontend
```

The services are:

- `postgres`: PostgreSQL 18 with a persistent named volume and a `pg_isready` healthcheck.
- `migrate`: a one-shot backend image that runs `python manage.py migrate --noinput` after PostgreSQL becomes healthy.
- `backend`: the existing Gunicorn image using `config.settings.deployment`; startup requires both PostgreSQL health and successful migration.
- `frontend`: the existing Next.js standalone image; it uses `http://backend:8000` as its server-only backend origin and starts after backend readiness succeeds.

PostgreSQL 18 changed the Docker Official Image data layout. The Compose volume is therefore mounted at `/var/lib/postgresql`, not the pre-18 `/var/lib/postgresql/data` path.

Neither PostgreSQL port 5432 nor Django port 8000 is published to the host. The frontend is the only published service and binds to `127.0.0.1:3000` by default. `ITEMSHELF_BIND_ADDRESS` and `ITEMSHELF_PORT` may change that host bind, but changing the address is not a substitute for the trusted HTTPS ingress required by the deployment security contract above. The Next.js browser session cookie remains `Secure` for production non-loopback hosts and HTTPS-forwarded requests; only direct loopback HTTP access omits `Secure` so the documented local endpoint can retain authenticated sessions.

Self-host secrets are operator-owned values in the root `.env` file. Start from `.env.example`; Compose rejects startup when the required PostgreSQL, Django, or frontend session secret is empty. The current `DATABASE_URL` construction expects a URL-safe PostgreSQL password, so the documented generation command uses hexadecimal output.

The Compose stack does not make the Django API publicly reachable. A public API path for first-party devices requires the intentional reverse-proxy/TLS ingress contract handled separately. Railway remains an independent deployment consumer of the same Docker images; this Compose topology does not replace or configure Railway.

From the repository root:

```bash
cp .env.example .env
chmod 600 .env
# Fill the required secrets in .env.

docker compose config --quiet
docker compose up --build --wait
```

`docker compose down` stops the stack and preserves the `postgres_data` volume. Removing that volume is a destructive data-management operation and is not part of normal shutdown.

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

The deployment settings intentionally silence only `security.W004` and `security.W008`. These correspond to HSTS and Django-side HTTP-to-HTTPS redirect, which the deployment security contract assigns to the trusted public ingress. `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` are enabled, so their deployment checks are no longer silenced. Any other deployment warning remains unsilenced and fails the strict check above.

`SECURE_PROXY_SSL_HEADER` does not make arbitrary forwarded headers trustworthy. The ingress must strip a client-provided `X-Forwarded-Proto` value and set its own value, and the Django container must not be directly reachable by untrusted clients. Private Next.js/BFF-to-Django calls that legitimately use HTTP do not set `X-Forwarded-Proto: https` and are not redirected by Django.

The Railway deployment itself validates PostgreSQL connectivity during the pre-deploy migration and again through the backend readiness healthcheck before the deployment becomes active.

## Railway staging topology

The persistent `staging` environment is represented by `.railway/railway.ts` as two application services plus Railway PostgreSQL. Review infrastructure changes with `railway config plan` before applying them. A baseline plan must not unexpectedly recreate, delete, unmount, or reconfigure services, variables, domains, or volumes.

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

The existing `postgres-volume` is part of the staging baseline and must be preserved at its current Railway mount. The repository's self-host `postgres_data` volume is a separate Compose resource and must not be substituted for the Railway-managed volume.

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

## Railway Infrastructure as Code

`.railway/railway.ts` is the repository source of truth for the persistent Railway `staging` topology. The root `package.json` pins the TypeScript Railway SDK used by the authoring file; it is repository tooling and is separate from both application dependency sets.

The committed baseline describes the existing `frontend`, `backend`, `Postgres`, and `postgres-volume` resources. Docker remains responsible for building the frontend and backend images. Railway native PR Environments remain responsible for preview lifecycle and are not managed by the IaC file.

Install the repository-level SDK:

```bash
npm install
```

The `railway` npm package is the TypeScript SDK used by `.railway/railway.ts`; it does not provide the `railway` CLI command. Install Railway CLI separately. On macOS with Homebrew:

```bash
brew install railway
```

Or use Railway's official installer:

```bash
bash <(curl -fsSL railway.com/install.sh) -y
```

Then authenticate, link the checkout, and review the plan:

```bash
railway --version
railway login
railway link
railway config plan --detailed-exit-code
```

The pinned `railway@3.12.0` SDK requires Railway CLI 5.42.1 or newer. The repository's pinned Node.js 24 runtime satisfies the SDK's Node.js 22+ requirement.

`railway config plan` is read-only. With `--detailed-exit-code`, exit code `0` means the selected Railway environment is already aligned with the authoring file, while exit code `2` means changes are pending. Review the complete plan before any apply.

To intentionally refresh the authoring file from the current linked Railway environment, use:

```bash
railway config pull --force
git diff -- .railway/railway.ts
railway config plan --detailed-exit-code
```

Do not use `railway config pull --include-variables` for a committed baseline because that option can decrypt and inline non-sealed Railway values. Imported values that must remain Railway-managed should stay represented by `preserve()` or by an explicit resource reference where the contract requires one.

Applying IaC remains manual in this change:

```bash
railway config apply
```

Do not apply unless the plan contains only the changes intentionally reviewed for that operation. In particular, a baseline refresh must not unexpectedly recreate or delete `frontend`, `backend`, `Postgres`, or `postgres-volume`, change public/private networking, or clear existing variables. GitHub Actions plan/apply automation is separate follow-up work.

Do not add `railway.toml` or `railway.json`. Railway Config as Code is deprecated; `.railway/railway.ts` owns project-level Railway configuration while `compose.yaml` independently owns self-host runtime topology.

## Primary references

- Railway Infrastructure as Code: https://docs.railway.com/infrastructure-as-code
- Railway Infrastructure as Code reference: https://docs.railway.com/infrastructure-as-code/reference
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
