// server.ts - Fastify server with caching endpoints
import Fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import createClient from "ioredis-mock";
import { z } from "zod";
import {
  createCacheManager,
  createMultiLevelCacheManager,
  recommendCacheStrategy,
} from "./cache-manager";
import { CacheStrategy, CacheConfig, MultiLevelCacheConfig, CacheRedisClient } from "./cache-types";
import { HttpStatus } from "./constants";

// ----- Zod schemas for request validation -----
const keyParamsSchema = z.object({ key: z.string().min(1) });

const cacheGetQuerySchema = z.object({
  strategy: z.nativeEnum(CacheStrategy).optional(),
  ttl: z.string().optional().transform((s) => (s ? parseInt(s, 10) : undefined)),
});

const cacheSetBodySchema = z.object({
  value: z.unknown().refine((v) => v !== undefined, { message: "Value is required" }),
  ttl: z.number().optional(),
  strategy: z.nativeEnum(CacheStrategy).optional(),
});

const multiCacheSetBodySchema = z.object({
  value: z.unknown().refine((v) => v !== undefined, { message: "Value is required" }),
  ttl: z.number().optional(),
});

const warmupBodySchema = z.object({
  keys: z.array(z.string().min(1)).min(1, "Keys array is required and must not be empty"),
  ttl: z.number().optional(),
});

const recommendBodySchema = z.object({
  accessPattern: z.enum(["random", "temporal", "frequency", "mixed"]),
  dataSize: z.enum(["small", "medium", "large"]),
  consistency: z.enum(["eventual", "strong"]),
  distribution: z.enum(["single", "distributed"]),
});

const bulkBodySchema = z.object({
  operation: z.enum(["set", "get", "delete"]),
  keys: z.array(z.string().min(1)).min(1),
  values: z.array(z.unknown()).optional(),
  strategy: z.string().optional(),
  ttl: z.number().optional(),
}).refine(
  (data) => {
    if (data.operation === "set") {
      return Array.isArray(data.values) && data.values.length === data.keys.length;
    }
    return true;
  },
  { message: "Values array must match keys array length for set operation" }
);

// Default cache configuration
// Why: Provides sensible defaults for development and testing
const defaultConfig: CacheConfig = {
  strategy: CacheStrategy.LRU_MEMORY,
  maxSize: 1000,
  defaultTtl: 300000, // 5 minutes
  enableStats: true,
  cleanupInterval: 60000, // 1 minute
};

// Multi-level cache configuration
// Why: Demonstrates L1 (memory) + L2 (Redis) caching pattern
const multiLevelConfig: MultiLevelCacheConfig = {
  l1: {
    strategy: CacheStrategy.LRU_MEMORY,
    maxSize: 500,
    defaultTtl: 300000, // 5 minutes
    enableStats: true,
  },
  l2: {
    strategy: CacheStrategy.LRU_REDIS,
    maxSize: 5000,
    defaultTtl: 3600000, // 1 hour
    enableStats: true,
  },
  promoteOnHit: true, // Promote L2 hits to L1 for faster future access
  writeThrough: false, // Write L1 first, L2 asynchronously for better performance
};

