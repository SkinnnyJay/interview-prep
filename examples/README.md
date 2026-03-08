# API examples (cURL)

One-liners to hit each running service. Start a server with `npm run <name>:dev` from the repo root, then run the matching cURL from this directory (or adjust ports).

| Project | Port | Example |
|---------|------|--------|
| **rate-limiter** | 3000 | `curl -s http://localhost:3000/` |
| **security** | 3000 | `curl -s -u user:pass http://localhost:3000/protected` (Basic) |
| **pagination** | 3001 | `curl -s "http://localhost:3001/items?page=1&pageSize=5"` |
| **caching** | 3002 | `curl -s -X POST http://localhost:3002/cache/set -H "Content-Type: application/json" -d '{"key":"k1","value":"v1"}'` |
| **validation** | 3003 | `curl -s -X POST http://localhost:3003/validate -H "Content-Type: application/json" -d '{"email":"a@b.com","age":25}'` |
| **dependency-injection** | 3004 | `curl -s http://localhost:3004/` |
| **search-algorithms** | 3005 | `curl -s "http://localhost:3005/search?q=test"` |
| **autocomplete** | 3006 | `curl -s "http://localhost:3006/suggest?q=api"` |
| **api-scenarios** | 3007 | `curl -s http://localhost:3007/health` |
| **concurrency-parallel** | 3008 | `curl -s http://localhost:3008/` |
| **nextjs-backend** | 3034 | `curl -s http://localhost:3034/api/health` |

Ports and full route lists are in each project’s README and OpenAPI spec (e.g. `src/api/<name>/openapi.json` or generated via `npm run <name>:openapi`).
