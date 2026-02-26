'use client';

import { Commit } from '@/lib/github';
import { timeAgo } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface ActivityFeedProps {
  commits: (Commit & { repoName: string })[];
}

export default function ActivityFeed({ commits }: ActivityFeedProps) {
  if (commits.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </h2>
        <p className="text-muted-foreground">No recent commits</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5" />
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
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="text-[var(--accent)]">{commit.repoName}</span>
                <span>{timeAgo(commit.commit.author.date)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
