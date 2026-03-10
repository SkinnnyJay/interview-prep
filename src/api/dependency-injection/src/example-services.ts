// example-services.ts - Example services demonstrating DI patterns
import crypto from "node:crypto";
import {
  Service,
  LoggerService,
  ConfigurationService,
  CacheService,
  Repository,
  ServiceHealth,
  ServiceContext,
} from "./di-types";

/**
 * Configuration service implementation
 * Manages application configuration with environment variable support
 */
export class AppConfigurationService implements ConfigurationService {
  private config: Record<string, unknown> = {};

  constructor() {
    // Load configuration from environment variables
    // Why: Demonstrates configuration service pattern
    this.config = {
      database: {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        name: process.env.DB_NAME || "app_db",
        username: process.env.DB_USER || "app_user",
        password: process.env.DB_PASSWORD || "password",
      },
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      app: {
        port: parseInt(process.env.PORT || "3004"),
        environment: process.env.NODE_ENV || "development",
        logLevel: process.env.LOG_LEVEL || "info",
        jwtSecret: process.env.JWT_SECRET, // Required for auth; set JWT_SECRET in production
      },
      features: {
        enableCaching: process.env.ENABLE_CACHING === "true",
        enableMetrics: process.env.ENABLE_METRICS === "true",
        enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS === "true",
      },
    };
  }

  async initialize(): Promise<void> {
    console.warn("[Config] Configuration service initialized");
  }

  async dispose(): Promise<void> {
    console.warn("[Config] Configuration service disposed");
  }

  async healthCheck(): Promise<ServiceHealth> {
    return {
      name: "ConfigurationService",
      status: "healthy",
      lastCheck: new Date(),
      message: "Configuration loaded successfully",
    };
  }

