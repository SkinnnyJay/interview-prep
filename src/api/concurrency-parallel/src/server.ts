/**
 * Fastify Server for Concurrency vs Parallelism Examples
 *
 * This server provides REST endpoints to demonstrate different
 * concurrency and parallelism patterns in real-world scenarios.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import { ConcurrencyManager } from "./concurrency-manager.js";
import { ParallelManager } from "./parallel-manager.js";
import { ConcurrencyExamples, PerformanceComparison } from "./examples.js";
import { HttpStatus } from "./constants";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ----- Zod schemas for request validation -----
const taskRequestSchema = z.object({
  tasks: z.array(z.object({
    id: z.string().min(1),
    data: z.unknown().optional(),
    priority: z.number().optional(),
  })).min(1, "Tasks array is required"),
  config: z.object({
    maxConcurrent: z.number().int().positive().optional(),
    timeout: z.number().int().positive().optional(),
    workerCount: z.number().int().positive().optional(),
  }).optional(),
});

const computeRequestSchema = z.object({
  type: z.enum(["fibonacci", "prime-check", "compute", "matrix-multiply", "sort-large-array"]),
  data: z.unknown(),
  parallel: z.boolean().optional(),
});

interface TaskRequest {
  tasks: Array<{
    id: string;
    data: unknown;
    priority?: number;
  }>;
  config?: {
    maxConcurrent?: number;
    timeout?: number;
    workerCount?: number;
  };
}

interface ComputeRequest {
  type: "fibonacci" | "prime-check" | "compute" | "matrix-multiply" | "sort-large-array";
  data: unknown;
  parallel?: boolean;
}

const server: FastifyInstance = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

server.register(swagger, {
  openapi: {
    info: { title: "Concurrency & Parallel API", description: "Concurrency and parallelism examples", version: "1.0.0" },
    servers: [{ url: "http://localhost:3008", description: "Development" }],
  },
});

// Register CORS
server.register(cors, {
  origin: true,
  credentials: true,
});

// Global managers
let parallelManager: ParallelManager;
let examples: ConcurrencyExamples;

/**
 * Health check endpoint
 */
server.get("/health", async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "concurrency-parallel-examples",
  };
});

/**
 * Get service information and available endpoints
 */
server.get("/", async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    service: "Concurrency vs Parallelism Examples",
    description: "Demonstrates different approaches to concurrent and parallel processing",
    endpoints: {
      "GET /": "Service information",
      "GET /health": "Health check",
      "POST /concurrent/all": "Execute tasks concurrently (Promise.all)",
      "POST /concurrent/limited": "Execute tasks with limited concurrency",
      "POST /concurrent/priority": "Execute tasks with priority queue",
      "POST /concurrent/sequential": "Execute tasks sequentially",
      "POST /concurrent/batched": "Execute tasks in batches",
      "POST /parallel/compute": "Execute CPU-intensive tasks in parallel",
      "POST /parallel/batch": "Process large datasets in parallel chunks",
      "GET /examples/api-calls": "Demonstrate concurrent API calls",
      "GET /examples/math-computations": "Demonstrate parallel math computations",
      "GET /examples/database-ops": "Demonstrate database operations with limited concurrency",
      "GET /examples/file-processing": "Demonstrate hybrid file processing",
      "GET /examples/priority-queue": "Demonstrate priority queue processing",
      "GET /examples/all": "Run all examples",
      "GET /performance/compare": "Compare different execution approaches",
    },
    concepts: {
      concurrency: "Multiple tasks making progress, but not necessarily simultaneously (I/O-bound)",
      parallelism: "Multiple tasks executing simultaneously on different cores (CPU-bound)",
      "use-cases": {
        concurrency: ["API calls", "Database queries", "File I/O", "Network operations"],
        parallelism: [
          "Mathematical computations",
          "Image processing",
          "Data transformation",
          "CPU-intensive algorithms",
        ],
      },
    },
  };
});

/**
 * Execute tasks concurrently using Promise.all
 * Best for: Independent I/O-bound tasks that can all start immediately
 */
