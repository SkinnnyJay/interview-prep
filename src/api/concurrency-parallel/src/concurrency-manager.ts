/**
 * Concurrency Manager - Demonstrates different approaches to managing concurrent operations
 *
 * This class showcases:
 * 1. Promise-based concurrency control
 * 2. Queue management with priority
 * 3. Rate limiting and throttling
 * 4. Error handling and retries
 * 5. Performance monitoring
 */

import {
  TaskResult,
  ConcurrencyConfig,
  PerformanceMetrics,
  TaskProcessor,
} from "./concurrency-types.js";

export class ConcurrencyManager {
  private config: ConcurrencyConfig;
  private activeTasksCount = 0;
  private completedTasks: TaskResult[] = [];
  private startTime: number = 0;

  constructor(config: ConcurrencyConfig) {
    this.config = config;
  }

  /**
   * Basic Promise.all approach - All tasks start simultaneously
   * Good for: Independent tasks that can all run at once
   * Bad for: Resource-intensive tasks that might overwhelm the system
   */
  async executeAllConcurrent<T, R>(tasks: T[], processor: TaskProcessor<T, R>): Promise<R[]> {
    if (typeof process.env.CI === "undefined") {
      console.warn(`🚀 Starting ${tasks.length} tasks concurrently (Promise.all)`);
    }
    this.startTime = Date.now();

    try {
      // All promises start immediately - true concurrency
      const promises = tasks.map(async (task, index) => {
        const startTime = Date.now();
        this.activeTasksCount++;

        try {
          const result = await processor(task);
          const endTime = Date.now();

          this.completedTasks.push({
            taskId: `task-${index}`,
            result,
            executionTime: endTime - startTime,
            startTime,
            endTime,
          });

          return result;
        } finally {
          this.activeTasksCount--;
        }
      });

      const results = await Promise.all(promises);
      if (typeof process.env.CI === "undefined") {
        console.warn(`✅ All ${tasks.length} tasks completed concurrently`);
      }
      return results;
    } catch (error) {
      console.error("❌ Concurrent execution failed:", error);
      throw error;
    }
  }

