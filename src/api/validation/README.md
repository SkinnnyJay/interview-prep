# Validation (Zod)

Request/response validation with Zod, pipelines, and batch validation. Part of
the [API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run validation:dev
npm run validation:test
```

## Patterns

- **Request/response validation:** Body, query, params, headers via Fastify
  schema; typed handlers.
- **Validation pipelines:** Multi-step validation (schema + business rules, DB
  checks).
- **Batch validation:** Validate arrays with error aggregation and partial
  success.

**Pros:** Type-safe schemas, runtime safety, clear errors, reusable pipelines.  
**Cons:** Schema maintenance; strictness may require API versioning.

## Endpoints

- `POST /validate/user`, `/validate/product`, `/validate/order` — Test schemas
- `POST /validate/batch`, `POST /validate/pipeline` — Batch and pipeline
- `GET /validation/metrics`, `GET /validation/schemas`, `GET /health`

## Example

```typescript
app.post(
  "/users",
  {
    schema: {
      body: UserSchemas.registration,
      response: { 201: UserResponseSchema },
    },
  },
  async (request, reply) => {
    const user = await createUser(request.body);
    return reply.code(HttpStatus.CREATED).send(user); // HttpStatus from ./constants
  }
);
```

## Project structure

```text
src/
├── validation-types.ts
├── validation-engine.ts
├── validation-schemas.ts
├── fastify-integration.ts
├── server.ts
└── validation.test.ts
```
