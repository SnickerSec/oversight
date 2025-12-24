'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { RepoWithDetails } from '@/lib/github';
import { timeAgo, getSeverityColor, getSeverityOrder, normalizeSeverity } from '@/lib/utils';

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
}

type Severity = 'all' | 'critical' | 'high' | 'medium' | 'low';

interface UnifiedAlert {
  id: string;
  type: 'dependabot' | 'code-scanning' | 'secret-scanning';
  repoName: string;
  severity: string;
  title: string;
  description: string;
  package?: string;
  path?: string;
  tool?: string;
  cveId?: string | null;
  secretType?: string;
  createdAt: string;
  htmlUrl: string;
}

async function fetchData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'dependabot':
      return (
        <svg className="w-4 h-4 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
        </svg>
      );
    case 'code-scanning':
      return (
        <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
        </svg>
      );
    case 'secret-scanning':
      return (
        <svg className="w-4 h-4 text-[var(--accent-red)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M4 4a4 4 0 1 1 2.5 3.7L2.8 12.4a.5.5 0 0 1-.8-.4V9.8a.5.5 0 0 1 .1-.3l3-3A4 4 0 0 1 4 4Zm4-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
        </svg>
      );
  }
}

export default function SecurityPage() {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<Severity>('all');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'date' | 'repo'>('severity');

  const { data, error, isLoading } = useSWR<DashboardData>('security', fetchData, {
    refreshInterval: 60000,
  });

  const repos = data?.repos || [];
  const hasToken = data?.hasToken ?? false;

  // Get unique repo names that have alerts
  const repoNames = useMemo(() => {
    const names = new Set<string>();
    repos.forEach(repo => {
      if (repo.securityAlerts?.dependabot?.length > 0 ||
          repo.securityAlerts?.codeScanning?.length > 0 ||
          repo.securityAlerts?.secretScanning?.length > 0) {
        names.add(repo.name);
      }
    });
    return Array.from(names).sort();
  }, [repos]);

  // Unify all alerts into a single list
  const allAlerts = useMemo((): UnifiedAlert[] => {
    const alerts: UnifiedAlert[] = [];

    repos.forEach(repo => {
      repo.securityAlerts?.dependabot?.forEach(alert => {
        alerts.push({
          id: `dep-${repo.name}-${alert.number}`,
          type: 'dependabot',
          repoName: repo.name,
          severity: normalizeSeverity(alert.security_advisory?.severity),
          title: alert.security_advisory?.summary || 'Security vulnerability',
          description: alert.security_advisory?.description || '',
          package: alert.security_vulnerability?.package?.name,
          cveId: alert.security_advisory?.cve_id,
          createdAt: alert.created_at,
          htmlUrl: alert.html_url,
        });
      });

      repo.securityAlerts?.codeScanning?.forEach(alert => {
        alerts.push({
          id: `code-${repo.name}-${alert.number}`,
          type: 'code-scanning',
          repoName: repo.name,
          severity: normalizeSeverity(alert.rule?.severity),
          title: alert.rule?.description || alert.rule?.name || 'Code issue',
          description: '',
          path: alert.most_recent_instance?.location?.path,
          tool: alert.tool?.name,
          createdAt: alert.created_at,
          htmlUrl: alert.html_url,
        });
      });

      repo.securityAlerts?.secretScanning?.forEach(alert => {
        alerts.push({
          id: `secret-${repo.name}-${alert.number}`,
          type: 'secret-scanning',
          repoName: repo.name,
          severity: 'critical',
          title: alert.secret_type_display_name || alert.secret_type,
          description: '',
          secretType: alert.secret_type,
          createdAt: alert.created_at,
          htmlUrl: alert.html_url,
        });
      });
    });

    return alerts;
  }, [repos]);

  // Filter and sort function for both alert types
  const filterAndSort = (alerts: UnifiedAlert[]) => {
    let result = alerts;

    // Filter by severity
    if (severity !== 'all') {
      result = result.filter(a => a.severity.toLowerCase() === severity);
    }

    // Filter by repo
    if (selectedRepo !== 'all') {
      result = result.filter(a => a.repoName === selectedRepo);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(searchLower) ||
        a.repoName.toLowerCase().includes(searchLower) ||
        a.package?.toLowerCase().includes(searchLower) ||
        a.path?.toLowerCase().includes(searchLower) ||
        a.cveId?.toLowerCase().includes(searchLower) ||
        a.secretType?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          return getSeverityOrder(a.severity) - getSeverityOrder(b.severity);
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'repo':
          return a.repoName.localeCompare(b.repoName);
        default:
          return 0;
      }
    });

    return result;
  };

  // Separate filtered lists for Dependabot and Code Scanning
  const dependabotAlerts = useMemo(() =>
    filterAndSort(allAlerts.filter(a => a.type === 'dependabot')),
    [allAlerts, severity, selectedRepo, search, sortBy]
  );

  const codeScanningAlerts = useMemo(() =>
    filterAndSort(allAlerts.filter(a => a.type === 'code-scanning')),
    [allAlerts, severity, selectedRepo, search, sortBy]
  );

  // Count by severity
  const severityCounts = useMemo(() => ({
    critical: allAlerts.filter(a => a.severity.toLowerCase() === 'critical').length,
    high: allAlerts.filter(a => a.severity.toLowerCase() === 'high').length,
    medium: allAlerts.filter(a => a.severity.toLowerCase() === 'medium').length,
    low: allAlerts.filter(a => a.severity.toLowerCase() === 'low').length,
  }), [allAlerts]);

  // Count by type
  const typeCounts = useMemo(() => ({
    dependabot: allAlerts.filter(a => a.type === 'dependabot').length,
    codeScanning: allAlerts.filter(a => a.type === 'code-scanning').length,
    secretScanning: allAlerts.filter(a => a.type === 'secret-scanning').length,
  }), [allAlerts]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <div className="card text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load security data</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <div className="card animate-pulse">
          <div className="h-10 bg-[var(--card-border)] rounded mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-[var(--card-border)] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <div className="card text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4 4a4 4 0 1 1 2.5 3.7L2.8 12.4a.5.5 0 0 1-.8-.4V9.8a.5.5 0 0 1 .1-.3l3-3A4 4 0 0 1 4 4Zm4-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
          </svg>
          <h2 className="text-xl font-semibold mb-2">GitHub Token Required</h2>
          <p className="text-[var(--text-muted)] mb-4">Security alerts require authentication</p>
          <p className="text-sm text-[var(--text-muted)]">
            Add <code className="bg-[var(--card-border)] px-1 rounded">GITHUB_TOKEN</code> to <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <div className="flex items-center gap-3 text-sm">
          {severityCounts.critical > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#f85149]" />
              {severityCounts.critical} Critical
            </span>
          )}
          {severityCounts.high > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#db6d28]" />
              {severityCounts.high} High
            </span>
          )}
          {severityCounts.medium > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#d29922]" />
              {severityCounts.medium} Medium
            </span>
          )}
          {severityCounts.low > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#8b949e]" />
              {severityCounts.low} Low
            </span>
          )}
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
                placeholder="Search alerts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Severity Filter */}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical ({severityCounts.critical})</option>
            <option value="high">High ({severityCounts.high})</option>
            <option value="medium">Medium ({severityCounts.medium})</option>
            <option value="low">Low ({severityCounts.low})</option>
          </select>

          {/* Repo Filter */}
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Repositories</option>
            {repoNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'severity' | 'date' | 'repo')}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="severity">Sort by Severity</option>
            <option value="date">Sort by Date</option>
            <option value="repo">Sort by Repository</option>
          </select>
        </div>
      </div>

      {/* Two Column Layout for Dependabot and Code Scanning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dependabot Alerts Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
              </svg>
              Dependabot
              <span className="badge bg-[var(--accent-orange)] text-white">{dependabotAlerts.length}</span>
            </h2>
          </div>

          {dependabotAlerts.length === 0 ? (
            <div className="card text-center py-8">
              <svg className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
              <p className="text-sm text-[var(--accent-green)] font-medium">No Dependabot alerts</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {search || severity !== 'all' || selectedRepo !== 'all'
                  ? 'Try adjusting your filters'
                  : 'All dependencies are secure'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dependabotAlerts.map((alert) => (
                <a
                  key={alert.id}
                  href={alert.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card !p-3 flex items-start gap-3 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className={`badge shrink-0 text-xs ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <h3 className="font-medium text-sm leading-tight">{alert.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
                      <span className="text-[var(--accent)]">{alert.repoName}</span>
                      {alert.package && (
                        <>
                          <span>·</span>
                          <span>{alert.package}</span>
                        </>
                      )}
                      {alert.cveId && (
                        <>
                          <span>·</span>
                          <span>{alert.cveId}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{timeAgo(alert.createdAt)}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Code Scanning Alerts Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
              </svg>
              Code Scanning
              <span className="badge bg-[var(--accent-purple)] text-white">{codeScanningAlerts.length}</span>
            </h2>
          </div>

          {codeScanningAlerts.length === 0 ? (
            <div className="card text-center py-8">
              <svg className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
              <p className="text-sm text-[var(--accent-green)] font-medium">No code scanning alerts</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {search || severity !== 'all' || selectedRepo !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No code issues detected'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {codeScanningAlerts.map((alert) => (
                <a
                  key={alert.id}
                  href={alert.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card !p-3 flex items-start gap-3 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className={`badge shrink-0 text-xs ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <h3 className="font-medium text-sm leading-tight">{alert.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
                      <span className="text-[var(--accent)]">{alert.repoName}</span>
                      {alert.path && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px]">{alert.path}</span>
                        </>
                      )}
                      {alert.tool && (
                        <>
                          <span>·</span>
                          <span>{alert.tool}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{timeAgo(alert.createdAt)}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
