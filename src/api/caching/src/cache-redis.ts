// cache-redis.ts - Redis-based cache implementations
// Provides distributed caching with persistence and advanced patterns

import {
  CacheStrategy,
  CacheOptions,
  CacheResult,
  CacheStats,
  CacheRedisClient,
  CacheMetadata,
} from "./cache-types";

/**
 * Redis LRU Cache Implementation using Lua scripts
 * Maintains LRU order in Redis with atomic operations
 *
 * Best for: Distributed systems, large datasets, persistence needed
 * Pros: Distributed, persistent, atomic operations
 * Cons: Network latency, more complex than memory
 */
const LRU_REDIS_LUA = `
-- KEYS[1] = data key, KEYS[2] = access order key
-- ARGV[1] = value, ARGV[2] = ttl, ARGV[3] = max size, ARGV[4] = now timestamp
local dataKey = KEYS[1]
local orderKey = KEYS[2]
local value = ARGV[1]
local ttl = tonumber(ARGV[2])
local maxSize = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

-- Set the value with TTL if provided
if ttl and ttl > 0 then
  redis.call('SETEX', dataKey, math.floor(ttl / 1000), value)
else
  redis.call('SET', dataKey, value)
end

-- Update access order (score = timestamp)
redis.call('ZADD', orderKey, now, dataKey)

-- Enforce max size by removing oldest entries
local currentSize = redis.call('ZCARD', orderKey)
if currentSize > maxSize then
  local toRemove = currentSize - maxSize
  local oldestKeys = redis.call('ZRANGE', orderKey, 0, toRemove - 1)
  
  for i = 1, #oldestKeys do
    redis.call('DEL', oldestKeys[i])
    redis.call('ZREM', orderKey, oldestKeys[i])
  end
end

return 1
`;

const LRU_GET_REDIS_LUA = `
-- KEYS[1] = data key, KEYS[2] = access order key
-- ARGV[1] = now timestamp
local dataKey = KEYS[1]
local orderKey = KEYS[2]
local now = tonumber(ARGV[1])

-- Get the value
local value = redis.call('GET', dataKey)
if not value then
  return nil
end

-- Update access time
redis.call('ZADD', orderKey, now, dataKey)

-- Get TTL for metadata
local ttl = redis.call('TTL', dataKey)
return {value, ttl}
`;

/**
 * Redis LFU Cache Implementation using Lua scripts
 * Tracks access frequency for each key
 *
 * Best for: Workloads with clear hot/cold patterns
 * Pros: Excellent for skewed access patterns, distributed
 * Cons: More memory overhead for frequency tracking
 */
const LFU_REDIS_LUA = `
-- KEYS[1] = data key, KEYS[2] = frequency key
-- ARGV[1] = value, ARGV[2] = ttl, ARGV[3] = max size
local dataKey = KEYS[1]
local freqKey = KEYS[2]
local value = ARGV[1]
local ttl = tonumber(ARGV[2])
local maxSize = tonumber(ARGV[3])

-- Set the value with TTL if provided
if ttl and ttl > 0 then
  redis.call('SETEX', dataKey, math.floor(ttl / 1000), value)
else
  redis.call('SET', dataKey, value)
end

-- Initialize frequency to 1
redis.call('ZADD', freqKey, 1, dataKey)

-- Enforce max size by removing least frequent entries
local currentSize = redis.call('ZCARD', freqKey)
if currentSize > maxSize then
  local toRemove = currentSize - maxSize
  local leastFreqKeys = redis.call('ZRANGE', freqKey, 0, toRemove - 1)
  
  for i = 1, #leastFreqKeys do
    redis.call('DEL', leastFreqKeys[i])
    redis.call('ZREM', freqKey, leastFreqKeys[i])
  end
end

return 1
`;

