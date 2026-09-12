# Itemshelf Backend

Repository setup, tool versions, development environment preparation, and the combined development workflow are documented in the root [`README.md`](../README.md). Treat the root README as the source of truth for those repository-level procedures.

## Local Development

The backend development environment file is `backend/.env.development`. Create it manually from `backend/.env.development.example` and configure `DJANGO_SECRET_KEY` as described in the root README. `mise run setup` does not create or overwrite development environment files.

After repository setup, start both applications from the repository root with:

```bash
mise run dev
```

For backend-only development:

```bash
cd backend
uv run poe dev
```

The Python and uv versions are managed by the root `mise.toml`.

## Poe Tasks and Environment Selection

`uv run poe dev` and `uv run poe ci` are the environment-aware backend workflows:

- `dev` loads `.env.development` and starts the Django development server.
- `ci` loads `.env.test` and runs linting, formatting checks, type checking, migration checks, Django system checks, schema verification, and tests.

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

Run the complete backend CI contract from the repository root with:

```bash
mise run backend:ci
```

For targeted backend checks from `backend/`, use the corresponding Poe task, for example:

```bash
uv run poe lint
uv run poe type-check
uv run poe test
```

`uv run poe coverage` runs the test suite with coverage using `.env.test`.
