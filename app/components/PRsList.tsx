'use client';

import { RepoWithDetails } from '@/lib/github';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitPullRequest } from 'lucide-react';

interface PRsListProps {
  repos: RepoWithDetails[];
}

export default function PRsList({ repos }: PRsListProps) {
  const allPRs = repos.flatMap(repo =>
    repo.pullRequests.map(pr => ({ ...pr, repoName: repo.name }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <GitPullRequest className="w-5 h-5 text-[var(--accent-purple)]" />
        Pull Requests
        {allPRs.length > 0 && (
          <Badge className="rounded-full bg-[var(--accent-purple)] text-white">
            {allPRs.length}
          </Badge>
        )}
      </h2>

      {allPRs.length === 0 ? (
        <p className="text-muted-foreground">No open pull requests</p>
      ) : (
        <div className="space-y-3">
          {allPRs.slice(0, 10).map((pr) => (
            <div key={pr.id} className="flex gap-3 text-sm">
              <GitPullRequest className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--accent-purple)]" />
              <div className="flex-1 min-w-0">
                <a
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--accent)] block"
                >
                  {pr.title}
                  {pr.draft && (
                    <Badge className="ml-2 rounded-full bg-[var(--text-muted)] text-white">
                      Draft
                    </Badge>
                  )}
                </a>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-[var(--accent)]">{pr.repoName}</span>
                  <span>#{pr.number}</span>
                  <span>{timeAgo(pr.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
