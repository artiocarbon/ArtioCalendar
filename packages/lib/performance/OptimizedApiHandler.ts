import { PerformanceMonitor, DatabaseQueryOptimizer, ParallelProcessor } from "./ParallelProcessor";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Optimized API handler with performance monitoring and parallel processing
 */
export abstract class OptimizedApiHandler {
  /**
   * Execute API handler with performance monitoring
   */
  static async withMonitoring<T>(
    name: string,
    handler: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    return PerformanceMonitor.measureAsync(`api:${name}`, handler);
  }

  /**
   * Execute multiple database operations in parallel
   */
  static async parallelDatabaseOperations<T>(
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    return DatabaseQueryOptimizer.executeParallelQueries(operations);
  }

  /**
   * Cache API response with appropriate headers
   */
  static createCachedResponse(
    data: any,
    maxAge: number = 300, // 5 minutes default
    staleWhileRevalidate: number = 60
  ): Response {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      'CDN-Cache-Control': `max-age=${maxAge}`,
      'Vary': 'Accept-Encoding',
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers,
    });
  }

  /**
   * Create response with performance metrics
   */
  static createResponseWithMetrics(
    data: any,
    duration: number,
    additionalMetrics?: Record<string, any>
  ): Response {
    const responseData = {
      data,
      performance: {
        executionTime: `${duration}ms`,
        ...additionalMetrics,
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle API errors consistently
   */
  static createErrorResponse(
    error: Error | string,
    status: number = 500,
    context?: string
  ): Response {
    const message = error instanceof Error ? error.message : error;
    const errorData = {
      error: {
        message,
        context,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(errorData), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Middleware for API performance optimization
 */
export class ApiPerformanceMiddleware {
  /**
   * Add performance headers to response
   */
  static addPerformanceHeaders(
    response: Response,
    duration: number,
    cacheHit: boolean = false
  ): Response {
    response.headers.set('X-Response-Time', `${duration}ms`);
    response.headers.set('X-Cache-Hit', cacheHit ? 'true' : 'false');
    response.headers.set('X-Server-Timestamp', new Date().toISOString());
    
    return response;
  }

  /**
   * Validate and sanitize input
   */
  static validateInput<T>(
    input: unknown,
    validator: (data: unknown) => data is T
  ): T | null {
    if (validator(input)) {
      return input;
    }
    return null;
  }

  /**
   * Rate limiting helper
   */
  static createRateLimitResponse(
    retryAfter: number = 60
  ): Response {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Rate limit exceeded',
          retryAfter,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }
}

/**
 * Batch processing utilities for APIs
 */
export class BatchApiProcessor {
  /**
   * Process multiple requests in a single API call
   */
  static async processBatch<T, R>(
    requests: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Deduplicate identical requests
   */
  static deduplicateRequests<T>(
    requests: T[],
    getKey: (item: T) => string
  ): { unique: T[]; duplicates: Map<string, number[]> } {
    const keyMap = new Map<string, T[]>();
    
    requests.forEach((request, index) => {
      const key = getKey(request);
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(request);
    });

    const unique = Array.from(keyMap.values()).map(group => group[0]);
    const duplicates = new Map<string, number[]>();
    
    keyMap.forEach((group, key) => {
      if (group.length > 1) {
        duplicates.set(key, group.map((_, index) => requests.indexOf(group[index])));
      }
    });

    return { unique, duplicates };
  }
}

/**
 * Response compression utilities
 */
export class ResponseOptimizer {
  /**
   * Optimize response size by removing unnecessary fields
   */
  static optimizeResponse<T>(
    data: T,
    fieldsToRemove: (keyof T)[]
  ): Omit<T, typeof fieldsToRemove[number]> {
    const optimized = { ...data };
    fieldsToRemove.forEach(field => {
      delete optimized[field];
    });
    return optimized;
  }

  /**
   * Create paginated response
   */
  static createPaginatedResponse<T>(
    data: T[],
    page: number,
    pageSize: number,
    total?: number
  ): {
    data: T[];
    pagination: {
      page: number;
      pageSize: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  } {
    const totalItems = total ?? data.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Minify JSON response
   */
  static minifyJSON(data: any): string {
    return JSON.stringify(data).replace(/[\t\n\r]/g, '');
  }
}
