/**
 * Type definitions for concurrency and parallelism examples
 *
 * Key Concepts:
 * - Concurrency: Multiple tasks making progress, but not necessarily at the same time
 * - Parallelism: Multiple tasks executing simultaneously on different cores/threads
 * - In Node.js: Single-threaded event loop with async I/O (concurrency)
 * - True parallelism achieved through Worker Threads or external processes
 */

export interface Task {
  id: string;
  name: string;
  duration: number; // milliseconds
  priority?: number;
}

export interface TaskResult<T = unknown> {
  taskId: string;
  result: T;
  executionTime: number;
  startTime: number;
  endTime: number;
}

export interface ConcurrencyConfig {
  maxConcurrent: number;
  timeout?: number;
  retries?: number;
}

export interface ParallelConfig {
  workerCount?: number;
  timeout?: number;
  chunkSize?: number;
  maxCompletedTasks?: number; // Maximum number of completed tasks to keep in memory
}

export interface PerformanceMetrics {
  totalTasks: number;
  totalExecutionTime: number;
  averageTaskTime: number;
  concurrencyLevel: number;
  throughput: number; // tasks per second
}

export type TaskProcessor<T, R> = (task: T) => Promise<R>;
export type BatchProcessor<T, R> = (tasks: T[]) => Promise<R[]>;

export interface QueuedTask<T, R = unknown> {
  task: T;
  resolve: (value: R) => void;
  reject: (error: unknown) => void;
  priority: number;
  createdAt: number;
}
