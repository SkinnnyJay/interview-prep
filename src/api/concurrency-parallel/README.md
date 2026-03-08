# Concurrency & parallelism

Concurrency (async, Promise.all, limited concurrency, priority queue) vs
parallelism (worker threads) with runnable examples. Part of the
[API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run concurrency-parallel:dev
npm run concurrency-parallel:test
```

## Concepts

| Approach        | Best for               | Pros                      | Cons              |
| --------------- | ---------------------- | ------------------------- | ----------------- |
| **Concurrency** | I/O (API, DB, files)   | Single thread; many tasks | Not for CPU-bound |
| **Parallelism** | CPU (math, processing) | Multi-core speedup        | Workers, overhead |

**When:** Concurrency for network/disk; parallelism for heavy computation;
limited concurrency for rate limits and connection pools; priority queue when
tasks have different importance.

## Endpoints

- **Concurrency:** `POST /concurrent/all`, `/concurrent/limited`,
  `/concurrent/priority`, `/concurrent/sequential`, `/concurrent/batched`
- **Parallel:** `POST /parallel/compute`, `/parallel/batch`
- **Examples:** `GET /examples/api-calls`, `/examples/math-computations`, etc.
- `GET /performance/compare`, `GET /health`

## Project structure

```text
src/
├── concurrency-manager.ts
├── parallel-manager.ts
├── worker.ts
├── server.ts
├── examples.ts
└── concurrency-types.ts
```
