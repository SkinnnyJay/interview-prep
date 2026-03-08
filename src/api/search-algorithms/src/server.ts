/**
 * Search Algorithms Demo Server
 *
 * This server provides a comprehensive demonstration of various search algorithms
 * implemented from scratch without external libraries. It showcases different
 * approaches to text search and their use cases.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import { SearchEngine } from "./search-engine";
import { PhoneticMatcher } from "./algorithms/phonetic-matching";
import { NGramMatcher } from "./algorithms/ngram-matching";
import { SearchableItem, SearchRequest, SearchAlgorithm } from "./types";
import { HttpStatus } from "./constants";
import { z } from "zod";

const server: FastifyInstance = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

server.register(swagger, {
  openapi: {
    info: { title: "Search Algorithms API", description: "Search algorithm demos", version: "1.0.0" },
    servers: [{ url: "http://localhost:3005", description: "Development" }],
  },
});

// Global search engine instance
let searchEngine: SearchEngine;

// ----- Zod schemas for request validation -----
const searchAlgorithmEnum = z.enum([
  "exact", "prefix", "suffix", "contains", "fuzzy", "phonetic", "regex",
  "wildcard", "ngram", "bm25", "tfidf", "semantic", "compound",
]);

const searchBodySchema = z.object({
  query: z.string().min(1),
  algorithm: searchAlgorithmEnum.optional().default("fuzzy"),
  options: z.object({
    fields: z.array(z.string()).optional(),
    caseSensitive: z.boolean().optional(),
    wholeWords: z.boolean().optional(),
    maxResults: z.number().int().min(1).max(100).optional(),
    minScore: z.number().min(0).max(1).optional(),
    highlightMatches: z.boolean().optional(),
    fuzzyThreshold: z.number().min(0).max(1).optional(),
    phoneticThreshold: z.number().min(0).max(1).optional(),
  }).optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(["equals", "contains", "startsWith", "endsWith", "in"]),
    value: z.unknown(),
  })).optional(),
});

const compareBodySchema = z.object({
  query: z.string().min(1),
  algorithms: z.array(searchAlgorithmEnum).min(2).max(5),
  options: z.record(z.unknown()).optional(),
});

const demoAlgorithmParamsSchema = z.object({
  algorithm: searchAlgorithmEnum,
});

// Sample data for demonstration
const sampleData: SearchableItem[] = [
  {
    id: "1",
    title: "JavaScript Programming Guide",
    description: "A comprehensive guide to JavaScript programming for beginners and experts",
    content:
      "JavaScript is a versatile programming language used for web development, server-side programming, and more. It supports object-oriented, functional, and procedural programming paradigms.",
    tags: ["javascript", "programming", "web", "tutorial"],
    category: "Programming",
    metadata: { views: 1500, likes: 89, difficulty: "intermediate" },
  },
  {
    id: "2",
    title: "TypeScript Best Practices",
    description: "Learn TypeScript best practices and advanced patterns",
    content:
      "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It adds static type definitions to JavaScript, making it more robust and maintainable.",
    tags: ["typescript", "javascript", "types", "best-practices"],
    category: "Programming",
    metadata: { views: 2100, likes: 156, difficulty: "advanced" },
  },
  {
    id: "3",
    title: "React Component Patterns",
    description: "Modern React patterns and component design strategies",
    content:
      "React is a JavaScript library for building user interfaces. Learn about hooks, context, higher-order components, and render props patterns.",
    tags: ["react", "javascript", "components", "patterns"],
    category: "Frontend",
    metadata: { views: 3200, likes: 245, difficulty: "intermediate" },
  },
  {
    id: "4",
    title: "Node.js Server Development",
    description: "Building scalable server applications with Node.js",
    content:
      "Node.js is a JavaScript runtime built on Chrome V8 JavaScript engine. Perfect for building fast, scalable network applications.",
    tags: ["nodejs", "server", "backend", "javascript"],
    category: "Backend",
    metadata: { views: 1800, likes: 134, difficulty: "intermediate" },
  },
  {
    id: "5",
    title: "Python Data Science",
    description: "Data analysis and machine learning with Python",
    content:
      "Python is excellent for data science with libraries like pandas, numpy, and scikit-learn. Learn data manipulation, visualization, and machine learning.",
    tags: ["python", "data-science", "machine-learning", "analytics"],
    category: "Data Science",
    metadata: { views: 2800, likes: 198, difficulty: "advanced" },
  },
  {
    id: "6",
    title: "Database Design Principles",
    description: "Fundamental principles of database design and normalization",
    content:
      "Learn about relational database design, normalization, indexing, and query optimization. Covers SQL and NoSQL databases.",
    tags: ["database", "sql", "design", "normalization"],
    category: "Database",
    metadata: { views: 1200, likes: 78, difficulty: "intermediate" },
  },
  {
    id: "7",
    title: "Machine Learning Algorithms",
    description: "Understanding core machine learning algorithms and their applications",
    content:
      "Explore supervised and unsupervised learning algorithms including linear regression, decision trees, clustering, and neural networks.",
    tags: ["machine-learning", "algorithms", "ai", "data-science"],
    category: "AI/ML",
    metadata: { views: 4100, likes: 312, difficulty: "advanced" },
  },
  {
    id: "8",
    title: "Web Security Fundamentals",
    description: "Essential web security concepts and best practices",
    content:
      "Learn about common web vulnerabilities like XSS, CSRF, SQL injection, and how to prevent them. Covers authentication and authorization.",
    tags: ["security", "web", "authentication", "vulnerabilities"],
    category: "Security",
    metadata: { views: 1600, likes: 145, difficulty: "intermediate" },
  },
];

/**
 * Register CORS
 */
