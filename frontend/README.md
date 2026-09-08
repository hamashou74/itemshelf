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

## Backend Access Boundary

Browser code does not call Django/DRF directly. Browser-facing interactions go through the Next.js application boundary. Server Components and Server Actions call Django through server-only modules under `lib/backend`.

Runtime application code outside `lib/backend` must not import Orval-generated Django artifacts directly. Tests may import generated MSW handlers and Faker factories directly for test setup and fixtures.

Add a Route Handler only when a concrete browser-facing HTTP endpoint is required; do not add a generic pass-through proxy to Django.

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
