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
    currency?: string;
    status?: string;
    billing_period?: string;
    next_character_count_reset_unix?: number;
    next_invoice?: {
      amount_due_cents: number;
      next_payment_attempt_unix: number;
    };
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

// Service configuration with costs per API call (in USD)
// These are estimates - actual costs vary by usage tier and specific endpoints
const SERVICE_CONFIG: Record<string, {
  name: string;
  color: string;
  costPerCall: number;
  costNote: string;
  billingNote?: string;
}> = {
  github: {
    name: 'GitHub',
    color: 'var(--foreground)',
    costPerCall: 0, // Free API
    costNote: 'Free (rate limited)',
    billingNote: 'No API costs'
  },
  railway: {
    name: 'Railway',
    color: 'var(--accent-purple)',
    costPerCall: 0, // API is free, costs are compute-based
    costNote: 'API free - see dashboard',
    billingNote: 'Billing via Railway dashboard only'
  },
  supabase: {
    name: 'Supabase',
    color: 'var(--accent-green)',
    costPerCall: 0, // API is free within limits
    costNote: 'API free - see dashboard',
    billingNote: 'Billing via Supabase dashboard'
  },
  gcp: {
    name: 'GCP',
    color: 'var(--accent)',
    costPerCall: 0.0001, // ~$0.10 per 1000 calls for monitoring API
    costNote: '$0.10 per 1K calls (est.)',
    billingNote: 'Full billing via GCP Console'
  },
  elevenlabs: {
    name: 'ElevenLabs',
    color: 'var(--accent-orange)',
    costPerCall: 0, // Billed by characters, not API calls
    costNote: 'Billed by characters used',
    billingNote: 'Actual invoice from API'
  },
};