server.post<{ Body: TaskRequest }>("/concurrent/all", async (request, reply) => {
  const parsed = taskRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Tasks array is required",
    });
  }
  const { tasks, config } = parsed.data;

  try {
    const manager = new ConcurrencyManager({
      maxConcurrent: config?.maxConcurrent || 10,
      timeout: config?.timeout || 30000,
    });

    // Simulate task processor
    const processor = async (task: {
      id: string;
      data?: { delay?: number };
    }): Promise<{ taskId: string; result: string; processedAt: string }> => {
      const delay = (task.data as { delay?: number } | undefined)?.delay ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return {
        taskId: task.id,
        result: `Processed task ${task.id}`,
        processedAt: new Date().toISOString(),
      };
    };

    const startTime = Date.now();
    const typedTasks = tasks as Array<{ id: string; data?: { delay?: number } }>;
    const results = await manager.executeAllConcurrent(typedTasks, processor);
    const executionTime = Date.now() - startTime;
    const metrics = manager.getPerformanceMetrics();

    return {
      success: true,
      results,
      executionTime,
      metrics,
      approach: "concurrent-all",
    };
  } catch (error) {
    server.log.error(`Concurrent execution failed: ${(error as Error).message}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Concurrent execution failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Execute tasks with limited concurrency
 * Best for: Controlling resource usage while maintaining good throughput
 */
server.post<{ Body: TaskRequest }>("/concurrent/limited", async (request, reply) => {
  const parsed = taskRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Tasks array is required",
    });
  }
  const { tasks, config } = parsed.data;

  try {
    const manager = new ConcurrencyManager({
      maxConcurrent: config?.maxConcurrent || 3,
      timeout: config?.timeout || 30000,
    });

    const processor = async (task: {
      id: string;
      data?: { delay?: number };
    }): Promise<{ taskId: string; result: string; processedAt: string }> => {
      const delay = (task.data as { delay?: number } | undefined)?.delay ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return {
        taskId: task.id,
        result: `Limited concurrent processing of task ${task.id}`,
        processedAt: new Date().toISOString(),
      };
    };

    const startTime = Date.now();
    const typedTasks = tasks as Array<{ id: string; data?: { delay?: number } }>;
    const results = await manager.executeLimitedConcurrent(typedTasks, processor);
    const executionTime = Date.now() - startTime;
    const metrics = manager.getPerformanceMetrics();

    return {
      success: true,
      results,
      executionTime,
      metrics,
      approach: "limited-concurrent",
      maxConcurrent: config?.maxConcurrent || 3,
    };
  } catch (error) {
    server.log.error(`Limited concurrent execution failed: ${(error as Error).message}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Limited concurrent execution failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Execute tasks with priority queue
 * Best for: When tasks have different importance levels
 */
server.post<{ Body: TaskRequest }>("/concurrent/priority", async (request, reply) => {
  const parsed = taskRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Tasks array is required",
    });
  }
  const { tasks, config } = parsed.data;

  try {
    const manager = new ConcurrencyManager({
      maxConcurrent: config?.maxConcurrent || 3,
      timeout: config?.timeout || 30000,
    });

    const processor = async (task: {
      id: string;
      data?: { delay?: number };
      priority?: number;
    }): Promise<{
      taskId: string;
      result: string;
      processedAt: string;
      priority: number;
    }> => {
      const delay = (task.data as { delay?: number } | undefined)?.delay ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return {
        taskId: task.id,
        result: `Priority processed task ${task.id} (priority: ${task.priority ?? 0})`,
        processedAt: new Date().toISOString(),
        priority: task.priority ?? 0,
      };
    };

    const startTime = Date.now();
    const typedTasks = tasks as Array<{ id: string; data?: { delay?: number }; priority?: number }>;
    const results = await manager.executePriorityQueue(typedTasks, processor);
    const executionTime = Date.now() - startTime;
    const metrics = manager.getPerformanceMetrics();

    return {
      success: true,
      results,
      executionTime,
      metrics,
      approach: "priority-queue",
    };
  } catch (error) {
    server.log.error(`Priority queue execution failed: ${(error as Error).message}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Priority queue execution failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Execute CPU-intensive tasks in parallel using worker threads
 * Best for: Mathematical computations, data processing, CPU-bound operations
 */
server.post<{ Body: ComputeRequest }>("/parallel/compute", async (request, reply) => {
  const parsed = computeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Type and data are required",
    });
  }
  const { type, data, parallel = true } = parsed.data;

  try {
    if (parallel) {
      // Use parallel processing with worker threads
      if (!parallelManager) {
        parallelManager = new ParallelManager({ workerCount: 4 });
        const workerScript = join(__dirname, "worker.js");
        await parallelManager.initializeWorkers(workerScript);
      }

      const startTime = Date.now();
      const results = await parallelManager.executeParallel([{ type, data }], type);
      const executionTime = Date.now() - startTime;
      const metrics = parallelManager.getPerformanceMetrics();

      return {
        success: true,
        results: results[0],
        executionTime,
        metrics,
        approach: "parallel-workers",
      };
    } else {
      // Use sequential processing for comparison
      const startTime = Date.now();

      // Simulate the computation (simplified version)
      let result;
      const dataObj = data as Record<string, unknown>;
      switch (type) {
        case "fibonacci":
          result = { result: "Sequential fibonacci result", n: dataObj.n };
          break;
        case "prime-check":
          result = {
            isPrime: (dataObj.number as number) % 2 !== 0,
            number: dataObj.number,
          };
          break;
        default:
          result = { computed: "Sequential computation", input: data };
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        results: result,
        executionTime,
        approach: "sequential",
      };
    }
  } catch (error) {
    server.log.error(`Parallel computation failed: ${(error as Error).message}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Parallel computation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Example endpoints that run predefined demonstrations
 */
server.get("/examples/api-calls", async (request, reply) => {
  try {
    if (!examples) examples = new ConcurrencyExamples();
    await examples.demonstrateApiCalls();
    return { success: true, message: "API calls example completed - check server logs" };
  } catch (error) {
    return reply
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: "Example failed", message: String(error) });
  }
});

server.get("/examples/math-computations", async (request, reply) => {
  try {
    if (!examples) examples = new ConcurrencyExamples();
    await examples.demonstrateMathComputations();
    return { success: true, message: "Math computations example completed - check server logs" };
  } catch (error) {
    return reply
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: "Example failed", message: String(error) });
  }
});

