import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GitleaksResult, GitleaksSecret } from './types';

export async function runGitleaks(repoDir: string): Promise<GitleaksResult> {
  // Use a temp file for output since /dev/stdout doesn't work in some container environments
  const reportFile = path.join(os.tmpdir(), `gitleaks-${Date.now()}.json`);

  return new Promise((resolve, reject) => {
    let hasError = false;

    const gitleaks = spawn('gitleaks', [
      'detect',
      '--source', repoDir,
      '--report-format', 'json',
      '--report-path', reportFile,
      '--no-git',  // Scan files only, not git history
      '--exit-code', '0',  // Don't use exit code 1 for findings, we'll check the report
    ], {
      timeout: 300000, // 5 minute timeout
    });

    let stderr = '';

    gitleaks.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gitleaks.on('error', (error) => {
      hasError = true;
      // Cleanup temp file
      fs.unlink(reportFile).catch(() => {});
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Gitleaks is not installed. Install with: brew install gitleaks'));
      } else {
        reject(error);
      }
    });

    gitleaks.on('close', async (code) => {
      // Don't process if we already rejected due to spawn error
      if (hasError) return;

      try {
        // Read the report file
        let reportContent = '[]';
        try {
          reportContent = await fs.readFile(reportFile, 'utf-8');
        } catch (e) {
          // Report file might not exist if no findings
        } finally {
          // Cleanup temp file
          fs.unlink(reportFile).catch(() => {});
        }

        const findings = reportContent.trim() ? JSON.parse(reportContent) : [];
        const secrets: GitleaksSecret[] = [];
        const byRule: Record<string, number> = {};

        for (const finding of findings) {
          // Redact the secret (show first/last 4 chars)
          const secret = finding.Secret || '';
          const redacted = secret.length > 12
            ? `${secret.slice(0, 4)}...${secret.slice(-4)}`
            : '***redacted***';

          // Strip temp directory prefix from path to show clean relative paths
          let cleanFile = finding.File || '';
          if (cleanFile.startsWith(repoDir)) {
            cleanFile = cleanFile.slice(repoDir.length).replace(/^\//, '');
          }

          secrets.push({
            ruleId: finding.RuleID,
            description: finding.Description,
            file: cleanFile,
            startLine: finding.StartLine,
            endLine: finding.EndLine,
            commit: finding.Commit,
            author: finding.Author,
            date: finding.Date,
            match: redacted,
          });

          byRule[finding.RuleID] = (byRule[finding.RuleID] || 0) + 1;
        }

        resolve({
          secrets,
          summary: {
            total: secrets.length,
            byRule,
          },
        });

      } catch (error) {
        // Cleanup temp file
        fs.unlink(reportFile).catch(() => {});
        reject(new Error(`Failed to parse Gitleaks output: ${error}`));
      }
    });
  });
}