const LFU_GET_REDIS_LUA = `
-- KEYS[1] = data key, KEYS[2] = frequency key
local dataKey = KEYS[1]
local freqKey = KEYS[2]

-- Get the value
local value = redis.call('GET', dataKey)
if not value then
  return nil
end

-- Increment frequency
redis.call('ZINCRBY', freqKey, 1, dataKey)

-- Get TTL and frequency for metadata
local ttl = redis.call('TTL', dataKey)
local freq = redis.call('ZSCORE', freqKey, dataKey)
return {value, ttl, freq}
`;

/**
 * Write-Through Cache Implementation
 * Writes to both cache and persistent storage simultaneously
 *
 * Best for: Strong consistency requirements, read-heavy workloads
 * Pros: Always consistent, simple to reason about
 * Cons: Higher write latency, more complex error handling
 */
const WRITE_THROUGH_LUA = `
-- KEYS[1] = cache key, KEYS[2] = storage key
-- ARGV[1] = value, ARGV[2] = ttl
local cacheKey = KEYS[1]
local storageKey = KEYS[2]
local value = ARGV[1]
local ttl = tonumber(ARGV[2])

-- Write to both cache and storage
redis.call('SET', cacheKey, value)
redis.call('SET', storageKey, value)

-- Set TTL on cache if provided
if ttl and ttl > 0 then
  redis.call('EXPIRE', cacheKey, math.floor(ttl / 1000))
end

return 1
`;

/**
 * Write-Behind Cache Implementation
 * Writes to cache immediately, storage asynchronously
 *
 * Best for: Write-heavy workloads, can tolerate eventual consistency
 * Pros: Lower write latency, better performance
 * Cons: Risk of data loss, eventual consistency
 */
const WRITE_BEHIND_LUA = `
-- KEYS[1] = cache key, KEYS[2] = write queue key
-- ARGV[1] = value, ARGV[2] = ttl, ARGV[3] = storage key, ARGV[4] = timestamp
local cacheKey = KEYS[1]
local queueKey = KEYS[2]
local value = ARGV[1]
local ttl = tonumber(ARGV[2])
local storageKey = ARGV[3]
local timestamp = ARGV[4]

-- Write to cache immediately
redis.call('SET', cacheKey, value)

-- Set TTL on cache if provided
if ttl and ttl > 0 then
  redis.call('EXPIRE', cacheKey, math.floor(ttl / 1000))
end

-- Queue for background write to storage
local writeData = cjson.encode({
  storageKey = storageKey,
  value = value,
  timestamp = timestamp
})
redis.call('LPUSH', queueKey, writeData)

return 1
`;

/**
 * Redis cache implementation class
 * Provides unified interface for all Redis caching strategies
 */
