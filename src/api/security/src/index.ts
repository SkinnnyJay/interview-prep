// index.ts - Entry point for the security module
export { AuthenticationManager } from "./auth-methods";
export { RoleBasedAccessControl, Permission } from "./rbac";
export { AuthType, Role } from "./auth-types";
export type {
  User,
  Session,
  JWTPayload,
  AuthResult,
  AuthSuccess,
  AuthFailure,
  AuthConfig,
  AuthRequest,
  RegisterRequest,
  AuthContext,
  ApiKey,
  BearerToken,
  RefreshTokenRequest,
  TokenResponse,
  ApiKeyRequest,
} from "./auth-types";
import { AuthConfigDefaults } from "./constants";

// Default configuration (JWT_SECRET must be set by caller; no fallback for security)
export const defaultAuthConfig = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: AuthConfigDefaults.JWT_EXPIRES_IN,
  sessionExpiresIn: AuthConfigDefaults.SESSION_EXPIRES_MS,
  bcryptRounds: AuthConfigDefaults.BCRYPT_ROUNDS,
  bearerTokenExpiresIn: AuthConfigDefaults.BEARER_TOKEN_EXPIRES_MS,
  refreshTokenExpiresIn: AuthConfigDefaults.REFRESH_TOKEN_EXPIRES_MS,
  apiKeyPrefix: AuthConfigDefaults.API_KEY_PREFIX,
};

/**
 * Returns default auth config with JWT_SECRET validated. Throws if JWT_SECRET is not set.
 */
export function getDefaultAuthConfig(): typeof defaultAuthConfig & { jwtSecret: string } {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return { ...defaultAuthConfig, jwtSecret: process.env.JWT_SECRET };
}
