# Itemshelf Backend

Repository setup, tool versions, development environment preparation, PostgreSQL lifecycle, and the combined development workflow are documented in the root [`README.md`](../README.md). Treat the root README as the source of truth for those repository-level procedures.

## Local Development

The backend development environment file is `backend/.env.development`. Create it manually from `backend/.env.development.example` and configure `DJANGO_SECRET_KEY` as described in the root README. The example uses the repository's local PostgreSQL 18 service at `127.0.0.1:5432`; `mise run setup` does not create or overwrite development environment files.

After repository setup, start both applications from the repository root with:

```bash
mise run dev
```

This starts PostgreSQL through Compose, waits for database readiness, applies development migrations, and then starts the host-based Django and Next.js development servers.

For backend-only development, start PostgreSQL first and then run the backend workflow:

```bash
mise run db:up
cd backend
uv run poe dev
```

On a fresh development database, migrations can be applied from the repository root with:

```bash
mise run backend:migrate
```

The Python and uv versions are managed by the root `mise.toml`.

## Poe Tasks and Environment Selection

`uv run poe dev` and `uv run poe ci` are the environment-aware backend workflows:

- `dev` loads `.env.development` and starts the Django development server.
- `ci` loads `.env.test` and runs linting, formatting checks, type checking, migration checks, Django system checks, schema verification, and tests.

Both committed environment contracts use PostgreSQL. Django's test runner creates and removes its temporary test database using the local PostgreSQL service; SQLite is not the default backend verification path.

Lower-level tasks such as `runserver`, `check`, and `test` intentionally do not attach a Poe `envfile`:

```bash
uv run poe runserver
uv run poe check
uv run poe test
```

Use these raw tasks when the caller needs to select or override the environment explicitly. For example:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test uv run poe check
```

Other backend tasks defined in `pyproject.toml`, including `lint`, `format`, `format-check`, `type-check`, `migrations-check`, `schema`, and `schema-check`, remain directly callable through Poe.

## API Schema

`backend/schema.yaml` is the source of truth for the frontend-to-backend API contract.

Generate and validate the schema directly with:

```bash
uv run poe schema
```

The backend CI workflow uses `schema-check`, which regenerates the schema and fails if the committed `schema.yaml` would change.

## Checks and Tests

For the complete local repository CI contract, use the root command so PostgreSQL is prepared automatically:

```bash
mise run ci
```

To run only the backend CI contract, ensure PostgreSQL is running first:

```bash
mise run db:up
mise run backend:ci
```

For targeted backend checks from `backend/`, use the corresponding Poe task, for example:

```bash
uv run poe lint
uv run poe type-check
uv run poe test
```

`uv run poe coverage` runs the test suite with coverage using `.env.test` and therefore also requires the local PostgreSQL service.

GitHub Actions provides its own PostgreSQL 18 service container for the Backend job, so hosted backend checks exercise the same database engine without starting the repository Compose stack.
