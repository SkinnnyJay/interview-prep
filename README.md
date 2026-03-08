<p align="center">
  <img src="asset.png" alt="Interview Patterns Sandbox" width="640" />
</p>

<h1 align="center">Interview Patterns Sandbox</h1>

Production-oriented API patterns and algorithms—implemented, tested, and documented for learning and interview prep.

- **API systems** — Pagination, rate limiting, caching, auth, validation, WebSockets, autocomplete, search, concurrency, DI, and full API scenarios. Each lives in `src/api/<name>/` with its own README, tests, and OpenAPI.
- **Algorithms** — Big-O demos, ranking (TF-IDF, BM25, cosine), and sorting (bubble → quick sort). Shared code in `src/algorithms/`.
- **Run anything** — `npm run <name>:dev` to start a system, `npm run <name>:test` to test it; optional Redis for caching and rate-limiting.

## Table of contents

- [Why this repo exists](#why-this-repo-exists)
- [Quick start](#quick-start)
- [Documentation](#documentation) — Deep-dive docs (API projects +
  [algorithms](#algorithms-srcalgorithms))
- [Patterns and systems](#patterns-and-systems)
- [Project structure](#project-structure)
- [Commands](#commands)
- [Stack](#stack)

## Why this repo exists

About a year ago I was interviewing for a company I was really excited about.

During the interview process I was given almost no context about the technical
discussion except two words: **“rate limiting.”** That was it.

I searched everywhere—blog posts, docs, X threads, conference talks. Nothing
gave me the depth I wanted.

So I did what engineers usually do when curiosity kicks in: I started building.

For the next 48 hours I went deep. Cursor open. YouTube running. Notes
everywhere. I implemented multiple rate-limiting systems and along the way
revisited patterns I hadn’t thought about in years.

Things that frameworks often hide from us:

- [Pagination](src/api/pagination/README.md) — page vs offset, OFFSET cost,
  consistency
- [Rate limiting](src/api/rate-limiter/README.md)
- [Caching strategies](src/api/caching/README.md)
- [Concurrency & parallelism](src/api/concurrency-parallel/README.md)
- [Search techniques](src/api/search-algorithms/README.md)
- [Autocomplete](src/api/autocomplete/README.md) — fuzzy search, debounce, cache
- [Validation boundaries](src/api/validation/README.md)
- [Dependency injection](src/api/dependency-injection/README.md)
- [Authentication flows](src/api/security/README.md)
- [WebSockets](src/api/websocket/README.md) — raw WS, Socket.IO, reconnect
- [API scenarios](src/api/api-scenarios/README.md) — CRUD, streaming, bulk,
  OpenAPI

The interview eventually came. I felt prepared; I had put in the work.

The preparation turned out to be far more valuable than the outcome. I had
rediscovered a lot of foundational backend patterns that I had relied on
frameworks to abstract away.

This repo is my attempt to capture those patterns and give something back to
engineers who are preparing for interviews or trying to understand how APIs
really work under the hood.

---

## Quick start

**From Git (recommended):**

```bash
git clone https://github.com/SkinnnyJay/interview-prep.git
cd interview-prep
npm install
npm run test:all
npm run build:all
```

**From npm:**

```bash
npm install api-patterns-sandbox
cd node_modules/api-patterns-sandbox
npm install
npm run test:all
npm run build:all
```

From repo root: `npm run <name>:dev` to run a system, `npm run <name>:test` to
test it. See [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), and
[.cursorrules](.cursorrules) for standards and commands. To contribute, see
[CONTRIBUTING.md](CONTRIBUTING.md).

---

## Documentation

Single Markdown files per project and per algorithm in **[docs/](docs/)** with
technical concept, pros/cons, and lessons. Full index:
[docs/README.md](docs/README.md).

### API projects

| Doc                                                  | Project                                                        | Detail / lessons                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| [pagination](docs/pagination.md)                     | [pagination](src/api/pagination/README.md)                     | Page vs offset; OFFSET cost; consistency; UI vs API.                |
| [rate-limiter](docs/rate-limiter.md)                 | [rate-limiter](src/api/rate-limiter/README.md)                 | Token bucket, sliding/fixed window; storage; headers.               |
| [caching](docs/caching.md)                           | [caching](src/api/caching/README.md)                           | LRU/LFU/TTL; write-through vs write-behind; multi-level; hit rate.  |
| [security](docs/security.md)                         | [security](src/api/security/README.md)                         | Five auth methods; RBAC; HTTPS; JWT revocation; password hashing.   |
| [validation](docs/validation.md)                     | [validation](src/api/validation/README.md)                     | Schema + pipelines + batch; boundary validation; structured errors. |
| [websocket](docs/websocket.md)                       | [websocket](src/api/websocket/README.md)                       | Raw WS vs Socket.IO; reconnect; rate limit; WSS.                    |
| [autocomplete](docs/autocomplete.md)                 | [autocomplete](src/api/autocomplete/README.md)                 | Fuzzy search; debounce; cache; data sources; scale.                 |
| [search-algorithms](docs/search-algorithms.md)       | [search-algorithms](src/api/search-algorithms/README.md)       | Exact, fuzzy, phonetic, n-gram, BM25; index; language.              |
| [concurrency-parallel](docs/concurrency-parallel.md) | [concurrency-parallel](src/api/concurrency-parallel/README.md) | I/O vs CPU; limited concurrency; worker pool.                       |
| [dependency-injection](docs/dependency-injection.md) | [dependency-injection](src/api/dependency-injection/README.md) | Singleton/scoped/transient; testing; circular deps.                 |
| [api-scenarios](docs/api-scenarios.md)               | [api-scenarios](src/api/api-scenarios/README.md)               | Full API reference: CRUD, streaming, bulk, auth, OpenAPI.           |

### Algorithms (src/algorithms)

| Doc                                                      | Source                                                              | Detail / lessons                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [big-o](docs/big-o.md)                                   | [big-o.ts](src/algorithms/big-o.ts)                                 | O(1)–O(2^n) demos; benchmark harness; when to use.                         |
| [ranking-algorithms](docs/ranking-algorithms.md)         | [ranking-algorithms.ts](src/algorithms/ranking-algorithms.ts)       | TF-IDF, BM25, cosine; custom/phrase/field-weighted; when to use, examples. |
| [sorting-algorithms](docs/sorting-algorithms.md)         | [sorting-algorithms.ts](src/algorithms/sorting-algorithms.ts)       | Bubble, insertion, selection, merge, quick, heap; complexity; when to use. |
| [sorting-data-generator](docs/sorting-data-generator.md) | [generate-sorting-data.js](src/algorithms/generate-sorting-data.js) | Seeded test data for sorting correctness and perf tests.                   |

---

## Patterns and systems

Each section links to the project README and summarizes the pattern with pros
and cons.

### [Pagination](src/api/pagination/README.md) — Port 3001

**What:** Page-based and offset-based pagination for list APIs.

| Strategy         | Pros                             | Cons                                             |
| ---------------- | -------------------------------- | ------------------------------------------------ |
| **Page-based**   | Intuitive UX, total pages        | Costly with large offsets; unstable under writes |
| **Offset-based** | Stable performance, API-friendly | No “page N” concept; less intuitive for UIs      |

**When:** Page-based for UIs and “page 1, 2, 3”; offset-based for APIs, infinite
scroll, and large datasets.

---

### [Rate limiter](src/api/rate-limiter/README.md) — Port 3000

**What:** Multiple rate-limiting algorithms with in-memory and Redis storage.

| Strategy           | Pros                   | Cons                        |
| ------------------ | ---------------------- | --------------------------- |
| **Token bucket**   | Smooth bursts, tunable | Slightly more state         |
| **Sliding window** | Accurate over window   | More work per request       |
| **Fixed window**   | Simple, fast           | Bursts at window boundaries |

**When:** Protect APIs and enforce quotas; use Redis for multi-instance or
persistent limits.

---

### [Caching](src/api/caching/README.md)

**What:** LRU, LFU, TTL, FIFO, write-through, write-behind; in-memory and Redis.

| Strategy          | Pros                  | Cons                               |
| ----------------- | --------------------- | ---------------------------------- |
| **LRU**           | General-purpose, O(1) | Weak for strong frequency patterns |
| **LFU**           | Keeps hot data        | Slow to adapt; more bookkeeping    |
| **TTL**           | Time-based expiry     | No size cap by default             |
| **Write-through** | Strong consistency    | Higher write latency               |
| **Write-behind**  | Low write latency     | Eventual consistency; risk of loss |

**When:** LRU by default; LFU for clear hot/cold data; TTL for sessions;
write-through/write-behind for distributed persistence trade-offs.

---

### [Security](src/api/security/README.md)

**What:** Five auth methods (Basic, session token, JWT, API key,
Bearer/OAuth-style) and RBAC.

| Method           | Pros                           | Cons                                      |
| ---------------- | ------------------------------ | ----------------------------------------- |
| **Basic**        | Simple, no server state        | Credentials every request; HTTPS required |
| **Session**      | Revocable, server control      | Stateful; scaling and cleanup             |
| **JWT**          | Stateless, scales horizontally | Hard to revoke before expiry              |
| **API key**      | Good for programs/CLIs         | Long-lived; secure storage needed         |
| **Bearer/OAuth** | Short-lived tokens, refresh    | More moving parts                         |

**When:** JWT/Bearer for apps and APIs; API keys for integrations; sessions when
you need instant revocation.

---

### [Validation](src/api/validation/README.md)

**What:** Request/response validation with Zod, pipelines, and batch validation.

**Pros:** Type-safe schemas, runtime checks, clear errors, reusable pipelines.  
**Cons:** Schema maintenance; strictness can require versioning.

**When:** All public request bodies and critical responses; use pipelines for
multi-step or business-rule validation.

---

### [WebSocket](src/api/websocket/README.md)

**What:** Basic WebSocket, advanced (rate limit, history, presence), and
Socket.IO servers; React demo.

| Style         | Pros                        | Cons                      |
| ------------- | --------------------------- | ------------------------- |
| **Raw WS**    | Standard, minimal           | You build reconnect/rooms |
| **Socket.IO** | Reconnect, rooms, fallbacks | Heavier; protocol lock-in |

**When:** Real-time bidirectional flows; Socket.IO when you want built-in
resilience and features.

---

### [Autocomplete](src/api/autocomplete/README.md)

**What:** Fuzzy search (e.g. Fuse.js), multi-level cache, multiple data sources,
optional React UI.

**Pros:** Fuzzy matching, caching, configurable sources and weights.  
**Cons:** Index/cache tuning; large datasets may need backend search.

**When:** In-app search and suggestions; combine with
[search-algorithms](src/api/search-algorithms/README.md) for custom ranking.

---

### [Search algorithms](src/api/search-algorithms/README.md)

**What:** String matching (exact, prefix, fuzzy, wildcard), phonetic (Soundex,
Metaphone), n-gram, ranking (TF-IDF, BM25).

| Family           | Pros           | Cons                  |
| ---------------- | -------------- | --------------------- |
| **Exact/prefix** | Fast, simple   | No typo or similarity |
| **Fuzzy**        | Typo-tolerant  | Cost and tuning       |
| **Phonetic**     | “Sounds like”  | Language-dependent    |
| **BM25**         | Good relevance | More implementation   |

**When:** Exact/prefix for IDs and autocomplete; fuzzy for user query; phonetic
for names; BM25 for document ranking.

---

### [Concurrency & parallelism](src/api/concurrency-parallel/README.md)

**What:** Concurrency (Promise.all, p-limit, p-queue) vs parallelism (worker
threads) with examples.

| Approach        | Best for               | Notes                     |
| --------------- | ---------------------- | ------------------------- |
| **Concurrency** | I/O-bound (API, DB)    | Single thread, many tasks |
| **Parallelism** | CPU-bound (math, data) | Multi-core, workers       |

**When:** Concurrency for network/disk; parallelism for heavy computation; limit
concurrency for rate limits and connection pools.

---

### [Dependency injection](src/api/dependency-injection/README.md)

**What:** DI container with singleton/scoped/transient lifetimes and Fastify
integration.

**Pros:** Testability, clear dependencies, request-scoped services.  
**Cons:** Setup and conventions; overkill for tiny apps.

**When:** Medium+ services and APIs where you want swappable implementations and
easier testing.

---

### [API scenarios](src/api/api-scenarios/README.md)

**What:** Example API combining CRUD, filtering, sorting, pagination, streaming
(WebSocket/SSE), file upload, bulk ops, JWT, RBAC, and OpenAPI.

**When:** Reference implementation and interview-style “full API” examples.

---

## Project structure

```text
.
├── src/
│   ├── api/            # API patterns (each with README, tests, docs)
│   │   ├── pagination/
│   │   ├── rate-limiter/
│   │   ├── caching/
│   │   ├── security/
│   │   ├── validation/
│   │   ├── websocket/
│   │   ├── autocomplete/
│   │   ├── search-algorithms/
│   │   ├── concurrency-parallel/
│   │   ├── dependency-injection/
│   │   └── api-scenarios/
│   ├── algorithms/     # Shared algorithms (e.g. ranking: TF-IDF, BM25)
│   └── config/         # Shared config utilities
├── __mocks__/
├── dist/               # Build output
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Commands

| Action                        | Command                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| All tests                     | `npm run test:all`                                         |
| One project                   | `npm run <name>:test`                                      |
| Watch                         | `npm run <name>:test:watch`                                |
| Coverage                      | `npm run <name>:test:coverage`                             |
| Build                         | `npm run build:all` or `npm run <name>:build`              |
| Dev                           | `npm run <name>:dev`                                       |
| Redis (caching, rate-limiter) | `npm run <name>:redis:start` / `npm run <name>:redis:stop` |

## Stack

TypeScript (strict), Fastify, Jest, Redis / ioredis-mock, tsx for dev. Versions
in root and per-project `package.json`.

[![CI](https://github.com/SkinnnyJay/interview-prep/actions/workflows/ci.yml/badge.svg)](https://github.com/SkinnnyJay/interview-prep/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node 18+](https://img.shields.io/badge/node-18%2B-brightgreen)](https://nodejs.org)
