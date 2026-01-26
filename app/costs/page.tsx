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

interface CacheKeyInfo {
  key: string;
  ttl: number;
  size: number;
}

interface CacheConfig {
  name: string;
  ttlSeconds: number;
  description: string;
}

interface MetricsData {
  daily: DailyMetrics[];
  summary: {
    totalApiCalls: number;
    totalErrors: number;
    byService: Record<string, ServiceMetrics>;
    cacheHitRate: number;
  };
  cacheDetails?: {
    activeCacheKeys: CacheKeyInfo[];
    keyStats: Record<string, { hits: number; misses: number; hitRate: number }>;
    recommendations: string[];
    config: Record<string, CacheConfig>;
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

interface GCPCostBreakdown {
  service: string;
  cost: number;
  currency: string;
}

interface GCPBillingData {
  billingAccount: {
    name: string;
    displayName: string;
    open: boolean;
  } | null;
  billingInfo: {
    billingAccountName?: string;
    billingEnabled: boolean;
  } | null;
  budgets: Array<{
    name: string;
    displayName: string;
    budgetAmount: {
      specifiedAmount?: {
        currencyCode: string;
        units: string;
      };
    };
  }>;
  currentMonthCost: number | null;
  last30DaysCost: number | null;
  costBreakdown: GCPCostBreakdown[];
  currency: string;
  lastUpdated: string | null;
  error?: string;
  bigQueryConfigured: boolean;
}

interface GCPData {
  billing?: GCPBillingData;
  projectId: string | null;
}

interface DashboardData {
  elevenLabs: ElevenLabsData;
  hasElevenLabsToken: boolean;
  gcp?: GCPData;
  hasGCPToken?: boolean;
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
    billingNote: 'Billing API connected'
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTTL(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
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

  // GCP billing data
  const gcpBilling = useMemo(() => {
    if (!dashboard?.gcp?.billing) return null;
    const billing = dashboard.gcp.billing;
    return {
      accountName: billing.billingAccount?.displayName || null,
      billingEnabled: billing.billingInfo?.billingEnabled || false,
      budgets: billing.budgets || [],
      currency: billing.currency || 'USD',
      error: billing.error,
      lastUpdated: billing.lastUpdated,
      currentMonthCost: billing.currentMonthCost,
      last30DaysCost: billing.last30DaysCost,
      costBreakdown: billing.costBreakdown || [],
      bigQueryConfigured: billing.bigQueryConfigured || false,
    };
  }, [dashboard]);

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
            <div className="text-sm text-[var(--text-muted)]">Dashboard Cache</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Reduces API calls</div>
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

      {/* GCP Billing Details */}
      {dashboard?.hasGCPToken && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-2">GCP Billing</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Actual billing data from Google Cloud Billing API
          </p>

          {gcpBilling?.error ? (
            <div className="p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[var(--accent-red)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-medium text-[var(--accent-red)]">Billing API Error</div>
                  <div className="text-sm text-[var(--text-muted)] mt-1">{gcpBilling.error}</div>
                  <div className="text-sm text-[var(--text-muted)] mt-2">
                    To enable billing data:
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Enable Cloud Billing API: <code className="bg-[var(--card-border)] px-1 rounded">gcloud services enable cloudbilling.googleapis.com</code></li>
                      <li>Grant your service account the <code className="bg-[var(--card-border)] px-1 rounded">roles/billing.viewer</code> role</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : gcpBilling ? (
            <div className="space-y-4">
              {/* Cost Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
                  <div className="text-sm text-[var(--text-muted)]">Current Month</div>
                  <div className="text-2xl font-bold mt-1 text-[var(--accent)]">
                    {gcpBilling.currentMonthCost !== null
                      ? `$${gcpBilling.currentMonthCost.toFixed(2)}`
                      : gcpBilling.bigQueryConfigured ? '$0.00' : '-'
                    }
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {gcpBilling.bigQueryConfigured ? 'From billing export' : 'Configure BigQuery export'}
                  </div>
                </div>

                <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
                  <div className="text-sm text-[var(--text-muted)]">Last 30 Days</div>
                  <div className="text-2xl font-bold mt-1 text-[var(--accent-purple)]">
                    {gcpBilling.last30DaysCost !== null
                      ? `$${gcpBilling.last30DaysCost.toFixed(2)}`
                      : gcpBilling.bigQueryConfigured ? '$0.00' : '-'
                    }
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {gcpBilling.costBreakdown.length} services
                  </div>
                </div>

                <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
                  <div className="text-sm text-[var(--text-muted)]">Billing Account</div>
                  <div className="text-lg font-semibold mt-1 truncate">
                    {gcpBilling.accountName || 'Not linked'}
                  </div>
                  {gcpBilling.billingEnabled ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green)]">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-red)]/20 text-[var(--accent-red)]">
                      Disabled
                    </span>
                  )}
                </div>

                <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
                  <div className="text-sm text-[var(--text-muted)]">Budgets</div>
                  <div className="text-lg font-semibold mt-1">
                    {gcpBilling.budgets.length}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {gcpBilling.budgets.length > 0 ? 'Budget alerts active' : 'No budget alerts'}
                  </div>
                </div>
              </div>

              {/* Cost Breakdown by Service */}
              {gcpBilling.costBreakdown.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-[var(--text-muted)]">Cost by Service (Last 30 Days)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--card-border)]">
                          <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Service</th>
                          <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Cost</th>
                          <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gcpBilling.costBreakdown.map((item, i) => {
                          const percentage = gcpBilling.last30DaysCost
                            ? Math.round((item.cost / gcpBilling.last30DaysCost) * 100)
                            : 0;
                          return (
                            <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)]/50">
                              <td className="py-2 px-3">{item.service}</td>
                              <td className="text-right py-2 px-3 tabular-nums font-medium">
                                ${item.cost.toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-3">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[var(--accent)]"
                                      style={{ width: `${percentage}%` }}
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
              )}

              {/* BigQuery Setup Instructions */}
              {!gcpBilling.bigQueryConfigured && (
                <div className="p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg">
                  <h3 className="font-medium text-[var(--accent)] mb-2">Enable Detailed Cost Tracking</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    To see actual GCP costs by service, set up BigQuery billing export:
                  </p>
                  <ol className="text-sm text-[var(--text-muted)] list-decimal list-inside space-y-1 mb-3">
                    <li>Go to <a href="https://console.cloud.google.com/billing/export" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Billing → Billing export</a></li>
                    <li>Enable "Detailed usage cost" export to BigQuery</li>
                    <li>Note your dataset name (e.g., <code className="bg-[var(--card-border)] px-1 rounded">billing_export</code>)</li>
                    <li>Add these environment variables to Railway:
                      <div className="mt-1 ml-4 font-mono text-xs bg-[var(--card-border)] p-2 rounded">
                        GCP_BILLING_DATASET=billing_export<br/>
                        GCP_BILLING_TABLE=gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX
                      </div>
                    </li>
                  </ol>
                  <a
                    href="https://cloud.google.com/billing/docs/how-to/export-data-bigquery"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--accent)] hover:underline"
                  >
                    View setup documentation →
                  </a>
                </div>
              )}

              {/* Budgets */}
              {gcpBilling.budgets.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-[var(--text-muted)]">Budgets</h3>
                  <div className="space-y-2">
                    {gcpBilling.budgets.map((budget, i) => (
                      <div key={i} className="p-3 bg-[var(--background)] rounded-lg border border-[var(--card-border)] flex items-center justify-between">
                        <div>
                          <div className="font-medium">{budget.displayName}</div>
                          <div className="text-sm text-[var(--text-muted)]">
                            {budget.budgetAmount.specifiedAmount
                              ? `${budget.budgetAmount.specifiedAmount.currencyCode} ${parseInt(budget.budgetAmount.specifiedAmount.units).toLocaleString()}`
                              : 'No limit set'
                            }
                          </div>
                        </div>
                        <a
                          href={`https://console.cloud.google.com/billing/budgets?project=${dashboard?.gcp?.projectId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--accent)] hover:underline"
                        >
                          View in Console
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to full billing console */}
              <div className="p-4 bg-[var(--card-border)]/30 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-medium">Full Billing Details</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    View detailed cost breakdown, invoices, and usage reports in GCP Console
                  </div>
                </div>
                <a
                  href={`https://console.cloud.google.com/billing?project=${dashboard?.gcp?.projectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:opacity-90 text-sm"
                >
                  Open GCP Billing
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <div>Loading billing data...</div>
            </div>
          )}
        </div>
      )}

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

      {/* Dashboard API Cache */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Dashboard API Cache</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Reduces external API calls by caching dashboard data locally in Redis
        </p>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-green)]">
              {formatNumber(cacheStats.hits)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Cache Hits</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Served from cache
            </div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-orange)]">
              {formatNumber(cacheStats.misses)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Cache Misses</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Required API fetch
            </div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className={`text-2xl font-bold ${
              (metrics?.summary?.cacheHitRate || 0) >= 80
                ? 'text-[var(--accent-green)]'
                : (metrics?.summary?.cacheHitRate || 0) >= 50
                  ? 'text-[var(--accent-orange)]'
                  : 'text-[var(--accent-red)]'
            }`}>
              {metrics?.summary?.cacheHitRate || 0}%
            </div>
            <div className="text-sm text-[var(--text-muted)]">Hit Rate</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {(metrics?.summary?.cacheHitRate || 0) >= 80 ? 'Excellent' :
               (metrics?.summary?.cacheHitRate || 0) >= 50 ? 'Good' : 'Needs improvement'}
            </div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <div className="text-2xl font-bold text-[var(--accent-purple)]">
              {formatNumber(cacheStats.savedCalls)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">API Calls Saved</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              ~{formatNumber(Math.round(cacheStats.savedCalls / days))}/day avg
            </div>
          </div>
        </div>

        {/* Cache Configuration */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-muted)]">Cache Configuration</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Cache Key</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Description</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">TTL</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Today Hits</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Today Misses</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.cacheDetails?.config && Object.entries(metrics.cacheDetails.config).map(([key, config]) => {
                  const stats = metrics.cacheDetails?.keyStats[key] || { hits: 0, misses: 0, hitRate: 0 };
                  return (
                    <tr key={key} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)]/50">
                      <td className="py-2 px-3 font-mono text-xs">{key}</td>
                      <td className="py-2 px-3">{config.description}</td>
                      <td className="text-right py-2 px-3 tabular-nums">{config.ttlSeconds}s</td>
                      <td className="text-right py-2 px-3 tabular-nums text-[var(--accent-green)]">{stats.hits}</td>
                      <td className="text-right py-2 px-3 tabular-nums text-[var(--accent-orange)]">{stats.misses}</td>
                      <td className="text-right py-2 px-3">
                        <span className={`font-medium ${
                          stats.hitRate >= 80 ? 'text-[var(--accent-green)]' :
                          stats.hitRate >= 50 ? 'text-[var(--accent-orange)]' :
                          'text-[var(--accent-red)]'
                        }`}>
                          {stats.hitRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!metrics?.cacheDetails?.config || Object.keys(metrics.cacheDetails.config).length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-[var(--text-muted)]">
                      No cache configuration data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Cache Keys */}
        {metrics?.cacheDetails?.activeCacheKeys && metrics.cacheDetails.activeCacheKeys.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-[var(--text-muted)]">Active Cache Entries</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Key</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Size</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">TTL Remaining</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.cacheDetails.activeCacheKeys.map((cacheKey) => (
                    <tr key={cacheKey.key} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)]/50">
                      <td className="py-2 px-3 font-mono text-xs">{cacheKey.key}</td>
                      <td className="text-right py-2 px-3 tabular-nums">{formatBytes(cacheKey.size)}</td>
                      <td className="text-right py-2 px-3 tabular-nums">{formatTTL(cacheKey.ttl)}</td>
                      <td className="text-right py-2 px-3">
                        {cacheKey.ttl > 10 ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green)]">Active</span>
                        ) : cacheKey.ttl > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]">Expiring</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-red)]/20 text-[var(--accent-red)]">Expired</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              Total cached: {formatBytes(metrics.cacheDetails.activeCacheKeys.reduce((sum, k) => sum + k.size, 0))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {metrics?.cacheDetails?.recommendations && metrics.cacheDetails.recommendations.length > 0 && (
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Recommendations
            </h3>
            <ul className="space-y-2 text-sm">
              {metrics.cacheDetails.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--accent)] mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* How Cache Works */}
        <div className="mt-6 p-4 bg-[var(--card-border)]/30 rounded-lg">
          <h3 className="text-sm font-semibold mb-2">How Caching Works</h3>
          <div className="text-sm text-[var(--text-muted)] space-y-2">
            <p>
              <strong>Cache Hit:</strong> Data served from Redis cache (fast, no external API call)
            </p>
            <p>
              <strong>Cache Miss:</strong> Data fetched from external APIs, then stored in cache
            </p>
            <p>
              <strong>TTL (Time To Live):</strong> How long data stays in cache before expiring
            </p>
            <div className="mt-3 pt-3 border-t border-[var(--card-border)]">
              <strong className="text-[var(--foreground)]">Tips to improve cache performance:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Avoid refreshing the page more often than the cache TTL ({metrics?.cacheDetails?.config?.['dashboard:data']?.ttlSeconds || 30}s)</li>
                <li>Multiple browser tabs share the same cache</li>
                <li>API calls are reduced when cached data is still fresh</li>
                <li>Higher hit rate = fewer external API calls = lower costs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
