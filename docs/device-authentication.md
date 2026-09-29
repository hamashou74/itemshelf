# Device API Client Authentication

This document defines authentication and credential lifecycle for first-party non-browser Itemshelf API clients such as a barcode scanner. The overall service boundary is defined in [`api-architecture.md`](api-architecture.md).

## Decision

The Itemshelf Web/BFF continues to use Django `SessionAuthentication`.

First-party input-constrained devices use **OAuth 2.0 Device Authorization Grant (RFC 8628)** implemented with **Django OAuth Toolkit (DOT)**.

The device stores OAuth access and refresh tokens, never the user's Itemshelf username/password. Access tokens are sent as bearer credentials in the HTTP `Authorization` header.

Itemshelf keeps a small product-level `Device` record for physical-device lifecycle and auditing. One Device is bound to one DOT refresh-token family:

```text
Itemshelf User
      |
      +-- Device
            |
            +-- OAuth refresh-token family
                    |
                    +-- short-lived Access Token
                    +-- rotating Refresh Token
```

Refresh-token rotation does not create a new Device identity because DOT preserves the same `token_family` UUID across rotations.

## Why OAuth Device Authorization Grant

The scanner is an Internet-connected first-party device whose input and browser capabilities may be constrained. RFC 8628 is specifically designed for this class of client: the device initiates authorization, the user completes authorization with a browser on another device, and the scanner polls the token endpoint until the authorization is approved or denied.

Using DOT avoids Itemshelf owning security-sensitive protocol machinery that already exists in a mature OAuth implementation, including:

- device authorization codes and polling semantics;
- access and refresh token issuance;
- refresh-token rotation;
- refresh-token replay detection and token-family revocation;
- OAuth scopes;
- token revocation;
- DRF OAuth bearer authentication;
- RFC 9700-compliant token storage that does not persist reusable token values in plaintext.

## Runtime compatibility policy

DOT 3.4.1 does not yet list Django 6.1 in its published support matrix. That fact is treated as a maintenance-risk signal, not an automatic blocker.

Itemshelf accepts a dependency outside its declared matrix when compatibility is demonstrated against the repository's actual supported runtime and protected by project tests.

For DOT 3.4.1, compatibility was verified in Itemshelf PR #101 using:

- Python 3.14;
- Django 6.1;
- Django REST framework 3.18;
- DOT installation alongside the Itemshelf locked environment;
- DOT migrations and Django system checks;
- complete Device Authorization Grant initiation and user approval;
- access-token and refresh-token issuance;
- DRF `OAuth2Authentication` with scope enforcement;
- RFC 9700 hashed-at-rest token storage;
- refresh-token rotation;
- stable `token_family` identity across rotation;
- token-family revocation invalidating the device's access token.

DOT 3.4.1 also contains an upstream fix specifically for a Django 6.1 system-check behavior change. Therefore the absence of a Django 6.1 classifier/test-matrix row is not evidence that this release is unaware of Django 6.1.

The implementation must retain focused compatibility tests so a future Django, DRF, Python, or DOT upgrade cannot silently break the supported device flow. An upgrade to any of those components requires those tests to pass before merge.

## OAuth client model

Itemshelf operates a server-managed **public OAuth client** for the official scanner client.

The client uses DOT's Device Code grant type and does not rely on a client secret stored on the physical scanner. The OAuth client registration represents the Itemshelf scanner software/protocol, not an individual physical device.

Physical device identity is represented by the Itemshelf `Device` model and the OAuth refresh-token family created by an individual successful authorization.

Itemshelf does not enable generic third-party OAuth client registration as part of this design.

## Browser/BFF authorization boundary

Adopting OAuth does not change the Web architecture decision that normal browser product flows go through Next.js/BFF.

DOT's built-in `/o/device` confirmation pages require a Django browser session. Itemshelf does not use those pages as its product authorization UI because the Browser does not own Django's `sessionid`.

Instead:

```text
Scanner
   |
   | device authorization request
   v
Django / DOT
   |
   | verification_uri
   v
Next.js device authorization page
   |
   | Server Action + backend session
   v
Django device-approval API
   |
   v
DOT DeviceGrant
```

The scanner-facing device authorization and token endpoints are publicly reachable API endpoints.

The verification URI points to an explicit Next.js page. That page uses the existing Web/BFF session and server-side backend transport. A dedicated session-authenticated Django API reads the pending DeviceGrant and approves or denies it.

The approval API must perform the equivalent security checks required by the DOT flow:

