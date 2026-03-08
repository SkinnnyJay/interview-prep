// cache-memory.ts - In-memory cache implementations
// Provides multiple caching strategies without external dependencies

import {
  CacheStrategy,
  CacheOptions,
  CacheResult,
  CacheEntry,
  CacheStats,
  CacheMetadata,
} from "./cache-types";

/**
 * Base class for in-memory cache implementations
 * Provides common functionality and statistics tracking
 */
abstract class BaseMemoryCache<T = unknown> {
  protected cache = new Map<string, CacheEntry<T>>();
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    maxSize: 0,
    evictions: 0,
    memoryUsage: 0,
  };

  constructor(protected maxSize: number = 1000) {
    this.stats.maxSize = maxSize;
  }

  /**
   * Abstract method for eviction policy
   * Each strategy implements its own eviction logic
   */
  protected abstract evict(): void;

  /**
   * Abstract method for updating access patterns
   * Each strategy tracks access differently
   */
  protected abstract onAccess(entry: CacheEntry<T>): void;

  /**
   * Get value from cache
   * Updates access patterns and statistics
   */
  async get(key: string, nowMs: number = Date.now()): Promise<CacheResult<T>> {
    const entry = this.cache.get(key);

    // Cache miss
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return { hit: false, value: null };
    }

    // Check if expired
    if (entry.expiresAt && nowMs > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      this.updateHitRate();
      return { hit: false, value: null };
    }

    // Cache hit - update access patterns
    entry.lastAccessed = nowMs;
    entry.accessCount++;
    this.onAccess(entry);

    this.stats.hits++;
    this.updateHitRate();

    const metadata: CacheMetadata = {
      hitCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      createdAt: entry.createdAt,
      size: entry.size,
    };

    if (entry.expiresAt) {
      metadata.ttl = Math.max(0, entry.expiresAt - nowMs);
    }

    return {
      hit: true,
      value: entry.value,
      ttl: entry.expiresAt ? Math.max(0, entry.expiresAt - nowMs) : undefined,
      metadata,
    };
  }

  /**
   * Set value in cache
   * Handles eviction when cache is full
   */
  async set(key: string, value: T, ttl?: number, nowMs: number = Date.now()): Promise<void> {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.stats.size--;
    }

    // Evict if at capacity
    while (this.cache.size >= this.maxSize && this.cache.size > 0) {
      this.evict();
    }

    // Calculate expiration
    const expiresAt = ttl ? nowMs + ttl : undefined;

    // Estimate size (rough approximation)
    const size = this.estimateSize(value);

    // Create cache entry
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: nowMs,
      lastAccessed: nowMs,
      accessCount: 0,
      ttl,
      expiresAt,
      size,
    };

    this.cache.set(key, entry);
    this.stats.size++;
    this.stats.memoryUsage = (this.stats.memoryUsage ?? 0) + (size || 0);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.size--;
      this.stats.memoryUsage = Math.max(0, (this.stats.memoryUsage ?? 0) - (entry.size || 0));
      return true;
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.memoryUsage = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clean up expired entries
   */
  cleanup(nowMs: number = Date.now()): number {
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && nowMs > entry.expiresAt) {
        this.cache.delete(key);
        this.stats.size--;
        this.stats.memoryUsage = Math.max(0, (this.stats.memoryUsage ?? 0) - (entry.size || 0));
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Update hit rate percentage
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Rough size estimation for memory tracking
   */
  private estimateSize(value: unknown): number {
    if (typeof value === "string") return value.length * 2; // UTF-16
    if (typeof value === "number") return 8;
    if (typeof value === "boolean") return 4;
    if (value === null || value === undefined) return 0;

    // For objects, rough JSON size estimation
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 100; // Default estimate
    }
  }
}

/**
 * LRU (Least Recently Used) Cache Implementation
 * Evicts the least recently accessed items when full
 *
 * Best for: General purpose caching, temporal locality patterns
 * Time Complexity: O(1) for get/set operations
 */
export class LRUMemoryCache<T = unknown> extends BaseMemoryCache<T> {
  private accessOrder = new Map<string, number>(); // key -> access timestamp

  protected onAccess(entry: CacheEntry<T>): void {
    // Move key to the end to represent most-recently used
    if (this.accessOrder.has(entry.key)) {
      this.accessOrder.delete(entry.key);
    }
    this.accessOrder.set(entry.key, entry.lastAccessed);
  }

