'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { RepoWithDetails } from '@/lib/github';
import { timeAgo, getSeverityColor, getSeverityOrder, normalizeSeverity } from '@/lib/utils';
import { ScanJob } from '@/lib/scanner/types';
import { ScanButton } from '@/app/components/ScanButton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Filter, ChevronDown, ChevronUp, Copy, Check, AlertTriangle, Zap, KeyRound, CheckCircle2, ExternalLink } from 'lucide-react';

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
}

type Severity = 'all' | 'critical' | 'high' | 'medium' | 'low';
type Source = 'all' | 'github' | 'local';

interface UnifiedAlert {
  id: string;
  type: 'dependabot' | 'code-scanning' | 'secret-scanning' | 'trivy' | 'gitleaks' | 'semgrep';
  source: 'github' | 'local';
  repoName: string;
  severity: string;
  title: string;
  description: string;
  package?: string;
  path?: string;
  line?: number;
  tool?: string;
  cveId?: string | null;
  secretType?: string;
  createdAt: string;
  htmlUrl?: string;
}

async function fetchData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'dependabot':
    case 'trivy':
      return <AlertTriangle className="w-4 h-4 text-[var(--accent-orange)]" />;
    case 'code-scanning':
    case 'semgrep':
      return <Zap className="w-4 h-4 text-[var(--accent-purple)]" />;
    case 'secret-scanning':
    case 'gitleaks':
      return <KeyRound className="w-4 h-4 text-[var(--accent-red)]" />;
  }
}

