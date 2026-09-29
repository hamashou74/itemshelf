# Itemshelf Public API Contract

This document defines the stable HTTP contract for the Itemshelf API described in [`api-architecture.md`](api-architecture.md). Device credential lifecycle is defined in [`device-authentication.md`](device-authentication.md).

"Public API" in this document means an Itemshelf API surface that may be reached through the supported application ingress by first-party clients. It does **not** mean anonymous access, a third-party developer platform, or direct publication of the Django container port.

## Decision

Itemshelf application endpoints use a major-version URL namespace:

```text
/api/v1/...
```

Django REST framework uses `NamespaceVersioning` for application endpoints. Version namespaces are explicit in URLs; there is no unversioned alias for versioned application endpoints after the v1 migration.

The contract distinguishes three HTTP surfaces:

| Surface | Namespace | Versioning | Contract owner |
|---|---|---|---|
| Itemshelf application API | `/api/v1/...` | Major URL version | This document + `backend/schema.yaml` |
| OAuth protocol endpoints | `/oauth/...` | Protocol version, not Itemshelf API major | OAuth RFCs + Itemshelf endpoint selection |
| Operational/developer endpoints | for example `/api/health` and `/api/schema/` | Unversioned | Deployment/tooling contract |

The current unversioned application paths such as `/api/auth/me` are transitional implementation state. They become `/api/v1/auth/me` when this contract is implemented.

## URL and versioning contract

### Version namespace

The first application API version is `v1`.

The implementation uses DRF `NamespaceVersioning` and a Django URL namespace named `v1`. The supported-version allow-list initially contains only `v1`.

A later breaking contract that must coexist with v1 uses a new major namespace such as `/api/v2/...`. Product release versions and API major versions are separate concerns.

### Canonical URL style

Itemshelf application API endpoints are **slashless**:

```text
/api/v1/auth/me
/api/v1/devices
/api/v1/example-resources/{id}
```

Custom OAuth endpoints are also slashless:

```text
/oauth/device-authorization
/oauth/token
```

The API must not rely on `APPEND_SLASH` redirects to make POST, PUT, PATCH, or DELETE requests work. If DRF routers are introduced, they must be configured consistently with the slashless contract.

`/api/health` remains slashless. `/api/schema/` is a developer/tooling endpoint and is not required to follow application-resource URL conventions.

### Resource naming

Versioned API paths use lowercase plural resource nouns. Nested paths are used only when the child resource is meaningfully scoped by the parent; database relationships alone are not a reason to create deeply nested URLs.

Action-style suffixes are reserved for operations that do not have a clearer resource representation.

## Authentication and authorization

Authentication mechanism and authorization are separate contracts. A valid credential never grants more authority than the owning user has through normal user/object permissions.

### Web/BFF session endpoints

The existing Web/BFF uses Django `SessionAuthentication`.

Web-only authentication, account-security, device-management, and device-authorization approval operations remain session-authenticated unless an endpoint is explicitly documented as device-capable.

For session-authenticated endpoints:

- an unauthenticated permission denial is HTTP `403 Forbidden`, matching DRF `SessionAuthentication` semantics;
- unsafe methods require a valid CSRF token and CSRF failure is HTTP `403 Forbidden`;
- OAuth scopes do not apply.

This intentionally preserves the current Web/BFF contract instead of changing existing session failures to 401 solely for stylistic uniformity.

### Device OAuth bearer endpoints

Device-capable requests use OAuth 2.0 bearer access tokens in the `Authorization` header.

For OAuth-protected resources:

- missing or invalid bearer authentication is HTTP `401 Unauthorized` and includes an RFC 6750 `WWW-Authenticate: Bearer` challenge;
- a valid token with insufficient OAuth scope is HTTP `403 Forbidden` and uses the RFC 6750 `insufficient_scope` challenge semantics;
- a valid token whose user/object permission is insufficient is HTTP `403 Forbidden`;
- bearer-authenticated requests do not use Django session CSRF protection.

### Endpoints supporting both Web/BFF and devices

A domain endpoint that supports both client classes declares both authentication mechanisms explicitly.

