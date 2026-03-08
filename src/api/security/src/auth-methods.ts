// auth-methods.ts
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  AuthType,
  Role,
  User,
  Session,
  JWTPayload,
  AuthResult,
  AuthConfig,
  AuthRequest,
  RegisterRequest,
  ApiKey,
  BearerToken,
  TokenResponse,
  ApiKeyRequest,
} from "./auth-types";
import { AuthHeaderPrefix, DefaultScopes, AuthErrorMessage } from "./constants";

function sanitizeUser(user: User): User {
  return { ...user, passwordHash: "" };
}

export class AuthenticationManager {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map(); // key -> ApiKey
  private bearerTokens: Map<string, BearerToken> = new Map(); // token -> BearerToken
  private refreshTokens: Map<string, BearerToken> = new Map(); // refreshToken -> BearerToken
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.initializeDefaultUsersSync();
  }

  private initializeDefaultUsersSync(): void {
    const defaults: Array<{ username: string; email: string; password: string; roles: Role[] }> = [
      { username: "admin", email: "admin@example.com", password: "admin123", roles: [Role.ADMIN] },
      { username: "user", email: "user@example.com", password: "user123", roles: [Role.USER] },
      { username: "guest", email: "guest@example.com", password: "guest123", roles: [Role.GUEST] },
    ];

    for (const def of defaults) {
      // Avoid duplicates if constructor is called multiple times in tests
      const exists = Array.from(this.users.values()).some(
        (u) => u.username === def.username || u.email === def.email
      );
      if (exists) continue;

      const passwordHash = bcrypt.hashSync(def.password, this.config.bcryptRounds);
      const user: User = {
        id: crypto.randomUUID(),
        username: def.username,
        email: def.email,
        passwordHash,
        roles: def.roles,
        createdAt: new Date(),
      };
      this.users.set(user.id, user);
    }
  }

  async registerUser(request: RegisterRequest): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = Array.from(this.users.values()).find(
        (u) => u.username === request.username || u.email === request.email
      );

      if (existingUser) {
        return {
          success: false,
          error: AuthErrorMessage.USER_ALREADY_EXISTS,
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(request.password, this.config.bcryptRounds);

      // Create user
      const user: User = {
        id: crypto.randomUUID(),
        username: request.username,
        email: request.email,
        passwordHash,
        roles: request.roles || [Role.USER],
        createdAt: new Date(),
      };

      this.users.set(user.id, user);

      return {
        success: true,
        user: sanitizeUser(user), // Don't return password hash
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : AuthErrorMessage.REGISTRATION_FAILED,
      };
    }
  }

  // Basic Authentication
  async authenticateBasic(authHeader: string): Promise<AuthResult> {
    try {
      // Validate header format first
      if (!authHeader || !authHeader.startsWith(AuthHeaderPrefix.BASIC)) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_BASIC_AUTH_HEADER,
        };
      }

      // Parse Basic auth header
      const base64Credentials = authHeader.replace(AuthHeaderPrefix.BASIC, "").trim();

      let credentials: string;
      try {
        credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
      } catch {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_BASIC_AUTH_HEADER,
        };
      }

      if (!credentials.includes(":")) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_BASIC_AUTH_HEADER,
        };
      }

      // Use indexOf to handle passwords containing colons
      const colonIndex = credentials.indexOf(":");
      const username = credentials.substring(0, colonIndex);
      const password = credentials.substring(colonIndex + 1);

      if (!username || !password) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_BASIC_AUTH_HEADER,
        };
      }

      return await this.validateCredentials({ username, password });
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.INVALID_BASIC_AUTH_HEADER,
      };
    }
  }

  // Session Token Authentication
  async authenticateSessionToken(token: string): Promise<AuthResult> {
    try {
      const session = this.sessions.get(token);

      if (!session) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_SESSION_TOKEN,
        };
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        this.sessions.delete(token);
        return {
          success: false,
          error: AuthErrorMessage.SESSION_EXPIRED,
        };
      }

      const user = this.users.get(session.userId);
      if (!user) {
        this.sessions.delete(token);
        return {
          success: false,
          error: AuthErrorMessage.USER_NOT_FOUND,
        };
      }

      // Update last used
      session.lastUsed = new Date();

      return {
        success: true,
        user: sanitizeUser(user),
        session,
      };
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.SESSION_AUTH_FAILED,
      };
    }
  }

  // API Key Authentication
  async authenticateApiKey(apiKey: string): Promise<AuthResult> {
    try {
      // Extract the actual key from the prefixed format (e.g., "sk_live_abc123")
      const keyParts = apiKey.split("_");
      if (keyParts.length < 3 || !apiKey.startsWith(this.config.apiKeyPrefix)) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_API_KEY_FORMAT,
        };
      }

      // Hash the provided key to match against stored hash
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

      // Find the API key by hash
      let foundApiKey: ApiKey | undefined;
      for (const storedKey of this.apiKeys.values()) {
        if (storedKey.keyHash === keyHash && storedKey.isActive) {
          foundApiKey = storedKey;
          break;
        }
      }

      if (!foundApiKey) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_API_KEY,
        };
      }

      // Check if API key is expired
      if (foundApiKey.expiresAt && foundApiKey.expiresAt < new Date()) {
        return {
          success: false,
          error: AuthErrorMessage.API_KEY_EXPIRED,
        };
      }

      const user = this.users.get(foundApiKey.userId);
      if (!user) {
        return {
          success: false,
          error: AuthErrorMessage.USER_NOT_FOUND,
        };
      }

      // Update last used
      foundApiKey.lastUsed = new Date();

      return {
        success: true,
        user: sanitizeUser(user),
      };
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.API_KEY_AUTH_FAILED,
      };
    }
  }

  // Bearer Token Authentication
  async authenticateBearerToken(token: string): Promise<AuthResult> {
    try {
      const bearerToken = this.bearerTokens.get(token);

      if (!bearerToken) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_BEARER_TOKEN,
        };
      }

      // Check if token is expired
      if (bearerToken.expiresAt < new Date()) {
        this.bearerTokens.delete(token);
        this.refreshTokens.delete(bearerToken.refreshToken);
        return {
          success: false,
          error: AuthErrorMessage.BEARER_TOKEN_EXPIRED,
        };
      }

      const user = this.users.get(bearerToken.userId);
      if (!user) {
        this.bearerTokens.delete(token);
        this.refreshTokens.delete(bearerToken.refreshToken);
        return {
          success: false,
          error: AuthErrorMessage.USER_NOT_FOUND,
        };
      }

      // Update last used
      bearerToken.lastUsed = new Date();

      return {
        success: true,
        user: sanitizeUser(user),
      };
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.BEARER_TOKEN_AUTH_FAILED,
      };
    }
  }

  // JWT Authentication
  async authenticateJWT(token: string): Promise<AuthResult> {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret) as JWTPayload;

      const user = this.users.get(payload.userId);
      if (!user) {
        return {
          success: false,
          error: AuthErrorMessage.USER_NOT_FOUND,
        };
      }

      // Update last login
      user.lastLogin = new Date();

      return {
        success: true,
        user: sanitizeUser(user),
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: AuthErrorMessage.TOKEN_EXPIRED,
        };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_TOKEN,
        };
      }
      return {
        success: false,
        error: AuthErrorMessage.JWT_AUTH_FAILED,
      };
    }
  }

  // Login and create session/JWT
  async login(request: AuthRequest, authType: AuthType): Promise<AuthResult & { token?: string }> {
    const authResult = await this.validateCredentials(request);

    if (!authResult.success) {
      return authResult;
    }

    // Update last login (authResult is AuthSuccess here; keep stored user's passwordHash)
    const lastLogin = new Date();
    authResult.user.lastLogin = lastLogin;
    const storedUser = this.users.get(authResult.user.id)!;
    this.users.set(authResult.user.id, { ...storedUser, lastLogin });

    switch (authType) {
      case AuthType.SESSION_TOKEN: {
        const session = this.createSession(authResult.user.id);
        return {
          ...authResult,
          session,
          token: session.token,
        };
      }

      case AuthType.JWT: {
        const jwtToken = this.createJWT(authResult.user);
        return {
          ...authResult,
          token: jwtToken,
        };
      }

      case AuthType.BEARER_TOKEN: {
        const bearerToken = this.createBearerToken(authResult.user.id);
        return {
          ...authResult,
          token: bearerToken.token,
        };
      }

      case AuthType.BASIC:
        // Basic auth doesn't need tokens
        return authResult;

        case AuthType.API_KEY:
        // API keys are created separately, not through login
        return {
          success: false,
          error: AuthErrorMessage.API_KEYS_VIA_CREATE,
        };

      default:
        return {
          success: false,
          error: AuthErrorMessage.UNSUPPORTED_AUTH_TYPE,
        };
    }
  }

  // Logout
  async logout(token: string, authType: AuthType): Promise<{ success: boolean; error?: string }> {
    try {
      switch (authType) {
        case AuthType.SESSION_TOKEN: {
          const deleted = this.sessions.delete(token);
          return {
            success: deleted,
            error: deleted ? undefined : AuthErrorMessage.SESSION_NOT_FOUND,
          };
        }

        case AuthType.JWT:
          // JWT tokens can't be invalidated server-side without a blacklist
          // In a real implementation, you'd maintain a blacklist
          return { success: true };

        case AuthType.BEARER_TOKEN: {
          const bearerToken = this.bearerTokens.get(token);
          if (bearerToken) {
            this.bearerTokens.delete(token);
            this.refreshTokens.delete(bearerToken.refreshToken);
            return { success: true };
          }
          return {
            success: false,
            error: AuthErrorMessage.BEARER_TOKEN_NOT_FOUND,
          };
        }

        case AuthType.API_KEY:
          // API keys are revoked separately, not through logout
          return {
            success: false,
            error: AuthErrorMessage.API_KEYS_VIA_REVOKE,
          };

        case AuthType.BASIC:
          // Basic auth doesn't maintain state
          return { success: true };

        default:
          return {
            success: false,
            error: AuthErrorMessage.UNSUPPORTED_AUTH_TYPE,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.LOGOUT_FAILED,
      };
    }
  }

  private async validateCredentials(request: AuthRequest): Promise<AuthResult> {
    try {
      const user = Array.from(this.users.values()).find((u) => u.username === request.username);

      // Always perform password comparison even if user not found
      // to prevent timing attacks that can enumerate valid usernames
      // note: you would never do this in production, you would use a dummy hash or a hash of the username hardcoded in the code.
      const dummyHash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyqK7u/fUZyK";
      const passwordHash = user ? user.passwordHash : dummyHash;
      const isValidPassword = await bcrypt.compare(request.password, passwordHash);

      if (!user || !isValidPassword) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_CREDENTIALS,
        };
      }

      return {
        success: true,
        user: sanitizeUser(user),
      };
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.CREDENTIAL_VALIDATION_FAILED,
      };
    }
  }

  private createSession(userId: string): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      token: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + this.config.sessionExpiresIn),
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.sessions.set(session.token, session);
    return session;
  }

  private createJWT(user: User): string {
    const payload: Omit<JWTPayload, "iat" | "exp"> = {
      userId: user.id,
      username: user.username,
      roles: user.roles,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  private createBearerToken(userId: string): BearerToken {
    const bearerToken: BearerToken = {
      id: crypto.randomUUID(),
      userId,
      token: crypto.randomBytes(32).toString("hex"),
      refreshToken: crypto.randomBytes(32).toString("hex"),
      scopes: [...DefaultScopes],
      expiresAt: new Date(Date.now() + this.config.bearerTokenExpiresIn),
      refreshExpiresAt: new Date(Date.now() + this.config.refreshTokenExpiresIn),
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.bearerTokens.set(bearerToken.token, bearerToken);
    this.refreshTokens.set(bearerToken.refreshToken, bearerToken);
    return bearerToken;
  }

  // Utility methods for testing and management
  getUser(userId: string): User | undefined {
    const user = this.users.get(userId);
    return user ? sanitizeUser(user) : undefined;
  }

  getUserByUsername(username: string): User | undefined {
    const user = Array.from(this.users.values()).find((u) => u.username === username);
    return user ? sanitizeUser(user) : undefined;
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values()).map((user) => sanitizeUser(user));
  }

  getActiveSessions(): Session[] {
    const now = new Date();
    return Array.from(this.sessions.values()).filter((session) => session.expiresAt > now);
  }

  clearExpiredSessions(): number {
    const now = new Date();
    let cleared = 0;

    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
        cleared++;
      }
    }

    return cleared;
  }

  // API Key Management
  async createApiKey(
    userId: string,
    request: ApiKeyRequest
  ): Promise<{
    success: boolean;
    apiKey?: string;
    keyInfo?: Omit<ApiKey, "keyHash">;
    error?: string;
  }> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return {
          success: false,
          error: AuthErrorMessage.USER_NOT_FOUND,
        };
      }

      // Generate API key with prefix (e.g., "sk_live_abc123...")
      const keyId = crypto.randomBytes(16).toString("hex");
      const apiKey = `${this.config.apiKeyPrefix}_${keyId}`;
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

      const apiKeyInfo: ApiKey = {
        id: crypto.randomUUID(),
        userId,
        keyHash,
        name: request.name,
        scopes: request.scopes || [...DefaultScopes],
        expiresAt: request.expiresAt,
        createdAt: new Date(),
        isActive: true,
      };

      // Store by key ID, not the plaintext key
      this.apiKeys.set(keyHash, apiKeyInfo);

      return {
        success: true,
        apiKey, // Return the actual key only once
        keyInfo: {
          id: apiKeyInfo.id,
          userId: apiKeyInfo.userId,
          name: apiKeyInfo.name,
          scopes: apiKeyInfo.scopes,
          expiresAt: apiKeyInfo.expiresAt,
          createdAt: apiKeyInfo.createdAt,
          isActive: apiKeyInfo.isActive,
          lastUsed: apiKeyInfo.lastUsed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.API_KEY_CREATION_FAILED_MSG,
      };
    }
  }

  async revokeApiKey(userId: string, keyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the API key by ID and user
      for (const [, apiKeyInfo] of this.apiKeys.entries()) {
        if (apiKeyInfo.id === keyId && apiKeyInfo.userId === userId) {
          apiKeyInfo.isActive = false;
          return { success: true };
        }
      }

      return {
        success: false,
        error: AuthErrorMessage.API_KEY_NOT_FOUND_MSG,
      };
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.API_KEY_REVOKE_FAILED_MSG,
      };
    }
  }

  getUserApiKeys(userId: string): Omit<ApiKey, "keyHash">[] {
    const userKeys: Omit<ApiKey, "keyHash">[] = [];

    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.userId === userId) {
        userKeys.push({
          id: apiKey.id,
          userId: apiKey.userId,
          name: apiKey.name,
          scopes: apiKey.scopes,
          lastUsed: apiKey.lastUsed,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
          isActive: apiKey.isActive,
        });
      }
    }

    return userKeys;
  }

  // Bearer Token Management
  async refreshBearerToken(
    refreshToken: string
  ): Promise<TokenResponse | { success: false; error: string }> {
    try {
      const bearerToken = this.refreshTokens.get(refreshToken);

      if (!bearerToken) {
        return {
          success: false,
          error: AuthErrorMessage.INVALID_REFRESH_TOKEN,
        };
      }

      // Check if refresh token is expired
      if (bearerToken.refreshExpiresAt < new Date()) {
        this.bearerTokens.delete(bearerToken.token);
        this.refreshTokens.delete(refreshToken);
        return {
          success: false,
          error: AuthErrorMessage.REFRESH_TOKEN_EXPIRED,
        };
      }

      // Remove old tokens
      this.bearerTokens.delete(bearerToken.token);
      this.refreshTokens.delete(refreshToken);

      // Create new bearer token
      const newBearerToken = this.createBearerToken(bearerToken.userId);

      return {
        accessToken: newBearerToken.token,
        refreshToken: newBearerToken.refreshToken,
        tokenType: "Bearer",
        expiresIn: Math.floor(this.config.bearerTokenExpiresIn / 1000), // Convert to seconds
        scope: newBearerToken.scopes.join(" "),
      };
    } catch (error) {
      return {
        success: false,
        error: AuthErrorMessage.REFRESH_TOKEN_FAILED,
      };
    }
  }

  getActiveBearerTokens(): Omit<BearerToken, "refreshToken">[] {
    const now = new Date();
    return Array.from(this.bearerTokens.values())
      .filter((token) => token.expiresAt > now)
      .map((token) => ({
        id: token.id,
        userId: token.userId,
        token: token.token.substring(0, 8) + "...", // Partially hide token
        scopes: token.scopes,
        expiresAt: token.expiresAt,
        refreshExpiresAt: token.refreshExpiresAt,
        createdAt: token.createdAt,
        lastUsed: token.lastUsed,
      }));
  }

  clearExpiredBearerTokens(): number {
    const now = new Date();
    let cleared = 0;

    for (const [token, bearerToken] of this.bearerTokens.entries()) {
      if (bearerToken.expiresAt <= now) {
        this.bearerTokens.delete(token);
        this.refreshTokens.delete(bearerToken.refreshToken);
        cleared++;
      }
    }

    return cleared;
  }
}