server.register(cors, {
  origin: true,
  credentials: true,
});

/**
 * Initialize search engine
 */
function initializeSearchEngine(serverInstance: FastifyInstance): void {
  searchEngine = new SearchEngine(sampleData);
  serverInstance.log.info("Search engine initialized with sample data");
}

/**
 * Root endpoint - API overview
 */
server.get("/", async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    service: "Search Algorithms Demo",
    version: "1.0.0",
    description: "Comprehensive demonstration of search algorithms implemented from scratch",
    algorithms: [
      "exact",
      "prefix",
      "suffix",
      "contains",
      "fuzzy",
      "phonetic",
      "regex",
      "wildcard",
      "ngram",
      "bm25",
      "tfidf",
      "semantic",
      "compound",
    ],
    endpoints: {
      "GET /": "API overview",
      "GET /health": "Health check",
      "POST /search": "Main search endpoint",
      "GET /algorithms": "List all available algorithms",
      "POST /compare": "Compare multiple algorithms",
      "GET /demo/:algorithm": "Demo specific algorithm",
      "GET /metrics": "Search metrics and analytics",
      "GET /data": "View sample data",
    },
    examples: {
      "Basic Search": 'POST /search { "query": "javascript", "algorithm": "fuzzy" }',
      "Advanced Search":
        'POST /search { "query": "java*", "algorithm": "wildcard", "options": { "fields": ["title"], "highlightMatches": true } }',
      "Compare Algorithms":
        'POST /compare { "query": "javascript", "algorithms": ["exact", "fuzzy", "phonetic"] }',
    },
  };
});

/**
 * Health check
 */
server.get("/health", async (_request: FastifyRequest, _reply: FastifyReply) => {
  const metrics = searchEngine?.getMetrics();

  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    searchEngine: {
      initialized: !!searchEngine,
      indexSize: metrics?.indexSize || 0,
      totalSearches: metrics?.totalSearches || 0,
    },
  };
});

/**
 * Main search endpoint
 */
