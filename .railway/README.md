# Railway configuration

Itemshelf manages the persistent Railway `staging` topology with the project-level authoring file:

```text
.railway/railway.ts
```

The application Dockerfiles remain the image build contract. The root `compose.yaml` is the separate self-host topology. Railway native PR Environments remain the preview lifecycle.

## Prerequisites

The root `package.json` pins the Railway TypeScript SDK. Install repository-level tooling from the repository root:

```bash
npm install
```

Use Railway CLI 5.42.1 or newer with the pinned `railway@3.12.0` SDK.

Authenticate and link the checkout to the Itemshelf `staging` environment:

```bash
railway login
railway link
```

## Review the baseline

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
