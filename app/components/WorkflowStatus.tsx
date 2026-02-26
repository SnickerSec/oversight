'use client';

import { RepoWithDetails, WorkflowRun } from '@/lib/github';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, OctagonAlert, CircleSlash, SquareCode } from 'lucide-react';

function getStatusIcon(status: string, conclusion: string | null) {
  if (status === 'in_progress' || status === 'queued' || status === 'waiting') {
    return <Loader2 className="w-4 h-4 text-[var(--accent-orange)] animate-spin" />;
  }
  if (conclusion === 'success') {
    return <CheckCircle2 className="w-4 h-4 text-[var(--accent-green)]" />;
  }
  if (conclusion === 'failure') {
    return <XCircle className="w-4 h-4 text-[var(--accent-red)]" />;
  }
  if (conclusion === 'cancelled' || conclusion === 'skipped') {
    return <OctagonAlert className="w-4 h-4 text-[var(--text-muted)]" />;
  }
  return <CircleSlash className="w-4 h-4 text-[var(--text-muted)]" />;
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
          <SquareCode className="w-4 h-4 text-[var(--accent)]" />
          GitHub Actions
        </h2>
        <p className="text-sm text-muted-foreground text-center py-4">No workflow runs found</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <SquareCode className="w-4 h-4 text-[var(--accent)]" />
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
