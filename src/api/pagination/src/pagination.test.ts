// pagination.test.ts
import { describe, it, expect, afterEach } from "@jest/globals";
import {
  paginate,
  paginateWithPageBased,
  paginateWithOffsetBased,
  createPageBasedRequest,
  createOffsetBasedRequest,
  pageToOffset,
  offsetToPage,
  PaginationType,
  type Employee,
  type PageBasedResult,
  type OffsetBasedResult,
  type PageBasedRequest,
  type OffsetBasedRequest,
  type PaginationRequest,
  type PaginationConfig,
} from "./pagination";

// Sample test data
const sampleEmployees: Employee[] = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice.johnson@example.com",
    age: 28,
    department: "Engineering",
    position: "Software Engineer",
    salary: 85000,
    joinDate: "2022-03-15",
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob.smith@example.com",
    age: 34,
    department: "Marketing",
    position: "Marketing Manager",
    salary: 72000,
    joinDate: "2021-07-22",
  },
  {
    id: 3,
    name: "Carol Davis",
    email: "carol.davis@example.com",
    age: 29,
    department: "Engineering",
    position: "Senior Software Engineer",
    salary: 95000,
    joinDate: "2020-11-08",
  },
  {
    id: 4,
    name: "David Wilson",
    email: "david.wilson@example.com",
    age: 42,
    department: "Sales",
    position: "Sales Director",
    salary: 110000,
    joinDate: "2019-05-12",
  },
  {
    id: 5,
    name: "Eva Brown",
    email: "eva.brown@example.com",
    age: 31,
    department: "HR",
    position: "HR Manager",
    salary: 68000,
    joinDate: "2021-09-30",
  },
];

// Global cleanup after each test
afterEach(async () => {
  // Clear any timers that might be running
  jest.clearAllTimers();

  // Clear all mocks
  jest.clearAllMocks();
});

describe("Page-based pagination", () => {
  it("should return correct first page with default limit", () => {
    const request = createPageBasedRequest(1, 2);
    const result = paginateWithPageBased(sampleEmployees, request) as PageBasedResult<Employee>;

    expect(result.type).toBe(PaginationType.PAGE_BASED);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe(1);
    expect(result.data[1].id).toBe(2);
    expect(result.total).toBe(5);
    expect(result.limit).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(3);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPage).toBe(false);
  });

  it("should return correct second page", () => {
    const request = createPageBasedRequest(2, 2);
    const result = paginateWithPageBased(sampleEmployees, request) as PageBasedResult<Employee>;

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe(3);
    expect(result.data[1].id).toBe(4);
    expect(result.page).toBe(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPage).toBe(true);
  });

  it("should return correct last page with partial data", () => {
    const request = createPageBasedRequest(3, 2);
    const result = paginateWithPageBased(sampleEmployees, request) as PageBasedResult<Employee>;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(5);
    expect(result.page).toBe(3);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(true);
  });

  it("should return empty data for page beyond total pages", () => {
    const request = createPageBasedRequest(10, 2);
    const result = paginateWithPageBased(sampleEmployees, request) as PageBasedResult<Employee>;

    expect(result.data).toHaveLength(0);
    expect(result.page).toBe(10);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(true);
  });

  it("should handle invalid page numbers by normalizing to 1", () => {
    const request = createPageBasedRequest(-1, 2);
    const result = paginateWithPageBased(sampleEmployees, request) as PageBasedResult<Employee>;

    expect(result.page).toBe(1);
    expect(result.data[0].id).toBe(1);
  });

  it("should respect custom pagination config", () => {
    const config: PaginationConfig = { defaultLimit: 3, maxLimit: 4 };
    const request = createPageBasedRequest(1, 10); // Request more than maxLimit
    const result = paginateWithPageBased(
      sampleEmployees,
      request,
      config
    ) as PageBasedResult<Employee>;

    expect(result.limit).toBe(4); // Should be capped at maxLimit
    expect(result.data).toHaveLength(4);
  });

  it("should use default limit when not specified", () => {
    const request = createPageBasedRequest(1); // No limit specified
    const result = paginateWithPageBased(sampleEmployees, request) as PageBasedResult<Employee>;

    expect(result.limit).toBe(10); // Default limit
  });
});

