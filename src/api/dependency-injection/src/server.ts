// server.ts - Fastify server demonstrating comprehensive dependency injection patterns
import Fastify, {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import swagger from "@fastify/swagger";
import diPlugin, { createDIRoute, DIMiddleware } from "./fastify-integration";
import { DefaultServiceContainer } from "./service-container";
import { ServiceLifetime, ServiceContext } from "./di-types";
import { HttpStatus } from "./constants";
import { z } from "zod";
import {
  AppConfigurationService,
  AppLoggerService,
  InMemoryCacheService,
  UserRepository,
  UserService,
  NotificationService,
  User,
} from "./example-services";

// Server configuration
// Why: Centralized configuration for DI behavior
const serverConfig = {
  port: 3004,
  host: "0.0.0.0",
  di: {
    enableRequestScoping: true,
    enableHealthChecks: true,
    enableMetrics: true,
    configuration: {
      enableAutoRegistration: true,
      enableCircularDependencyDetection: true,
      enableLifecycleLogging: true,
      enablePerformanceTracking: true,
      maxResolutionDepth: 50,
      scopeTimeout: 30000,
    },
  },
};

// ----- Zod schemas for request validation -----
const idParamsSchema = z.object({ id: z.string().min(1) });
const createUserBodySchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});
const updateUserBodySchema = z.record(z.unknown()).optional();
const testResolveBodySchema = z.object({
  serviceName: z.string().min(1, "serviceName is required"),
  context: z.record(z.unknown()).optional(),
});

