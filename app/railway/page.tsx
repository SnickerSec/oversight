'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { RepoWithDetails } from '@/lib/github';
import { getRailwayStatusColor, getRailwayStatusLabel, getRailwayStatusBgColor } from '@/lib/railway';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Search, TrainFront } from 'lucide-react';

interface RailwayStandaloneProject {
  projectId: string;
  projectName: string;
  serviceId: string;
  serviceName: string;
  environmentId: string;
  environmentName: string;
  deployment?: {
    status: string;
    url?: string;
    createdAt: string;
  };
}

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
  hasRailwayToken: boolean;
  railwayStandaloneProjects?: RailwayStandaloneProject[];
}

type StatusFilter = 'all' | 'success' | 'failed' | 'deploying';

async function fetchData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

function RailwayLogo({ className }: { className?: string }) {
  return <TrainFront className={className} />;
}

export default function RailwayPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const { data, error, isLoading } = useSWR<DashboardData>('railway', fetchData, {
    refreshInterval: 300000, // 5 minutes to avoid Railway API rate limits
  });

  const repos = data?.repos || [];
  const hasRailwayToken = data?.hasRailwayToken ?? false;
  const standaloneProjects = data?.railwayStandaloneProjects || [];

  // Get repos with Railway deployments
  const railwayRepos = useMemo(() => {
    return repos.filter(repo => repo.railway);
  }, [repos]);

  // Combine all Railway projects (linked + standalone)
  type RailwayProject = {
    type: 'linked' | 'standalone';
    id: string;
    projectId: string;
    projectName: string;
    serviceName: string;
    environmentName: string;
    deploymentStatus?: string;
    deploymentUrl?: string;
    lastDeployedAt?: string;
    repo?: RepoWithDetails;
  };

  const allRailwayProjects: RailwayProject[] = useMemo(() => {
    const linked: RailwayProject[] = railwayRepos.map(repo => ({
      type: 'linked' as const,
      id: `linked-${repo.id}`,
      projectId: repo.railway!.projectId,
      projectName: repo.railway!.projectName,
      serviceName: repo.railway!.serviceName,
      environmentName: repo.railway!.environmentName,
      deploymentStatus: repo.railway!.deploymentStatus,
      deploymentUrl: repo.railway!.deploymentUrl,
      lastDeployedAt: repo.railway!.lastDeployedAt,
      repo,
    }));

    const standalone: RailwayProject[] = standaloneProjects.map(project => ({
      type: 'standalone' as const,
      id: `standalone-${project.serviceId}`,
      projectId: project.projectId,
      projectName: project.projectName,
      serviceName: project.serviceName,
      environmentName: project.environmentName,
      deploymentStatus: project.deployment?.status,
      deploymentUrl: project.deployment?.url,
      lastDeployedAt: project.deployment?.createdAt,
    }));

    return [...linked, ...standalone];
  }, [railwayRepos, standaloneProjects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    let result = allRailwayProjects;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(project => {
        const status = project.deploymentStatus?.toUpperCase();
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
      result = result.filter(project =>
        project.projectName.toLowerCase().includes(searchLower) ||
        project.serviceName.toLowerCase().includes(searchLower) ||
        project.repo?.name.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [allRailwayProjects, statusFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: allRailwayProjects.length,
    live: allRailwayProjects.filter(p => p.deploymentStatus?.toUpperCase() === 'SUCCESS').length,
    failed: allRailwayProjects.filter(p => ['FAILED', 'CRASHED'].includes(p.deploymentStatus?.toUpperCase() || '')).length,
    deploying: allRailwayProjects.filter(p => ['DEPLOYING', 'BUILDING', 'INITIALIZING'].includes(p.deploymentStatus?.toUpperCase() || '')).length,
  }), [allRailwayProjects]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <RailwayLogo className="w-7 h-7" />
          Railway Deployments
        </h1>
        <Card className="p-4 text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load Railway data</p>
        </Card>
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
            <Card key={i} className="p-4">
              <Skeleton className="h-8 w-full mb-2" />
              <Skeleton className="h-4 w-16" />
            </Card>
          ))}
        </div>
        <Card className="p-4">
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </Card>
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
        <Card className="p-4 text-center py-12">
          <RailwayLogo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Railway Token Required</h2>
          <p className="text-muted-foreground mb-4">Connect your Railway account to see deployments</p>
          <p className="text-sm text-muted-foreground">
            Add <code className="bg-[var(--card-border)] px-1 rounded">RAILWAY_TOKEN</code> to <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Create a token at <a href="https://railway.app/account/tokens" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">railway.app/account/tokens</a>
          </p>
        </Card>
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
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Projects</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent-green)]">{stats.live}</div>
          <div className="text-sm text-muted-foreground">Live</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent-red)]">{stats.failed}</div>
          <div className="text-sm text-muted-foreground">Failed</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-[var(--accent-orange)]">{stats.deploying}</div>
          <div className="text-sm text-muted-foreground">Deploying</div>
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
              <SelectItem value="success">Live ({stats.live})</SelectItem>
              <SelectItem value="failed">Failed ({stats.failed})</SelectItem>
              <SelectItem value="deploying">Deploying ({stats.deploying})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Results */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredProjects.length} of {allRailwayProjects.length} deployments
      </div>

      {/* Deployments List */}
      {filteredProjects.length === 0 ? (
        <Card className="p-4 text-center py-12">
          <RailwayLogo className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {allRailwayProjects.length === 0
              ? 'No Railway deployments found'
              : 'No deployments match your filters'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="p-4">
              <div className="flex items-start gap-4">
                {/* Status Indicator */}
                <div className={`w-3 h-3 rounded-full mt-1.5 ${getRailwayStatusBgColor(project.deploymentStatus)}`} />

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{project.projectName}</h3>
                    <span className={`text-sm ${getRailwayStatusColor(project.deploymentStatus)}`}>
                      {getRailwayStatusLabel(project.deploymentStatus)}
                    </span>
                    {project.type === 'standalone' && (
                      <Badge className="rounded-full bg-[var(--accent-orange)] text-white">
                        Standalone
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
                      </svg>
                      Service: {project.serviceName}
                    </span>
                    {project.repo ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
                        </svg>
                        <Link href={project.repo.html_url} target="_blank" className="text-[var(--accent)] hover:underline">
                          {project.repo.name}
                        </Link>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Not linked to GitHub
                      </span>
                    )}
                    <span>Env: {project.environmentName}</span>
                    {project.lastDeployedAt && (
                      <span>Deployed: {timeAgo(project.lastDeployedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {project.deploymentUrl && (
                    <Button size="sm" className="bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90" asChild>
                      <a
                        href={`https://${project.deploymentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Visit
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://railway.app/project/${project.projectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <RailwayLogo className="w-4 h-4" />
                      Railway
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
