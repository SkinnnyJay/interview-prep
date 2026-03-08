/**
 * Data Source Management for Autocomplete System
 *
 * This module handles different types of data sources that can feed
 * the autocomplete system. It provides a unified interface for
 * loading and managing data from various sources.
 *
 * Key Features:
 * - Multiple data source types (static, database, API, file)
 * - Automatic data synchronization
 * - Data validation and transformation
 * - Performance monitoring
 */

import { AutocompleteItem, DataSource } from "./types";

export interface DataSourceProvider {
  load(): Promise<AutocompleteItem[]>;
  sync?(): Promise<void>;
  validate?(item: AutocompleteItem): boolean;
  transform?(rawData: unknown): AutocompleteItem;
}

export class StaticDataSource implements DataSourceProvider {
  private data: AutocompleteItem[];

  constructor(data: AutocompleteItem[]) {
    this.data = data;
  }

  async load(): Promise<AutocompleteItem[]> {
    console.warn(`📊 Loading ${this.data.length} items from static data source`);
    return [...this.data]; // Return copy to prevent mutations
  }

  validate(item: AutocompleteItem): boolean {
    return !!(item.id && item.title && item.category);
  }
}

export class FileDataSource implements DataSourceProvider {
  private filePath: string;
  private format: "json" | "csv" | "yaml";

  constructor(filePath: string, format: "json" | "csv" | "yaml" = "json") {
    this.filePath = filePath;
    this.format = format;
  }

  async load(): Promise<AutocompleteItem[]> {
    console.warn(`📁 Loading data from file: ${this.filePath}`);

    try {
      // In a real implementation, you'd use fs to read the file
      // For this example, we'll simulate file loading
      const simulatedFileData = this.generateSampleData();

      console.warn(`✅ Loaded ${simulatedFileData.length} items from file`);
      return simulatedFileData;
    } catch (error) {
      console.error(`❌ Failed to load data from file: ${this.filePath}`, error);
      throw new Error(`File data source error: ${error}`);
    }
  }

  private generateSampleData(): AutocompleteItem[] {
    // Simulate loading from a file with sample data
    const categories = ["Technology", "Science", "Business", "Health", "Education"];
    const techTerms = [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "Docker",
      "Kubernetes",
      "Machine Learning",
      "Artificial Intelligence",
      "Blockchain",
      "Cloud Computing",
      "DevOps",
      "Microservices",
      "API Gateway",
      "GraphQL",
      "REST API",
      "WebSocket",
      "Progressive Web App",
      "Single Page Application",
      "Server-Side Rendering",
    ];

    return techTerms.map((term, index) => ({
      id: `file-${index + 1}`,
      title: term,
      description: `${term} - A comprehensive guide and best practices`,
      category: categories[index % categories.length],
      tags: [term.toLowerCase().replace(/\s+/g, "-"), "programming", "technology"],
      metadata: {
        source: "file",
        popularity: Math.floor(Math.random() * 1000),
        difficulty: ["beginner", "intermediate", "advanced"][Math.floor(Math.random() * 3)],
      },
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    }));
  }

  validate(item: AutocompleteItem): boolean {
    return !!(item.id && item.title && item.category);
  }
}

export class ApiDataSource implements DataSourceProvider {
  private apiUrl: string;
  private headers: Record<string, string>;
  private transformFn?: (data: unknown) => AutocompleteItem;

  constructor(
    apiUrl: string,
    headers: Record<string, string> = {},
    transformFn?: (data: unknown) => AutocompleteItem
  ) {
    this.apiUrl = apiUrl;
    this.headers = headers;
    this.transformFn = transformFn;
  }

  async load(): Promise<AutocompleteItem[]> {
    console.warn(`🌐 Loading data from API: ${this.apiUrl}`);

    try {
      // Simulate API call - in real implementation, use fetch or axios
      const simulatedApiData = this.generateApiData();

      const items = simulatedApiData.map((item) =>
        this.transformFn ? this.transformFn(item) : this.defaultTransform(item)
      );

      console.warn(`✅ Loaded ${items.length} items from API`);
      return items;
    } catch (error) {
      console.error(`❌ Failed to load data from API: ${this.apiUrl}`, error);
      throw new Error(`API data source error: ${error}`);
    }
  }

