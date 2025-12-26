import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: Record<string, any> = {};
    const tmpDir = path.join(os.tmpdir(), `debug-scan-${Date.now()}`);

    try {
      // Create a test file with known secrets
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, 'test-secrets.ts'),
        `
// Test file with intentional secrets
const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
const password = 'SuperSecret123!';
function dangerous(x: string) { return eval(x); }
`
      );

      // Test Gitleaks (use temp file since /dev/stdout doesn't work in containers)
      const gitleaksReport = path.join(tmpDir, 'gitleaks-report.json');
      try {
        execSync(
          `gitleaks detect --source "${tmpDir}" --no-git --report-format json --report-path "${gitleaksReport}" --exit-code 0 2>&1`,
          { encoding: 'utf-8', timeout: 30000 }
        );
        const reportContent = await fs.readFile(gitleaksReport, 'utf-8').catch(() => '[]');
        const parsed = JSON.parse(reportContent || '[]');
        results.gitleaks = {
          success: true,
          secretsFound: parsed.length,
          parsed,
        };
      } catch (e: any) {
        results.gitleaks = {
          success: false,
          exitCode: e.status,
          stdout: e.stdout?.substring(0, 500),
          stderr: e.stderr?.substring(0, 500),
        };
      }

      // Test Semgrep
      try {
        const semgrepOutput = execSync(
          `semgrep scan --config auto --json --quiet "${tmpDir}" 2>&1`,
          { encoding: 'utf-8', timeout: 60000, env: { ...process.env, SEMGREP_SEND_METRICS: 'off' } }
        );
        // Extract JSON from output (in case there's mixed content)
        let jsonStr = semgrepOutput;
        const jsonStart = semgrepOutput.indexOf('{');
        if (jsonStart > 0) {
          jsonStr = semgrepOutput.slice(jsonStart);
        }
        const parsed = JSON.parse(jsonStr);
        results.semgrep = {
          success: true,
          findingsCount: parsed.results?.length || 0,
          findings: parsed.results?.slice(0, 5), // First 5 findings for debug
        };
      } catch (e: any) {
        results.semgrep = {
          success: false,
          exitCode: e.status,
          stdout: e.stdout?.substring(0, 1000),
          stderr: e.stderr?.substring(0, 1000),
        };
      }

      // Test Trivy
      try {
        const trivyOutput = execSync(
          `trivy fs --format json --scanners vuln "${tmpDir}" 2>&1`,
          { encoding: 'utf-8', timeout: 60000 }
        );
        results.trivy = {
          success: true,
          output: trivyOutput.substring(0, 2000),
        };
      } catch (e: any) {
        results.trivy = {
          success: false,
          exitCode: e.status,
          stdout: e.stdout?.substring(0, 1000),
          stderr: e.stderr?.substring(0, 1000),
        };
      }

    } finally {
      // Cleanup
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    }

    return NextResponse.json({ results, tmpDir });
  } catch (error) {
    return NextResponse.json(
      { error: 'Debug scan failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
