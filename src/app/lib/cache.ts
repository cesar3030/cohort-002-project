import { createCache } from "cache-manager";

// Initialize cache manager with file-based persistence
let cacheInstance: ReturnType<typeof createCache> | null = null;

export function getCache() {
  if (!cacheInstance) {
    cacheInstance = createCache({
      ttl: 0,
    });
  }
  return cacheInstance;
}

/**
 * Generates a normalized cache key from the query string
 */
export function generateCacheKey(query: string): string {
  return query.toLowerCase().trim().split(" ").join("-");
}
