# Itemshelf Frontend

## Requirements

- Node.js (`../.tool-versions`)
- Itemshelf backend

## Setup

1. npm ci
2. .env.development.example を .env.development にコピー
3. `openssl rand -base64 32` などで `SESSION_SECRET` を生成して設定
4. npm run api:generate
5. npm run dev

## Environment Variables

API_TIMEOUT_MS
BACKEND_API_ORIGIN
SESSION_SECRET

`SESSION_SECRET` は Next.js が browser-facing session cookie を暗号化・検証するための server-only secret。32文字以上のランダムな値を使用し、公開しない。未設定または32文字未満の場合は起動時の利用箇所でエラーになる。

## Application Architecture

Itemshelf frontend は Next.js の browser-facing application / BFF として動作する。

- browser は Next.js にアクセスする。
- Next.js server code は Django REST Framework API にアクセスする。
- browser から Django API へ直接アクセスしない。
- frontend から DB へ直接アクセスしない。
- Django/DRF が認証状態と domain data の authority である。

## Authentication

認証方式は Django session authentication を利用する。

### Browser session

browser 側には Django の session cookie を直接保存しない。

Next.js は `iron-session` で encrypted/signed httpOnly cookie を管理する。

cookie の主な設定:

- httpOnly
- sameSite=lax
- secure=production のみ
- path=/

browser cookie には Django の session cookie value と CSRF token value を保存する。

### Login

1. browser -> Next.js login action
2. Next.js -> Django `GET /api/auth/csrf/`
3. Django が CSRF cookie を返す
4. Next.js -> Django `POST /api/auth/login/`
5. Django が session cookie を返す
6. Next.js が session/CSRF value を iron-session に保存
7. browser には encrypted Next.js session cookie だけを返す

### Authenticated backend request

Next.js server code は `backendFetch` を通して Django API にアクセスする。

`backendFetch` は保存済みの Django session cookie と CSRF token を request に付与する。

unsafe method では:

- `X-CSRFToken`
- Django CSRF cookie

を送信する。

### Logout

1. browser -> Next.js logout action
2. Next.js -> Django `POST /api/auth/logout/`
3. Django session を invalidation
4. Next.js local session を clear

backend logout が network error などで失敗した場合でも local session は削除する。

### Current user

Next.js は Django の `GET /api/auth/me/` を authentication source of truth として使用する。

未認証の場合は `null` として扱う。

## Backend Integration

backend integration code は `lib/backend` 以下に置く。

### `generated/`

Orval で backend OpenAPI schema から生成された client/types。

手書きで編集しない。

### `transport.ts`

Django API への共通 transport。

責務:

- `BACKEND_API_ORIGIN` の適用
- timeout
- JSON handling
- error mapping
- Django session cookie forwarding
- CSRF token forwarding
- `credentials: "include"`

### `errors.ts`

backend error response を frontend 内部の error type に変換する。

`BackendRequestError` は HTTP status と response body を保持する。

### `set-cookie.ts`

Django response の `Set-Cookie` から必要な cookie value を取得する。

Node.js runtime 向け実装。

### `session.ts`

iron-session を利用した Next.js server-only session storage。

## Generated Client

Orval config は `orval.config.ts`。

OpenAPI source:

`../backend/schema.yaml`

生成先:

- `lib/backend/generated/`
- `lib/backend/generated/model/`

生成コマンド:

npm run api:generate

OpenAPI schema が変更された場合は generated client も更新する。

## Testing

Vitest + Testing Library + MSW/Faker を使用する。

### Unit tests

server-side auth/backend modules は Vitest で unit test する。

主な対象:

- auth actions
- backend transport
- session handling
- Set-Cookie parsing

### Browser tests

component tests は jsdom + Testing Library を利用する。

server-only auth modules は必要に応じて mock する。

### API mocks

MSW/Faker は OpenAPI から Orval で生成。

## Checks

npm run ci

`npm run ci` は以下を順番に実行する。

- npm run api:generate
- npm run format:check
- npm run lint
- npm run test:run
- npm run build
