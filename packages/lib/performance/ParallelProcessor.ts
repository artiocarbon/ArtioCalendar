/**
 * Utilities for parallel processing and performance optimization
 */

export interface ParallelTask<T> {
  id: string;
  task: () => Promise<T>;
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
}

export interface ParallelTaskResult<T> {
  id: string;
  result?: T;
  error?: Error;
  executionTime: number;
}

/**
 * Execute multiple tasks in parallel with timeout and error handling
 */
export class ParallelProcessor {
  private static async executeTaskWithTimeout<T>(
    task: () => Promise<T>,
    timeout: number = 30000 // 30 seconds default
  ): Promise<{ result?: T; error?: Error; executionTime: number }> {
    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), timeout);
      });

      const result = await Promise.race([task(), timeoutPromise]);
      const executionTime = Date.now() - startTime;
      
      return { result, executionTime };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return { 
        error: error instanceof Error ? error : new Error('Unknown error'), 
        executionTime 
      };
    }
  }

  /**
   * Execute multiple tasks in parallel with Promise.allSettled for error resilience
   */
  static async executeAll<T>(tasks: ParallelTask<T>[]): Promise<ParallelTaskResult<T>[]> {
    const promises = tasks.map(async (task) => {
      const { result, error, executionTime } = await this.executeTaskWithTimeout(
        task.task,
        task.timeout
      );
      
      return {
        id: task.id,
        result,
        error,
        executionTime,
      } as ParallelTaskResult<T>;
    });

    return Promise.all(promises);
  }

  /**
   * Execute tasks with priority - high priority tasks first
   */
  static async executeWithPriority<T>(tasks: ParallelTask<T>[]): Promise<ParallelTaskResult<T>[]> {
    const prioritizedTasks = tasks.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority || 'medium'] || 2) - (priorityOrder[a.priority || 'medium'] || 2);
    });

    return this.executeAll(prioritizedTasks);
  }

  /**
   * Execute tasks in batches to control concurrency
   */
  static async executeInBatches<T>(
    tasks: ParallelTask<T>[], 
    batchSize: number = 5
  ): Promise<ParallelTaskResult<T>[]> {
    const results: ParallelTaskResult<T>[] = [];
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await this.executeAll(batch);
      results.push(...batchResults);
      
      // Optional: Add delay between batches to prevent overwhelming
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Execute tasks with race condition - return first successful result
   */
  static async executeRace<T>(tasks: ParallelTask<T>[]): Promise<ParallelTaskResult<T> | null> {
    const promises = tasks.map(async (task) => {
      const { result, error, executionTime } = await this.executeTaskWithTimeout(
        task.task,
        task.timeout
      );
      
      if (error) {
        throw error;
      }
      
      return {
        id: task.id,
        result,
        error: undefined,
        executionTime,
      } as ParallelTaskResult<T>;
    });

    try {
      // Manual implementation for compatibility
      const results = await Promise.allSettled(promises);
      const firstFulfilled = results.find(
        (result): result is PromiseFulfilledResult<ParallelTaskResult<T>> => 
          result.status === 'fulfilled'
      );
      return firstFulfilled?.value || null;
    } catch (error) {
      // All tasks failed
      return null;
    }
  }
}

/**
 * Utility for database query parallelization
 */
export class DatabaseQueryOptimizer {
  /**
   * Execute multiple database queries in parallel
   */
  static async executeParallelQueries<T>(
    queries: Array<() => Promise<T>>
  ): Promise<T[]> {
    const tasks: ParallelTask<T>[] = queries.map((query, index) => ({
      id: `query-${index}`,
      task: query,
      priority: 'medium' as const,
      timeout: 10000, // 10 seconds for DB queries
    }));

    const results = await ParallelProcessor.executeAll(tasks);
    
    // Filter out failed queries and return successful results
    const successfulResults = results
      .filter(result => !result.error)
      .map(result => result.result as T);

    // Log failed queries for debugging
    const failedResults = results.filter(result => result.error);
    if (failedResults.length > 0) {
      console.warn(`Failed to execute ${failedResults.length} database queries:`, failedResults);
    }

    return successfulResults;
  }

  /**
   * Batch fetch related entities to reduce database round trips
   */
  static async batchFetch<T, K>(
    items: T[],
    keySelector: (item: T) => K,
    fetcher: (keys: K[]) => Promise<Array<{ id: K; data: any }>>
  ): Promise<Map<K, any>> {
    // Extract unique keys
    const uniqueKeys = Array.from(new Set(items.map(keySelector)));
    
    if (uniqueKeys.length === 0) {
      return new Map();
    }

    // Fetch all related data in one query
    const relatedData = await fetcher(uniqueKeys);
    
    // Create lookup map
    const resultMap = new Map<K, any>();
    relatedData.forEach(item => {
      resultMap.set(item.id, item.data);
    });

    return resultMap;
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();

  static startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  static endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer '${label}' was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);
    
    // Log performance warnings
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${label} took ${duration}ms`);
    }
    
    return duration;
  }

  static async measureAsync<T>(
    label: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    this.startTimer(label);
    const result = await operation();
    const duration = this.endTimer(label);
    
    return { result, duration };
  }
}
