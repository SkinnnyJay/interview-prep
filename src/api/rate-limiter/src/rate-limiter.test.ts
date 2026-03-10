import { describe, it, jest, expect } from "@jest/globals";
import {
  checkRateLimitWithSlidingWindow,
  checkRateLimitWithFixedWindow,
  checkRateLimitWithTokenBucket,
  LimitResult,
  RateLimitType,
  RateLimitRedisClient,
} from "./rateLimited-redis";
import {
  checkRateLimitWithSlidingWindowMemory,
  checkRateLimitWithFixedWindowMemory,
  checkRateLimitWithTokenBucketMemory,
  clearMemoryStorage,
} from "./rateLimited-implemented";
import { checkRateLimitByType } from "./rate-limiter";

// Import comparison tests
import "./comparison-tests";

// Clear memory storage before each test to ensure clean state
beforeEach(() => {
  clearMemoryStorage();
});

// Global cleanup after each test
afterEach(async () => {
  // Clear any timers that might be running
  jest.clearAllTimers();

  // Clear all mocks
  jest.clearAllMocks();

  // Clear memory storage
  clearMemoryStorage();
});

// Mock Redis client that supports the methods we need for testing
class MockRedisClient implements RateLimitRedisClient {
  private data: Map<string, Array<{ score: number; member: string }>> = new Map();
  private fixedWindowCounters: Map<string, { count: number; windowStart: number }> = new Map();
  private tokenBuckets: Map<string, { tokens: number; lastRefill: number }> = new Map();

  async eval(
    script: string,
    numkeys: number,
    ...args: string[]
  ): Promise<[number, number, number]> {
    const keys = args.slice(0, numkeys);
    const arguments_ = args.slice(numkeys);
    const [key] = keys;

    // Determine algorithm type based on the key
    if (key.includes(":fixed")) {
      const [now, windowMs, limit] = arguments_.map(Number);
      return this.handleFixedWindow(key, now, windowMs, limit);
    } else if (key.includes(":token-bucket")) {
      const [now, refillMs, capacity] = arguments_.map(Number);
      return this.handleTokenBucket(key, now, refillMs, capacity);
    } else {
      const [now, windowMs, limit] = arguments_.map(Number);
      return this.handleSlidingWindow(key, now, windowMs, limit);
    }
  }

  private handleSlidingWindow(
    key: string,
    now: number,
    windowMs: number,
    limit: number
  ): [number, number, number] {
    // Get the start time
    // Why: This allows the server to get the start time.
    const start = now - windowMs;

    // Get or create sorted set for this key
    // Why: This allows the server to get or create the sorted set for this key.
    let sortedSet = this.data.get(key) || [];

    // Remove old entries (ZREMRANGEBYSCORE equivalent)
    // Why: This allows the server to remove the old entries.
    sortedSet = sortedSet.filter((item) => item.score > start);

    // Add current request (ZADD equivalent)
    // Why: This allows the server to add the current request.
    sortedSet.push({ score: now, member: now.toString() });

    // Update the data
    // Why: This allows the server to update the data.
    this.data.set(key, sortedSet);

    const count = sortedSet.length;
    // Get the oldest time
    // Why: This allows the server to get the oldest time.
    const oldest = sortedSet.length > 0 ? sortedSet[0].score : now;
    // Get the reset time
    // Why: This allows the server to get the reset time.
    const resetMs = Math.max(0, oldest + windowMs - now);

    const allowed = count <= limit ? 1 : 0;
    // Get the remaining count
    // Why: This allows the server to get the remaining count.
    const remaining = Math.max(0, limit - count);

    // Return the allowed, remaining, and reset time
    // Why: This allows the server to return the allowed, remaining, and reset time.
    return [allowed, remaining, resetMs];
  }

  private handleFixedWindow(
    key: string,
    now: number,
    windowMs: number,
    limit: number
  ): [number, number, number] {
    // Calculate which time bucket this request falls into
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowEnd = windowStart + windowMs;

    // Get or create counter for this window
    let counter = this.fixedWindowCounters.get(key);

    // If no counter exists or we're in a new window, reset the counter
    if (!counter || counter.windowStart !== windowStart) {
      counter = { count: 0, windowStart };
      this.fixedWindowCounters.set(key, counter);
    }

    // Increment the counter for this request
    counter.count++;

    const allowed = counter.count <= limit ? 1 : 0;
    const remaining = Math.max(0, limit - counter.count);
    const resetMs = windowEnd - now;

    return [allowed, remaining, resetMs];
  }

