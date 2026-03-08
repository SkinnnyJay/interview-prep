/**
 * Common Types and Interfaces for API Scenarios
 *
 * This file defines shared types used across all API scenarios,
 * including base entities, request/response formats, and utility types.
 */

import type { HealthStatusType, HealthDependencyStatusType } from "../constants";

// Base entity interface that all domain objects extend
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version?: number; // For optimistic locking
}

/** System-managed fields omitted when creating an entity (id, createdAt, updatedAt) */
export type BaseEntitySystemFields = "id" | "createdAt" | "updatedAt";

/** Input shape for creating an entity (entity without system-assigned fields) */
export type CreateEntityInput<T extends BaseEntity> = Omit<T, BaseEntitySystemFields>;

// Pagination interfaces
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Filtering and searching
export interface FilterQuery {
  [key: string]: unknown;
}

export interface SearchQuery {
  q?: string; // Search term
  fields?: string[]; // Fields to search in
  filters?: FilterQuery;
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
    executionTime: number;
  };
}

// Error handling
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  field?: string; // For validation errors
  statusCode: number;
}

export interface ValidationError extends ApiError {
  field: string;
  value: unknown;
  constraint: string;
}

// Request context (for middleware)
export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
  startTime: number;
  ip: string;
  userAgent?: string;
}

// Fastify augmentation for requestContext
declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}

// Audit trail
export interface AuditLog extends BaseEntity {
  entityType: string;
  entityId: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE";
  userId?: string;
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  metadata?: {
    ip: string;
    userAgent?: string;
    source: string;
  };
}

// Bulk operations
export interface BulkOperation<T> {
  operation: "create" | "update" | "delete";
  data: T | T[];
}

export interface BulkResult<T> {
  success: boolean;
  processed: number;
  failed: number;
  results: Array<{
    success: boolean;
    data?: T;
    error?: ApiError;
  }>;
}

// File upload
export interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  size: number;
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
}

export interface UploadedFile extends BaseEntity {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    [key: string]: unknown;
  };
}

// Streaming
export interface StreamMessage<T = unknown> {
  id: string;
  type: string;
  data: T;
  timestamp: Date;
}

export interface StreamSubscription {
  id: string;
  topic: string;
  filters?: FilterQuery;
  userId?: string;
  createdAt: Date;
}

// Rate limiting
export interface RateLimit {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: unknown) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Caching
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  tags?: string[]; // Cache tags for invalidation
}

// Health check
export interface HealthCheck {
  status: HealthStatusType;
  timestamp: Date;
  uptime: number;
  version: string;
  dependencies: {
    [service: string]: {
      status: HealthDependencyStatusType;
      responseTime?: number;
      error?: string;
    };
  };
}

// Metrics
export interface ApiMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    averageResponseTime: number;
  };
  endpoints: {
    [path: string]: {
      count: number;
      averageResponseTime: number;
      errorRate: number;
    };
  };
  errors: {
    [code: string]: number;
  };
}

// Configuration
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: RateLimit;
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    destination: string;
  };
}

// Deep partial utility type (excludes function properties so methods are not optional)
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (...args: unknown[]) => unknown
    ? T[P]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

// HTTP Methods
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

// Content Types
export type ContentType =
  | "application/json"
  | "application/xml"
  | "text/plain"
  | "text/html"
  | "multipart/form-data"
  | "application/x-www-form-urlencoded";

// Query operators for advanced filtering
export type QueryOperator =
  | "eq" // equals
  | "ne" // not equals
  | "gt" // greater than
  | "gte" // greater than or equal
  | "lt" // less than
  | "lte" // less than or equal
  | "in" // in array
  | "nin" // not in array
  | "like" // string contains
  | "regex" // regular expression
  | "exists"; // field exists

export interface QueryFilter {
  field: string;
  operator: QueryOperator;
  value: unknown;
}

// Sorting
export interface SortOption {
  field: string;
  order: "asc" | "desc";
}

// Advanced query interface
export interface AdvancedQuery {
  filters?: QueryFilter[];
  search?: SearchQuery;
  sort?: SortOption[];
  pagination?: PaginationQuery;
  include?: string[]; // Relations to include
  fields?: string[]; // Fields to select
}

// Event sourcing
export interface DomainEvent extends BaseEntity {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: unknown;
  version: number;
  userId?: string;
}

// CQRS Command/Query interfaces
export interface Command {
  type: string;
  payload: unknown;
  userId?: string;
  metadata?: unknown;
}

export interface Query {
  type: string;
  parameters: unknown;
  userId?: string;
}

export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  events?: DomainEvent[];
  error?: ApiError;
}

export interface QueryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/** WebSocket connection shape used by streaming handlers (avoids @fastify/websocket type dependency). */
export interface SocketStream {
  socket: {
    readyState: number;
    close(code?: number, reason?: string): void;
    // Event listener args vary by event (message=Buffer, close=number,Buffer, error=Error); typed as any to allow specific handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void): unknown;
    send(data: string): void;
    ping(): void;
  };
}
