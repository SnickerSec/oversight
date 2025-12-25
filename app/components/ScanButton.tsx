'use client';

import { ScanJob } from '@/lib/scanner/types';

interface ScanButtonProps {
  repoName: string;
  scanning: boolean;
  progress?: ScanJob;
  onScan: (repoName: string) => void;
  disabled?: boolean;
}

export function ScanButton({ repoName, scanning, progress, onScan, disabled }: ScanButtonProps) {
  if (scanning && progress) {
    const statusText = progress.status === 'cloning'
      ? 'Cloning...'
      : progress.currentTool
        ? `${progress.currentTool}...`
        : 'Starting...';

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] text-white rounded text-sm">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>{statusText} {progress.progress || 0}%</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onScan(repoName)}
      disabled={disabled || scanning}
      className="px-3 py-1.5 bg-[var(--accent)] text-white rounded text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      Scan
    </button>
  );
}
