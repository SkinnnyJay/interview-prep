<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Security (auth & RBAC) — Technical concept & lessons

**Project:** [security](../src/api/security/README.md)

## What it solves

Identifying who is calling the API (authentication) and what they are allowed to do (authorization), with multiple auth styles and role-based access control.

## Concepts

- **Basic:** `Authorization: Basic base64(user:password)`. No server state; credentials every request.
- **Session token:** Server issues a token after login; stores session server-side. Revocable; stateful.
- **JWT:** Signed token carrying claims (e.g. user id, role). Stateless; cannot revoke before expiry without extra machinery.
- **API key:** Long-lived secret per client. Good for scripts and integrations.
- **Bearer (OAuth-style):** Short-lived access token + refresh token. Industry standard for apps.

- **RBAC:** Roles (e.g. Admin, User, Guest) with permissions; middleware checks role/permission for each route and resource.

## Lessons

1. **HTTPS everywhere** — Basic and API keys send secrets; sessions and tokens can be hijacked. Never send auth over plain HTTP in production.
2. **JWT revocation** — JWTs are valid until expiry. To revoke: short expiry + refresh token, or a blocklist/version in a store.
3. **Scope permissions** — Prefer “can do X on resource type Y” over “is admin.” Check ownership for user-specific resources (e.g. “edit own profile”).
4. **Hash passwords** — Use bcrypt (or similar) with a cost factor; never store or log plain passwords.

## Pros & cons

| Method     | Pros                         | Cons                              |
|------------|------------------------------|-----------------------------------|
| Basic      | Simple; no server state      | Credentials every request; HTTPS required |
| Session    | Revocable; server control     | Stateful; scaling/cleanup         |
| JWT        | Stateless; scales             | Hard to revoke before expiry      |
| API key    | Good for programs/CLIs       | Long-lived; secure storage        |
| Bearer     | Short-lived + refresh         | More moving parts                 |

## When to use

- **JWT/Bearer:** User-facing apps and APIs; microservices.
- **API keys:** Developer APIs, webhooks, third-party integrations.
- **Sessions:** When you need instant revocation (e.g. “log out everywhere”).

## See also

- Project README: [src/api/security/README.md](../src/api/security/README.md)
- Validation and rate-limiting projects for defense in depth.
