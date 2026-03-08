<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Documentation index

Single-doc deep dives for each project and for shared algorithms: technical concept, lessons, and when to use. Linked from the [main README](../README.md#documentation).

### API projects

| Doc | Project | Detail / lessons |
|-----|---------|------------------|
| [pagination](pagination.md) | [pagination](../src/api/pagination/README.md) | Page vs offset; OFFSET cost; consistency; UI vs API. |
| [rate-limiter](rate-limiter.md) | [rate-limiter](../src/api/rate-limiter/README.md) | Token bucket, sliding/fixed window; storage; headers. |
| [caching](caching.md) | [caching](../src/api/caching/README.md) | LRU/LFU/TTL; write-through vs write-behind; multi-level; hit rate. |
| [security](security.md) | [security](../src/api/security/README.md) | Five auth methods; RBAC; HTTPS; JWT revocation; password hashing. |
| [validation](validation.md) | [validation](../src/api/validation/README.md) | Schema + pipelines + batch; boundary validation; structured errors. |
| [websocket](websocket.md) | [websocket](../src/api/websocket/README.md) | Raw WS vs Socket.IO; reconnect; rate limit; WSS. |
| [autocomplete](autocomplete.md) | [autocomplete](../src/api/autocomplete/README.md) | Fuzzy search; debounce; cache; data sources; scale. |
| [search-algorithms](search-algorithms.md) | [search-algorithms](../src/api/search-algorithms/README.md) | Exact, fuzzy, phonetic, n-gram, BM25; index; language. |
| [concurrency-parallel](concurrency-parallel.md) | [concurrency-parallel](../src/api/concurrency-parallel/README.md) | I/O vs CPU; limited concurrency; worker pool. |
| [dependency-injection](dependency-injection.md) | [dependency-injection](../src/api/dependency-injection/README.md) | Singleton/scoped/transient; testing; circular deps. |
| [api-scenarios](api-scenarios.md) | [api-scenarios](../src/api/api-scenarios/README.md) | Full API reference: CRUD, streaming, bulk, auth, OpenAPI. |

### Algorithms (src/algorithms)

| Doc | Source | Detail / lessons |
|-----|--------|------------------|
| [big-o](big-o.md) | [big-o.ts](../src/algorithms/big-o.ts) | O(1)–O(2^n) demos; benchmark harness; when to use. |
| [ranking-algorithms](ranking-algorithms.md) | [ranking-algorithms.ts](../src/algorithms/ranking-algorithms.ts) | TF-IDF, BM25, cosine; custom/phrase/field-weighted; when to use, examples. |
| [sorting-algorithms](sorting-algorithms.md) | [sorting-algorithms.ts](../src/algorithms/sorting-algorithms.ts) | Bubble, insertion, selection, merge, quick, heap; complexity; when to use. |
| [sorting-data-generator](sorting-data-generator.md) | [generate-sorting-data.js](../src/algorithms/generate-sorting-data.js) | Seeded test data for sorting correctness and perf tests. |
