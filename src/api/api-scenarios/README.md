# API scenarios

Reference API combining CRUD, filtering, sorting, pagination, streaming
(WebSocket/SSE), file upload, bulk ops, JWT, RBAC, and OpenAPI. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run api-scenarios:dev    # Port 3033
npm run api-scenarios:test
```

Docs: `http://localhost:3033/docs`

## What it demonstrates

- **CRUD:** Users with validation and query params (search, role, status, page,
  limit, sort).
- **Streaming:** WebSocket (`/api/v1/stream`) and Server-Sent Events
  (`/api/v1/events`).
- **Files:** Upload with validation, size limits, metadata.
- **Bulk:** `POST /api/v1/users/bulk` (create/update/delete).
- **Auth:** JWT, RBAC, password change, security headers.
- **Other:** Health, rate limiting, audit logging, soft deletes.

**When:** Use as a reference for “full API” design and interview-style
scenarios.

## Key endpoints

- Users: `POST/GET/PUT /api/v1/users`, `POST /api/v1/users/:id/change-password`
- Files: `POST /api/v1/files/upload`
- Bulk: `POST /api/v1/users/bulk`
- Streaming: WebSocket at `/api/v1/stream`, SSE at `/api/v1/events`

## Project structure

```text
src/
├── controllers/
├── middleware/
├── services/
├── types/
└── server.ts
```
