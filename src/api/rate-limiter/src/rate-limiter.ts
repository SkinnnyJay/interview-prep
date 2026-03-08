import {
  checkRateLimitWithFixedWindowMemory,
  checkRateLimitWithSlidingWindowMemory,
  checkRateLimitWithTokenBucketMemory,
} from "./rateLimited-implemented";
import {
  checkRateLimitWithTokenBucket,
  checkRateLimitWithFixedWindow,
  checkRateLimitWithSlidingWindow,
  LimitOpts,
  LimitResult,
  RateLimitType,
  RateLimitRedisClient,
} from "./rateLimited-redis";

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
    case RateLimitType.SLIDING_WINDOW_MEMORY:
      return checkRateLimitWithSlidingWindowMemory({ key, limit, windowMs, nowMs, type });
    case RateLimitType.FIXED_WINDOW_MEMORY:
      return checkRateLimitWithFixedWindowMemory({ key, limit, windowMs, nowMs, type });
    case RateLimitType.TOKEN_BUCKET_MEMORY:
      return checkRateLimitWithTokenBucketMemory({ key, limit, windowMs, nowMs, type });
    default: {
      const _exhaustive: never = type;
      throw new Error(`Invalid rate limit type: ${_exhaustive}`);
    }
  }
}
