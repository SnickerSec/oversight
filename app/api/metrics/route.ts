import { NextRequest, NextResponse } from 'next/server';
import { getMetricsRange, getCacheDetails, CACHE_CONFIG } from '@/lib/metrics';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get('days');

    // Default to 7 days, max 30 days
    let days = 7;
    if (daysParam) {
      const parsed = parseInt(daysParam, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 30) {
        days = parsed;
      }
    }

    const [metrics, cacheDetails] = await Promise.all([
      getMetricsRange(days),
      getCacheDetails(),
    ]);

    return NextResponse.json({
      ...metrics,
      cacheDetails: {
        ...cacheDetails,
        config: CACHE_CONFIG,
      },
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