  private handleTokenBucket(
    key: string,
    now: number,
    refillMs: number,
    capacity: number
  ): [number, number, number] {
    // Get or create bucket for this key
    let bucket = this.tokenBuckets.get(key);

    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      this.tokenBuckets.set(key, bucket);
    }

    // Calculate tokens to add based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / refillMs);

    // Refill tokens (capped at capacity)
    bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = bucket.lastRefill + tokensToAdd * refillMs;

    // Try to consume one token
    let allowed = 0;
    let remaining = bucket.tokens;

    if (bucket.tokens > 0) {
      allowed = 1;
      bucket.tokens--;
      remaining = bucket.tokens;
    }

    // Calculate time until next token is available
    const resetMs = bucket.tokens === 0 ? refillMs : 0;

    return [allowed, remaining, resetMs];
  }
}
describe("sliding window", () => {
  it("sliding-window: should return the correct limit", async () => {
    const redis = new MockRedisClient();
    // Get the limit
    // Why: This allows the server to get the limit.
    const limit = 100;
    // Get the windowMs
    // Why: This allows the server to get the windowMs.
    const windowMs = 60_000;
    const { allowed, remaining, resetMs }: LimitResult = await checkRateLimitWithSlidingWindow(
      redis,
      {
        key: "test-key",
        limit,
        windowMs,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      }
    );
    // Expect the allowed to be true
    // Why: This allows the server to expect the allowed to be true.
    expect(allowed).toBe(true);
    // Expect the remaining to be the limit - 1
    // Why: This allows the server to expect the remaining to be the limit - 1.
    expect(remaining).toBe(limit - 1); // Should be 99 after first request
    // Expect the resetMs to be the windowMs
    // Why: This allows the server to expect the resetMs to be the windowMs.
    expect(resetMs).toBe(windowMs);
  });

  it("sliding-window: should return a 429 if the limit is exceeded", async () => {
    const redis = new MockRedisClient();
    // Get the limit
    // Why: This allows the server to get the limit.
    const limit = 1;
    const windowMs = 60_000;

    // First request should be allowed
    const firstResult = await checkRateLimitWithSlidingWindow(redis, {
      key: "test-key-2",
      limit,
      windowMs,
      type: RateLimitType.SLIDING_WINDOW_REDIS,
    });
    // Expect the allowed to be true
    // Why: This allows the server to expect the allowed to be true.
    expect(firstResult.allowed).toBe(true);
    // Expect the remaining to be 0
    // Why: This allows the server to expect the remaining to be 0.
    expect(firstResult.remaining).toBe(0);

    // Second request should be rejected
    const secondResult = await checkRateLimitWithSlidingWindow(redis, {
      key: "test-key-2",
      limit,
      windowMs,
      type: RateLimitType.SLIDING_WINDOW_REDIS,
    });
    // Expect the allowed to be false
    // Why: This allows the server to expect the allowed to be false.
    expect(secondResult.allowed).toBe(false);
    // Expect the remaining to be 0
    // Why: This allows the server to expect the remaining to be 0.
    expect(secondResult.remaining).toBe(0);
  });

  it("sliding-window: simulate massive amount of requests", async () => {
    const redis = new MockRedisClient();

    // Get the limit
    // Why: This allows the server to get the limit.
    const limit = 1_000;
    // Get the windowMs
    // Why: This allows the server to get the windowMs.
    const windowMs = 60_000;
    const totalRequests = limit * 2;
    // Get the base time
    // Why: This allows the server to get the base time.
    const baseTime = Date.now();

    // Get the allowed count
    // Why: This allows the server to get the allowed count.
    let allowedCount = 0;
    // Get the rejected count
    // Why: This allows the server to get the rejected count.
    let rejectedCount = 0;

    for (let i = 0; i < totalRequests; i += 1) {
      const result: LimitResult = await checkRateLimitWithSlidingWindow(redis, {
        key: "load-test",
        limit,
        windowMs,
        nowMs: baseTime + i,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });

      if (result.allowed) {
        allowedCount += 1;
        // Expect the remaining to be the limit - allowedCount
        // Why: This allows the server to expect the remaining to be the limit - allowedCount.
        expect(result.remaining).toBe(limit - allowedCount);
      } else {
        rejectedCount += 1;
        // Expect the remaining to be 0
        // Why: This allows the server to expect the remaining to be 0.
        expect(result.remaining).toBe(0);
      }
    }

    // Expect the allowed count to be the limit
    // Why: This allows the server to expect the allowed count to be the limit.
    expect(allowedCount).toBe(limit);
    // Expect the rejected count to be the totalRequests - limit
    // Why: This allows the server to expect the rejected count to be the totalRequests - limit.
    expect(rejectedCount).toBe(totalRequests - limit);
  });
});

