// rateLimiter-redis.ts

// Redis client interface for rate limiting operations
export interface RateLimitRedisClient {
  eval(script: string, numkeys: number, ...args: string[]): Promise<[number, number, number]>;
}

export interface LimitOpts {
  key: string; // per-client key (e.g., API key or IP)
  limit: number; // e.g., 100
  windowMs: number; // e.g., 60_000
  nowMs?: number; // for tests
  type: RateLimitType; // sliding window or fixed window
}

export interface LimitResult {
  allowed: boolean;
  remaining: number; // how many left in window
  resetMs: number; // ms until window fully clears
}
export enum RateLimitType {
  // Redis-based implementations using Lua scripts (limit=10, windowMs=1000 => 10 req/1000ms)
  SLIDING_WINDOW_REDIS = "sliding-window-redis",
  FIXED_WINDOW_REDIS = "fixed-window-redis",
  TOKEN_BUCKET_REDIS = "token-bucket-redis",

  // In-memory implementations (no Redis required)
  SLIDING_WINDOW_MEMORY = "sliding-window-memory",
  FIXED_WINDOW_MEMORY = "fixed-window-memory",
  TOKEN_BUCKET_MEMORY = "token-bucket-memory",
}

// Sliding window: sorted set for rolling window. Accurate; more work per request than fixed window.
const SLIDING_WINDOW_LUA = `
-- KEYS[1] = key      ARGV[1]=now  ARGV[2]=winMs  ARGV[3]=limit
local k   = KEYS[1]
local now = tonumber(ARGV[1])
local win = tonumber(ARGV[2])
local lim = tonumber(ARGV[3])
local start = now - win

redis.call('ZREMRANGEBYSCORE', k, 0, start)            -- prune old hits
redis.call('ZADD', k, now, tostring(now))              -- add this hit
local count = tonumber(redis.call('ZCARD', k))         -- current count
redis.call('PEXPIRE', k, win)                          -- housekeeping TTL

local oldestPair = redis.call('ZRANGE', k, 0, 0, 'WITHSCORES')
local oldest = oldestPair and #oldestPair >= 2 and tonumber(oldestPair[2]) or now
local resetMs = math.max(0, oldest + win - now)

local allowed = (count <= lim) and 1 or 0
local remaining = math.max(0, lim - count)
return { allowed, remaining, resetMs }
`;

// Fixed window: counter per calendar window. Simple and fast; allows 2× burst at window boundaries.
const FIXED_WINDOW_LUA = `
-- KEYS[1] = key      ARGV[1]=now  ARGV[2]=winMs  ARGV[3]=limit
local k   = KEYS[1]
local now = tonumber(ARGV[1])
local win = tonumber(ARGV[2])
local lim = tonumber(ARGV[3])

-- Calculate current window start time
local windowStart = math.floor(now / win) * win
local windowEnd = windowStart + win
local windowKey = k .. ':' .. windowStart

-- Get current count for this window
local count = tonumber(redis.call('GET', windowKey) or 0)

-- Increment counter
count = count + 1
redis.call('SET', windowKey, count)
redis.call('PEXPIRE', windowKey, win)

-- Calculate reset time (time until current window ends)
local resetMs = windowEnd - now

local allowed = (count <= lim) and 1 or 0
local remaining = math.max(0, lim - count)
return { allowed, remaining, resetMs }
`;

