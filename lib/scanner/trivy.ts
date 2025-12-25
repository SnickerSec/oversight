import { spawn } from 'child_process';
import { TrivyResult, TrivyVulnerability } from './types';
import { normalizeSeverity } from '@/lib/utils';

export async function runTrivy(repoDir: string): Promise<TrivyResult> {
  return new Promise((resolve, reject) => {
    const trivy = spawn('trivy', [
      'fs',
      '--format', 'json',
      '--scanners', 'vuln',
      '--severity', 'CRITICAL,HIGH,MEDIUM,LOW',
      repoDir
    ], {
      timeout: 300000, // 5 minute timeout
    });

    let stdout = '';
    let stderr = '';

    trivy.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    trivy.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    trivy.on('close', (code) => {
      try {
        // Trivy returns 0 even with findings
        const output = JSON.parse(stdout);
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
        // If no JSON output, return empty results
        if (!stdout.trim()) {
          resolve({
            vulnerabilities: [],
            summary: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
            scanTarget: repoDir,
          });
          return;
        }
        reject(new Error(`Failed to parse Trivy output: ${error}`));
      }
    });

    trivy.on('error', (error) => {
      // Check if trivy is installed
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Trivy is not installed. Install with: brew install trivy'));
      } else {
        reject(error);
      }
    });
  });
}
