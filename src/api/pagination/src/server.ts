// server.ts
import Fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import {
  paginate,
  PaginationType,
  createPageBasedRequest,
  createOffsetBasedRequest,
  type Employee,
  type PaginationRequest,
  type PaginationResult,
} from "./pagination";
import { HttpStatus } from "./constants";

// Load fake data
const dataPath = join(__dirname, "fake-data.json");
const employees: Employee[] = JSON.parse(readFileSync(dataPath, "utf-8"));

// ----- Zod schemas for query validation -----
const pageBasedQuerySchema = z.object({
  page: z.string().optional().transform((s) => (s ? parseInt(s, 10) : 1)),
  limit: z.string().optional().transform((s) => (s ? parseInt(s, 10) : undefined)),
  department: z.string().optional(),
});

const offsetBasedQuerySchema = z.object({
  offset: z.string().optional().transform((s) => (s ? parseInt(s, 10) : 0)),
  limit: z.string().optional().transform((s) => (s ? parseInt(s, 10) : undefined)),
  department: z.string().optional(),
});

const paginateQuerySchema = z.object({
  type: z.nativeEnum(PaginationType),
  page: z.string().optional().transform((s) => (s ? parseInt(s, 10) : 1)),
  offset: z.string().optional().transform((s) => (s ? parseInt(s, 10) : 0)),
  limit: z.string().optional().transform((s) => (s ? parseInt(s, 10) : undefined)),
  department: z.string().optional(),
});

// Query parameter interfaces for Fastify (kept for typing)
interface PageBasedQuery {
  page?: string;
  limit?: string;
  department?: string;
}

interface OffsetBasedQuery {
  offset?: string;
  limit?: string;
  department?: string;
}

// Helper function to filter employees by department
function filterEmployeesByDepartment(employees: Employee[], department?: string): Employee[] {
  if (!department) return employees;
  return employees.filter((emp) => emp.department.toLowerCase().includes(department.toLowerCase()));
}

// Helper to send validation error from Zod result
function sendValidationError(
  reply: import("fastify").FastifyReply,
  result: z.SafeParseError<unknown>
): void {
  const message = result.error.errors.map((e) => e.message).join("; ") || "Validation failed";
  reply.code(HttpStatus.BAD_REQUEST).send({ error: "invalid_request", message });
}