/** Create and configure the Fastify app with swagger and routes (no listen). */
export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify app with logging
  // Why: Fastify provides high performance and good TypeScript support
  const app = Fastify({ logger: true });

  await app.register(swagger as unknown as Parameters<typeof app.register>[0], {
    openapi: {
      info: { title: "Caching API", description: "LRU, LFU, TTL and multi-level cache", version: "1.0.0" },
      servers: [{ url: "http://localhost:3002", description: "Development" }],
    },
  });

  // Initialize Redis client (using mock for development)
  // Why: Mock Redis allows testing without external dependencies
  const redis = new createClient() as unknown as CacheRedisClient;
  // Note: Mock Redis doesn't need explicit connection

  // Create cache managers
  // Why: Separate managers allow testing different caching strategies
  const singleLevelCache = createCacheManager(defaultConfig, redis);
  const multiLevelCache = createMultiLevelCacheManager(multiLevelConfig, redis);

  // Health check endpoint
  // Why: Essential for monitoring and load balancer health checks
  app.get("/health", async (req, reply) => {
    return reply.code(HttpStatus.OK).send({
      status: "healthy",
      timestamp: new Date().toISOString(),
      cache: "operational",
    });
  });

  // Single-level cache endpoints
  // Why: Demonstrates basic caching operations with different strategies

  /**
   * Get value from cache
   * Query params: strategy (optional) - override default cache strategy
   */
  app.get<{
    Params: { key: string };
    Querystring: { strategy?: string; ttl?: number };
  }>("/cache/:key", async (req, reply) => {
    const paramsParsed = keyParamsSchema.safeParse(req.params);
    const queryParsed = cacheGetQuerySchema.safeParse(req.query);
    if (!paramsParsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Key is required",
      });
    }
    const { key } = paramsParsed.data;
    const cacheOptions = queryParsed.success && (queryParsed.data.strategy || queryParsed.data.ttl !== undefined)
      ? {
          strategy: queryParsed.data.strategy,
          ttl: queryParsed.data.ttl,
        }
      : undefined;

    try {
      const result = await singleLevelCache.get(key, cacheOptions);

      if (result.hit) {
        return reply.code(HttpStatus.OK).send({
          hit: true,
          value: result.value,
          ttl: result.ttl,
          metadata: result.metadata,
        });
      } else {
        return reply.code(HttpStatus.NOT_FOUND).send({
          hit: false,
          message: "Key not found in cache",
        });
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to retrieve from cache",
      });
    }
  });

  /**
   * Set value in cache
   * Body: { value: any, ttl?: number, strategy?: string }
   */
  app.post<{
    Params: { key: string };
    Body: { value: unknown; ttl?: number; strategy?: string };
  }>("/cache/:key", async (req, reply) => {
    const paramsParsed = keyParamsSchema.safeParse(req.params);
    const bodyParsed = cacheSetBodySchema.safeParse(req.body);
    if (!paramsParsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Key is required",
      });
    }
    if (!bodyParsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: bodyParsed.error.errors.map((e) => e.message).join("; ") || "Value is required",
      });
    }
    const { key } = paramsParsed.data;
    const { value, ttl, strategy } = bodyParsed.data;

    try {
      const cacheOptions = strategy ? { strategy, ttl } : { ttl };
      await singleLevelCache.set(key, value, cacheOptions);

      return reply.code(HttpStatus.CREATED).send({
        success: true,
        key,
        message: "Value cached successfully",
      });
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to store in cache",
      });
    }
  });

  /**
   * Delete value from cache
   */
  app.delete<{
    Params: { key: string };
    Querystring: { strategy?: string };
  }>("/cache/:key", async (req, reply) => {
    const paramsParsed = keyParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Key is required",
      });
    }
    const { key } = paramsParsed.data;
    const queryParsed = z.object({ strategy: z.nativeEnum(CacheStrategy).optional() }).safeParse(req.query);
    const cacheOptions = queryParsed.success && queryParsed.data.strategy
      ? { strategy: queryParsed.data.strategy }
      : undefined;

    try {
      const deleted = await singleLevelCache.delete(key, cacheOptions);

      if (deleted) {
        return reply.code(HttpStatus.OK).send({
          success: true,
          message: "Key deleted successfully",
        });
      } else {
        return reply.code(HttpStatus.NOT_FOUND).send({
          success: false,
          message: "Key not found",
        });
      }
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to delete from cache",
      });
    }
  });

  /**
   * Clear all cache entries
   */
  app.post("/cache/clear", async (req, reply) => {
    try {
      await singleLevelCache.clear();

      return reply.code(HttpStatus.OK).send({
        success: true,
        message: "Cache cleared successfully",
      });
    } catch (error) {
      console.error("Cache clear error:", error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to clear cache",
      });
    }
  });

  /**
   * Get cache statistics
   */
  app.get("/cache/stats", async (req, reply) => {
    try {
      const stats = await singleLevelCache.getStats();

      return reply.code(HttpStatus.OK).send({
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Cache stats error:", error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to retrieve cache statistics",
      });
    }
  });

  // Multi-level cache endpoints
  // Why: Demonstrates advanced caching patterns with L1 + L2 levels

  /**
   * Get value from multi-level cache
   */
  app.get<{
    Params: { key: string };
  }>("/multi-cache/:key", async (req, reply) => {
    const parsed = keyParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Key is required",
      });
    }
    const { key } = parsed.data;

    try {
      const result = await multiLevelCache.get(key);

      if (result.hit) {
        return reply.code(HttpStatus.OK).send({
          hit: true,
          value: result.value,
          ttl: result.ttl,
          metadata: result.metadata,
        });
      } else {
        return reply.code(HttpStatus.NOT_FOUND).send({
          hit: false,
          message: "Key not found in multi-level cache",
        });
      }
    } catch (error) {
      console.error(`Multi-level cache get error for key ${key}:`, error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to retrieve from multi-level cache",
      });
    }
  });

  /**
   * Set value in multi-level cache
   */
  app.post<{
    Params: { key: string };
    Body: { value: unknown; ttl?: number };
  }>("/multi-cache/:key", async (req, reply) => {
    const paramsParsed = keyParamsSchema.safeParse(req.params);
    const bodyParsed = multiCacheSetBodySchema.safeParse(req.body);
    if (!paramsParsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Key is required",
      });
    }
    if (!bodyParsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: bodyParsed.error.errors.map((e) => e.message).join("; ") || "Value is required",
      });
    }
    const { key } = paramsParsed.data;
    const { value, ttl } = bodyParsed.data;

    try {
      await multiLevelCache.set(key, value, { ttl });

      return reply.code(HttpStatus.CREATED).send({
        success: true,
        key,
        message: "Value cached in multi-level cache successfully",
      });
    } catch (error) {
      console.error(`Multi-level cache set error for key ${key}:`, error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to store in multi-level cache",
      });
    }
  });

  /**
   * Get multi-level cache statistics
   */
  app.get("/multi-cache/stats", async (req, reply) => {
    try {
      const stats = await multiLevelCache.getStats();

      return reply.code(HttpStatus.OK).send({
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Multi-level cache stats error:", error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to retrieve multi-level cache statistics",
      });
    }
  });

  /**
   * Warm up L1 cache with hot keys
   */
  app.post<{
    Body: { keys: string[]; ttl?: number };
  }>("/multi-cache/warmup", async (req, reply) => {
    const parsed = warmupBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: parsed.error.errors.map((e) => e.message).join("; ") || "Keys array is required and must not be empty",
      });
    }
    const { keys, ttl } = parsed.data;

    try {
      const warmedUp = await multiLevelCache.warmupL1(keys, { ttl });

      return reply.code(HttpStatus.OK).send({
        success: true,
        warmedUp,
        total: keys.length,
        message: `Warmed up ${warmedUp} out of ${keys.length} keys`,
      });
    } catch (error) {
      console.error("Cache warmup error:", error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "cache_error",
        message: "Failed to warm up cache",
      });
    }
  });

  // Utility endpoints
  // Why: Provide helpful tools for cache management and strategy selection

  /**
   * Get cache strategy recommendation
   */
  app.post<{
    Body: {
      accessPattern: "random" | "temporal" | "frequency" | "mixed";
      dataSize: "small" | "medium" | "large";
      consistency: "eventual" | "strong";
      distribution: "single" | "distributed";
    };
  }>("/cache/recommend", async (req, reply) => {
    const parsed = recommendBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: parsed.error.errors.map((e) => e.message).join("; ") || "All parameters (accessPattern, dataSize, consistency, distribution) are required",
      });
    }
    const { accessPattern, dataSize, consistency, distribution } = parsed.data;

    try {
      const recommendedStrategy = recommendCacheStrategy(
        accessPattern,
        dataSize,
        consistency,
        distribution
      );

      return reply.code(HttpStatus.OK).send({
        recommendation: {
          strategy: recommendedStrategy,
          reasoning: {
            accessPattern,
            dataSize,
            consistency,
            distribution,
          },
        },
      });
    } catch (error) {
      console.error("Strategy recommendation error:", error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "recommendation_error",
        message: "Failed to generate strategy recommendation",
      });
    }
  });

  /**
   * Bulk cache operations for testing
   */
  app.post<{
    Body: {
      operation: "set" | "get" | "delete";
      keys: string[];
      values?: unknown[];
      strategy?: string;
      ttl?: number;
    };
  }>("/cache/bulk", async (req, reply) => {
    const parsed = bulkBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: parsed.error.errors.map((e) => e.message).join("; ") || "Operation and keys array are required",
      });
    }
    const { operation, keys, values, strategy, ttl } = parsed.data;

    try {
      const cacheOptions = strategy
        ? {
            strategy: strategy as CacheStrategy,
            ttl,
          }
        : { ttl };

      const results = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        try {
          switch (operation) {
            case "set": {
              await singleLevelCache.set(key, values![i], cacheOptions);
              results.push({ key, success: true });
              break;
            }
            case "get": {
              const result = await singleLevelCache.get(key, cacheOptions);
              results.push({ key, hit: result.hit, value: result.value });
              break;
            }
            case "delete": {
              const deleted = await singleLevelCache.delete(key, cacheOptions);
              results.push({ key, deleted });
              break;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.push({ key, error: errorMessage });
        }
      }

      return reply.code(HttpStatus.OK).send({
        operation,
        results,
        total: keys.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Bulk cache operation error:", error);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "bulk_operation_error",
        message: "Failed to execute bulk cache operation",
      });
    }
  });

  return app;
}

async function startServer(): Promise<void> {
  const app = await createApp();
  await app.listen({ port: 3002, host: "0.0.0.0" });
  console.warn("🚀 Caching API server started on http://localhost:3002");
}

// Start the server with error handling
// Why: Graceful error handling for server startup failures
startServer().catch((error) => {
  console.error("Failed to start caching server:", error);
  process.exit(1);
});
