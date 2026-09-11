# Itemshelf

## Requirements

- Git
- mise 2026.6.0 or newer

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

Generate separate values for each secret. The `.env.development` files are local configuration and must not be committed.

Install project dependencies and generate the frontend API client:

```bash
mise run setup
```

## Development

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

Backend and frontend-specific commands remain available through Poe and npm when they are needed directly.