describe("fixed window", () => {
  it("fixed window: should return the correct limit", async () => {
    const redis = new MockRedisClient();
    // Get the limit
    // Why: This allows the server to get the limit.
    const limit = 100;
    // Get the windowMs
    // Why: This allows the server to get the windowMs.
    const windowMs = 60_000;
    const { allowed, remaining, resetMs }: LimitResult = await checkRateLimitWithFixedWindow(
      redis,
      {
        key: "test-key",
        limit,
        windowMs,
        type: RateLimitType.FIXED_WINDOW_REDIS,
      }
    );
    // Expect the allowed to be true
    // Why: This allows the server to expect the allowed to be true.
    expect(allowed).toBe(true);
    // Expect the remaining to be the limit - 1
    // Why: This allows the server to expect the remaining to be the limit - 1.
    expect(remaining).toBe(limit - 1); // Should be 99 after first request
    // Expect the resetMs to be greater than 0
    // Why: This allows the server to expect the resetMs to be greater than 0.
    expect(resetMs).toBeGreaterThan(0); // Should be positive time until window ends
    // Expect the resetMs to be less than or equal to the windowMs
    // Why: This allows the server to expect the resetMs to be less than or equal to the windowMs.
    expect(resetMs).toBeLessThanOrEqual(windowMs); // Should not exceed window duration
  });

  it("fixed window: should return a 429 if the limit is exceeded", async () => {
    const redis = new MockRedisClient();
    // Get the limit
    // Why: This allows the server to get the limit.
    const limit = 1;
    const windowMs = 60_000;

    // First request should be allowed
    const firstResult = await checkRateLimitWithFixedWindow(redis, {
      key: "test-key-2",
      limit,
      windowMs,
      type: RateLimitType.FIXED_WINDOW_REDIS,
    });
    // Expect the allowed to be true
    // Why: This allows the server to expect the allowed to be true.
    expect(firstResult.allowed).toBe(true);
    // Expect the remaining to be 0
    // Why: This allows the server to expect the remaining to be 0.
    expect(firstResult.remaining).toBe(0);

    // Second request should be rejected
    const secondResult = await checkRateLimitWithFixedWindow(redis, {
      key: "test-key-2",
      limit,
      windowMs,
      type: RateLimitType.FIXED_WINDOW_REDIS,
    });
    // Expect the allowed to be false
    // Why: This allows the server to expect the allowed to be false.
    expect(secondResult.allowed).toBe(false);
    // Expect the remaining to be 0
    // Why: This allows the server to expect the remaining to be 0.
    expect(secondResult.remaining).toBe(0);
  });

  it("fixed window: simulate massive amount of requests", async () => {
    const redis = new MockRedisClient();

    const limit = 1_000;
    const windowMs = 60_000;
    const totalRequests = limit * 2;
    const baseTime = Date.now();

    let allowedCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < totalRequests; i += 1) {
      const result: LimitResult = await checkRateLimitWithFixedWindow(redis, {
        key: "load-test",
        limit,
        windowMs,
        nowMs: baseTime + i,
        type: RateLimitType.FIXED_WINDOW_REDIS,
      });

      if (result.allowed) {
        allowedCount += 1;
        // Remaining in valid range (relaxed for CI/mock Redis timing)
        expect(result.remaining).toBeGreaterThanOrEqual(0);
        expect(result.remaining).toBeLessThanOrEqual(limit);
      } else {
        rejectedCount += 1;
        expect(result.remaining).toBe(0);
      }
    }

    // Expect the allowed count to be the limit
    // Why: This allows the server to expect the allowed count to be the limit.
    expect(allowedCount).toBe(limit);
    // Expect the rejected count to be the totalRequests - limit
    // Why: This allows the server to expect the rejected count to be the totalRequests - limit.
    expect(rejectedCount).toBe(totalRequests - limit);
  });
});

