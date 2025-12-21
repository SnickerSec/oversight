'use client';

import { Issue, RepoWithDetails } from '@/lib/github';

interface IssuesListProps {
  repos: RepoWithDetails[];
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function IssuesList({ repos }: IssuesListProps) {
  const allIssues = repos.flatMap(repo =>
    repo.issues.map(issue => ({ ...issue, repoName: repo.name }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
        </svg>
        Open Issues
        {allIssues.length > 0 && (
          <span className="badge bg-[var(--accent-green)] text-black">
            {allIssues.length}
          </span>
        )}
      </h2>

      {allIssues.length === 0 ? (
        <p className="text-[var(--text-muted)]">No open issues</p>
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
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--accent)]">{(issue as Issue & { repoName: string }).repoName}</span>
                  <span>#{issue.number}</span>
                  <span>{timeAgo(issue.created_at)}</span>
                </div>
                {issue.labels.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {issue.labels.map(label => (
                      <span
                        key={label.name}
                        className="badge text-xs"
                        style={{
                          backgroundColor: `#${label.color}20`,
                          color: `#${label.color}`,
                          border: `1px solid #${label.color}40`,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
