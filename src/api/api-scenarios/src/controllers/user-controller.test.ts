import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import bcrypt from "bcrypt";
import { FastifyReply, FastifyRequest } from "fastify";
import { UserController } from "./user-controller";
import { CrudErrorCode, UserErrorCode, UserRole, UserStatus } from "../constants";
import { User } from "../types/entities";
import { CrudService } from "../services/crud-service";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

type MockCrudService = Pick<
  CrudService<User>,
  "create" | "getMany" | "getById" | "update" | "delete"
>;

interface MockReply extends Partial<FastifyReply> {
  statusCode: number;
  payload: unknown;
  headers: Record<string, string>;
  code: (status: number) => MockReply;
  send: (payload?: unknown) => MockReply;
  header: (key: string, value: string) => MockReply;
}

const createMockReply = (): MockReply => {
  const reply: MockReply = {
    statusCode: 200,
    payload: undefined,
    headers: {},
    code(status: number) {
      this.statusCode = status;
      return this;
    },
    send(payload?: unknown): MockReply {
      this.payload = payload;
      return this;
    },
    header(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };

  return reply;
};

const createRequest = (overrides: Partial<FastifyRequest> = {}): FastifyRequest => {
  const baseRequest: Record<string, unknown> = {
    body: {},
    params: {},
    query: {},
    headers: {},
    method: "POST",
    url: "/api/v1/users",
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    requestContext: {
      requestId: "req-123",
      userId: "admin-id",
      userRole: UserRole.ADMIN,
      startTime: Date.now(),
      ip: "127.0.0.1",
      userAgent: "jest",
    },
  };

  return { ...baseRequest, ...overrides } as FastifyRequest;
};

const createMockService = (): {
  create: ReturnType<typeof jest.fn>;
  getMany: ReturnType<typeof jest.fn>;
  getById: ReturnType<typeof jest.fn>;
  update: ReturnType<typeof jest.fn>;
  delete: ReturnType<typeof jest.fn>;
} => ({
  create: jest.fn(),
  getMany: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const sampleUser = (): User => ({
  id: "user-1",
  username: "johndoe",
  email: "john@example.com",
  passwordHash: "stored-hash",
  firstName: "John",
  lastName: "Doe",
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  twoFactorEnabled: false,
  profile: {
    phoneNumber: "555-1234",
    timezone: "UTC",
  },
  preferences: {
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    privacy: {
      profileVisible: true,
      showEmail: false,
      showPhone: false,
    },
    theme: "light",
  },
  createdAt: new Date("2023-01-01T00:00:00Z"),
  updatedAt: new Date("2023-01-02T00:00:00Z"),
});

describe("UserController", () => {
  let mockService: ReturnType<typeof createMockService>;
  let controller: UserController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = createMockService();
    controller = new UserController(mockService as unknown as MockCrudService);
    mockBcrypt.hash.mockResolvedValue("hashed-password");
    mockBcrypt.compare.mockResolvedValue(true);
  });

  describe("createUser", () => {
    it("creates a new user and strips sensitive fields", async () => {
      mockService.getMany.mockResolvedValue({
        success: true,
        data: {
          data: [],
          meta: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      });

      const createdUser = {
        ...sampleUser(),
        id: "new-id",
        passwordHash: "hashed-password",
      };

      mockService.create.mockResolvedValue({
        success: true,
        data: createdUser,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-created",
          executionTime: 5,
        },
      });

      const request = createRequest({
        body: {
          username: "NewUser",
          email: "NEW@Example.com",
          password: "supersecret",
          firstName: "New",
          lastName: "User",
          role: UserRole.MANAGER,
        },
      });

      const reply = createMockReply();

      await controller.createUser(request, reply);

      expect(mockService.getMany).toHaveBeenCalledWith(
        expect.objectContaining({ filters: expect.any(Array) }),
        "admin-id"
      );
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          passwordHash: "hashed-password",
          role: UserRole.MANAGER,
        }),
        "admin-id"
      );

      expect(reply.statusCode).toBe(201);
      expect(reply.payload.success).toBe(true);
      expect(reply.payload.data.passwordHash).toBeUndefined();
      expect(reply.payload.data.email).toBe(createdUser.email);
    });

    it("returns validation errors for invalid payload", async () => {
      const request = createRequest({
        body: {
          username: "ab",
          email: "invalid",
          password: "short",
          firstName: "",
          lastName: "",
        },
      });

      const reply = createMockReply();

      await controller.createUser(request, reply);

      expect(reply.statusCode).toBe(400);
      expect(reply.payload.success).toBe(false);
      expect(reply.payload.error.code).toBe(CrudErrorCode.VALIDATION_ERROR);
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it("rejects duplicate users", async () => {
      mockService.getMany.mockResolvedValue({
        success: true,
        data: {
          data: [sampleUser()],
          meta: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
      });

      const request = createRequest({
        body: {
          username: "johndoe",
          email: "john@example.com",
          password: "supersecret",
          firstName: "John",
          lastName: "Doe",
        },
      });

      const reply = createMockReply();

      await controller.createUser(request, reply);

      expect(reply.statusCode).toBe(409);
      expect(reply.payload.error.code).toBe(UserErrorCode.USER_EXISTS);
      expect(mockService.create).not.toHaveBeenCalled();
    });
  });

  describe("getUserById", () => {
    it("filters sensitive fields for non-admin viewers", async () => {
      const user = sampleUser();
      mockService.getById.mockResolvedValue({
        success: true,
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-1",
          executionTime: 4,
        },
      });

      const request = createRequest({
        params: { id: user.id },
      });
      request.requestContext = {
        ...request.requestContext,
        userId: "viewer-id",
        userRole: UserRole.USER,
      };

      const reply = createMockReply();

      await controller.getUserById(request, reply);

      expect(mockService.getById).toHaveBeenCalledWith(user.id, "viewer-id");
      expect(reply.payload.success).toBe(true);
      expect(reply.payload.data.passwordHash).toBeUndefined();
      expect(reply.payload.data.email).toBeUndefined();
      expect(reply.payload.data.profile?.phoneNumber).toBeUndefined();
    });
  });

  describe("getUsers", () => {
    it("builds advanced query and sanitizes results", async () => {
      const user = sampleUser();
      mockService.getMany.mockResolvedValue({
        success: true,
        data: {
          data: [user],
          meta: {
            page: 1,
            limit: 100,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-2",
          executionTime: 6,
        },
      } as MockReply);

      const request = createRequest({
        method: "GET",
        query: {
          page: 0,
          limit: 250,
          sortOrder: "invalid",
          search: "john",
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          createdAfter: "2023-01-01",
          createdBefore: "2023-02-01",
        },
      });
      request.requestContext = {
        ...request.requestContext,
        userRole: UserRole.USER,
      };

      const reply = createMockReply();

      await controller.getUsers(request, reply);

      const advancedQuery = mockService.getMany.mock.calls[0][0];
      expect(advancedQuery.pagination.limit).toBe(100);
      expect(advancedQuery.pagination.page).toBe(1);
      expect(advancedQuery.filters).toHaveLength(4);
      expect(advancedQuery.search.q).toBe("john");

      expect(reply.payload.success).toBe(true);
      expect(reply.payload.data.data[0].passwordHash).toBeUndefined();
      expect(reply.payload.data.data[0].email).toBeUndefined();
    });
  });

  describe("updateUser", () => {
    it("prevents non-admins from updating other users", async () => {
      const request = createRequest({
        params: { id: "target-user" },
        body: { firstName: "Updated" },
      });
      request.requestContext = {
        ...request.requestContext,
        userId: "current-user",
        userRole: UserRole.USER,
      };

      const reply = createMockReply();

      await controller.updateUser(request, reply);

      expect(reply.statusCode).toBe(403);
      expect(mockService.update).not.toHaveBeenCalled();
    });

    it("detects conflicts when updating email or username", async () => {
      mockService.getMany.mockResolvedValue({
        success: true,
        data: {
          data: [sampleUser()],
          meta: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
      });

      const request = createRequest({
        params: { id: "admin-id" },
        body: { email: "john@example.com" },
      });

      const reply = createMockReply();

      await controller.updateUser(request, reply);

      expect(reply.statusCode).toBe(409);
      expect(reply.payload.error.code).toBe(UserErrorCode.USER_EXISTS);
      expect(mockService.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteUser", () => {
    it("allows users to delete themselves", async () => {
      mockService.delete.mockResolvedValue({
        success: true,
        data: true,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-del",
          executionTime: 3,
        },
      });

      const request = createRequest({
        params: { id: "admin-id" },
      });

      const reply = createMockReply();

      await controller.deleteUser(request, reply);

      expect(reply.statusCode).toBe(204);
      expect(mockService.delete).toHaveBeenCalledWith("admin-id", "admin-id");
    });
  });

  describe("changePassword", () => {
    it("updates password when current password matches", async () => {
      mockService.getById.mockResolvedValue({
        success: true,
        data: sampleUser(),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-pass",
          executionTime: 5,
        },
      });

      mockService.update.mockResolvedValue({
        success: true,
        data: sampleUser(),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-pass-2",
          executionTime: 2,
        },
      });

      const request = createRequest({
        params: { id: "admin-id" },
        body: {
          currentPassword: "old-password",
          newPassword: "new-password",
          confirmPassword: "new-password",
        },
      });

      const reply = createMockReply();

      await controller.changePassword(request, reply);

      expect(mockService.update).toHaveBeenCalledWith(
        "admin-id",
        { passwordHash: "hashed-password" },
        "admin-id"
      );
      expect(reply.payload.success).toBe(true);
    });

    it("rejects invalid current passwords", async () => {
      mockService.getById.mockResolvedValue({
        success: true,
        data: sampleUser(),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-pass",
          executionTime: 5,
        },
      });

      mockBcrypt.compare.mockResolvedValue(false);

      const request = createRequest({
        params: { id: "admin-id" },
        body: {
          currentPassword: "wrong",
          newPassword: "new-password",
          confirmPassword: "new-password",
        },
      });

      const reply = createMockReply();

      await controller.changePassword(request, reply);

      expect(reply.statusCode).toBe(400);
      expect(reply.payload.error.code).toBe(UserErrorCode.INVALID_CURRENT_PASSWORD);
      expect(mockService.update).not.toHaveBeenCalled();
    });
  });

  describe("validation helpers", () => {
    it("validates create user payloads", () => {
      const errors = (
        controller as unknown as { validateCreateUserRequest: (body: unknown) => string[] }
      ).validateCreateUserRequest({
        username: "ab",
        email: "bad",
        password: "short",
        firstName: "",
        lastName: "",
        role: "invalid",
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          "Username must be at least 3 characters long",
          "Valid email address is required",
          "Password must be at least 8 characters long",
          "First name is required",
          "Last name is required",
          "Invalid role specified",
        ])
      );
    });
  });
});
