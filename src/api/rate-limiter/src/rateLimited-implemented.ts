// rateLimited-implemented.ts
// In-memory rate limiter implementations without Redis dependency

import { LimitOpts, LimitResult, RateLimitType } from "./rateLimited-redis";

// In-memory storage for rate limiting data
class RateLimiterStorage {
  // Sliding window: Map<key, Array<timestamp>>
  private slidingWindowData = new Map<string, number[]>();

  // Fixed window: Map<key, {count: number, windowStart: number}>
  private fixedWindowData = new Map<string, { count: number; windowStart: number }>();

  // Token bucket: Map<key, {tokens: number, lastRefill: number}>
  private tokenBucketData = new Map<string, { tokens: number; lastRefill: number }>();

  // Sliding Window Implementation
  checkSlidingWindow(key: string, limit: number, windowMs: number, now: number): LimitResult {
    const start = now - windowMs;

    // Get existing requests for this key
    let requests = this.slidingWindowData.get(key) || [];

    // Remove old requests outside the window
    requests = requests.filter((timestamp) => timestamp > start);

    // Add current request
    requests.push(now);

    // Update storage
    this.slidingWindowData.set(key, requests);

    const count = requests.length;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    // Calculate reset time based on oldest request
    const oldest = requests.length > 0 ? requests[0] : now;
    const resetMs = Math.max(0, oldest + windowMs - now);

    return { allowed, remaining, resetMs };
  }

  // Fixed Window Implementation
  checkFixedWindow(key: string, limit: number, windowMs: number, now: number): LimitResult {
    // Calculate current window boundaries
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowEnd = windowStart + windowMs;

    // Get or create counter for this window
    let counter = this.fixedWindowData.get(key);

    // Reset counter if we're in a new window
    if (!counter || counter.windowStart !== windowStart) {
      counter = { count: 0, windowStart };
    }

    // Increment counter for this request
    counter.count++;

    // Update storage
    this.fixedWindowData.set(key, counter);

    const allowed = counter.count <= limit;
    const remaining = Math.max(0, limit - counter.count);
    const resetMs = windowEnd - now;

    return { allowed, remaining, resetMs };
  }

  // Token Bucket Implementation
  checkTokenBucket(key: string, capacity: number, refillMs: number, now: number): LimitResult {
    // Get or create bucket
    let bucket = this.tokenBucketData.get(key);

    if (!bucket) {
      // New bucket starts full
      bucket = { tokens: capacity, lastRefill: now };
    }

    // Calculate tokens to add based on elapsed time
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / refillMs);

    // Refill tokens (capped at capacity)
    bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = bucket.lastRefill + tokensToAdd * refillMs;

    // Try to consume one token
    let allowed = false;
    let remaining = bucket.tokens;

    if (bucket.tokens > 0) {
      allowed = true;
      bucket.tokens--;
      remaining = bucket.tokens;
    }

    // Update storage
    this.tokenBucketData.set(key, bucket);

    // Calculate time until next token is available
    const resetMs = bucket.tokens === 0 ? refillMs : 0;

    return { allowed, remaining, resetMs };
  }

  // Cleanup method to remove old data (optional, for memory management)
  cleanup(maxAge: number = 3600000): void {
    // Default 1 hour
    const now = Date.now();
    const cutoff = now - maxAge;

    // Clean sliding window data
    for (const [key, requests] of this.slidingWindowData.entries()) {
      const filtered = requests.filter((timestamp) => timestamp > cutoff);
      if (filtered.length === 0) {
        this.slidingWindowData.delete(key);
      } else {
        this.slidingWindowData.set(key, filtered);
      }
    }

    // Clean fixed window data (remove old windows)
    for (const [key, counter] of this.fixedWindowData.entries()) {
      if (counter.windowStart < cutoff) {
        this.fixedWindowData.delete(key);
      }
    }

    // Clean token bucket data (remove inactive buckets)
    for (const [key, bucket] of this.tokenBucketData.entries()) {
      if (bucket.lastRefill < cutoff) {
        this.tokenBucketData.delete(key);
      }
    }
  }

  // Clear all data (useful for testing)
  clear(): void {
    this.slidingWindowData.clear();
    this.fixedWindowData.clear();
    this.tokenBucketData.clear();
  }
}

// Global storage instance (in production, you might want dependency injection)
const storage = new RateLimiterStorage();

// Export function to clear storage (useful for testing)
export function clearMemoryStorage(): void {
  storage.clear();
}

// Sliding Window Memory Implementation
export async function checkRateLimitWithSlidingWindowMemory({
  key,
  limit,
  windowMs,
  nowMs,
  type,
}: LimitOpts & { type: RateLimitType.SLIDING_WINDOW_MEMORY }): Promise<LimitResult> {
  if (type !== RateLimitType.SLIDING_WINDOW_MEMORY) {
    throw new Error("Invalid type");
  }

  const now = nowMs ?? Date.now();
  return storage.checkSlidingWindow(key, limit, windowMs, now);
}

// Fixed Window Memory Implementation
export async function checkRateLimitWithFixedWindowMemory({
  key,
  limit,
  windowMs,
  nowMs,
  type,
}: LimitOpts & { type: RateLimitType.FIXED_WINDOW_MEMORY }): Promise<LimitResult> {
  if (type !== RateLimitType.FIXED_WINDOW_MEMORY) {
    throw new Error("Invalid type");
  }

  const now = nowMs ?? Date.now();
  return storage.checkFixedWindow(key, limit, windowMs, now);
}

// Token Bucket Memory Implementation
export async function checkRateLimitWithTokenBucketMemory({
  key,
  limit,
  windowMs,
  nowMs,
  type,
}: LimitOpts & { type: RateLimitType.TOKEN_BUCKET_MEMORY }): Promise<LimitResult> {
  if (type !== RateLimitType.TOKEN_BUCKET_MEMORY) {
    throw new Error("Invalid type");
  }

  const now = nowMs ?? Date.now();

  // For token bucket: limit = capacity, windowMs = total refill time
  const capacity = limit;
  const refillMs = Math.max(1, Math.floor(windowMs / limit)); // Time per token

  return storage.checkTokenBucket(key, capacity, refillMs, now);
}

// Unified function for memory-based rate limiting
export async function checkRateLimitByTypeMemory({
  key,
  limit,
  windowMs,
  nowMs,
  type,
}: LimitOpts): Promise<LimitResult> {
  switch (type) {
    case RateLimitType.SLIDING_WINDOW_MEMORY:
      return checkRateLimitWithSlidingWindowMemory({ key, limit, windowMs, nowMs, type });
    case RateLimitType.FIXED_WINDOW_MEMORY:
      return checkRateLimitWithFixedWindowMemory({ key, limit, windowMs, nowMs, type });
    case RateLimitType.TOKEN_BUCKET_MEMORY:
      return checkRateLimitWithTokenBucketMemory({ key, limit, windowMs, nowMs, type });
  }
  throw new Error("Invalid memory rate limit type");
}

// Export storage for testing or advanced usage
export { storage as rateLimiterStorage };