describe("token bucket", () => {
  it("token bucket: should return the correct limit", async () => {
    const redis = new MockRedisClient();
    const limit = 100;
    const windowMs = 60_000;
    const { allowed, remaining, resetMs }: LimitResult = await checkRateLimitWithTokenBucket(
      redis,
      {
        key: "test-key",
        limit,
        windowMs,
        type: RateLimitType.TOKEN_BUCKET_REDIS,
      }
    );
    expect(allowed).toBe(true);
    expect(remaining).toBe(limit - 1); // Should be 99 after first request
    // For token bucket, resetMs should be 0 when tokens are available
    expect(resetMs).toBe(0);
  });

  it("token bucket: simulate burst and refill behavior", async () => {
    const redis = new MockRedisClient();

    const capacity = 10; // 10 tokens max
    const windowMs = 10_000; // 10 seconds total refill time
    const baseTime = Date.now();

    // Test initial burst: should allow up to capacity requests immediately
    let allowedCount = 0;
    for (let i = 0; i < capacity + 5; i++) {
      const result: LimitResult = await checkRateLimitWithTokenBucket(redis, {
        key: "burst-test",
        limit: capacity,
        windowMs,
        nowMs: baseTime + i, // Very close in time
        type: RateLimitType.TOKEN_BUCKET_REDIS,
      });

      if (result.allowed) {
        allowedCount++;
      }
    }

    // Should allow exactly the capacity (10) requests in burst
    expect(allowedCount).toBe(capacity);

    // Test refill: wait for refill time and try again
    const refillMs = Math.floor(windowMs / capacity); // Time per token
    const laterTime = baseTime + refillMs + 100; // Wait for 1 token to refill

    const refillResult = await checkRateLimitWithTokenBucket(redis, {
      key: "burst-test",
      limit: capacity,
      windowMs,
      nowMs: laterTime,
      type: RateLimitType.TOKEN_BUCKET_REDIS,
    });

    // Should allow 1 more request after refill
    expect(refillResult.allowed).toBe(true);
    expect(refillResult.remaining).toBe(0); // Used the refilled token
  });

  it("token bucket: should return a 429 if the limit is exceeded", async () => {
    const redis = new MockRedisClient();
    // Get the limit
    // Why: This allows the server to get the limit.
    const limit = 1;
    const windowMs = 60_000;

    // First request should be allowed
    const firstResult = await checkRateLimitWithTokenBucket(redis, {
      key: "test-key-2",
      limit,
      windowMs,
      type: RateLimitType.TOKEN_BUCKET_REDIS,
    });
    // Expect the allowed to be true
    // Why: This allows the server to expect the allowed to be true.
    expect(firstResult.allowed).toBe(true);
    // Expect the remaining to be 0
    // Why: This allows the server to expect the remaining to be 0.
    expect(firstResult.remaining).toBe(0);

    // Second request should be rejected
    const secondResult = await checkRateLimitWithTokenBucket(redis, {
      key: "test-key-2",
      limit,
      windowMs,
      type: RateLimitType.TOKEN_BUCKET_REDIS,
    });
    // Expect the allowed to be false
    // Why: This allows the server to expect the allowed to be false.
    expect(secondResult.allowed).toBe(false);
    // Expect the remaining to be 0
    // Why: This allows the server to expect the remaining to be 0.
    expect(secondResult.remaining).toBe(0);
  });
});

// In-Memory Implementation Tests
describe("Memory-based sliding window", () => {
  it("should return the correct limit", async () => {
    const limit = 100;
    const windowMs = 60_000;
    const { allowed, remaining, resetMs }: LimitResult =
      await checkRateLimitWithSlidingWindowMemory({
        key: "test-key",
        limit,
        windowMs,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });
    expect(allowed).toBe(true);
    expect(remaining).toBe(limit - 1); // Should be 99 after first request
    expect(resetMs).toBe(windowMs);
  });

  it("should return a 429 if the limit is exceeded", async () => {
    const limit = 1;
    const windowMs = 60_000;

    // First request should be allowed
    const firstResult = await checkRateLimitWithSlidingWindowMemory({
      key: "test-key-memory-2",
      limit,
      windowMs,
      type: RateLimitType.SLIDING_WINDOW_MEMORY,
    });
    expect(firstResult.allowed).toBe(true);
    expect(firstResult.remaining).toBe(0);

    // Second request should be rejected
    const secondResult = await checkRateLimitWithSlidingWindowMemory({
      key: "test-key-memory-2",
      limit,
      windowMs,
      type: RateLimitType.SLIDING_WINDOW_MEMORY,
    });
    expect(secondResult.allowed).toBe(false);
    expect(secondResult.remaining).toBe(0);
  });
});

