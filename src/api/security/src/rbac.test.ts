// rbac.test.ts
import { RoleBasedAccessControl, Permission } from "./rbac";
import { Role, User, AuthContext, AuthType } from "./auth-types";

describe("RoleBasedAccessControl", () => {
  let rbac: RoleBasedAccessControl;

  beforeEach(() => {
    rbac = new RoleBasedAccessControl();
  });

  afterEach(async () => {
    // Clear any timers that might be running
    jest.clearAllTimers();

    // Clear all mocks
    jest.clearAllMocks();
  });

  // Helper function to create test users
  const createTestUser = (username: string, roles: Role[]): User => ({
    id: `user-${username}`,
    username,
    email: `${username}@example.com`,
    passwordHash: "hashed-password",
    roles,
    createdAt: new Date(),
  });

  describe("Permission Checking", () => {
    it("should grant admin all permissions", () => {
      const admin = createTestUser("admin", [Role.ADMIN]);

      // Test a few key permissions
      expect(rbac.hasPermission(admin, Permission.ADMIN_ACCESS)).toBe(true);
      expect(rbac.hasPermission(admin, Permission.DELETE_USER)).toBe(true);
      expect(rbac.hasPermission(admin, Permission.CREATE_CONTENT)).toBe(true);
      expect(rbac.hasPermission(admin, Permission.API_DELETE)).toBe(true);
    });

    it("should grant user standard permissions", () => {
      const user = createTestUser("user", [Role.USER]);

      // Should have these permissions
      expect(rbac.hasPermission(user, Permission.READ_USER)).toBe(true);
      expect(rbac.hasPermission(user, Permission.UPDATE_USER)).toBe(true);
      expect(rbac.hasPermission(user, Permission.CREATE_CONTENT)).toBe(true);
      expect(rbac.hasPermission(user, Permission.READ_CONTENT)).toBe(true);
      expect(rbac.hasPermission(user, Permission.UPDATE_CONTENT)).toBe(true);
      expect(rbac.hasPermission(user, Permission.API_READ)).toBe(true);
      expect(rbac.hasPermission(user, Permission.API_WRITE)).toBe(true);

      // Should NOT have these permissions
      expect(rbac.hasPermission(user, Permission.DELETE_USER)).toBe(false);
      expect(rbac.hasPermission(user, Permission.ADMIN_ACCESS)).toBe(false);
      expect(rbac.hasPermission(user, Permission.API_DELETE)).toBe(false);
      expect(rbac.hasPermission(user, Permission.MANAGE_ROLES)).toBe(false);
    });

    it("should grant guest minimal permissions", () => {
      const guest = createTestUser("guest", [Role.GUEST]);

      // Should have these permissions
      expect(rbac.hasPermission(guest, Permission.READ_CONTENT)).toBe(true);
      expect(rbac.hasPermission(guest, Permission.API_READ)).toBe(true);

      // Should NOT have these permissions
      expect(rbac.hasPermission(guest, Permission.CREATE_CONTENT)).toBe(false);
      expect(rbac.hasPermission(guest, Permission.UPDATE_CONTENT)).toBe(false);
      expect(rbac.hasPermission(guest, Permission.DELETE_CONTENT)).toBe(false);
      expect(rbac.hasPermission(guest, Permission.API_WRITE)).toBe(false);
      expect(rbac.hasPermission(guest, Permission.ADMIN_ACCESS)).toBe(false);
    });

    it("should handle users with multiple roles", () => {
      const userAdmin = createTestUser("useradmin", [Role.USER, Role.ADMIN]);

      // Should have permissions from both roles
      expect(rbac.hasPermission(userAdmin, Permission.READ_CONTENT)).toBe(true); // USER
      expect(rbac.hasPermission(userAdmin, Permission.ADMIN_ACCESS)).toBe(true); // ADMIN
      expect(rbac.hasPermission(userAdmin, Permission.DELETE_USER)).toBe(true); // ADMIN
    });

    it("should return false for users with no roles", () => {
      const noRoleUser = createTestUser("norole", []);

      expect(rbac.hasPermission(noRoleUser, Permission.READ_CONTENT)).toBe(false);
      expect(rbac.hasPermission(noRoleUser, Permission.API_READ)).toBe(false);
    });
  });

  describe("Multiple Permission Checking", () => {
    it("should check if user has any of specified permissions", () => {
      const user = createTestUser("user", [Role.USER]);

      const permissions = [Permission.ADMIN_ACCESS, Permission.READ_CONTENT];
      expect(rbac.hasAnyPermission(user, permissions)).toBe(true); // Has READ_CONTENT

      const adminPermissions = [Permission.ADMIN_ACCESS, Permission.DELETE_USER];
      expect(rbac.hasAnyPermission(user, adminPermissions)).toBe(false); // Has neither
    });

    it("should check if user has all specified permissions", () => {
      const admin = createTestUser("admin", [Role.ADMIN]);
      const user = createTestUser("user", [Role.USER]);

      const userPermissions = [Permission.READ_CONTENT, Permission.API_READ];
      expect(rbac.hasAllPermissions(admin, userPermissions)).toBe(true); // Admin has all
      expect(rbac.hasAllPermissions(user, userPermissions)).toBe(true); // User has all

      const adminPermissions = [Permission.ADMIN_ACCESS, Permission.DELETE_USER];
      expect(rbac.hasAllPermissions(admin, adminPermissions)).toBe(true); // Admin has all
      expect(rbac.hasAllPermissions(user, adminPermissions)).toBe(false); // User has neither
    });
  });

  describe("User Permissions", () => {
    it("should get all permissions for a user", () => {
      const admin = createTestUser("admin", [Role.ADMIN]);
      const permissions = rbac.getUserPermissions(admin);

      expect(permissions).toContain(Permission.ADMIN_ACCESS);
      expect(permissions).toContain(Permission.DELETE_USER);
      expect(permissions).toContain(Permission.CREATE_CONTENT);
      expect(permissions).toContain(Permission.API_DELETE);
      expect(permissions.length).toBeGreaterThan(10); // Admin should have many permissions
    });

    it("should get unique permissions for user with multiple roles", () => {
      const userAdmin = createTestUser("useradmin", [Role.USER, Role.ADMIN]);
      const permissions = rbac.getUserPermissions(userAdmin);

      // Should not have duplicates
      const uniquePermissions = [...new Set(permissions)];
      expect(permissions.length).toBe(uniquePermissions.length);

      // Should have permissions from both roles
      expect(permissions).toContain(Permission.READ_CONTENT); // Both roles
      expect(permissions).toContain(Permission.ADMIN_ACCESS); // Admin only
    });

    it("should return empty array for user with no roles", () => {
      const noRoleUser = createTestUser("norole", []);
      const permissions = rbac.getUserPermissions(noRoleUser);

      expect(permissions).toEqual([]);
    });
  });

  describe("Role Permissions Management", () => {
    it("should get permissions for a specific role", () => {
      const adminPermissions = rbac.getRolePermissions(Role.ADMIN);
      const userPermissions = rbac.getRolePermissions(Role.USER);
      const guestPermissions = rbac.getRolePermissions(Role.GUEST);

      expect(adminPermissions).toContain(Permission.ADMIN_ACCESS);
      expect(adminPermissions).toContain(Permission.DELETE_USER);

      expect(userPermissions).toContain(Permission.READ_CONTENT);
      expect(userPermissions).toContain(Permission.API_WRITE);
      expect(userPermissions).not.toContain(Permission.ADMIN_ACCESS);

      expect(guestPermissions).toContain(Permission.READ_CONTENT);
      expect(guestPermissions).toContain(Permission.API_READ);
      expect(guestPermissions).not.toContain(Permission.CREATE_CONTENT);
    });

    it("should add permission to role", () => {
      // Add a new permission to guest role
      rbac.addPermissionToRole(Role.GUEST, Permission.CREATE_CONTENT);

      const guest = createTestUser("guest", [Role.GUEST]);
      expect(rbac.hasPermission(guest, Permission.CREATE_CONTENT)).toBe(true);
    });

    it("should not add duplicate permission to role", () => {
      const originalPermissions = rbac.getRolePermissions(Role.USER);
      const originalLength = originalPermissions.length;

      // Try to add existing permission
      rbac.addPermissionToRole(Role.USER, Permission.READ_CONTENT);

      const newPermissions = rbac.getRolePermissions(Role.USER);
      expect(newPermissions.length).toBe(originalLength);
    });

    it("should remove permission from role", () => {
      // Remove a permission from user role
      rbac.removePermissionFromRole(Role.USER, Permission.CREATE_CONTENT);

      const user = createTestUser("user", [Role.USER]);
      expect(rbac.hasPermission(user, Permission.CREATE_CONTENT)).toBe(false);
    });

    it("should handle removing non-existent permission", () => {
      const originalPermissions = rbac.getRolePermissions(Role.GUEST);
      const originalLength = originalPermissions.length;

      // Try to remove permission that doesn't exist
      rbac.removePermissionFromRole(Role.GUEST, Permission.DELETE_USER);

      const newPermissions = rbac.getRolePermissions(Role.GUEST);
      expect(newPermissions.length).toBe(originalLength);
    });
  });

  describe("Resource Access Control", () => {
    it("should allow admin to access any resource", () => {
      const admin = createTestUser("admin", [Role.ADMIN]);
      const resourceOwnerId = "other-user-id";

      expect(rbac.canAccessResource(admin, resourceOwnerId, Permission.UPDATE_CONTENT)).toBe(true);
      expect(rbac.canAccessResource(admin, resourceOwnerId, Permission.DELETE_CONTENT)).toBe(true);
      expect(rbac.canAccessResource(admin, resourceOwnerId, Permission.DELETE_USER)).toBe(true);
    });

    it("should allow users to access their own resources", () => {
      const user = createTestUser("user", [Role.USER]);

      expect(rbac.canAccessResource(user, user.id, Permission.UPDATE_CONTENT)).toBe(true);
      expect(rbac.canAccessResource(user, user.id, Permission.UPDATE_USER)).toBe(true);
    });

    it("should deny users access to other users resources for sensitive operations", () => {
      const user = createTestUser("user", [Role.USER]);
      const otherUserId = "other-user-id";

      expect(rbac.canAccessResource(user, otherUserId, Permission.UPDATE_CONTENT)).toBe(false);
      expect(rbac.canAccessResource(user, otherUserId, Permission.DELETE_CONTENT)).toBe(false);
      expect(rbac.canAccessResource(user, otherUserId, Permission.UPDATE_USER)).toBe(false);
    });

    it("should allow read operations regardless of ownership", () => {
      const user = createTestUser("user", [Role.USER]);
      const otherUserId = "other-user-id";

      expect(rbac.canAccessResource(user, otherUserId, Permission.READ_CONTENT)).toBe(true);
      expect(rbac.canAccessResource(user, otherUserId, Permission.READ_USER)).toBe(true);
    });

    it("should deny access if user lacks the permission entirely", () => {
      const guest = createTestUser("guest", [Role.GUEST]);

      expect(rbac.canAccessResource(guest, guest.id, Permission.CREATE_CONTENT)).toBe(false);
      expect(rbac.canAccessResource(guest, guest.id, Permission.UPDATE_CONTENT)).toBe(false);
    });
  });

  describe("Middleware Functions", () => {
    const createAuthContext = (user: User): AuthContext => ({
      user,
      authType: AuthType.JWT,
    });

    it("should create permission requirement middleware", () => {
      const admin = createTestUser("admin", [Role.ADMIN]);
      const user = createTestUser("user", [Role.USER]);

      const requireAdmin = rbac.requirePermission(Permission.ADMIN_ACCESS);

      const adminResult = requireAdmin(createAuthContext(admin));
      expect(adminResult.allowed).toBe(true);

      const userResult = requireAdmin(createAuthContext(user));
      expect(userResult.allowed).toBe(false);
      if (!userResult.allowed) expect(userResult.error).toContain("Insufficient permissions");
    });

    it("should create role requirement middleware", () => {
      const admin = createTestUser("admin", [Role.ADMIN]);
      const user = createTestUser("user", [Role.USER]);

      const requireAdminRole = rbac.requireRole(Role.ADMIN);

      const adminResult = requireAdminRole(createAuthContext(admin));
      expect(adminResult.allowed).toBe(true);

      const userResult = requireAdminRole(createAuthContext(user));
      expect(userResult.allowed).toBe(false);
      if (!userResult.allowed) expect(userResult.error).toContain("Insufficient role");
    });

    it("should create any permission requirement middleware", () => {
      const user = createTestUser("user", [Role.USER]);
      const guest = createTestUser("guest", [Role.GUEST]);

      const requireAnyPermission = rbac.requireAnyPermission([
        Permission.CREATE_CONTENT,
        Permission.ADMIN_ACCESS,
      ]);

      const userResult = requireAnyPermission(createAuthContext(user));
      expect(userResult.allowed).toBe(true); // Has CREATE_CONTENT

      const guestResult = requireAnyPermission(createAuthContext(guest));
      expect(guestResult.allowed).toBe(false); // Has neither
      if (!guestResult.allowed) expect(guestResult.error).toContain("Required any of");
    });

    it("should create all permissions requirement middleware", () => {
      const admin = createTestUser("admin", [Role.ADMIN]);
      const user = createTestUser("user", [Role.USER]);

      const requireAllPermissions = rbac.requireAllPermissions([
        Permission.READ_CONTENT,
        Permission.ADMIN_ACCESS,
      ]);

      const adminResult = requireAllPermissions(createAuthContext(admin));
      expect(adminResult.allowed).toBe(true); // Has both

      const userResult = requireAllPermissions(createAuthContext(user));
      expect(userResult.allowed).toBe(false); // Missing ADMIN_ACCESS
      if (!userResult.allowed) expect(userResult.error).toContain("Required all of");
    });
  });

  describe("Role and Permission Enumeration", () => {
    it("should get all roles", () => {
      const roles = rbac.getAllRoles();

      expect(roles).toContain(Role.ADMIN);
      expect(roles).toContain(Role.USER);
      expect(roles).toContain(Role.GUEST);
      expect(roles.length).toBe(3);
    });

    it("should get all permissions", () => {
      const permissions = rbac.getAllPermissions();

      expect(permissions).toContain(Permission.ADMIN_ACCESS);
      expect(permissions).toContain(Permission.CREATE_USER);
      expect(permissions).toContain(Permission.READ_CONTENT);
      expect(permissions).toContain(Permission.API_READ);
      expect(permissions.length).toBeGreaterThan(10);
    });
  });

  describe("Role Hierarchy", () => {
    it("should define role hierarchy", () => {
      const hierarchy = rbac.getRoleHierarchy();

      expect(hierarchy.get(Role.ADMIN)).toEqual([Role.USER, Role.GUEST]);
      expect(hierarchy.get(Role.USER)).toEqual([Role.GUEST]);
      expect(hierarchy.get(Role.GUEST)).toEqual([]);
    });

    it("should check role inheritance", () => {
      expect(rbac.roleInheritsFrom(Role.ADMIN, Role.USER)).toBe(true);
      expect(rbac.roleInheritsFrom(Role.ADMIN, Role.GUEST)).toBe(true);
      expect(rbac.roleInheritsFrom(Role.USER, Role.GUEST)).toBe(true);

      expect(rbac.roleInheritsFrom(Role.USER, Role.ADMIN)).toBe(false);
      expect(rbac.roleInheritsFrom(Role.GUEST, Role.USER)).toBe(false);
      expect(rbac.roleInheritsFrom(Role.GUEST, Role.ADMIN)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty role arrays", () => {
      const noRoleUser = createTestUser("norole", []);

      expect(rbac.hasPermission(noRoleUser, Permission.READ_CONTENT)).toBe(false);
      expect(rbac.hasAnyPermission(noRoleUser, [Permission.READ_CONTENT])).toBe(false);
      expect(rbac.hasAllPermissions(noRoleUser, [])).toBe(true); // Vacuous truth
      expect(rbac.getUserPermissions(noRoleUser)).toEqual([]);
    });

    it("should handle empty permission arrays", () => {
      const user = createTestUser("user", [Role.USER]);

      expect(rbac.hasAnyPermission(user, [])).toBe(false);
      expect(rbac.hasAllPermissions(user, [])).toBe(true); // Vacuous truth
    });

    it("should handle non-existent roles gracefully", () => {
      const invalidRoleUser = { ...createTestUser("invalid", []), roles: ["invalid" as Role] };

      expect(rbac.hasPermission(invalidRoleUser, Permission.READ_CONTENT)).toBe(false);
      expect(rbac.getUserPermissions(invalidRoleUser)).toEqual([]);
    });
  });
});
