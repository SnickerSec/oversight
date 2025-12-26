import { spawn } from 'child_process';
import { SemgrepResult, SemgrepFinding } from './types';
import { normalizeSeverity } from '@/lib/utils';

export async function runSemgrep(repoDir: string): Promise<SemgrepResult> {
  return new Promise((resolve, reject) => {
    let hasError = false;

    const semgrep = spawn('semgrep', [
      'scan',
      '--config', 'auto',  // Use recommended rules
      '--json',
      '--quiet',  // Suppress human-readable output, only emit JSON
      repoDir
    ], {
      timeout: 600000, // 10 minute timeout (Semgrep can be slow)
      env: {
        ...process.env,
        SEMGREP_SEND_METRICS: 'off', // Disable telemetry
      },
    });

    let stdout = '';
    let stderr = '';

    semgrep.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    semgrep.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    semgrep.on('error', (error) => {
      hasError = true;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Semgrep is not installed. Install with: pip install semgrep'));
      } else {
        reject(error);
      }
    });

    semgrep.on('close', (code) => {
      // Don't process if we already rejected due to spawn error
      if (hasError) return;

      const debug = {
        rawOutputLength: stdout.length,
        rawOutputPreview: stdout.substring(0, 500),
      };

      try {
        // Try to extract JSON from output (in case there's mixed content)
        let jsonStr = stdout;
        const jsonStart = stdout.indexOf('{');
        if (jsonStart > 0) {
          jsonStr = stdout.slice(jsonStart);
        }
        const output = JSON.parse(jsonStr);
        const findings: SemgrepFinding[] = [];
        const summary = {
          error: 0,
          warning: 0,
          info: 0,
          byCategory: {} as Record<string, number>,
        };

        for (const result of output.results || []) {
          const severity = normalizeSeverity(result.extra?.severity);
          const category = result.extra?.metadata?.category || 'other';

          findings.push({
            ruleId: result.check_id,
            message: result.extra?.message || '',
            severity,
            path: result.path,
            startLine: result.start?.line,
            endLine: result.end?.line,
            startCol: result.start?.col,
            endCol: result.end?.col,
            category,
            cwe: result.extra?.metadata?.cwe,
            owasp: result.extra?.metadata?.owasp,
          });

          // Count by severity
          if (severity === 'critical' || severity === 'high') {
            summary.error++;
          } else if (severity === 'medium') {
            summary.warning++;
          } else {
            summary.info++;
          }

          // Count by category
          summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
        }

        resolve({ findings, summary, debug });

      } catch (error) {
        // If no JSON output, return empty results with debug info
        if (!stdout.trim()) {
          resolve({
            findings: [],
            summary: { error: 0, warning: 0, info: 0, byCategory: {} },
            debug: { ...debug, parseError: 'Empty stdout' },
          });
          return;
        }
        // Return empty results with error info instead of rejecting
        resolve({
          findings: [],
          summary: { error: 0, warning: 0, info: 0, byCategory: {} },
          debug: { ...debug, parseError: String(error) },
        });
      }
    });
  });
}
