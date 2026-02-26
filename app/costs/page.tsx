'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Lightbulb } from 'lucide-react';

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
        <Card className="p-4 text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load metrics</p>
        </Card>
      </div>
    );
  }

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">API Usage & Costs</h1>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-8 w-full mb-2" />
              <Skeleton className="h-4 w-16" />
            </Card>
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
            <Button
              key={range}
              onClick={() => setDateRange(range)}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
            >
              {range.replace('d', ' days')}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total API Calls Card */}
        <Card
          className={`p-4 cursor-pointer transition-all ${expandedCard === 'calls' ? 'ring-2 ring-[var(--accent)]' : 'hover:bg-muted/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'calls' ? null : 'calls')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent)]">
              {formatNumber(metrics?.summary?.totalApiCalls || 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total API Calls</div>
            <div className="text-xs text-muted-foreground mt-1">Last {days} days</div>
          </div>
          {expandedCard === 'calls' && (
            <div className="mt-4 pt-4 border-t border-border space-y-2">
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
        </Card>

        {/* Cache Hit Rate Card */}
        <Card
          className={`p-4 cursor-pointer transition-all ${expandedCard === 'cache' ? 'ring-2 ring-[var(--accent-green)]' : 'hover:bg-muted/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'cache' ? null : 'cache')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-green)]">
              {metrics?.summary?.cacheHitRate || 0}%
            </div>
            <div className="text-sm text-muted-foreground">Dashboard Cache</div>
            <div className="text-xs text-muted-foreground mt-1">Reduces API calls</div>
          </div>
          {expandedCard === 'cache' && (
            <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cache Hits</span>
                <span className="font-medium text-[var(--accent-green)]">{formatNumber(cacheStats.hits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cache Misses</span>
                <span className="font-medium text-[var(--accent-orange)]">{formatNumber(cacheStats.misses)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">API Calls Saved</span>
                <span className="font-medium text-[var(--accent-green)]">{formatNumber(cacheStats.savedCalls)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Total Errors Card */}
        <Card
          className={`p-4 cursor-pointer transition-all ${expandedCard === 'errors' ? 'ring-2 ring-[var(--accent-red)]' : 'hover:bg-muted/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'errors' ? null : 'errors')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-red)]">
              {formatNumber(metrics?.summary?.totalErrors || 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Errors</div>
            <div className="text-xs text-muted-foreground mt-1">Last {days} days</div>
          </div>
          {expandedCard === 'errors' && (
            <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
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
                <div className="text-center text-muted-foreground">No errors recorded</div>
              )}
            </div>
          )}
        </Card>

        {/* ElevenLabs Quota Card */}
        <Card
          className={`p-4 cursor-pointer transition-all ${expandedCard === 'elevenlabs' ? 'ring-2 ring-[var(--accent-orange)]' : 'hover:bg-muted/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'elevenlabs' ? null : 'elevenlabs')}
        >
          {elevenLabsUsage ? (
            <>
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--accent-orange)]">
                  {elevenLabsUsage.percentage}%
                </div>
                <div className="text-sm text-muted-foreground">ElevenLabs Quota</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(elevenLabsUsage.used)} / {formatNumber(elevenLabsUsage.limit)} chars
                </div>
              </div>
              {expandedCard === 'elevenlabs' && (
                <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium capitalize">{elevenLabsUsage.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Characters Used</span>
                    <span className="font-medium">{elevenLabsUsage.used.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Characters Left</span>
                    <span className="font-medium">{(elevenLabsUsage.limit - elevenLabsUsage.used).toLocaleString()}</span>
                  </div>
                  {elevenLabsUsage.resetDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resets</span>
                      <span className="font-medium">{elevenLabsUsage.resetDate.toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium">${elevenLabsUsage.pricePerK}/1K chars</span>
                  </div>
                  {elevenLabsUsage.actualInvoice !== null ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next Invoice</span>
                      <span className="font-medium text-[var(--accent-orange)]">{formatCurrency(elevenLabsUsage.actualInvoice)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Usage Cost</span>
                      <span className="font-medium text-[var(--accent-orange)]">{formatCurrency(elevenLabsUsage.estimatedCost)}</span>
                    </div>
                  )}
                  {elevenLabsUsage.nextPaymentDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Date</span>
                      <span className="font-medium">{elevenLabsUsage.nextPaymentDate.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-3xl font-bold text-muted-foreground">-</div>
              <div className="text-sm text-muted-foreground">ElevenLabs Quota</div>
              <div className="text-xs text-muted-foreground mt-1">Not configured</div>
            </div>
          )}
        </Card>

        {/* Estimated Total Cost Card */}
        <Card
          className={`p-4 cursor-pointer transition-all ${expandedCard === 'cost' ? 'ring-2 ring-[var(--accent-purple)]' : 'hover:bg-muted/30'}`}
          onClick={() => setExpandedCard(expandedCard === 'cost' ? null : 'cost')}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-purple)]">
              {formatCurrency(totalEstimatedCost)}
            </div>
            <div className="text-sm text-muted-foreground">Est. Total Cost</div>
            <div className="text-xs text-muted-foreground mt-1">Last {days} days</div>
          </div>
          {expandedCard === 'cost' && (
            <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
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
                <div className="flex items-center justify-between pt-2 border-t border-border">
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
              <div className="text-xs text-muted-foreground pt-2 border-t border-border space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-[var(--accent-green)]">*</span>
                  <span>ElevenLabs: Actual invoice from API</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--accent-orange)]">*</span>
                  <span>GCP: Estimate - full billing in GCP Console</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">*</span>
                  <span>Railway/Supabase: No billing API - check dashboards</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Per-Service Breakdown */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Service Breakdown</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-3 px-4">Service</TableHead>
              <TableHead className="text-right py-3 px-4">Today</TableHead>
              <TableHead className="text-right py-3 px-4">{days} Day Total</TableHead>
              <TableHead className="text-right py-3 px-4">Errors</TableHead>
              <TableHead className="text-right py-3 px-4">Est. Cost</TableHead>
              <TableHead className="text-right py-3 px-4">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(SERVICE_CONFIG).map(([key, { name, color, costNote }]) => {
              const todayData = todayMetrics?.services[key] || { apiCalls: 0, errors: 0 };
              const summaryData = metrics?.summary?.byService[key] || { apiCalls: 0, errors: 0 };
              const percentage = metrics?.summary?.totalApiCalls
                ? Math.round((summaryData.apiCalls / metrics.summary.totalApiCalls) * 100)
                : 0;
              const cost = serviceCosts[key] || 0;

              return (
                <TableRow key={key}>
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <span className="font-medium">{name}</span>
                        <div className="text-xs text-muted-foreground">{costNote}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 tabular-nums">
                    {formatNumber(todayData.apiCalls)}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 tabular-nums font-medium">
                    {formatNumber(summaryData.apiCalls)}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 tabular-nums">
                    {summaryData.errors > 0 ? (
                      <span className="text-[var(--accent-red)]">{summaryData.errors}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 tabular-nums">
                    {cost > 0 ? (
                      <span className="text-[var(--accent-green)]">{formatCurrency(cost)}</span>
                    ) : (
                      <span className="text-muted-foreground">Free</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground w-8 text-right">{percentage}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* ElevenLabs Usage Row */}
            {elevenLabsUsage && (
              <TableRow className="bg-muted/20">
                <TableCell className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--accent-orange)' }} />
                    <div>
                      <span className="font-medium">ElevenLabs (Characters)</span>
                      <div className="text-xs text-muted-foreground">
                        {elevenLabsUsage.actualInvoice !== null
                          ? `Actual invoice: ${formatCurrency(elevenLabsUsage.actualInvoice)}`
                          : `$${elevenLabsUsage.pricePerK}/1K chars (${elevenLabsUsage.tier})`
                        }
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right py-3 px-4 tabular-nums text-muted-foreground">-</TableCell>
                <TableCell className="text-right py-3 px-4 tabular-nums font-medium">
                  {formatNumber(elevenLabsUsage.used)} chars
                </TableCell>
                <TableCell className="text-right py-3 px-4 tabular-nums text-muted-foreground">-</TableCell>
                <TableCell className="text-right py-3 px-4 tabular-nums">
                  <span className="text-[var(--accent-orange)]">
                    {formatCurrency(elevenLabsUsage.actualInvoice ?? elevenLabsUsage.estimatedCost)}
                  </span>
                  {elevenLabsUsage.actualInvoice !== null && (
                    <div className="text-xs text-[var(--accent-green)]">Actual</div>
                  )}
                </TableCell>
                <TableCell className="text-right py-3 px-4 text-muted-foreground">
                  {elevenLabsUsage.percentage}% of quota
                </TableCell>
              </TableRow>
            )}
            {/* Total Row */}
            <TableRow className="bg-muted/30 font-medium">
              <TableCell className="py-3 px-4">Total</TableCell>
              <TableCell className="text-right py-3 px-4 tabular-nums">
                {formatNumber(Object.values(todayMetrics?.services || {}).reduce((sum, s) => sum + s.apiCalls, 0))}
              </TableCell>
              <TableCell className="text-right py-3 px-4 tabular-nums">
                {formatNumber(metrics?.summary?.totalApiCalls || 0)}
              </TableCell>
              <TableCell className="text-right py-3 px-4 tabular-nums text-[var(--accent-red)]">
                {metrics?.summary?.totalErrors || 0}
              </TableCell>
              <TableCell className="text-right py-3 px-4 tabular-nums text-[var(--accent-purple)]">
                {formatCurrency(totalEstimatedCost)}
              </TableCell>
              <TableCell className="text-right py-3 px-4">100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* GCP Billing Details */}
      {dashboard?.hasGCPToken && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">GCP Billing</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Actual billing data from Google Cloud Billing API
          </p>

          {gcpBilling?.error ? (
            <div className="p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--accent-red)] mt-0.5" />
                <div>
                  <div className="font-medium text-[var(--accent-red)]">Billing API Error</div>
                  <div className="text-sm text-muted-foreground mt-1">{gcpBilling.error}</div>
                  <div className="text-sm text-muted-foreground mt-2">
                    To enable billing data:
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Enable Cloud Billing API: <code className="bg-muted px-1 rounded">gcloud services enable cloudbilling.googleapis.com</code></li>
                      <li>Grant your service account the <code className="bg-muted px-1 rounded">roles/billing.viewer</code> role</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : gcpBilling ? (
            <div className="space-y-4">
              {/* Cost Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground">Current Month</div>
                  <div className="text-2xl font-bold mt-1 text-[var(--accent)]">
                    {gcpBilling.currentMonthCost !== null
                      ? `$${gcpBilling.currentMonthCost.toFixed(2)}`
                      : gcpBilling.bigQueryConfigured ? '$0.00' : '-'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {gcpBilling.bigQueryConfigured ? 'From billing export' : 'Configure BigQuery export'}
                  </div>
                </div>

                <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground">Last 30 Days</div>
                  <div className="text-2xl font-bold mt-1 text-[var(--accent-purple)]">
                    {gcpBilling.last30DaysCost !== null
                      ? `$${gcpBilling.last30DaysCost.toFixed(2)}`
                      : gcpBilling.bigQueryConfigured ? '$0.00' : '-'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {gcpBilling.costBreakdown.length} services
                  </div>
                </div>

                <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground">Billing Account</div>
                  <div className="text-lg font-semibold mt-1 truncate">
                    {gcpBilling.accountName || 'Not linked'}
                  </div>
                  {gcpBilling.billingEnabled ? (
                    <Badge className="rounded-full bg-[var(--accent-green)]/20 text-[var(--accent-green)] border-0">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="rounded-full bg-[var(--accent-red)]/20 text-[var(--accent-red)] border-0">
                      Disabled
                    </Badge>
                  )}
                </div>

                <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground">Budgets</div>
                  <div className="text-lg font-semibold mt-1">
                    {gcpBilling.budgets.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {gcpBilling.budgets.length > 0 ? 'Budget alerts active' : 'No budget alerts'}
                  </div>
                </div>
              </div>

              {/* Cost Breakdown by Service */}
              {gcpBilling.costBreakdown.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Cost by Service (Last 30 Days)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-2 px-3">Service</TableHead>
                        <TableHead className="text-right py-2 px-3">Cost</TableHead>
                        <TableHead className="text-right py-2 px-3">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gcpBilling.costBreakdown.map((item, i) => {
                        const percentage = gcpBilling.last30DaysCost
                          ? Math.round((item.cost / gcpBilling.last30DaysCost) * 100)
                          : 0;
                        return (
                          <TableRow key={i}>
                            <TableCell className="py-2 px-3">{item.service}</TableCell>
                            <TableCell className="text-right py-2 px-3 tabular-nums font-medium">
                              ${item.cost.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right py-2 px-3">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[var(--accent)]"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-muted-foreground w-8 text-right">{percentage}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* BigQuery Setup Instructions */}
              {!gcpBilling.bigQueryConfigured && (
                <div className="p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg">
                  <h3 className="font-medium text-[var(--accent)] mb-2">Enable Detailed Cost Tracking</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    To see actual GCP costs by service, set up BigQuery billing export:
                  </p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 mb-3">
                    <li>Go to <a href="https://console.cloud.google.com/billing/export" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Billing &rarr; Billing export</a></li>
                    <li>Enable &quot;Detailed usage cost&quot; export to BigQuery</li>
                    <li>Note your dataset name (e.g., <code className="bg-muted px-1 rounded">billing_export</code>)</li>
                    <li>Add these environment variables to Railway:
                      <div className="mt-1 ml-4 font-mono text-xs bg-muted p-2 rounded">
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
                    View setup documentation &rarr;
                  </a>
                </div>
              )}

              {/* Budgets */}
              {gcpBilling.budgets.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Budgets</h3>
                  <div className="space-y-2">
                    {gcpBilling.budgets.map((budget, i) => (
                      <div key={i} className="p-3 bg-[var(--background)] rounded-lg border border-border flex items-center justify-between">
                        <div>
                          <div className="font-medium">{budget.displayName}</div>
                          <div className="text-sm text-muted-foreground">
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
              <div className="p-4 bg-muted/30 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-medium">Full Billing Details</div>
                  <div className="text-sm text-muted-foreground">
                    View detailed cost breakdown, invoices, and usage reports in GCP Console
                  </div>
                </div>
                <a
                  href={`https://console.cloud.google.com/billing?project=${dashboard?.gcp?.projectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm">Open GCP Billing</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div>Loading billing data...</div>
            </div>
          )}
        </Card>
      )}

      {/* Daily Breakdown */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Daily Activity</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-3 px-4">Date</TableHead>
              {Object.entries(SERVICE_CONFIG).map(([key, { name }]) => (
                <TableHead key={key} className="text-right py-3 px-4">
                  {name}
                </TableHead>
              ))}
              <TableHead className="text-right py-3 px-4">Total</TableHead>
              <TableHead className="text-right py-3 px-4">Cache</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                <TableRow key={day.date}>
                  <TableCell className="py-3 px-4 font-medium">{formatDate(day.date)}</TableCell>
                  {Object.keys(SERVICE_CONFIG).map((key) => (
                    <TableCell key={key} className="text-right py-3 px-4 tabular-nums">
                      {day.services[key]?.apiCalls || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right py-3 px-4 tabular-nums font-medium">
                    {dayTotal}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 tabular-nums text-muted-foreground">
                    {cacheRate}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Dashboard API Cache */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">Dashboard API Cache</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Reduces external API calls by caching dashboard data locally in Redis
        </p>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
            <div className="text-2xl font-bold text-[var(--accent-green)]">
              {formatNumber(cacheStats.hits)}
            </div>
            <div className="text-sm text-muted-foreground">Cache Hits</div>
            <div className="text-xs text-muted-foreground mt-1">
              Served from cache
            </div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
            <div className="text-2xl font-bold text-[var(--accent-orange)]">
              {formatNumber(cacheStats.misses)}
            </div>
            <div className="text-sm text-muted-foreground">Cache Misses</div>
            <div className="text-xs text-muted-foreground mt-1">
              Required API fetch
            </div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
            <div className={`text-2xl font-bold ${
              (metrics?.summary?.cacheHitRate || 0) >= 80
                ? 'text-[var(--accent-green)]'
                : (metrics?.summary?.cacheHitRate || 0) >= 50
                  ? 'text-[var(--accent-orange)]'
                  : 'text-[var(--accent-red)]'
            }`}>
              {metrics?.summary?.cacheHitRate || 0}%
            </div>
            <div className="text-sm text-muted-foreground">Hit Rate</div>
            <div className="text-xs text-muted-foreground mt-1">
              {(metrics?.summary?.cacheHitRate || 0) >= 80 ? 'Excellent' :
               (metrics?.summary?.cacheHitRate || 0) >= 50 ? 'Good' : 'Needs improvement'}
            </div>
          </div>
          <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
            <div className="text-2xl font-bold text-[var(--accent-purple)]">
              {formatNumber(cacheStats.savedCalls)}
            </div>
            <div className="text-sm text-muted-foreground">API Calls Saved</div>
            <div className="text-xs text-muted-foreground mt-1">
              ~{formatNumber(Math.round(cacheStats.savedCalls / days))}/day avg
            </div>
          </div>
        </div>

        {/* Cache Configuration */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Cache Configuration</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3">Cache Key</TableHead>
                <TableHead className="py-2 px-3">Description</TableHead>
                <TableHead className="text-right py-2 px-3">TTL</TableHead>
                <TableHead className="text-right py-2 px-3">Today Hits</TableHead>
                <TableHead className="text-right py-2 px-3">Today Misses</TableHead>
                <TableHead className="text-right py-2 px-3">Hit Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics?.cacheDetails?.config && Object.entries(metrics.cacheDetails.config).map(([key, config]) => {
                const stats = metrics.cacheDetails?.keyStats[key] || { hits: 0, misses: 0, hitRate: 0 };
                return (
                  <TableRow key={key}>
                    <TableCell className="py-2 px-3 font-mono text-xs">{key}</TableCell>
                    <TableCell className="py-2 px-3">{config.description}</TableCell>
                    <TableCell className="text-right py-2 px-3 tabular-nums">{config.ttlSeconds}s</TableCell>
                    <TableCell className="text-right py-2 px-3 tabular-nums text-[var(--accent-green)]">{stats.hits}</TableCell>
                    <TableCell className="text-right py-2 px-3 tabular-nums text-[var(--accent-orange)]">{stats.misses}</TableCell>
                    <TableCell className="text-right py-2 px-3">
                      <span className={`font-medium ${
                        stats.hitRate >= 80 ? 'text-[var(--accent-green)]' :
                        stats.hitRate >= 50 ? 'text-[var(--accent-orange)]' :
                        'text-[var(--accent-red)]'
                      }`}>
                        {stats.hitRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!metrics?.cacheDetails?.config || Object.keys(metrics.cacheDetails.config).length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">
                    No cache configuration data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Active Cache Keys */}
        {metrics?.cacheDetails?.activeCacheKeys && metrics.cacheDetails.activeCacheKeys.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Active Cache Entries</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3">Key</TableHead>
                  <TableHead className="text-right py-2 px-3">Size</TableHead>
                  <TableHead className="text-right py-2 px-3">TTL Remaining</TableHead>
                  <TableHead className="text-right py-2 px-3">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.cacheDetails.activeCacheKeys.map((cacheKey) => (
                  <TableRow key={cacheKey.key}>
                    <TableCell className="py-2 px-3 font-mono text-xs">{cacheKey.key}</TableCell>
                    <TableCell className="text-right py-2 px-3 tabular-nums">{formatBytes(cacheKey.size)}</TableCell>
                    <TableCell className="text-right py-2 px-3 tabular-nums">{formatTTL(cacheKey.ttl)}</TableCell>
                    <TableCell className="text-right py-2 px-3">
                      {cacheKey.ttl > 10 ? (
                        <Badge className="rounded-full bg-[var(--accent-green)]/20 text-[var(--accent-green)] border-0">Active</Badge>
                      ) : cacheKey.ttl > 0 ? (
                        <Badge className="rounded-full bg-[var(--accent-orange)]/20 text-[var(--accent-orange)] border-0">Expiring</Badge>
                      ) : (
                        <Badge className="rounded-full bg-[var(--accent-red)]/20 text-[var(--accent-red)] border-0">Expired</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-2 text-xs text-muted-foreground">
              Total cached: {formatBytes(metrics.cacheDetails.activeCacheKeys.reduce((sum, k) => sum + k.size, 0))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {metrics?.cacheDetails?.recommendations && metrics.cacheDetails.recommendations.length > 0 && (
          <div className="p-4 bg-[var(--background)] rounded-lg border border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[var(--accent)]" />
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
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <h3 className="text-sm font-semibold mb-2">How Caching Works</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Cache Hit:</strong> Data served from Redis cache (fast, no external API call)
            </p>
            <p>
              <strong>Cache Miss:</strong> Data fetched from external APIs, then stored in cache
            </p>
            <p>
              <strong>TTL (Time To Live):</strong> How long data stays in cache before expiring
            </p>
            <div className="mt-3 pt-3 border-t border-border">
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
      </Card>
    </div>
  );
}