server.get("/examples/database-ops", async (request, reply) => {
  try {
    if (!examples) examples = new ConcurrencyExamples();
    await examples.demonstrateDatabaseOperations();
    return { success: true, message: "Database operations example completed - check server logs" };
  } catch (error) {
    return reply
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: "Example failed", message: String(error) });
  }
});

server.get("/examples/file-processing", async (request, reply) => {
  try {
    if (!examples) examples = new ConcurrencyExamples();
    await examples.demonstrateFileProcessing();
    return { success: true, message: "File processing example completed - check server logs" };
  } catch (error) {
    return reply
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: "Example failed", message: String(error) });
  }
});

server.get("/examples/priority-queue", async (request, reply) => {
  try {
    if (!examples) examples = new ConcurrencyExamples();
    await examples.demonstratePriorityQueue();
    return { success: true, message: "Priority queue example completed - check server logs" };
  } catch (error) {
    return reply
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: "Example failed", message: String(error) });
  }
});

server.get("/examples/all", async (request, reply) => {
  try {
    if (!examples) examples = new ConcurrencyExamples();
    await examples.runAllExamples();
    return { success: true, message: "All examples completed - check server logs" };
  } catch (error) {
    return reply
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: "Examples failed", message: String(error) });
  }
});

server.get("/performance/compare", async (request, reply) => {
  try {
    await PerformanceComparison.compareApproaches();
    return { success: true, message: "Performance comparison completed - check server logs" };
  } catch (error) {
    return reply
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ error: "Performance comparison failed", message: String(error) });
  }
});

/**
 * Graceful shutdown handling
 */
const gracefulShutdown = async (): Promise<void> => {
  server.log.info("Shutting down gracefully...");

  try {
    if (parallelManager) {
      await parallelManager.cleanup();
    }
    await server.close();
    process.exit(0);
  } catch (error) {
    server.log.error(`Error during shutdown: ${(error as Error).message}`);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

/**
 * Start the server
 */
const start = async (): Promise<void> => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3008;
    const host = process.env.HOST || "0.0.0.0";

    await server.listen({ port, host });

    server.log.info(
      `🚀 Concurrency vs Parallelism Examples server running on http://${host}:${port}`
    );
    server.log.info(`📚 Visit http://localhost:${port} for API documentation`);
    server.log.info("🔧 Available examples:");
    server.log.info("  • GET /examples/api-calls - Concurrent API calls");
    server.log.info("  • GET /examples/math-computations - Parallel math computations");
    server.log.info(
      "  • GET /examples/database-ops - Database operations with limited concurrency"
    );
    server.log.info("  • GET /examples/file-processing - Hybrid file processing");
    server.log.info("  • GET /examples/priority-queue - Priority queue processing");
    server.log.info("  • GET /examples/all - Run all examples");
    server.log.info("  • GET /performance/compare - Performance comparison");
  } catch (error) {
    server.log.error(`Failed to start server: ${(error as Error).message}`);
    process.exit(1);
  }
};

/** Create and configure the Fastify app (no listen). Used for OpenAPI generation. */
export async function createApp(): Promise<FastifyInstance> {
  return server;
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export default server;