describe("Offset-based pagination", () => {
  it("should return correct first batch with offset 0", () => {
    const request = createOffsetBasedRequest(0, 2);
    const result = paginateWithOffsetBased(sampleEmployees, request) as OffsetBasedResult<Employee>;

    expect(result.type).toBe(PaginationType.OFFSET_BASED);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe(1);
    expect(result.data[1].id).toBe(2);
    expect(result.total).toBe(5);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);
    expect(result.hasMore).toBe(true);
  });

  it("should return correct batch with offset 2", () => {
    const request = createOffsetBasedRequest(2, 2);
    const result = paginateWithOffsetBased(sampleEmployees, request) as OffsetBasedResult<Employee>;

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe(3);
    expect(result.data[1].id).toBe(4);
    expect(result.offset).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it("should return correct last batch with partial data", () => {
    const request = createOffsetBasedRequest(4, 2);
    const result = paginateWithOffsetBased(sampleEmployees, request) as OffsetBasedResult<Employee>;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(5);
    expect(result.offset).toBe(4);
    expect(result.hasMore).toBe(false);
  });

  it("should return empty data for offset beyond total items", () => {
    const request = createOffsetBasedRequest(10, 2);
    const result = paginateWithOffsetBased(sampleEmployees, request) as OffsetBasedResult<Employee>;

    expect(result.data).toHaveLength(0);
    expect(result.offset).toBe(10);
    expect(result.hasMore).toBe(false);
  });

  it("should handle negative offset by normalizing to 0", () => {
    const request = createOffsetBasedRequest(-5, 2);
    const result = paginateWithOffsetBased(sampleEmployees, request) as OffsetBasedResult<Employee>;

    expect(result.offset).toBe(0);
    expect(result.data[0].id).toBe(1);
  });

  it("should respect custom pagination config", () => {
    const config: PaginationConfig = { defaultLimit: 3, maxLimit: 4 };
    const request = createOffsetBasedRequest(0, 10); // Request more than maxLimit
    const result = paginateWithOffsetBased(
      sampleEmployees,
      request,
      config
    ) as OffsetBasedResult<Employee>;

    expect(result.limit).toBe(4); // Should be capped at maxLimit
    expect(result.data).toHaveLength(4);
  });

  it("should use default limit when not specified", () => {
    const request = createOffsetBasedRequest(0); // No limit specified
    const result = paginateWithOffsetBased(sampleEmployees, request) as OffsetBasedResult<Employee>;

    expect(result.limit).toBe(10); // Default limit
  });
});

describe("Generic paginate function", () => {
  it("should handle page-based requests", () => {
    const request = createPageBasedRequest(1, 2);
    const result = paginate(sampleEmployees, request);

    expect(result.type).toBe(PaginationType.PAGE_BASED);
    expect(result.data).toHaveLength(2);
    expect((result as PageBasedResult<Employee>).page).toBe(1);
  });

  it("should handle offset-based requests", () => {
    const request = createOffsetBasedRequest(0, 2);
    const result = paginate(sampleEmployees, request);

    expect(result.type).toBe(PaginationType.OFFSET_BASED);
    expect(result.data).toHaveLength(2);
    expect((result as OffsetBasedResult<Employee>).offset).toBe(0);
  });

  it("should throw error for invalid pagination type", () => {
    const invalidRequest = { type: "invalid_type" as unknown, limit: 10 };

    expect(() => paginate(sampleEmployees, invalidRequest as PaginationRequest)).toThrow(
      "Invalid pagination type: invalid_type"
    );
  });
});

describe("Helper functions", () => {
  describe("createPageBasedRequest", () => {
    it("should create request with default values", () => {
      const request = createPageBasedRequest();

      expect(request.type).toBe(PaginationType.PAGE_BASED);
      expect(request.page).toBe(1);
      expect(request.limit).toBe(10);
    });

    it("should create request with custom values", () => {
      const request = createPageBasedRequest(3, 5);

      expect(request.page).toBe(3);
      expect(request.limit).toBe(5);
    });
  });

  describe("createOffsetBasedRequest", () => {
    it("should create request with default values", () => {
      const request = createOffsetBasedRequest();

      expect(request.type).toBe(PaginationType.OFFSET_BASED);
      expect(request.offset).toBe(0);
      expect(request.limit).toBe(10);
    });

    it("should create request with custom values", () => {
      const request = createOffsetBasedRequest(20, 5);

      expect(request.offset).toBe(20);
      expect(request.limit).toBe(5);
    });
  });

  describe("pageToOffset", () => {
    it("should convert page 1 to offset 0", () => {
      expect(pageToOffset(1, 10)).toBe(0);
    });

    it("should convert page 2 to correct offset", () => {
      expect(pageToOffset(2, 10)).toBe(10);
    });

    it("should convert page 3 with limit 5 to correct offset", () => {
      expect(pageToOffset(3, 5)).toBe(10);
    });

    it("should handle invalid page numbers", () => {
      expect(pageToOffset(0, 10)).toBe(0);
      expect(pageToOffset(-1, 10)).toBe(0);
    });
  });

  describe("offsetToPage", () => {
    it("should convert offset 0 to page 1", () => {
      expect(offsetToPage(0, 10)).toBe(1);
    });

    it("should convert offset 10 to page 2", () => {
      expect(offsetToPage(10, 10)).toBe(2);
    });

    it("should convert offset 15 with limit 5 to page 4", () => {
      expect(offsetToPage(15, 5)).toBe(4);
    });

    it("should handle invalid offset numbers", () => {
      expect(offsetToPage(-5, 10)).toBe(1);
    });

    it("should handle partial pages correctly", () => {
      expect(offsetToPage(7, 10)).toBe(1); // Still on first page
      expect(offsetToPage(12, 10)).toBe(2); // On second page
    });
  });
});

describe("Edge cases and error handling", () => {
  it("should handle empty dataset", () => {
    const emptyData: Employee[] = [];
    const pageRequest = createPageBasedRequest(1, 10);
    const offsetRequest = createOffsetBasedRequest(0, 10);

    const pageResult = paginateWithPageBased(emptyData, pageRequest) as PageBasedResult<Employee>;
    const offsetResult = paginateWithOffsetBased(
      emptyData,
      offsetRequest
    ) as OffsetBasedResult<Employee>;

    expect(pageResult.data).toHaveLength(0);
    expect(pageResult.total).toBe(0);
    expect(pageResult.totalPages).toBe(0);
    expect(pageResult.hasNextPage).toBe(false);
    expect(pageResult.hasPreviousPage).toBe(false);

    expect(offsetResult.data).toHaveLength(0);
    expect(offsetResult.total).toBe(0);
    expect(offsetResult.hasMore).toBe(false);
  });

  it("should handle single item dataset", () => {
    const singleItemData = [sampleEmployees[0]];
    const pageRequest = createPageBasedRequest(1, 10);
    const offsetRequest = createOffsetBasedRequest(0, 10);

    const pageResult = paginateWithPageBased(
      singleItemData,
      pageRequest
    ) as PageBasedResult<Employee>;
    const offsetResult = paginateWithOffsetBased(
      singleItemData,
      offsetRequest
    ) as OffsetBasedResult<Employee>;

    expect(pageResult.data).toHaveLength(1);
    expect(pageResult.totalPages).toBe(1);
    expect(pageResult.hasNextPage).toBe(false);

    expect(offsetResult.data).toHaveLength(1);
    expect(offsetResult.hasMore).toBe(false);
  });

  it("should handle limit larger than dataset", () => {
    const pageRequest = createPageBasedRequest(1, 100);
    const offsetRequest = createOffsetBasedRequest(0, 100);

    const pageResult = paginateWithPageBased(
      sampleEmployees,
      pageRequest
    ) as PageBasedResult<Employee>;
    const offsetResult = paginateWithOffsetBased(
      sampleEmployees,
      offsetRequest
    ) as OffsetBasedResult<Employee>;

    expect(pageResult.data).toHaveLength(5);
    expect(pageResult.totalPages).toBe(1);
    expect(pageResult.hasNextPage).toBe(false);

    expect(offsetResult.data).toHaveLength(5);
    expect(offsetResult.hasMore).toBe(false);
  });

  it("should enforce minimum limit of 1", () => {
    const config: PaginationConfig = { defaultLimit: 10, maxLimit: 100 };

    // Test with explicit limit of 0
    const pageRequest: PageBasedRequest = {
      type: PaginationType.PAGE_BASED,
      page: 1,
      limit: 0,
    };

    // Test with explicit negative limit
    const offsetRequest: OffsetBasedRequest = {
      type: PaginationType.OFFSET_BASED,
      offset: 0,
      limit: -5,
    };

    const pageResult = paginateWithPageBased(
      sampleEmployees,
      pageRequest,
      config
    ) as PageBasedResult<Employee>;
    const offsetResult = paginateWithOffsetBased(
      sampleEmployees,
      offsetRequest,
      config
    ) as OffsetBasedResult<Employee>;

    expect(pageResult.limit).toBe(1);
    expect(offsetResult.limit).toBe(1);
  });
});

describe("Performance and load testing", () => {
  it("should handle large dataset efficiently", () => {
    // Create a large dataset
    const largeDataset: Employee[] = [];
    for (let i = 1; i <= 10000; i++) {
      largeDataset.push({
        id: i,
        name: `Employee ${i}`,
        email: `employee${i}@example.com`,
        age: 25 + (i % 40),
        department: `Department ${(i % 10) + 1}`,
        position: `Position ${(i % 5) + 1}`,
        salary: 50000 + (i % 50000),
        joinDate: "2020-01-01",
      });
    }

    const startTime = Date.now();

    // Test multiple pagination requests
    for (let page = 1; page <= 100; page++) {
      const pageRequest = createPageBasedRequest(page, 100);
      const result = paginateWithPageBased(largeDataset, pageRequest);
      expect(result.data.length).toBeLessThanOrEqual(100);
    }

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    const isCI = process.env.CI === "true" || process.env.CI === "1";
    const defaultThreshold = isCI ? 3000 : 1000;
    const thresholdMs = process.env.TEST_PERF_THRESHOLD_MS
      ? parseInt(process.env.TEST_PERF_THRESHOLD_MS, 10)
      : defaultThreshold;
    expect(executionTime).toBeLessThan(thresholdMs);
  });

  it("should maintain consistency between page-based and offset-based results", () => {
    const limit = 2;

    for (let page = 1; page <= 3; page++) {
      const offset = pageToOffset(page, limit);

      const pageRequest = createPageBasedRequest(page, limit);
      const offsetRequest = createOffsetBasedRequest(offset, limit);

      const pageResult = paginateWithPageBased(sampleEmployees, pageRequest);
      const offsetResult = paginateWithOffsetBased(sampleEmployees, offsetRequest);

      // Data should be identical
      expect(pageResult.data).toEqual(offsetResult.data);
      expect(pageResult.total).toBe(offsetResult.total);
      expect(pageResult.limit).toBe(offsetResult.limit);
    }
  });
});