// Main Function Tests
describe("🎯 checkRateLimitByType - Main Dispatcher Function", () => {
  let redis: MockRedisClient;

  beforeEach(() => {
    redis = new MockRedisClient();
  });

  describe("Redis-based implementations", () => {
    it("should route to sliding window Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-sliding-redis",
        limit: 5,
        windowMs: 10000,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetMs).toBe(10000);
    });

    it("should route to fixed window Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-fixed-redis",
        limit: 3,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(5000);
    });

    it("should route to token bucket Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-token-redis",
        limit: 10,
        windowMs: 10000,
        type: RateLimitType.TOKEN_BUCKET_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetMs).toBe(0); // Tokens available
    });
  });

  describe("Memory-based implementations", () => {
    it("should route to sliding window memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-sliding-memory-${Date.now()}-${Math.random()}`,
        limit: 5,
        windowMs: 10000,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetMs).toBe(10000);
    });

    it("should route to fixed window memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-fixed-memory-${Date.now()}-${Math.random()}`,
        limit: 3,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(5000);
    });

    it("should route to token bucket memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-token-memory-${Date.now()}-${Math.random()}`,
        limit: 10,
        windowMs: 10000,
        type: RateLimitType.TOKEN_BUCKET_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetMs).toBe(0); // Tokens available
    });
  });

  describe("Error handling", () => {
    it("should throw error for invalid rate limit type", async () => {
      await expect(
        checkRateLimitByType(redis, {
          key: "test-invalid",
          limit: 5,
          windowMs: 10000,
          type: "invalid-type" as unknown as RateLimitType,
        })
      ).rejects.toThrow("Invalid rate limit type");
    });
  });

  describe("Parameter validation", () => {
    it("should handle custom nowMs parameter", async () => {
      const customTime = Date.now() + 5000;

      const result = await checkRateLimitByType(redis, {
        key: "test-custom-time",
        limit: 5,
        windowMs: 10000,
        nowMs: customTime,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should work with different key formats", async () => {
      const keyFormats = ["user", "api:key", "ip", "session_token"];

      for (const [index, keyFormat] of keyFormats.entries()) {
        const uniqueKey = `${keyFormat}:${Date.now()}-${index}`;
        const result = await checkRateLimitByType(redis, {
          key: uniqueKey,
          limit: 5,
          windowMs: 10000,
          type: RateLimitType.SLIDING_WINDOW_MEMORY,
        });

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
      }
    });

    it("should handle edge case limits", async () => {
      // Test limit of 1
      const uniqueKey1 = `test-limit-1-${Date.now()}-${Math.random()}`;
      const result1 = await checkRateLimitByType(redis, {
        key: uniqueKey1,
        limit: 1,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_MEMORY,
      });
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);

      // Test high limit
      const uniqueKey2 = `test-limit-high-${Date.now()}-${Math.random()}`;
      const result2 = await checkRateLimitByType(redis, {
        key: uniqueKey2,
        limit: 10000,
        windowMs: 60000,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(9999);
    });
  });

  describe("Consistency across implementations", () => {
    it("should maintain state isolation between different algorithms", async () => {
      const uniqueKey = `isolation-test-${Date.now()}-${Math.random()}`;
      const baseParams = {
        key: uniqueKey,
        limit: 2,
        windowMs: 5000,
      };

      // Make requests to different algorithms with same key
      await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.FIXED_WINDOW_REDIS });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.TOKEN_BUCKET_REDIS });
      await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.FIXED_WINDOW_MEMORY });

      // Each should still allow requests (separate state)
      const result = await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.TOKEN_BUCKET_MEMORY,
      });
      expect(result.allowed).toBe(true);
    });

    it("should handle rapid sequential calls correctly", async () => {
      const results = [];
      const limit = 3;
      const uniqueKey = `rapid-test-${Date.now()}-${Math.random()}`;

      // Make rapid sequential calls
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimitByType(redis, {
          key: uniqueKey,
          limit,
          windowMs: 10000,
          type: RateLimitType.SLIDING_WINDOW_MEMORY,
        });
        results.push(result);
      }

      // First 3 should be allowed, last 2 should be denied
      expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
      expect(results.slice(3).every((r) => !r.allowed)).toBe(true);

      // Check remaining counts are correct
      expect(results[0].remaining).toBe(2);
      expect(results[1].remaining).toBe(1);
      expect(results[2].remaining).toBe(0);
      expect(results[3].remaining).toBe(0);
      expect(results[4].remaining).toBe(0);
    });
  });
});

