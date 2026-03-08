// di-types.ts - Type definitions for dependency injection system

/**
 * Service lifecycle management
 * Defines when and how services are created and destroyed
 */
export enum ServiceLifetime {
  SINGLETON = "singleton", // Single instance for entire application
  SCOPED = "scoped", // Single instance per request scope
  TRANSIENT = "transient", // New instance every time requested
}

/**
 * Service registration options
 * Configuration for how services are registered and managed
 */
export interface ServiceRegistration<T = unknown> {
  name: string; // Service identifier
  factory: ServiceFactory<T>; // Factory function to create service
  lifetime: ServiceLifetime; // Service lifecycle
  dependencies?: string[]; // List of dependency service names
  tags?: string[]; // Tags for service discovery
  metadata?: Record<string, unknown>; // Additional service metadata
  dispose?: (instance: T) => Promise<void> | void; // Cleanup function
}

/**
 * Service factory function
 * Creates service instances with dependency injection
 */
export type ServiceFactory<T = unknown> = (
  container: ServiceContainer,
  context?: ServiceContext
) => T | Promise<T>;

/**
 * Service context for scoped services
 * Provides request-specific context for service creation
 */
export interface ServiceContext {
  requestId?: string; // Unique request identifier
  userId?: string; // Current user ID
  correlationId?: string; // Request correlation ID
  metadata?: Record<string, unknown>; // Additional context data
  startTime?: number; // Request start time
}

/**
 * Service container interface
 * Core dependency injection container functionality
 */
export interface ServiceContainer {
  // Service registration
  register<T>(registration: ServiceRegistration<T>): void;
  registerSingleton<T>(name: string, factory: ServiceFactory<T>): void;
  registerScoped<T>(name: string, factory: ServiceFactory<T>): void;
  registerTransient<T>(name: string, factory: ServiceFactory<T>): void;

  // Service resolution
  resolve<T>(name: string, context?: ServiceContext): T | Promise<T>;
  resolveAll<T>(tag: string, context?: ServiceContext): T[] | Promise<T[]>;
  tryResolve<T>(name: string, context?: ServiceContext): T | null | Promise<T | null>;

  // Service management
  isRegistered(name: string): boolean;
  getRegistration(name: string): ServiceRegistration | undefined;
  getAllRegistrations(): ServiceRegistration[];

  // Lifecycle management
  createScope(context?: ServiceContext): ScopedContainer;
  dispose(): Promise<void>;

  // Container hierarchy
  createChild(): ServiceContainer;
  getParent(): ServiceContainer | null;
}

/**
 * Scoped container for request-specific services
 * Manages services with scoped lifetime within a request
 */
export interface ScopedContainer extends ServiceContainer {
  getContext(): ServiceContext;
  disposeScope(): Promise<void>;
}

/**
 * Service decorator metadata
 * Metadata for decorator-based service registration
 */
export interface ServiceMetadata {
  name?: string; // Service name (defaults to class name)
  lifetime?: ServiceLifetime; // Service lifetime
  dependencies?: string[]; // Dependency names
  tags?: string[]; // Service tags
  factory?: ServiceFactory; // Custom factory function
}

/**
 * Dependency injection configuration
 * Global configuration for the DI system
 */
export interface DIConfiguration {
  enableAutoRegistration?: boolean; // Automatically register decorated services
  enableCircularDependencyDetection?: boolean; // Detect circular dependencies
  enableLifecycleLogging?: boolean; // Log service lifecycle events
  enablePerformanceTracking?: boolean; // Track service resolution performance
  maxResolutionDepth?: number; // Maximum dependency resolution depth
  scopeTimeout?: number; // Timeout for scoped service cleanup
}

/**
 * Service resolution result
 * Information about service resolution process
 */
export interface ServiceResolutionResult<T = unknown> {
  service: T; // Resolved service instance
  resolutionTime: number; // Time taken to resolve (ms)
  dependencyChain: string[]; // Chain of dependencies resolved
  fromCache: boolean; // Whether resolved from cache
  lifetime: ServiceLifetime; // Service lifetime
}

/**
 * Dependency graph node
 * Represents a service in the dependency graph
 */
export interface DependencyNode {
  name: string; // Service name
  dependencies: string[]; // Direct dependencies
  dependents: string[]; // Services that depend on this one
  registration: ServiceRegistration; // Service registration info
  resolved: boolean; // Whether service has been resolved
  resolving: boolean; // Whether service is currently being resolved
}

/**
 * Dependency graph
 * Complete dependency graph for the container
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>; // All service nodes
  roots: string[]; // Services with no dependencies
  leaves: string[]; // Services with no dependents
  cycles: string[][]; // Detected circular dependencies
}

/**
 * Service container statistics
 * Performance and usage statistics
 */
