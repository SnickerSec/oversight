'use client';

import { ScanJob } from '@/lib/scanner/types';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';

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
      <Button size="sm" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{statusText} {progress.progress || 0}%</span>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => onScan(repoName)}
      disabled={disabled || scanning}
    >
      <Shield className="w-4 h-4" />
      Scan
    </Button>
  );
}
