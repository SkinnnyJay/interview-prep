<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Concurrency & parallelism — Technical concept & lessons

**Project:** [concurrency-parallel](../src/api/concurrency-parallel/README.md)

## What it solves

Doing more work without blocking: concurrency (many tasks in progress, often I/O) vs parallelism (multiple cores doing CPU work at once).

## Concepts

- **Concurrency:** Single thread; async/await, Promise.all, queues. Tasks interleave; waiting on I/O doesn’t block others.
- **Parallelism:** Worker threads or processes; true simultaneous execution. For CPU-bound work (math, image processing).
- **Limited concurrency:** Cap how many tasks run at once (e.g. p-limit, p-queue). Protects DB connections and rate limits.
- **Priority queue:** Run high-priority tasks before low-priority; good for mixed workloads.

## Lessons

1. **I/O vs CPU** — Concurrency helps when waiting on network/disk; parallelism helps when CPU is the bottleneck. Don’t add workers for I/O-bound work.
2. **Limit concurrency** — Unbounded Promise.all can exhaust connections or hit rate limits. Use a pool or queue with a max concurrency.
3. **Worker cost** — Spawning workers has overhead. Use a small pool and reuse; avoid one worker per task for many small tasks.
4. **Node event loop** — Node is single-threaded for JS. Concurrency is natural; parallelism requires worker_threads or child_process.

## Pros & cons

| Approach     | Best for           | Pros                | Cons              |
|-------------|--------------------|---------------------|-------------------|
| Concurrency | I/O (API, DB)      | Simple; one thread  | No CPU speedup    |
| Parallelism | CPU (math, data)    | Multi-core speedup  | Overhead; sharing |

## When to use

- **Concurrency:** Multiple API calls, DB queries, file I/O; any “waiting” work.
- **Limited concurrency:** Rate-limited or connection-pool-limited resources.
- **Parallelism:** Heavy computation (crypto, image, large data transforms).

## See also

- Project README: [src/api/concurrency-parallel/README.md](../src/api/concurrency-parallel/README.md)
