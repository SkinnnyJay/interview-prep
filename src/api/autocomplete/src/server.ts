/**
 * Fastify Server for Autocomplete API
 *
 * This server provides a complete REST API for the autocomplete system,
 * including search endpoints, admin functionality, analytics, and health monitoring.
 *
 * Features:
 * - RESTful autocomplete endpoints
 * - Real-time search with debouncing
 * - Admin endpoints for data management
 * - Analytics and monitoring
 * - Health checks and metrics
 * - Static file serving for frontend
 */

// Helper function to extract error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import fastifyStatic from "@fastify/static";
import { AutocompleteService } from "./autocomplete-service.js";
import { AutocompleteRequest, AutocompleteItem, AutocompleteConfig, DataSource } from "./types.js";
import { HttpStatus } from "./constants";
import { z } from "zod";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ESM/CommonJS compatible __dirname
declare const __filename: string | undefined;
declare const __dirname: string | undefined;

const currentFilename =
  typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : dirname(currentFilename);

// ----- Zod schemas for request validation -----
const searchQuerySchema = z.object({
  q: z.string().min(1, "Query parameter 'q' is required and cannot be empty").transform((s) => s.trim()),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  fuzzy: z.coerce.boolean().optional(),
  threshold: z.coerce.number().min(0).max(1).optional(),
});

const suggestionsQuerySchema = z.object({
  q: z.string().min(2, "Query parameter 'q' is required and must be at least 2 characters").transform((s) => s.trim()),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const autocompleteItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
  score: z.number().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}).transform((data) => ({
  ...data,
  createdAt: data.createdAt ?? new Date(),
  updatedAt: data.updatedAt ?? new Date(),
}));

const addItemsBodySchema = z.object({
  items: z.array(autocompleteItemSchema).min(1, "Items array is required and cannot be empty"),
});

const removeItemsBodySchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1, "itemIds array is required and cannot be empty"),
});

const updateConfigBodySchema = z.object({
  config: z.record(z.unknown()).refine(
    (obj) => obj !== null && typeof obj === "object" && Object.keys(obj).length > 0,
    { message: "Configuration object is required" }
  ),
});

// Request/Response interfaces for API endpoints (kept for typing)
interface SearchQuery {
  q: string;
  limit?: number;
  category?: string;
  tags?: string;
  fuzzy?: boolean;
  threshold?: number;
}

interface SuggestionsQuery {
  q: string;
  limit?: number;
}

interface AddItemsBody {
  items: AutocompleteItem[];
}

interface RemoveItemsBody {
  itemIds: string[];
}

interface UpdateConfigBody {
  config: Partial<AutocompleteConfig>;
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

// Type assertion: @fastify/swagger and Fastify 5 generics mismatch (see FastifyInstance vs swaggerCSP)
server.register(swagger as unknown as Parameters<FastifyInstance["register"]>[0], {
  openapi: {
    info: { title: "Autocomplete API", description: "REST autocomplete and admin", version: "1.0.0" },
    servers: [{ url: "http://localhost:3006", description: "Development" }],
  },
});

// Global autocomplete service instance
let autocompleteService: AutocompleteService;

// Register CORS for frontend integration
server.register(cors, {
  origin: true,
  credentials: true,
});

// Serve static files for frontend demo
server.register(fastifyStatic, {
  root: join(currentDirname, "../frontend/dist"),
  prefix: "/demo/",
});

/**
 * Root endpoint - API documentation
 */
server.get("/", async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    service: "Autocomplete API",
    version: "1.0.0",
    description: "Advanced autocomplete system with fuzzy search, caching, and analytics",
    endpoints: {
      // Search endpoints
      "GET /search": "Perform autocomplete search",
      "GET /suggestions": "Get query suggestions",

      // Data management
      "POST /items": "Add new items to search index",
      "DELETE /items": "Remove items from search index",
      "POST /rebuild-index": "Rebuild search index from data sources",

      // Analytics and monitoring
      "GET /analytics": "Get search analytics and performance metrics",
      "GET /health": "Health check and system status",
      "GET /stats": "Get detailed system statistics",

      // Configuration
      "PUT /config": "Update service configuration",
      "GET /config": "Get current configuration",

      // Frontend demo
      "GET /demo/": "Interactive autocomplete demo",
    },
    documentation: {
      search: {
        description: "Search for items using fuzzy matching",
        parameters: {
          q: "Search query (required)",
          limit: "Maximum results (default: 10, max: 100)",
          category: "Filter by category",
          tags: "Filter by tags (comma-separated)",
          fuzzy: "Enable fuzzy matching (default: true)",
          threshold: "Fuzzy match threshold 0-1 (default: 0.3)",
        },
        example: "/search?q=javascript&limit=5&category=technology",
      },
      suggestions: {
        description: "Get query suggestions for autocomplete",
        parameters: {
          q: "Partial query (required)",
          limit: "Maximum suggestions (default: 5)",
        },
        example: "/suggestions?q=java&limit=3",
      },
    },
  };
});

