'use client';

import { RepoWithDetails } from '@/lib/github';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
        <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/>
        </svg>
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
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/>
              </svg>
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
