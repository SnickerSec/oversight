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

      // Test Gitleaks
      try {
        const gitleaksOutput = execSync(
          `gitleaks detect --source "${tmpDir}" --no-git --report-format json --report-path /dev/stdout 2>&1`,
          { encoding: 'utf-8', timeout: 30000 }
        );
        results.gitleaks = {
          success: true,
          output: gitleaksOutput,
          parsed: JSON.parse(gitleaksOutput || '[]'),
        };
      } catch (e: any) {
        // Gitleaks returns exit code 1 when secrets found
        const output = e.stdout || e.message;
        results.gitleaks = {
          success: false,
          exitCode: e.status,
          stdout: e.stdout,
          stderr: e.stderr,
          output,
        };
        // Try to parse output even on error (exit code 1 = secrets found)
        try {
          if (e.stdout) {
            results.gitleaks.parsed = JSON.parse(e.stdout);
            results.gitleaks.secretsFound = results.gitleaks.parsed.length;
          }
        } catch {}
      }

      // Test Semgrep
      try {
        const semgrepOutput = execSync(
          `semgrep scan --config auto --json "${tmpDir}" 2>&1`,
          { encoding: 'utf-8', timeout: 60000 }
        );
        results.semgrep = {
          success: true,
          output: semgrepOutput.substring(0, 2000),
        };
        try {
          const parsed = JSON.parse(semgrepOutput);
          results.semgrep.findingsCount = parsed.results?.length || 0;
        } catch {}
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