For those endpoints, `OAuth2Authentication` is ordered before `SessionAuthentication`. This makes the unauthenticated response a bearer-capable 401 challenge while still allowing the BFF to authenticate with its Django session. Once either credential authenticates successfully, authorization behavior is independent of the transport used.

Web-only endpoints keep `SessionAuthentication` alone and therefore retain their existing 403 unauthenticated behavior.

### Device registration exception

The initial device-registration operation is OAuth-authenticated but may be called by a token family that is not yet bound to an active Itemshelf Device.

That exception applies only to device registration. All other device-capable application operations require the active Device binding defined in `device-authentication.md`.

## OAuth scope vocabulary

Itemshelf uses a fixed server-defined scope vocabulary.

The initial scanner scopes are:

| Scope | Meaning |
|---|---|
| `device:register` | Bind a newly authorized token family to its Itemshelf Device record. |
| `catalog:read` | Search and read shared catalog metadata exposed to the scanner. |
| `shelf:read` | Read the owning user's shelf/ownership records exposed to the scanner. |
| `shelf:write` | Create, update, or remove the owning user's shelf/ownership records exposed to the scanner. |

Scope names describe product capabilities rather than database tables. `shelf:write` does not implicitly grant `shelf:read`; a client that needs both requests both.

The official scanner requests only the scopes needed for its supported functions. An unbound token family is still restricted to device registration even if its token carries other scopes.

Account security, Web login/logout, user-driven device management, Django Admin, and operator surfaces are not included in the scanner scope vocabulary.

Adding a new scope is allowed within v1. Requiring a new scope for an existing v1 operation is a breaking authorization change unless the old behavior is retained for existing clients.

## OAuth protocol surface

The initial public protocol surface is intentionally small:

```text
POST /oauth/device-authorization
POST /oauth/token
```

`/oauth/device-authorization` implements the RFC 8628 Device Authorization Request. `/oauth/token` handles both Device Code exchange and refresh-token grants as defined by the applicable OAuth specifications.

Itemshelf does not expose DOT's generic authorization-code UI, application management, dynamic client registration, implicit/password grants, OIDC endpoints, token introspection, or HTML device-confirmation views merely because the library provides them.

OAuth authorization-server discovery is **not required initially**. The official scanner is a first-party client with configured endpoint paths. If discovery is introduced later, its `.well-known` location and issuer semantics must follow the applicable RFC rather than being invented under `/api/v1`.

Lost-device revocation remains a server-side Itemshelf operation that revokes the associated token family. A public RFC 7009 revocation endpoint is not required for the initial scanner flow.

OAuth protocol error responses retain the formats defined by the OAuth specifications and are not wrapped in the Itemshelf Problem Details format.

## Application error representation

Itemshelf application API errors use **RFC 9457 Problem Details for HTTP APIs** and the media type:

```text
application/problem+json
```

The canonical common members are:

- `type`: the primary machine-readable problem identifier;
- `title`: a short problem summary;
- `status`: the HTTP status code;
- `detail`: a human-readable explanation for this occurrence;
- `instance`: optional; used only when Itemshelf has a meaningful opaque occurrence/correlation URI.

Clients must branch primarily on HTTP status and `type`. They must not parse human-readable `title` or `detail` strings.

Problem-type identifiers use resolvable HTTPS URLs. Until Itemshelf has a separate stable documentation origin, the canonical registry is this repository document:

| Problem | Type URI | Recommended status |
|---|---|---:|
| Validation error | `https://github.com/hamashou74/itemshelf/blob/master/docs/api-contract.md#validation-error` | 400 |
| CSRF failure | `https://github.com/hamashou74/itemshelf/blob/master/docs/api-contract.md#csrf-failed` | 403 |
| Permission denied | `https://github.com/hamashou74/itemshelf/blob/master/docs/api-contract.md#permission-denied` | 403 |

An ordinary HTTP error that needs no Itemshelf-specific semantics may use RFC 9457 `about:blank`.

Changing the URI that identifies an existing problem type is a breaking API change. If Itemshelf later adopts another documentation origin, existing type URIs remain valid identifiers for v1 rather than being silently rewritten.

