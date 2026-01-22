interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = 60000; // 1 minute in milliseconds

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  
  return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl
  });
}

export function invalidateCache(key: string): boolean {
  return cache.delete(key);
}

export function clearAllCache(): void {
  cache.clear();
}

export function invalidateCacheByPattern(pattern: string): number {
  let count = 0;
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    if (key.includes(pattern)) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

export function buildCacheKey(prefix: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const parts = sortedKeys.map(k => `${k}=${params[k]}`);
  return `${prefix}_${parts.join('_')}`;
}