export interface ContainerStatistics {
  totalServices: number; // Total registered services
  singletonServices: number; // Number of singleton services
  scopedServices: number; // Number of scoped services
  transientServices: number; // Number of transient services
  totalResolutions: number; // Total service resolutions
  cacheHits: number; // Cache hits for singletons
  averageResolutionTime: number; // Average resolution time (ms)
  activeScopes: number; // Currently active scopes
  memoryUsage: {
    singletonInstances: number; // Memory used by singleton instances
    scopedInstances: number; // Memory used by scoped instances
    containerOverhead: number; // Container metadata overhead
  };
}

/**
 * Service health check
 * Health status of a service
 */
export interface ServiceHealth {
  name: string; // Service name
  status: "healthy" | "unhealthy" | "unknown"; // Health status
  lastCheck: Date; // Last health check time
  message?: string; // Health status message
  dependencies?: ServiceHealth[]; // Health of dependencies
}

/**
 * Container events
 * Events emitted by the container during lifecycle
 */
export enum ContainerEvent {
  SERVICE_REGISTERED = "service:registered",
  SERVICE_RESOLVED = "service:resolved",
  SERVICE_DISPOSED = "service:disposed",
  SCOPE_CREATED = "scope:created",
  SCOPE_DISPOSED = "scope:disposed",
  CIRCULAR_DEPENDENCY = "error:circular-dependency",
  RESOLUTION_ERROR = "error:resolution",
}

/**
 * Container event data
 * Data associated with container events
 */
export interface ContainerEventData {
  serviceName?: string; // Service name
  lifetime?: ServiceLifetime; // Service lifetime
  resolutionTime?: number; // Resolution time
  error?: Error; // Error information
  context?: ServiceContext; // Service context
  metadata?: Record<string, unknown>; // Additional event data
}

/**
 * Event listener for container events
 * Function signature for event listeners
 */
export type ContainerEventListener = (
  event: ContainerEvent,
  data: ContainerEventData
) => void | Promise<void>;

/**
 * Fastify DI plugin options
 * Configuration for Fastify integration
 */
export interface FastifyDIOptions {
  container?: ServiceContainer; // Custom container instance
  configuration?: DIConfiguration; // DI configuration
  autoRegisterRoutes?: boolean; // Auto-register route handlers
  enableRequestScoping?: boolean; // Enable request-scoped services
  enableHealthChecks?: boolean; // Enable service health checks
  enableMetrics?: boolean; // Enable container metrics
}

/**
 * Route handler with dependency injection
 * Type-safe route handler with injected dependencies
 */
export interface DIRouteHandler<TDependencies = unknown> {
  dependencies?: string[]; // List of dependency names
  handler: (
    request: unknown,
    reply: unknown,
    dependencies: TDependencies
  ) => Promise<unknown> | unknown;
}

/**
 * Service decorator options
 * Options for the @Service decorator
 */
export interface ServiceDecoratorOptions {
  name?: string; // Service name
  lifetime?: ServiceLifetime; // Service lifetime
  tags?: string[]; // Service tags
}

/**
 * Injectable decorator options
 * Options for the @Injectable decorator
 */
export interface InjectableDecoratorOptions {
  name?: string; // Dependency name
  optional?: boolean; // Whether dependency is optional
  tag?: string; // Resolve by tag instead of name
}

/**
 * Common service interfaces
 * Standard interfaces for common service types
 */

/**
 * Repository pattern interface
 * Standard interface for data access services
 */
export interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(entity: Omit<T, "id">): Promise<T>;
  update(id: ID, entity: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}

/**
 * Service pattern interface
 * Standard interface for business logic services
 */
export interface Service {
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  healthCheck?(): Promise<ServiceHealth>;
}

/**
 * Configuration service interface
 * Standard interface for configuration services
 */
export interface ConfigurationService extends Service {
  get<T = unknown>(key: string): T | undefined;
  getRequired<T = unknown>(key: string): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
}

/**
 * Logger service interface
 * Standard interface for logging services
 */
export interface LoggerService extends Service {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, error?: Error, meta?: unknown): void;
  child(context: Record<string, unknown>): LoggerService;
}

/**
 * Cache service interface
 * Standard interface for caching services
 */
export interface CacheService extends Service {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Event bus service interface
 * Standard interface for event publishing/subscribing
 */
export interface EventBusService extends Service {
  publish<T = unknown>(event: string, data: T): Promise<void>;
  subscribe<T = unknown>(event: string, handler: (data: T) => void | Promise<void>): void;
  unsubscribe(event: string, handler: (data: unknown) => void | Promise<void>): void;
  once<T = unknown>(event: string, handler: (data: T) => void | Promise<void>): void;
}
