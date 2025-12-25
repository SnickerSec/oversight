import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getRedis } from '@/lib/redis';
import { getToken } from '@/lib/settings';
import { startScan, getScanJob, SCAN_KEY_PREFIX } from '@/lib/scanner';
import { ScanJob, ScanTool } from '@/lib/scanner/types';
import { randomUUID } from 'crypto';

const SCAN_LIST_KEY = 'oversight:scans:list';
const VALID_TOOLS: ScanTool[] = ['trivy', 'gitleaks', 'semgrep'];

// POST - Trigger a new scan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { error: 'Redis required for scan management' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { repoName, tools = ['trivy', 'gitleaks', 'semgrep'] } = body;

    if (!repoName || typeof repoName !== 'string') {
      return NextResponse.json(
        { error: 'repoName is required' },
        { status: 400 }
      );
    }

    // Validate tools
    const validatedTools = tools.filter((t: string) => VALID_TOOLS.includes(t as ScanTool)) as ScanTool[];
    if (validatedTools.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid tool is required (trivy, gitleaks, semgrep)' },
        { status: 400 }
      );
    }

    // Get GitHub token for cloning
    const githubToken = await getToken('GITHUB_TOKEN');
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token required for scanning' },
        { status: 400 }
      );
    }

    // Check for existing running scan on this repo
    const existingScans = await redis.lrange(SCAN_LIST_KEY, 0, 20);
    for (const scanId of existingScans) {
      const data = await redis.get(`${SCAN_KEY_PREFIX}${scanId}`);
      if (data) {
        const job: ScanJob = JSON.parse(data);
        if (job.repoName === repoName && ['pending', 'cloning', 'scanning'].includes(job.status)) {
          return NextResponse.json(
            { error: 'A scan is already in progress for this repository', scanId: job.id },
            { status: 409 }
          );
        }
      }
    }

    const scanId = randomUUID().slice(0, 12);
    const scanJob: ScanJob = {
      id: scanId,
      repoName,
      repoFullName: `SnickerSec/${repoName}`,
      status: 'pending',
      startedAt: new Date().toISOString(),
      tools: validatedTools,
    };

    // Store scan job
    await redis.set(
      `${SCAN_KEY_PREFIX}${scanId}`,
      JSON.stringify(scanJob),
      'EX',
      3600 * 24 // 24 hour TTL
    );

    // Add to list
    await redis.lpush(SCAN_LIST_KEY, scanId);
    await redis.ltrim(SCAN_LIST_KEY, 0, 99); // Keep last 100 scans

    // Start background scan (fire and forget)
    startScan(scanId, repoName, githubToken, validatedTools).catch((error) => {
      console.error('Scan failed:', error);
    });

    return NextResponse.json({ scanId, status: 'pending' });
  } catch (error) {
    console.error('Scan POST error:', error);
    return NextResponse.json(
      { error: 'Failed to start scan' },
      { status: 500 }
    );
  }
}

// GET - Get scan status/results
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('id');
    const repoName = searchParams.get('repo');

    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis required' }, { status: 503 });
    }

    // Get specific scan by ID
    if (scanId) {
      const job = await getScanJob(scanId);
      if (!job) {
        return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
      }
      return NextResponse.json(job);
    }

    // Get latest scan for repo
    if (repoName) {
      const scanIds = await redis.lrange(SCAN_LIST_KEY, 0, 99);
      for (const id of scanIds) {
        const data = await redis.get(`${SCAN_KEY_PREFIX}${id}`);
        if (data) {
          const scan: ScanJob = JSON.parse(data);
          if (scan.repoName === repoName) {
            return NextResponse.json(scan);
          }
        }
      }
      return NextResponse.json({ error: 'No scans found for repo' }, { status: 404 });
    }

    // List all recent scans
    const scanIds = await redis.lrange(SCAN_LIST_KEY, 0, 19); // Last 20 scans
    const scans: ScanJob[] = [];
    for (const id of scanIds) {
      const data = await redis.get(`${SCAN_KEY_PREFIX}${id}`);
      if (data) {
        scans.push(JSON.parse(data));
      }
    }

    return NextResponse.json({ scans });
  } catch (error) {
    console.error('Scan GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan' },
      { status: 500 }
    );
  }
}