  /**
   * Limited concurrency with a lightweight inline limiter
   */
  async executeLimitedConcurrent<T, R>(tasks: T[], processor: TaskProcessor<T, R>): Promise<R[]> {
    if (typeof process.env.CI === "undefined") {
      console.warn(
        `🎯 Starting ${tasks.length} tasks with concurrency limit of ${this.config.maxConcurrent}`
      );
    }
    this.startTime = Date.now();

    const concurrency = Math.max(1, this.config.maxConcurrent);
    const results: R[] = new Array(tasks.length);
    let nextIndex = 0;

    const runWorker = async (): Promise<void> => {
      for (;;) {
        const current = nextIndex++;
        if (current >= tasks.length) break;

        const startTime = Date.now();
        this.activeTasksCount++;
        try {
          const result = await processor(tasks[current]);
          results[current] = result as R;
          const endTime = Date.now();
          this.completedTasks.push({
            taskId: `limited-task-${current}`,
            result,
            executionTime: endTime - startTime,
            startTime,
            endTime,
          });
        } finally {
          this.activeTasksCount--;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, tasks.length) }, () => runWorker())
    );
    if (typeof process.env.CI === "undefined") {
      console.warn("🎉 All limited concurrent tasks completed");
    }
    return results;
  }

  /**
   * Priority queue without external deps
   */
  async executePriorityQueue<T, R>(
    tasks: (T & { priority?: number })[],
    processor: TaskProcessor<T, R>
  ): Promise<R[]> {
    if (typeof process.env.CI === "undefined") {
      console.warn(`🏆 Starting priority queue with ${tasks.length} tasks`);
    }

    // Sort by priority descending; process with limited concurrency
    const sorted = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const results: R[] = new Array(sorted.length);
    let nextIndex = 0;
    const concurrency = Math.max(1, this.config.maxConcurrent);

    const runWorker = async (): Promise<void> => {
      for (;;) {
        const idx = nextIndex++;
        if (idx >= sorted.length) break;
        const task = sorted[idx];
        const startTime = Date.now();
        this.activeTasksCount++;
        try {
          const result = await processor(task);
          results[idx] = result as R;
          const endTime = Date.now();
          this.completedTasks.push({
            taskId: `priority-task-${idx}`,
            result,
            executionTime: endTime - startTime,
            startTime,
            endTime,
          });
        } finally {
          this.activeTasksCount--;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, sorted.length) }, () => runWorker())
    );
    if (typeof process.env.CI === "undefined") {
      console.warn("🎊 Priority queue processing completed");
    }
    return results;
  }

  /**
   * Sequential processing with controlled timing
   */
  async executeSequential<T, R>(
    tasks: T[],
    processor: TaskProcessor<T, R>,
    delayMs: number = 0
  ): Promise<R[]> {
    if (typeof process.env.CI === "undefined") {
      console.warn(`⏭️ Starting sequential processing of ${tasks.length} tasks`);
    }
    this.startTime = Date.now();
    const results: R[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const startTime = Date.now();

      if (typeof process.env.CI === "undefined") {
        console.warn(`📝 Processing task ${i + 1}/${tasks.length} sequentially`);
      }

      try {
        const result = await processor(task);
        const endTime = Date.now();

        this.completedTasks.push({
          taskId: `sequential-task-${i}`,
          result,
          executionTime: endTime - startTime,
          startTime,
          endTime,
        });

        results.push(result);

        // Optional delay between tasks
        if (delayMs > 0 && i < tasks.length - 1) {
          if (typeof process.env.CI === "undefined") {
            console.warn(`⏱️ Waiting ${delayMs}ms before next task`);
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`❌ Sequential task ${i + 1} failed:`, error);
        throw error;
      }
    }

    if (typeof process.env.CI === "undefined") {
      console.warn("✅ Sequential processing completed");
    }
    return results;
  }

  /**
   * Batch processing - Process tasks in chunks
   */
  async executeBatched<T, R>(
    tasks: T[],
    processor: TaskProcessor<T, R>,
    batchSize: number = 10
  ): Promise<R[]> {
    if (typeof process.env.CI === "undefined") {
      console.warn(
        `📦 Starting batched processing: ${tasks.length} tasks in batches of ${batchSize}`
      );
    }
    this.startTime = Date.now();
    const results: R[] = [];

    // Split tasks into batches
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(tasks.length / batchSize);

      if (typeof process.env.CI === "undefined") {
        console.warn(`📋 Processing batch ${batchNumber}/${totalBatches} (${batch.length} tasks)`);
      }

      // Process batch concurrently with the limiter
      const batchResults = await this.executeLimitedConcurrent(batch, processor);
      results.push(...batchResults);

      if (typeof process.env.CI === "undefined") {
        console.warn(`✅ Batch ${batchNumber} completed`);
      }
    }

    if (typeof process.env.CI === "undefined") {
      console.warn("🎉 All batches completed");
    }
    return results;
  }

  /**
   * Get performance metrics for analysis
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const totalExecutionTime = Date.now() - this.startTime;
    const completedTasksCount = this.completedTasks.length;

    return {
      totalTasks: completedTasksCount,
      totalExecutionTime,
      averageTaskTime:
        completedTasksCount > 0
          ? this.completedTasks.reduce((sum, task) => sum + task.executionTime, 0) /
            completedTasksCount
          : 0,
      concurrencyLevel: this.config.maxConcurrent,
      throughput: completedTasksCount > 0 ? (completedTasksCount / totalExecutionTime) * 1000 : 0,
    };
  }

  /**
   * Reset metrics for new test runs
   */
  reset(): void {
    this.completedTasks = [];
    this.activeTasksCount = 0;
    this.startTime = 0;
  }
}
