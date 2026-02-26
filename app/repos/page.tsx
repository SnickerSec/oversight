'use client';

import useSWR from 'swr';
import { RepoWithDetails } from '@/lib/github';
import RepoCard from '../components/RepoCard';
import WorkflowStatus from '../components/WorkflowStatus';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookMarked, CircleDot, GitPullRequest } from 'lucide-react';

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
}

export default function RepositoriesPage() {
  const { data, error, isLoading } = useSWR<DashboardData>(
    'dashboard',
    fetchDashboardData
  );

  const repos = data?.repos;

  const totalIssues = repos?.reduce((sum, repo) => sum + (repo.open_issues_count || 0), 0) || 0;
  const totalPRs = repos?.reduce((sum, repo) => {
    const prCount = repo.pullRequests?.filter(pr => pr.state === 'open').length || 0;
    return sum + prCount;
  }, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookMarked className="w-6 h-6" />
          Repositories
          {repos && <Badge className="rounded-full">{repos.length}</Badge>}
        </h1>

        {repos && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <CircleDot className="w-4 h-4 text-[var(--accent-green)]" />
              <span className="font-semibold text-[var(--foreground)]">{totalIssues}</span>
              <span className="text-muted-foreground">Open Issues</span>
            </div>

            <div className="flex items-center gap-1.5 text-sm">
              <GitPullRequest className="w-4 h-4 text-[var(--accent-purple)]" />
              <span className="font-semibold text-[var(--foreground)]">{totalPRs}</span>
              <span className="text-muted-foreground">Pull Requests</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Card className="p-4 text-center py-8">
          <p className="text-[var(--accent-red)]">Failed to load repositories</p>
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-full mb-3" />
              <Skeleton className="h-3 w-24" />
            </Card>
          ))}
        </div>
      )}

      {repos && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {repos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <WorkflowStatus repos={repos} />
          </div>
        </div>
      )}
    </div>
  );
}
