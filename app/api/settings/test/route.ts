import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken, TOKEN_CONFIGS } from '@/lib/settings';

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

async function testGitHubToken(token: string): Promise<TestResult> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `Connected as ${data.login}`,
        details: `${data.public_repos} public repos, ${data.total_private_repos || 0} private repos`,
      };
    }

    if (response.status === 401) {
      return { success: false, message: 'Invalid or expired token' };
    }

    return { success: false, message: `GitHub API error: ${response.status}` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function testRailwayToken(token: string): Promise<TestResult> {
  try {
    const response = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query { me { email name } }`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.errors) {
        return { success: false, message: data.errors[0]?.message || 'GraphQL error' };
      }
      const user = data.data?.me;
      return {
        success: true,
        message: `Connected as ${user?.name || user?.email || 'Railway user'}`,
      };
    }

    if (response.status === 401) {
      return { success: false, message: 'Invalid or expired token' };
    }

    return { success: false, message: `Railway API error: ${response.status}` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function testSupabaseToken(token: string): Promise<TestResult> {
  try {
    const response = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const projects = await response.json();
      return {
        success: true,
        message: `Connected successfully`,
        details: `${projects.length} project${projects.length !== 1 ? 's' : ''} found`,
      };
    }

    if (response.status === 401) {
      return { success: false, message: 'Invalid or expired token' };
    }

    return { success: false, message: `Supabase API error: ${response.status}` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function testElevenLabsToken(token: string): Promise<TestResult> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: {
        'xi-api-key': token,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const used = data.character_count || 0;
      const limit = data.character_limit || 0;
      return {
        success: true,
        message: `Connected (${data.tier} tier)`,
        details: `${used.toLocaleString()} / ${limit.toLocaleString()} characters used`,
      };
    }

    if (response.status === 401) {
      return { success: false, message: 'Invalid or expired API key' };
    }

    return { success: false, message: `ElevenLabs API error: ${response.status}` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function testGCPCredentials(projectId: string, serviceAccountKey: string): Promise<TestResult> {
  try {
    const key = JSON.parse(serviceAccountKey);
    const now = Math.floor(Date.now() / 1000);

    // Create JWT
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const base64url = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const headerB64 = base64url(header);
    const claimB64 = base64url(claim);
    const unsignedToken = `${headerB64}.${claimB64}`;

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedToken);
    const signature = sign.sign(key.private_key, 'base64url');

    const jwt = `${unsignedToken}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      return { success: false, message: 'Failed to authenticate with GCP' };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Test the token by fetching project info
    const projectResponse = await fetch(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (projectResponse.ok) {
      const project = await projectResponse.json();
      return {
        success: true,
        message: `Connected to project: ${project.name}`,
        details: `Project ID: ${projectId}`,
      };
    }

    if (projectResponse.status === 403) {
      return { success: false, message: 'Service account lacks permission to access this project' };
    }

    if (projectResponse.status === 404) {
      return { success: false, message: 'Project not found' };
    }

    return { success: false, message: `GCP API error: ${projectResponse.status}` };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, message: 'Invalid JSON in service account key' };
    }
    return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function testSlackWebhook(webhookUrl: string): Promise<TestResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Oversight Test Message', emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Your Slack webhook is configured correctly!' },
          },
        ],
      }),
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Test message sent successfully',
        details: 'Check your Slack channel',
      };
    }

    return { success: false, message: `Slack API error: ${response.status}` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { key } = body;

    // Validate token key
    const validKeys = TOKEN_CONFIGS.map((c) => c.key);
    if (!validKeys.includes(key)) {
      return NextResponse.json(
        { error: 'Invalid token key' },
        { status: 400 }
      );
    }

    // Get the token value
    const token = await getToken(key);
    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'Token not configured',
      });
    }

    let result: TestResult;

    switch (key) {
      case 'GITHUB_TOKEN':
        result = await testGitHubToken(token);
        break;
      case 'RAILWAY_TOKEN':
        result = await testRailwayToken(token);
        break;
      case 'SUPABASE_ACCESS_TOKEN':
        result = await testSupabaseToken(token);
        break;
      case 'ELEVENLABS_API_KEY':
        result = await testElevenLabsToken(token);
        break;
      case 'GCP_PROJECT_ID':
      case 'GCP_SERVICE_ACCOUNT_KEY': {
        // For GCP, we need both values
        const projectId = await getToken('GCP_PROJECT_ID');
        const serviceAccountKey = await getToken('GCP_SERVICE_ACCOUNT_KEY');
        if (!projectId || !serviceAccountKey) {
          result = {
            success: false,
            message: 'Both GCP Project ID and Service Account Key are required',
          };
        } else {
          result = await testGCPCredentials(projectId, serviceAccountKey);
        }
        break;
      }
      case 'SLACK_WEBHOOK_URL':
        result = await testSlackWebhook(token);
        break;
      default:
        result = { success: false, message: 'Test not implemented for this token' };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Token test error:', error);
    return NextResponse.json(
      { success: false, message: 'Test failed unexpectedly' },
      { status: 500 }
    );
  }
}