/** Create and configure the Fastify app with swagger and routes (no listen). */
export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify app with comprehensive configuration
  // Why: Fastify provides excellent performance and TypeScript support
  // Use simple logger when generating OpenAPI to avoid pino-pretty transport resolution
  const app = Fastify({
    logger: process.env.OPENAPI_GEN
      ? { level: "silent" }
      : {
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
    requestIdLogLabel: "requestId",
    requestIdHeader: "x-request-id",
  });

  await app.register(swagger, {
    openapi: {
      info: { title: "Dependency Injection API", description: "DI container and patterns", version: "1.0.0" },
      servers: [{ url: "http://localhost:3004", description: "Development" }],
    },
  });

  // Create and configure DI container
  // Why: Demonstrates manual service registration and configuration
  const container = new DefaultServiceContainer(serverConfig.di.configuration);

  // Decorate root app so preHandler (requireServices) can access container via request.server
  app.decorate("container", container);

  // Register services with proper dependency chains
  // Why: Shows different service lifetimes and dependency injection patterns

  /**
   * Configuration Service - Singleton
   * Why: Configuration should be loaded once and shared across the application
   */
  container.registerSingleton("config", () => {
    return new AppConfigurationService();
  });

  /**
   * Logger Service - Singleton with dependency
   * Why: Logger can be shared but needs configuration for setup
   */
  container.registerSingleton("logger", async (container) => {
    const config = (await container.resolve("config")) as AppConfigurationService;
    return new AppLoggerService(config);
  });

  /**
   * Cache Service - Singleton with dependency
   * Why: Cache should be shared across requests for efficiency
   */
  container.registerSingleton("cache", async (container) => {
    const logger = (await container.resolve("logger")) as AppLoggerService;
    return new InMemoryCacheService(logger);
  });

  /**
   * User Repository - Singleton with multiple dependencies
   * Why: Repository can be shared as it manages data access
   */
  container.registerSingleton("userRepository", async (container) => {
    const cache = (await container.resolve("cache")) as InMemoryCacheService;
    const logger = (await container.resolve("logger")) as AppLoggerService;
    return new UserRepository(cache, logger);
  });

  /**
   * User Service - Scoped with dependencies
   * Why: Business logic services are often scoped to provide request-specific behavior
   */
  container.registerScoped("userService", async (container, context) => {
    const userRepository = (await container.resolve("userRepository")) as UserRepository;
    const logger = (await container.resolve("logger")) as AppLoggerService;
    const config = (await container.resolve("config")) as AppConfigurationService;

    // Create child logger with request context
    const contextLogger = logger.child({
      requestId: context?.requestId,
      userId: context?.userId,
    });

    return new UserService(userRepository, contextLogger, config);
  });

  /**
   * Notification Service - Transient with dependencies
   * Why: Notification services might be stateful per operation
   */
  container.registerTransient("notificationService", async (container, context) => {
    const logger = (await container.resolve("logger")) as AppLoggerService;
    const config = (await container.resolve("config")) as AppConfigurationService;

    // Create child logger with request context
    const contextLogger = logger.child({
      requestId: context?.requestId,
      service: "notifications",
    });

    return new NotificationService(contextLogger, config);
  });

  // Register DI plugin with container
  // Why: Integrates DI container with Fastify request lifecycle
  await app.register(diPlugin, {
    container,
    ...serverConfig.di,
  });

  const appWithDI = app as FastifyInstance & {
    createDIHandler?: <TDependencies = unknown>(
      dependencies: string[],
      handler: (
        request: FastifyRequest,
        reply: FastifyReply,
        deps: TDependencies
      ) => Promise<unknown> | unknown
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  };

  if (typeof appWithDI.createDIHandler !== "function") {
    app.decorate("createDIHandler", function <
      TDependencies = unknown,
    >(dependencies: string[], handler: (request: FastifyRequest, reply: FastifyReply, deps: TDependencies) => Promise<unknown> | unknown): (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<unknown> {
      return async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
        const resolvedDeps: Record<string, unknown> = {};
        const scopedContainer = request.scope;
        const activeContainer = scopedContainer || container;
        const context = request.serviceContext;

        for (const depName of dependencies) {
          resolvedDeps[depName] = await activeContainer.resolve(depName, context);
        }

        return handler(request, reply, resolvedDeps as TDependencies);
      };
    });
  }

  const appWithMetrics = app as FastifyInstance & {
    getContainerStats?: () => ReturnType<DefaultServiceContainer["getStatistics"]>;
    getDependencyGraph?: () => ReturnType<DefaultServiceContainer["buildDependencyGraph"]>;
  };

  if (typeof appWithMetrics.getContainerStats !== "function") {
    app.decorate("getContainerStats", () => container.getStatistics());
  }

  if (typeof appWithMetrics.getDependencyGraph !== "function") {
    app.decorate("getDependencyGraph", () => container.buildDependencyGraph());
  }

  // Initialize all singleton services
  // Why: Ensure services are properly initialized before handling requests
  await container.resolve("config");
  await container.resolve("logger");
  await container.resolve("cache");
  await container.resolve("userRepository");

  // Health check endpoint
  // Why: Essential for monitoring and load balancer health checks
  app.get("/health", async (req, reply) => {
    const stats = app.getContainerStats();
    const dependencyGraph = app.getDependencyGraph();

    return reply.code(HttpStatus.OK).send({
      status: "healthy",
      timestamp: new Date().toISOString(),
      container: {
        totalServices: stats.totalServices,
        totalResolutions: stats.totalResolutions,
        averageResolutionTime: stats.averageResolutionTime.toFixed(2) + "ms",
        activeScopes: stats.activeScopes,
        dependencyGraph: {
          nodes: dependencyGraph.nodes.size,
          roots: dependencyGraph.roots.length,
          cycles: dependencyGraph.cycles.length,
        },
      },
    });
  });

  // User Management Endpoints with Dependency Injection
  // Why: Demonstrates different DI patterns in real API endpoints

  /**
   * Get All Users - Simple DI pattern
   * Demonstrates: Basic service injection, scoped services
   */
  createDIRoute(
    app,
    "GET",
    "/users",
    ["userService"],
    async (request, reply, { userService }: { userService: UserService }) => {
      const users = await userService.getAllUsers(request.serviceContext);

      return reply.code(HttpStatus.OK).send({
        users,
        count: users.length,
        requestId: request.serviceContext?.requestId,
      });
    }
  );

  /**
   * Get User by ID - Parameter validation with DI
   * Demonstrates: Route parameters, error handling, service injection
   */
  createDIRoute(
    app,
    "GET",
    "/users/:id",
    ["userService"],
    async (request, reply, { userService }: { userService: UserService }) => {
      const parsed = idParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "missing_parameter",
          message: "User ID is required",
        });
      }
      const { id } = parsed.data;

      const user = await userService.getUserById(id, request.serviceContext);

      if (!user) {
        return reply.code(HttpStatus.NOT_FOUND).send({
          error: "user_not_found",
          message: `User with ID ${id} not found`,
        });
      }

      return reply.code(HttpStatus.OK).send({
        user,
        requestId: request.serviceContext?.requestId,
      });
    }
  );

  /**
   * Create User - Multiple service injection
   * Demonstrates: Multiple dependencies, business logic, notifications
   */
  createDIRoute(
    app,
    "POST",
    "/users",
    ["userService", "notificationService"],
    async (
      request,
      reply,
      {
        userService,
        notificationService,
      }: {
        userService: UserService;
        notificationService: NotificationService;
      }
    ) => {
      const parsed = createUserBodySchema.safeParse(request.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join("; ") || "Email, firstName, and lastName are required";
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "validation_error",
          message,
        });
      }
      const userData = parsed.data as Omit<User, "id" | "createdAt" | "updatedAt">;

      try {
        const user = await userService.createUser(userData, request.serviceContext);

        // Send welcome notification using injected service
        // Why: Demonstrates service composition and async operations
        await notificationService.sendWelcomeEmail(user, request.serviceContext);

        return reply.code(HttpStatus.CREATED).send({
          user,
          message: "User created successfully",
          requestId: request.serviceContext?.requestId,
        });
      } catch (error) {
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "creation_failed",
          message: error instanceof Error ? error.message : "Failed to create user",
        });
      }
    }
  );

  /**
   * Update User - Partial updates with notifications
   * Demonstrates: PATCH operations, partial updates, service composition
   */
  createDIRoute(
    app,
    "PATCH",
    "/users/:id",
    ["userService", "notificationService"],
    async (
      request,
      reply,
      {
        userService,
        notificationService,
      }: {
        userService: UserService;
        notificationService: NotificationService;
      }
    ) => {
      const paramsParsed = idParamsSchema.safeParse(request.params);
      const bodyParsed = updateUserBodySchema.safeParse(request.body);
      if (!paramsParsed.success) {
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "missing_parameter",
          message: "User ID is required",
        });
      }
      const { id } = paramsParsed.data;
      const updates = (bodyParsed.success ? bodyParsed.data : {}) as Partial<User>;

      try {
        const updatedUser = await userService.updateUser(id, updates, request.serviceContext);

        if (!updatedUser) {
          return reply.code(HttpStatus.NOT_FOUND).send({
            error: "user_not_found",
            message: `User with ID ${id} not found`,
          });
        }

        // Send update notification
        await notificationService.sendUserUpdatedNotification(updatedUser, request.serviceContext);

        return reply.code(HttpStatus.OK).send({
          user: updatedUser,
          message: "User updated successfully",
          requestId: request.serviceContext?.requestId,
        });
      } catch (error) {
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "update_failed",
          message: error instanceof Error ? error.message : "Failed to update user",
        });
      }
    }
  );

  /**
   * Delete User - Simple deletion with logging
   * Demonstrates: DELETE operations, boolean responses
   */
  createDIRoute(
    app,
    "DELETE",
    "/users/:id",
    ["userService"],
    async (request, reply, { userService }: { userService: UserService }) => {
      const parsed = idParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "missing_parameter",
          message: "User ID is required",
        });
      }
      const { id } = parsed.data;

      const deleted = await userService.deleteUser(id, request.serviceContext);

      if (!deleted) {
        return reply.code(HttpStatus.NOT_FOUND).send({
          error: "user_not_found",
          message: `User with ID ${id} not found`,
        });
      }

      return reply.code(HttpStatus.OK).send({
        message: "User deleted successfully",
        requestId: request.serviceContext?.requestId,
      });
    }
  );

  /**
   * User Statistics - Aggregation with caching
   * Demonstrates: Business logic services, data aggregation
   */
  createDIRoute(
    app,
    "GET",
    "/users/stats",
    ["userService"],
    async (request, reply, { userService }: { userService: UserService }) => {
      const stats = await userService.getUserStats(request.serviceContext);

      return reply.code(HttpStatus.OK).send({
        stats,
        timestamp: new Date().toISOString(),
        requestId: request.serviceContext?.requestId,
      });
    }
  );

  // Container Management Endpoints
  // Why: Provides introspection and management of the DI container

  /**
   * Container Statistics - Performance monitoring
   * Demonstrates: Container introspection, performance metrics
   */
  app.get("/container/stats", async (request, reply) => {
    const stats = app.getContainerStats();

    return reply.code(HttpStatus.OK).send({
      statistics: stats,
      performance: {
        successRate:
          stats.totalResolutions > 0
            ? (((stats.totalResolutions - stats.cacheHits) / stats.totalResolutions) * 100).toFixed(
                2
              ) + "%"
            : "0%",
        cacheHitRate:
          stats.totalResolutions > 0
            ? ((stats.cacheHits / stats.totalResolutions) * 100).toFixed(2) + "%"
            : "0%",
        averageResolutionTime: stats.averageResolutionTime.toFixed(2) + "ms",
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Dependency Graph - Visualization data
   * Demonstrates: Dependency analysis, graph visualization
   */
  app.get("/container/dependencies", async (request, reply) => {
    const graph = app.getDependencyGraph();

    // Convert Map to object for JSON serialization
    const entries = Array.from(graph.nodes.entries());
    const nodes = entries.map(([name, node]) => ({
      name,
      dependencies: node.dependencies,
      dependents: node.dependents,
      lifetime: node.registration.lifetime,
      resolved: node.resolved,
      tags: node.registration.tags || [],
    }));

    return reply.code(HttpStatus.OK).send({
      nodes,
      roots: graph.roots,
      leaves: graph.leaves,
      cycles: graph.cycles,
      analysis: {
        totalNodes: nodes.length,
        rootNodes: graph.roots.length,
        leafNodes: graph.leaves.length,
        circularDependencies: graph.cycles.length,
        maxDepth: 0, // Simplified for now
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Service Registry - List all registered services
   * Demonstrates: Service discovery, registration metadata
   */
  app.get("/container/services", async (request, reply) => {
    const registrations = app.container.getAllRegistrations();

    const services = registrations.map((reg) => ({
      name: reg.name,
      lifetime: reg.lifetime,
      dependencies: reg.dependencies || [],
      tags: reg.tags || [],
      metadata: reg.metadata || {},
      isResolved:
        reg.lifetime === ServiceLifetime.SINGLETON
          ? (
              app.container as unknown as { singletonInstances?: Map<string, unknown> }
            ).singletonInstances?.has(reg.name) || false
          : false,
    }));

    return reply.code(HttpStatus.OK).send({
      services,
      summary: {
        total: services.length,
        singleton: services.filter((s) => s.lifetime === ServiceLifetime.SINGLETON).length,
        scoped: services.filter((s) => s.lifetime === ServiceLifetime.SCOPED).length,
        transient: services.filter((s) => s.lifetime === ServiceLifetime.TRANSIENT).length,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Testing Endpoints
  // Why: Provides endpoints for testing different DI scenarios

  /**
   * Test Service Resolution - Manual service resolution
   * Demonstrates: Direct service resolution, error handling
   */
  app.post<{
    Body: { serviceName: string; context?: ServiceContext };
  }>("/test/resolve", async (request, reply) => {
    const parsed = testResolveBodySchema.safeParse(request.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join("; ") || "serviceName is required";
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "missing_parameter",
        message,
      });
    }
    const { serviceName, context } = parsed.data;

    try {
      const startTime = performance.now();
      const service = await app.resolve(serviceName, context || request.serviceContext);
      const resolutionTime = performance.now() - startTime;

      return reply.code(HttpStatus.OK).send({
        serviceName,
        resolved: true,
        resolutionTime: resolutionTime.toFixed(2) + "ms",
        serviceType: typeof service,
        hasHealthCheck: typeof (service as { healthCheck?: unknown })?.healthCheck === "function",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        serviceName,
        resolved: false,
        error: error instanceof Error ? error.message : "Resolution failed",
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Test Scoped Resolution - Request-scoped service testing
   * Demonstrates: Scoped service behavior, request context
   */
  app.get("/test/scoped/:serviceName", async (request, reply) => {
    const { serviceName } = request.params as { serviceName: string };

    try {
      const service1 = await app.resolveScoped(request, serviceName);
      const service2 = await app.resolveScoped(request, serviceName);

      return reply.code(HttpStatus.OK).send({
        serviceName,
        sameInstance: service1 === service2,
        requestId: request.serviceContext?.requestId,
        message:
          service1 === service2
            ? "Scoped service returned same instance within request"
            : "Scoped service returned different instances",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        serviceName,
        error: error instanceof Error ? error.message : "Scoped resolution failed",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Add middleware for performance monitoring
  // Why: Demonstrates middleware integration with DI
  app.addHook("preHandler", DIMiddleware.monitorPerformance());

  // Add middleware to require core services
  // Why: Ensures essential services are available
  app.addHook("preHandler", DIMiddleware.requireServices(["config", "logger"]));

  return app;
}

async function startServer(): Promise<void> {
  const app = await createApp();

  // Start server
  // Why: Listen on port 3004 to avoid conflicts with other APIs
  await app.listen({
    port: serverConfig.port,
    host: serverConfig.host,
  });

  console.warn(
    `🚀 Dependency Injection API server started on http://${serverConfig.host}:${serverConfig.port}`
  );
  console.warn(`📊 Request scoping enabled: ${serverConfig.di.enableRequestScoping}`);
  console.warn(`🔍 Health checks enabled: ${serverConfig.di.enableHealthChecks}`);
  console.warn(`📈 Metrics enabled: ${serverConfig.di.enableMetrics}`);

  // Log container statistics
  const stats = app.getContainerStats();
  console.warn(`📦 Container initialized with ${stats.totalServices} services`);
  console.warn(`   - Singleton: ${stats.singletonServices}`);
  console.warn(`   - Scoped: ${stats.scopedServices}`);
  console.warn(`   - Transient: ${stats.transientServices}`);
}

// Start the server only when this file is the entry point (not when required by generate-openapi)
// Why: Graceful error handling for server startup failures; avoid starting when generating OpenAPI
if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start dependency injection server:", error);
    process.exit(1);
  });
}
