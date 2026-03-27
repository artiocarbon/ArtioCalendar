import type { PrismaClient } from "@calcom/prisma/client";

/**
 * Generic cache manager for frequently accessed data
 * Supports TTL-based caching and automatic cleanup
 */
export class CacheManager<T> {
  private cache = new Map<string, { data: T; expiresAt: number }>();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default TTL
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set cache value with optional TTL
   */
  set(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Get cache value if not expired
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, item] of Array.from(this.cache.entries())) {
      if (now > item.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get or set pattern - fetch data if not cached
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instances for different data types
export const userCache = new CacheManager<any>(10 * 60 * 1000); // 10 minutes
export const eventTypeCache = new CacheManager<any>(15 * 60 * 1000); // 15 minutes
export const teamCache = new CacheManager<any>(10 * 60 * 1000); // 10 minutes
export const credentialCache = new CacheManager<any>(5 * 60 * 1000); // 5 minutes
export const translationCache = new CacheManager<any>(30 * 60 * 1000); // 30 minutes

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  userCache.cleanup();
  eventTypeCache.cleanup();
  teamCache.cleanup();
  credentialCache.cleanup();
  translationCache.cleanup();
}, 5 * 60 * 1000);
