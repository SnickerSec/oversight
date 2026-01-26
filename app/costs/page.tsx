'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';

interface ServiceMetrics {
  apiCalls: number;
  errors: number;
}

interface DailyMetrics {
  date: string;
  services: Record<string, ServiceMetrics>;
  cache: { hits: number; misses: number };
}

interface MetricsData {
  daily: DailyMetrics[];
  summary: {
    totalApiCalls: number;
    totalErrors: number;
    byService: Record<string, ServiceMetrics>;
    cacheHitRate: number;
  };
}

interface ElevenLabsData {
  subscription: {
    character_count: number;
    character_limit: number;
    tier: string;
  } | null;
}

interface DashboardData {
  elevenLabs: ElevenLabsData;
  hasElevenLabsToken: boolean;
}

type DateRange = '7d' | '14d' | '30d';

async function fetchMetrics(days: number): Promise<MetricsData> {
  const response = await fetch(`/api/metrics?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch metrics');
  return response.json();
}

async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch dashboard');
  return response.json();
}

const SERVICE_LABELS: Record<string, { name: string; color: string }> = {
  github: { name: 'GitHub', color: 'var(--foreground)' },
  railway: { name: 'Railway', color: 'var(--accent-purple)' },
  supabase: { name: 'Supabase', color: 'var(--accent-green)' },
  gcp: { name: 'GCP', color: 'var(--accent)' },
  elevenlabs: { name: 'ElevenLabs', color: 'var(--accent-orange)' },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CostsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30;

  const { data: metrics, error: metricsError, isLoading: metricsLoading } = useSWR(
    ['metrics', days],
    () => fetchMetrics(days),
    { refreshInterval: 60000 }
  );

  const { data: dashboard } = useSWR('dashboard-costs', fetchDashboard, {
    refreshInterval: 60000,
  });

  const todayMetrics = useMemo(() => {
    if (!metrics?.daily?.length) return null;
    return metrics.daily[metrics.daily.length - 1];
  }, [metrics]);

  const elevenLabsUsage = useMemo(() => {
    if (!dashboard?.elevenLabs?.subscription) return null;
    const { character_count, character_limit, tier } = dashboard.elevenLabs.subscription;
    const percentage = character_limit > 0 ? Math.round((character_count / character_limit) * 100) : 0;
    return { used: character_count, limit: character_limit, percentage, tier };
  }, [dashboard]);

  if (metricsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">API Usage & Costs</h1>
        <div className="card text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load metrics</p>
        </div>
      </div>
    );
  }

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">API Usage & Costs</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 bg-[var(--card-border)] rounded mb-2" />
              <div className="h-4 w-16 bg-[var(--card-border)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">API Usage & Costs</h1>
        <div className="flex gap-2">
          {(['7d', '14d', '30d'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                dateRange === range
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card-border)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {range.replace('d', ' days')}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">
            {formatNumber(metrics?.summary?.totalApiCalls || 0)}
          </div>
          <div className="text-sm text-[var(--text-muted)]">Total API Calls</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Last {days} days</div>
        </div>

        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-green)]">
            {metrics?.summary?.cacheHitRate || 0}%
          </div>
          <div className="text-sm text-[var(--text-muted)]">Cache Hit Rate</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Saves API calls</div>
        </div>

        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-red)]">
            {formatNumber(metrics?.summary?.totalErrors || 0)}
          </div>
          <div className="text-sm text-[var(--text-muted)]">Total Errors</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Last {days} days</div>
        </div>

        {elevenLabsUsage ? (
          <div className="card text-center">
            <div className="text-3xl font-bold text-[var(--accent-orange)]">
              {elevenLabsUsage.percentage}%
            </div>
            <div className="text-sm text-[var(--text-muted)]">ElevenLabs Quota</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {formatNumber(elevenLabsUsage.used)} / {formatNumber(elevenLabsUsage.limit)} chars
            </div>
          </div>
        ) : (
          <div className="card text-center">
            <div className="text-3xl font-bold text-[var(--text-muted)]">-</div>
            <div className="text-sm text-[var(--text-muted)]">ElevenLabs Quota</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Not configured</div>
          </div>
        )}
      </div>

      {/* Per-Service Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Service Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--text-muted)]">Service</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Today</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">{days} Day Total</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Errors</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SERVICE_LABELS).map(([key, { name, color }]) => {
                const todayData = todayMetrics?.services[key] || { apiCalls: 0, errors: 0 };
                const summaryData = metrics?.summary?.byService[key] || { apiCalls: 0, errors: 0 };
                const percentage = metrics?.summary?.totalApiCalls
                  ? Math.round((summaryData.apiCalls / metrics.summary.totalApiCalls) * 100)
                  : 0;

                return (
                  <tr key={key} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)]/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium">{name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 tabular-nums">
                      {formatNumber(todayData.apiCalls)}
                    </td>
                    <td className="text-right py-3 px-4 tabular-nums font-medium">
                      {formatNumber(summaryData.apiCalls)}
                    </td>
                    <td className="text-right py-3 px-4 tabular-nums">
                      {summaryData.errors > 0 ? (
                        <span className="text-[var(--accent-red)]">{summaryData.errors}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className="text-[var(--text-muted)] w-8 text-right">{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Daily Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--text-muted)]">Date</th>
                {Object.entries(SERVICE_LABELS).map(([key, { name }]) => (
                  <th key={key} className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">
                    {name}
                  </th>
                ))}
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Total</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Cache</th>
              </tr>
            </thead>
            <tbody>
              {metrics?.daily?.map((day) => {
                const dayTotal = Object.values(day.services).reduce(
                  (sum, s) => sum + s.apiCalls,
                  0
                );
                const cacheTotal = day.cache.hits + day.cache.misses;
                const cacheRate = cacheTotal > 0
                  ? Math.round((day.cache.hits / cacheTotal) * 100)
                  : 0;

                return (
                  <tr key={day.date} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)]/50">
                    <td className="py-3 px-4 font-medium">{formatDate(day.date)}</td>
                    {Object.keys(SERVICE_LABELS).map((key) => (
                      <td key={key} className="text-right py-3 px-4 tabular-nums">
                        {day.services[key]?.apiCalls || 0}
                      </td>
                    ))}
                    <td className="text-right py-3 px-4 tabular-nums font-medium">
                      {dayTotal}
                    </td>
                    <td className="text-right py-3 px-4 tabular-nums text-[var(--text-muted)]">
                      {cacheRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cache Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Cache Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-green)]">
              {formatNumber(
                metrics?.daily?.reduce((sum, d) => sum + d.cache.hits, 0) || 0
              )}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Cache Hits</div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-orange)]">
              {formatNumber(
                metrics?.daily?.reduce((sum, d) => sum + d.cache.misses, 0) || 0
              )}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Cache Misses</div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent)]">
              {metrics?.summary?.cacheHitRate || 0}%
            </div>
            <div className="text-sm text-[var(--text-muted)]">Hit Rate</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Higher is better - reduces API calls
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
