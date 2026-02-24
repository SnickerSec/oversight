'use client';

import { Issue, RepoWithDetails } from '@/lib/github';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface IssuesListProps {
  repos: RepoWithDetails[];
}

export default function IssuesList({ repos }: IssuesListProps) {
  const allIssues = repos.flatMap(repo =>
    repo.issues.map(issue => ({ ...issue, repoName: repo.name }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
        </svg>
        Open Issues
        {allIssues.length > 0 && (
          <Badge className="rounded-full bg-[var(--accent-green)] text-black">
            {allIssues.length}
          </Badge>
        )}
      </h2>

      {allIssues.length === 0 ? (
        <p className="text-muted-foreground">No open issues</p>
      ) : (
        <div className="space-y-3">
          {allIssues.slice(0, 10).map((issue) => (
            <div key={issue.id} className="flex gap-3 text-sm">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--accent)] block"
                >
                  {issue.title}
                </a>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--accent)]">{(issue as Issue & { repoName: string }).repoName}</span>
                  <span>#{issue.number}</span>
                  <span>{timeAgo(issue.created_at)}</span>
                </div>
                {issue.labels.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {issue.labels.map(label => (
                      <Badge
                        key={label.name}
                        variant="outline"
                        className="rounded-full text-xs px-2 py-0"
                        style={{
                          backgroundColor: `#${label.color}20`,
                          color: `#${label.color}`,
                          borderColor: `#${label.color}40`,
                        }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
