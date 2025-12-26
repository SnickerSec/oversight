import { spawn } from 'child_process';
import { GitleaksResult, GitleaksSecret } from './types';

export async function runGitleaks(repoDir: string): Promise<GitleaksResult> {
  return new Promise((resolve, reject) => {
    let hasError = false;

    const gitleaks = spawn('gitleaks', [
      'detect',
      '--source', repoDir,
      '--report-format', 'json',
      '--report-path', '/dev/stdout',
      '--no-git',  // Scan files only, not git history
    ], {
      timeout: 300000, // 5 minute timeout
    });

    let stdout = '';
    let stderr = '';

    gitleaks.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    gitleaks.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gitleaks.on('error', (error) => {
      hasError = true;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Gitleaks is not installed. Install with: brew install gitleaks'));
      } else {
        reject(error);
      }
    });

    gitleaks.on('close', (code) => {
      // Don't process if we already rejected due to spawn error
      if (hasError) return;

      try {
        // Gitleaks returns exit code 1 if secrets found, 0 if clean
        const findings = stdout.trim() ? JSON.parse(stdout) : [];
        const secrets: GitleaksSecret[] = [];
        const byRule: Record<string, number> = {};

        for (const finding of findings) {
          // Redact the secret (show first/last 4 chars)
          const secret = finding.Secret || '';
          const redacted = secret.length > 12
            ? `${secret.slice(0, 4)}...${secret.slice(-4)}`
            : '***redacted***';

          secrets.push({
            ruleId: finding.RuleID,
            description: finding.Description,
            file: finding.File,
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
        // If parsing fails with empty stdout, return empty results
        if (!stdout.trim()) {
          resolve({
            secrets: [],
            summary: { total: 0, byRule: {} },
          });
          return;
        }
        reject(new Error(`Failed to parse Gitleaks output: ${error}`));
      }
    });
  });
}
