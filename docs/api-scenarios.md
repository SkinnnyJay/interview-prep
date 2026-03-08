<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# API scenarios — Technical concept & lessons

**Project:** [api-scenarios](../src/api/api-scenarios/README.md)

## What it solves

A single reference API that ties together many patterns: CRUD, filtering/sorting/pagination, streaming (WebSocket + SSE), file upload, bulk ops, auth (JWT), RBAC, and OpenAPI docs. Good for interviews and “full stack” examples.

## Concepts

- **CRUD + querying:** REST resources with filter, sort, page, limit, search params.
- **Streaming:** WebSocket for bidirectional; SSE for server→client only.
- **Files:** Multipart upload, validation, size limits, metadata.
- **Bulk:** One request with an operation type and array of items; partial success handling.
- **Auth & RBAC:** JWT (or similar), roles, and permission checks on routes and resources.

## Lessons

1. **Compose patterns** — Real APIs combine pagination, validation, auth, and rate limiting. This project shows how they fit together.
2. **OpenAPI** — Generate docs from code (or vice versa). Helps frontend and clients; use for contract tests.
3. **Bulk semantics** — Define whether bulk ops are all-or-nothing or partial success; return per-item results and errors.
4. **Streaming vs REST** — Use REST for request/response; add WebSocket or SSE when you need push or real-time updates.

## What / lessons

| Area        | What this project shows                    | Lesson / takeaway                          |
|-------------|--------------------------------------------|--------------------------------------------|
| CRUD        | Full create/read/update/delete with validation | Validate at boundary; return 201 + Location |
| Querying    | Filter, sort, pagination, search            | Consistent query params; document limits   |
| Streaming   | WebSocket + SSE endpoints                  | Pick by direction (bidir vs server→client) |
| Files       | Upload, validation, size limit             | Validate type and size; never trust client |
| Bulk        | Batch create/update/delete                 | Define partial vs atomic; return details   |
| Auth/RBAC   | JWT + roles on routes                      | Check permission per route and resource    |

## When to use

- As a reference when designing or explaining a “full” API.
- Interview prep: “How would you design an API that does X, Y, Z?”

## See also

- Project README: [src/api/api-scenarios/README.md](../src/api/api-scenarios/README.md)
- Individual pattern docs in [docs/](.) for deep dives.
