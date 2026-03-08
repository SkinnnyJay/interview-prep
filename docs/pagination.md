<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Pagination — Technical concept & lessons

**Project:** [pagination](../src/api/pagination/README.md) (Port 3001)

## What it solves

Listing large datasets without loading everything at once: control payload size, latency, and UX (page numbers vs infinite scroll).

## Concepts

- **Page-based:** `page` + `limit`; response includes `totalPages`, `hasNextPage`. Uses OFFSET/LIMIT (or equivalent).
- **Offset-based:** `offset` + `limit`; response includes `hasMore`. Same SQL pattern but no total count.

## Lessons

1. **OFFSET is expensive at scale** — Deep pages (e.g. `OFFSET 100000`) force the DB to scan and skip rows. Prefer cursor/keyset pagination for very large APIs.
2. **Total count is costly** — `COUNT(*)` on big tables is slow. Omit or approximate when you don’t need exact “page N of M.”
3. **Consistency** — Results can change between requests (inserts/deletes). Offset-based doesn’t promise “same item at same offset”; page-based can show duplicates or gaps.
4. **UI vs API** — Page-based fits “Previous/Next” and “Page 1, 2, 3”; offset-based fits infinite scroll and programmatic consumption.

## Pros & cons

| Strategy       | Pros                          | Cons                                |
|----------------|-------------------------------|-------------------------------------|
| Page-based     | Intuitive UX, total pages     | Costly with large offsets; unstable under writes |
| Offset-based   | Stable performance, API-friendly | No “page N”; less intuitive for UIs |

## When to use

- **Page-based:** Dashboards, admin UIs, “page 1, 2, 3” navigation.
- **Offset-based:** Public APIs, mobile infinite scroll, data exports, large datasets.

## See also

- Project README: [src/api/pagination/README.md](../src/api/pagination/README.md)
- Cursor/keyset pagination (not in this repo): use `WHERE id > last_seen_id ORDER BY id LIMIT n` for stable, efficient paging.
