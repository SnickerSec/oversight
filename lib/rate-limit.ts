interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  limit: number
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60 seconds
const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)
if (typeof cleanup.unref === 'function') cleanup.unref()

export function rateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    return { allowed: true, limit, remaining: limit - 1, resetAt }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)

  return {
    allowed: entry.count <= limit,
    limit,
    remaining,
    resetAt: entry.resetAt,
  }
}
