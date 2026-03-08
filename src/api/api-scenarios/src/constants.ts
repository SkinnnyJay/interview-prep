/**
 * HTTP status codes and error codes used across api-scenarios.
 * Replaces magic number and string literals for consistency.
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/** CRUD error codes returned in ApiResponse.error.code */
export const CrudErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CREATE_FAILED: "CREATE_FAILED",
  INVALID_ID: "INVALID_ID",
  NOT_FOUND: "NOT_FOUND",
  FETCH_FAILED: "FETCH_FAILED",
  UPDATE_FAILED: "UPDATE_FAILED",
  DELETE_FAILED: "DELETE_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  BULK_CREATE_FAILED: "BULK_CREATE_FAILED",
  COUNT_FAILED: "COUNT_FAILED",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  NOT_DELETED: "NOT_DELETED",
  RESTORE_FAILED: "RESTORE_FAILED",
  CONFLICT: "CONFLICT",
} as const;

export type CrudErrorCodeType = (typeof CrudErrorCode)[keyof typeof CrudErrorCode];

/** Audit log action values (must match AuditLog.action in types/common) */
export const AuditAction = {
  CREATE: "CREATE",
  READ: "READ",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/** Base entity system field names (id, timestamps, soft delete) */
export const BaseEntityField = {
  ID: "id",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
  DELETED_AT: "deletedAt",
} as const;

/** Query filter operators used in AdvancedQuery (subset of QueryOperator type) */
export const QueryOperator = {
  EXISTS: "exists",
  EQ: "eq",
  NE: "ne",
  GTE: "gte",
  LTE: "lte",
} as const;

/** Reusable soft-delete filter: exclude soft-deleted records when softDelete is enabled */
export const SoftDeleteFilter = {
  field: BaseEntityField.DELETED_AT,
  operator: QueryOperator.EXISTS,
  value: false,
} as const;

/** User roles and statuses used in api-scenarios */
export const UserRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user",
  GUEST: "guest",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const UserRoleList = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.USER,
  UserRole.GUEST,
] as const;

export const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  PENDING: "pending",
} as const;

export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];

export const UserStatusList = [
  UserStatus.ACTIVE,
  UserStatus.INACTIVE,
  UserStatus.SUSPENDED,
  UserStatus.PENDING,
] as const;

export const UserTheme = {
  LIGHT: "light",
  DARK: "dark",
  AUTO: "auto",
} as const;

export type UserThemeType = (typeof UserTheme)[keyof typeof UserTheme];

/** User controller error codes */
export const UserErrorCode = {
  USER_EXISTS: "USER_EXISTS",
  CREATE_USER_FAILED: "CREATE_USER_FAILED",
  FETCH_USER_FAILED: "FETCH_USER_FAILED",
  FETCH_USERS_FAILED: "FETCH_USERS_FAILED",
  UPDATE_USER_FAILED: "UPDATE_USER_FAILED",
  DELETE_USER_FAILED: "DELETE_USER_FAILED",
  CHANGE_PASSWORD_FAILED: "CHANGE_PASSWORD_FAILED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  INVALID_CURRENT_PASSWORD: "INVALID_CURRENT_PASSWORD",
  NO_FILE_UPLOADED: "NO_FILE_UPLOADED",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UPLOAD_AVATAR_FAILED: "UPLOAD_AVATAR_FAILED",
} as const;

export type UserErrorCodeType = (typeof UserErrorCode)[keyof typeof UserErrorCode];

/** Common user field names for AdvancedQuery filters */
export const UserField = {
  EMAIL: "email",
  USERNAME: "username",
  ROLE: "role",
  STATUS: "status",
  FIRST_NAME: "firstName",
  LAST_NAME: "lastName",
} as const;

export const UserValidation = {
  USERNAME_MIN_LENGTH: 3,
  NAME_MIN_LENGTH: 1,
  PASSWORD_MIN_LENGTH: 8,
} as const;

/** Health status values used in health checks */
export const HealthStatus = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  UNHEALTHY: "unhealthy",
} as const;

export type HealthStatusType = (typeof HealthStatus)[keyof typeof HealthStatus];

export const HealthDependencyStatus = {
  HEALTHY: "healthy",
  UNHEALTHY: "unhealthy",
} as const;

export type HealthDependencyStatusType =
  (typeof HealthDependencyStatus)[keyof typeof HealthDependencyStatus];

/** Max upload file size (10MB) used for multipart and validation */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Default server port for api-scenarios */
export const DEFAULT_PORT = 3007;

/** Default streaming/WebSocket config values (reused in server and StreamingService) */
export const StreamingDefaultConfig = {
  MAX_CONNECTIONS: 1000,
  MESSAGE_RATE_LIMIT: 10,
  HEARTBEAT_INTERVAL_MS: 30000,
  CONNECTION_TIMEOUT_MS: 300000,
  MAX_MESSAGE_HISTORY: 100,
  RATE_LIMIT_RESET_MS: 60000,
  /** Number of last messages to send when joining a room */
  LAST_MESSAGES_REPLAY_COUNT: 10,
} as const;

/** Human-readable file size error message (matches MAX_FILE_SIZE_BYTES) */
export const FILE_SIZE_ERROR_MESSAGE = "File size must be less than 10MB";

/** Authorization header prefix for Bearer token (RFC 6750) */
export const AUTH_HEADER_BEARER_PREFIX = "Bearer ";

/** User defaults for new accounts */
export const USER_DEFAULTS = {
  ROLE: UserRole.USER,
  STATUS: UserStatus.PENDING,
  TWO_FACTOR_ENABLED: false,
  PROFILE: {
    TIMEZONE: "UTC",
    LANGUAGE: "en",
  },
  PREFERENCES: {
    NOTIFICATIONS: {
      EMAIL: true,
      PUSH: true,
      SMS: false,
    },
    PRIVACY: {
      PROFILE_VISIBLE: true,
      SHOW_EMAIL: false,
      SHOW_PHONE: false,
    },
    THEME: UserTheme.LIGHT,
  },
} as const;