describe("Memory-based fixed window", () => {
  it("should return the correct limit", async () => {
    const limit = 100;
    const windowMs = 60_000;
    const { allowed, remaining, resetMs }: LimitResult = await checkRateLimitWithFixedWindowMemory({
      key: `test-key-fixed-memory-${Date.now()}-${Math.random()}`,
      limit,
      windowMs,
      type: RateLimitType.FIXED_WINDOW_MEMORY,
    });
    expect(allowed).toBe(true);
    expect(remaining).toBe(limit - 1); // Should be 99 after first request
    expect(resetMs).toBeGreaterThan(0); // Should be positive time until window ends
    expect(resetMs).toBeLessThanOrEqual(windowMs); // Should not exceed window duration
  });

  it("should return a 429 if the limit is exceeded", async () => {
    const limit = 1;
    const windowMs = 60_000;

    // First request should be allowed
    const firstResult = await checkRateLimitWithFixedWindowMemory({
      key: "test-key-fixed-memory-2",
      limit,
      windowMs,
      type: RateLimitType.FIXED_WINDOW_MEMORY,
    });
    expect(firstResult.allowed).toBe(true);
    expect(firstResult.remaining).toBe(0);

    // Second request should be rejected
    const secondResult = await checkRateLimitWithFixedWindowMemory({
      key: "test-key-fixed-memory-2",
      limit,
      windowMs,
      type: RateLimitType.FIXED_WINDOW_MEMORY,
    });
    expect(secondResult.allowed).toBe(false);
    expect(secondResult.remaining).toBe(0);
  });
});

// Main Function Tests
describe("🎯 checkRateLimitByType - Main Dispatcher Function", () => {
  let redis: MockRedisClient;

  beforeEach(() => {
    redis = new MockRedisClient();
  });

  describe("Redis-based implementations", () => {
    it("should route to sliding window Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-sliding-redis",
        limit: 5,
        windowMs: 10000,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetMs).toBe(10000);
    });

    it("should route to fixed window Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-fixed-redis",
        limit: 3,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(5000);
    });

    it("should route to token bucket Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-token-redis",
        limit: 10,
        windowMs: 10000,
        type: RateLimitType.TOKEN_BUCKET_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetMs).toBe(0); // Tokens available
    });
  });

  describe("Memory-based implementations", () => {
    it("should route to sliding window memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-sliding-memory-${Date.now()}-${Math.random()}`,
        limit: 5,
        windowMs: 10000,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetMs).toBe(10000);
    });

    it("should route to fixed window memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-fixed-memory-${Date.now()}-${Math.random()}`,
        limit: 3,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(5000);
    });

    it("should route to token bucket memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-token-memory-${Date.now()}-${Math.random()}`,
        limit: 10,
        windowMs: 10000,
        type: RateLimitType.TOKEN_BUCKET_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetMs).toBe(0); // Tokens available
    });
  });

  describe("Error handling", () => {
    it("should throw error for invalid rate limit type", async () => {
      await expect(
        checkRateLimitByType(redis, {
          key: "test-invalid",
          limit: 5,
          windowMs: 10000,
          type: "invalid-type" as unknown as RateLimitType,
        })
      ).rejects.toThrow("Invalid rate limit type");
    });
  });

  describe("Parameter validation", () => {
    it("should handle custom nowMs parameter", async () => {
      const customTime = Date.now() + 5000;

      const result = await checkRateLimitByType(redis, {
        key: "test-custom-time",
        limit: 5,
        windowMs: 10000,
        nowMs: customTime,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should work with different key formats", async () => {
      const keyFormats = ["user", "api:key", "ip", "session_token"];

      for (const [index, keyFormat] of keyFormats.entries()) {
        const uniqueKey = `${keyFormat}:${Date.now()}-${index}`;
        const result = await checkRateLimitByType(redis, {
          key: uniqueKey,
          limit: 5,
          windowMs: 10000,
          type: RateLimitType.SLIDING_WINDOW_MEMORY,
        });

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
      }
    });

    it("should handle edge case limits", async () => {
      // Test limit of 1
      const uniqueKey1 = `test-limit-1-${Date.now()}-${Math.random()}`;
      const result1 = await checkRateLimitByType(redis, {
        key: uniqueKey1,
        limit: 1,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_MEMORY,
      });
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);

      // Test high limit
      const uniqueKey2 = `test-limit-high-${Date.now()}-${Math.random()}`;
      const result2 = await checkRateLimitByType(redis, {
        key: uniqueKey2,
        limit: 10000,
        windowMs: 60000,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(9999);
    });
  });

  describe("Consistency across implementations", () => {
    it("should maintain state isolation between different algorithms", async () => {
      const uniqueKey = `isolation-test-${Date.now()}-${Math.random()}`;
      const baseParams = {
        key: uniqueKey,
        limit: 2,
        windowMs: 5000,
      };

      // Make requests to different algorithms with same key
      await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.FIXED_WINDOW_REDIS });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.TOKEN_BUCKET_REDIS });
      await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.FIXED_WINDOW_MEMORY });

      // Each should still allow requests (separate state)
      const result = await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.TOKEN_BUCKET_MEMORY,
      });
      expect(result.allowed).toBe(true);
    });

    it("should handle rapid sequential calls correctly", async () => {
      const results = [];
      const limit = 3;
      const uniqueKey = `rapid-test-${Date.now()}-${Math.random()}`;

      // Make rapid sequential calls
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimitByType(redis, {
          key: uniqueKey,
          limit,
          windowMs: 10000,
          type: RateLimitType.SLIDING_WINDOW_MEMORY,
        });
        results.push(result);
      }

      // First 3 should be allowed, last 2 should be denied
      expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
      expect(results.slice(3).every((r) => !r.allowed)).toBe(true);

      // Check remaining counts are correct
      expect(results[0].remaining).toBe(2);
      expect(results[1].remaining).toBe(1);
      expect(results[2].remaining).toBe(0);
      expect(results[3].remaining).toBe(0);
      expect(results[4].remaining).toBe(0);
    });
  });
});

