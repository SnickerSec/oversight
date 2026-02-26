'use client';

import { useEffect, useState } from 'react';
import { RepoWithDetails } from '@/lib/github';
import { RefreshCw, Star, GitFork, CircleDot } from 'lucide-react';
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
              <Star className="w-3 h-3 text-[var(--accent-orange)]" />
              {repo.stars}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="w-3 h-3" />
              {repo.forks}
            </span>
            {repo.issues > 0 && (
              <span className="flex items-center gap-1 text-[var(--accent-green)]">
                <CircleDot className="w-3 h-3" />
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