  async set(key: string, value: T, ttl?: number, nowMs: number = Date.now()): Promise<void> {
    // Remove from access order if already exists
    if (this.cache.has(key)) {
      this.accessOrder.delete(key);
    }

    await super.set(key, value, ttl, nowMs);

    // Add to access order with current timestamp
    this.accessOrder.set(key, nowMs);
  }

  async delete(key: string): Promise<boolean> {
    const result = await super.delete(key);
    if (result) {
      this.accessOrder.delete(key);
    }
    return result;
  }

  async clear(): Promise<void> {
    await super.clear();
    this.accessOrder.clear();
  }

  protected evict(): void {
    if (this.cache.size === 0) return;

    // Evict least-recently used: first key in accessOrder
    let oldestKey = this.accessOrder.keys().next().value as string | undefined;

    // Skip any stale keys that might remain in accessOrder
    while (oldestKey && !this.cache.has(oldestKey)) {
      this.accessOrder.delete(oldestKey);
      oldestKey = this.accessOrder.keys().next().value as string | undefined;
    }

    if (!oldestKey) return;

    const entry = this.cache.get(oldestKey);
    if (entry) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.stats.size--;
      this.stats.evictions++;
      this.stats.memoryUsage = Math.max(0, (this.stats.memoryUsage ?? 0) - (entry.size || 0));
    }
  }
}

/**
 * LFU (Least Frequently Used) Cache Implementation
 * Evicts the least frequently accessed items when full
 *
 * Best for: Workloads with clear hot/cold data patterns
 * Time Complexity: O(1) for get/set operations
 */
export class LFUMemoryCache<T = unknown> extends BaseMemoryCache<T> {
  protected onAccess(_entry: CacheEntry<T>): void {
    // Access count is already updated in base class
    // LFU uses accessCount for eviction decisions
  }

  protected evict(): void {
    if (this.cache.size === 0) return;

    // Find least frequently used item
    let leastUsedKey = "";
    let leastUsedCount = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // If access counts are equal, use LRU as tiebreaker
      if (
        entry.accessCount < leastUsedCount ||
        (entry.accessCount === leastUsedCount && entry.lastAccessed < oldestTime)
      ) {
        leastUsedCount = entry.accessCount;
        oldestTime = entry.lastAccessed;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      const entry = this.cache.get(leastUsedKey);
      if (entry) {
        this.cache.delete(leastUsedKey);
        this.stats.size--;
        this.stats.evictions++;
        this.stats.memoryUsage = Math.max(0, (this.stats.memoryUsage ?? 0) - (entry.size || 0));
      }
    }
  }
}

/**
 * TTL (Time To Live) Cache Implementation
 * Items expire after a set time, no size-based eviction
 *
 * Best for: Time-sensitive data, session storage
 * Time Complexity: O(1) for get/set operations
 */
export class TTLMemoryCache<T = unknown> extends BaseMemoryCache<T> {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(maxSize: number = 1000, cleanupInterval: number = 60000) {
    super(maxSize);

    // Periodic cleanup of expired items
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, cleanupInterval);
  }

  protected onAccess(_entry: CacheEntry<T>): void {
    // TTL doesn't change access patterns, just tracks for stats
  }

  protected evict(): void {
    // TTL cache doesn't evict based on size, only on expiration
    // First try cleaning up expired items
    const cleaned = this.cleanup();

    // If still at capacity, evict oldest items
    if (this.cache.size >= this.maxSize && cleaned === 0) {
      let oldestKey = "";
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.createdAt < oldestTime) {
          oldestTime = entry.createdAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const entry = this.cache.get(oldestKey);
        if (entry) {
          this.cache.delete(oldestKey);
          this.stats.size--;
          this.stats.evictions++;
          this.stats.memoryUsage = Math.max(0, (this.stats.memoryUsage ?? 0) - (entry.size || 0));
        }
      }
    }
  }

  /**
   * Cleanup timer when cache is destroyed
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

/**
 * FIFO (First In First Out) Cache Implementation
 * Evicts the oldest items when full (insertion order)
 *
 * Best for: Simple caching needs, predictable eviction
 * Time Complexity: O(1) for get/set operations
 */