- the user code exists;
- the grant is still pending;
- the grant has not expired;
- the authenticated user is the user approving the grant;
- the requested scopes shown to the user are the scopes that will be authorized;
- approval/denial is atomic so the same grant cannot be claimed by two users.

The generic DOT HTML authorization pages do not need to be exposed as Itemshelf product UI.

## Device registration and token-family binding

A successful OAuth device flow creates an access token and a refresh-token family but does not by itself create Itemshelf product metadata for the physical scanner.

After receiving its first token pair, the scanner calls the explicit Itemshelf device-registration endpoint.

That endpoint:

1. authenticates the OAuth access token;
2. resolves the current refresh token associated with the access token;
3. obtains the stable DOT `token_family` UUID;
4. creates an Itemshelf Device owned by `request.user`;
5. binds that Device to the token family;
6. records user-visible device metadata such as its name.

A token family that is not yet bound to an active Device may access only the device-registration operation. All other device-capable Itemshelf endpoints require an active Device binding.

The minimum logical Device record is:

- `id`: random UUID;
- `user`: owning Itemshelf user;
- `token_family`: unique OAuth refresh-token-family UUID;
- `name`: user-visible device name;
- `created_at`;
- `revoked_at`: null while active;
- `last_used_at`: best-effort audit timestamp.

A complete re-authorization creates a new token family. Refresh-token rotation within an authorization keeps the existing family and therefore keeps the same Device binding.

## Authentication mapping

Device-capable DRF endpoints use DOT's `OAuth2Authentication`.

For a valid OAuth access token:

- `request.user` is the Itemshelf user who authorized the device;
- `request.auth` is the DOT access-token object;
- the Itemshelf device layer resolves the corresponding token family and active Device.

The existing browser/Web authentication endpoints remain session-oriented. They are not converted to OAuth token login endpoints.

OAuth bearer requests do not use Django session CSRF credentials. This does not change CSRF requirements for session-authenticated requests.

## Authorization and scopes

OAuth authentication does not grant unrestricted API access.

Device-capable endpoints require all of the following:

1. a valid OAuth access token;
2. an active Itemshelf Device bound to that token family;
3. the endpoint's required OAuth scope;
4. the normal user/object authorization rules.

OAuth scopes can only reduce what the owning user may do; they never grant permissions the user does not have.

Itemshelf uses a **fixed, server-defined scope vocabulary**, not arbitrary user-defined or database-created scopes. Exact scope names and their endpoint mapping are finalized with the public API contract so that authentication design does not pre-empt the resource model.

Account security, Web login/logout, device-management operations performed by the user, Django Admin, and other operator-only surfaces do not become accessible merely because a device has an OAuth token.

## Token storage and transport

Access tokens are sent only as bearer tokens in the HTTP `Authorization` header and only over HTTPS.

Itemshelf enables DOT's RFC 9700-compliant token-storage mode so reusable access and refresh token values are not stored in plaintext in the database. Token lookup uses their checksums.

The scanner must validate the server certificate and must not send bearer credentials to an untrusted origin.

Application logs, exception reporting, tracing, and audit logs must not record `Authorization` values, device codes, access tokens, or refresh tokens.

## Access-token lifetime

Access tokens are short-lived. The scanner refreshes them without requiring the user to repeat the browser authorization flow.

The concrete access-token lifetime is a security/operations setting chosen during implementation and validated with the scanner behavior. It must not be treated as a permanent device identity.

The Device is identified by the token family, not by a particular access-token value.

## Refresh-token rotation and replay protection

DOT refresh-token rotation remains enabled.

Itemshelf also enables refresh-token reuse protection. Reuse of a superseded refresh token outside the configured immediate retry allowance revokes the token family, requiring the device to be authorized again.

A small grace period may be configured for the immediately preceding refresh token so a lost refresh response does not strand the scanner during transient network failure. DOT 3.4.1 constrains that grace behavior to the immediately preceding generation; older replay still triggers family protection.

A refresh-token secret is never treated as the Device identifier. Rotation may replace the secret while preserving the Device's `token_family`.

## Revocation and lost devices

Device revocation is an Itemshelf operation initiated by the user through the Web/BFF.

Revoking a Device:

1. marks the Device revoked;
2. revokes the DOT refresh-token family;
3. invalidates the family's live access tokens.

This is the normal lost-device response.

The revoked Device record is retained as audit history rather than immediately hard-deleted.

A device permission check also rejects a revoked Device even if a concurrent request races with token revocation.

