/**
 * Practical Examples of Concurrency vs Parallelism
 *
 * This file demonstrates real-world scenarios where you'd choose
 * concurrency vs parallelism, with detailed explanations of when and why.
 */

import { ConcurrencyManager } from "./concurrency-manager";
import { ParallelManager } from "./parallel-manager";
import { HttpStatus } from "./constants";

export class ConcurrencyExamples {
  private concurrencyManager: ConcurrencyManager;
  private parallelManager: ParallelManager;

  constructor() {
    this.concurrencyManager = new ConcurrencyManager({ maxConcurrent: 5 });
    this.parallelManager = new ParallelManager({ workerCount: 4 });
  }

  /**
   * Example 1: API Calls (Perfect for Concurrency)
   *
   * Why Concurrency: I/O-bound operations benefit from concurrent execution
   * because threads can work on other tasks while waiting for network responses.
   * Parallelism wouldn't help here since we're waiting, not computing.
   */
  async demonstrateApiCalls(): Promise<void> {
    console.warn("\n🌐 === API CALLS EXAMPLE (Concurrency) ===");

    // Simulate API endpoints to call
    const apiEndpoints = [
      { url: "https://api.github.com/users/octocat", delay: 1000 },
      { url: "https://jsonplaceholder.typicode.com/posts/1", delay: 800 },
      { url: "https://httpbin.org/delay/1", delay: 1200 },
      { url: "https://api.github.com/repos/microsoft/typescript", delay: 900 },
      { url: "https://jsonplaceholder.typicode.com/users/1", delay: 700 },
    ];

    // Simulate API call function
    const makeApiCall = async (endpoint: {
      url: string;
      delay: number;
    }): Promise<{
      url: string;
      status: number;
      data: { message: string; timestamp: number };
      responseTime: number;
    }> => {
      console.warn(`📡 Making API call to ${endpoint.url}`);

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, endpoint.delay));

