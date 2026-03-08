<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Autocomplete — Technical concept & lessons

**Project:** [autocomplete](../src/api/autocomplete/README.md)

## What it solves

Suggesting completions or matches as the user types: fuzzy matching, fast response, and scalable data sources (static, file, API, DB).

## Concepts

- **Fuzzy search:** Matches despite typos and partial input (e.g. Fuse.js). Configurable keys, weights, and threshold.
- **Caching:** Cache recent queries (LRU or Redis) to keep latency low under load.
- **Data sources:** Plug in static lists, file-based data, or live API/DB; rebuild or refresh index as needed.

## Lessons

1. **Debounce input** — Don’t hit the backend on every keystroke. Debounce (e.g. 200–300 ms) to reduce load and flicker.
2. **Limit results** — Return a small top-N (e.g. 10). Ranking and weights matter more than returning hundreds of items.
3. **Cache hot queries** — Many users type similar things. Cache by normalized query; tune TTL and size.
4. **Scale** — In-memory search (e.g. Fuse) is fine up to tens of thousands of items; for much larger data, use a search engine or backend index.

## Pros & cons

- **Pros:** Fuzzy matching, configurable ranking, caching, multiple sources.
- **Cons:** Tuning threshold and keys; large datasets may need dedicated search.

## When to use

- In-app search and suggestion UIs; command palettes; product or content search with typo tolerance.
- Combine with [search-algorithms](search-algorithms.md) for custom ranking (e.g. BM25).

## See also

- Project README: [src/api/autocomplete/README.md](../src/api/autocomplete/README.md)
- [docs/search-algorithms.md](search-algorithms.md) for algorithm details.