export default function SecurityPage() {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<Severity>('all');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'date' | 'repo'>('severity');
  const [sourceFilter, setSourceFilter] = useState<Source>('all');

  // Scanning state
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [scanJobs, setScanJobs] = useState<Record<string, ScanJob>>({});
  const [pollIntervals, setPollIntervals] = useState<Record<string, NodeJS.Timeout>>({});

  const { data, error, isLoading, mutate } = useSWR<DashboardData>('dashboard', fetchData, {
    refreshInterval: 300000,
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const repos = data?.repos || [];
  const hasToken = data?.hasToken ?? false;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollIntervals).forEach(clearInterval);
    };
  }, [pollIntervals]);

  // Poll scan status
  const pollScanStatus = useCallback((scanId: string, repoName: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/security/scan?id=${scanId}`);
        if (response.ok) {
          const job: ScanJob = await response.json();
          setScanJobs(prev => ({ ...prev, [repoName]: job }));

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval);
            setPollIntervals(prev => {
              const newIntervals = { ...prev };
              delete newIntervals[repoName];
              return newIntervals;
            });
            setScanning(prev => ({ ...prev, [repoName]: false }));
          }
        }
      } catch (err) {
        console.error('Failed to poll scan status:', err);
      }
    }, 5000);

    setPollIntervals(prev => ({ ...prev, [repoName]: interval }));
  }, []);

  // Load previous scan results on mount
  useEffect(() => {
    async function loadPreviousScans() {
      try {
        const response = await fetch('/api/security/scan');
        if (response.ok) {
          const data = await response.json();
          if (data.scans && Array.isArray(data.scans)) {
            const jobsMap: Record<string, ScanJob> = {};
            const inProgressScans: { id: string; repoName: string }[] = [];

            data.scans.forEach((scan: ScanJob) => {
              // Only keep the most recent scan per repo
              if (!jobsMap[scan.repoName] ||
                  new Date(scan.startedAt) > new Date(jobsMap[scan.repoName].startedAt)) {
                jobsMap[scan.repoName] = scan;
              }
            });

            // Find any in-progress scans to resume polling
            Object.values(jobsMap).forEach((scan) => {
              if (['pending', 'cloning', 'scanning'].includes(scan.status)) {
                inProgressScans.push({ id: scan.id, repoName: scan.repoName });
              }
            });

            setScanJobs(jobsMap);

            // Resume polling for in-progress scans
            inProgressScans.forEach(({ id, repoName }) => {
              setScanning(prev => ({ ...prev, [repoName]: true }));
              pollScanStatus(id, repoName);
            });
          }
        }
      } catch (err) {
        console.error('Failed to load previous scans:', err);
      }
    }
    loadPreviousScans();
  }, [pollScanStatus]);

  // Trigger a scan
  const handleScan = useCallback(async (repoName: string) => {
    setScanning(prev => ({ ...prev, [repoName]: true }));

    try {
      const response = await fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName }),
      });

      if (response.ok) {
        const { scanId } = await response.json();
        setScanJobs(prev => ({
          ...prev,
          [repoName]: {
            id: scanId,
            repoName,
            repoFullName: `SnickerSec/${repoName}`,
            status: 'pending',
            startedAt: new Date().toISOString(),
            tools: ['trivy', 'gitleaks', 'semgrep'],
          }
        }));
        pollScanStatus(scanId, repoName);
      } else {
        const data = await response.json();
        console.error('Scan failed:', data.error);
        setScanning(prev => ({ ...prev, [repoName]: false }));
      }
    } catch (err) {
      console.error('Failed to start scan:', err);
      setScanning(prev => ({ ...prev, [repoName]: false }));
    }
  }, [pollScanStatus]);

  // Get unique repo names
  const repoNames = useMemo(() => {
    const names = new Set<string>();
    repos.forEach(repo => names.add(repo.name));
    return Array.from(names).sort();
  }, [repos]);

  // Convert local scan results to unified alerts
  const localScanAlerts = useMemo((): UnifiedAlert[] => {
    const alerts: UnifiedAlert[] = [];

    Object.entries(scanJobs).forEach(([repoName, job]) => {
      if (job.status !== 'completed' || !job.results) return;

      // Trivy vulnerabilities
      job.results.trivy?.vulnerabilities.forEach((vuln, idx) => {
        alerts.push({
          id: `trivy-${repoName}-${vuln.id}-${idx}`,
          type: 'trivy',
          source: 'local',
          repoName,
          severity: vuln.severity,
          title: vuln.title,
          description: vuln.description,
          package: vuln.pkgName,
          cveId: vuln.id,
          createdAt: job.completedAt || job.startedAt,
          htmlUrl: vuln.primaryUrl,
        });
      });

      // Gitleaks secrets
      job.results.gitleaks?.secrets.forEach((secret, idx) => {
        alerts.push({
          id: `gitleaks-${repoName}-${secret.file}-${secret.startLine}-${idx}`,
          type: 'gitleaks',
          source: 'local',
          repoName,
          severity: 'critical',
          title: secret.description,
          description: `Found: ${secret.match}`,
          path: secret.file,
          line: secret.startLine,
          secretType: secret.ruleId,
          createdAt: job.completedAt || job.startedAt,
        });
      });

      // Semgrep findings
      job.results.semgrep?.findings.forEach((finding, idx) => {
        alerts.push({
          id: `semgrep-${repoName}-${finding.path}-${finding.startLine}-${idx}`,
          type: 'semgrep',
          source: 'local',
          repoName,
          severity: finding.severity,
          title: finding.message,
          description: `Rule: ${finding.ruleId}`,
          path: finding.path,
          line: finding.startLine,
          tool: 'Semgrep',
          createdAt: job.completedAt || job.startedAt,
        });
      });
    });

    return alerts;
  }, [scanJobs]);

  // Unify all alerts (GitHub + local scans)
  const allAlerts = useMemo((): UnifiedAlert[] => {
    const alerts: UnifiedAlert[] = [];

    // GitHub alerts
    repos.forEach(repo => {
      repo.securityAlerts?.dependabot?.forEach(alert => {
        alerts.push({
          id: `dep-${repo.name}-${alert.number}`,
          type: 'dependabot',
          source: 'github',
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
          source: 'github',
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
          source: 'github',
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

    // Add local scan alerts
    alerts.push(...localScanAlerts);

    return alerts;
  }, [repos, localScanAlerts]);

  // Filter and sort
  const filterAndSort = useCallback((alerts: UnifiedAlert[]) => {
    let result = alerts;

    // Filter by source
    if (sourceFilter !== 'all') {
      result = result.filter(a => a.source === sourceFilter);
    }

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
  }, [sourceFilter, severity, selectedRepo, search, sortBy]);

  // Filtered alert lists by category
  const dependencyAlerts = useMemo(() =>
    filterAndSort(allAlerts.filter(a => a.type === 'dependabot' || a.type === 'trivy')),
    [allAlerts, filterAndSort]
  );

  const codeAlerts = useMemo(() =>
    filterAndSort(allAlerts.filter(a => a.type === 'code-scanning' || a.type === 'semgrep')),
    [allAlerts, filterAndSort]
  );

  const secretAlerts = useMemo(() =>
    filterAndSort(allAlerts.filter(a => a.type === 'secret-scanning' || a.type === 'gitleaks')),
    [allAlerts, filterAndSort]
  );

  // Counts
  const severityCounts = useMemo(() => ({
    critical: allAlerts.filter(a => a.severity.toLowerCase() === 'critical').length,
    high: allAlerts.filter(a => a.severity.toLowerCase() === 'high').length,
    medium: allAlerts.filter(a => a.severity.toLowerCase() === 'medium').length,
    low: allAlerts.filter(a => a.severity.toLowerCase() === 'low').length,
  }), [allAlerts]);

  const sourceCounts = useMemo(() => ({
    github: allAlerts.filter(a => a.source === 'github').length,
    local: allAlerts.filter(a => a.source === 'local').length,
  }), [allAlerts]);

  // Per-repo alert counts
  const repoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allAlerts.forEach(a => {
      counts[a.repoName] = (counts[a.repoName] || 0) + 1;
    });
    return counts;
  }, [allAlerts]);

  // Mobile filter panel toggle
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Copy to clipboard state
  const [copiedColumn, setCopiedColumn] = useState<string | null>(null);

  const copyAlerts = useCallback((alerts: UnifiedAlert[], columnName: string) => {
    const text = alerts.map(a => {
      const parts = [`[${a.severity.toUpperCase()}] ${a.title}`];
      parts.push(`  Repo: ${a.repoName}`);
      if (a.package) parts.push(`  Package: ${a.package}`);
      if (a.path) parts.push(`  Path: ${a.path}${a.line ? `:${a.line}` : ''}`);
      if (a.cveId) parts.push(`  CVE: ${a.cveId}`);
      if (a.secretType) parts.push(`  Type: ${a.secretType}`);
      if (a.tool) parts.push(`  Tool: ${a.tool}`);
      if (a.htmlUrl) parts.push(`  URL: ${a.htmlUrl}`);
      return parts.join('\n');
    }).join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedColumn(columnName);
    setTimeout(() => setCopiedColumn(null), 2000);
  }, []);

  const hasActiveFilters = search !== '' || severity !== 'all' || selectedRepo !== 'all' || sourceFilter !== 'all' || sortBy !== 'severity';

  const clearAllFilters = () => {
    setSearch('');
    setSeverity('all');
    setSelectedRepo('all');
    setSourceFilter('all');
    setSortBy('severity');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <Card className="p-4 text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load security data</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <Card className="p-4">
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <Card className="p-4 text-center py-12">
          <KeyRound className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">GitHub Token Required</h2>
          <p className="text-muted-foreground mb-4">Security alerts require authentication</p>
        </Card>
      </div>
    );
  }

  const filterSidebar = (
    <div className="space-y-5">
      {/* Search */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Source Filter */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</label>
        <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as Source)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources ({sourceCounts.github + sourceCounts.local})</SelectItem>
            <SelectItem value="github">GitHub ({sourceCounts.github})</SelectItem>
            <SelectItem value="local">Local Scans ({sourceCounts.local})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Severity Filter */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity</label>
        <Select value={severity} onValueChange={(value) => setSeverity(value as Severity)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical ({severityCounts.critical})</SelectItem>
            <SelectItem value="high">High ({severityCounts.high})</SelectItem>
            <SelectItem value="medium">Medium ({severityCounts.medium})</SelectItem>
            <SelectItem value="low">Low ({severityCounts.low})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sort by</label>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'severity' | 'date' | 'repo')}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="severity">Severity</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="repo">Repository</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full text-muted-foreground">
          <X className="w-3 h-3 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <div className="flex items-center gap-3 text-sm flex-wrap">
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

      {/* Sidebar + Main Content */}
      <div className="flex gap-6">
        {/* Left Sidebar - Filters (desktop) */}
        <aside className="hidden lg:block w-[220px] shrink-0">
          <div className="sticky top-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Filters</span>
              </div>
              {filterSidebar}
            </Card>

          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Mobile Filters Toggle */}
          <div className="lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <Badge className="rounded-full bg-[var(--accent)] text-white text-xs px-1.5 py-0">
                    !
                  </Badge>
                )}
              </span>
              {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {filtersOpen && (
              <div className="space-y-2 mt-2">
                <Card className="p-4">
                  {filterSidebar}
                </Card>
              </div>
            )}
          </div>

          {/* Repo Filter Buttons */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedRepo === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRepo('all')}
                className="gap-1.5"
              >
                All
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-xs ml-0.5">
                  {allAlerts.length}
                </Badge>
              </Button>
              {repoNames.map(name => (
                <Button
                  key={name}
                  variant={selectedRepo === name ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRepo(name)}
                  className="gap-1.5"
                >
                  {name}
                  <Badge
                    variant="secondary"
                    className={`rounded-full px-1.5 py-0 text-xs ml-0.5 ${
                      (repoCounts[name] || 0) > 0 ? 'bg-[var(--accent-red)]/20 text-[var(--accent-red)]' : ''
                    }`}
                  >
                    {repoCounts[name] || 0}
                  </Badge>
                </Button>
              ))}
            </div>

            {/* Contextual Scan Panel - shown when a repo is selected */}
            {selectedRepo !== 'all' && (
              <Card className="p-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ScanButton
                      repoName={selectedRepo}
                      scanning={scanning[selectedRepo] || false}
                      progress={scanJobs[selectedRepo]}
                      onScan={handleScan}
                    />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-[var(--accent-orange)]" />
                        Trivy
                      </span>
                      <span className="flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-[var(--accent-red)]" />
                        Gitleaks
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-[var(--accent-purple)]" />
                        Semgrep
                      </span>
                    </div>
                  </div>

                  {/* Scan results for this repo */}
                  {scanJobs[selectedRepo]?.status === 'completed' && scanJobs[selectedRepo]?.results && (
                    <div className="flex items-center gap-3 text-xs">
                      {(() => {
                        const job = scanJobs[selectedRepo];
                        const trivyError = job.results?.toolErrors?.trivy;
                        const vulns = job.results?.trivy?.vulnerabilities || [];
                        if (trivyError) return <span className="text-[var(--accent-red)]" title={trivyError}>Trivy failed</span>;
                        return vulns.length > 0
                          ? <span className="text-[var(--accent-red)]">{vulns.length} vuln{vulns.length !== 1 ? 's' : ''}</span>
                          : <span className="text-[var(--accent-green)]">Deps clean</span>;
                      })()}
                      <span className="text-border">|</span>
                      {(() => {
                        const job = scanJobs[selectedRepo];
                        const gitleaksError = job.results?.toolErrors?.gitleaks;
                        const secrets = job.results?.gitleaks?.secrets || [];
                        if (gitleaksError) return <span className="text-[var(--accent-red)]" title={gitleaksError}>Gitleaks failed</span>;
                        return secrets.length > 0
                          ? <span className="text-[var(--accent-red)]">{secrets.length} secret{secrets.length !== 1 ? 's' : ''}</span>
                          : <span className="text-[var(--accent-green)]">No secrets</span>;
                      })()}
                      <span className="text-border">|</span>
                      {(() => {
                        const job = scanJobs[selectedRepo];
                        const semgrepError = job.results?.toolErrors?.semgrep;
                        const findings = job.results?.semgrep?.findings || [];
                        if (semgrepError) return <span className="text-[var(--accent-red)]" title={semgrepError}>Semgrep failed</span>;
                        return findings.length > 0
                          ? <span className="text-[var(--accent-red)]">{findings.length} finding{findings.length !== 1 ? 's' : ''}</span>
                          : <span className="text-[var(--accent-green)]">Code clean</span>;
                      })()}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Three Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dependency Alerts Column */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--accent-orange)]" />
                Dependencies
                <Badge className="rounded-full bg-[var(--accent-orange)] text-white">{dependencyAlerts.length}</Badge>
                {dependencyAlerts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto text-muted-foreground"
                    title="Copy all dependency alerts"
                    onClick={() => copyAlerts(dependencyAlerts, 'dependencies')}
                  >
                    {copiedColumn === 'dependencies' ? <Check className="w-3.5 h-3.5 text-[var(--accent-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                )}
              </h2>

              {dependencyAlerts.length === 0 ? (
                <Card className="p-4 text-center py-8">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" />
                  <p className="text-sm text-[var(--accent-green)] font-medium">No dependency alerts</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {dependencyAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>

            {/* Code Scanning Alerts Column */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-[var(--accent-purple)]" />
                Code Analysis
                <Badge className="rounded-full bg-[var(--accent-purple)] text-white">{codeAlerts.length}</Badge>
                {codeAlerts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto text-muted-foreground"
                    title="Copy all code analysis alerts"
                    onClick={() => copyAlerts(codeAlerts, 'code')}
                  >
                    {copiedColumn === 'code' ? <Check className="w-3.5 h-3.5 text-[var(--accent-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                )}
              </h2>

              {codeAlerts.length === 0 ? (
                <Card className="p-4 text-center py-8">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" />
                  <p className="text-sm text-[var(--accent-green)] font-medium">No code issues</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {codeAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>

            {/* Secret Scanning Alerts Column */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[var(--accent-red)]" />
                Secrets
                <Badge className="rounded-full bg-[var(--accent-red)] text-white">{secretAlerts.length}</Badge>
                {secretAlerts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto text-muted-foreground"
                    title="Copy all secret alerts"
                    onClick={() => copyAlerts(secretAlerts, 'secrets')}
                  >
                    {copiedColumn === 'secrets' ? <Check className="w-3.5 h-3.5 text-[var(--accent-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                )}
              </h2>

              {secretAlerts.length === 0 ? (
                <Card className="p-4 text-center py-8">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" />
                  <p className="text-sm text-[var(--accent-green)] font-medium">No secrets detected</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {secretAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Alert Card Component
function AlertCard({ alert }: { alert: UnifiedAlert }) {
  const isLocal = alert.source === 'local';

  const content = (
    <Card className="p-3 hover:border-[var(--accent)] transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <Badge className={`rounded-full shrink-0 text-xs ${getSeverityColor(alert.severity)}`}>
              {alert.severity}
            </Badge>
            {isLocal && (
              <Badge className="rounded-full shrink-0 text-xs bg-[var(--accent)] text-white">
                {alert.type}
              </Badge>
            )}
            <h3 className="font-medium text-sm leading-tight break-words">{alert.title}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="text-[var(--accent)]">{alert.repoName}</span>
            {alert.package && (
              <>
                <span>·</span>
                <span>{alert.package}</span>
              </>
            )}
            {alert.path && (
              <>
                <span>·</span>
                <span className="truncate max-w-[150px]">
                  {alert.path}{alert.line ? `:${alert.line}` : ''}
                </span>
              </>
            )}
            {alert.cveId && (
              <>
                <span>·</span>
                <span>{alert.cveId}</span>
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
        {alert.htmlUrl && (
          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>
    </Card>
  );

  if (alert.htmlUrl) {
    return (
      <a href={alert.htmlUrl} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }
  return content;
}