      // Simulate API response
      return {
        url: endpoint.url,
        status: HttpStatus.OK,
        data: { message: "Success", timestamp: Date.now() },
        responseTime: endpoint.delay,
      };
    };

    console.warn("🚀 Starting concurrent API calls...");
    const startTime = Date.now();

    // All API calls start simultaneously - this is concurrency in action
    await this.concurrencyManager.executeAllConcurrent(apiEndpoints, makeApiCall);

    const totalTime = Date.now() - startTime;
    console.warn(`✅ All API calls completed in ${totalTime}ms`);
    console.warn(
      `📊 Without concurrency, this would take ${apiEndpoints.reduce((sum, ep) => sum + ep.delay, 0)}ms`
    );

    const metrics = this.concurrencyManager.getPerformanceMetrics();
    console.warn("📈 Performance Metrics:", metrics);

    this.concurrencyManager.reset();
  }

  /**
   * Example 2: Mathematical Computations (Perfect for Parallelism)
   *
   * Why Parallelism: CPU-intensive calculations can utilize multiple cores
   * simultaneously. Each worker thread can compute independently on different cores.
   */
  async demonstrateMathComputations(): Promise<void> {
    console.warn("\n🧮 === MATHEMATICAL COMPUTATIONS EXAMPLE (Parallelism) ===");

    // Initialize workers for parallel processing
    // Worker script path is ignored when using inline worker; still pass a placeholder
    await this.parallelManager.initializeWorkers("inline");

    // CPU-intensive mathematical tasks
    const mathTasks = [
      { type: "fibonacci", data: { n: 35 } },
      { type: "prime-check", data: { number: 982451653 } },
      { type: "compute", data: { iterations: 5000000 } },
      { type: "fibonacci", data: { n: 40 } },
      { type: "prime-check", data: { number: 982451654 } },
      { type: "compute", data: { iterations: 3000000 } },
    ];

    console.warn("⚡ Starting parallel mathematical computations...");
    const startTime = Date.now();

    // Tasks are distributed across worker threads for true parallel execution
    const results = await Promise.all(
      mathTasks.map((task) => this.parallelManager.executeParallel([task], task.type))
    );

    const totalTime = Date.now() - startTime;
    console.warn(`✅ All computations completed in ${totalTime}ms`);
    console.warn("🎯 Results:", results.flat());

    const metrics = this.parallelManager.getPerformanceMetrics();
    console.warn("📈 Performance Metrics:", metrics);

    await this.parallelManager.cleanup();
  }

  /**
   * Example 3: Database Operations (Concurrency with Rate Limiting)
   *
   * Why Limited Concurrency: Database connections are limited resources.
   * Too many concurrent connections can overwhelm the database.
   */
  async demonstrateDatabaseOperations(): Promise<void> {
    console.warn("\n🗄️ === DATABASE OPERATIONS EXAMPLE (Limited Concurrency) ===");

    // Simulate database queries
    const dbQueries = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      query: `SELECT * FROM users WHERE id = ${i + 1}`,
      complexity: Math.random() * 1000 + 500, // 500-1500ms
    }));

    // Simulate database query execution
    const executeQuery = async (query: {
      id: number;
      query: string;
      complexity: number;
    }): Promise<{
      queryId: number;
      result: { userId: number; name: string; email: string };
      executionTime: number;
    }> => {
      console.warn(`🔍 Executing query: ${query.query}`);

      // Simulate database processing time
      await new Promise((resolve) => setTimeout(resolve, query.complexity));

      return {
        queryId: query.id,
        result: {
          userId: query.id,
          name: `User ${query.id}`,
          email: `user${query.id}@example.com`,
        },
        executionTime: query.complexity,
      };
    };

    console.warn("🎯 Starting limited concurrent database queries (max 3 concurrent)...");

    // Use limited concurrency to avoid overwhelming the database
    this.concurrencyManager = new ConcurrencyManager({ maxConcurrent: 3 });

    const startTime = Date.now();
    const results = await this.concurrencyManager.executeLimitedConcurrent(dbQueries, executeQuery);

    const totalTime = Date.now() - startTime;
    console.warn(`✅ All database queries completed in ${totalTime}ms`);
    console.warn(`📊 Processed ${results.length} queries with controlled concurrency`);

    const metrics = this.concurrencyManager.getPerformanceMetrics();
    console.warn("📈 Performance Metrics:", metrics);

    this.concurrencyManager.reset();
  }

  /**
   * Example 4: File Processing (Hybrid Approach)
   *
   * Why Hybrid: File I/O is concurrent, but processing file contents
   * (parsing, transformation) can benefit from parallelism.
   */
  async demonstrateFileProcessing(): Promise<void> {
    console.warn("\n📁 === FILE PROCESSING EXAMPLE (Hybrid Approach) ===");

    // Simulate file processing tasks
    const files = Array.from({ length: 12 }, (_, i) => ({
      filename: `data-${i + 1}.json`,
      size: Math.floor(Math.random() * 10000) + 1000,
      content: Array.from({ length: 100 }, (_, j) => ({ id: j, value: Math.random() * 1000 })),
    }));

    // Step 1: Concurrent file reading (I/O bound)
    console.warn("📖 Step 1: Reading files concurrently...");
    const readFile = async (file: {
      filename: string;
      size: number;
      content: unknown[];
    }): Promise<{ filename: string; content: unknown[]; size: number }> => {
      console.warn(`📄 Reading file: ${file.filename}`);

      // Simulate file I/O delay
      await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

      return {
        filename: file.filename,
        content: file.content,
        size: file.size,
      };
    };

    const readStartTime = Date.now();
    const fileContents = await this.concurrencyManager.executeAllConcurrent(files, readFile);
    const readTime = Date.now() - readStartTime;
    console.warn(`✅ File reading completed in ${readTime}ms`);

    // Step 2: Parallel content processing (CPU bound)
    console.warn("⚙️ Step 2: Processing file contents in parallel...");

    await this.parallelManager.initializeWorkers("./worker.js");

    const processStartTime = Date.now();
    await this.parallelManager.executeParallel(
      fileContents.map((file) => file.content),
      "batch-compute"
    );
    const processTime = Date.now() - processStartTime;

    console.warn(`✅ File processing completed in ${processTime}ms`);
    console.warn(`📊 Total hybrid processing time: ${readTime + processTime}ms`);

    await this.parallelManager.cleanup();
    this.concurrencyManager.reset();
  }

  /**
   * Example 5: Priority Task Queue
   *
   * Why Priority Queue: Some tasks are more important than others.
   * Critical tasks should be processed first.
   */
  async demonstratePriorityQueue(): Promise<void> {
    console.warn("\n🏆 === PRIORITY QUEUE EXAMPLE ===");

    // Tasks with different priorities
    const priorityTasks = [
      { id: "low-1", name: "Background cleanup", priority: 1, duration: 2000 },
      { id: "high-1", name: "User authentication", priority: 10, duration: 500 },
      { id: "medium-1", name: "Data sync", priority: 5, duration: 1000 },
      { id: "critical-1", name: "Security alert", priority: 20, duration: 300 },
      { id: "low-2", name: "Log rotation", priority: 1, duration: 1500 },
      { id: "high-2", name: "API request", priority: 10, duration: 800 },
      { id: "critical-2", name: "System health check", priority: 20, duration: 400 },
    ];

    const processTask = async (task: {
      id: string;
      name: string;
      priority: number;
      duration: number;
    }): Promise<{
      taskId: string;
      name: string;
      priority: number;
      completed: boolean;
      completedAt: number;
    }> => {
      console.warn(
        `🎯 Processing ${task.priority === 20 ? "CRITICAL" : task.priority >= 10 ? "HIGH" : task.priority >= 5 ? "MEDIUM" : "LOW"} priority task: ${task.name}`
      );

      await new Promise((resolve) => setTimeout(resolve, task.duration));

      return {
        taskId: task.id,
        name: task.name,
        priority: task.priority,
        completed: true,
        completedAt: Date.now(),
      };
    };

    console.warn("🚀 Starting priority queue processing...");
    const startTime = Date.now();

    const results = await this.concurrencyManager.executePriorityQueue(priorityTasks, processTask);

    const totalTime = Date.now() - startTime;
    console.warn(`✅ Priority queue processing completed in ${totalTime}ms`);
    console.warn("📋 Processing order (by priority):");

    // Show the order tasks were likely processed in
    results.forEach((result, index) => {
      const task = priorityTasks.find((t) => t.id === result.taskId);
      console.warn(`  ${index + 1}. ${result.name} (Priority: ${task?.priority})`);
    });

    this.concurrencyManager.reset();
  }

  /**
   * Run all examples
   */
  async runAllExamples(): Promise<void> {
    console.warn("🎬 Starting Concurrency vs Parallelism Examples");
    console.warn("=".repeat(60));

    try {
      await this.demonstrateApiCalls();
      await this.demonstrateMathComputations();
      await this.demonstrateDatabaseOperations();
      await this.demonstrateFileProcessing();
      await this.demonstratePriorityQueue();

      console.warn("\n🎉 All examples completed successfully!");
      console.warn("\n📚 Key Takeaways:");
      console.warn(
        "• Use CONCURRENCY for I/O-bound tasks (API calls, database queries, file operations)"
      );
      console.warn(
        "• Use PARALLELISM for CPU-bound tasks (mathematical computations, data processing)"
      );
      console.warn("• Use LIMITED CONCURRENCY to avoid overwhelming external resources");
      console.warn("• Use PRIORITY QUEUES when tasks have different importance levels");
      console.warn("• Use HYBRID APPROACHES for complex workflows with both I/O and CPU work");
    } catch (error) {
      console.error("❌ Example execution failed:", error);
      throw error;
    }
  }
}

