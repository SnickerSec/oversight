'use client';

import { ScanJob } from '@/lib/scanner/types';
import { timeAgo } from '@/lib/utils';

interface ScanStatusProps {
  job: ScanJob;
}

const statusConfig = {
  pending: { color: 'bg-[var(--text-muted)]', label: 'Pending' },
  cloning: { color: 'bg-[var(--accent)]', label: 'Cloning' },
  scanning: { color: 'bg-[var(--accent)]', label: 'Scanning' },
  completed: { color: 'bg-[var(--accent-green)]', label: 'Completed' },
  failed: { color: 'bg-[var(--accent-red)]', label: 'Failed' },
};

export function ScanStatus({ job }: ScanStatusProps) {
  const config = statusConfig[job.status] || statusConfig.pending;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm">{config.label}</span>
        {job.currentTool && job.status === 'scanning' && (
          <span className="text-xs text-[var(--text-muted)]">
            ({job.currentTool})
          </span>
        )}
      </div>

      {job.progress !== undefined && job.status === 'scanning' && (
        <div className="flex-1 max-w-32 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}

      {job.completedAt && (
        <span className="text-xs text-[var(--text-muted)]">
          {timeAgo(job.completedAt)}
        </span>
      )}

      {job.error && (
        <span className="text-xs text-[var(--accent-red)]" title={job.error}>
          {job.error.length > 30 ? `${job.error.slice(0, 30)}...` : job.error}
        </span>
      )}
    </div>
  );
}
