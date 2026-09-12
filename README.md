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

Generate separate values for each secret. The `.env.development` files are local, operator-owned configuration and must not be committed. `mise run setup` does not create or overwrite them.

After the development environment files are configured, set up the repository:

```bash
mise run setup
```

This installs the backend and frontend dependencies, generates the frontend API client, and installs the Lefthook Git hooks.

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

Run the complete repository checks:

```bash
mise run ci
```

These mise tasks are the canonical repository-level entry points. Backend Poe tasks and frontend npm scripts remain available when component-specific control is needed.

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

See [`frontend/README.md`](frontend/README.md) for frontend architecture, API client generation, testing, and component-specific details.
