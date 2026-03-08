# Rate limiter

Multiple rate-limiting algorithms with in-memory and Redis storage. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run rate-limiter:dev       # Port 3000
npm run rate-limiter:test
npm run rate-limiter:test:comparison
npm run rate-limiter:redis:start
npm run rate-limiter:redis:stop
```

## Algorithms

| Algorithm          | Pros                   | Cons                        |
| ------------------ | ---------------------- | --------------------------- |
| **Token bucket**   | Smooth bursts; tunable | Slightly more state         |
| **Sliding window** | Accurate over window   | More work per request       |
| **Fixed window**   | Simple, fast           | Bursts at window boundaries |

**When:** Token bucket for bursty traffic; sliding window for strict “N per
minute”; fixed window when simplicity matters. Use Redis for multi-instance or
persistent limits.

## Usage

```typescript
import { RateLimiter } from "./rate-limiter";

const limiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  strategy: "sliding-window",
  storage: "memory", // or "redis"
});

const allowed = await limiter.checkLimit("user-123");
```

## Endpoints

- `GET /health` — Health check
- `POST /api/action` — Rate-limited endpoint (headers: `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- `GET /api/stats` — Limiter statistics

## Project structure

```text
src/
├── rate-limiter.ts
├── rateLimited-implemented.ts
├── rateLimited-redis.ts
├── server.ts
├── rate-limiter.test.ts
└── comparison-tests.ts
```
