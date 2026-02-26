'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { RepoWithDetails } from '@/lib/github';
import { getSupabaseStatusColor, getSupabaseStatusLabel, getSupabaseStatusBgColor } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronDown, ExternalLink, MapPin, Github, Info, ShieldAlert, Zap } from 'lucide-react';

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
  hasSupabaseToken: boolean;
}

type StatusFilter = 'all' | 'healthy' | 'inactive' | 'issues';

async function fetchData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

function SupabaseLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 109 113" fill="currentColor">
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-35.151 54.347Z"/>
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-35.151 54.347Z" fillOpacity=".2"/>
      <path d="M45.317 2.07c2.86-3.601 8.657-1.628 8.726 2.97l.442 67.251H9.83c-8.19 0-12.759-9.46-7.665-15.875L45.317 2.07Z"/>
    </svg>
  );
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'text-[var(--accent-red)] bg-[var(--accent-red)]/10';
    case 'WARN':
      return 'text-[var(--accent-orange)] bg-[var(--accent-orange)]/10';
    case 'INFO':
    default:
      return 'text-[var(--accent)] bg-[var(--accent)]/10';
  }
}

export default function SupabasePage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const { data, error, isLoading } = useSWR<DashboardData>('dashboard', fetchData, {
    refreshInterval: 300000,
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const repos = data?.repos || [];
  const hasSupabaseToken = data?.hasSupabaseToken ?? false;

  // Get repos with Supabase projects
  const supabaseRepos = useMemo(() => {
    return repos.filter(repo => repo.supabase);
  }, [repos]);

  // Filter repos
  const filteredRepos = useMemo(() => {
    let result = supabaseRepos;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(repo => {
        const status = repo.supabase?.status?.toUpperCase();
        switch (statusFilter) {
          case 'healthy':
            return status === 'ACTIVE_HEALTHY';
          case 'inactive':
            return status === 'INACTIVE' || status === 'PAUSED' || status === 'PAUSING';
          case 'issues':
            return status === 'INIT_FAILED' || status === 'REMOVED' ||
                   status === 'RESTORING' || status === 'UPGRADING' ||
                   status === 'COMING_UP' || status === 'GOING_DOWN';
          default:
            return true;
        }
      });
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(repo =>
        repo.name.toLowerCase().includes(searchLower) ||
        repo.supabase?.projectName.toLowerCase().includes(searchLower) ||
        repo.supabase?.region.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [supabaseRepos, statusFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const allAdvisors = supabaseRepos.flatMap(r => [
      ...(r.supabase?.advisors?.performance || []),
      ...(r.supabase?.advisors?.security || []),
    ]);
    return {
      total: supabaseRepos.length,
      healthy: supabaseRepos.filter(r => r.supabase?.status?.toUpperCase() === 'ACTIVE_HEALTHY').length,
      inactive: supabaseRepos.filter(r => ['INACTIVE', 'PAUSED', 'PAUSING'].includes(r.supabase?.status?.toUpperCase() || '')).length,
      issues: supabaseRepos.filter(r => ['INIT_FAILED', 'REMOVED', 'RESTORING', 'UPGRADING', 'COMING_UP', 'GOING_DOWN'].includes(r.supabase?.status?.toUpperCase() || '')).length,
      advisorWarnings: allAdvisors.filter(a => a.level === 'WARN').length,
      advisorInfo: allAdvisors.filter(a => a.level === 'INFO').length,
      advisorErrors: allAdvisors.filter(a => a.level === 'ERROR').length,
    };
  }, [supabaseRepos]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <SupabaseLogo className="w-7 h-7" />
          Supabase Projects
        </h1>
        <Card className="p-4 text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load Supabase data</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <SupabaseLogo className="w-7 h-7" />
          Supabase Projects
        </h1>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-8 rounded mb-2" />
              <Skeleton className="h-4 w-16 rounded" />
            </Card>
          ))}
        </div>
        <Card className="p-4">
          <Skeleton className="h-10 rounded mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!hasSupabaseToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <SupabaseLogo className="w-7 h-7" />
          Supabase Projects
        </h1>
        <Card className="p-4 text-center py-12">
          <SupabaseLogo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Supabase Token Required</h2>
          <p className="text-muted-foreground mb-4">Connect your Supabase account to see projects</p>
          <p className="text-sm text-muted-foreground">
            Add <code className="bg-[var(--card-border)] px-1 rounded">SUPABASE_ACCESS_TOKEN</code> to <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Create a token at <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">supabase.com/dashboard/account/tokens</a>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <SupabaseLogo className="w-7 h-7" />
          Supabase Projects
        </h1>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
        >
          Open Supabase Dashboard
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Projects</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent-green)]">{stats.healthy}</div>
          <div className="text-sm text-muted-foreground">Healthy</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-muted-foreground">{stats.inactive}</div>
          <div className="text-sm text-muted-foreground">Inactive</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent-orange)]">{stats.issues}</div>
          <div className="text-sm text-muted-foreground">Issues</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent-red)]">{stats.advisorErrors}</div>
          <div className="text-sm text-muted-foreground">Errors</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent-orange)]">{stats.advisorWarnings}</div>
          <div className="text-sm text-muted-foreground">Warnings</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">{stats.advisorInfo}</div>
          <div className="text-sm text-muted-foreground">Info</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-auto min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status ({stats.total})</SelectItem>
              <SelectItem value="healthy">Healthy ({stats.healthy})</SelectItem>
              <SelectItem value="inactive">Inactive ({stats.inactive})</SelectItem>
              <SelectItem value="issues">Issues ({stats.issues})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Results */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRepos.length} of {supabaseRepos.length} projects
      </div>

      {/* Projects List */}
      {filteredRepos.length === 0 ? (
        <Card className="p-4 text-center py-12">
          <SupabaseLogo className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {supabaseRepos.length === 0
              ? 'No Supabase projects found'
              : 'No projects match your filters'}
          </p>
          {supabaseRepos.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Projects are matched by repo name. Make sure your Supabase project names match your GitHub repo names.
            </p>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRepos.map((repo) => {
            const advisors = repo.supabase?.advisors;
            const totalAdvisors = (advisors?.performance?.length || 0) + (advisors?.security?.length || 0);
            const isExpanded = expandedProjects.has(repo.supabase?.projectId || '');

            return (
              <Card key={repo.id} className="p-4">
                <div className="flex items-start gap-4">
                  {/* Status Indicator */}
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${getSupabaseStatusBgColor(repo.supabase?.status)}`} />

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{repo.supabase?.projectName}</h3>
                      <span className={`text-sm ${getSupabaseStatusColor(repo.supabase?.status)}`}>
                        {getSupabaseStatusLabel(repo.supabase?.status)}
                      </span>
                      {totalAdvisors > 0 && (
                        <button
                          onClick={() => toggleExpanded(repo.supabase?.projectId || '')}
                          className="text-xs px-2 py-0.5 rounded bg-[var(--card-border)] hover:bg-[var(--accent)]/20 flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          {totalAdvisors} advisor{totalAdvisors !== 1 ? 's' : ''}
                          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Region: {repo.supabase?.region}
                      </span>
                      <span className="flex items-center gap-1">
                        <Github className="w-4 h-4" />
                        <Link href={repo.html_url} target="_blank" className="text-[var(--accent)] hover:underline">
                          {repo.name}
                        </Link>
                      </span>
                      {repo.supabase?.createdAt && (
                        <span>Created: {timeAgo(repo.supabase.createdAt)}</span>
                      )}
                    </div>

                    {/* Advisors Section */}
                    {isExpanded && totalAdvisors > 0 && (
                      <div className="mt-4 space-y-4">
                        {/* Security Advisors */}
                        {advisors?.security && advisors.security.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-[var(--accent-orange)]" />
                              Security ({advisors.security.length})
                            </h4>
                            <div className="space-y-2">
                              {advisors.security.map((lint, i) => (
                                <div key={i} className="text-sm p-2 rounded bg-[var(--background)] border border-border">
                                  <div className="flex items-start gap-2">
                                    <Badge className={`rounded-full text-xs font-medium ${getLevelColor(lint.level)}`}>
                                      {lint.level}
                                    </Badge>
                                    <div className="flex-1">
                                      <div className="font-medium">{lint.title}</div>
                                      <div className="text-muted-foreground text-xs mt-1">{lint.detail}</div>
                                      <a
                                        href={lint.remediation}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[var(--accent)] hover:underline mt-1 inline-block"
                                      >
                                        View remediation
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Performance Advisors */}
                        {advisors?.performance && advisors.performance.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-[var(--accent)]" />
                              Performance ({advisors.performance.length})
                            </h4>
                            <div className="space-y-2">
                              {advisors.performance.map((lint, i) => (
                                <div key={i} className="text-sm p-2 rounded bg-[var(--background)] border border-border">
                                  <div className="flex items-start gap-2">
                                    <Badge className={`rounded-full text-xs font-medium ${getLevelColor(lint.level)}`}>
                                      {lint.level}
                                    </Badge>
                                    <div className="flex-1">
                                      <div className="font-medium">{lint.title}</div>
                                      <div className="text-muted-foreground text-xs mt-1">{lint.detail}</div>
                                      <a
                                        href={lint.remediation}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[var(--accent)] hover:underline mt-1 inline-block"
                                      >
                                        View remediation
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`https://supabase.com/dashboard/project/${repo.supabase?.projectId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <SupabaseLogo className="w-4 h-4" />
                        Dashboard
                      </a>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
