'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { RepoWithDetails } from '@/lib/github';
import { getSupabaseStatusColor, getSupabaseStatusLabel, getSupabaseStatusBgColor } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';

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

  const { data, error, isLoading } = useSWR<DashboardData>('supabase', fetchData, {
    refreshInterval: 30000,
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
        <div className="card text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load Supabase data</p>
        </div>
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
            <div key={i} className="card animate-pulse">
              <div className="h-8 bg-[var(--card-border)] rounded mb-2" />
              <div className="h-4 w-16 bg-[var(--card-border)] rounded" />
            </div>
          ))}
        </div>
        <div className="card animate-pulse">
          <div className="h-10 bg-[var(--card-border)] rounded mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-[var(--card-border)] rounded" />
            ))}
          </div>
        </div>
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
        <div className="card text-center py-12">
          <SupabaseLogo className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h2 className="text-xl font-semibold mb-2">Supabase Token Required</h2>
          <p className="text-[var(--text-muted)] mb-4">Connect your Supabase account to see projects</p>
          <p className="text-sm text-[var(--text-muted)]">
            Add <code className="bg-[var(--card-border)] px-1 rounded">SUPABASE_ACCESS_TOKEN</code> to <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Create a token at <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">supabase.com/dashboard/account/tokens</a>
          </p>
        </div>
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm text-[var(--text-muted)]">Projects</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-green)]">{stats.healthy}</div>
          <div className="text-sm text-[var(--text-muted)]">Healthy</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--text-muted)]">{stats.inactive}</div>
          <div className="text-sm text-[var(--text-muted)]">Inactive</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-orange)]">{stats.issues}</div>
          <div className="text-sm text-[var(--text-muted)]">Issues</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-red)]">{stats.advisorErrors}</div>
          <div className="text-sm text-[var(--text-muted)]">Errors</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-orange)]">{stats.advisorWarnings}</div>
          <div className="text-sm text-[var(--text-muted)]">Warnings</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">{stats.advisorInfo}</div>
          <div className="text-sm text-[var(--text-muted)]">Info</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Status ({stats.total})</option>
            <option value="healthy">Healthy ({stats.healthy})</option>
            <option value="inactive">Inactive ({stats.inactive})</option>
            <option value="issues">Issues ({stats.issues})</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="text-sm text-[var(--text-muted)]">
        Showing {filteredRepos.length} of {supabaseRepos.length} projects
      </div>

      {/* Projects List */}
      {filteredRepos.length === 0 ? (
        <div className="card text-center py-12">
          <SupabaseLogo className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)]">
            {supabaseRepos.length === 0
              ? 'No Supabase projects found'
              : 'No projects match your filters'}
          </p>
          {supabaseRepos.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Projects are matched by repo name. Make sure your Supabase project names match your GitHub repo names.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRepos.map((repo) => {
            const advisors = repo.supabase?.advisors;
            const totalAdvisors = (advisors?.performance?.length || 0) + (advisors?.security?.length || 0);
            const isExpanded = expandedProjects.has(repo.supabase?.projectId || '');

            return (
              <div key={repo.id} className="card !p-4">
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
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287ZM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
                          </svg>
                          {totalAdvisors} advisor{totalAdvisors !== 1 ? 's' : ''}
                          <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Region: {repo.supabase?.region}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
                        </svg>
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
                              <svg className="w-4 h-4 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Zm.61 1.429a.25.25 0 0 0-.153 0l-5.25 1.68a.25.25 0 0 0-.174.238V7c0 1.358.275 2.666 1.057 3.86.784 1.194 2.121 2.34 4.366 3.297a.196.196 0 0 0 .154 0c2.245-.956 3.582-2.104 4.366-3.298C13.225 9.666 13.5 8.36 13.5 7V3.48a.251.251 0 0 0-.174-.237l-5.25-1.68Z"/>
                              </svg>
                              Security ({advisors.security.length})
                            </h4>
                            <div className="space-y-2">
                              {advisors.security.map((lint, i) => (
                                <div key={i} className="text-sm p-2 rounded bg-[var(--background)] border border-[var(--card-border)]">
                                  <div className="flex items-start gap-2">
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getLevelColor(lint.level)}`}>
                                      {lint.level}
                                    </span>
                                    <div className="flex-1">
                                      <div className="font-medium">{lint.title}</div>
                                      <div className="text-[var(--text-muted)] text-xs mt-1">{lint.detail}</div>
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
                              <svg className="w-4 h-4 text-[var(--accent)]" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
                              </svg>
                              Performance ({advisors.performance.length})
                            </h4>
                            <div className="space-y-2">
                              {advisors.performance.map((lint, i) => (
                                <div key={i} className="text-sm p-2 rounded bg-[var(--background)] border border-[var(--card-border)]">
                                  <div className="flex items-start gap-2">
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getLevelColor(lint.level)}`}>
                                      {lint.level}
                                    </span>
                                    <div className="flex-1">
                                      <div className="font-medium">{lint.title}</div>
                                      <div className="text-[var(--text-muted)] text-xs mt-1">{lint.detail}</div>
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
                    <a
                      href={`https://supabase.com/dashboard/project/${repo.supabase?.projectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-md hover:bg-[var(--card-border)] flex items-center gap-1"
                    >
                      <SupabaseLogo className="w-4 h-4" />
                      Dashboard
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
