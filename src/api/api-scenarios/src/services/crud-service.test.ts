import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { CrudService, Repository, CrudServiceOptions } from "./crud-service";
import { AuditLog, PaginatedResponse } from "../types/common";
import { CrudErrorCode, QueryOperator, BaseEntityField, UserRole } from "../constants";

interface TestEntity {
  id: string;
  name: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
  version?: number;
  deletedAt?: Date | null;
}

const createEntity = (overrides: Partial<TestEntity> = {}): TestEntity => ({
  id: "entity-1",
  name: "Test Entity",
  value: 42,
  createdAt: new Date("2023-01-01T00:00:00Z"),
  updatedAt: new Date("2023-01-01T00:00:00Z"),
  deletedAt: null,
  ...overrides,
});

const createRepository = (): jest.Mocked<Repository<TestEntity>> => ({
  findById: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  bulkCreate: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkDelete: jest.fn(),
  count: jest.fn(),
});

const createAuditRepository = (): jest.Mocked<Repository<AuditLog>> => ({
  findById: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  bulkCreate: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkDelete: jest.fn(),
  count: jest.fn(),
});

describe("CrudService", () => {
  let repository: jest.Mocked<Repository<TestEntity>>;
  let auditRepository: jest.Mocked<Repository<AuditLog>>;
  let options: CrudServiceOptions<TestEntity>;
  let service: CrudService<TestEntity>;

  beforeEach(() => {
    repository = createRepository();
    auditRepository = createAuditRepository();
    options = {
      entityName: "TestEntity",
      softDelete: true,
      auditEnabled: true,
      validator: jest.fn().mockResolvedValue([]),
      transformer: jest.fn((entity) => ({ ...entity, name: entity.name.trim() })),
    };
    service = new CrudService<TestEntity>(repository, options, auditRepository);
  });

  describe("create", () => {
    it("returns validation error when validator fails", async () => {
      (options.validator as jest.Mock).mockResolvedValue(["Invalid"]);

      const result = await service.create({
        name: " Invalid ",
        value: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CrudErrorCode.VALIDATION_ERROR);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("creates entity, applies transformer, and logs audit", async () => {
      const entity = createEntity({ id: "entity-99", name: "Trimmed" });
      repository.create.mockResolvedValue(entity);

      const payload = {
        name: " Trimmed ",
        value: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.create(payload, "user-1");

      expect(repository.create).toHaveBeenCalledWith({
        ...payload,
        name: "Trimmed",
      });
      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "TestEntity",
          entityId: "entity-99",
          action: "CREATE",
          userId: "user-1",
        })
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(entity);
    });
  });

  describe("getById", () => {
    it("rejects empty IDs", async () => {
      const result = await service.getById("", UserRole.USER);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_ID");
    });

    it("returns not found for missing entity or soft-deleted entity", async () => {
      repository.findById.mockResolvedValue(null);
      const missing = await service.getById("missing");
      expect(missing.success).toBe(false);
      expect(missing.error?.code).toBe(CrudErrorCode.NOT_FOUND);

      const deletedEntity = createEntity({ deletedAt: new Date() });
      repository.findById.mockResolvedValue(deletedEntity);
      const deleted = await service.getById("deleted");
      expect(deleted.success).toBe(false);
      expect(deleted.error?.code).toBe(CrudErrorCode.NOT_FOUND);
    });

    it("returns entity and logs audit trail", async () => {
      const entity = createEntity();
      repository.findById.mockResolvedValue(entity);

      const result = await service.getById(entity.id, "user-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(entity);
      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "READ", entityId: entity.id })
      );
    });
  });

  describe("getMany", () => {
    it("sanitizes query and adds soft delete filter", async () => {
      const entity = createEntity();
      const paginated: PaginatedResponse<TestEntity> = {
        data: [entity],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      repository.findMany.mockResolvedValue(paginated);

      const result = await service.getMany({
        pagination: { page: 0, limit: 200, sortOrder: "invalid" as "asc" | "desc" },
        filters: [
          { field: "name", operator: QueryOperator.EQ, value: "Test" },
          { field: "", operator: QueryOperator.EQ, value: "ignored" },
        ],
        sort: [{ field: "", order: "invalid" as "asc" | "desc" }],
        fields: ["name", ""],
        include: ["related", ""],
      });

      expect(result.success).toBe(true);
      const sanitizedQuery = repository.findMany.mock.calls[0][0];
      expect(sanitizedQuery.pagination.limit).toBe(100);
      expect(sanitizedQuery.pagination.page).toBe(1);
      expect(sanitizedQuery.filters).toEqual(
        expect.arrayContaining([
          { field: "name", operator: QueryOperator.EQ, value: "Test" },
          { field: BaseEntityField.DELETED_AT, operator: QueryOperator.EXISTS, value: false },
        ])
      );
    });
  });

  describe("update", () => {
    it("validates updates and handles conflicts", async () => {
      const entity = createEntity();
      repository.findById.mockResolvedValue(entity);
      (options.validator as jest.Mock).mockResolvedValue(["Invalid"]);

      const invalid = await service.update(entity.id, { name: "" });
      expect(invalid.success).toBe(false);
      expect(invalid.error?.code).toBe(CrudErrorCode.VALIDATION_ERROR);
      expect(repository.update).not.toHaveBeenCalled();

      (options.validator as jest.Mock).mockResolvedValue([]);
      repository.update.mockRejectedValue(new Error("version conflict"));
      const conflict = await service.update(entity.id, { name: "New" });
      expect(conflict.success).toBe(false);
      expect(conflict.error?.code).toBe("CONFLICT");
    });

    it("updates entity with transformed data and logs audit", async () => {
      const entity = createEntity();
      repository.findById.mockResolvedValue(entity);
      const updated = { ...entity, name: "Updated" };
      repository.update.mockResolvedValue(updated);

      const result = await service.update(entity.id, { name: " Updated " }, UserRole.USER);

      expect(repository.update).toHaveBeenCalledWith(entity.id, { name: "Updated" }, undefined);
      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "UPDATE", entityId: entity.id })
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });
  });

  describe("delete", () => {
    it("performs soft delete by default and hard delete when forced", async () => {
      const entity = createEntity();
      repository.findById.mockResolvedValue(entity);
      repository.update.mockResolvedValue({ ...entity, deletedAt: new Date() });

      const soft = await service.delete(entity.id, UserRole.ADMIN);
      expect(soft.success).toBe(true);
      expect(repository.update).toHaveBeenCalledWith(
        entity.id,
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );

      repository.findById.mockResolvedValue(entity);
      repository.delete.mockResolvedValue(true);
      const hard = await service.delete(entity.id, UserRole.ADMIN, true);
      expect(hard.success).toBe(true);
      expect(repository.delete).toHaveBeenCalledWith(entity.id);
    });
  });

  describe("bulkCreate", () => {
    it("aggregates validation errors per entity", async () => {
      (options.validator as jest.Mock).mockImplementation(async (entity: Partial<TestEntity>) =>
        entity.name === "bad" ? ["Missing field"] : []
      );

      const result = await service.bulkCreate([
        { name: "bad", value: 1, createdAt: new Date(), updatedAt: new Date() },
        { name: "good", value: 2, createdAt: new Date(), updatedAt: new Date() },
      ]);

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(false);
      expect(result.data?.failed).toBe(1);
      expect(repository.bulkCreate).not.toHaveBeenCalled();
    });

    it("creates entities in bulk and logs audits", async () => {
      (options.validator as jest.Mock).mockResolvedValue([]);
      repository.bulkCreate.mockResolvedValue([
        createEntity({ id: "entity-1" }),
        createEntity({ id: "entity-2" }),
      ]);

      const payload = [
        { name: "First", value: 1, createdAt: new Date(), updatedAt: new Date() },
        { name: "Second", value: 2, createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = await service.bulkCreate(payload, UserRole.USER);

      expect(repository.bulkCreate).toHaveBeenCalled();
      const transformedPayload = repository.bulkCreate.mock.calls[0][0];
      expect(transformedPayload[0].name).toBe("First");
      expect(transformedPayload[1].name).toBe("Second");
      expect(auditRepository.create).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });
  });

  describe("count", () => {
    it("adds soft delete filter before counting", async () => {
      repository.count.mockResolvedValue(5);

      const result = await service.count([
        { field: "name", operator: QueryOperator.EQ, value: "Test" },
      ]);

      expect(repository.count).toHaveBeenCalledWith(
        expect.arrayContaining([
          { field: "name", operator: QueryOperator.EQ, value: "Test" },
          { field: BaseEntityField.DELETED_AT, operator: QueryOperator.EXISTS, value: false },
        ])
      );
      expect(result.data).toBe(5);
    });
  });

  describe("restore", () => {
    it("returns errors for unsupported scenarios", async () => {
      const nonSoftDeleteService = new CrudService<TestEntity>(repository, {
        entityName: "NonSoft",
        softDelete: false,
      });

      const notSupported = await nonSoftDeleteService.restore("id");
      expect(notSupported.success).toBe(false);
      expect(notSupported.error?.code).toBe("NOT_SUPPORTED");

      repository.findById.mockResolvedValue(null);
      const missing = await service.restore("missing");
      expect(missing.success).toBe(false);
      expect(missing.error?.code).toBe(CrudErrorCode.NOT_FOUND);

      repository.findById.mockResolvedValue(createEntity({ deletedAt: null }));
      const notDeleted = await service.restore("active");
      expect(notDeleted.success).toBe(false);
      expect(notDeleted.error?.code).toBe("NOT_DELETED");
    });

    it("restores soft-deleted entities and logs audit", async () => {
      const entity = createEntity({ deletedAt: new Date("2023-01-02T00:00:00Z") });
      repository.findById.mockResolvedValue(entity);
      repository.update.mockResolvedValue({ ...entity, deletedAt: null });

      const result = await service.restore(entity.id, UserRole.USER);

      expect(repository.update).toHaveBeenCalledWith(entity.id, { deletedAt: null });
      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "UPDATE", entityId: entity.id })
      );
      expect(result.success).toBe(true);
    });
  });
});
