/**
 * Parallel Manager - Demonstrates true parallelism using Worker Threads
 *
 * This class showcases:
 * 1. Worker thread management for CPU-intensive tasks
 * 2. Load balancing across workers
 * 3. Communication between main thread and workers
 * 4. Error handling in parallel environments
 * 5. Resource cleanup and lifecycle management
 *
 * Note: In Node.js, true parallelism requires Worker Threads for CPU-bound tasks
 * I/O operations are naturally concurrent through the event loop
 */

import { Worker } from "worker_threads";
import { cpus } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { TaskResult, ParallelConfig, PerformanceMetrics } from "./concurrency-types.js";
import { ParallelDefaultConfig } from "./constants";

interface WorkerTask {
  id: string;
  data: unknown;
  type: string;
}

interface WorkerResult {
  taskId: string;
  result: unknown;
  error?: string;
  executionTime: number;
}

export class ParallelManager {
  private config: ParallelConfig;
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasksCount = 0;
  private completedTasks: TaskResult[] = [];
  private startTime: number = 0;
  private workerIndex = 0; // Round-robin worker assignment
  private pendingTaskHandlers = new Map<string, (message: WorkerResult) => void>(); // Task-specific handlers
  private isShuttingDown = false;

  constructor(config: ParallelConfig) {
    this.config = {
      workerCount: config.workerCount || cpus().length,
      timeout: config.timeout ?? ParallelDefaultConfig.TIMEOUT_MS,
      chunkSize: config.chunkSize ?? ParallelDefaultConfig.CHUNK_SIZE,
      maxCompletedTasks: config.maxCompletedTasks ?? ParallelDefaultConfig.MAX_COMPLETED_TASKS,
    };
  }

  /**
   * Initialize worker pool
   * Why: Pre-creating workers avoids the overhead of spawning them for each task
   */
  async initializeWorkers(workerScript?: string): Promise<void> {
    console.warn(`🏭 Initializing ${this.config.workerCount} workers`);

    const { path: resolvedPath, execArgv } = this.resolveWorkerPath(workerScript);

    const count = this.config.workerCount ?? 1;
    const workerPromises = Array.from({ length: count }, (_, index) =>
      this.createWorker(resolvedPath, execArgv, index)
    );

    this.workers = (await Promise.all(workerPromises)) as Worker[];
    console.warn(`✅ Worker pool initialized with ${this.workers.length} workers`);
  }

  /**
   * Create a single worker with error handling
   */
  private async createWorker(
    workerPath: string,
    execArgv: string[],
    workerId: number
  ): Promise<Worker> {
    return new Promise((resolve, reject) => {
      // Create worker from file path (production approach)
      const worker = new Worker(workerPath, {
        workerData: { workerId },
        execArgv,
      });
      worker.unref();

      worker.on("message", (message: WorkerResult & { type?: string }) => {
        if (message && message.type === "ready") {
          // Initialization message handled by once('message') below
          return;
        }
        // Route message to appropriate handler based on taskId
        if (message.taskId && this.pendingTaskHandlers.has(message.taskId)) {
          const handler = this.pendingTaskHandlers.get(message.taskId);
          if (handler) {
            handler(message);
          }
        } else {
          // Fallback for messages without handlers
          this.handleWorkerMessage(message, workerId);
        }
      });

      const clearInitTimeout = (): void => {
        clearTimeout(initTimeout);
      };

      const removeListeners = (): void => {
        worker.off("error", onError);
        worker.off("exit", onExit);
      };

      const onError = (error: Error): void => {
        clearInitTimeout();
        removeListeners();
        console.error(`❌ Worker ${workerId} error:`, error);
        this.handleWorkerError(error, workerId);
        reject(error);
      };

      const onExit = (code: number | null): void => {
        clearInitTimeout();
        removeListeners();
        if (code !== 0) {
          console.error(`❌ Worker ${workerId} exited with code ${code}`);
        }
        reject(new Error(`Worker ${workerId} exited with code ${code ?? "unknown"} before ready`));
      };

      // Timeout for worker initialization (cleared on ready, error, or exit to avoid dangling timer)
      const initTimeout = setTimeout(() => {
        removeListeners();
        reject(new Error(`Worker ${workerId} initialization timeout`));
      }, ParallelDefaultConfig.WORKER_READY_TIMEOUT_MS);

      worker.on("error", onError);
      worker.on("exit", onExit);

      worker.once("message", (message: WorkerResult & { type?: string }) => {
        if (message && message.type === "ready") {
          if (this.isShuttingDown) return;
          clearInitTimeout();
          removeListeners();
          console.warn(`👷 Worker ${workerId} ready`);
          resolve(worker);
        }
      });
    });
  }

  private resolveWorkerPath(workerScript?: string): {
    path: string;
    execArgv: string[];
  } {
    // Prefer compiled worker.js (faster, no ts-node) - concurrency-parallel outputs to ./dist
    const distWorkerPath = join(__dirname, "../dist/worker.js");
    if (existsSync(distWorkerPath)) {
      return { path: distWorkerPath, execArgv: [] };
    }

    const localJsPath = join(__dirname, "worker.js");
    if (existsSync(localJsPath)) {
      return { path: localJsPath, execArgv: [] };
    }

    if (workerScript) {
      const execArgv = workerScript.endsWith(".ts") ? ["-r", "ts-node/register"] : [];
      return { path: workerScript, execArgv };
    }

    const tsPath = join(__dirname, "worker.ts");
    return { path: tsPath, execArgv: ["-r", "ts-node/register"] };
  }