/**
 * Health check endpoint
 */
server.get("/health", async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const health = await autocompleteService.getHealthStatus();

    const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

    return reply.code(statusCode).send({
      status: health.status,
      timestamp: new Date().toISOString(),
      service: "autocomplete-api",
      ...health.details,
    });
  } catch (error) {
    return reply.code(HttpStatus.SERVICE_UNAVAILABLE).send({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: getErrorMessage(error),
    });
  }
});

/**
 * Main search endpoint
 * GET /search?q=query&limit=10&category=tech&tags=javascript,node
 */
server.get<{ Querystring: SearchQuery }>("/search", async (request, reply) => {
  const parsed = searchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Validation failed",
      example: "/search?q=javascript",
    });
  }
  const { q, limit, category, tags, fuzzy, threshold } = parsed.data;

  try {
    const parsedTags = tags ? tags.split(",").map((tag) => tag.trim()) : undefined;
    const searchRequest: AutocompleteRequest = {
      query: q,
      limit: limit ?? 10,
      category: category || undefined,
      tags: parsedTags,
      fuzzy: fuzzy !== false,
      threshold,
    };

    const startTime = Date.now();
    const response = await autocompleteService.search(searchRequest);
    const apiExecutionTime = Date.now() - startTime;

    // Add API-level metadata
    const apiResponse = {
      ...response,
      metadata: {
        ...response.metadata,
        apiExecutionTime,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    };

    server.log.info(
      `Search completed: "${q}" -> ${response.results.length} results in ${apiExecutionTime}ms`
    );

    return apiResponse;
  } catch (error) {
    server.log.error(`Search failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Search operation failed",
      message: getErrorMessage(error),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Suggestions endpoint for autocomplete dropdown
 * GET /suggestions?q=partial&limit=5
 */
server.get<{ Querystring: SuggestionsQuery }>("/suggestions", async (request, reply) => {
  const parsed = suggestionsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Validation failed",
      example: "/suggestions?q=java",
    });
  }
  const { q, limit } = parsed.data;

  try {
    const suggestions = await autocompleteService.getSuggestions(
      q,
      limit ?? 5
    );

    return {
      query: q,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    server.log.error(`Suggestions failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Suggestions operation failed",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Add items to search index
 * POST /items
 */
server.post<{ Body: AddItemsBody }>("/items", async (request, reply) => {
  const parsed = addItemsBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Validation failed",
      example: {
        items: [
          {
            id: "item-1",
            title: "Example Item",
            description: "An example item for demonstration",
            category: "Example",
            tags: ["example", "demo"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });
  }
  const { items } = parsed.data;

  try {
    await autocompleteService.addItems(items as AutocompleteItem[]);

    server.log.info(`Added ${items.length} items to search index`);

    return {
      success: true,
      message: `Successfully added ${items.length} items to search index`,
      itemIds: items.map((item) => item.id),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    server.log.error(`Add items failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Failed to add items",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Remove items from search index
 * DELETE /items
 */
server.delete<{ Body: RemoveItemsBody }>("/items", async (request, reply) => {
  const parsed = removeItemsBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Validation failed",
      example: { itemIds: ["item-1", "item-2"] },
    });
  }
  const { itemIds } = parsed.data;

  try {
    await autocompleteService.removeItems(itemIds);

    server.log.info(`Removed ${itemIds.length} items from search index`);

    return {
      success: true,
      message: `Successfully removed ${itemIds.length} items from search index`,
      removedIds: itemIds,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    server.log.error(`Remove items failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Failed to remove items",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Rebuild search index
 * POST /rebuild-index
 */
server.post("/rebuild-index", async (_request, reply) => {
  try {
    const startTime = Date.now();
    await autocompleteService.rebuildIndex();
    const rebuildTime = Date.now() - startTime;

    server.log.info(`Search index rebuilt in ${rebuildTime}ms`);

    return {
      success: true,
      message: "Search index rebuilt successfully",
      rebuildTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    server.log.error(`Index rebuild failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Failed to rebuild search index",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Get analytics and performance metrics
 * GET /analytics
 */
server.get("/analytics", async (_request, reply) => {
  try {
    const analytics = autocompleteService.getAnalytics();
    const cacheStats = await analytics.cache;

    return {
      timestamp: new Date().toISOString(),
      search: analytics.search,
      cache: cacheStats,
      service: analytics.service,
    };
  } catch (error) {
    server.log.error(`Analytics failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Failed to get analytics",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Get detailed system statistics
 * GET /stats
 */
server.get("/stats", async (_request, reply) => {
  try {
    const health = await autocompleteService.getHealthStatus();
    const analytics = autocompleteService.getAnalytics();
    const cacheStats = await analytics.cache;

    return {
      timestamp: new Date().toISOString(),
      system: {
        status: health.status,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
      service: {
        ...health.details,
        ...analytics.service,
      },
      search: {
        indexStats: analytics.search.indexStats,
        performanceMetrics: analytics.search.performanceMetrics,
      },
      cache: cacheStats,
    };
  } catch (error) {
    server.log.error(`Stats failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Failed to get system statistics",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Update service configuration
 * PUT /config
 */
server.put<{ Body: UpdateConfigBody }>("/config", async (request, reply) => {
  const parsed = updateConfigBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: parsed.error.errors.map((e) => e.message).join("; ") || "Configuration object is required",
      example: {
        config: {
          api: { debounceMs: 500 },
          search: { threshold: 0.4 },
        },
      },
    });
  }
  const { config } = parsed.data;

  try {
    autocompleteService.updateConfig(config as Partial<AutocompleteConfig>);

    server.log.info("Service configuration updated");

    return {
      success: true,
      message: "Configuration updated successfully",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    server.log.error(`Config update failed: ${getErrorMessage(error)}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Failed to update configuration",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Get current configuration
 * GET /config
 */
server.get("/config", async (_request, reply) => {
  try {
    // Return sanitized config (without sensitive data)
    return {
      api: {
        defaultLimit: 10,
        maxLimit: 100,
        debounceMs: 300,
      },
      search: {
        threshold: 0.3,
        minMatchCharLength: 2,
      },
      cache: {
        enabled: true,
        ttl: 300,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: "Failed to get configuration",
      message: getErrorMessage(error),
    });
  }
});

/**
 * Initialize the autocomplete service with sample data
 */
async function initializeService(): Promise<void> {
  // Default configuration
  const config: AutocompleteConfig = {
    search: {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "description", weight: 0.3 },
        { name: "tags", weight: 0.2 },
        { name: "category", weight: 0.1 },
      ],
      threshold: 0.3,
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: true,
      location: 0,
      ignoreLocation: false,
      ignoreFieldNorm: false,
    },
    cache: {
      enabled: true,
      ttl: 300, // 5 minutes
      maxSize: 1000,
      keyPrefix: "autocomplete",
    },
    index: {
      rebuildInterval: 60000, // 1 minute
      batchSize: 100,
      enableBackgroundUpdates: true,
    },
    api: {
      defaultLimit: 10,
      maxLimit: 100,
      debounceMs: 0, // No server-side debounce; each request is a distinct user action
      enableAnalytics: true,
    },
  };

  // Sample data sources
  const dataSources: DataSource[] = [
    {
      id: "static-tech",
      name: "Technology Terms",
      type: "static",
      config: { data: [] },
      itemCount: 0,
    },
    {
      id: "file-products",
      name: "Product Catalog",
      type: "file",
      config: { filePath: "./data/products.json", format: "json" },
      itemCount: 0,
    },
    {
      id: "api-companies",
      name: "Company Directory",
      type: "api",
      config: { url: "https://api.example.com/companies" },
      itemCount: 0,
    },
  ];

  // Initialize service
  autocompleteService = new AutocompleteService(config);
  await autocompleteService.initialize(dataSources);

  server.log.info("✅ Autocomplete service initialized with sample data");
}

/**
 * Graceful shutdown handling
 */
const gracefulShutdown = async (): Promise<void> => {
  server.log.info("Shutting down gracefully...");

  try {
    if (autocompleteService) {
      await autocompleteService.shutdown();
    }
    await server.close();
    process.exit(0);
  } catch (error) {
    server.log.error(`Error during shutdown: ${getErrorMessage(error)}`);
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
    // Initialize autocomplete service first
    await initializeService();

    const port = process.env.PORT ? parseInt(process.env.PORT) : 3006;
    const host = process.env.HOST || "0.0.0.0";

    await server.listen({ port, host });

    server.log.info(`🚀 Autocomplete API server running on http://${host}:${port}`);
    server.log.info(`📚 API Documentation: http://localhost:${port}`);
    server.log.info(`🎮 Interactive Demo: http://localhost:${port}/demo/`);
    server.log.info(`📊 Health Check: http://localhost:${port}/health`);
    server.log.info(`📈 Analytics: http://localhost:${port}/analytics`);
    server.log.info("");
    server.log.info("🔍 Example searches:");
    server.log.info(`  • http://localhost:${port}/search?q=javascript`);
    server.log.info(`  • http://localhost:${port}/search?q=react&limit=5`);
    server.log.info(`  • http://localhost:${port}/suggestions?q=java`);
  } catch (error) {
    server.log.error(`Failed to start server: ${getErrorMessage(error)}`);
    process.exit(1);
  }
};

/** Create and configure the Fastify app (no listen). Used for OpenAPI generation. */
export async function createApp(): Promise<FastifyInstance> {
  await initializeService();
  return server;
}

// Start server if this file is run directly
// Check for CommonJS (require.main) or ESM (import.meta) entry point
const isMainModule =
  (typeof require !== "undefined" && require.main === module) ||
  (typeof import.meta !== "undefined" && import.meta.url === `file://${process.argv[1]}`);

if (isMainModule) {
  start();
}

export default server;
