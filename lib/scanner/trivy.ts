import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { TrivyResult, TrivyVulnerability } from './types';
import { normalizeSeverity } from '@/lib/utils';

export async function runTrivy(repoDir: string): Promise<TrivyResult> {
  // Use a temp file for output since stdout can have issues in containers
  const reportFile = path.join(os.tmpdir(), `trivy-${Date.now()}.json`);

  return new Promise((resolve, reject) => {
    let hasError = false;

    const trivy = spawn('trivy', [
      'fs',
      '--format', 'json',
      '--output', reportFile,  // Write JSON to file instead of stdout
      '--scanners', 'vuln',
      '--severity', 'CRITICAL,HIGH,MEDIUM,LOW',
      repoDir
    ], {
      timeout: 300000, // 5 minute timeout
    });

    let stderr = '';

    trivy.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    trivy.on('error', (error) => {
      hasError = true;
      // Cleanup temp file
      fs.unlink(reportFile).catch(() => {});
      // Check if trivy is installed
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Trivy is not installed. Install with: brew install trivy'));
      } else {
        reject(error);
      }
    });

    trivy.on('close', async (code) => {
      // Don't process if we already rejected due to spawn error
      if (hasError) return;

      try {
        // Read the report file
        let reportContent = '{}';
        try {
          reportContent = await fs.readFile(reportFile, 'utf-8');
        } catch (e) {
          // Report file might not exist if scan failed
        } finally {
          // Cleanup temp file
          fs.unlink(reportFile).catch(() => {});
        }

        // Trivy returns 0 even with findings
        const output = JSON.parse(reportContent);
        const vulnerabilities: TrivyVulnerability[] = [];
        const summary = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };

        // Parse Trivy JSON output
        for (const result of output.Results || []) {
          for (const vuln of result.Vulnerabilities || []) {
            const severity = normalizeSeverity(vuln.Severity);
            vulnerabilities.push({
              id: vuln.VulnerabilityID,
              pkgName: vuln.PkgName,
              installedVersion: vuln.InstalledVersion,
              fixedVersion: vuln.FixedVersion,
              severity: severity,
              title: vuln.Title || vuln.VulnerabilityID,
              description: vuln.Description || '',
              primaryUrl: vuln.PrimaryURL,
            });

            // Count by normalized severity
            if (severity in summary) {
              summary[severity as keyof typeof summary]++;
            }
          }
        }

        resolve({
          vulnerabilities,
          summary,
          scanTarget: repoDir,
        });

      } catch (error) {
        // Cleanup temp file
        fs.unlink(reportFile).catch(() => {});
        resolve({
          vulnerabilities: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
          scanTarget: repoDir,
        });
      }
    });
  });
}
