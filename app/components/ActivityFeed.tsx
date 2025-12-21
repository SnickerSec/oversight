'use client';

import { Commit } from '@/lib/github';
import { timeAgo } from '@/lib/utils';

interface ActivityFeedProps {
  commits: (Commit & { repoName: string })[];
}

export default function ActivityFeed({ commits }: ActivityFeedProps) {
  if (commits.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
          </svg>
          Recent Activity
        </h2>
        <p className="text-[var(--text-muted)]">No recent commits</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
        </svg>
        Recent Activity
      </h2>
      <div className="space-y-3">
        {commits.map((commit) => (
          <div key={commit.sha} className="flex gap-3 text-sm">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--card-border)] overflow-hidden">
              {commit.author?.avatar_url ? (
                <img
                  src={commit.author.avatar_url}
                  alt={commit.author.login}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs">
                  {commit.commit.author.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <a
                href={commit.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--accent)] block truncate"
              >
                {commit.commit.message.split('\n')[0]}
              </a>
              <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                <span className="text-[var(--accent)]">{commit.repoName}</span>
                <span>{timeAgo(commit.commit.author.date)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