server.post(
  "/search",
  async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = searchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        success: false,
        error: "Validation failed",
        details: parsed.error.errors,
      });
    }
    const { query, algorithm, options = {}, filters = [] } = parsed.data;

    try {
      const searchRequest: SearchRequest = {
        query,
        options: {
          algorithm: algorithm as SearchAlgorithm,
          fields: options.fields ?? ["title", "description", "content"],
          caseSensitive: options.caseSensitive ?? false,
          wholeWords: options.wholeWords ?? false,
          maxResults: options.maxResults ?? 10,
          minScore: options.minScore,
          highlightMatches: options.highlightMatches !== false,
          fuzzyThreshold: options.fuzzyThreshold ?? 0.7,
          phoneticThreshold: options.phoneticThreshold ?? 0.8,
        },
        filters: filters as SearchRequest["filters"],
      };

      const result = await searchEngine.search(searchRequest);

      return {
        success: true,
        ...result,
        meta: {
          timestamp: new Date().toISOString(),
          algorithm,
          totalItems: searchEngine.getMetrics().indexSize,
        },
      };
    } catch (error) {
      server.log.error(`Search failed: ${(error as Error).message}`);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: "Search operation failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * List all available algorithms
 */
server.get("/algorithms", async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    algorithms: [
      {
        name: "exact",
        description: "Exact string matching - perfect for precise searches",
        useCase: "User IDs, codes, exact product names",
        complexity: "O(n)",
        example: 'Search for "JavaScript" finds only exact matches',
      },
      {
        name: "prefix",
        description: "Matches strings that start with the query",
        useCase: "Autocomplete, command completion, name lookups",
        complexity: "O(m)",
        example: 'Search for "Java" finds "JavaScript", "Java Programming"',
      },
      {
        name: "suffix",
        description: "Matches strings that end with the query",
        useCase: "File extensions, domain matching",
        complexity: "O(m)",
        example: 'Search for ".js" finds "script.js", "app.js"',
      },
      {
        name: "contains",
        description: "Substring search - finds query anywhere in text",
        useCase: "General search boxes, content search",
        complexity: "O(n*m)",
        example: 'Search for "Script" finds "JavaScript", "TypeScript"',
      },
      {
        name: "fuzzy",
        description: "Handles typos using Levenshtein distance",
        useCase: "User input with potential spelling errors",
        complexity: "O(n*m)",
        example: 'Search for "Javscript" finds "JavaScript"',
      },
      {
        name: "phonetic",
        description: "Matches words that sound similar (Soundex, Metaphone)",
        useCase: "Name matching, genealogy, customer databases",
        complexity: "O(n)",
        example: 'Search for "Smith" finds "Smyth", "Smythe"',
      },
      {
        name: "regex",
        description: "Regular expression pattern matching",
        useCase: "Complex pattern matching, validation",
        complexity: "Varies",
        example: 'Search for "Java.*" finds "JavaScript", "Java Programming"',
      },
      {
        name: "wildcard",
        description: "Pattern matching with * and ? wildcards",
        useCase: "File path matching, flexible search patterns",
        complexity: "O(n*m)",
        example: 'Search for "Java*" finds "JavaScript", "Java Programming"',
      },
      {
        name: "ngram",
        description: "N-gram based similarity matching",
        useCase: "Fuzzy matching, similarity detection",
        complexity: "O(n+m)",
        example: 'Search for "JavaScript" finds similar character patterns',
      },
      {
        name: "bm25",
        description: "BM25 ranking algorithm for relevance scoring",
        useCase: "Modern search engines, document ranking",
        complexity: "O(n*m)",
        example: "Ranks documents by relevance to query terms",
      },
      {
        name: "tfidf",
        description: "TF-IDF scoring for document relevance",
        useCase: "Information retrieval, keyword extraction",
        complexity: "O(n*m)",
        example: "Balances term frequency with document rarity",
      },
      {
        name: "semantic",
        description: "Cosine similarity for semantic matching",
        useCase: "Document similarity, clustering",
        complexity: "O(n*m)",
        example: "Finds documents with similar meaning",
      },
      {
        name: "compound",
        description: "Combines multiple algorithms for best results",
        useCase: "Comprehensive search with multiple strategies",
        complexity: "O(multiple)",
        example: "Uses exact, fuzzy, and BM25 together",
      },
    ],
  };
});

/**
 * Compare multiple algorithms
 */