export class FIFOMemoryCache<T = unknown> extends BaseMemoryCache<T> {
  private insertionOrder: string[] = []; // Track insertion order

  protected onAccess(_entry: CacheEntry<T>): void {
    // FIFO doesn't change eviction order based on access
  }

  protected evict(): void {
    if (this.insertionOrder.length === 0) return;

    // Remove oldest item (first in)
    const oldestKey = this.insertionOrder.shift();
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.cache.delete(oldestKey);
        this.stats.size--;
        this.stats.evictions++;
        this.stats.memoryUsage = Math.max(0, (this.stats.memoryUsage ?? 0) - (entry.size || 0));
      }
    }
  }

  async set(key: string, value: T, ttl?: number, nowMs: number = Date.now()): Promise<void> {
    // Remove from insertion order if already exists
    if (this.cache.has(key)) {
      const index = this.insertionOrder.indexOf(key);
      if (index > -1) {
        this.insertionOrder.splice(index, 1);
      }
    }

    await super.set(key, value, ttl, nowMs);

    // Add to end of insertion order
    this.insertionOrder.push(key);
  }

  async delete(key: string): Promise<boolean> {
    const result = await super.delete(key);
    if (result) {
      const index = this.insertionOrder.indexOf(key);
      if (index > -1) {
        this.insertionOrder.splice(index, 1);
      }
    }
    return result;
  }

  async clear(): Promise<void> {
    await super.clear();
    this.insertionOrder = [];
  }
}

/**
 * Memory cache factory function
 * Creates appropriate cache instance based on strategy
 */
export function createMemoryCache<T = unknown>(
  strategy: CacheStrategy,
  maxSize: number = 1000,
  cleanupInterval?: number
): BaseMemoryCache<T> {
  switch (strategy) {
    case CacheStrategy.LRU_MEMORY:
      return new LRUMemoryCache<T>(maxSize);
    case CacheStrategy.LFU_MEMORY:
      return new LFUMemoryCache<T>(maxSize);
    case CacheStrategy.TTL_MEMORY:
      return new TTLMemoryCache<T>(maxSize, cleanupInterval);
    case CacheStrategy.FIFO_MEMORY:
      return new FIFOMemoryCache<T>(maxSize);
    default:
      throw new Error(`Unsupported memory cache strategy: ${strategy}`);
  }
}

/**
 * Global memory cache storage for different strategies
 * Allows multiple cache instances with different configurations
 */
class MemoryCacheStorage {
  private caches = new Map<string, BaseMemoryCache<unknown>>();

  getCache(strategy: CacheStrategy, maxSize: number = 1000): BaseMemoryCache<unknown> {
    const key = `${strategy}-${maxSize}`;

    if (!this.caches.has(key)) {
      this.caches.set(key, createMemoryCache(strategy, maxSize));
    }

    return this.caches.get(key)!;
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
    this.caches.clear();
  }
}

// Global storage instance
export const memoryCacheStorage = new MemoryCacheStorage();

/**
 * Unified memory cache interface functions
 * Provides consistent API across all memory cache strategies
 */
export async function getFromMemoryCache<T = unknown>({
  key,
  strategy,
  maxSize,
  nowMs,
}: CacheOptions): Promise<CacheResult<T>> {
  const cache = memoryCacheStorage.getCache(strategy, maxSize);
  return cache.get(key, nowMs) as Promise<CacheResult<T>>;
}

export async function setInMemoryCache<T = unknown>(
  { key, strategy, maxSize, ttl, nowMs }: CacheOptions,
  value: T
): Promise<void> {
  const cache = memoryCacheStorage.getCache(strategy, maxSize);
  return cache.set(key, value, ttl, nowMs);
}

export async function deleteFromMemoryCache({
  key,
  strategy,
  maxSize,
}: CacheOptions): Promise<boolean> {
  const cache = memoryCacheStorage.getCache(strategy, maxSize);
  return cache.delete(key);
}

export async function getMemoryCacheStats(
  strategy: CacheStrategy,
  maxSize: number = 1000
): Promise<CacheStats> {
  const cache = memoryCacheStorage.getCache(strategy, maxSize);
  return cache.getStats();
}

export function clearMemoryCacheStorage(): void {
  memoryCacheStorage.clearAll();
}
