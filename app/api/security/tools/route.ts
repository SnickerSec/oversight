import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface ToolStatus {
  available: boolean;
  version: string | null;
}

async function checkTool(command: string, versionArgs: string[]): Promise<ToolStatus> {
  try {
    const { stdout } = await execFileAsync(command, versionArgs, { timeout: 10000 });
    return { available: true, version: stdout.trim().split('\n')[0] };
  } catch {
    return { available: false, version: null };
  }
}

export async function GET() {
  const [trivy, gitleaks, semgrep] = await Promise.all([
    checkTool('trivy', ['--version']),
    checkTool('gitleaks', ['version']),
    checkTool('semgrep', ['--version']),
  ]);

  const allAvailable = trivy.available && gitleaks.available && semgrep.available;

  return NextResponse.json({
    allAvailable,
    trivy,
    gitleaks,
    semgrep,
  });
}