### Validation errors

#### validation-error

Request validation failures use HTTP `400 Bad Request` and:

```json
{
  "type": "https://github.com/hamashou74/itemshelf/blob/master/docs/api-contract.md#validation-error",
  "title": "Request validation failed",
  "status": 400,
  "detail": "One or more request values are invalid.",
  "errors": [
    {
      "pointer": "#/username",
      "code": "required",
      "detail": "This field is required."
    }
  ]
}
```

`errors` is an RFC 9457 extension member. Each entry contains:

- `code`: a stable machine-readable validation code;
- `detail`: a human-readable explanation;
- `pointer` when the error can be located in a JSON request body using JSON Pointer;
- otherwise `location` plus `parameter` when the error belongs to a query, path, or header parameter.

Cross-field or request-wide validation errors may omit a locator.

Validation messages are not a stable programmatic interface; validation `code` values and the problem `type` are.

### Framework and security errors

#### csrf-failed

A Django CSRF rejection on a versioned application endpoint uses HTTP `403 Forbidden` and the `#csrf-failed` problem type above. The response does not expose the framework's internal CSRF reason.

#### permission-denied

A successfully authenticated principal that lacks application permission uses HTTP `403 Forbidden` and the `#permission-denied` problem type above unless RFC 6750 requires the `insufficient_scope` bearer challenge semantics.

Other DRF exceptions, parser/content-type errors, authentication failures, and not-found responses under the versioned application API are normalized to Problem Details unless a protocol standard requires a different representation. Generic HTTP failures may use `about:blank` when no Itemshelf-specific problem semantics are needed.

Server errors must not expose stack traces, SQL, credentials, access tokens, refresh tokens, device codes, or other internal detail.

## Pagination

List endpoints that can grow without a strict small upper bound use one standard pagination contract based on DRF `PageNumberPagination`.

Request parameters:

- `page`: 1-based page number;
- `page_size`: optional client-selected size from 1 through 100.

The default `page_size` is 50.

Response shape:

```json
{
  "count": 123,
  "next": "https://example.invalid/api/v1/resources?page=2&page_size=50",
  "previous": null,
  "results": []
}
```

`next` and `previous` are nullable URLs. Clients should treat them as opaque navigation links rather than reconstructing them from implementation assumptions.

Every paginated queryset must have deterministic ordering with a stable unique tie-breaker. The endpoint contract documents its default ordering. An endpoint may opt out of pagination only when the collection is intentionally bounded and the OpenAPI schema documents the plain-array response.

A different pagination style for an existing v1 endpoint is a breaking change.

## Resource identifiers

Itemshelf-owned public resource identifiers are UUID strings and are represented in OpenAPI with `type: string` and `format: uuid`.

Clients must treat UUIDs as opaque identifiers:

- do not infer creation order, timestamps, shard information, or record count from them;
- do not depend on one UUID generation version unless a resource contract explicitly says otherwise;
- do not expose dependency/database integer primary keys as Itemshelf public IDs.

Domain identifiers such as ISBN are attributes or lookup keys, not substitutes for an Itemshelf resource identifier.

The existing User UUID contract remains valid.

## Compatibility policy

The `/api/v1` path is the major compatibility boundary. Compatibility applies once a contract is consumed by a released first-party client; it is not deferred until the Itemshelf product reaches version 1.0.

### Normally backward-compatible within v1

Examples include:

- adding a new endpoint;
- adding an optional request field;
- adding a response field when clients are required to ignore unknown fields;
- adding an optional query parameter;
- adding a new OAuth scope without changing requirements of existing operations;
- widening accepted input without changing existing meaning.

### Breaking within v1

Examples include:

- removing or renaming an endpoint or field;
- changing a field's data type or established semantics;
- making an optional request value required;
- changing the resource-ID representation;
- changing an endpoint's pagination envelope or pagination semantics;
- changing authentication requirements or requiring additional scopes for existing behavior;
- materially changing status-code or problem-type semantics;
- narrowing previously valid input or behavior.

