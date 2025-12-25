'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { RepoWithDetails } from '@/lib/github';
import { timeAgo, getSeverityColor, getSeverityOrder, normalizeSeverity } from '@/lib/utils';
import { ScanJob } from '@/lib/scanner/types';
import { ScanButton } from '@/app/components/ScanButton';

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
      return (
        <svg className="w-4 h-4 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
        </svg>
      );
    case 'code-scanning':
    case 'semgrep':
      return (
        <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
        </svg>
      );
    case 'secret-scanning':
    case 'gitleaks':
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
  const [sourceFilter, setSourceFilter] = useState<Source>('all');
  const [scanRepoSelection, setScanRepoSelection] = useState<string>('');

  // Scanning state
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [scanJobs, setScanJobs] = useState<Record<string, ScanJob>>({});
  const [pollIntervals, setPollIntervals] = useState<Record<string, NodeJS.Timeout>>({});

  const { data, error, isLoading, mutate } = useSWR<DashboardData>('security', fetchData, {
    refreshInterval: 60000,
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
    }, 2000);

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

  // Scan summary
  const scanSummary = useMemo(() => {
    const completedScans = Object.values(scanJobs).filter(j => j.status === 'completed');
    return {
      total: completedScans.length,
      trivy: completedScans.reduce((sum, j) => sum + (j.results?.trivy?.vulnerabilities.length || 0), 0),
      gitleaks: completedScans.reduce((sum, j) => sum + (j.results?.gitleaks?.secrets.length || 0), 0),
      semgrep: completedScans.reduce((sum, j) => sum + (j.results?.semgrep?.findings.length || 0), 0),
    };
  }, [scanJobs]);

  // Get the most recently completed scan for display
  const latestCompletedScan = useMemo(() => {
    const completed = Object.values(scanJobs)
      .filter(j => j.status === 'completed' && j.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
    return completed[0] || null;
  }, [scanJobs]);

  // Track dismissed scan summaries
  const [dismissedScanId, setDismissedScanId] = useState<string | null>(null);

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
        </div>
      </div>
    );
  }

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

      {/* Scan Controls */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Local Security Scanning
          </h2>
          {scanSummary.total > 0 && (
            <div className="text-xs text-[var(--text-muted)]">
              {scanSummary.total} scan{scanSummary.total !== 1 ? 's' : ''} completed
              {scanSummary.trivy + scanSummary.gitleaks + scanSummary.semgrep > 0 && (
                <span className="ml-2">
                  ({scanSummary.trivy} deps, {scanSummary.gitleaks} secrets, {scanSummary.semgrep} code)
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Run Trivy, Gitleaks, and Semgrep scans on your repositories
        </p>
        <div className="flex items-center gap-3">
          <select
            value={scanRepoSelection}
            onChange={(e) => setScanRepoSelection(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">Select a repository...</option>
            {repoNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <ScanButton
            repoName={scanRepoSelection}
            scanning={scanning[scanRepoSelection] || false}
            progress={scanJobs[scanRepoSelection]}
            onScan={handleScan}
            disabled={!scanRepoSelection}
          />
        </div>

        {/* Latest Scan Result Summary */}
        {latestCompletedScan && latestCompletedScan.id !== dismissedScanId && (
          <div className="mt-4 pt-4 border-t border-[var(--card-border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                  </svg>
                  <span className="font-medium text-sm">
                    Scan completed: <span className="text-[var(--accent)]">{latestCompletedScan.repoName}</span>
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {latestCompletedScan.completedAt && timeAgo(latestCompletedScan.completedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  {/* Trivy Results */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] rounded-lg">
                    <svg className="w-4 h-4 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
                    </svg>
                    <span className="text-[var(--text-muted)]">Trivy:</span>
                    {(() => {
                      const error = latestCompletedScan.results?.toolErrors?.trivy;
                      if (error) return <span className="text-[var(--accent-red)]" title={error}>Failed</span>;
                      const vulns = latestCompletedScan.results?.trivy?.vulnerabilities || [];
                      const critical = vulns.filter(v => v.severity === 'CRITICAL').length;
                      const high = vulns.filter(v => v.severity === 'HIGH').length;
                      const medium = vulns.filter(v => v.severity === 'MEDIUM').length;
                      const low = vulns.filter(v => v.severity === 'LOW').length;
                      if (vulns.length === 0) return <span className="text-[var(--accent-green)]">Clean</span>;
                      return (
                        <span className="flex gap-1.5">
                          {critical > 0 && <span className="text-[#f85149]">{critical}C</span>}
                          {high > 0 && <span className="text-[#db6d28]">{high}H</span>}
                          {medium > 0 && <span className="text-[#d29922]">{medium}M</span>}
                          {low > 0 && <span className="text-[#8b949e]">{low}L</span>}
                        </span>
                      );
                    })()}
                  </div>
                  {/* Gitleaks Results */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] rounded-lg">
                    <svg className="w-4 h-4 text-[var(--accent-red)]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M4 4a4 4 0 1 1 2.5 3.7L2.8 12.4a.5.5 0 0 1-.8-.4V9.8a.5.5 0 0 1 .1-.3l3-3A4 4 0 0 1 4 4Zm4-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
                    </svg>
                    <span className="text-[var(--text-muted)]">Secrets:</span>
                    {(() => {
                      const error = latestCompletedScan.results?.toolErrors?.gitleaks;
                      if (error) return <span className="text-[var(--accent-red)]" title={error}>Failed</span>;
                      const secrets = latestCompletedScan.results?.gitleaks?.secrets || [];
                      if (secrets.length === 0) return <span className="text-[var(--accent-green)]">Clean</span>;
                      return <span className="text-[#f85149]">{secrets.length} found</span>;
                    })()}
                  </div>
                  {/* Semgrep Results */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] rounded-lg">
                    <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
                    </svg>
                    <span className="text-[var(--text-muted)]">Code:</span>
                    {(() => {
                      const error = latestCompletedScan.results?.toolErrors?.semgrep;
                      if (error) return <span className="text-[var(--accent-red)]" title={error}>Failed</span>;
                      const findings = latestCompletedScan.results?.semgrep?.findings || [];
                      const errors = findings.filter(f => f.severity === 'ERROR').length;
                      const warnings = findings.filter(f => f.severity === 'WARNING').length;
                      if (findings.length === 0) return <span className="text-[var(--accent-green)]">Clean</span>;
                      return (
                        <span className="flex gap-1.5">
                          {errors > 0 && <span className="text-[#f85149]">{errors}E</span>}
                          {warnings > 0 && <span className="text-[#d29922]">{warnings}W</span>}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {/* Show error details if any tools failed */}
                {latestCompletedScan.results?.toolErrors && Object.keys(latestCompletedScan.results.toolErrors).length > 0 && (
                  <div className="mt-2 text-xs text-[var(--accent-red)]">
                    Tools not installed: {Object.keys(latestCompletedScan.results.toolErrors).join(', ')}.
                    <span className="text-[var(--text-muted)]"> Deploy with Docker to enable scanning.</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setDismissedScanId(latestCompletedScan.id)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
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

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as Source)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Sources ({sourceCounts.github + sourceCounts.local})</option>
            <option value="github">GitHub ({sourceCounts.github})</option>
            <option value="local">Local Scans ({sourceCounts.local})</option>
          </select>

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

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dependency Alerts Column */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
            </svg>
            Dependencies
            <span className="badge bg-[var(--accent-orange)] text-white">{dependencyAlerts.length}</span>
          </h2>

          {dependencyAlerts.length === 0 ? (
            <div className="card text-center py-8">
              <svg className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
              <p className="text-sm text-[var(--accent-green)] font-medium">No dependency alerts</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {dependencyAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>

        {/* Code Scanning Alerts Column */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
            </svg>
            Code Analysis
            <span className="badge bg-[var(--accent-purple)] text-white">{codeAlerts.length}</span>
          </h2>

          {codeAlerts.length === 0 ? (
            <div className="card text-center py-8">
              <svg className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
              <p className="text-sm text-[var(--accent-green)] font-medium">No code issues</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {codeAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>

        {/* Secret Scanning Alerts Column */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-red)]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 4a4 4 0 1 1 2.5 3.7L2.8 12.4a.5.5 0 0 1-.8-.4V9.8a.5.5 0 0 1 .1-.3l3-3A4 4 0 0 1 4 4Zm4-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
            </svg>
            Secrets
            <span className="badge bg-[var(--accent-red)] text-white">{secretAlerts.length}</span>
          </h2>

          {secretAlerts.length === 0 ? (
            <div className="card text-center py-8">
              <svg className="w-10 h-10 mx-auto mb-2 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
              <p className="text-sm text-[var(--accent-green)] font-medium">No secrets detected</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {secretAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Alert Card Component
function AlertCard({ alert }: { alert: UnifiedAlert }) {
  const isLocal = alert.source === 'local';
  const CardWrapper = alert.htmlUrl ? 'a' : 'div';
  const cardProps = alert.htmlUrl ? {
    href: alert.htmlUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
  } : {};

  return (
    <CardWrapper
      {...cardProps}
      className="card !p-3 flex items-start gap-3 hover:border-[var(--accent)] transition-colors block"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`badge shrink-0 text-xs ${getSeverityColor(alert.severity)}`}>
            {alert.severity}
          </span>
          {isLocal && (
            <span className="badge shrink-0 text-xs bg-[var(--accent)] text-white">
              {alert.type}
            </span>
          )}
          <h3 className="font-medium text-sm leading-tight break-words">{alert.title}</h3>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
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
        <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      )}
    </CardWrapper>
  );
}
