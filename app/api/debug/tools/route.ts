import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { execSync } from 'child_process';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tools: Record<string, { installed: boolean; version?: string; error?: string }> = {};

    // Check Trivy
    try {
      const trivyVersion = execSync('trivy --version 2>&1', { encoding: 'utf-8', timeout: 5000 });
      tools.trivy = { installed: true, version: trivyVersion.trim().split('\n')[0] };
    } catch (e) {
      tools.trivy = { installed: false, error: (e as Error).message };
    }

    // Check Gitleaks
    try {
      const gitleaksVersion = execSync('gitleaks version 2>&1', { encoding: 'utf-8', timeout: 5000 });
      tools.gitleaks = { installed: true, version: gitleaksVersion.trim() };
    } catch (e) {
      tools.gitleaks = { installed: false, error: (e as Error).message };
    }

    // Check Semgrep
    try {
      const semgrepVersion = execSync('semgrep --version 2>&1', { encoding: 'utf-8', timeout: 5000 });
      tools.semgrep = { installed: true, version: semgrepVersion.trim() };
    } catch (e) {
      tools.semgrep = { installed: false, error: (e as Error).message };
    }

    // Check Git
    try {
      const gitVersion = execSync('git --version 2>&1', { encoding: 'utf-8', timeout: 5000 });
      tools.git = { installed: true, version: gitVersion.trim() };
    } catch (e) {
      tools.git = { installed: false, error: (e as Error).message };
    }

    // Check PATH
    const path = process.env.PATH || '';

    return NextResponse.json({
      tools,
      path,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check tools', details: (error as Error).message },
      { status: 500 }
    );
  }
}
