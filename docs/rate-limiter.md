<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Rate limiter — Technical concept & lessons

**Project:** [rate-limiter](../src/api/rate-limiter/README.md) (Port 3000)

## What it solves

Protecting APIs from abuse and overload: cap how many requests a client can make per time window (per key, IP, or user).

## Concepts

- **Token bucket:** Refill tokens at a rate; each request consumes one. Allows short bursts up to bucket size.
- **Sliding window:** Count requests in a rolling window (e.g. last 60 seconds). More accurate than fixed window.
- **Fixed window:** Count requests per calendar window (e.g. minute). Simple but allows 2× burst at boundaries.

## Lessons

1. **Window boundary burst** — Fixed window can double capacity at the seam (e.g. 100 at 0:59 and 100 at 1:00). Sliding window or token bucket avoids this.
2. **Storage matters** — In-memory is fast but doesn’t survive restarts or share across instances. Use Redis (or similar) for multi-node and persistence.
3. **Key choice** — Limit by API key, user id, or IP depending on abuse model. Avoid limiting by anonymous IP only if you have auth.
4. **Headers** — Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` so clients can back off or throttle.

## Pros & cons

| Algorithm        | Pros                    | Cons                          |
|------------------|-------------------------|-------------------------------|
| Token bucket     | Smooth bursts; tunable   | Slightly more state           |
| Sliding window   | Accurate over window     | More work per request         |
| Fixed window     | Simple, fast            | Bursts at window boundaries   |

## When to use

- **Token bucket:** Bursty but bounded traffic; need smooth allowance.
- **Sliding window:** Strict “N requests per minute” semantics.
- **Fixed window:** Simplicity; non-critical or high-window limits.
- **Redis:** Multiple instances or persistent limits.

## See also

- Project README: [src/api/rate-limiter/README.md](../src/api/rate-limiter/README.md)
- Comparison tests in project: `npm run rate-limiter:test:comparison`