server.post(
  "/compare",
  async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = compareBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        success: false,
        error: "Validation failed",
        details: parsed.error.errors,
      });
    }
    const { query, algorithms, options = {} } = parsed.data;

    try {
      const results: Array<{
        algorithm: string;
        resultCount: number;
        executionTime: number;
        topResults: Array<{ id: string; title: string; score: number }>;
      }> = [];

      for (const algorithm of algorithms) {
        const searchRequest: SearchRequest = {
          query,
          options: {
            algorithm: algorithm as SearchAlgorithm,
            fields: (options.fields as string[]) || ["title", "description", "content"],
            caseSensitive: (options.caseSensitive as boolean) ?? false,
            maxResults: (options.maxResults as number) ?? 5,
            highlightMatches: false,
          },
        };

        const result = await searchEngine.search(searchRequest);

        results.push({
          algorithm,
          resultCount: result.results.length,
          executionTime: result.executionTime,
          topResults: result.results.slice(0, 3).map((r) => ({
            id: r.item.id,
            title: r.item.title,
            score: r.score,
          })),
        });
      }

      return {
        success: true,
        query,
        comparison: results,
        summary: {
          fastest: results.reduce((min, r) => (r.executionTime < min.executionTime ? r : min)),
          mostResults: results.reduce((max, r) => (r.resultCount > max.resultCount ? r : max)),
          totalExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0),
        },
      };
    } catch (error) {
      server.log.error(`Comparison failed: ${(error as Error).message}`);
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: "Comparison operation failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Demo specific algorithm with examples
 */
server.get("/demo/:algorithm", async (request: FastifyRequest, reply: FastifyReply) => {
  const paramsParsed = demoAlgorithmParamsSchema.safeParse(request.params);
  const queryParsed = z.object({ q: z.string().optional() }).safeParse(request.query);
  const query = queryParsed.success && queryParsed.data.q ? queryParsed.data.q : "javascript";

  if (!paramsParsed.success) {
    return reply.code(HttpStatus.BAD_REQUEST).send({
      error: "Invalid algorithm",
      validAlgorithms: [
        "exact", "prefix", "suffix", "contains", "fuzzy", "phonetic", "regex",
        "wildcard", "ngram", "bm25", "tfidf", "semantic", "compound",
      ],
    });
  }
  const { algorithm } = paramsParsed.data;

  try {
    const searchRequest: SearchRequest = {
      query,
      options: {
        algorithm: algorithm as SearchAlgorithm,
        fields: ["title", "description", "content"],
        highlightMatches: true,
        maxResults: 10,
      },
    };

    const result = await searchEngine.search(searchRequest);

    const algorithmInfo = await getAlgorithmDemo(algorithm, query);

    return {
      success: true,
      algorithm,
      query,
      ...algorithmInfo,
      searchResults: result,
      explanation: getAlgorithmExplanation(algorithm),
      examples: getAlgorithmExamples(algorithm),
    };
  } catch (error) {
    server.log.error(`Demo for ${algorithm} failed: ${(error as Error).message}`);
    return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      success: false,
      error: `Demo for ${algorithm} failed`,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get search metrics and analytics
 */
server.get("/metrics", async (_request: FastifyRequest, _reply: FastifyReply) => {
  const metrics = searchEngine.getMetrics();
  const recentAnalytics = searchEngine.getAnalytics(50);

  return {
    metrics,
    recentSearches: recentAnalytics.slice(-10),
    algorithmPerformance: Object.entries(metrics.algorithmUsage).map(([algorithm, count]) => ({
      algorithm,
      count,
      percentage: (count / metrics.totalSearches) * 100,
    })),
    popularQueries: metrics.popularQueries.slice(0, 10),
  };
});

/**
 * View sample data
 */
server.get("/data", async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    totalItems: sampleData.length,
    categories: [...new Set(sampleData.map((item) => item.category))],
    tags: [...new Set(sampleData.flatMap((item) => item.tags || []))],
    items: sampleData.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      tags: item.tags,
    })),
  };
});

/**
 * Helper functions
 */

async function getAlgorithmDemo(
  algorithm: string,
  query: string
): Promise<Record<string, unknown>> {
  switch (algorithm) {
    case "fuzzy":
      return {
        demo: {
          originalQuery: query,
          typoExamples: [query + "x", query.slice(0, -1), query.replace("a", "e")],
          explanation: "Fuzzy search handles typos and approximate matches using edit distance",
        },
      };
    case "phonetic":
      return {
        demo: {
          soundexCode: PhoneticMatcher.soundex(query),
          metaphoneCode: PhoneticMatcher.metaphone(query),
          explanation: "Phonetic search finds words that sound similar even if spelled differently",
        },
      };
    case "ngram":
      return {
        demo: {
          bigrams: NGramMatcher.generateCharacterNGrams(query, 2),
          trigrams: NGramMatcher.generateCharacterNGrams(query, 3),
          explanation: "N-gram search breaks text into character sequences for fuzzy matching",
        },
      };
    default:
      return { demo: { explanation: `${algorithm} search demonstration` } };
  }
}

