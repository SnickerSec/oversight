import Redis from 'ioredis'
import { trackCacheHit, trackCacheMiss } from './metrics'

// Create Redis client (uses REDIS_URL from Railway or defaults to localhost)
const getRedisClient = () => {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    return null
  }

  try {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
    })
  } catch {
    console.warn('Failed to create Redis client')
    return null
  }
}

let redis: Redis | null = null

export const getRedis = () => {
  if (!redis) {
    redis = getRedisClient()
  }
  return redis
}

interface CacheEntry<T> {
  d: T;       // data
  t: number;  // fetchedAt timestamp
}

// Track in-flight background refreshes to prevent duplicate fetches
const refreshing = new Set<string>()

// Cache wrapper with stale-while-revalidate
// - freshSeconds: data is served from cache without refresh
// - staleTTL: total Redis key lifetime (stale data kept for background refresh)
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  freshSeconds: number = 300,
  staleTTL: number = 1800
): Promise<T> {
  const client = getRedis()

  // If no Redis, just fetch directly
  if (!client) {
    return fetcher()
  }

  try {
    const cached = await client.get(key)
    if (cached) {
      const entry: CacheEntry<T> = JSON.parse(cached)
      const ageSeconds = (Date.now() - entry.t) / 1000

      if (ageSeconds < freshSeconds) {
        // Fresh - serve directly
        trackCacheHit(key)
        return entry.d
      }

      // Stale but available - serve immediately, refresh in background
      trackCacheHit(key)
      if (!refreshing.has(key)) {
        refreshing.add(key)
        fetcher()
          .then(data => {
            const newEntry: CacheEntry<T> = { d: data, t: Date.now() }
            return client.setex(key, staleTTL, JSON.stringify(newEntry))
          })
          .catch(() => {})
          .finally(() => refreshing.delete(key))
      }
      return entry.d
    }

    // Cache miss - fetch fresh data
    trackCacheMiss(key)
    const data = await fetcher()

    // Store in cache (don't await, fire and forget)
    const entry: CacheEntry<T> = { d: data, t: Date.now() }
    client.setex(key, staleTTL, JSON.stringify(entry)).catch(() => {})

    return data
  } catch {
    // On any Redis error, fall back to direct fetch
    return fetcher()
  }
}

// Invalidate cache by key or pattern
export async function invalidateCache(pattern: string): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(...keys)
    }
  } catch {
    // Ignore errors
  }
}
