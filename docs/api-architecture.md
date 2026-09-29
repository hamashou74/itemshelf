# Itemshelf API Architecture

This document defines the logical application and API boundaries for Itemshelf. Deployment-specific topology is documented separately in [`deployment.md`](deployment.md).

## Decision

Django/DRF is the canonical **Itemshelf API** and the application boundary that owns domain behavior, authentication/authorization enforcement, business validation, and persistence.

Next.js is the first-party **Web application and Backend for Frontend (BFF)**. It owns browser-facing rendering, UI orchestration, Server Components, Server Actions, and the browser-facing session transport used by the Web application. It is not the canonical domain API and must not become a generic proxy that re-exports arbitrary Django endpoints.

First-party non-browser clients, such as a barcode-scanner device, are valid direct consumers of the Itemshelf API once their authentication and deployment/security prerequisites have been implemented.

```text
Web Browser
    |
    v
Next.js Web / BFF ---------+
                           |
Barcode Scanner -----------+----> Django / DRF ----> PostgreSQL
                           |
Other first-party client --+
```

"Direct" API consumption means communicating with the supported Itemshelf API ingress. It does not imply publishing the Django container port directly to the Internet.

## Responsibilities

### Browser

The Browser interacts with the Itemshelf Web application. Normal product flows do not call Django/DRF directly and do not manage Django session or CSRF credentials.

### Next.js Web / BFF

Next.js:

- renders the Web UI and performs Web-specific orchestration;
- calls the Itemshelf API from server-side code;
- owns the browser-facing encrypted session transport;
- may expose explicit Route Handlers where the Web application genuinely requires an HTTP endpoint;
- must not own domain persistence or final authorization;
- must not provide a generic pass-through for arbitrary Itemshelf API paths.

### Django / DRF

Django/DRF:

- is the canonical Itemshelf domain API;
- owns authentication/session validity and final authorization;
- owns domain and business validation;
- is the only application service that reads or writes domain data in PostgreSQL;
- may support more than one authentication scheme when different first-party client classes require it.

The current default `SessionAuthentication` remains the Web application's backend authentication mechanism. Authentication for device/API clients is a separate design decision and is not defined here.

### PostgreSQL

PostgreSQL is an internal persistence dependency of Django. Browser, Next.js application logic, and device clients do not access it directly.

## API contract

`backend/schema.yaml` is the machine-readable source of truth for the **Itemshelf API contract**.

The Next.js Orval client is one generated consumer of this contract. The schema is not defined as a private Next.js-to-Django contract, even though Next.js is currently its only product client.

Changes to the API contract must be made at the Django/DRF boundary and reflected in the generated OpenAPI schema. Client-specific adapters may map that contract into UI-specific models or errors without redefining the domain API.

## Current deployment versus logical architecture

The current Railway deployment keeps Django on Railway private networking and exposes only Next.js publicly. Therefore, a barcode scanner or other non-BFF client cannot use the Itemshelf API directly in the current deployment.

That is a deployment limitation, not a permanent architectural constraint. Enabling direct first-party API clients requires a separately designed public ingress and security boundary; it does not require making the Django container port itself public.

## Out of scope

This decision intentionally does not define:

- the credential format or authentication mechanism for device/API clients;
- credential issuance, revocation, rotation, scopes, or device registration;
- API URL versioning, compatibility guarantees, pagination, or canonical error representation;
- CORS policy, reverse proxy selection, TLS termination, public ingress, or trusted-proxy settings;
- Docker Compose/self-host deployment details;
- a third-party public developer API.

Those concerns are follow-up design tasks and must not be inferred from this document.

## Consequences

- The existing Web/BFF boundary remains valid: Browser product flows continue through Next.js.
- Django/DRF must be designed as an independently consumable domain API rather than as a permanently private implementation detail of Next.js.
- Future device authentication can be added at the DRF authentication boundary without replacing the Web application's session-based flow.
- API compatibility decisions become relevant beyond the Web frontend and are handled in the public API contract task.
- Deployment/security settings that assume Django is permanently private must be revisited before direct non-BFF clients are enabled.

## References

- Next.js: [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)
- Django REST framework: [Authentication](https://www.django-rest-framework.org/api-guide/authentication/)