  /**
   * Execute tasks in parallel across worker threads
   * Good for: CPU-intensive computations (math, image processing, data transformation)
   * Why: Utilizes multiple CPU cores for true parallel processing
   */
  async executeParallel<T>(tasks: T[], taskType: string = "compute"): Promise<unknown[]> {
    if (this.workers.length === 0) {
      throw new Error("Workers not initialized. Call initializeWorkers() first.");
    }

    console.warn(
      `⚡ Starting parallel execution of ${tasks.length} tasks across ${this.workers.length} workers`
    );
    this.startTime = Date.now();

    return new Promise((resolve, reject) => {
      const taskPromises: Promise<unknown>[] = [];

      // Distribute tasks across workers
      tasks.forEach((task, index) => {
        const workerTask: WorkerTask = {
          id: `parallel-task-${index}`,
          data: task,
          type: taskType,
        };

        const promise = this.assignTaskToWorker(workerTask, index);
        taskPromises.push(promise);
      });

      // Wait for all tasks to complete
      Promise.all(taskPromises)
        .then((taskResults) => {
          console.warn(`🎉 All parallel tasks completed`);
          resolve(taskResults);
        })
        .catch(reject);
    });
  }

  /**
   * Assign a task to the next available worker (round-robin)
   */
  private async assignTaskToWorker(task: WorkerTask, _originalIndex: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const worker = this.getNextWorker();
      const startTime = Date.now();

      // Set up timeout
      const timeout = setTimeout(() => {
        // Clean up handler on timeout
        this.pendingTaskHandlers.delete(task.id);
        reject(new Error(`Task ${task.id} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      // Create task-specific message handler
      const messageHandler = (message: WorkerResult): void => {
        clearTimeout(timeout);
        this.pendingTaskHandlers.delete(task.id); // Remove handler after processing

        const endTime = Date.now();

        const taskResult: TaskResult = {
          taskId: task.id,
          result: message.result,
          executionTime: message.executionTime,
          startTime,
          endTime,
        };

        // Add memory management: limit completedTasks to prevent unbounded growth
        const maxCompletedTasks = this.config.maxCompletedTasks ?? ParallelDefaultConfig.MAX_COMPLETED_TASKS;
        if (this.completedTasks.length >= maxCompletedTasks) {
          this.completedTasks.shift(); // Remove oldest task (FIFO)
        }
        this.completedTasks.push(taskResult);

        if (message.error) {
          reject(new Error(message.error));
        } else {
          console.warn(`✅ Task ${task.id} completed in ${message.executionTime}ms`);
          resolve(message.result);
        }
      };

      // Register handler for this specific task
      this.pendingTaskHandlers.set(task.id, messageHandler);

      // Send task to worker
      console.warn(`📤 Sending task ${task.id} to worker ${this.workerIndex}`);
      worker.postMessage(task);
      this.activeTasksCount++;
    });
  }

  /**
   * Get next worker using round-robin scheduling
   * Why: Distributes load evenly across all workers
   */
  private getNextWorker(): Worker {
    const worker = this.workers[this.workerIndex];
    this.workerIndex = (this.workerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(message: WorkerResult, workerId: number): void {
    this.activeTasksCount--;
    console.warn(`📥 Received result from worker ${workerId} for task ${message.taskId}`);
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: Error, workerId: number): void {
    console.error(`❌ Worker ${workerId} encountered an error:`, error);
    // In production, you might want to restart the worker
    // this.restartWorker(workerId);
  }

  /**
   * Process large datasets in parallel chunks
   * Good for: Big data processing, batch operations
   * Why: Combines parallel processing with memory management
   */
  async executeChunkedParallel<T>(
    data: T[],
    taskType: string = "batch-compute"
  ): Promise<unknown[]> {
    console.warn(
      `📊 Processing ${data.length} items in parallel chunks of ${this.config.chunkSize}`
    );

    const chunks: T[][] = [];

    // Split data into chunks
    for (let i = 0; i < data.length; i += this.config.chunkSize!) {
      chunks.push(data.slice(i, i + this.config.chunkSize!));
    }

    console.warn(`📦 Created ${chunks.length} chunks for parallel processing`);

    // Process chunks in parallel
    const chunkResults = await this.executeParallel(chunks, taskType);

    // Flatten results
    const flatResults = chunkResults.flat();
    console.warn(`🎯 Chunked parallel processing completed: ${flatResults.length} results`);

    return flatResults;
  }

  /**
   * Get performance metrics
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
      concurrencyLevel: this.config.workerCount ?? 0,
      throughput: completedTasksCount > 0 ? (completedTasksCount / totalExecutionTime) * ParallelDefaultConfig.MS_PER_SECOND : 0,
    };
  }

  /**
   * Cleanup workers and resources
   * Important: Always call this when done to prevent memory leaks
   */
  async cleanup(): Promise<void> {
    this.isShuttingDown = true;
    console.warn(`🧹 Cleaning up ${this.workers.length} workers`);

    const terminationPromises = this.workers.map((worker, index) => {
      return new Promise<void>((resolve) => {
        const shutdownTimeout = setTimeout(async () => {
          try {
            await worker.terminate();
            console.warn(`✅ Worker ${index} terminated`);
          } catch (error) {
            console.error(`❌ Error terminating worker ${index}:`, error);
          } finally {
            resolve();
          }
        }, ParallelDefaultConfig.SHUTDOWN_WAIT_MS);

        worker.once("exit", () => {
          clearTimeout(shutdownTimeout);
          console.warn(`✅ Worker ${index} exited`);
          resolve();
        });

        worker.postMessage({ type: "shutdown" });
      });
    });

    await Promise.all(terminationPromises);
    this.workers = [];
    this.isShuttingDown = false;
    console.warn(`🎉 All workers cleaned up`);
  }

  /**
   * Reset metrics for new test runs
   */
  reset(): void {
    this.completedTasks = [];
    this.activeTasksCount = 0;
    this.startTime = 0;
    this.workerIndex = 0;
  }
}
