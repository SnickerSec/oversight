'use client';

import useSWR from 'swr';
import { RepoWithDetails } from '@/lib/github';
import RepoCard from '../components/RepoCard';
import WorkflowStatus from '../components/WorkflowStatus';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
          </svg>
          Repositories
          {repos && <Badge className="rounded-full">{repos.length}</Badge>}
        </h1>

        {repos && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
              </svg>
              <span className="font-semibold text-[var(--foreground)]">{totalIssues}</span>
              <span className="text-muted-foreground">Open Issues</span>
            </div>

            <div className="flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/>
              </svg>
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
