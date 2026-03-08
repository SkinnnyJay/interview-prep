// fastify-integration.ts - Fastify plugin for dependency injection
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  ServiceContainer,
  ScopedContainer,
  ServiceContext,
  FastifyDIOptions,
  ContainerEvent,
  ContainerEventData,
  ServiceLifetime,
} from "./di-types";
import { DefaultServiceContainer } from "./service-container";
import { HttpStatus } from "./constants";

/**
 * Fastify dependency injection plugin
 * Integrates DI container with Fastify request lifecycle
 */
async function fastifyDIPlugin(
  fastify: FastifyInstance,
  options: FastifyDIOptions = {}
): Promise<void> {
  // Use provided container or create new one
  // Why: Allows customization while providing sensible defaults
  const container = options.container || new DefaultServiceContainer(options.configuration);

  // Store container on Fastify instance
  // Why: Makes container accessible throughout the application
  fastify.decorate("container", container);

  // Enable request scoping if configured
  // Why: Provides request-specific service instances
  if (options.enableRequestScoping !== false) {
    fastify.addHook("onRequest", async (request: FastifyRequest, _reply: FastifyReply) => {
      // Create service context from request
      // Why: Provides request-specific context for scoped services
      const context: ServiceContext = {
        requestId: request.id,
        userId: request.user?.id,
        correlationId: request.headers["x-correlation-id"] as string,
        startTime: Date.now(),
        metadata: {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
          method: request.method,
          url: request.url,
          headers: request.headers,
        },
      };

      // Create scoped container for this request
      const scopedContainer = container.createScope(context);

      // Attach scoped container to request
      request.scope = scopedContainer;
      request.serviceContext = context;
    });

    // Clean up scoped container after request
    // Why: Prevent memory leaks from abandoned scopes
    fastify.addHook("onResponse", async (request: FastifyRequest, _reply: FastifyReply) => {
      const scopedContainer = request.scope;
      if (scopedContainer) {
        await scopedContainer.disposeScope();
      }
    });

    // Clean up on request errors too
    fastify.addHook(
      "onError",
      async (request: FastifyRequest, _reply: FastifyReply, _error: Error) => {
        const scopedContainer = request.scope;
        if (scopedContainer) {
          await scopedContainer.disposeScope();
        }
      }
    );
  }

  // Enable health checks if configured
  // Why: Provides service health monitoring endpoints
  if (options.enableHealthChecks) {
    fastify.get("/health/services", async (request, reply) => {
      const registrations = container.getAllRegistrations();
      const healthChecks = [];

      for (const registration of registrations) {
        try {
          const service = await container.resolve(registration.name);

          let health = {
            name: registration.name,
            status: "healthy" as const,
            lastCheck: new Date(),
            message: "Service is operational",
          };

          // Call health check method if available
          const svc = service as { healthCheck?: () => Promise<typeof health> };
          if (svc && typeof svc.healthCheck === "function") {
            health = await svc.healthCheck();
          }

          healthChecks.push(health);
        } catch (error) {
          healthChecks.push({
            name: registration.name,
            status: "unhealthy" as const,
            lastCheck: new Date(),
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const overallStatus = healthChecks.every((h) => h.status === "healthy")
        ? "healthy"
        : "unhealthy";

      return reply
        .code(overallStatus === "healthy" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
        .send({
          status: overallStatus,
          services: healthChecks,
          timestamp: new Date().toISOString(),
        });
    });
  }

  // Enable metrics if configured
  // Why: Provides container performance monitoring
  if (options.enableMetrics) {
    fastify.get("/metrics/container", async (request, reply) => {
      const stats = (container as DefaultServiceContainer).getStatistics();
      const dependencyGraph = (container as DefaultServiceContainer).buildDependencyGraph();

      return reply.send({
        statistics: stats,
        dependencyGraph: {
          totalNodes: dependencyGraph.nodes.size,
          rootNodes: dependencyGraph.roots.length,
          leafNodes: dependencyGraph.leaves.length,
          circularDependencies: dependencyGraph.cycles.length,
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Resolve service from container
   * Decorator method for easy service resolution
   */
  fastify.decorate("resolve", async function <
    T,
  >(this: FastifyInstance, serviceName: string, context?: ServiceContext): Promise<T> {
    return container.resolve<T>(serviceName, context);
  });

  /**
   * Resolve service from request scope
   * Uses request-scoped container if available
   */
  fastify.decorate("resolveScoped", async function <
    T,
  >(this: FastifyInstance, request: FastifyRequest, serviceName: string): Promise<T> {
    const scopedContainer = request.scope;
    if (scopedContainer) {
      return scopedContainer.resolve<T>(serviceName);
    }

    // Fallback to main container
    const context = request.serviceContext;
    return container.resolve<T>(serviceName, context);
  });

  /**
   * Create route handler with dependency injection
   * Provides type-safe dependency injection for route handlers
   */
  fastify.decorate("createDIHandler", function <
    TDependencies = unknown,
  >(this: FastifyInstance, dependencies: string[], handler: (request: FastifyRequest, reply: FastifyReply, deps: TDependencies) => Promise<unknown> | unknown): (
    request: FastifyRequest,
    reply: FastifyReply
  ) => Promise<unknown> {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
      try {
        // Resolve dependencies
        const resolvedDeps: Record<string, unknown> = {};
        const scopedContainer = request.scope;
        const activeContainer = scopedContainer || container;
        const context = request.serviceContext;

        for (const depName of dependencies) {
          resolvedDeps[depName] = await activeContainer.resolve(depName, context);
        }

        // Call handler with resolved dependencies
        return await handler(request, reply, resolvedDeps as TDependencies);
      } catch (error) {
        // Handle dependency resolution errors
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          error: "dependency_resolution_error",
          message: error instanceof Error ? error.message : "Failed to resolve dependencies",
          dependencies,
        });
      }
    };
  });

  /**
   * Register service in container
   * Decorator method for service registration
   */
  fastify.decorate(
    "registerService",
    function (
      this: FastifyInstance,
      name: string,
      factory: (
        container: ServiceContainer,
        context?: ServiceContext
      ) => unknown | Promise<unknown>,
      lifetime: ServiceLifetime = ServiceLifetime.SINGLETON
    ): void {
      switch (lifetime) {
        case ServiceLifetime.SINGLETON:
          container.registerSingleton(name, factory);
          break;
        case ServiceLifetime.SCOPED:
          container.registerScoped(name, factory);
          break;
        case ServiceLifetime.TRANSIENT:
          container.registerTransient(name, factory);
          break;
      }
    }
  );

  /**
   * Get container statistics
   * Access to container performance metrics
   */
  fastify.decorate("getContainerStats", function (this: FastifyInstance) {
    return (container as DefaultServiceContainer).getStatistics();
  });

  /**
   * Build dependency graph
   * Access to dependency analysis
   */
  fastify.decorate("getDependencyGraph", function (this: FastifyInstance) {
    return (container as DefaultServiceContainer).buildDependencyGraph();
  });

  // Set up container event logging if enabled
  if (options.configuration?.enableLifecycleLogging) {
    (container as DefaultServiceContainer).addEventListener(
      ContainerEvent.SERVICE_REGISTERED,
      (_event: ContainerEvent, data: ContainerEventData) => {
        fastify.log.info(`Service registered: ${data.serviceName} (${data.lifetime})`);
      }
    );

    (container as DefaultServiceContainer).addEventListener(
      ContainerEvent.SERVICE_RESOLVED,
      (_event: ContainerEvent, data: ContainerEventData) => {
        fastify.log.debug(
          `Service resolved: ${data.serviceName} (${data.resolutionTime?.toFixed(2)}ms)`
        );
      }
    );

    (container as DefaultServiceContainer).addEventListener(
      ContainerEvent.CIRCULAR_DEPENDENCY,
      (_event: ContainerEvent, data: ContainerEventData) => {
        fastify.log.error(
          `Circular dependency detected: ${data.serviceName} ${JSON.stringify(data.metadata ?? {})}`
        );
      }
    );

    (container as DefaultServiceContainer).addEventListener(
      ContainerEvent.RESOLUTION_ERROR,
      (_event: ContainerEvent, data: ContainerEventData) => {
        fastify.log.error(
          `Service resolution error: ${data.serviceName}: ${data.error?.message ?? String(data.error)}`
        );
      }
    );
  }

  // Cleanup container on server close
  // Why: Ensure proper resource cleanup
  fastify.addHook("onClose", async () => {
    await container.dispose();
  });
}

/**
 * Helper function to create DI route with type safety
 * Provides convenient route creation with dependency injection
 */
export function createDIRoute<TDependencies = unknown>(
  fastify: FastifyInstance,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  dependencies: string[],
  handler: (
    request: FastifyRequest,
    reply: FastifyReply,
    deps: TDependencies
  ) => Promise<unknown> | unknown,
  options?: Record<string, unknown>
): void {
  const diHandler = fastify.createDIHandler(dependencies, handler);

  fastify.route({
    method,
    url,
    handler: diHandler,
    ...options,
  });
}

/**
 * Middleware factory for common DI patterns
 * Provides reusable middleware for dependency injection
 */
export const DIMiddleware = {
  /**
   * Require specific services to be available
   * Ensures services are registered before handling requests
   */
  requireServices: (serviceNames: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const container = request.server.container;

      for (const serviceName of serviceNames) {
        if (!container.isRegistered(serviceName)) {
          reply.code(HttpStatus.SERVICE_UNAVAILABLE).send({
            error: "service_unavailable",
            message: `Required service '${serviceName}' is not available`,
            requiredServices: serviceNames,
          });
          return;
        }
      }
    };
  },

  /**
   * Inject user context into service context
   * Adds user information to service resolution context
   */
  injectUserContext: () => {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const context = request.serviceContext;
      if (context && request.user) {
        context.userId = request.user.id;
        context.metadata = {
          ...context.metadata,
          user: request.user,
        };
      }
    };
  },

  /**
   * Performance monitoring for service resolution
   * Tracks service resolution performance per request
   */
  monitorPerformance: () => {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const startTime = Date.now();

      // Store start time in request context
      const context = request.serviceContext;
      if (context) {
        context.metadata = {
          ...context.metadata,
          requestStartTime: startTime,
        };
      }
    };
  },
};

// Export the plugin function directly
export default fastifyDIPlugin;

// Extend Fastify types to include DI decorators
declare module "fastify" {
  interface FastifyInstance {
    container: ServiceContainer;
    resolve<T>(serviceName: string, context?: ServiceContext): Promise<T>;
    resolveScoped<T>(request: FastifyRequest, serviceName: string): Promise<T>;
    createDIHandler<TDependencies = unknown>(
      dependencies: string[],
      handler: (
        request: FastifyRequest,
        reply: FastifyReply,
        deps: TDependencies
      ) => Promise<unknown> | unknown
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
    registerService(
      name: string,
      factory: (c: ServiceContainer, ctx?: ServiceContext) => unknown | Promise<unknown>,
      lifetime?: ServiceLifetime
    ): void;
    getContainerStats(): ReturnType<DefaultServiceContainer["getStatistics"]>;
    getDependencyGraph(): ReturnType<DefaultServiceContainer["buildDependencyGraph"]>;
  }

  interface FastifyRequest {
    scope?: ScopedContainer;
    serviceContext?: ServiceContext;
    user?: { id: string; [key: string]: unknown };
  }
}