An inactive owning user cannot use device access through Itemshelf. Account-wide security operations may explicitly revoke all of a user's Devices; Web logout or an ordinary Web session expiry does not silently destroy independent device authorizations.

## Re-authorization

If a refresh-token family expires, is revoked, or is invalidated because refresh-token reuse is detected, the scanner repeats the Device Authorization Grant.

A complete re-authorization produces a new token family. The previous revoked Device/authorization history is not silently reactivated.

If a future product requirement needs stable hardware identity across repeated OAuth authorizations, add a separate installation/hardware identifier. OAuth token values themselves must not be used as hardware identity.

## Last-used auditing

A successful device-authenticated Itemshelf API request updates the Device's `last_used_at` on a best-effort basis.

The implementation must not write this field on every scan/request. Updates are coalesced or write-throttled so the field remains operationally useful without becoming a hot database write path.

The initial design does not retain request payloads or a historical list of client IP addresses as credential audit metadata.

## Public OAuth surface

Only OAuth endpoints required by the selected first-party flows should be mounted/exposed.

The implementation requires at least:

- Device Authorization endpoint;
- Token endpoint for device-code exchange and refresh;
- the metadata needed by supported clients if discovery is adopted;
- server-side revocation capability.

Generic application registration, dynamic client registration, authorization-code UI, password grant, implicit grant, OIDC, and unrelated management surfaces are not enabled merely because DOT provides them.

The exact externally visible paths are part of the public API/deployment contract and are finalized in follow-up design.

## Alternatives considered

### Itemshelf-owned opaque DeviceCredential

A project-owned opaque credential can model Device ownership and revocation directly and remains a viable fallback.

It is not the selected default because, once DOT compatibility was verified, doing so would make Itemshelf own device pairing, refresh/rotation behavior, replay handling, OAuth-like scopes, and credential lifecycle that are already implemented by a standard protocol and maintained library.

### DRF TokenAuthentication

DRF's built-in token authentication is intentionally simple and does not provide the browser-assisted device authorization, refresh-token rotation, token-family replay protection, or first-class scope model needed here.

### Django-Rest-Knox

Knox provides multiple server-side tokens, hashed token storage, expiry, and revocation.

It does not provide the RFC 8628 Device Authorization Grant. Itemshelf would still need to invent the browser-assisted pairing protocol and the relationship between a physical scanner and its token lifecycle. Therefore it is not preferred even if it proves compatible with Django 6.1.

### JWT / Simple JWT

JWT is not selected for scanner authentication.

Itemshelf requires immediate lost-device revocation, stable server-side Device state, audit metadata, and browser-assisted device authorization. Those requirements already require server-side state, reducing the value of stateless JWT validation. Simple JWT also does not provide RFC 8628 device authorization.

### Custom implementation of RFC 8628

Itemshelf does not implement Device Authorization Grant itself. The security-sensitive protocol and token lifecycle are delegated to DOT, with Itemshelf adding only the BFF integration and Device-domain binding required by its architecture.

## Implementation boundary

This document selects the authentication protocol and lifecycle but does not finalize the public API contract.

A follow-up implementation issue should add:

- the tested DOT dependency;
- `oauth2_provider` application configuration and migrations;
- a server-managed public Device Code OAuth application for the official scanner;
- RFC 9700-compliant token-storage and refresh-reuse settings;
- only the required OAuth URL surface;
- the session-authenticated backend DeviceGrant approval/denial API used by Next.js;
- the Next.js verification/approval UI;
- the Itemshelf Device model bound to DOT `token_family`;
- device registration, revocation, active-device permission checks, and throttled last-used auditing;
- DRF OAuth2 authentication and fixed-scope enforcement on device-capable endpoints;
- OpenAPI representation of OAuth bearer authentication;
- focused compatibility and lifecycle tests using the repository's supported Python/Django/DRF versions.

Endpoint paths, common error representation, API versioning, and exact scope names belong to the public API-contract design.

## References

- RFC 8628: [OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628)
- RFC 6750: [OAuth 2.0 Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
- RFC 7009: [OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
- RFC 9700: [Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/html/rfc9700)
- Django OAuth Toolkit: [Device authorization grant flow](https://django-oauth-toolkit.readthedocs.io/en/stable/tutorial/tutorial_06.html)
- Django OAuth Toolkit: [Settings](https://django-oauth-toolkit.readthedocs.io/en/stable/settings.html)
- Django OAuth Toolkit: [Security](https://django-oauth-toolkit.readthedocs.io/en/stable/security.html)
- Django REST framework: [Authentication](https://www.django-rest-framework.org/api-guide/authentication/)
