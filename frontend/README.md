# Itemshelf Frontend

Repository setup, tool versions, development environment preparation, and the combined development workflow are documented in the root [`README.md`](../README.md). Treat the root README as the source of truth for those repository-level procedures.

## Local Development

The frontend development environment file is `frontend/.env.development`. Create it manually from `frontend/.env.development.example` and configure `SESSION_SECRET` as described in the root README. `mise run setup` does not create or overwrite development environment files.

After repository setup, start both applications from the repository root with:

```bash
mise run dev
```

For frontend-only development:

```bash
cd frontend
npm run dev
```

The Node.js version is managed by the root `mise.toml`.

## Environment Variables

- `API_TIMEOUT_MS`
- `BACKEND_API_ORIGIN`
- `SESSION_SECRET`

`SESSION_SECRET` is a server-only secret used by Next.js to encrypt and verify the browser-facing session cookie. Use a random value of at least 32 characters and do not expose it publicly.

## Application Architecture

Itemshelf の product web application は、次の境界を採用する。

```text
Browser
   ↓
Next.js frontend / BFF
   ↓
Django / DRF
   ↓
Database
```

Browser は Django/DRF や Database を直接利用しない。Next.js は browser-facing な web application boundary として UI orchestration、Server Components、Server Actions、browser-facing session transport を担当する。Django/DRF は domain API、authentication/session validity、authorization、business validation、persistence を担当し、Database へのアクセスは Django 側に閉じる。

### Responsibility Matrix

- **Browser / Client Components**: UI rendering、interaction、form input、browser APIs を担当する。Django API transport、Django session/CSRF details、Database access は持たない。
- **Next.js**: Server rendering、feature queries/actions、browser-facing encrypted session transport、UI-specific orchestration and error mapping を担当する。Domain persistence、final authorization、direct Database access は持たない。
- **Django / DRF**: Domain API、authentication and session validity、Django request の CSRF enforcement、business validation、final authorization、persistence を担当する。Browser UI orchestration は持たない。
- **Database**: Persistent application data を保持する。Browser や Next.js の application logic は持たない。

### Read Flow

Server-rendered reads fetch data from Django through a server-only feature/query path.

```text
Browser page request
   ↓
Server Component
   ↓
feature query
   ↓
lib/backend/*
   ↓
Orval-generated Django client
   ↓
Django / DRF
   ↓
Database
```

Server Components must not call an Itemshelf Route Handler merely to reach Django. When code is already executing on the Next.js server, call the server-only backend boundary directly and avoid an unnecessary internal HTTP hop.

### Mutation Flow

Browser-originated application mutations use Server Actions by default.

```text
Browser / Client Component
   ↓
Server Action
   ↓
lib/backend/*
   ↓
Orval-generated Django client
   ↓
Django / DRF
   ↓
Database
```

Server Actions validate and normalize untrusted browser input for the web boundary, then delegate to Django. Django still performs backend validation and final authorization; frontend validation does not replace backend validation.

### Route Handlers

Add a Route Handler only when the Browser or an external caller actually needs an HTTP endpoint owned by Next.js, such as a browser-only integration, polling endpoint, upload/download flow, callback, webhook, or streaming endpoint.

A Route Handler that exists only to proxy arbitrary Django paths is prohibited. Do not reintroduce a generic `/api/:path*` pass-through or equivalent browser-to-Django tunnel.

When a Route Handler is required, it follows the same backend boundary:

```text
Browser / external caller
   ↓
explicit Route Handler
   ↓
lib/backend/*
   ↓
Django / DRF
```

### Authentication Boundary

Django remains the authentication and session-validity authority. Next.js does not maintain a second user/session database and does not replace Django authentication with a separate authentication authority.

The Browser receives the Next.js-owned `itemshelf_session` cookie. Its payload is encrypted and contains the backend session credential needed by the server-side adapter. Browser code does not read or manage Django's `sessionid` or `csrftoken` contract directly.

```text
Browser
   ↓ encrypted HttpOnly itemshelf_session
Next.js
   ↓ backend session credential + server-side Django CSRF handling
Django / DRF
   ↓ Django authentication/session checks
Database
```

Login and logout are Server Actions. Django issues and invalidates the authoritative session; Next.js only maps that backend session into or out of the browser-facing encrypted session transport.

### Backend Contract Boundary

`backend/schema.yaml` is the source of truth for the Next.js-to-Django API contract. Orval generates Axios clients, TypeScript models, Zod schemas, MSW handlers, and Faker factories under `lib/backend/generated/`.

Runtime application code outside `lib/backend/**` must not import generated Django artifacts directly. Feature code depends on server-only modules under `lib/backend/*`, which own generated transport details and contract parsing.

Tests may import generated MSW handlers and Faker factories directly for request interception and fixtures. ESLint enforces this boundary for both alias and relative imports.

### Forbidden Application Paths

Do not introduce these paths as normal product architecture:

```text
Browser ─X→ Django / DRF
Browser ─X→ Database
Next.js ─X→ Database
Client Component ─X→ lib/backend/*
runtime feature code ─X→ lib/backend/generated/*
generic Next.js proxy ─X→ arbitrary Django API paths
```

For a new feature, use a Server Component + feature query for reads and a Server Action for browser-originated mutations unless the feature has a concrete requirement for an HTTP endpoint.

## API Client Generation

`backend/schema.yaml` is the source of truth for the frontend-to-backend API contract.

Generated artifacts include:

- Axios client
- TypeScript models
- Zod schemas
- MSW handlers
- Faker factories

`lib/backend/generated/` is not committed and must not be edited manually.

`mise run setup` generates the client as part of initial repository setup. Regenerate it directly after changes to `backend/schema.yaml` or `frontend/orval.config.ts` with:

```bash
cd frontend
npm run api:generate
```

## Testing

Component-level test commands remain available directly:

```bash
npm run test
npm run test:run
npm run test:coverage
```

MSW and Faker artifacts are generated from the OpenAPI schema by Orval.

## Checks

Run the complete frontend CI contract from the repository root with:

```bash
mise run frontend:ci
```

The mise task supplies the committed `frontend/.env.test` values to the underlying npm CI script. That script runs these checks sequentially:

- `npm run api:generate`
- `npm run format:check`
- `npm run lint`
- `npm run test:run`
- `npm run build`

Individual npm scripts remain available for targeted checks. Direct `npm run ci` expects the required environment variables to already be available in the process environment.