// ElevenLabs pricing per 1000 characters by tier
const ELEVENLABS_PRICING: Record<string, number> = {
  free: 0,
  starter: 0.30,
  creator: 0.24,
  pro: 0.18,
  scale: 0.11,
  enterprise: 0.08,
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCurrency(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return '<$0.01';
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CostsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

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
    const sub = dashboard.elevenLabs.subscription;
    const { character_count, character_limit, tier } = sub;
    const percentage = character_limit > 0 ? Math.round((character_count / character_limit) * 100) : 0;
    const pricePerK = ELEVENLABS_PRICING[tier.toLowerCase()] || 0.30;
    const estimatedCost = (character_count / 1000) * pricePerK;

    // Use actual invoice amount if available, otherwise use estimate
    const actualInvoice = sub.next_invoice?.amount_due_cents
      ? sub.next_invoice.amount_due_cents / 100
      : null;
    const nextPaymentDate = sub.next_invoice?.next_payment_attempt_unix
      ? new Date(sub.next_invoice.next_payment_attempt_unix * 1000)
      : null;
    const resetDate = sub.next_character_count_reset_unix
      ? new Date(sub.next_character_count_reset_unix * 1000)
      : null;

    return {
      used: character_count,
      limit: character_limit,
      percentage,
      tier,
      estimatedCost,
      actualInvoice,
      nextPaymentDate,
      resetDate,
      pricePerK,
      billingPeriod: sub.billing_period,
      currency: sub.currency || 'USD',
    };
  }, [dashboard]);

  // Calculate costs per service
  const serviceCosts = useMemo(() => {
    if (!metrics?.summary?.byService) return {};
    const costs: Record<string, number> = {};
    Object.entries(metrics.summary.byService).forEach(([service, data]) => {
      const config = SERVICE_CONFIG[service];
      if (config) {
        costs[service] = data.apiCalls * config.costPerCall;
      }
    });
    return costs;
  }, [metrics]);

  const totalApiCost = useMemo(() => {
    return Object.values(serviceCosts).reduce((sum, cost) => sum + cost, 0);
  }, [serviceCosts]);

  const totalEstimatedCost = useMemo(() => {
    // Use actual ElevenLabs invoice if available, otherwise use estimate
    const elevenLabsCost = elevenLabsUsage?.actualInvoice ?? elevenLabsUsage?.estimatedCost ?? 0;
    return totalApiCost + elevenLabsCost;
  }, [totalApiCost, elevenLabsUsage]);

  // Cache statistics
  const cacheStats = useMemo(() => {
    if (!metrics?.daily) return { hits: 0, misses: 0, total: 0, savedCalls: 0 };
    const hits = metrics.daily.reduce((sum, d) => sum + d.cache.hits, 0);
    const misses = metrics.daily.reduce((sum, d) => sum + d.cache.misses, 0);
    return { hits, misses, total: hits + misses, savedCalls: hits };
  }, [metrics]);

  // Error breakdown by service
  const errorBreakdown = useMemo(() => {
    if (!metrics?.summary?.byService) return [];
    return Object.entries(metrics.summary.byService)
      .filter(([, data]) => data.errors > 0)
      .map(([service, data]) => ({
        service,
        name: SERVICE_CONFIG[service]?.name || service,
        errors: data.errors,
        color: SERVICE_CONFIG[service]?.color || 'var(--text-muted)',
      }))
      .sort((a, b) => b.errors - a.errors);
  }, [metrics]);

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total API Calls Card */}
        <div
          className={`card cursor-pointer transition-all ${expandedCard === 'calls' ? 'ring-2 ring-[var(--accent)]' : 'hover:bg-[var(--card-border)]/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'calls' ? null : 'calls')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent)]">
              {formatNumber(metrics?.summary?.totalApiCalls || 0)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Total API Calls</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Last {days} days</div>
          </div>
          {expandedCard === 'calls' && (
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-2">
              {Object.entries(SERVICE_CONFIG).map(([key, { name, color }]) => {
                const calls = metrics?.summary?.byService[key]?.apiCalls || 0;
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span>{name}</span>
                    </div>
                    <span className="tabular-nums font-medium">{formatNumber(calls)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cache Hit Rate Card */}
        <div
          className={`card cursor-pointer transition-all ${expandedCard === 'cache' ? 'ring-2 ring-[var(--accent-green)]' : 'hover:bg-[var(--card-border)]/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'cache' ? null : 'cache')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-green)]">
              {metrics?.summary?.cacheHitRate || 0}%
            </div>
            <div className="text-sm text-[var(--text-muted)]">Cache Hit Rate</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Saves API calls</div>
          </div>
          {expandedCard === 'cache' && (
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Cache Hits</span>
                <span className="font-medium text-[var(--accent-green)]">{formatNumber(cacheStats.hits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Cache Misses</span>
                <span className="font-medium text-[var(--accent-orange)]">{formatNumber(cacheStats.misses)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--card-border)]">
                <span className="text-[var(--text-muted)]">API Calls Saved</span>
                <span className="font-medium text-[var(--accent-green)]">{formatNumber(cacheStats.savedCalls)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Total Errors Card */}
        <div
          className={`card cursor-pointer transition-all ${expandedCard === 'errors' ? 'ring-2 ring-[var(--accent-red)]' : 'hover:bg-[var(--card-border)]/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'errors' ? null : 'errors')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-red)]">
              {formatNumber(metrics?.summary?.totalErrors || 0)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Total Errors</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Last {days} days</div>
          </div>
          {expandedCard === 'errors' && (
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-2 text-sm">
              {errorBreakdown.length > 0 ? (
                errorBreakdown.map(({ service, name, errors, color }) => (
                  <div key={service} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span>{name}</span>
                    </div>
                    <span className="font-medium text-[var(--accent-red)]">{errors}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-[var(--text-muted)]">No errors recorded</div>
              )}
            </div>
          )}
        </div>

        {/* ElevenLabs Quota Card */}
        <div
          className={`card cursor-pointer transition-all ${expandedCard === 'elevenlabs' ? 'ring-2 ring-[var(--accent-orange)]' : 'hover:bg-[var(--card-border)]/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'elevenlabs' ? null : 'elevenlabs')}
        >
          {elevenLabsUsage ? (
            <>
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--accent-orange)]">
                  {elevenLabsUsage.percentage}%
                </div>
                <div className="text-sm text-[var(--text-muted)]">ElevenLabs Quota</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {formatNumber(elevenLabsUsage.used)} / {formatNumber(elevenLabsUsage.limit)} chars
                </div>
              </div>
              {expandedCard === 'elevenlabs' && (
                <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Plan</span>
                    <span className="font-medium capitalize">{elevenLabsUsage.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Characters Used</span>
                    <span className="font-medium">{elevenLabsUsage.used.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Characters Left</span>
                    <span className="font-medium">{(elevenLabsUsage.limit - elevenLabsUsage.used).toLocaleString()}</span>
                  </div>
                  {elevenLabsUsage.resetDate && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Resets</span>
                      <span className="font-medium">{elevenLabsUsage.resetDate.toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-[var(--card-border)]">
                    <span className="text-[var(--text-muted)]">Rate</span>
                    <span className="font-medium">${elevenLabsUsage.pricePerK}/1K chars</span>
                  </div>
                  {elevenLabsUsage.actualInvoice !== null ? (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Next Invoice</span>
                      <span className="font-medium text-[var(--accent-orange)]">{formatCurrency(elevenLabsUsage.actualInvoice)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Est. Usage Cost</span>
                      <span className="font-medium text-[var(--accent-orange)]">{formatCurrency(elevenLabsUsage.estimatedCost)}</span>
                    </div>
                  )}
                  {elevenLabsUsage.nextPaymentDate && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Payment Date</span>
                      <span className="font-medium">{elevenLabsUsage.nextPaymentDate.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--text-muted)]">-</div>
              <div className="text-sm text-[var(--text-muted)]">ElevenLabs Quota</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Not configured</div>
            </div>
          )}
        </div>

        {/* Estimated Total Cost Card */}
        <div
          className={`card cursor-pointer transition-all ${expandedCard === 'cost' ? 'ring-2 ring-[var(--accent-purple)]' : 'hover:bg-[var(--card-border)]/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'cost' ? null : 'cost')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-purple)]">
              {formatCurrency(totalEstimatedCost)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Est. Total Cost</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Last {days} days</div>
          </div>
          {expandedCard === 'cost' && (
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-2 text-sm">
              {Object.entries(SERVICE_CONFIG).map(([key, { name, color, billingNote }]) => {
                const cost = serviceCosts[key] || 0;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span>{name}</span>
                    </div>
                    <span className="font-medium">{cost > 0 ? formatCurrency(cost) : 'Free'}</span>
                  </div>
                );
              })}
              {elevenLabsUsage && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--card-border)]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-orange)' }} />
                    <span>ElevenLabs</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-[var(--accent-orange)]">
                      {formatCurrency(elevenLabsUsage.actualInvoice ?? elevenLabsUsage.estimatedCost)}
                    </span>
                    {elevenLabsUsage.actualInvoice !== null && (
                      <span className="ml-1 text-xs text-[var(--accent-green)]">(actual)</span>
                    )}
                  </div>
                </div>
              )}
              <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--card-border)] space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-[var(--accent-green)]">*</span>
                  <span>ElevenLabs: Actual invoice from API</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--accent-orange)]">*</span>
                  <span>GCP: Estimate - full billing in GCP Console</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">*</span>
                  <span>Railway/Supabase: No billing API - check dashboards</span>
                </div>
              </div>
            </div>
          )}
        </div>
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
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Est. Cost</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SERVICE_CONFIG).map(([key, { name, color, costNote }]) => {
                const todayData = todayMetrics?.services[key] || { apiCalls: 0, errors: 0 };
                const summaryData = metrics?.summary?.byService[key] || { apiCalls: 0, errors: 0 };
                const percentage = metrics?.summary?.totalApiCalls
                  ? Math.round((summaryData.apiCalls / metrics.summary.totalApiCalls) * 100)
                  : 0;
                const cost = serviceCosts[key] || 0;

                return (
                  <tr key={key} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)]/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <div>
                          <span className="font-medium">{name}</span>
                          <div className="text-xs text-[var(--text-muted)]">{costNote}</div>
                        </div>
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
                    <td className="text-right py-3 px-4 tabular-nums">
                      {cost > 0 ? (
                        <span className="text-[var(--accent-green)]">{formatCurrency(cost)}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">Free</span>
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
              {/* ElevenLabs Usage Row */}
              {elevenLabsUsage && (
                <tr className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)]/50 bg-[var(--card-border)]/20">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--accent-orange)' }} />
                      <div>
                        <span className="font-medium">ElevenLabs (Characters)</span>
                        <div className="text-xs text-[var(--text-muted)]">
                          {elevenLabsUsage.actualInvoice !== null
                            ? `Actual invoice: ${formatCurrency(elevenLabsUsage.actualInvoice)}`
                            : `$${elevenLabsUsage.pricePerK}/1K chars (${elevenLabsUsage.tier})`
                          }
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 tabular-nums text-[var(--text-muted)]">-</td>
                  <td className="text-right py-3 px-4 tabular-nums font-medium">
                    {formatNumber(elevenLabsUsage.used)} chars
                  </td>
                  <td className="text-right py-3 px-4 tabular-nums text-[var(--text-muted)]">-</td>
                  <td className="text-right py-3 px-4 tabular-nums">
                    <span className="text-[var(--accent-orange)]">
                      {formatCurrency(elevenLabsUsage.actualInvoice ?? elevenLabsUsage.estimatedCost)}
                    </span>
                    {elevenLabsUsage.actualInvoice !== null && (
                      <div className="text-xs text-[var(--accent-green)]">Actual</div>
                    )}
                  </td>
                  <td className="text-right py-3 px-4 text-[var(--text-muted)]">
                    {elevenLabsUsage.percentage}% of quota
                  </td>
                </tr>
              )}
              {/* Total Row */}
              <tr className="bg-[var(--card-border)]/30 font-medium">
                <td className="py-3 px-4">Total</td>
                <td className="text-right py-3 px-4 tabular-nums">
                  {formatNumber(Object.values(todayMetrics?.services || {}).reduce((sum, s) => sum + s.apiCalls, 0))}
                </td>
                <td className="text-right py-3 px-4 tabular-nums">
                  {formatNumber(metrics?.summary?.totalApiCalls || 0)}
                </td>
                <td className="text-right py-3 px-4 tabular-nums text-[var(--accent-red)]">
                  {metrics?.summary?.totalErrors || 0}
                </td>
                <td className="text-right py-3 px-4 tabular-nums text-[var(--accent-purple)]">
                  {formatCurrency(totalEstimatedCost)}
                </td>
                <td className="text-right py-3 px-4">100%</td>
              </tr>
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
                {Object.entries(SERVICE_CONFIG).map(([key, { name }]) => (
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
                    {Object.keys(SERVICE_CONFIG).map((key) => (
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-green)]">
              {formatNumber(cacheStats.hits)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Cache Hits</div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-orange)]">
              {formatNumber(cacheStats.misses)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Cache Misses</div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent)]">
              {metrics?.summary?.cacheHitRate || 0}%
            </div>
            <div className="text-sm text-[var(--text-muted)]">Hit Rate</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Higher is better
            </div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-purple)]">
              {formatNumber(cacheStats.savedCalls)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">API Calls Saved</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Reduced external requests
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
