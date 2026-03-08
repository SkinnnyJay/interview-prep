// server.ts
import Fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import createClient from "ioredis-mock";
import { z } from "zod";
import { checkRateLimitByType } from "./rate-limiter";
import { RateLimitType, RateLimitRedisClient } from "./rateLimited-redis";
import { HttpStatus } from "./constants";

const config = {
  limit: 100,
  windowMs: 60_000,
  type: RateLimitType.SLIDING_WINDOW_REDIS,
};

const createWidgetBodySchema = z.object({
  name: z.string().min(1, "name is required"),
});

/** Create and configure the Fastify app with swagger and routes (no listen). */
export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(swagger, {
    openapi: {
      info: { title: "Rate Limiter API", description: "Rate-limited widget API", version: "1.0.0" },
      servers: [{ url: "http://localhost:3000", description: "Development" }],
    },
  });

  const redis = new createClient();

  // Rate limit: 100 req / 60s per client key (x-api-key, x-forwarded-for, or IP)
  app.addHook("preHandler", async (req, reply) => {
    const clientKey =
      (req.headers["x-api-key"] as string) || (req.headers["x-forwarded-for"] as string) || req.ip;
    const { limit, windowMs } = config;
    const { allowed, remaining, resetMs } = await checkRateLimitByType(
      redis as RateLimitRedisClient,
      {
        key: clientKey,
        limit,
        windowMs,
        type: config.type,
      }
    );

    reply.header("X-RateLimit-Limit", String(limit));
    reply.header("X-RateLimit-Remaining", String(remaining));
    reply.header("X-RateLimit-Reset", String(Math.ceil(resetMs / 1000)));

    if (!allowed) {
      reply.header("Retry-After", String(Math.ceil(resetMs / 1000)));
      return reply.code(HttpStatus.TOO_MANY_REQUESTS).send({ error: "rate_limited", resetMs });
    }
  });

  app.post("/v1/widgets", async (req, reply) => {
    const parsed = createWidgetBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join("; ") || "invalid_request";
      return reply.code(HttpStatus.BAD_REQUEST).send({ error: "invalid_request", field: "name", message });
    }
    const { name } = parsed.data;

    await new Promise((r) => setTimeout(r, 10));

    return reply.code(HttpStatus.CREATED).send({ id: crypto.randomUUID(), name });
  });

  return app;
}

async function startServer(): Promise<void> {
  const app = await createApp();
  await app.listen({ port: 3000, host: "0.0.0.0" });
}

startServer().catch(console.error);
