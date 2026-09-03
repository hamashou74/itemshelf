# Itemshelf Frontend

## Requirements

- Node.js (`.node-version`)
- Itemshelf backend

## Setup

1. npm ci
2. .env.example を .env.local にコピー
3. npm run api:generate
4. npm run dev

## Environment Variables

NEXT_PUBLIC_API_TIMEOUT_MS
API_TIMEOUT_MS
BACKEND_API_ORIGIN

## API Client Generation

backend/schema.yaml が source of truth。

生成されるもの:

- Axios client
- TypeScript models
- Zod schemas
- MSW handlers
- Faker factories

lib/api/generated/ は Git 管理しない。
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
