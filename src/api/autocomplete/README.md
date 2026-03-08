# Autocomplete

Fuzzy search (e.g. Fuse.js), multi-level caching, and multiple data sources.
Optional React frontend. Part of the [API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run autocomplete:setup:frontend   # Once, if using frontend
npm run autocomplete:build           # Build backend; use build:all in-project for backend + frontend
npm run autocomplete:dev             # Backend + frontend dev servers
npm run autocomplete:test
```

**Demo in browser:** With the backend running, open `http://localhost:3006/demo/` for the interactive UI (requires frontend built via `npm run build:all` from `src/api/autocomplete`). The demo uses `GET /search` and `GET /suggestions`; other endpoints (health, analytics, items, config) can be exercised via API clients or the root docs at `http://localhost:3006/`.

## What it does

- **Search:** Fuzzy matching, configurable keys/weights, threshold,
  highlighting.
- **Cache:** LRU or Redis; TTL and size configurable.
- **Sources:** Static, file, API, or DB; configurable per environment.

**Pros:** Typo-tolerant, fast with caching, flexible sources.  
**Cons:** Tuning for large datasets; may need backend search for scale.

## Endpoints

- `GET /search?q=&limit=&category=&tags=&fuzzy=&threshold=` — Main search
- `GET /suggestions?q=&limit=` — Suggestions
- `GET /health`, `GET /analytics`
- `POST /items`, `DELETE /items`, `POST /rebuild-index`

## Config (excerpt)

Search keys/weights, threshold, cache (enabled, TTL, maxSize), index rebuild
interval. See source for full `AutocompleteConfig`.

## Project structure

```text
src/
├── autocomplete-service.ts
├── search-engine.ts
├── cache-manager.ts
├── data-source.ts
├── server.ts
└── types.ts
```