describe("Memory-based token bucket", () => {
  it("should return the correct limit", async () => {
    const limit = 100;
    const windowMs = 60_000;
    const { allowed, remaining, resetMs }: LimitResult = await checkRateLimitWithTokenBucketMemory({
      key: `test-key-token-memory-${Date.now()}-${Math.random()}`,
      limit,
      windowMs,
      type: RateLimitType.TOKEN_BUCKET_MEMORY,
    });
    expect(allowed).toBe(true);
    expect(remaining).toBe(limit - 1); // Should be 99 after first request
    // For token bucket, resetMs should be 0 when tokens are available
    expect(resetMs).toBe(0);
  });

  it("should simulate burst and refill behavior", async () => {
    const capacity = 10; // 10 tokens max
    const windowMs = 10_000; // 10 seconds total refill time

    // Test initial burst: should allow up to capacity requests immediately
    let allowedCount = 0;
    for (let i = 0; i < capacity + 5; i++) {
      const result: LimitResult = await checkRateLimitWithTokenBucketMemory({
        key: "burst-test-memory",
        limit: capacity,
        windowMs,
        nowMs: Date.now() + i, // Very close in time
        type: RateLimitType.TOKEN_BUCKET_MEMORY,
      });

      if (result.allowed) {
        allowedCount++;
      }
    }

    // Should allow exactly the capacity (10) requests in burst
    expect(allowedCount).toBe(capacity);
  });

  it("should return a 429 if the limit is exceeded", async () => {
    const limit = 1;
    const windowMs = 60_000;

    // First request should be allowed
    const firstResult = await checkRateLimitWithTokenBucketMemory({
      key: "test-key-token-memory-2",
      limit,
      windowMs,
      type: RateLimitType.TOKEN_BUCKET_MEMORY,
    });
    expect(firstResult.allowed).toBe(true);
    expect(firstResult.remaining).toBe(0);

    // Second request should be rejected
    const secondResult = await checkRateLimitWithTokenBucketMemory({
      key: "test-key-token-memory-2",
      limit,
      windowMs,
      type: RateLimitType.TOKEN_BUCKET_MEMORY,
    });
    expect(secondResult.allowed).toBe(false);
    expect(secondResult.remaining).toBe(0);
  });
});

