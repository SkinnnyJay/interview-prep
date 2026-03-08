# Security (auth & RBAC)

Five authentication methods and role-based access control. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run security:dev
npm run security:test
```

Default server: `http://localhost:3000`. Demo users: `admin/admin123`,
`user/user123`, `guest/guest123`.

## Authentication methods

| Method                   | Pros                           | Cons                                      |
| ------------------------ | ------------------------------ | ----------------------------------------- |
| **Basic**                | Simple; no server state        | Credentials every request; HTTPS required |
| **Session token**        | Revocable; server control      | Stateful; scaling and cleanup             |
| **JWT**                  | Stateless; scales horizontally | Cannot revoke before expiry               |
| **API key**              | Good for programs/CLIs         | Long-lived; secure storage                |
| **Bearer (OAuth-style)** | Short-lived + refresh          | More complex flow                         |

**When:** JWT/Bearer for apps and APIs; API keys for integrations; sessions when
you need instant revocation.

## Authorization

Roles: **ADMIN** (full) → **USER** (read/write own) → **GUEST** (read-only).
Permissions: user management, content CRUD, admin, API read/write. Resource
ownership enforced for sensitive ops.

## Key endpoints

- **Public:** `POST /auth/register`, `POST /auth/login`, `POST /oauth/token`,
  `GET /api/public`
- **Protected:** `GET/PUT /auth/profile`, `POST/GET/DELETE /auth/api-keys`,
  content CRUD
- **Admin:** `GET /admin/users`, `GET /admin/sessions`,
  `POST /admin/sessions/cleanup`, roles

See project for full list and curl examples.

## Project structure

```text
src/
├── auth-methods.ts
├── auth-types.ts
├── rbac.ts
├── server.ts
└── test-data.json
```