  private generateApiData(): Record<string, unknown>[] {
    // Simulate API response data
    const companies = [
      "Apple",
      "Google",
      "Microsoft",
      "Amazon",
      "Meta",
      "Tesla",
      "Netflix",
      "Spotify",
      "Uber",
      "Airbnb",
      "Stripe",
      "Shopify",
      "Zoom",
      "Slack",
      "GitHub",
      "GitLab",
      "Atlassian",
      "Salesforce",
      "Adobe",
      "Oracle",
    ];

    return companies.map((company, index) => ({
      id: index + 1,
      name: company,
      description: `${company} - Leading technology company`,
      industry: "Technology",
      founded: 1970 + Math.floor(Math.random() * 50),
      employees: Math.floor(Math.random() * 100000) + 1000,
      tags: ["technology", "innovation", company.toLowerCase()],
    }));
  }

  private defaultTransform(apiData: Record<string, unknown>): AutocompleteItem {
    return {
      id: `api-${String(apiData.id)}`,
      title: String(apiData.name),
      description: String(apiData.description),
      category: String(apiData.industry || "General"),
      tags: Array.isArray(apiData.tags) ? (apiData.tags as string[]) : [],
      metadata: {
        source: "api",
        founded: apiData.founded,
        employees: apiData.employees,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  validate(item: AutocompleteItem): boolean {
    return !!(item.id && item.title && item.category);
  }

  async sync(): Promise<void> {
    console.warn(`🔄 Syncing data from API: ${this.apiUrl}`);
    // In a real implementation, this would check for updates
    // and only fetch changed data
  }
}

export class DatabaseDataSource implements DataSourceProvider {
  private connectionString: string;
  private tableName: string;
  private query?: string;

  constructor(connectionString: string, tableName: string, query?: string) {
    this.connectionString = connectionString;
    this.tableName = tableName;
    this.query = query;
  }

  async load(): Promise<AutocompleteItem[]> {
    console.warn(`🗄️ Loading data from database table: ${this.tableName}`);

    try {
      // Simulate database query - in real implementation, use your DB client
      const simulatedDbData = this.generateDatabaseData();

      console.warn(`✅ Loaded ${simulatedDbData.length} items from database`);
      return simulatedDbData;
    } catch (error) {
      console.error(`❌ Failed to load data from database: ${this.tableName}`, error);
      throw new Error(`Database data source error: ${error}`);
    }
  }

  private generateDatabaseData(): AutocompleteItem[] {
    // Simulate database records
    const products = [
      "iPhone 15 Pro",
      "MacBook Pro",
      "iPad Air",
      "Apple Watch",
      "AirPods Pro",
      "Samsung Galaxy S24",
      "Google Pixel 8",
      "OnePlus 12",
      "Sony WH-1000XM5",
      "Dell XPS 13",
      "ThinkPad X1 Carbon",
      "Surface Pro 9",
      "Nintendo Switch",
      "PlayStation 5",
      "Xbox Series X",
      "Steam Deck",
      "Meta Quest 3",
    ];

    return products.map((product, index) => ({
      id: `db-${index + 1}`,
      title: product,
      description: `${product} - Premium consumer electronics`,
      category: this.categorizeProduct(product),
      tags: this.generateProductTags(product),
      metadata: {
        source: "database",
        price: Math.floor(Math.random() * 2000) + 100,
        rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 - 5.0
        inStock: Math.random() > 0.2, // 80% chance in stock
      },
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    }));
  }

  private categorizeProduct(product: string): string {
    if (product.includes("iPhone") || product.includes("Galaxy") || product.includes("Pixel")) {
      return "Smartphones";
    }
    if (
      product.includes("MacBook") ||
      product.includes("XPS") ||
      product.includes("ThinkPad") ||
      product.includes("Surface")
    ) {
      return "Laptops";
    }
    if (product.includes("iPad")) {
      return "Tablets";
    }
    if (product.includes("Watch")) {
      return "Wearables";
    }
    if (product.includes("AirPods") || product.includes("WH-")) {
      return "Audio";
    }
    if (
      product.includes("PlayStation") ||
      product.includes("Xbox") ||
      product.includes("Switch") ||
      product.includes("Steam")
    ) {
      return "Gaming";
    }
    return "Electronics";
  }

  private generateProductTags(product: string): string[] {
    const baseTags = ["electronics", "consumer"];
    const brand = product.split(" ")[0].toLowerCase();
    baseTags.push(brand);

    if (product.includes("Pro")) baseTags.push("professional");
    if (product.includes("Air")) baseTags.push("lightweight");
    if (product.includes("Gaming") || product.includes("PlayStation") || product.includes("Xbox")) {
      baseTags.push("gaming");
    }

    return baseTags;
  }

  validate(item: AutocompleteItem): boolean {
    return !!(item.id && item.title && item.category);
  }

  async sync(): Promise<void> {
    console.warn(`🔄 Syncing data from database table: ${this.tableName}`);
    // In a real implementation, this would check for database changes
    // using timestamps, change logs, or triggers
  }
}

/**
 * Data Source Manager - Orchestrates multiple data sources
 */
export class DataSourceManager {
  private sources: Map<string, DataSourceProvider> = new Map();
  private lastSync: Map<string, Date> = new Map();

  addSource(id: string, source: DataSourceProvider): void {
    console.warn(`➕ Adding data source: ${id}`);
    this.sources.set(id, source);
  }

  removeSource(id: string): void {
    console.warn(`➖ Removing data source: ${id}`);
    this.sources.delete(id);
    this.lastSync.delete(id);
  }

  async loadAll(): Promise<AutocompleteItem[]> {
    console.warn(`🔄 Loading data from ${this.sources.size} sources`);
    const startTime = Date.now();

    const allItems: AutocompleteItem[] = [];
    const loadPromises: Promise<AutocompleteItem[]>[] = [];

    // Load from all sources concurrently
    for (const [id, source] of this.sources) {
      const promise = source.load().catch((error) => {
        console.error(`❌ Failed to load from source ${id}:`, error);
        return []; // Return empty array on error to not break other sources
      });
      loadPromises.push(promise);
    }

    const results = await Promise.all(loadPromises);

    // Combine all results
    for (const items of results) {
      allItems.push(...items);
    }

    // Remove duplicates based on ID
    const uniqueItems = this.deduplicateItems(allItems);

    const loadTime = Date.now() - startTime;
    console.warn(`✅ Loaded ${uniqueItems.length} unique items from all sources in ${loadTime}ms`);

    return uniqueItems;
  }

  async syncAll(): Promise<void> {
    console.warn(`🔄 Syncing all data sources`);

    const syncPromises: Promise<void>[] = [];

    for (const [id, source] of this.sources) {
      if (source.sync) {
        const promise = source.sync().catch((error) => {
          console.error(`❌ Failed to sync source ${id}:`, error);
        });
        syncPromises.push(promise);
      }
    }

    await Promise.all(syncPromises);
    console.warn(`✅ All data sources synced`);
  }

  private deduplicateItems(items: AutocompleteItem[]): AutocompleteItem[] {
    const seen = new Set<string>();
    const unique: AutocompleteItem[] = [];

    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      } else {
        console.warn(`⚠️ Duplicate item ID found: ${item.id}`);
      }
    }

    return unique;
  }

  getSourceStats(): Array<{ id: string; lastSync?: Date; itemCount: number }> {
    const stats: Array<{ id: string; lastSync?: Date; itemCount: number }> = [];

    for (const [id] of this.sources) {
      stats.push({
        id,
        lastSync: this.lastSync.get(id),
        itemCount: 0, // Would be populated from actual data in real implementation
      });
    }

    return stats;
  }
}

/**
 * Factory function to create data sources based on configuration
 */
export function createDataSource(config: DataSource): DataSourceProvider {
  const sourceType = config.type;
  switch (sourceType) {
    case "static":
      return new StaticDataSource(config.config.data ?? []);

    case "file":
      return new FileDataSource(config.config.filePath, config.config.format ?? "json");

    case "api":
      return new ApiDataSource(
        config.config.url,
        config.config.headers ?? {},
        config.config.transform
      );

    case "database":
      return new DatabaseDataSource(
        config.config.connectionString,
        config.config.tableName,
        config.config.query
      );

    default: {
      const _exhaustive: never = sourceType;
      throw new Error(`Unknown data source type: ${String(_exhaustive)}`);
    }
  }
}
