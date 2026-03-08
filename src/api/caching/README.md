# Caching

Multiple cache strategies: LRU, LFU, TTL, FIFO (in-memory and Redis), plus
write-through and write-behind. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run caching:dev
npm run caching:test
npm run caching:redis:start
npm run caching:redis:stop
```

## Strategies

| Strategy          | Pros                  | Cons                               |
| ----------------- | --------------------- | ---------------------------------- |
| **LRU**           | General-purpose; O(1) | Not ideal for pure frequency       |
| **LFU**           | Keeps hot data        | Slow to adapt; more bookkeeping    |
| **TTL**           | Time-based expiry     | No automatic size limit            |
| **FIFO**          | Simple, predictable   | Ignores access patterns            |
| **Write-through** | Strong consistency    | Higher write latency               |
| **Write-behind**  | Low write latency     | Eventual consistency; risk of loss |

**When:** LRU by default; LFU for clear hot/cold data; TTL for sessions; Redis
variants for distributed systems; write-through when consistency matters;
write-behind for write-heavy, eventually consistent workloads.

## Multi-level (L1 + L2)

L1 in-memory + L2 Redis: fast local hits, larger capacity, persistence.
Configurable promote-on-hit and write-through.

## Endpoints

- `GET/POST/DELETE /cache/:key` — Get, set, delete
- `POST /cache/clear` — Clear all
- `GET /cache/stats`, `GET /cache/health`
- `GET/POST /multi-cache/:key` — Multi-level cache

## Project structure

```text
src/
├── cache-types.ts
├── cache-memory.ts
├── cache-redis.ts
├── cache-manager.ts
├── server.ts
└── performance-tests.ts
```