// Token bucket: tokens refill over time. Smooth bursts, tunable; slightly more state than window counters.
const TOKEN_BUCKET_LUA = `
-- KEYS[1] = key      ARGV[1]=now  ARGV[2]=refillMs  ARGV[3]=capacity
local k   = KEYS[1]
local now = tonumber(ARGV[1])
local refillMs = tonumber(ARGV[2])  -- time to refill one token
local capacity = tonumber(ARGV[3])  -- max tokens (burst capacity)

-- Get current bucket state
local bucketData = redis.call('HMGET', k, 'tokens', 'lastRefill')
local tokens = tonumber(bucketData[1]) or capacity
local lastRefill = tonumber(bucketData[2]) or now

-- Calculate tokens to add based on time elapsed
local timePassed = now - lastRefill
local tokensToAdd = math.floor(timePassed / refillMs)

-- Refill tokens (capped at capacity)
tokens = math.min(capacity, tokens + tokensToAdd)
local newLastRefill = lastRefill + (tokensToAdd * refillMs)

-- Try to consume one token
local allowed = 0
local remaining = tokens
if tokens > 0 then
  allowed = 1
  tokens = tokens - 1
  remaining = tokens
end

-- Update bucket state
redis.call('HMSET', k, 'tokens', tokens, 'lastRefill', newLastRefill)
redis.call('PEXPIRE', k, refillMs * capacity * 2) -- TTL for cleanup

-- Calculate time until next token is available
local resetMs = (tokens == 0) and refillMs or 0

return { allowed, remaining, resetMs }
`;

export async function checkRateLimitWithSlidingWindow(
  redis: RateLimitRedisClient,
  { key, limit, windowMs, nowMs, type }: LimitOpts & { type: RateLimitType.SLIDING_WINDOW_REDIS }
): Promise<LimitResult> {
  if (type !== RateLimitType.SLIDING_WINDOW_REDIS) {
    throw new Error("Invalid type");
  }

  const now = nowMs ?? Date.now();
  const redisKey = `rl:${key}:sliding`;

  const [allowed, remaining, resetMs] = (await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    redisKey,
    String(now),
    String(windowMs),
    String(limit)
  )) as [number, number, number];

  return { allowed: !!allowed, remaining, resetMs };
}

export async function checkRateLimitWithFixedWindow(
  redis: RateLimitRedisClient,
  { key, limit, windowMs, nowMs, type }: LimitOpts & { type: RateLimitType.FIXED_WINDOW_REDIS }
): Promise<LimitResult> {
  if (type !== RateLimitType.FIXED_WINDOW_REDIS) {
    throw new Error("Invalid type");
  }

  const now = nowMs ?? Date.now();
  const redisKey = `rl:${key}:fixed`;

  const [allowed, remaining, resetMs] = (await redis.eval(
    FIXED_WINDOW_LUA,
    1,
    redisKey,
    String(now),
    String(windowMs),
    String(limit)
  )) as [number, number, number];

  return { allowed: !!allowed, remaining, resetMs };
}

export async function checkRateLimitWithTokenBucket(
  redis: RateLimitRedisClient,
  { key, limit, windowMs, nowMs, type }: LimitOpts & { type: RateLimitType.TOKEN_BUCKET_REDIS }
): Promise<LimitResult> {
  if (type !== RateLimitType.TOKEN_BUCKET_REDIS) {
    throw new Error("Invalid type");
  }

  const now = nowMs ?? Date.now();
  const redisKey = `rl:${key}:token-bucket`;

  // For token bucket: limit = capacity, windowMs = refill time per token
  // Example: limit=10, windowMs=1000 means 10 tokens max, 1 token per second
  const capacity = limit;
  const refillMs = Math.max(1, Math.floor(windowMs / limit)); // Time to refill one token

  const [allowed, remaining, resetMs] = (await redis.eval(
    TOKEN_BUCKET_LUA,
    1,
    redisKey,
    String(now),
    String(refillMs),
    String(capacity)
  )) as [number, number, number];

  return { allowed: !!allowed, remaining, resetMs };
}

export async function checkRateLimitByType(
  redis: RateLimitRedisClient,
  { key, limit, windowMs, nowMs, type }: LimitOpts
): Promise<LimitResult> {
  switch (type) {
    case RateLimitType.SLIDING_WINDOW_REDIS:
      return checkRateLimitWithSlidingWindow(redis, { key, limit, windowMs, nowMs, type });
    case RateLimitType.FIXED_WINDOW_REDIS:
      return checkRateLimitWithFixedWindow(redis, { key, limit, windowMs, nowMs, type });
    case RateLimitType.TOKEN_BUCKET_REDIS:
      return checkRateLimitWithTokenBucket(redis, { key, limit, windowMs, nowMs, type });
  }
  throw new Error("Invalid Redis rate limit type");
}