  get<T = unknown>(key: string): T | undefined {
    const keys = key.split(".");
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k] as Record<string, unknown>;
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  getRequired<T = unknown>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Required configuration key '${key}' is missing`);
    }
    return value;
  }

  set(key: string, value: unknown): void {
    const keys = key.split(".");
    let target = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target) || typeof target[k] !== "object") {
        target[k] = {} as Record<string, unknown>;
      }
      target = target[k] as Record<string, unknown>;
    }

    target[keys[keys.length - 1]] = value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  getAll(): Record<string, unknown> {
    return { ...this.config };
  }
}

/**
 * Logger service implementation
 * Provides structured logging with context support
 */
export class AppLoggerService implements LoggerService {
  private context: Record<string, unknown> = {};

  constructor(private config: ConfigurationService) {
    this.context = {
      service: "DI-API",
      environment: config.get("app.environment"),
      logLevel: config.get("app.logLevel"),
    };
  }

  async initialize(): Promise<void> {
    console.warn("[Logger] Logger service initialized");
  }

  async dispose(): Promise<void> {
    console.warn("[Logger] Logger service disposed");
  }

  async healthCheck(): Promise<ServiceHealth> {
    return {
      name: "LoggerService",
      status: "healthy",
      lastCheck: new Date(),
      message: "Logger is operational",
    };
  }

  debug(message: string, meta?: unknown): void {
    this.log("DEBUG", message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.log("INFO", message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log("WARN", message, meta);
  }

  error(message: string, error?: Error, meta?: unknown): void {
    const metaObj =
      typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>) : {};
    const errorMeta = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          ...metaObj,
        }
      : metaObj;

    this.log("ERROR", message, errorMeta);
  }

  child(context: Record<string, unknown>): LoggerService {
    const childLogger = new AppLoggerService(this.config);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  private log(level: string, message: string, meta?: unknown): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      meta,
    };

    // In production, you'd use a proper logging library
    console.warn(JSON.stringify(logEntry, null, 2));
  }
}

/**
 * In-memory cache service implementation
 * Provides caching functionality with TTL support
 */
export class InMemoryCacheService implements CacheService {
  private cache = new Map<string, { value: unknown; expiresAt?: number }>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private logger: LoggerService) {}

  async initialize(): Promise<void> {
    // Set up cleanup interval for expired entries
    // Why: Prevent memory leaks from expired cache entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute

    this.logger.info("[Cache] In-memory cache service initialized");
  }

  async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.logger.info("[Cache] Cache service disposed");
  }

  async healthCheck(): Promise<ServiceHealth> {
    return {
      name: "CacheService",
      status: "healthy",
      lastCheck: new Date(),
      message: `Cache contains ${this.cache.size} entries`,
    };
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const entry: { value: unknown; expiresAt?: number } = { value };

    if (ttl && ttl > 0) {
      entry.expiresAt = Date.now() + ttl * 1000;
    }

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
  }
}

/**
 * User entity interface
 * Represents a user in the system
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * User repository implementation
 * Demonstrates repository pattern with caching
 */
export class UserRepository implements Repository<User> {
  private users = new Map<string, User>();

  constructor(
    private cache: CacheService,
    private logger: LoggerService
  ) {
    // Seed with some test data
    // Why: Provides data for demonstration purposes
    this.seedTestData();
  }

  async initialize(): Promise<void> {
    this.logger.info("[UserRepo] User repository initialized");
  }

  async dispose(): Promise<void> {
    this.users.clear();
    this.logger.info("[UserRepo] User repository disposed");
  }

  async healthCheck(): Promise<ServiceHealth> {
    return {
      name: "UserRepository",
      status: "healthy",
      lastCheck: new Date(),
      message: `Repository contains ${this.users.size} users`,
    };
  }

  async findById(id: string): Promise<User | null> {
    // Try cache first
    // Why: Demonstrates caching pattern in repository
    const cacheKey = `user:${id}`;
    const cached = await this.cache.get<User>(cacheKey);

    if (cached) {
      this.logger.debug(`[UserRepo] Cache hit for user ${id}`);
      return cached;
    }

    // Fallback to in-memory storage
    const user = this.users.get(id) || null;

    if (user) {
      // Cache the result
      await this.cache.set(cacheKey, user, 300); // 5 minutes TTL
      this.logger.debug(`[UserRepo] User ${id} cached`);
    }

    return user;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async create(userData: Omit<User, "id">): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);

    // Cache the new user
    const cacheKey = `user:${user.id}`;
    await this.cache.set(cacheKey, user, 300);

    this.logger.info(`[UserRepo] Created user ${user.id}`);
    return user;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const existingUser = this.users.get(id);

    if (!existingUser) {
      return null;
    }

    const updatedUser: User = {
      ...existingUser,
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);

    // Update cache
    const cacheKey = `user:${id}`;
    await this.cache.set(cacheKey, updatedUser, 300);

    this.logger.info(`[UserRepo] Updated user ${id}`);
    return updatedUser;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.users.delete(id);

    if (deleted) {
      // Remove from cache
      const cacheKey = `user:${id}`;
      await this.cache.delete(cacheKey);

      this.logger.info(`[UserRepo] Deleted user ${id}`);
    }

    return deleted;
  }

  private seedTestData(): void {
    const testUsers: User[] = [
      {
        id: "1",
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        isActive: true,
      },
      {
        id: "2",
        email: "jane.smith@example.com",
        firstName: "Jane",
        lastName: "Smith",
        createdAt: new Date("2024-01-02"),
        updatedAt: new Date("2024-01-02"),
        isActive: true,
      },
      {
        id: "3",
        email: "bob.wilson@example.com",
        firstName: "Bob",
        lastName: "Wilson",
        createdAt: new Date("2024-01-03"),
        updatedAt: new Date("2024-01-03"),
        isActive: false,
      },
    ];

    for (const user of testUsers) {
      this.users.set(user.id, user);
    }
  }
}

/**
 * User service implementation
 * Business logic layer with dependency injection
 */
export class UserService implements Service {
  constructor(
    private userRepository: UserRepository,
    private logger: LoggerService,
    private config: ConfigurationService
  ) {}

  async initialize(): Promise<void> {
    this.logger.info("[UserService] User service initialized");
  }

  async dispose(): Promise<void> {
    this.logger.info("[UserService] User service disposed");
  }

  async healthCheck(): Promise<ServiceHealth> {
    // Check dependencies
    const repoHealth = await this.userRepository.healthCheck();

    return {
      name: "UserService",
      status: repoHealth.status === "healthy" ? "healthy" : "unhealthy",
      lastCheck: new Date(),
      message: "User service operational",
      dependencies: [repoHealth],
    };
  }

  async getUserById(id: string, context?: ServiceContext): Promise<User | null> {
    this.logger.debug(`[UserService] Getting user ${id}`, {
      requestId: context?.requestId,
      userId: context?.userId,
    });

    const user = await this.userRepository.findById(id);

    if (!user) {
      this.logger.warn(`[UserService] User ${id} not found`);
    }

    return user;
  }

  async getAllUsers(context?: ServiceContext): Promise<User[]> {
    this.logger.debug("[UserService] Getting all users", {
      requestId: context?.requestId,
    });

    return this.userRepository.findAll();
  }

  async createUser(
    userData: Omit<User, "id" | "createdAt" | "updatedAt">,
    context?: ServiceContext
  ): Promise<User> {
    this.logger.info(`[UserService] Creating user ${userData.email}`, {
      requestId: context?.requestId,
    });

    // Business logic validation
    const existingUsers = await this.userRepository.findAll();
    const emailExists = existingUsers.some((u) => u.email === userData.email);

    if (emailExists) {
      throw new Error(`User with email ${userData.email} already exists`);
    }

    const userWithTimestamps: Omit<User, "id"> = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.userRepository.create(userWithTimestamps);
  }

  async updateUser(
    id: string,
    updates: Partial<User>,
    context?: ServiceContext
  ): Promise<User | null> {
    this.logger.info(`[UserService] Updating user ${id}`, {
      requestId: context?.requestId,
      updates: Object.keys(updates),
    });

    // Business logic: prevent email conflicts
    if (updates.email) {
      const existingUsers = await this.userRepository.findAll();
      const emailExists = existingUsers.some((u) => u.email === updates.email && u.id !== id);

      if (emailExists) {
        throw new Error(`Email ${updates.email} is already in use`);
      }
    }

    return this.userRepository.update(id, updates);
  }

  async deleteUser(id: string, context?: ServiceContext): Promise<boolean> {
    this.logger.info(`[UserService] Deleting user ${id}`, {
      requestId: context?.requestId,
    });

    return this.userRepository.delete(id);
  }

  async getUserStats(context?: ServiceContext): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    this.logger.debug("[UserService] Getting user statistics", {
      requestId: context?.requestId,
    });

    const users = await this.userRepository.findAll();

    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
    };
  }
}

/**
 * Notification service implementation
 * Demonstrates service with external dependencies
 */
export class NotificationService implements Service {
  constructor(
    private logger: LoggerService,
    private config: ConfigurationService
  ) {}

  async initialize(): Promise<void> {
    this.logger.info("[NotificationService] Notification service initialized");
  }

  async dispose(): Promise<void> {
    this.logger.info("[NotificationService] Notification service disposed");
  }

  async healthCheck(): Promise<ServiceHealth> {
    return {
      name: "NotificationService",
      status: "healthy",
      lastCheck: new Date(),
      message: "Notification service operational",
    };
  }

  async sendWelcomeEmail(user: User, context?: ServiceContext): Promise<void> {
    this.logger.info(`[NotificationService] Sending welcome email to ${user.email}`, {
      requestId: context?.requestId,
      userId: user.id,
    });

    // Simulate email sending
    await this.delay(100);

    this.logger.info(`[NotificationService] Welcome email sent to ${user.email}`);
  }

  async sendUserUpdatedNotification(user: User, context?: ServiceContext): Promise<void> {
    this.logger.info(`[NotificationService] Sending update notification to ${user.email}`, {
      requestId: context?.requestId,
      userId: user.id,
    });

    // Simulate notification sending
    await this.delay(50);

    this.logger.info(`[NotificationService] Update notification sent to ${user.email}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
