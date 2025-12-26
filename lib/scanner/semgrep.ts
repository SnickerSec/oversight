import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { SemgrepResult, SemgrepFinding } from './types';
import { normalizeSeverity } from '@/lib/utils';

export async function runSemgrep(repoDir: string): Promise<SemgrepResult> {
  // Use a temp file for output since stdout can have issues in containers
  const reportFile = path.join(os.tmpdir(), `semgrep-${Date.now()}.json`);

  return new Promise((resolve, reject) => {
    let hasError = false;

    const semgrep = spawn('semgrep', [
      'scan',
      '--config', 'p/default',  // Use default ruleset (doesn't require metrics)
      '--config', 'p/security-audit',  // Add security-focused rules
      '--json',
      '--output', reportFile,  // Write JSON to file instead of stdout
      repoDir
    ], {
      timeout: 600000, // 10 minute timeout (Semgrep can be slow)
      env: {
        ...process.env,
        SEMGREP_SEND_METRICS: 'off', // Disable telemetry
      },
    });

    let stderr = '';

    semgrep.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    semgrep.on('error', (error) => {
      hasError = true;
      // Cleanup temp file
      fs.unlink(reportFile).catch(() => {});
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Semgrep is not installed. Install with: pip install semgrep'));
      } else {
        reject(error);
      }
    });

    semgrep.on('close', async (code) => {
      // Don't process if we already rejected due to spawn error
      if (hasError) return;

      const debug: SemgrepResult['debug'] = {
        stderrLength: stderr.length,
        stderrPreview: stderr.substring(0, 500),
        exitCode: code,
      };

      try {
        // Read the report file
        let reportContent = '{"results":[]}';
        try {
          reportContent = await fs.readFile(reportFile, 'utf-8');
          debug.rawOutputLength = reportContent.length;
          debug.rawOutputPreview = reportContent.substring(0, 500);
        } catch (e) {
          debug.parseError = `Failed to read report file: ${e}`;
        } finally {
          // Cleanup temp file
          fs.unlink(reportFile).catch(() => {});
        }

        const output = JSON.parse(reportContent);
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
        // Cleanup temp file
        fs.unlink(reportFile).catch(() => {});
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
