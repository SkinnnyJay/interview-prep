// server.ts - Fastify server with comprehensive Zod validation examples
import Fastify, { FastifyInstance, FastifyRequest } from "fastify";
import swagger from "@fastify/swagger";
import { z } from "zod";
import validationPlugin, { createValidatedRoute } from "./fastify-integration";
import { ValidationEngine } from "./validation-engine";
import { UserSchemas, ProductSchemas, OrderSchemas } from "./validation-schemas";
import { CommonValidations } from "./validation-types";
import { HttpStatus } from "./constants";
import { ValidationErrorResponse, ValidationOptions, ValidationPipeline } from "./validation-types";

// Server configuration
// Why: Centralized configuration for validation behavior
const serverConfig = {
  port: 3003,
  host: "0.0.0.0",
  validation: {
    enableMetrics: true,
    logErrors: true,
    maxValidationTime: 5000,
    defaultOptions: {
      stripUnknown: true,
      allowUnknown: false,
      abortEarly: false,
      errorFormat: "detailed" as const,
      transformData: true,
    },
  },
};

/** Create and configure the Fastify app with swagger and routes (no listen). */
export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify app with comprehensive configuration
  // Why: Fastify provides excellent TypeScript support and performance
  const app = Fastify({
    logger: true,
    requestIdLogLabel: "requestId",
    requestIdHeader: "x-request-id",
  });

  await app.register(swagger as unknown as Parameters<typeof app.register>[0], {
    openapi: {
      info: { title: "Validation API", description: "Zod validation patterns", version: "1.0.0" },
      servers: [{ url: "http://localhost:3003", description: "Development" }],
    },
  });

  // Register validation plugin
  // Why: Provides validation middleware and decorators
  await app.register(validationPlugin as unknown as Parameters<typeof app.register>[0], {
    globalOptions: serverConfig.validation.defaultOptions,
    errorHandler: (
      error: import("./validation-types").ValidationErrorResponse,
      reply: import("fastify").FastifyReply
    ) => {
      reply.code(HttpStatus.BAD_REQUEST).send({
        ...error,
        requestId: reply.request.id,
        timestamp: new Date().toISOString(),
      });
    },
    contextExtractor: (request: import("fastify").FastifyRequest) => ({
      userId: (request as FastifyRequest & { user?: { id?: string; role?: string } }).user?.id,
      userRole: (request as FastifyRequest & { user?: { id?: string; role?: string } }).user?.role,
      requestId: request.id,
      metadata: {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        method: request.method,
        url: request.url,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  // Health check endpoint
  // Why: Essential for monitoring and load balancer health checks
  app.get("/health", async (req, reply) => {
    const metrics = app.getValidationMetrics();

    return reply.code(HttpStatus.OK).send({
      status: "healthy",
      timestamp: new Date().toISOString(),
      validation: {
        enabled: true,
        metrics: {
          totalValidations: metrics.totalValidations,
          successRate:
            metrics.totalValidations > 0
              ? ((metrics.successfulValidations / metrics.totalValidations) * 100).toFixed(2) + "%"
              : "0%",
          averageTime: metrics.averageValidationTime.toFixed(2) + "ms",
        },
      },
    });
  });

  // User Management Endpoints
  // Why: Demonstrates comprehensive user validation patterns

  /**
   * User Registration - Complex validation with business rules
   * Demonstrates: Schema validation, custom refinements, password confirmation
   */
  createValidatedRoute<z.infer<typeof UserSchemas.registration>>(
    app,
    "POST",
    "/users/register",
    {
      request: { body: UserSchemas.registration },
      response: {
        201: z.object({
          id: CommonValidations.uuid,
          email: CommonValidations.email,
          firstName: z.string(),
          lastName: z.string(),
          createdAt: CommonValidations.isoDate,
          message: z.string(),
        }),
        400: z.object({
          error: z.literal("validation_error"),
          message: z.string(),
          details: z.array(
            z.object({
              field: z.string(),
              code: z.string(),
              message: z.string(),
            })
          ),
        }),
      },
    },
    async (request, reply) => {
      try {
        // Simulate user creation with validation
        // Why: Demonstrates how validated data flows through business logic
        const userData = request.validated.body;

        // Simulate business logic validation (e.g., check if email exists)
        // In real implementation, this would query the database
        const existingUser = userData.email === "existing@example.com";

        if (existingUser) {
          return reply.code(HttpStatus.BAD_REQUEST).send({
            error: "validation_error",
            message: "Email already exists",
            details: [
              {
                field: "email",
                code: "duplicate_value",
                message: "This email address is already registered",
              },
            ],
          });
        }

        // Simulate user creation
        const newUser = {
          id: crypto.randomUUID(),
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          createdAt: new Date(),
          message: "User registered successfully",
        };

        return reply.code(HttpStatus.CREATED).send(newUser);
      } catch (error) {
        app.log.error(error, "User registration error");
        return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          error: "internal_server_error",
          message: "Failed to register user",
        });
      }
    }
  );

  /**
   * User Login - Simple validation with security considerations
   * Demonstrates: Basic validation, optional fields, security headers
   */
  createValidatedRoute<z.infer<typeof UserSchemas.login>>(
    app,
    "POST",
    "/users/login",
    {
      request: { body: UserSchemas.login },
      response: {
        200: z.object({
          token: z.string(),
          user: z.object({
            id: CommonValidations.uuid,
            email: CommonValidations.email,
            firstName: z.string(),
            lastName: z.string(),
          }),
          expiresAt: CommonValidations.isoDate,
        }),
      },
    },
    async (request, reply) => {
      const { email, password, rememberMe } = request.validated.body;

      // Simulate authentication
      // Why: Shows how validation integrates with authentication logic
      if (email === "user@example.com" && password === "Password123!") {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (rememberMe ? 24 * 7 : 24)); // 7 days or 1 day

        return reply.code(HttpStatus.OK).send({
          token: "mock-jwt-token-" + crypto.randomUUID(),
          user: {
            id: crypto.randomUUID(),
            email,
            firstName: "John",
            lastName: "Doe",
          },
          expiresAt,
        });
      }

      return reply.code(HttpStatus.UNAUTHORIZED).send({
        error: "invalid_credentials",
        message: "Invalid email or password",
      });
    }
  );

  /**
   * User Profile Update - Partial validation
   * Demonstrates: Optional fields, partial updates, nested objects
   */
  createValidatedRoute<z.infer<typeof UserSchemas.profileUpdate>, unknown, { id: string }>(
    app,
    "PATCH",
    "/users/:id",
    {
      request: {
        params: z.object({
          id: CommonValidations.uuid,
        }),
        body: UserSchemas.profileUpdate,
      },
      response: {
        200: z.object({
          id: CommonValidations.uuid,
          message: z.string(),
          updatedFields: z.array(z.string()),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.validated.params;
      const updates = request.validated.body;

      // Track which fields were updated
      // Why: Provides feedback about what was actually changed
      const updatedFields = Object.keys(updates).filter(
        (key) => updates[key as keyof typeof updates] !== undefined
      );

      return reply.code(HttpStatus.OK).send({
        id,
        message: `Profile updated successfully`,
        updatedFields,
      });
    }
  );

  // Product Management Endpoints
  // Why: Demonstrates e-commerce validation patterns

  /**
   * Product Creation - Complex nested validation
   * Demonstrates: Nested objects, arrays, custom refinements, business rules
   */
  createValidatedRoute<z.infer<typeof ProductSchemas.create>>(
    app,
    "POST",
    "/products",
    {
      request: { body: ProductSchemas.create },
      response: {
        201: z.object({
          id: CommonValidations.uuid,
          name: z.string(),
          sku: z.string(),
          price: z.number(),
          message: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const productData = request.validated.body;

      // Simulate SKU uniqueness check
      // Why: Demonstrates business rule validation
      if (productData.sku === "DUPLICATE-SKU") {
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "validation_error",
          message: "SKU already exists",
          details: [
            {
              field: "sku",
              code: "duplicate_value",
              message: "This SKU is already in use",
            },
          ],
        });
      }

      const newProduct = {
        id: crypto.randomUUID(),
        name: productData.name,
        sku: productData.sku,
        price: productData.price,
        message: "Product created successfully",
      };

      return reply.code(HttpStatus.CREATED).send(newProduct);
    }
  );

  /**
   * Product Search - Query parameter validation
   * Demonstrates: Query validation, pagination, filtering, sorting
   */
  createValidatedRoute<unknown, z.infer<typeof ProductSchemas.search>>(
    app,
    "GET",
    "/products/search",
    {
      request: { querystring: ProductSchemas.search },
      response: {
        200: z.object({
          products: z.array(
            z.object({
              id: CommonValidations.uuid,
              name: z.string(),
              price: z.number(),
              category: z.string(),
              inStock: z.boolean(),
            })
          ),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
          }),
          filters: z.object({
            query: z.string().optional(),
            category: z.string().optional(),
            priceRange: z
              .object({
                min: z.number().optional(),
                max: z.number().optional(),
              })
              .optional(),
          }),
        }),
      },
    },
    async (request, reply) => {
      const searchParams = request.validated.querystring;

      // Simulate search results
      // Why: Shows how validated query parameters are used
      const mockProducts = Array.from({ length: searchParams.limit }, (_, i) => ({
        id: crypto.randomUUID(),
        name: `Product ${i + 1}`,
        price: Math.floor(Math.random() * 10000) + 1000, // $10-$100
        category: searchParams.category || "Electronics",
        inStock: Math.random() > 0.2, // 80% in stock
      }));

      return reply.code(HttpStatus.OK).send({
        products: mockProducts,
        pagination: {
          page: searchParams.page,
          limit: searchParams.limit,
          total: 150, // Mock total
          totalPages: Math.ceil(150 / searchParams.limit),
        },
        filters: {
          query: searchParams.query,
          category: searchParams.category,
          priceRange: {
            min: searchParams.priceMin,
            max: searchParams.priceMax,
          },
        },
      });
    }
  );

  // Order Management Endpoints
  // Why: Demonstrates complex business validation

  /**
   * Order Creation - Multi-step validation pipeline
   * Demonstrates: Validation pipelines, async validation, business rules
   */
  createValidatedRoute<z.infer<typeof OrderSchemas.create>>(
    app,
    "POST",
    "/orders",
    {
      request: { body: OrderSchemas.create },
      response: {
        201: z.object({
          id: CommonValidations.uuid,
          status: z.string(),
          total: z.number(),
          message: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const orderData = request.validated.body;

      // Create validation pipeline for complex order validation
      // Why: Demonstrates multi-step validation with business logic
      const orderValidationPipeline: ValidationPipeline<typeof orderData> = {
        name: "order-creation",
        steps: [
          {
            name: "inventory-check",
            validator: async (
              data: typeof orderData
            ): Promise<
              | { success: true; data: typeof orderData }
              | { success: false; error: ValidationErrorResponse }
            > => {
              // Simulate inventory validation
              for (const item of data.items) {
                if (item.quantity > 10) {
                  const err: ValidationErrorResponse = {
                    error: "validation_error",
                    message: "Insufficient inventory",
                    details: [
                      {
                        field: `items[${data.items.indexOf(item)}].quantity`,
                        code: "insufficient_inventory",
                        message: `Only 10 units available for product ${item.productId}`,
                      },
                    ],
                    timestamp: new Date().toISOString(),
                  };
                  return { success: false as const, error: err };
                }
              }
              return { success: true as const, data };
            },
          },
          {
            name: "shipping-validation",
            validator: async (
              data: typeof orderData
            ): Promise<
              | { success: true; data: typeof orderData }
              | { success: false; error: ValidationErrorResponse }
            > => {
              // Simulate shipping validation
              const supportedCountries = ["US", "CA", "GB", "DE", "FR"];
              if (!supportedCountries.includes(data.shippingAddress.country)) {
                const err: ValidationErrorResponse = {
                  error: "validation_error",
                  message: "Shipping not available to this country",
                  details: [
                    {
                      field: "shippingAddress.country",
                      code: "unsupported_country",
                      message: `Shipping not available to ${data.shippingAddress.country}`,
                    },
                  ],
                  timestamp: new Date().toISOString(),
                };
                return { success: false as const, error: err };
              }
              return { success: true as const, data };
            },
          },
        ],
      };

      // Execute validation pipeline
      const engine = new ValidationEngine();
      const pipelineResult = await engine.validatePipeline(orderValidationPipeline, orderData);

      if (!pipelineResult.success) {
        return reply.code(HttpStatus.BAD_REQUEST).send(pipelineResult.error);
      }

      // Calculate order total
      const total =
        orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0) +
        orderData.shipping.cost;

      const newOrder = {
        id: crypto.randomUUID(),
        status: "pending",
        total,
        message: "Order created successfully",
      };

      return reply.code(HttpStatus.CREATED).send(newOrder);
    }
  );

  // Validation Testing Endpoints
  // Why: Provides endpoints for testing different validation scenarios

  /**
   * Batch Validation Test
   * Demonstrates: Batch validation, error aggregation, performance testing
   */
  createValidatedRoute<{
    schema: "user" | "product" | "order";
    items: unknown[];
    options?: ValidationOptions;
  }>(
    app,
    "POST",
    "/validate/batch",
    {
      request: {
        body: z.object({
          schema: z.enum(["user", "product", "order"]),
          items: z.array(z.unknown()).min(1).max(100),
          options: z
            .object({
              abortEarly: z.boolean().optional(),
              stripUnknown: z.boolean().optional(),
            })
            .optional(),
        }),
      },
      response: {
        200: z.object({
          summary: z.object({
            total: z.number(),
            successful: z.number(),
            failed: z.number(),
          }),
          results: z.array(
            z.object({
              success: z.boolean(),
              data: z.unknown().optional(),
              error: z
                .object({
                  message: z.string(),
                  details: z.array(
                    z.object({
                      field: z.string(),
                      code: z.string(),
                      message: z.string(),
                    })
                  ),
                })
                .optional(),
            })
          ),
          performance: z.object({
            totalTime: z.number(),
            averageTime: z.number(),
          }),
        }),
      },
    },
    async (request, reply) => {
      const { schema: schemaType, items, options } = request.validated.body;

      // Select schema based on type
      // Why: Demonstrates dynamic schema selection
      let schema: z.ZodSchema<unknown>;
      switch (schemaType) {
        case "user":
          schema = UserSchemas.registration;
          break;
        case "product":
          schema = ProductSchemas.create;
          break;
        case "order":
          schema = OrderSchemas.create;
          break;
        default:
          return reply.code(HttpStatus.BAD_REQUEST).send({
            error: "invalid_schema_type",
            message: "Unsupported schema type",
          });
      }

      // Perform batch validation with timing
      const startTime = performance.now();
      const engine = new ValidationEngine();
      const batchResult = await engine.validateBatch(schema, items, options);
      const endTime = performance.now();

      return reply.code(HttpStatus.OK).send({
        summary: batchResult.summary,
        results: batchResult.results.map((result) => ({
          success: result.success,
          data: result.success ? result.data : undefined,
          error: result.success
            ? undefined
            : {
                message: result.error.message,
                details: result.error.details,
              },
        })),
        performance: {
          totalTime: endTime - startTime,
          averageTime: (endTime - startTime) / items.length,
        },
      });
    }
  );

  /**
   * Custom Validation Test
   * Demonstrates: Custom schemas, runtime validation, error handling
   */
  createValidatedRoute<{
    schema: Record<string, unknown>;
    data: unknown;
    options?: ValidationOptions;
  }>(
    app,
    "POST",
    "/validate/custom",
    {
      request: {
        body: z.object({
          schema: z.record(z.any()),
          data: z.unknown(),
          options: z
            .object({
              stripUnknown: z.boolean().optional(),
              abortEarly: z.boolean().optional(),
            })
            .optional(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as {
          schema: Record<string, unknown>;
          data: unknown;
          options?: ValidationOptions;
        };
        const { schema: schemaDefinition, data, options } = body;

        // This is a simplified example - in production, you'd want more security
        // Why: Demonstrates dynamic schema creation (with security considerations)
        const dynamicSchema = z.object(
          Object.fromEntries(
            Object.entries(schemaDefinition).map(([key, value]) => [
              key,
              typeof value === "string" && value === "string"
                ? z.string()
                : typeof value === "string" && value === "number"
                  ? z.number()
                  : typeof value === "string" && value === "boolean"
                    ? z.boolean()
                    : z.unknown(),
            ])
          )
        );

        const engine = new ValidationEngine();
        const result = await engine.validate(dynamicSchema, data, options);

        return reply.code(HttpStatus.OK).send({
          success: result.success,
          data: result.success ? result.data : undefined,
          error: result.success ? undefined : result.error,
          warnings: result.success ? result.warnings : undefined,
        });
      } catch (error) {
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: "schema_creation_failed",
          message: "Failed to create validation schema",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Validation Metrics Endpoint
   * Demonstrates: Performance monitoring, metrics collection
   */
  app.get("/validation/metrics", async (_request, reply) => {
    const metrics = app.getValidationMetrics();

    return reply.code(HttpStatus.OK).send({
      metrics,
      performance: {
        successRate:
          metrics.totalValidations > 0
            ? ((metrics.successfulValidations / metrics.totalValidations) * 100).toFixed(2) + "%"
            : "0%",
        errorRate:
          metrics.totalValidations > 0
            ? ((metrics.failedValidations / metrics.totalValidations) * 100).toFixed(2) + "%"
            : "0%",
        averageTime: metrics.averageValidationTime.toFixed(2) + "ms",
      },
      topErrors: Object.entries(metrics.errorsByCode)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([code, count]) => ({ code, count })),
      topErrorFields: Object.entries(metrics.errorsByField)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([field, count]) => ({ field, count })),
    });
  });

  /**
   * Reset Validation Metrics
   * Demonstrates: Metrics management, administrative endpoints
   */
  app.post("/validation/metrics/reset", async (_request, reply) => {
    app.resetValidationMetrics();

    return reply.code(HttpStatus.OK).send({
      message: "Validation metrics reset successfully",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

async function startServer(): Promise<void> {
  const app = await createApp();
  await app.listen({
    port: serverConfig.port,
    host: serverConfig.host,
  });

  app.log.info(`Validation API server started on http://${serverConfig.host}:${serverConfig.port}`);
  app.log.info(`Validation metrics enabled: ${serverConfig.validation.enableMetrics}`);
  app.log.info(`Error logging enabled: ${serverConfig.validation.logErrors}`);
}

// Start the server with comprehensive error handling
startServer().catch((error: unknown) => {
  console.warn("Failed to start validation server:", error);
  process.exit(1);
});