export class RedisCache {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    maxSize: 0,
    evictions: 0,
  };

  constructor(
    private redis: CacheRedisClient,
    private maxSize: number = 10000
  ) {
    this.stats.maxSize = maxSize;
  }

  /**
   * Get value from Redis cache with strategy-specific logic
   */
  async get(
    key: string,
    strategy: CacheStrategy,
    nowMs: number = Date.now()
  ): Promise<CacheResult> {
    try {
      let result: unknown;
      const metadata: CacheMetadata = {};

      switch (strategy) {
        case CacheStrategy.LRU_REDIS: {
          result = await this.redis.eval(
            LRU_GET_REDIS_LUA,
            2,
            `cache:${key}`,
            `lru_order:cache`,
            String(nowMs)
          );
          break;
        }
        case CacheStrategy.LFU_REDIS: {
          result = await this.redis.eval(LFU_GET_REDIS_LUA, 2, `cache:${key}`, `lfu_freq:cache`);
          if (result && Array.isArray(result) && result.length >= 3) {
            metadata.hitCount = parseInt(String(result[2])) || 0;
          }
          break;
        }
        case CacheStrategy.TTL_REDIS:
        case CacheStrategy.WRITE_THROUGH_REDIS:
        case CacheStrategy.WRITE_BEHIND_REDIS: {
          const value = await this.redis.get(`cache:${key}`);
          const ttl = await this.redis.ttl(`cache:${key}`);
          result = value ? [value, ttl] : null;
          break;
        }
        default:
          throw new Error(`Unsupported Redis cache strategy: ${strategy}`);
      }

      const resultArr = Array.isArray(result) ? result : null;
      if (!resultArr || !resultArr[0]) {
        this.stats.misses++;
        this.updateHitRate();
        return { hit: false, value: null };
      }

      // Parse value (assuming JSON serialization)
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(String(resultArr[0]));
      } catch {
        parsedValue = resultArr[0]; // Use as string if not JSON
      }

      // Set TTL metadata
      if (resultArr[1] && Number(resultArr[1]) > 0) {
        metadata.ttl = Number(resultArr[1]) * 1000; // Convert seconds to milliseconds
      }

      this.stats.hits++;
      this.updateHitRate();

      return {
        hit: true,
        value: parsedValue,
        ttl: metadata.ttl,
        metadata,
      };
    } catch (error) {
      if (error instanceof Error) console.error("Redis cache get error:", error);
      this.stats.misses++;
      this.updateHitRate();
      return { hit: false, value: null };
    }
  }

  /**
   * Set value in Redis cache with strategy-specific logic
   */
  async set(
    key: string,
    value: unknown,
    strategy: CacheStrategy,
    ttl?: number,
    nowMs: number = Date.now()
  ): Promise<void> {
    try {
      // Serialize value (JSON for complex objects, string for primitives)
      const serializedValue = typeof value === "string" ? value : JSON.stringify(value);

      switch (strategy) {
        case CacheStrategy.LRU_REDIS:
          await this.redis.eval(
            LRU_REDIS_LUA,
            2,
            `cache:${key}`,
            `lru_order:cache`,
            serializedValue,
            String(ttl || 0),
            String(this.maxSize),
            String(nowMs)
          );
          break;

        case CacheStrategy.LFU_REDIS:
          await this.redis.eval(
            LFU_REDIS_LUA,
            2,
            `cache:${key}`,
            `lfu_freq:cache`,
            serializedValue,
            String(ttl || 0),
            String(this.maxSize)
          );
          break;

        case CacheStrategy.TTL_REDIS:
          if (ttl && ttl > 0) {
            await this.redis.set(`cache:${key}`, serializedValue, "PX", ttl);
          } else {
            await this.redis.set(`cache:${key}`, serializedValue);
          }
          break;

        case CacheStrategy.WRITE_THROUGH_REDIS:
          await this.redis.eval(
            WRITE_THROUGH_LUA,
            2,
            `cache:${key}`,
            `storage:${key}`,
            serializedValue,
            String(ttl || 0)
          );
          break;

        case CacheStrategy.WRITE_BEHIND_REDIS:
          await this.redis.eval(
            WRITE_BEHIND_LUA,
            2,
            `cache:${key}`,
            `write_queue`,
            serializedValue,
            String(ttl || 0),
            `storage:${key}`,
            String(nowMs)
          );
          break;

        default:
          throw new Error(`Unsupported Redis cache strategy: ${strategy}`);
      }

      // Update size estimate (rough approximation)
      this.stats.size = Math.min(this.stats.size + 1, this.maxSize);
    } catch (error) {
      if (error instanceof Error) console.error("Redis cache set error:", error);
      throw error;
    }
  }

  /**
   * Delete value from Redis cache
   */
  async delete(key: string, strategy: CacheStrategy): Promise<boolean> {
    try {
      const deleted = await this.redis.del(`cache:${key}`);

      // Clean up strategy-specific data structures
      switch (strategy) {
        case CacheStrategy.LRU_REDIS:
          await this.redis.eval(
            'redis.call("ZREM", KEYS[1], ARGV[1]); return 1',
            1,
            "lru_order:cache",
            `cache:${key}`
          );
          break;

        case CacheStrategy.LFU_REDIS:
          await this.redis.eval(
            'redis.call("ZREM", KEYS[1], ARGV[1]); return 1',
            1,
            "lfu_freq:cache",
            `cache:${key}`
          );
          break;

        case CacheStrategy.WRITE_THROUGH_REDIS:
          await this.redis.del(`storage:${key}`);
          break;
      }

      if (deleted > 0) {
        this.stats.size = Math.max(0, this.stats.size - 1);
        return true;
      }
      return false;
    } catch (error) {
      if (error instanceof Error) console.error("Redis cache delete error:", error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      // Get all cache keys
      const keys = await this.redis.keys("cache:*");
      if (keys.length > 0) {
        for (const key of keys) {
          await this.redis.del(key);
        }
      }

      // Clear strategy-specific data structures
      await this.redis.del("lru_order:cache");
      await this.redis.del("lfu_freq:cache");
      await this.redis.del("write_queue");

      this.stats.size = 0;
    } catch (error) {
      if (error instanceof Error) console.error("Redis cache clear error:", error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Process write-behind queue (for background processing)
   */
  async processWriteBehindQueue(batchSize: number = 10): Promise<number> {
    try {
      const items = (await this.redis.eval(
        `
        local items = {}
        for i = 1, ${batchSize} do
          local item = redis.call('RPOP', 'write_queue')
          if not item then break end
          table.insert(items, item)
        end
        return items
      `,
        0
      )) as string[];

      let processed = 0;
      for (const item of items) {
        try {
          const writeData = JSON.parse(item) as { storageKey: string; value: string };
          // In a real implementation, this would write to persistent storage
          await this.redis.set(writeData.storageKey, writeData.value);
          processed++;
        } catch (error) {
          if (error instanceof Error) console.error("Error processing write-behind item:", error);
          // Could implement dead letter queue here
        }
      }

      return processed;
    } catch (error) {
      if (error instanceof Error) console.error("Error processing write-behind queue:", error);
      return 0;
    }
  }

  /**
   * Update hit rate percentage
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

/**
 * Global Redis cache instance storage
 */
class RedisCacheStorage {
  private caches = new Map<string, RedisCache>();

  getCache(redis: CacheRedisClient, maxSize: number = 10000): RedisCache {
    const key = `redis-${maxSize}`;

    if (!this.caches.has(key)) {
      this.caches.set(key, new RedisCache(redis, maxSize));
    }

    return this.caches.get(key)!;
  }

  clearAll(): void {
    this.caches.clear();
  }
}

// Global storage instance
export const redisCacheStorage = new RedisCacheStorage();

/**
 * Unified Redis cache interface functions
 * Provides consistent API across all Redis cache strategies
 */
export async function getFromRedisCache(
  redis: CacheRedisClient,
  { key, strategy, maxSize, nowMs }: CacheOptions
): Promise<CacheResult> {
  const cache = redisCacheStorage.getCache(redis, maxSize);
  return cache.get(key, strategy, nowMs);
}

export async function setInRedisCache(
  redis: CacheRedisClient,
  { key, strategy, maxSize, ttl, nowMs }: CacheOptions,
  value: unknown
): Promise<void> {
  const cache = redisCacheStorage.getCache(redis, maxSize);
  return cache.set(key, value, strategy, ttl, nowMs);
}

export async function deleteFromRedisCache(
  redis: CacheRedisClient,
  { key, strategy, maxSize }: CacheOptions
): Promise<boolean> {
  const cache = redisCacheStorage.getCache(redis, maxSize);
  return cache.delete(key, strategy);
}

export async function getRedisCacheStats(
  redis: CacheRedisClient,
  maxSize: number = 10000
): Promise<CacheStats> {
  const cache = redisCacheStorage.getCache(redis, maxSize);
  return cache.getStats();
}

export function clearRedisCacheStorage(): void {
  redisCacheStorage.clearAll();
}
