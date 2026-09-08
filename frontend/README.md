# Itemshelf Frontend

## Requirements

- Node.js (`.node-version`)
- Itemshelf backend

## Setup

1. npm ci
2. .env.example を .env.local にコピー
3. `openssl rand -base64 32` などで `SESSION_SECRET` を生成して設定
4. npm run api:generate
5. npm run dev

## Environment Variables

API_TIMEOUT_MS
BACKEND_API_ORIGIN
SESSION_SECRET

`SESSION_SECRET` は Next.js が browser-facing session cookie を暗号化・検証するための server-only secret。32文字以上のランダムな値を使用し、公開しない。未設定または32文字未満の場合は起動時の利用箇所でエラーになる。

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

| Layer | Responsibilities | Must not own |
| --- | --- | --- |
| Browser / Client Components | UI rendering, interaction, form input, browser APIs | Django API transport, Django session/CSRF details, Database access |
| Next.js | Server rendering, feature queries/actions, browser-facing encrypted session transport, UI-specific orchestration and error mapping | Domain persistence, final authorization, direct Database access |
| Django / DRF | Domain API, authentication and session validity, CSRF enforcement for Django requests, business validation, final authorization, persistence | Browser UI orchestration |
| Database | Persistent application data | Browser or Next.js application logic |

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

backend/schema.yaml が source of truth。

生成されるもの:

- Axios client
- TypeScript models
- Zod schemas
- MSW handlers
- Faker factories

lib/backend/generated/ は Git 管理しない。
手動編集禁止。

以下の場合に npm run api:generate:

- clone 後
- backend/schema.yaml 更新後
- orval.config.ts 更新後

## Testing

npm run test
npm run test:run
npm run test:coverage

MSW/Faker は OpenAPI から Orval で生成。

## Checks

npm run api:generate
npm run format:check
npm run lint
npm run test:run
npm run build