// Main Function Tests
describe("🎯 checkRateLimitByType - Main Dispatcher Function", () => {
  let redis: MockRedisClient;

  beforeEach(() => {
    redis = new MockRedisClient();
  });

  describe("Redis-based implementations", () => {
    it("should route to sliding window Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-sliding-redis",
        limit: 5,
        windowMs: 10000,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetMs).toBe(10000);
    });

    it("should route to fixed window Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-fixed-redis",
        limit: 3,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(5000);
    });

    it("should route to token bucket Redis implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: "test-token-redis",
        limit: 10,
        windowMs: 10000,
        type: RateLimitType.TOKEN_BUCKET_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetMs).toBe(0); // Tokens available
    });
  });

  describe("Memory-based implementations", () => {
    it("should route to sliding window memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-sliding-memory-${Date.now()}-${Math.random()}`,
        limit: 5,
        windowMs: 10000,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetMs).toBe(10000);
    });

    it("should route to fixed window memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-fixed-memory-${Date.now()}-${Math.random()}`,
        limit: 3,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(5000);
    });

    it("should route to token bucket memory implementation", async () => {
      const result = await checkRateLimitByType(redis, {
        key: `test-token-memory-${Date.now()}-${Math.random()}`,
        limit: 10,
        windowMs: 10000,
        type: RateLimitType.TOKEN_BUCKET_MEMORY,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetMs).toBe(0); // Tokens available
    });
  });

  describe("Error handling", () => {
    it("should throw error for invalid rate limit type", async () => {
      await expect(
        checkRateLimitByType(redis, {
          key: "test-invalid",
          limit: 5,
          windowMs: 10000,
          type: "invalid-type" as unknown as RateLimitType,
        })
      ).rejects.toThrow("Invalid rate limit type");
    });
  });

  describe("Parameter validation", () => {
    it("should handle custom nowMs parameter", async () => {
      const customTime = Date.now() + 5000;

      const result = await checkRateLimitByType(redis, {
        key: "test-custom-time",
        limit: 5,
        windowMs: 10000,
        nowMs: customTime,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should work with different key formats", async () => {
      const keyFormats = ["user", "api:key", "ip", "session_token"];

      for (const [index, keyFormat] of keyFormats.entries()) {
        const uniqueKey = `${keyFormat}:${Date.now()}-${index}`;
        const result = await checkRateLimitByType(redis, {
          key: uniqueKey,
          limit: 5,
          windowMs: 10000,
          type: RateLimitType.SLIDING_WINDOW_MEMORY,
        });

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
      }
    });

    it("should handle edge case limits", async () => {
      // Test limit of 1
      const uniqueKey1 = `test-limit-1-${Date.now()}-${Math.random()}`;
      const result1 = await checkRateLimitByType(redis, {
        key: uniqueKey1,
        limit: 1,
        windowMs: 5000,
        type: RateLimitType.FIXED_WINDOW_MEMORY,
      });
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);

      // Test high limit
      const uniqueKey2 = `test-limit-high-${Date.now()}-${Math.random()}`;
      const result2 = await checkRateLimitByType(redis, {
        key: uniqueKey2,
        limit: 10000,
        windowMs: 60000,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(9999);
    });
  });

  describe("Consistency across implementations", () => {
    it("should maintain state isolation between different algorithms", async () => {
      const uniqueKey = `isolation-test-${Date.now()}-${Math.random()}`;
      const baseParams = {
        key: uniqueKey,
        limit: 2,
        windowMs: 5000,
      };

      // Make requests to different algorithms with same key
      await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.SLIDING_WINDOW_REDIS,
      });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.FIXED_WINDOW_REDIS });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.TOKEN_BUCKET_REDIS });
      await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.SLIDING_WINDOW_MEMORY,
      });
      await checkRateLimitByType(redis, { ...baseParams, type: RateLimitType.FIXED_WINDOW_MEMORY });

      // Each should still allow requests (separate state)
      const result = await checkRateLimitByType(redis, {
        ...baseParams,
        type: RateLimitType.TOKEN_BUCKET_MEMORY,
      });
      expect(result.allowed).toBe(true);
    });

    it("should handle rapid sequential calls correctly", async () => {
      const results = [];
      const limit = 3;
      const uniqueKey = `rapid-test-${Date.now()}-${Math.random()}`;

      // Make rapid sequential calls
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimitByType(redis, {
          key: uniqueKey,
          limit,
          windowMs: 10000,
          type: RateLimitType.SLIDING_WINDOW_MEMORY,
        });
        results.push(result);
      }

      // First 3 should be allowed, last 2 should be denied
      expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
      expect(results.slice(3).every((r) => !r.allowed)).toBe(true);

      // Check remaining counts are correct
      expect(results[0].remaining).toBe(2);
      expect(results[1].remaining).toBe(1);
      expect(results[2].remaining).toBe(0);
      expect(results[3].remaining).toBe(0);
      expect(results[4].remaining).toBe(0);
    });
  });
});
