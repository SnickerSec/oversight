'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { RepoWithDetails } from '@/lib/github';
import { getRailwayStatusColor, getRailwayStatusLabel, getRailwayStatusBgColor } from '@/lib/railway';
import { timeAgo } from '@/lib/utils';

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
  hasRailwayToken: boolean;
}

type StatusFilter = 'all' | 'success' | 'failed' | 'deploying';

async function fetchData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

function RailwayLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 12" fill="currentColor">
      <path d="M0.5 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0z"/>
    </svg>
  );
}

export default function RailwayPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const { data, error, isLoading } = useSWR<DashboardData>('railway', fetchData, {
    refreshInterval: 300000, // 5 minutes to avoid Railway API rate limits
  });

  const repos = data?.repos || [];
  const hasRailwayToken = data?.hasRailwayToken ?? false;

  // Get repos with Railway deployments
  const railwayRepos = useMemo(() => {
    return repos.filter(repo => repo.railway);
  }, [repos]);

  // Filter repos
  const filteredRepos = useMemo(() => {
    let result = railwayRepos;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(repo => {
        const status = repo.railway?.deploymentStatus?.toUpperCase();
        switch (statusFilter) {
          case 'success':
            return status === 'SUCCESS';
          case 'failed':
            return status === 'FAILED' || status === 'CRASHED';
          case 'deploying':
            return status === 'DEPLOYING' || status === 'BUILDING' || status === 'INITIALIZING';
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
        repo.railway?.projectName.toLowerCase().includes(searchLower) ||
        repo.railway?.serviceName.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [railwayRepos, statusFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: railwayRepos.length,
    live: railwayRepos.filter(r => r.railway?.deploymentStatus?.toUpperCase() === 'SUCCESS').length,
    failed: railwayRepos.filter(r => ['FAILED', 'CRASHED'].includes(r.railway?.deploymentStatus?.toUpperCase() || '')).length,
    deploying: railwayRepos.filter(r => ['DEPLOYING', 'BUILDING', 'INITIALIZING'].includes(r.railway?.deploymentStatus?.toUpperCase() || '')).length,
  }), [railwayRepos]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <RailwayLogo className="w-7 h-7" />
          Railway Deployments
        </h1>
        <div className="card text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load Railway data</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <RailwayLogo className="w-7 h-7" />
          Railway Deployments
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

  if (!hasRailwayToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <RailwayLogo className="w-7 h-7" />
          Railway Deployments
        </h1>
        <div className="card text-center py-12">
          <RailwayLogo className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h2 className="text-xl font-semibold mb-2">Railway Token Required</h2>
          <p className="text-[var(--text-muted)] mb-4">Connect your Railway account to see deployments</p>
          <p className="text-sm text-[var(--text-muted)]">
            Add <code className="bg-[var(--card-border)] px-1 rounded">RAILWAY_TOKEN</code> to <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Create a token at <a href="https://railway.app/account/tokens" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">railway.app/account/tokens</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <RailwayLogo className="w-7 h-7" />
          Railway Deployments
        </h1>
        <a
          href="https://railway.app/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
        >
          Open Railway Dashboard
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm text-[var(--text-muted)]">Total Projects</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-green)]">{stats.live}</div>
          <div className="text-sm text-[var(--text-muted)]">Live</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-red)]">{stats.failed}</div>
          <div className="text-sm text-[var(--text-muted)]">Failed</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-orange)]">{stats.deploying}</div>
          <div className="text-sm text-[var(--text-muted)]">Deploying</div>
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
            <option value="success">Live ({stats.live})</option>
            <option value="failed">Failed ({stats.failed})</option>
            <option value="deploying">Deploying ({stats.deploying})</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="text-sm text-[var(--text-muted)]">
        Showing {filteredRepos.length} of {railwayRepos.length} deployments
      </div>

      {/* Deployments List */}
      {filteredRepos.length === 0 ? (
        <div className="card text-center py-12">
          <RailwayLogo className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)]">
            {railwayRepos.length === 0
              ? 'No Railway deployments found'
              : 'No deployments match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRepos.map((repo) => (
            <div key={repo.id} className="card !p-4">
              <div className="flex items-start gap-4">
                {/* Status Indicator */}
                <div className={`w-3 h-3 rounded-full mt-1.5 ${getRailwayStatusBgColor(repo.railway?.deploymentStatus)}`} />

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{repo.railway?.projectName}</h3>
                    <span className={`text-sm ${getRailwayStatusColor(repo.railway?.deploymentStatus)}`}>
                      {getRailwayStatusLabel(repo.railway?.deploymentStatus)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
                      </svg>
                      Service: {repo.railway?.serviceName}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
                      </svg>
                      <Link href={repo.html_url} target="_blank" className="text-[var(--accent)] hover:underline">
                        {repo.name}
                      </Link>
                    </span>
                    <span>Env: {repo.railway?.environmentName}</span>
                    {repo.railway?.lastDeployedAt && (
                      <span>Deployed: {timeAgo(repo.railway.lastDeployedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {repo.railway?.deploymentUrl && (
                    <a
                      href={`https://${repo.railway.deploymentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm bg-[var(--accent-green)] text-white rounded-md hover:opacity-90 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Visit
                    </a>
                  )}
                  <a
                    href={`https://railway.app/project/${repo.railway?.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-md hover:bg-[var(--card-border)] flex items-center gap-1"
                  >
                    <RailwayLogo className="w-4 h-4" />
                    Railway
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