// Performance comparison utility
export class PerformanceComparison {
  /**
   * Compare sequential vs concurrent vs parallel execution
   */
  static async compareApproaches(): Promise<void> {
    console.warn("\n⚡ === PERFORMANCE COMPARISON ===");

    // Create test data
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      computeTime: 500 + Math.random() * 500, // 500-1000ms
    }));

    const processTask = async (task: {
      id: number;
      computeTime: number;
    }): Promise<{ taskId: number; processed: boolean }> => {
      await new Promise((resolve) => setTimeout(resolve, task.computeTime));
      return { taskId: task.id, processed: true };
    };

    const concurrencyManager = new ConcurrencyManager({ maxConcurrent: 5 });

    // Sequential execution
    console.warn("🐌 Testing sequential execution...");
    const sequentialStart = Date.now();
    await concurrencyManager.executeSequential(tasks, processTask);
    const sequentialTime = Date.now() - sequentialStart;

    // Concurrent execution
    console.warn("🚀 Testing concurrent execution...");
    const concurrentStart = Date.now();
    await concurrencyManager.executeAllConcurrent(tasks, processTask);
    const concurrentTime = Date.now() - concurrentStart;

    // Limited concurrent execution
    console.warn("🎯 Testing limited concurrent execution...");
    const limitedStart = Date.now();
    await concurrencyManager.executeLimitedConcurrent(tasks, processTask);
    const limitedTime = Date.now() - limitedStart;

    console.warn("\n📊 Performance Results:");
    console.warn(`Sequential: ${sequentialTime}ms`);
    console.warn(
      `Concurrent: ${concurrentTime}ms (${Math.round((sequentialTime / concurrentTime) * 100) / 100}x faster)`
    );
    console.warn(
      `Limited Concurrent: ${limitedTime}ms (${Math.round((sequentialTime / limitedTime) * 100) / 100}x faster)`
    );

    console.warn("\n💡 Analysis:");
    console.warn("• Sequential execution processes one task at a time");
    console.warn("• Concurrent execution starts all tasks simultaneously");
    console.warn("• Limited concurrent balances performance with resource usage");
  }
}
