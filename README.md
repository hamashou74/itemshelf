# Itemshelf

## Requirements

- Git
- mise 2026.6.0 or newer
- Docker Engine with Docker Compose v2, or Docker Desktop

The root `mise.toml` is the source of truth for the Python, Node.js, uv, and Lefthook versions used by the repository. Docker Compose provides the local PostgreSQL dependency and an optional full-container startup path.

## Initial Setup

Create the local development environment files from the committed templates and restrict them to the current user before adding secrets:

```bash
cp backend/.env.development.example backend/.env.development
cp frontend/.env.development.example frontend/.env.development
chmod 600 backend/.env.development frontend/.env.development
```

Edit the copied files and set the local secrets before starting the applications:

- `backend/.env.development`: set `DJANGO_SECRET_KEY` to a cryptographically random secret. Its committed example already points `DATABASE_URL` at the local PostgreSQL service on `127.0.0.1:5432`.
- `frontend/.env.development`: set `SESSION_SECRET` to a cryptographically random value of at least 32 characters.

For example, a random value can be generated locally with:

```bash
openssl rand -base64 48
```

Generate separate values for each secret. The `.env.development` files are local, operator-owned configuration and must not be committed. `mise run setup` does not create or overwrite them.

After the development environment files are configured, set up the repository:

```bash
mise run setup
```

This installs the backend and frontend dependencies, generates the frontend API client, and installs the Lefthook Git hooks.

## Repository Development

Run the repository-level workflow from the repository root.

Start the normal development environment with:

```bash
mise run dev
```

This starts the PostgreSQL 18 Compose service and waits for it to become healthy, applies Django development migrations, then starts the Django and Next.js development servers on the host. This is the canonical day-to-day workflow and retains the frameworks' normal development behavior and reloaders.

The PostgreSQL service persists data in the Compose named volume. To start or stop only that dependency:

```bash
mise run db:up
mise run db:down
```

To build and start the complete frontend/backend/PostgreSQL stack in containers instead:

```bash
mise run compose:up
```

This is equivalent to `docker compose up --build --wait`. It reuses the repository deployment Dockerfiles, runs backend migrations before Gunicorn starts, and waits for the database, backend, and frontend healthchecks. The containerized path is intended for local integration and deployment-like verification rather than source-code hot reload.

The local stack is available at:

- frontend: `http://127.0.0.1:3000`
- backend health: `http://127.0.0.1:8000/api/health`
- PostgreSQL: `127.0.0.1:5432`

The credentials committed in `compose.yaml` are local-only development values. Do not reuse them for Railway or production.

Stop and remove the Compose containers and network without deleting the PostgreSQL named volume with:

```bash
mise run compose:down
```

Format the repository:

```bash
mise run format
```

Run the complete repository checks:

```bash
mise run ci
```

The repository CI task ensures the local PostgreSQL service is healthy before running backend and frontend checks. Django tests use PostgreSQL and create their normal temporary test database rather than using SQLite.

These mise tasks are the canonical repository-level entry points. Backend Poe tasks and frontend npm scripts remain available when component-specific control is needed.

## Backend Commands

From `backend/`, the recommended Poe wrappers include the environment used by the workflow. Start PostgreSQL from the repository root before running backend commands directly:

```bash
mise run db:up
cd backend
uv run poe dev
uv run poe ci
```

`dev` loads `.env.development` and delegates to the development server. `ci` loads `.env.test` and runs the complete backend verification sequence. Both environments use the local PostgreSQL service by default. When using backend-only development on a fresh database, apply migrations from the repository root with `mise run backend:migrate`.

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

- [`backend/README.md`](backend/README.md): backend Poe tasks, PostgreSQL dependency, environment selection, API schema, and backend checks.
- [`frontend/README.md`](frontend/README.md): frontend architecture, API client generation, testing, and frontend checks.
- [`docs/deployment.md`](docs/deployment.md): Docker deployment contract and Railway staging/PR environment setup.
