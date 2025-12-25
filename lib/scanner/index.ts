import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { getRedis } from '@/lib/redis';
import { ScanJob, ScanTool, ScanResults } from './types';
import { runTrivy } from './trivy';
import { runGitleaks } from './gitleaks';
import { runSemgrep } from './semgrep';
import { sendSecurityScanAlert } from '@/lib/slack';

const SCAN_KEY_PREFIX = 'oversight:scan:';
const GITHUB_USERNAME = 'SnickerSec';

export async function updateScanStatus(
  scanId: string,
  updates: Partial<ScanJob>
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const data = await redis.get(`${SCAN_KEY_PREFIX}${scanId}`);
    if (!data) return;

    const job: ScanJob = { ...JSON.parse(data), ...updates };
    await redis.set(
      `${SCAN_KEY_PREFIX}${scanId}`,
      JSON.stringify(job),
      'EX',
      3600 * 24 // 24 hour TTL
    );
  } catch (error) {
    console.error('Failed to update scan status:', error);
  }
}

export async function getScanJob(scanId: string): Promise<ScanJob | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const data = await redis.get(`${SCAN_KEY_PREFIX}${scanId}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function cloneRepo(url: string, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['clone', '--depth', '1', url, targetDir], {
      timeout: 120000, // 2 minute timeout for clone
    });

    let stderr = '';
    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    git.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Git clone failed: ${stderr}`));
      }
    });

    git.on('error', (error) => {
      reject(error);
    });
  });
}

export async function startScan(
  scanId: string,
  repoName: string,
  githubToken: string,
  tools: ScanTool[]
): Promise<void> {
  const tmpDir = path.join(os.tmpdir(), `oversight-scan-${scanId}`);

  try {
    await updateScanStatus(scanId, { status: 'cloning' });

    // Clone repository using authenticated URL
    const repoUrl = `https://${githubToken}@github.com/${GITHUB_USERNAME}/${repoName}.git`;
    await cloneRepo(repoUrl, tmpDir);

    await updateScanStatus(scanId, { status: 'scanning', progress: 0 });

    const results: ScanResults = { toolErrors: {} as Record<ScanTool, string> };
    const toolCount = tools.length;
    let completed = 0;

    // Run each tool sequentially
    for (const tool of tools) {
      await updateScanStatus(scanId, {
        currentTool: tool,
        progress: Math.round((completed / toolCount) * 100),
      });

      try {
        switch (tool) {
          case 'trivy':
            results.trivy = await runTrivy(tmpDir);
            break;
          case 'gitleaks':
            results.gitleaks = await runGitleaks(tmpDir);
            break;
          case 'semgrep':
            results.semgrep = await runSemgrep(tmpDir);
            break;
        }
      } catch (toolError) {
        const errorMessage = toolError instanceof Error ? toolError.message : 'Unknown error';
        console.error(`Tool ${tool} failed:`, errorMessage);
        results.toolErrors![tool] = errorMessage;
        // Continue with other tools even if one fails
      }

      completed++;
    }

    await updateScanStatus(scanId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: 100,
      currentTool: undefined,
      results,
    });

    // Send Slack alert if there are findings
    await sendSecurityScanAlert(repoName, {
      trivy: results.trivy ? {
        critical: results.trivy.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        high: results.trivy.vulnerabilities.filter(v => v.severity === 'HIGH').length,
        medium: results.trivy.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        low: results.trivy.vulnerabilities.filter(v => v.severity === 'LOW').length,
      } : undefined,
      gitleaks: results.gitleaks ? {
        total: results.gitleaks.secrets.length,
      } : undefined,
      semgrep: results.semgrep ? {
        error: results.semgrep.findings.filter(f => f.severity === 'ERROR').length,
        warning: results.semgrep.findings.filter(f => f.severity === 'WARNING').length,
      } : undefined,
    });

  } catch (error) {
    await updateScanStatus(scanId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export { SCAN_KEY_PREFIX };
