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

// Cache wrapper with TTL (time-to-live in seconds)
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const client = getRedis()

  // If no Redis, just fetch directly
  if (!client) {
    return fetcher()
  }

  try {
    // Try to get from cache
    const cached = await client.get(key)
    if (cached) {
      trackCacheHit(key)
      return JSON.parse(cached) as T
    }

    // Cache miss - fetch fresh data
    trackCacheMiss(key)
    const data = await fetcher()

    // Store in cache (don't await, fire and forget)
    client.setex(key, ttlSeconds, JSON.stringify(data)).catch(() => {
      // Ignore cache write errors
    })

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
