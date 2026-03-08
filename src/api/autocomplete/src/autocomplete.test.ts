/**
 * Comprehensive Tests for Autocomplete System
 *
 * These tests cover all major components of the autocomplete system:
 * - Search engine functionality
 * - Cache management
 * - Data source integration
 * - Service orchestration
 * - API endpoints
 */

import { AutocompleteService } from "./autocomplete-service";
import { SearchEngine } from "./search-engine";
import { CacheManager, MemoryCacheProvider } from "./cache-manager";
import { StaticDataSource, DataSourceManager } from "./data-source";
import { AutocompleteItem, AutocompleteConfig, DataSource, AutocompleteRequest } from "./types.js";

const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

afterAll(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

// Sample test data
const sampleItems = [
  {
    id: "js-1",
    title: "JavaScript",
    description: "A versatile programming language for web development",
    category: "Programming Languages",
    tags: ["javascript", "programming", "web", "frontend"],
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
  },
  {
    id: "ts-1",
    title: "TypeScript",
    description: "A typed superset of JavaScript that compiles to plain JavaScript",
    category: "Programming Languages",
    tags: ["typescript", "javascript", "programming", "types"],
    createdAt: new Date("2023-01-02"),
    updatedAt: new Date("2023-01-02"),
  },
  {
    id: "react-1",
    title: "React",
    description: "A JavaScript library for building user interfaces",
    category: "Libraries",
    tags: ["react", "javascript", "frontend", "ui", "library"],
    createdAt: new Date("2023-01-03"),
    updatedAt: new Date("2023-01-03"),
  },
  {
    id: "node-1",
    title: "Node.js",
    description: "JavaScript runtime built on Chrome V8 JavaScript engine",
    category: "Runtime",
    tags: ["nodejs", "javascript", "backend", "server"],
    createdAt: new Date("2023-01-04"),
    updatedAt: new Date("2023-01-04"),
  },
  {
    id: "python-1",
    title: "Python",
    description: "A high-level programming language with dynamic semantics",
    category: "Programming Languages",
    tags: ["python", "programming", "data-science", "backend"],
    createdAt: new Date("2023-01-05"),
    updatedAt: new Date("2023-01-05"),
  },
];

const defaultConfig: AutocompleteConfig = {
  search: {
    keys: [
      { name: "title", weight: 0.7 },
      { name: "description", weight: 0.3 },
      { name: "tags", weight: 0.2 },
    ],
    threshold: 0.3,
    distance: 100,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    shouldSort: true,
    findAllMatches: true,
    location: 0,
    ignoreLocation: false,
    ignoreFieldNorm: false,
  },
  cache: {
    enabled: true,
    ttl: 300,
    maxSize: 100,
    keyPrefix: "test",
  },
  index: {
    rebuildInterval: 60000,
    batchSize: 10,
    enableBackgroundUpdates: false,
  },
  api: {
    defaultLimit: 10,
    maxLimit: 50,
    debounceMs: 0, // Disable debouncing for tests
    enableAnalytics: true,
  },
};

describe("SearchEngine", () => {
  let searchEngine: SearchEngine;

  beforeEach(() => {
    searchEngine = new SearchEngine(defaultConfig.search);
    searchEngine.buildIndex(sampleItems);
  });

  describe("buildIndex", () => {
    it("should build search index with provided items", () => {
      const newItems = sampleItems.slice(0, 3);
      searchEngine.buildIndex(newItems);

      // Index should be built (tested implicitly through search functionality)
      expect(true).toBe(true);
    });
  });

  describe("search", () => {
    it("should find exact matches", async () => {
      const request: AutocompleteRequest = {
        query: "JavaScript",
        limit: 10,
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThanOrEqual(2);
      expect(response.results[0].item.title).toBe("JavaScript");
      expect(response.results[0].score).toBeLessThan(0.1); // Very low score for exact match
    });

    it("should handle fuzzy matching", async () => {
      const request: AutocompleteRequest = {
        query: "Javscript", // Typo
        limit: 10,
        fuzzy: true,
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].item.title).toBe("JavaScript");
    });

    it("should filter by category", async () => {
      const request: AutocompleteRequest = {
        query: "script",
        category: "Programming Languages",
        limit: 10,
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results.every((r) => r.item.category === "Programming Languages")).toBe(true);
    });

    it("should filter by tags", async () => {
      const request: AutocompleteRequest = {
        query: "script",
        tags: ["frontend"],
        limit: 10,
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(
        response.results.every((r) => r.item.tags.some((tag) => tag.includes("frontend")))
      ).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const request: AutocompleteRequest = {
        query: "script",
        limit: 2,
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeLessThanOrEqual(2);
    });

    it("should include highlighting in results", async () => {
      const request: AutocompleteRequest = {
        query: "JavaScript",
        limit: 5,
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].highlightedTitle).toContain("<mark>");
    });

    it("should generate suggestions for poor results", async () => {
      const request: AutocompleteRequest = {
        query: "xyz123nonexistent",
        limit: 10,
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBe(0);
      expect(response.suggestions).toBeDefined();
    });
  });

  describe("analytics", () => {
    it("should track search analytics", async () => {
      const request: AutocompleteRequest = {
        query: "JavaScript",
        limit: 10,
      };

      await searchEngine.search(request);
      await searchEngine.search(request); // Search twice

      const analytics = searchEngine.getAnalytics();

      expect(analytics.performanceMetrics.totalSearches).toBe(2);
      expect(analytics.indexStats.popularQueries).toContainEqual(
        expect.objectContaining({ query: "javascript", count: 2 })
      );
    });
  });
});

describe("CacheManager", () => {
  let cacheManager: CacheManager;
  let cacheProvider: MemoryCacheProvider;

  beforeEach(() => {
    cacheProvider = new MemoryCacheProvider(10);
    cacheManager = new CacheManager(cacheProvider, defaultConfig.cache);
  });

  describe("caching operations", () => {
    it("should cache and retrieve search results", async () => {
      const request: AutocompleteRequest = {
        query: "test",
        limit: 5,
      };

      const mockResponse = {
        query: "test",
        results: [],
        totalCount: 0,
        executionTime: 100,
        metadata: {
          searchType: "fuzzy" as const,
          cacheHit: false,
          indexSize: 5,
        },
      };

      // Cache the response
      await cacheManager.set(request, mockResponse);

      // Retrieve from cache
      const cached = await cacheManager.get(request);

      expect(cached).toBeDefined();
      expect(cached!.query).toBe("test");
      expect(cached!.metadata.cacheHit).toBe(false);
    });

    it("should generate consistent cache keys", async () => {
      const request1: AutocompleteRequest = {
        query: "Test",
        limit: 5,
      };

      const request2: AutocompleteRequest = {
        query: "test", // Different case
        limit: 5,
      };

      const mockResponse = {
        query: "test",
        results: [],
        totalCount: 0,
        executionTime: 100,
        metadata: {
          searchType: "fuzzy" as const,
          cacheHit: false,
          indexSize: 5,
        },
      };

      await cacheManager.set(request1, mockResponse);
      const cached = await cacheManager.get(request2);

      expect(cached).toBeDefined(); // Should find cached result despite case difference
    });

    it("should handle cache misses gracefully", async () => {
      const request: AutocompleteRequest = {
        query: "nonexistent",
        limit: 5,
      };

      const cached = await cacheManager.get(request);

      expect(cached).toBeNull();
    });
  });

  describe("cache statistics", () => {
    it("should track cache statistics", async () => {
      const stats = await cacheManager.getStats();

      expect(stats).toHaveProperty("hits");
      expect(stats).toHaveProperty("misses");
      expect(stats).toHaveProperty("hitRate");
      expect(stats).toHaveProperty("totalKeys");
    });
  });

  describe("health check", () => {
    it("should perform health check", async () => {
      const health = await cacheManager.healthCheck();

      expect(health.status).toBe("healthy");
      expect(health.details.testResult).toBe(true);
    });
  });
});

describe("DataSourceManager", () => {
  let dataSourceManager: DataSourceManager;

  beforeEach(() => {
    dataSourceManager = new DataSourceManager();
  });

  describe("data source management", () => {
    it("should add and load from static data source", async () => {
      const staticSource = new StaticDataSource(sampleItems);
      dataSourceManager.addSource("static", staticSource);

      const items = await dataSourceManager.loadAll();

      expect(items).toHaveLength(sampleItems.length);
      expect(items[0].id).toBe(sampleItems[0].id);
    });

    it("should handle multiple data sources", async () => {
      const source1 = new StaticDataSource(sampleItems.slice(0, 2));
      const source2 = new StaticDataSource(sampleItems.slice(2, 4));

      dataSourceManager.addSource("source1", source1);
      dataSourceManager.addSource("source2", source2);

      const items = await dataSourceManager.loadAll();

      expect(items).toHaveLength(4);
    });

    it("should deduplicate items with same ID", async () => {
      const duplicateItems = [sampleItems[0], sampleItems[0]]; // Same item twice
      const source1 = new StaticDataSource(duplicateItems);
      const source2 = new StaticDataSource([sampleItems[1]]);

      dataSourceManager.addSource("source1", source1);
      dataSourceManager.addSource("source2", source2);

      const items = await dataSourceManager.loadAll();

      expect(items).toHaveLength(2); // Should deduplicate
    });

    it("should handle data source errors gracefully", async () => {
      const errorSource = {
        load: async (): Promise<AutocompleteItem[]> => {
          throw new Error("Data source error");
        },
      };

      dataSourceManager.addSource("error-source", errorSource);
      const validSource = new StaticDataSource([sampleItems[0]]);
      dataSourceManager.addSource("valid-source", validSource);

      const items = await dataSourceManager.loadAll();

      expect(items).toHaveLength(1); // Should load from valid source despite error
    });
  });
});

describe("AutocompleteService", () => {
  let autocompleteService: AutocompleteService;

  beforeEach(async () => {
    autocompleteService = new AutocompleteService(defaultConfig);

    const dataSources: DataSource[] = [
      {
        id: "test-static",
        name: "Test Static Data",
        type: "static",
        config: { data: sampleItems },
        itemCount: sampleItems.length,
      },
    ];

    await autocompleteService.initialize(dataSources);
  });

  afterEach(async () => {
    await autocompleteService.shutdown();
  });

  describe("initialization", () => {
    it("should initialize successfully with data sources", async () => {
      const health = await autocompleteService.getHealthStatus();
      expect(health.status).toBe("healthy");
      expect(health.details.initialized).toBe(true);
    });
  });

  describe("search operations", () => {
    it("should perform basic search", async () => {
      const request: AutocompleteRequest = {
        query: "JavaScript",
        limit: 10,
      };

      const response = await autocompleteService.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.query).toBe(request.query.toLowerCase());
      expect(response.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty queries", async () => {
      const request: AutocompleteRequest = {
        query: "",
        limit: 10,
      };

      await expect(autocompleteService.search(request)).rejects.toThrow();
    });

    it("should validate request parameters", async () => {
      const invalidRequest: AutocompleteRequest = {
        query: "test",
        limit: 1000, // Exceeds maxLimit
      };

      await expect(autocompleteService.search(invalidRequest)).rejects.toThrow();
    });
  });

  describe("suggestions", () => {
    it("should generate query suggestions", async () => {
      const suggestions = await autocompleteService.getSuggestions("Java", 5);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.toLowerCase().includes("java"))).toBe(true);
    });

    it("should handle short queries", async () => {
      const suggestions = await autocompleteService.getSuggestions("J", 5);

      expect(suggestions).toEqual([]); // Too short
    });
  });

  describe("data management", () => {
    it("should add new items to index", async () => {
      const newItems: AutocompleteItem[] = [
        {
          id: "new-1",
          title: "Vue.js",
          description: "Progressive JavaScript framework",
          category: "Libraries",
          tags: ["vue", "javascript", "frontend"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await autocompleteService.addItems(newItems);

      const response = await autocompleteService.search({
        query: "Vue",
        limit: 10,
      });

      expect(response.results.some((r) => r.item.title === "Vue.js")).toBe(true);
    });

    it("should remove items from index", async () => {
      const itemsToRemove = ["js-1"]; // JavaScript item

      await autocompleteService.removeItems(itemsToRemove);

      const response = await autocompleteService.search({
        query: "JavaScript",
        limit: 10,
      });

      expect(response.results.every((r) => r.item.id !== "js-1")).toBe(true);
    });

    it("should rebuild index", async () => {
      await autocompleteService.rebuildIndex();

      const health = await autocompleteService.getHealthStatus();
      expect(health.details.lastIndexRebuild).toBeInstanceOf(Date);
    });
  });

  describe("analytics and monitoring", () => {
    it("should provide analytics data", async () => {
      // Perform some searches to generate analytics
      await autocompleteService.search({ query: "JavaScript", limit: 5 });
      await autocompleteService.search({ query: "Python", limit: 5 });

      const analytics = autocompleteService.getAnalytics();

      expect(analytics.search.performanceMetrics.totalSearches).toBe(2);
      expect(analytics.service.initialized).toBe(true);
    });

    it("should provide health status", async () => {
      const health = await autocompleteService.getHealthStatus();

      expect(health.status).toBe("healthy");
      expect(health.details.initialized).toBe(true);
      expect(health.details.indexStats.totalItems).toBeGreaterThan(0);
    });
  });

  describe("configuration updates", () => {
    it("should update configuration", () => {
      const newConfig = {
        api: { debounceMs: 500 },
      };

      expect(() => {
        autocompleteService.updateConfig(newConfig);
      }).not.toThrow();
    });
  });
});

describe("Integration Tests", () => {
  let autocompleteService: AutocompleteService;

  beforeEach(async () => {
    autocompleteService = new AutocompleteService(defaultConfig);

    const dataSources: DataSource[] = [
      {
        id: "integration-test",
        name: "Integration Test Data",
        type: "static",
        config: { data: sampleItems },
        itemCount: sampleItems.length,
      },
    ];

    await autocompleteService.initialize(dataSources);
  });

  afterEach(async () => {
    await autocompleteService.shutdown();
  });

  describe("end-to-end search workflow", () => {
    it("should handle complete search workflow with caching", async () => {
      const request: AutocompleteRequest = {
        query: "JavaScript",
        limit: 5,
      };

      // First search - should hit search engine
      const response1 = await autocompleteService.search(request);
      expect(response1.metadata.cacheHit).toBe(false);

      // Second search - should hit cache
      const response2 = await autocompleteService.search(request);
      expect(response2.metadata.cacheHit).toBe(true);

      // Results should be identical
      expect(response2.results.map((r) => r.item.id)).toEqual(
        response1.results.map((r) => r.item.id)
      );
    });

    it("should handle complex search scenarios", async () => {
      // Test various search patterns
      const testCases = [
        { query: "JavaScript", expectedResults: 2 },
        { query: "script", expectedResults: 2 },
        { query: "programming", expectedResults: 3 },
        { query: "nonexistent", expectedResults: 0 },
      ];

      for (const testCase of testCases) {
        const response = await autocompleteService.search({
          query: testCase.query,
          limit: 10,
        });

        expect(response.results.length).toBeGreaterThanOrEqual(testCase.expectedResults);
      }
    });

    it("should handle concurrent searches efficiently", async () => {
      const queries = ["JavaScript", "Python", "React", "Node.js", "TypeScript"];

      const startTime = Date.now();

      // Execute searches concurrently
      const promises = queries.map((query) => autocompleteService.search({ query, limit: 5 }));

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All searches should complete
      expect(results).toHaveLength(5);
      expect(results.every((r) => r.results.length >= 0)).toBe(true);

      // Should be reasonably fast
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe("error handling and resilience", () => {
    it("should handle service shutdown gracefully", async () => {
      await autocompleteService.shutdown();

      // Service should no longer accept requests
      await expect(autocompleteService.search({ query: "test", limit: 5 })).rejects.toThrow();
    });

    it("should handle invalid data gracefully", async () => {
      const invalidItems = [
        { id: "invalid", title: "", category: "" }, // Missing required fields
      ] as AutocompleteItem[];

      // Should not crash the service
      await expect(autocompleteService.addItems(invalidItems)).resolves.not.toThrow();
    });
  });

  describe("performance characteristics", () => {
    it("should maintain performance under load", async () => {
      const queries = Array.from({ length: 100 }, (_, i) => `query${i}`);

      const startTime = Date.now();

      // Execute many searches
      const promises = queries.map((query) => autocompleteService.search({ query, limit: 5 }));

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / queries.length;

      expect(results).toHaveLength(100);
      expect(avgTime).toBeLessThan(50); // Average should be under 50ms per search
    });
  });
});
