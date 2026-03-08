<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Caching — Technical concept & lessons

**Project:** [caching](../src/api/caching/README.md)

## What it solves

Reducing latency and load by storing frequently used data in fast storage (memory or Redis) and choosing what to evict when full or stale.

## Concepts

- **LRU (Least Recently Used):** Evict the item not accessed longest. O(1) get/set with a map + list (or equivalent).
- **LFU (Least Frequently Used):** Evict the item with lowest access count. Better for stable “hot” data; slower to adapt.
- **TTL (Time to live):** Items expire after a fixed duration. No eviction by size unless combined with another policy.
- **Write-through:** Write to cache and backing store together. Strong consistency; higher write latency.
- **Write-behind:** Write to cache first, then async to backing store. Lower latency; eventual consistency and risk of loss on crash.

## Lessons

1. **LRU is the default** — Fits most access patterns (temporal locality). Use LFU only when you have clear hot/cold data.
2. **Multi-level (L1 + L2)** — Small fast L1 (memory) + larger L2 (Redis) gives speed and capacity; promote on L1 hit if desired.
3. **Consistency vs performance** — Write-through for “read your writes”; write-behind for throughput when eventual consistency is acceptable.
4. **Monitor hit rate** — Low hit rate means wrong keys, too small cache, or TTL too short. Aim for high hit rate on hot paths.

## Pros & cons

| Strategy       | Pros                     | Cons                          |
|----------------|--------------------------|-------------------------------|
| LRU            | General-purpose, O(1)     | Weak for pure frequency       |
| LFU            | Keeps hot data            | Slow to adapt; bookkeeping    |
| TTL            | Time-based expiry         | No size cap by default        |
| Write-through  | Strong consistency        | Higher write latency          |
| Write-behind   | Low write latency         | Eventual consistency; risk    |

## When to use

- **LRU:** Default for general caching.
- **LFU:** Clear 80/20 or hot/cold workload.
- **TTL:** Sessions, time-sensitive data.
- **Redis:** Distributed or persistent cache across instances.

## See also

- Project README: [src/api/caching/README.md](../src/api/caching/README.md)
- Performance tests in project for rough latency numbers.