Adding an enum member is treated as **potentially breaking**, because generated clients may represent enums as closed sets. An enum must be explicitly designed as extensible before new values can be assumed safe within a major version.

Clients must tolerate unknown response object fields and unknown Problem Details extension members.

### Deprecation

Deprecated v1 operations or fields are marked `deprecated` in OpenAPI and documented before replacement.

Deprecation is a migration signal, not permission to remove the contract from v1. If a breaking behavior must be removed while v1 clients still exist, the replacement is introduced under a new major namespace.

No third-party support lifetime or deprecation SLA is promised by this first-party contract.

## OpenAPI contract

`backend/schema.yaml` remains the generated machine-readable contract produced from Django/DRF with drf-spectacular and consumed by Orval.

Itemshelf retains **OpenAPI 3.0.3** for v1. There is currently no required 3.1-only feature, and changing OpenAPI dialect is not needed to establish the application contract.

When the v1 implementation lands:

- `info.version` starts at `1.0.0` and tracks the API contract version, not the product release version;
- application paths are generated under `/api/v1/...`;
- `/api/health` may remain present as an explicitly unversioned operational endpoint;
- session authentication remains represented by the cookie security scheme;
- device resource access is represented by an HTTP bearer security scheme.

OpenAPI 3.0.3 has no OAuth Device Authorization Grant flow type. Itemshelf must **not** misrepresent Device Authorization Grant as `authorizationCode`, `clientCredentials`, `password`, or `implicit` merely to fit the OpenAPI OAuth-flow object.

Device resource authentication is represented as an HTTP bearer scheme, for example:

```yaml
deviceOAuthBearer:
  type: http
  scheme: bearer
  bearerFormat: OAuth 2.0
  x-itemshelf-oauth-scopes:
    - device:register
    - catalog:read
    - shelf:read
    - shelf:write
```

Device-capable operations include a corresponding `x-itemshelf-required-scopes` extension. An operation that supports both Web session and device bearer authentication declares those security requirements as alternatives.

The OAuth protocol endpoints themselves are governed by their OAuth specifications. They do not need to be modeled as a fictitious OpenAPI OAuth flow for Orval.

Schema generation and validation remain CI-enforced. A contract-changing implementation is incomplete until `backend/schema.yaml` and generated frontend clients agree with the implementation.

## Migration from the current API

There are no third-party consumers that require an unversioned compatibility alias today. Therefore the implementation should perform one coordinated migration:

1. mount application endpoints under `/api/v1`;
2. update the committed OpenAPI schema;
3. regenerate Orval clients and frontend call sites;
4. add the common error handler and pagination class;
5. preserve `/api/health` as the deployment health path;
6. remove the old unversioned application routes rather than supporting two contracts indefinitely.

OAuth/device implementation in issue #99 follows this contract when it is added.

Deployment/security work must make the supported API ingress safely reachable before a physical scanner can use the OAuth and application endpoints from outside the current Railway private network.

## Out of scope

This contract does not define:

- a third-party developer API or public client-registration program;
- CORS policy;
- TLS termination, reverse proxy selection, public ingress, or trusted-proxy settings;
- container/self-host topology;
- API rate limits or quotas, which should be added when there is an evidenced abuse/load requirement;
- a GraphQL interface;
- generic OAuth/OIDC features not required by the official scanner.

## References

- Django REST framework: [Versioning](https://www.django-rest-framework.org/api-guide/versioning/)
- Django REST framework: [Authentication](https://www.django-rest-framework.org/api-guide/authentication/)
- Django REST framework: [Exceptions](https://www.django-rest-framework.org/api-guide/exceptions/)
- Django REST framework: [Pagination](https://www.django-rest-framework.org/api-guide/pagination/)
- RFC 9457: [Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- RFC 6750: [OAuth 2.0 Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750)
- RFC 8628: [OAuth 2.0 Device Authorization Grant](https://www.rfc-editor.org/rfc/rfc8628)
- OpenAPI 3.0.3: [Security Scheme Object](https://spec.openapis.org/oas/v3.0.3#security-scheme-object)
- drf-spectacular: [Settings](https://drf-spectacular.readthedocs.io/en/latest/settings.html)
