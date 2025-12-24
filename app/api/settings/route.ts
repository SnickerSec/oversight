import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getTokenStatus, storeToken, deleteToken, TOKEN_CONFIGS } from '@/lib/settings';
import { getRedis } from '@/lib/redis';

// GET - Fetch token status
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenStatus = await getTokenStatus();
    const redisConnected = !!getRedis();

    return NextResponse.json({
      tokens: tokenStatus,
      redisConnected,
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST - Store a token
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body;

    // Validate token key
    const validKeys = TOKEN_CONFIGS.map((c) => c.key);
    if (!validKeys.includes(key)) {
      return NextResponse.json(
        { error: 'Invalid token key' },
        { status: 400 }
      );
    }

    if (!value || typeof value !== 'string') {
      return NextResponse.json(
        { error: 'Token value is required' },
        { status: 400 }
      );
    }

    await storeToken(key, value.trim());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to store token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remove a token
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Token key is required' },
        { status: 400 }
      );
    }

    // Validate token key
    const validKeys = TOKEN_CONFIGS.map((c) => c.key);
    if (!validKeys.includes(key)) {
      return NextResponse.json(
        { error: 'Invalid token key' },
        { status: 400 }
      );
    }

    await deleteToken(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete token' },
      { status: 500 }
    );
  }
}
