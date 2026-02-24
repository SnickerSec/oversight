'use client';

import { useEffect, useState } from 'react';
import { RepoWithDetails } from '@/lib/github';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RepoTickerProps {
  repos: RepoWithDetails[];
}

function RepoTicker({ repos }: RepoTickerProps) {
  if (repos.length === 0) return null;

  const tickerItems = repos.map(repo => ({
    name: repo.name,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    issues: repo.open_issues_count,
    language: repo.language,
  }));

  return (
    <div className="flex-1 mx-4 overflow-hidden">
      <div className="flex animate-ticker gap-8">
        {[...tickerItems, ...tickerItems].map((repo, i) => (
          <div key={`${repo.name}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
            <span className="font-medium text-[var(--accent)]">{repo.name}</span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
              </svg>
              {repo.stars}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/>
              </svg>
              {repo.forks}
            </span>
            {repo.issues > 0 && (
              <span className="flex items-center gap-1 text-[var(--accent-green)]">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                </svg>
                {repo.issues}
              </span>
            )}
            {repo.language && (
              <span className="text-muted-foreground">{repo.language}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface RefreshIndicatorProps {
  lastUpdated: Date | null;
  refreshInterval: number;
  onRefresh: () => void;
  isLoading: boolean;
  repos: RepoWithDetails[];
}

export default function RefreshIndicator({
  lastUpdated,
  refreshInterval,
  onRefresh,
  isLoading,
  repos,
}: RefreshIndicatorProps) {
  const [countdown, setCountdown] = useState(refreshInterval / 1000);

  useEffect(() => {
    if (!lastUpdated) return;

    const updateCountdown = () => {
      const elapsed = Date.now() - lastUpdated.getTime();
      const remaining = Math.max(0, Math.ceil((refreshInterval - elapsed) / 1000));
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated, refreshInterval]);

  return (
    <Card className="flex items-center justify-between text-sm text-muted-foreground px-4 py-2">
      <div className="flex items-center gap-2 shrink-0 w-24">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] live-indicator" />
        <span>Live</span>
        {lastUpdated && (
          <span className="text-xs tabular-nums">
            ({countdown}s)
          </span>
        )}
      </div>

      <RepoTicker repos={repos} />

      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
        className="text-[var(--accent)] hover:text-[var(--accent)]"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </Button>
    </Card>
  );
}
