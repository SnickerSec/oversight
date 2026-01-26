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
export function trackCacheHit(): void {
  const client = getRedis();
  if (!client) return;

  const date = getDateKey();
  const key = CACHE_KEY(date);

  client.hincrby(key, 'hits', 1).catch(() => {});
  client.expire(key, METRICS_TTL).catch(() => {});
}

/**
 * Track a cache miss (fire-and-forget, non-blocking)
 */
export function trackCacheMiss(): void {
  const client = getRedis();
  if (!client) return;

  const date = getDateKey();
  const key = CACHE_KEY(date);

  client.hincrby(key, 'misses', 1).catch(() => {});
  client.expire(key, METRICS_TTL).catch(() => {});
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
