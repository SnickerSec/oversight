'use client';

import { RepoWithDetails, WorkflowRun } from '@/lib/github';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function getStatusIcon(status: string, conclusion: string | null) {
  if (status === 'in_progress' || status === 'queued' || status === 'waiting') {
    return (
      <svg className="w-4 h-4 text-[var(--accent-orange)] animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );
  }

  if (conclusion === 'success') {
    return (
      <svg className="w-4 h-4 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
      </svg>
    );
  }

  if (conclusion === 'failure') {
    return (
      <svg className="w-4 h-4 text-[var(--accent-red)]" fill="currentColor" viewBox="0 0 16 16">
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
      </svg>
    );
  }

  if (conclusion === 'cancelled' || conclusion === 'skipped') {
    return (
      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 16 16">
        <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/>
    </svg>
  );
}

function getEventLabel(event: string): string {
  switch (event) {
    case 'push': return 'push';
    case 'pull_request': return 'PR';
    case 'schedule': return 'scheduled';
    case 'workflow_dispatch': return 'manual';
    case 'release': return 'release';
    default: return event;
  }
}

export default function WorkflowStatus({ repos }: { repos: RepoWithDetails[] }) {
  const allWorkflows = repos.flatMap(repo =>
    (repo.workflowRuns || []).map(run => ({ ...run, repoName: repo.name }))
  ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const recentWorkflows = allWorkflows.slice(0, 10);

  const statusCounts = {
    success: allWorkflows.filter(w => w.conclusion === 'success').length,
    failure: allWorkflows.filter(w => w.conclusion === 'failure').length,
    inProgress: allWorkflows.filter(w => w.status === 'in_progress' || w.status === 'queued').length,
  };

  if (allWorkflows.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent)]" fill="currentColor" viewBox="0 0 16 16">
            <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/>
          </svg>
          GitHub Actions
        </h2>
        <p className="text-sm text-muted-foreground text-center py-4">No workflow runs found</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-[var(--accent)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/>
        </svg>
        GitHub Actions
        <div className="flex items-center gap-2 ml-auto text-xs">
          {statusCounts.success > 0 && (
            <Badge className="rounded-full bg-[var(--accent-green)] text-white">
              {statusCounts.success}
            </Badge>
          )}
          {statusCounts.failure > 0 && (
            <Badge className="rounded-full bg-[var(--accent-red)] text-white">
              {statusCounts.failure}
            </Badge>
          )}
          {statusCounts.inProgress > 0 && (
            <Badge className="rounded-full bg-[var(--accent-orange)] text-black">
              {statusCounts.inProgress}
            </Badge>
          )}
        </div>
      </h2>

      <div className="space-y-1 overflow-x-hidden">
        {recentWorkflows.map((run) => (
          <a
            key={run.id}
            href={run.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:bg-[var(--card-border)] -mx-2 px-2 py-1.5 rounded min-w-0"
          >
            <div className="shrink-0">
              {getStatusIcon(run.status, run.conclusion)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate flex-1 min-w-0">{run.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {getEventLabel(run.event)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                <span className="text-[var(--accent)]">{run.repoName}</span>
                {' · '}
                <span>{run.head_branch}</span>
                {' · '}
                <span>{timeAgo(run.updated_at)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}
