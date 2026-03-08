# Pagination

Page-based and offset-based pagination with a Fastify REST API. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run pagination:dev    # Port 3001
npm run pagination:test
npm run pagination:build
```

## Strategies

### Page-based

- **What:** Request by `page` and `limit`; response includes `totalPages`,
  `hasNextPage`, etc.
- **Pros:** Intuitive for UIs; users think in “page 1, 2, 3.”
- **Cons:** Expensive with large offsets (OFFSET/LIMIT); result sets can shift
  during pagination.
- **When:** User-facing lists, dashboards, admin UIs.

### Offset-based

- **What:** Request by `offset` and `limit`; response includes `hasMore`.
- **Pros:** Stable performance; no total count needed; good for APIs and
  infinite scroll.
- **Cons:** No “page number” concept; less intuitive for some UIs.
- **When:** Public APIs, mobile infinite scroll, data exports, large datasets.

## Endpoints

| Endpoint                  | Method | Description             |
| ------------------------- | ------ | ----------------------- |
| `/health`                 | GET    | Health check            |
| `/employees/page-based`   | GET    | Page-based pagination   |
| `/employees/offset-based` | GET    | Offset-based pagination |
| `/employees/paginate`     | GET    | Generic (type in query) |
| `/employees/stats`        | GET    | Dataset statistics      |

Query params: `page`, `limit`, `offset`, `department` (filter). Config:
`defaultLimit`, `maxLimit`.

## Project structure

```text
src/
├── pagination-types.ts
├── pagination-methods.ts
├── pagination.ts
├── server.ts
├── pagination.test.ts
└── fake-data.json
```
