# Railway configuration

Itemshelf manages the persistent Railway `staging` topology with the project-level authoring file:

```text
.railway/railway.ts
```

The application Dockerfiles remain the image build contract. The root `compose.yaml` is the separate self-host topology. Railway native PR Environments remain the preview lifecycle.

## Prerequisites

The root `package.json` pins the Railway TypeScript SDK used by `.railway/railway.ts`. Install that repository-local SDK from the repository root:

```bash
npm ci
```

The SDK package is named `railway`, but it does not install the `railway` CLI command. Install Railway CLI separately. On macOS with Homebrew:

```bash
brew install railway
```

Alternatively, use Railway's official installer:

```bash
bash <(curl -fsSL railway.com/install.sh) -y
```

Itemshelf requires Railway CLI 5.46.0 or newer because the staging safety guard depends on the IaC project/environment context introduced in that CLI line. The pinned `railway@3.13.0` SDK itself accepts older CLI versions, but they do not provide enough target context for this repository's guard. Verify the CLI before continuing:

```bash
railway --version
```

Authenticate, link the project, then explicitly select the persistent `staging` environment:

```bash
railway login
railway link
railway environment staging
railway status
```

Before running any IaC plan or apply, verify that `railway status` reports the `staging` environment. The authoring file also fails closed unless Railway evaluates it for the `Itemshelf` project and `staging` environment. Native PR Environments such as `itemshelf-pr-91` intentionally deploy the pull-request branch and must not be managed by this persistent staging baseline.

## Review the baseline

Type-check the committed authoring file before using it:

```bash
npm run railway:typecheck
```

Preview changes without applying them:

```bash
railway config plan --detailed-exit-code
```

A clean baseline exits with code `0` and reports that the Railway configuration is already up to date. Exit code `2` means the authoring file and live environment differ.

Do not apply a plan that unexpectedly creates, deletes, unmounts, or reconfigures `frontend`, `backend`, `Postgres`, `postgres-volume`, networking, domains, or variables.

## Refresh from Railway

When the live `staging` state intentionally changes, refresh the authoring file and inspect the generated diff:

```bash
railway config pull --force
git diff -- .railway/railway.ts
railway config plan --detailed-exit-code
```

Do not use `--include-variables` for committed configuration. That option can decrypt and inline non-sealed values. Keep Railway-managed values represented by `preserve()` or explicit resource references.

Generated Railway service domains are platform-managed and do not need to be authored. Existing unauthored networking keys remain untouched by Railway IaC.

## Apply

Apply only after reviewing an authoritative plan:

```bash
railway config apply
```

Automated plan/apply in GitHub Actions is intentionally outside the scope of the baseline change.