/** Create and configure the Fastify app with swagger and routes (no listen). */
export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(swagger as unknown as Parameters<typeof app.register>[0], {
    openapi: {
      info: { title: "Pagination API", description: "Page-based and offset-based pagination", version: "1.0.0" },
      servers: [{ url: "http://localhost:3001", description: "Development" }],
    },
  });

  // Health check endpoint
  // Why: This provides a simple health check endpoint to verify the server is running.
  app.get("/health", async (req, reply) => {
    return reply.code(HttpStatus.OK).send({ status: "ok", message: "Pagination API is running" });
  });

  // Get all employees (no pagination)
  // Why: This provides access to the complete dataset for comparison.
  app.get<{ Querystring: PageBasedQuery }>("/employees", async (req, reply) => {
    const parsed = pageBasedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(reply, parsed);
      return;
    }
    const { department } = parsed.data;
    const filteredEmployees = filterEmployeesByDepartment(employees, department);

    return reply.code(HttpStatus.OK).send({
      data: filteredEmployees,
      total: filteredEmployees.length,
      message: "All employees retrieved successfully",
    });
  });

  // Page-based pagination endpoint
  // Why: This demonstrates page-based pagination with page number and limit.
  app.get<{ Querystring: PageBasedQuery }>("/employees/page-based", async (req, reply) => {
    const parsed = pageBasedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(reply, parsed);
      return;
    }
    const { page, limit, department } = parsed.data;
    const pageValid = page >= 1;
    const limitValid = limit === undefined || (Number.isInteger(limit) && limit >= 1);
    if (!pageValid) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Page must be a positive integer",
      });
    }
    if (!limitValid) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Limit must be a positive integer",
      });
    }

    const filteredEmployees = filterEmployeesByDepartment(employees, department);
    const paginationRequest = createPageBasedRequest(page, limit);
    const result: PaginationResult<Employee> = paginate(filteredEmployees, paginationRequest);

    return reply.code(HttpStatus.OK).send({
      ...result,
      message: "Page-based pagination successful",
    });
  });

  // Offset-based pagination endpoint
  // Why: This demonstrates offset-based pagination with offset and limit.
  app.get<{ Querystring: OffsetBasedQuery }>("/employees/offset-based", async (req, reply) => {
    const parsed = offsetBasedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(reply, parsed);
      return;
    }
    const { offset, limit, department } = parsed.data;
    if (offset < 0 || !Number.isInteger(offset)) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Offset must be a non-negative integer",
      });
    }
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: "invalid_request",
        message: "Limit must be a positive integer",
      });
    }

    const filteredEmployees = filterEmployeesByDepartment(employees, department);
    const paginationRequest = createOffsetBasedRequest(offset, limit);
    const result: PaginationResult<Employee> = paginate(filteredEmployees, paginationRequest);

    return reply.code(HttpStatus.OK).send({
      ...result,
      message: "Offset-based pagination successful",
    });
  });

  // Generic pagination endpoint that accepts type parameter
  // Why: This provides a unified endpoint that can handle both pagination types.
  app.get<{ Querystring: PageBasedQuery & OffsetBasedQuery & { type?: string } }>(
    "/employees/paginate",
    async (req, reply) => {
      const parsed = paginateQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        const firstIssue = parsed.error.errors[0];
        const isTypeError =
          firstIssue?.path?.includes("type") ||
          (firstIssue?.message && String(firstIssue.message).includes("type"));
        if (isTypeError) {
          return reply.code(HttpStatus.BAD_REQUEST).send({
            error: "invalid_request",
            message: `Type must be one of: ${Object.values(PaginationType).join(", ")}`,
          });
        }
        sendValidationError(reply, parsed);
        return;
      }
      const { type, page, offset, limit, department } = parsed.data;

      let paginationRequest: PaginationRequest;
      if (type === PaginationType.PAGE_BASED) {
        if (!Number.isInteger(page) || page < 1) {
          return reply.code(HttpStatus.BAD_REQUEST).send({
            error: "invalid_request",
            message: "Page must be a positive integer",
          });
        }
        paginationRequest = createPageBasedRequest(page, limit);
      } else {
        if (!Number.isInteger(offset) || offset < 0) {
          return reply.code(HttpStatus.BAD_REQUEST).send({
            error: "invalid_request",
            message: "Offset must be a non-negative integer",
          });
        }
        paginationRequest = createOffsetBasedRequest(offset, limit);
      }

      const filteredEmployees = filterEmployeesByDepartment(employees, department);
      const result: PaginationResult<Employee> = paginate(filteredEmployees, paginationRequest);

      return reply.code(HttpStatus.OK).send({
        ...result,
        message: `${type} pagination successful`,
      });
    }
  );

  // Get employee statistics
  // Why: This provides useful statistics about the dataset for testing pagination.
  app.get("/employees/stats", async (req, reply) => {
    const departments = [...new Set(employees.map((emp) => emp.department))];
    const departmentCounts = departments.reduce(
      (acc, dept) => {
        acc[dept] = employees.filter((emp) => emp.department === dept).length;
        return acc;
      },
      {} as Record<string, number>
    );

    return reply.code(HttpStatus.OK).send({
      total: employees.length,
      departments: departments.sort(),
      departmentCounts,
      message: "Employee statistics retrieved successfully",
    });
  });

  return app;
}

async function startServer(): Promise<void> {
  const app = await createApp();
  await app.listen({ port: 3001, host: "0.0.0.0" });
}

// Start the server
// Why: This allows the pagination server to start.
startServer().catch(console.error);
