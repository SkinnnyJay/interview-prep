# Dependency injection

DI container with singleton, scoped, and transient lifetimes; Fastify
integration and request-scoped services. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run dependency-injection:dev
npm run dependency-injection:test
```

## Lifetimes

| Lifetime      | Use case                 | Pros                 | Cons             |
| ------------- | ------------------------ | -------------------- | ---------------- |
| **Singleton** | Config, logger, DB pool  | One instance         | Shared state     |
| **Scoped**    | Per-request services     | Isolated per request | Scope management |
| **Transient** | New instance per resolve | No shared state      | More allocations |

**Pros:** Testability (swap implementations), clear dependencies, request-scoped
services.  
**Cons:** Setup and conventions; overkill for very small apps.

## Features

- Constructor and factory injection; dependency graph and cycle detection;
  container stats and health.

## Endpoints

- User CRUD: `GET/POST/PATCH/DELETE /users`, `GET /users/stats`
- Container: `GET /container/stats`, `/container/dependencies`,
  `/container/services`
- Health: `GET /health`, `GET /health/services`, `GET /metrics/container`

## Project structure

```text
src/
├── di-types.ts
├── service-container.ts
├── fastify-integration.ts
├── example-services.ts
└── server.ts
```
