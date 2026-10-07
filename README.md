# Itemshelf

## Requirements

- Git
- mise 2026.6.0 or newer

The root `mise.toml` is the source of truth for the Python, Node.js, uv, and Lefthook versions used by the repository.

## Initial Setup

Create the local development environment files from the committed templates and restrict them to the current user before adding secrets:

```bash
cp backend/.env.development.example backend/.env.development
cp frontend/.env.development.example frontend/.env.development
chmod 600 backend/.env.development frontend/.env.development
```

Edit the copied files and set the local secrets before starting the applications:

- `backend/.env.development`: set `DJANGO_SECRET_KEY` to a cryptographically random secret.
- `frontend/.env.development`: set `SESSION_SECRET` to a cryptographically random value of at least 32 characters.

For example, a random value can be generated locally with:

```bash
openssl rand -base64 48
```

Generate separate values for each secret. The `.env.development` files intentionally contain only values that must be supplied by the developer and must not be committed. Backend development defaults to SQLite at `backend/db.sqlite3` with loopback-only allowed hosts, while frontend development defaults to `http://127.0.0.1:8000` with a 10-second API timeout. Those defaults may still be overridden through process environment variables when a non-standard local setup requires it. `mise run setup` does not create or overwrite the development environment files.

After the development environment files are configured, set up the repository:

```bash
mise run setup
```

This installs the backend and frontend dependencies, generates the frontend API client, and installs the Lefthook Git hooks.

## Self-hosting from source

The root `compose.yaml` is the standard source-build topology for self-hosting. This runtime path requires Docker Engine (or a compatible Docker runtime) with Docker Compose v2; it does not require mise inside the application containers.

Create the operator-owned Compose environment file:

```bash
cp .env.example .env
chmod 600 .env
```

Set `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, and `SESSION_SECRET` in `.env`. These are the only required values in the self-host environment file. `ITEMSHELF_BIND_ADDRESS` and `ITEMSHELF_PORT` are optional overrides because `compose.yaml` owns their defaults. Generate each secret separately. The PostgreSQL password is embedded in a database URL by the current deployment settings, so use URL-safe characters; a hex value is suitable:

```bash
openssl rand -hex 32
```

Validate the resolved Compose model without printing secrets, then build and start the stack:

```bash
docker compose config --quiet
docker compose up --build --wait
```

The stack starts PostgreSQL, runs Django migrations as a one-shot service, waits for the backend readiness endpoint, and then starts the frontend. Only the frontend is published to the host, at `127.0.0.1:3000` by default. PostgreSQL and the Django container remain private to the Compose network.

Verify the frontend health endpoint and container state:

```bash
curl --fail http://127.0.0.1:3000/health
docker compose ps
```

The direct host bind is intentionally loopback-only. Authenticated browser sessions are supported on the default loopback HTTP endpoint: the frontend omits the cookie `Secure` attribute only for direct loopback HTTP access. Production requests for non-loopback hosts remain `Secure`, and a trusted ingress that forwards `X-Forwarded-Proto: https` also keeps the cookie `Secure`. Do not expose the bind address to an untrusted network without the trusted HTTPS ingress described in `docs/deployment.md`.

Stop the application while preserving PostgreSQL data:

```bash
docker compose down
```

The `postgres_data` named volume is retained. `docker compose down -v` deletes that database volume and should be used only when permanent data deletion is intended.

## Repository Development

Run the repository-level workflow from the repository root.

Start the backend and frontend development servers together:

```bash
mise run dev
```

Format the repository:

```bash
mise run format
```

Run the repository code and tooling checks that do not require Docker:

```bash
mise run ci
```

GitHub Actions additionally runs the Docker Compose integration/deployment smoke test documented in `docs/deployment.md`. That smoke test is intentionally separate from `mise run ci` so Docker remains optional for normal local development.

These mise tasks are the canonical repository-level entry points for normal development. Backend Poe tasks and frontend npm scripts remain available when component-specific control is needed.

## Backend Commands

From `backend/`, the recommended Poe wrappers include the environment used by the workflow:

```bash
cd backend
uv run poe dev
uv run poe ci
```

`dev` loads `.env.development` and delegates to the development server. `ci` loads `.env.test` and runs the complete backend verification sequence.

Lower-level tasks remain directly callable:

```bash
uv run poe runserver
uv run poe check
uv run poe test
```

These raw tasks do not attach a Poe `envfile`, so callers can select or override the environment explicitly when needed. For example:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test uv run poe check
```

This separation is intentional: `dev` and `ci` are the recommended environment-aware workflows, while `runserver`, `check`, `test`, and the other raw tasks remain reusable primitives.

## Frontend Commands

Repository setup and environment preparation are defined above. For frontend-only development after setup:

```bash
cd frontend
npm run dev
```

Individual frontend checks remain available through npm scripts. For the complete frontend CI contract, prefer the repository task because it supplies the committed test environment before running the npm CI script:

```bash
mise run frontend:ci
```

## Component Documentation

Repository-level setup and workflow remain canonical here. Component READMEs contain backend/frontend-specific details without redefining the repository setup procedure:

- [`backend/README.md`](backend/README.md): backend Poe tasks, environment selection, API schema, and backend checks.
- [`frontend/README.md`](frontend/README.md): frontend architecture, API client generation, testing, and frontend checks.
- [`docs/api-architecture.md`](docs/api-architecture.md): application/API boundaries and supported client relationships.
- [`docs/api-contract.md`](docs/api-contract.md): versioned HTTP API, errors, pagination, identifiers, OAuth scopes, and compatibility policy.
- [`docs/device-authentication.md`](docs/device-authentication.md): first-party device/API-client authentication and credential lifecycle.
- [`docs/deployment.md`](docs/deployment.md): Docker deployment contract and Railway staging/PR environment setup.
