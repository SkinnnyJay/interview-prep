# Interview talking points

Short answers and pointers for common “design a system” or “how would you…” questions. Use with the linked project docs for depth.

---

## Pagination

**When page-based vs offset-based?**  
Page-based for UIs (“page 1, 2, 3”) and when you need total pages; offset-based for APIs, infinite scroll, and large datasets. Offset has stable cost; large OFFSET can be slow.  
→ [pagination](pagination.md) | [project](../src/api/pagination/README.md)

---

## Rate limiting

**Token bucket vs sliding window vs fixed window?**  
Token bucket: smooth bursts, tunable. Sliding window: accurate over the window, more work per request. Fixed window: simple and fast, but bursts at boundaries.  
**When Redis?** Multi-instance or persistent limits.  
→ [rate-limiter](rate-limiter.md) | [project](../src/api/rate-limiter/README.md)

---

## Caching

**LRU vs LFU vs TTL?**  
LRU: general-purpose, O(1), evicts least recently used. LFU: keeps hot data, more bookkeeping. TTL: time-based expiry, no size cap by default.  
**Write-through vs write-behind?** Write-through: strong consistency, higher write latency. Write-behind: lower latency, eventual consistency, risk of loss on crash.  
→ [caching](caching.md) | [project](../src/api/caching/README.md)

---

## Auth

**JWT vs session vs API key?**  
JWT: stateless, scales horizontally; hard to revoke before expiry. Session: revocable, server control; stateful. API key: good for programs/CLIs; long-lived, secure storage needed.  
→ [security](security.md) | [project](../src/api/security/README.md)

---

## Validation

**Where to validate?** At the boundary (API layer). Schema + pipelines for multi-step or business rules. Type-safe schemas (e.g. Zod) and structured errors.  
→ [validation](validation.md) | [project](../src/api/validation/README.md)

---

## WebSockets

**Raw WebSocket vs Socket.IO?**  
Raw: standard, minimal; you build reconnect/rooms. Socket.IO: built-in reconnect, rooms, fallbacks; heavier, protocol lock-in.  
→ [websocket](websocket.md) | [project](../src/api/websocket/README.md)

---

## Search / autocomplete

**Exact vs fuzzy vs phonetic vs BM25?**  
Exact/prefix: fast, simple. Fuzzy: typo-tolerant, more cost. Phonetic: “sounds like,” language-dependent. BM25: good relevance for document ranking.  
→ [search-algorithms](search-algorithms.md) | [autocomplete](autocomplete.md)

---

## Concurrency vs parallelism

**When each?** Concurrency for I/O-bound (APIs, DB); single thread, many tasks. Parallelism for CPU-bound (math, data); multi-core, workers. Limit concurrency for rate limits and connection pools.  
→ [concurrency-parallel](concurrency-parallel.md) | [project](../src/api/concurrency-parallel/README.md)

---

## Dependency injection

**When useful?** Medium+ services and APIs: swappable implementations, easier testing, request-scoped services. Overkill for tiny apps.  
→ [dependency-injection](dependency-injection.md) | [project](../src/api/dependency-injection/README.md)
