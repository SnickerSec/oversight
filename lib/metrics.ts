import { getRedis } from './redis';

// Service types for API call tracking
export type ServiceType = 'github' | 'railway' | 'supabase' | 'gcp' | 'elevenlabs';

// Get today's date in YYYY-MM-DD format
function getDateKey(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

// Redis key patterns
const METRICS_PREFIX = 'oversight:metrics';
const DAILY_KEY = (date: string, service: ServiceType) => `${METRICS_PREFIX}:daily:${date}:${service}`;
const CACHE_KEY = (date: string) => `${METRICS_PREFIX}:cache:${date}`;
const CACHE_KEY_DETAIL = (date: string, cacheKey: string) => `${METRICS_PREFIX}:cache:${date}:${cacheKey}`;

// Known cache keys and their configurations
export const CACHE_CONFIG: Record<string, { name: string; ttlSeconds: number; description: string }> = {
  'dashboard:data': {
    name: 'Dashboard Data',
    ttlSeconds: 30,
    description: 'Main dashboard with all service data'
  },
};

// TTL for metrics data (30 days in seconds)
const METRICS_TTL = 30 * 24 * 60 * 60;

/**
 * Track an API call to an external service (fire-and-forget, non-blocking)
 */
export function trackApiCall(service: ServiceType, isError: boolean = false): void {
  const client = getRedis();
  if (!client) return;

  const date = getDateKey();
  const key = DAILY_KEY(date, service);

  // Atomic increment using HINCRBY (non-blocking, fire-and-forget)
  client.hincrby(key, 'apiCalls', 1).catch(() => {});

  if (isError) {
    client.hincrby(key, 'errors', 1).catch(() => {});
  }

  // Set TTL if not already set (fire-and-forget)
  client.expire(key, METRICS_TTL).catch(() => {});
}

/**
 * Track a cache hit (fire-and-forget, non-blocking)
 */
export function trackCacheHit(cacheKey?: string): void {
  const client = getRedis();
  if (!client) return;

  const date = getDateKey();
  const key = CACHE_KEY(date);

  client.hincrby(key, 'hits', 1).catch(() => {});
  client.expire(key, METRICS_TTL).catch(() => {});

  // Also track per-key stats if key provided
  if (cacheKey) {
    const detailKey = CACHE_KEY_DETAIL(date, cacheKey);
    client.hincrby(detailKey, 'hits', 1).catch(() => {});
    client.expire(detailKey, METRICS_TTL).catch(() => {});
  }
}

/**
 * Track a cache miss (fire-and-forget, non-blocking)
 */
export function trackCacheMiss(cacheKey?: string): void {
  const client = getRedis();
  if (!client) return;

  const date = getDateKey();
  const key = CACHE_KEY(date);

  client.hincrby(key, 'misses', 1).catch(() => {});
  client.expire(key, METRICS_TTL).catch(() => {});

  // Also track per-key stats if key provided
  if (cacheKey) {
    const detailKey = CACHE_KEY_DETAIL(date, cacheKey);
    client.hincrby(detailKey, 'misses', 1).catch(() => {});
    client.expire(detailKey, METRICS_TTL).catch(() => {});
  }
}

/**
 * Get daily metrics for a specific date
 */
export async function getDailyMetrics(date: string): Promise<{
  services: Record<ServiceType, { apiCalls: number; errors: number }>;
  cache: { hits: number; misses: number };
}> {
  const client = getRedis();
  const services: ServiceType[] = ['github', 'railway', 'supabase', 'gcp', 'elevenlabs'];

  const defaultResult = {
    services: Object.fromEntries(
      services.map(s => [s, { apiCalls: 0, errors: 0 }])
    ) as Record<ServiceType, { apiCalls: number; errors: number }>,
    cache: { hits: 0, misses: 0 },
  };

  if (!client) return defaultResult;

  try {
    // Fetch all service metrics in parallel
    const servicePromises = services.map(async (service) => {
      const data = await client.hgetall(DAILY_KEY(date, service));
      return {
        service,
        apiCalls: parseInt(data?.apiCalls || '0', 10),
        errors: parseInt(data?.errors || '0', 10),
      };
    });

    // Fetch cache metrics
    const cacheData = await client.hgetall(CACHE_KEY(date));

    const serviceResults = await Promise.all(servicePromises);

    return {
      services: Object.fromEntries(
        serviceResults.map(r => [r.service, { apiCalls: r.apiCalls, errors: r.errors }])
      ) as Record<ServiceType, { apiCalls: number; errors: number }>,
      cache: {
        hits: parseInt(cacheData?.hits || '0', 10),
        misses: parseInt(cacheData?.misses || '0', 10),
      },
    };
  } catch {
    return defaultResult;
  }
}

/**
 * Get metrics for a date range (returns daily metrics for each day)
 */
export async function getMetricsRange(days: number = 7): Promise<{
  daily: Array<{
    date: string;
    services: Record<ServiceType, { apiCalls: number; errors: number }>;
    cache: { hits: number; misses: number };
  }>;
  summary: {
    totalApiCalls: number;
    totalErrors: number;
    byService: Record<ServiceType, { apiCalls: number; errors: number }>;
    cacheHitRate: number;
  };
}> {
  const dates: string[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(getDateKey(date));
  }

  // Fetch all daily metrics in parallel
  const dailyPromises = dates.map(async (date) => ({
    date,
    ...(await getDailyMetrics(date)),
  }));

  const daily = await Promise.all(dailyPromises);

  // Calculate summary
  const services: ServiceType[] = ['github', 'railway', 'supabase', 'gcp', 'elevenlabs'];
  const byService = Object.fromEntries(
    services.map(s => [s, { apiCalls: 0, errors: 0 }])
  ) as Record<ServiceType, { apiCalls: number; errors: number }>;

  let totalApiCalls = 0;
  let totalErrors = 0;
  let totalCacheHits = 0;
  let totalCacheMisses = 0;

  for (const day of daily) {
    for (const service of services) {
      const data = day.services[service];
      byService[service].apiCalls += data.apiCalls;
      byService[service].errors += data.errors;
      totalApiCalls += data.apiCalls;
      totalErrors += data.errors;
    }
    totalCacheHits += day.cache.hits;
    totalCacheMisses += day.cache.misses;
  }

  const totalCacheRequests = totalCacheHits + totalCacheMisses;
  const cacheHitRate = totalCacheRequests > 0
    ? Math.round((totalCacheHits / totalCacheRequests) * 100)
    : 0;

  return {
    daily: daily.reverse(), // Return oldest first
    summary: {
      totalApiCalls,
      totalErrors,
      byService,
      cacheHitRate,
    },
  };
}

/**
 * Get detailed cache statistics including per-key breakdown
 */
export async function getCacheDetails(): Promise<{
  activeCacheKeys: Array<{
    key: string;
    ttl: number;
    size: number;
  }>;
  keyStats: Record<string, { hits: number; misses: number; hitRate: number }>;
  recommendations: string[];
}> {
  const client = getRedis();

  const defaultResult = {
    activeCacheKeys: [],
    keyStats: {},
    recommendations: ['Redis not configured - caching disabled'],
  };

  if (!client) return defaultResult;

  try {
    // Get all active cache keys (not metrics keys)
    const allKeys = await client.keys('*');
    const cacheKeys = allKeys.filter(k => !k.startsWith('oversight:'));

    // Get TTL and size for each cache key
    const activeCacheKeys = await Promise.all(
      cacheKeys.map(async (key) => {
        const [ttl, value] = await Promise.all([
          client.ttl(key),
          client.get(key),
        ]);
        return {
          key,
          ttl: ttl > 0 ? ttl : 0,
          size: value ? Buffer.byteLength(value, 'utf8') : 0,
        };
      })
    );

    // Get per-key stats for today
    const date = getDateKey();
    const keyStats: Record<string, { hits: number; misses: number; hitRate: number }> = {};

    for (const cacheKey of Object.keys(CACHE_CONFIG)) {
      const detailKey = CACHE_KEY_DETAIL(date, cacheKey);
      const data = await client.hgetall(detailKey);
      const hits = parseInt(data?.hits || '0', 10);
      const misses = parseInt(data?.misses || '0', 10);
      const total = hits + misses;
      keyStats[cacheKey] = {
        hits,
        misses,
        hitRate: total > 0 ? Math.round((hits / total) * 100) : 0,
      };
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const globalData = await client.hgetall(CACHE_KEY(date));
    const totalHits = parseInt(globalData?.hits || '0', 10);
    const totalMisses = parseInt(globalData?.misses || '0', 10);
    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    if (hitRate < 50) {
      recommendations.push('Low cache hit rate. Consider increasing cache TTL for frequently accessed data.');
    }
    if (hitRate >= 50 && hitRate < 80) {
      recommendations.push('Moderate cache performance. Cache TTL may be too short for your refresh rate.');
    }
    if (hitRate >= 80) {
      recommendations.push('Excellent cache performance! Your TTL settings are well-tuned.');
    }

    // Check if dashboard refreshes faster than cache TTL
    const dashboardConfig = CACHE_CONFIG['dashboard:data'];
    if (dashboardConfig && totalMisses > totalHits) {
      recommendations.push(
        `Dashboard cache TTL is ${dashboardConfig.ttlSeconds}s. If you refresh more often, consider increasing it.`
      );
    }

    if (activeCacheKeys.length === 0) {
      recommendations.push('No data currently cached. Cache will populate on next API request.');
    }

    // Calculate potential savings
    if (totalMisses > 0 && hitRate < 90) {
      const potentialSavings = Math.round(totalMisses * 0.5); // Assume 50% could be saved
      recommendations.push(
        `Potential: ${potentialSavings} more API calls could be saved with optimized caching.`
      );
    }

    return {
      activeCacheKeys: activeCacheKeys.sort((a, b) => b.size - a.size),
      keyStats,
      recommendations,
    };
  } catch (error) {
    console.error('Error getting cache details:', error);
    return defaultResult;
  }
}