function getAlgorithmExplanation(algorithm: string): string {
  const explanations: Record<string, string> = {
    exact: "Finds only perfect matches of the search query. Case-sensitive option available.",
    prefix: "Matches items that start with the search query. Great for autocomplete functionality.",
    suffix: "Matches items that end with the search query. Useful for file extension searches.",
    contains:
      "Finds items containing the search query anywhere in the text. Most common search type.",
    fuzzy: "Handles typos and approximate matches using Levenshtein distance algorithm.",
    phonetic:
      "Matches words that sound similar using phonetic algorithms like Soundex and Metaphone.",
    regex:
      "Uses regular expressions for complex pattern matching. Very flexible but requires regex knowledge.",
    wildcard: "Simple pattern matching with * (any characters) and ? (single character) wildcards.",
    ngram:
      "Uses character n-grams for similarity matching. Good for fuzzy search and typo tolerance.",
    bm25: "Modern ranking algorithm that improves on TF-IDF. Used by many search engines.",
    tfidf: "Classic information retrieval algorithm balancing term frequency with document rarity.",
    semantic: "Uses cosine similarity to find semantically similar content based on word vectors.",
    compound: "Combines multiple algorithms to provide the best possible search results.",
  };

  return explanations[algorithm] || "Algorithm explanation not available.";
}

function getAlgorithmExamples(algorithm: string): string[] {
  const examples: Record<string, string[]> = {
    exact: ['Search "JavaScript" → finds only "JavaScript"', 'Search "React" → finds only "React"'],
    prefix: [
      'Search "Java" → finds "JavaScript", "Java Programming"',
      'Search "Type" → finds "TypeScript"',
    ],
    suffix: [
      'Search "Script" → finds "JavaScript", "TypeScript"',
      'Search ".js" → finds files ending in .js',
    ],
    contains: [
      'Search "Script" → finds "JavaScript", "TypeScript", "Scripting"',
      'Search "data" → finds "Database", "Data Science"',
    ],
    fuzzy: ['Search "Javscript" → finds "JavaScript"', 'Search "Reactt" → finds "React"'],
    phonetic: ['Search "Smith" → finds "Smyth", "Smythe"', 'Search "Johnson" → finds "Jonson"'],
    regex: [
      'Search "Java.*" → finds "JavaScript", "Java Programming"',
      'Search "\\d+" → finds items with numbers',
    ],
    wildcard: [
      'Search "Java*" → finds "JavaScript", "Java Programming"',
      'Search "Type?" → finds "Types", "Typed"',
    ],
    ngram: [
      'Search "JavaScript" → finds similar character patterns',
      "Search with typos → finds close matches",
    ],
    bm25: ["Ranks results by relevance score", "Considers term frequency and document length"],
    tfidf: ["Balances common vs rare terms", "Higher scores for unique terms"],
    semantic: ["Finds conceptually similar content", "Uses vector space similarity"],
    compound: ["Combines exact + fuzzy + BM25", "Best overall search experience"],
  };

  return examples[algorithm] || ["No examples available for this algorithm."];
}

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (): Promise<void> => {
  server.log.info("Shutting down gracefully...");

  try {
    await server.close();
    process.exit(0);
  } catch (error) {
    server.log.error(`Error during shutdown: ${(error as Error).message}`);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

/**
 * Start the server
 */
const start = async (): Promise<void> => {
  try {
    initializeSearchEngine(server);

    const port = process.env.PORT ? parseInt(process.env.PORT) : 3005;
    const host = process.env.HOST || "0.0.0.0";

    await server.listen({ port, host });

    server.log.info(`🚀 Search Algorithms Demo server running on http://${host}:${port}`);
    server.log.info(`📚 API Documentation: http://localhost:${port}`);
    server.log.info("🔍 Try different search algorithms:");
    server.log.info("  • POST /search - Main search endpoint");
    server.log.info("  • POST /compare - Compare multiple algorithms");
    server.log.info("  • GET /demo/fuzzy?q=javascript - Demo specific algorithm");
    server.log.info("  • GET /algorithms - List all available algorithms");
  } catch (error) {
    server.log.error(`Failed to start server: ${(error as Error).message}`);
    process.exit(1);
  }
};

/** Create and configure the Fastify app (no listen). Used for OpenAPI generation. */
export async function createApp(): Promise<FastifyInstance> {
  initializeSearchEngine(server);
  return server;
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void start();
}

export default server;
