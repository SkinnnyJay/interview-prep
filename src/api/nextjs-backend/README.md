# Next.js backend

Next.js application with API routes, Prisma, dependency injection (Inversify), CRUD, JWT auth, and env-based configuration. Use as a reference for Next.js backend patterns and database-backed APIs.

## What’s included

- **App Router API routes** — `app/api/` routes for health and users (CRUD).
- **Prisma** — SQLite by default; schema and migrations in `prisma/`.
- **Dependency injection** — Inversify container; request-scoped and singleton services.
- **Auth** — JWT (e.g. via `Authorization: Bearer <token>`).
- **Validation** — Zod and class-validator for request bodies.

## Commands

From repo root:

- `npm run nextjs-backend:dev` — start dev server (port 3034).
- `npm run nextjs-backend:build` — Prisma generate + Next build.
- `npm run nextjs-backend:test` — run tests.

From this directory: `npm run dev`, `npm run build`, `npm run test`, etc.

## Config

Copy `env.example` to `.env.local`. Set `JWT_SECRET` for production. Optional `REDIS_URL` for Redis-backed features if added later.

## Related

- [api-scenarios](../../api-scenarios/README.md) — full Fastify API with CRUD, streaming, OpenAPI.
- [security](../../security/README.md) — auth methods and RBAC.
- [dependency-injection](../../dependency-injection/README.md) — DI patterns.
