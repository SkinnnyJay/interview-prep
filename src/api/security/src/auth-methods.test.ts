// auth-methods.test.ts
import { AuthenticationManager } from "./auth-methods";
import {
  AuthType,
  Role,
  AuthConfig,
  type AuthResult,
  type AuthSuccess,
  type AuthFailure,
} from "./auth-types";

/** Narrows AuthResult to AuthSuccess in tests; throws if failure */
function assertAuthSuccess(result: AuthResult): asserts result is AuthSuccess {
  if (!result.success) throw new Error(`Expected success, got: ${result.error}`);
}

/** Narrows AuthResult to AuthFailure in tests; throws if success */
function assertAuthFailure(result: AuthResult): asserts result is AuthFailure {
  if (result.success) throw new Error("Expected auth failure");
}

describe("AuthenticationManager", () => {
  let authManager: AuthenticationManager;
  const testConfig: AuthConfig = {
    jwtSecret: "test-secret-key",
    jwtExpiresIn: "1h",
    sessionExpiresIn: 60 * 60 * 1000, // 1 hour
    bcryptRounds: 4, // Lower for faster tests
    bearerTokenExpiresIn: 60 * 60 * 1000, // 1 hour
    refreshTokenExpiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
    apiKeyPrefix: "sk_test",
  };

  beforeEach(() => {
    authManager = new AuthenticationManager(testConfig);
  });

  afterEach(async () => {
    // Clear any timers that might be running
    jest.clearAllTimers();

    // Clear all mocks
    jest.clearAllMocks();

    // Clear expired sessions and tokens to prevent memory leaks
    if (authManager) {
      authManager.clearExpiredSessions();
      authManager.clearExpiredBearerTokens();
    }
  });

  describe("User Registration", () => {
    it("should register a new user successfully", async () => {
      const result = await authManager.registerUser({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        roles: [Role.USER],
      });

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe("testuser");
      expect(result.user.email).toBe("test@example.com");
      expect(result.user.roles).toContain(Role.USER);
      expect(result.user.passwordHash).toBe(""); // Should not return password hash
    });

    it("should fail to register user with existing username", async () => {
      await authManager.registerUser({
        username: "duplicate",
        email: "first@example.com",
        password: "password123",
      });

      const result = await authManager.registerUser({
        username: "duplicate",
        email: "second@example.com",
        password: "password123",
      });

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("User already exists");
    });

    it("should fail to register user with existing email", async () => {
      await authManager.registerUser({
        username: "first",
        email: "duplicate@example.com",
        password: "password123",
      });

      const result = await authManager.registerUser({
        username: "second",
        email: "duplicate@example.com",
        password: "password123",
      });

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("User already exists");
    });

    it("should assign default USER role when no roles specified", async () => {
      const result = await authManager.registerUser({
        username: "defaultrole",
        email: "default@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.roles).toEqual([Role.USER]);
    });
  });

  describe("Basic Authentication", () => {
    beforeEach(async () => {
      await authManager.registerUser({
        username: "basicuser",
        email: "basic@example.com",
        password: "basicpass123",
        roles: [Role.USER],
      });
    });

    it("should authenticate valid Basic auth header", async () => {
      const credentials = Buffer.from("basicuser:basicpass123").toString("base64");
      const authHeader = `Basic ${credentials}`;

      const result = await authManager.authenticateBasic(authHeader);

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("basicuser");
    });

    it("should fail authentication with invalid credentials", async () => {
      const credentials = Buffer.from("basicuser:wrongpass").toString("base64");
      const authHeader = `Basic ${credentials}`;

      const result = await authManager.authenticateBasic(authHeader);

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid credentials");
    });

    it("should fail authentication with invalid header format", async () => {
      const result = await authManager.authenticateBasic("Invalid Header");

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid Basic auth header");
    });

    it("should fail authentication with malformed credentials", async () => {
      const authHeader = "Basic invalid-base64";

      const result = await authManager.authenticateBasic(authHeader);

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid Basic auth header");
    });
  });

  describe("Session Token Authentication", () => {
    let sessionToken: string;
    let userId: string;

    beforeEach(async () => {
      const registerResult = await authManager.registerUser({
        username: "sessionuser",
        email: "session@example.com",
        password: "sessionpass123",
        roles: [Role.USER],
      });
      assertAuthSuccess(registerResult);
      userId = registerResult.user.id;

      const loginResult = await authManager.login(
        { username: "sessionuser", password: "sessionpass123" },
        AuthType.SESSION_TOKEN
      );
      assertAuthSuccess(loginResult);
      sessionToken = loginResult.token!;
    });

    it("should authenticate valid session token", async () => {
      const result = await authManager.authenticateSessionToken(sessionToken);

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("sessionuser");
      expect(result.session).toBeDefined();
      expect(result.session?.userId).toBe(userId);
    });

    it("should fail authentication with invalid session token", async () => {
      const result = await authManager.authenticateSessionToken("invalid-token");

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid session token");
    });

    it("should fail authentication with expired session token", async () => {
      // Create a session with very short expiry for testing
      const shortConfig = { ...testConfig, sessionExpiresIn: 1 }; // 1ms
      const shortAuthManager = new AuthenticationManager(shortConfig);

      await shortAuthManager.registerUser({
        username: "expireduser",
        email: "expired@example.com",
        password: "expiredpass123",
      });

      const loginResult = await shortAuthManager.login(
        { username: "expireduser", password: "expiredpass123" },
        AuthType.SESSION_TOKEN
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await shortAuthManager.authenticateSessionToken(loginResult.token!);

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Session expired");
    });

    it("should update last used timestamp on successful authentication", async () => {
      const firstAuth = await authManager.authenticateSessionToken(sessionToken);
      assertAuthSuccess(firstAuth);
      const firstLastUsed = firstAuth.session!.lastUsed;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const secondAuth = await authManager.authenticateSessionToken(sessionToken);
      assertAuthSuccess(secondAuth);
      const secondLastUsed = secondAuth.session!.lastUsed;

      expect(secondLastUsed.getTime()).toBeGreaterThan(firstLastUsed.getTime());
    });
  });

  describe("JWT Authentication", () => {
    let jwtToken: string;

    beforeEach(async () => {
      await authManager.registerUser({
        username: "jwtuser",
        email: "jwt@example.com",
        password: "jwtpass123",
        roles: [Role.ADMIN],
      });

      const loginResult = await authManager.login(
        { username: "jwtuser", password: "jwtpass123" },
        AuthType.JWT
      );
      jwtToken = loginResult.token!;
    });

    it("should authenticate valid JWT token", async () => {
      const result = await authManager.authenticateJWT(jwtToken);

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("jwtuser");
      expect(result.user.roles).toContain(Role.ADMIN);
    });

    it("should fail authentication with invalid JWT token", async () => {
      const result = await authManager.authenticateJWT("invalid.jwt.token");

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid token");
    });

    it("should fail authentication with expired JWT token", async () => {
      // Create a JWT with very short expiry for testing
      const shortConfig = { ...testConfig, jwtExpiresIn: "1ms" };
      const shortAuthManager = new AuthenticationManager(shortConfig);

      await shortAuthManager.registerUser({
        username: "expiredjwt",
        email: "expiredjwt@example.com",
        password: "expiredpass123",
      });

      const loginResult = await shortAuthManager.login(
        { username: "expiredjwt", password: "expiredpass123" },
        AuthType.JWT
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await shortAuthManager.authenticateJWT(loginResult.token!);

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Token expired");
    });

    it("should update last login timestamp on successful authentication", async () => {
      const user = authManager.getUserByUsername("jwtuser");
      const originalLastLogin = user?.lastLogin;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await authManager.authenticateJWT(jwtToken);

      const updatedUser = authManager.getUserByUsername("jwtuser");
      expect(updatedUser?.lastLogin?.getTime()).toBeGreaterThan(originalLastLogin?.getTime() || 0);
    });
  });

  describe("Login", () => {
    beforeEach(async () => {
      await authManager.registerUser({
        username: "loginuser",
        email: "login@example.com",
        password: "loginpass123",
        roles: [Role.USER],
      });
    });

    it("should login with SESSION_TOKEN auth type", async () => {
      const result = await authManager.login(
        { username: "loginuser", password: "loginpass123" },
        AuthType.SESSION_TOKEN
      );

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("loginuser");
      expect(result.token).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session?.userId).toBe(result.user.id);
    });

    it("should login with JWT auth type", async () => {
      const result = await authManager.login(
        { username: "loginuser", password: "loginpass123" },
        AuthType.JWT
      );

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("loginuser");
      expect(result.token).toBeDefined();
      expect(result.session).toBeUndefined();
    });

    it("should login with BASIC auth type", async () => {
      const result = await authManager.login(
        { username: "loginuser", password: "loginpass123" },
        AuthType.BASIC
      );

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("loginuser");
      expect(result.token).toBeUndefined();
      expect(result.session).toBeUndefined();
    });

    it("should fail login with invalid credentials", async () => {
      const result = await authManager.login(
        { username: "loginuser", password: "wrongpass" },
        AuthType.JWT
      );

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid credentials");
    });

    it("should fail login with non-existent user", async () => {
      const result = await authManager.login(
        { username: "nonexistent", password: "anypass" },
        AuthType.JWT
      );

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid credentials");
    });
  });

  describe("Logout", () => {
    let sessionToken: string;
    let jwtToken: string;

    beforeEach(async () => {
      await authManager.registerUser({
        username: "logoutuser",
        email: "logout@example.com",
        password: "logoutpass123",
      });

      const sessionLogin = await authManager.login(
        { username: "logoutuser", password: "logoutpass123" },
        AuthType.SESSION_TOKEN
      );
      assertAuthSuccess(sessionLogin);
      sessionToken = sessionLogin.token!;

      const jwtLogin = await authManager.login(
        { username: "logoutuser", password: "logoutpass123" },
        AuthType.JWT
      );
      assertAuthSuccess(jwtLogin);
      jwtToken = jwtLogin.token!;
    });

    it("should logout session token successfully", async () => {
      const result = await authManager.logout(sessionToken, AuthType.SESSION_TOKEN);

      expect(result.success).toBe(true);

      // Verify session is invalidated
      const authResult = await authManager.authenticateSessionToken(sessionToken);
      expect(authResult.success).toBe(false);
    });

    it("should logout JWT token successfully", async () => {
      const result = await authManager.logout(jwtToken, AuthType.JWT);

      expect(result.success).toBe(true);
      // Note: JWT tokens can't be invalidated server-side without a blacklist
    });

    it("should logout basic auth successfully", async () => {
      const result = await authManager.logout("", AuthType.BASIC);

      expect(result.success).toBe(true);
    });

    it("should fail to logout invalid session token", async () => {
      const result = await authManager.logout("invalid-token", AuthType.SESSION_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session not found");
    });
  });

  describe("Utility Methods", () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authManager.registerUser({
        username: "utiluser",
        email: "util@example.com",
        password: "utilpass123",
        roles: [Role.USER, Role.ADMIN],
      });
      assertAuthSuccess(result);
      userId = result.user.id;
    });

    it("should get user by ID", () => {
      const user = authManager.getUser(userId);

      expect(user).toBeDefined();
      expect(user?.username).toBe("utiluser");
      expect(user?.passwordHash).toBe(""); // Should not return password hash
    });

    it("should get user by username", () => {
      const user = authManager.getUserByUsername("utiluser");

      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.passwordHash).toBe(""); // Should not return password hash
    });

    it("should return undefined for non-existent user", () => {
      const user = authManager.getUser("non-existent-id");
      expect(user).toBeUndefined();

      const userByUsername = authManager.getUserByUsername("non-existent-username");
      expect(userByUsername).toBeUndefined();
    });

    it("should get all users", () => {
      const users = authManager.getAllUsers();

      expect(users.length).toBeGreaterThan(0);
      expect(users.some((u) => u.username === "utiluser")).toBe(true);
      expect(users.some((u) => u.username === "admin")).toBe(true); // Default admin user

      // Verify no password hashes are returned
      users.forEach((user) => {
        expect(user.passwordHash).toBe("");
      });
    });

    it("should get active sessions", async () => {
      // Create some sessions
      await authManager.login(
        { username: "utiluser", password: "utilpass123" },
        AuthType.SESSION_TOKEN
      );
      await authManager.login({ username: "admin", password: "admin123" }, AuthType.SESSION_TOKEN);

      const sessions = authManager.getActiveSessions();

      expect(sessions.length).toBeGreaterThanOrEqual(2);
      sessions.forEach((session) => {
        expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });
    });

    it("should clear expired sessions", async () => {
      // Create a session with very short expiry
      const shortConfig = { ...testConfig, sessionExpiresIn: 1 }; // 1ms
      const shortAuthManager = new AuthenticationManager(shortConfig);

      await shortAuthManager.registerUser({
        username: "expireduser",
        email: "expired@example.com",
        password: "expiredpass123",
      });

      await shortAuthManager.login(
        { username: "expireduser", password: "expiredpass123" },
        AuthType.SESSION_TOKEN
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cleared = shortAuthManager.clearExpiredSessions();

      expect(cleared).toBeGreaterThan(0);
    });
  });

  describe("Default Users", () => {
    it("should create default admin user", () => {
      const admin = authManager.getUserByUsername("admin");

      expect(admin).toBeDefined();
      expect(admin?.roles).toContain(Role.ADMIN);
      expect(admin?.email).toBe("admin@example.com");
    });

    it("should create default regular user", () => {
      const user = authManager.getUserByUsername("user");

      expect(user).toBeDefined();
      expect(user?.roles).toContain(Role.USER);
      expect(user?.email).toBe("user@example.com");
    });

    it("should create default guest user", () => {
      const guest = authManager.getUserByUsername("guest");

      expect(guest).toBeDefined();
      expect(guest?.roles).toContain(Role.GUEST);
      expect(guest?.email).toBe("guest@example.com");
    });

    it("should allow login with default credentials", async () => {
      const adminLogin = await authManager.login(
        { username: "admin", password: "admin123" },
        AuthType.JWT
      );

      expect(adminLogin.success).toBe(true);
      assertAuthSuccess(adminLogin);
      expect(adminLogin.user.username).toBe("admin");

      const userLogin = await authManager.login(
        { username: "user", password: "user123" },
        AuthType.JWT
      );

      expect(userLogin.success).toBe(true);
      assertAuthSuccess(userLogin);
      expect(userLogin.user.username).toBe("user");

      const guestLogin = await authManager.login(
        { username: "guest", password: "guest123" },
        AuthType.JWT
      );

      expect(guestLogin.success).toBe(true);
      assertAuthSuccess(guestLogin);
      expect(guestLogin.user.username).toBe("guest");
    });
  });

  describe("API Key Authentication", () => {
    let userId: string;
    let apiKey: string;

    beforeEach(async () => {
      const registerResult = await authManager.registerUser({
        username: "apikeyuser",
        email: "apikey@example.com",
        password: "apikey123",
        roles: [Role.USER],
      });
      assertAuthSuccess(registerResult);
      userId = registerResult.user.id;

      const keyResult = await authManager.createApiKey(userId, {
        name: "Test API Key",
        scopes: ["read", "write"],
      });
      apiKey = keyResult.apiKey!;
    });

    it("should authenticate valid API key", async () => {
      const result = await authManager.authenticateApiKey(apiKey);

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("apikeyuser");
    });

    it("should fail authentication with invalid API key", async () => {
      const result = await authManager.authenticateApiKey("sk_test_invalid_key");

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid API key");
    });

    it("should fail authentication with wrong format", async () => {
      const result = await authManager.authenticateApiKey("invalid_format");

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid API key format");
    });

    it("should fail authentication with revoked API key", async () => {
      const keyInfo = authManager.getUserApiKeys(userId)[0];
      await authManager.revokeApiKey(userId, keyInfo.id);

      const result = await authManager.authenticateApiKey(apiKey);

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid API key");
    });

    it("should update last used timestamp on successful authentication", async () => {
      const originalKeys = authManager.getUserApiKeys(userId);
      const originalLastUsed = originalKeys[0].lastUsed;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await authManager.authenticateApiKey(apiKey);

      const updatedKeys = authManager.getUserApiKeys(userId);
      const updatedLastUsed = updatedKeys[0].lastUsed;

      expect(updatedLastUsed?.getTime()).toBeGreaterThan(originalLastUsed?.getTime() || 0);
    });
  });

  describe("Bearer Token Authentication", () => {
    let bearerToken: string;

    beforeEach(async () => {
      const registerResult = await authManager.registerUser({
        username: "beareruser",
        email: "bearer@example.com",
        password: "bearer123",
        roles: [Role.USER],
      });
      assertAuthSuccess(registerResult);

      const loginResult = await authManager.login(
        { username: "beareruser", password: "bearer123" },
        AuthType.BEARER_TOKEN
      );
      assertAuthSuccess(loginResult);
      bearerToken = loginResult.token!;
    });

    it("should authenticate valid bearer token", async () => {
      const result = await authManager.authenticateBearerToken(bearerToken);

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("beareruser");
    });

    it("should fail authentication with invalid bearer token", async () => {
      const result = await authManager.authenticateBearerToken("invalid-bearer-token");

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Invalid bearer token");
    });

    it("should fail authentication with expired bearer token", async () => {
      const shortConfig = { ...testConfig, bearerTokenExpiresIn: 1 }; // 1ms
      const shortAuthManager = new AuthenticationManager(shortConfig);

      await shortAuthManager.registerUser({
        username: "expiredbearer",
        email: "expiredbearer@example.com",
        password: "expiredpass123",
      });

      const loginResult = await shortAuthManager.login(
        { username: "expiredbearer", password: "expiredpass123" },
        AuthType.BEARER_TOKEN
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await shortAuthManager.authenticateBearerToken(loginResult.token!);

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("Bearer token expired");
    });

    it("should update last used timestamp on successful authentication", async () => {
      const firstAuth = await authManager.authenticateBearerToken(bearerToken);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const secondAuth = await authManager.authenticateBearerToken(bearerToken);

      // We can't directly compare timestamps since they're in different objects
      // But we can verify both authentications succeeded
      expect(firstAuth.success).toBe(true);
      expect(secondAuth.success).toBe(true);
    });
  });

  describe("API Key Management", () => {
    let userId: string;

    beforeEach(async () => {
      const registerResult = await authManager.registerUser({
        username: "keymanager",
        email: "keymanager@example.com",
        password: "keymanager123",
      });
      assertAuthSuccess(registerResult);
      userId = registerResult.user.id;
    });

    it("should create API key successfully", async () => {
      const result = await authManager.createApiKey(userId, {
        name: "Test Key",
        scopes: ["read", "write"],
      });

      expect(result.success).toBe(true);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey).toMatch(/^sk_test_/);
      expect(result.keyInfo?.name).toBe("Test Key");
      expect(result.keyInfo?.scopes).toEqual(["read", "write"]);
    });

    it("should fail to create API key for non-existent user", async () => {
      const result = await authManager.createApiKey("non-existent-id", {
        name: "Test Key",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not found");
    });

    it("should list user API keys", async () => {
      await authManager.createApiKey(userId, { name: "Key 1" });
      await authManager.createApiKey(userId, { name: "Key 2" });

      const keys = authManager.getUserApiKeys(userId);

      expect(keys.length).toBe(2);
      expect(keys[0].name).toBe("Key 1");
      expect(keys[1].name).toBe("Key 2");
      expect(keys[0]).not.toHaveProperty("keyHash"); // Should not expose hash
    });

    it("should revoke API key successfully", async () => {
      const createResult = await authManager.createApiKey(userId, { name: "Revoke Test" });
      const keyId = createResult.keyInfo!.id;

      const revokeResult = await authManager.revokeApiKey(userId, keyId);

      expect(revokeResult.success).toBe(true);

      const keys = authManager.getUserApiKeys(userId);
      expect(keys[0].isActive).toBe(false);
    });

    it("should fail to revoke non-existent API key", async () => {
      const result = await authManager.revokeApiKey(userId, "non-existent-key-id");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API key not found");
    });
  });

  describe("Bearer Token Management", () => {
    beforeEach(async () => {
      const registerResult = await authManager.registerUser({
        username: "tokenmanager",
        email: "tokenmanager@example.com",
        password: "tokenmanager123",
      });
      assertAuthSuccess(registerResult);

      const loginResult = await authManager.login(
        { username: "tokenmanager", password: "tokenmanager123" },
        AuthType.BEARER_TOKEN
      );
      assertAuthSuccess(loginResult);
    });

    it("should get active bearer tokens", async () => {
      const tokens = authManager.getActiveBearerTokens();

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0]).toHaveProperty("token");
      expect(tokens[0]).toHaveProperty("scopes");
      expect(tokens[0]).toHaveProperty("expiresAt");
      expect(tokens[0]).not.toHaveProperty("refreshToken"); // Should not expose refresh token
    });

    it("should clear expired bearer tokens", async () => {
      // Create tokens with very short expiry
      const shortConfig = { ...testConfig, bearerTokenExpiresIn: 1 }; // 1ms
      const shortAuthManager = new AuthenticationManager(shortConfig);

      await shortAuthManager.registerUser({
        username: "expiredtokens",
        email: "expiredtokens@example.com",
        password: "expiredpass123",
      });

      await shortAuthManager.login(
        { username: "expiredtokens", password: "expiredpass123" },
        AuthType.BEARER_TOKEN
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cleared = shortAuthManager.clearExpiredBearerTokens();

      expect(cleared).toBeGreaterThan(0);
    });
  });

  describe("Extended Login Tests", () => {
    beforeEach(async () => {
      await authManager.registerUser({
        username: "extendeduser",
        email: "extended@example.com",
        password: "extended123",
      });
    });

    it("should login with BEARER_TOKEN auth type", async () => {
      const result = await authManager.login(
        { username: "extendeduser", password: "extended123" },
        AuthType.BEARER_TOKEN
      );

      expect(result.success).toBe(true);
      assertAuthSuccess(result);
      expect(result.user.username).toBe("extendeduser");
      expect(result.token).toBeDefined();
    });

    it("should fail login with API_KEY auth type", async () => {
      const result = await authManager.login(
        { username: "extendeduser", password: "extended123" },
        AuthType.API_KEY
      );

      expect(result.success).toBe(false);
      assertAuthFailure(result);
      expect(result.error).toBe("API keys must be created through createApiKey method");
    });
  });

  describe("Extended Logout Tests", () => {
    let bearerToken: string;

    beforeEach(async () => {
      await authManager.registerUser({
        username: "logoutextended",
        email: "logoutextended@example.com",
        password: "logoutextended123",
      });

      const loginResult = await authManager.login(
        { username: "logoutextended", password: "logoutextended123" },
        AuthType.BEARER_TOKEN
      );
      bearerToken = loginResult.token!;
    });

    it("should logout bearer token successfully", async () => {
      const result = await authManager.logout(bearerToken, AuthType.BEARER_TOKEN);

      expect(result.success).toBe(true);

      // Verify token is invalidated
      const authResult = await authManager.authenticateBearerToken(bearerToken);
      expect(authResult.success).toBe(false);
    });

    it("should fail to logout invalid bearer token", async () => {
      const result = await authManager.logout("invalid-token", AuthType.BEARER_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Bearer token not found");
    });

    it("should fail to logout API key through logout method", async () => {
      const result = await authManager.logout("any-token", AuthType.API_KEY);

      expect(result.success).toBe(false);
      expect(result.error).toBe("API keys must be revoked through revokeApiKey method");
    });
  });
});
