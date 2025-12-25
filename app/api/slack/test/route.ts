import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sendTestMessage } from '@/lib/slack';
import { getToken } from '@/lib/settings';

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookUrl = await getToken('SLACK_WEBHOOK_URL');
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Slack webhook URL not configured' },
        { status: 400 }
      );
    }

    const success = await sendTestMessage();

    if (success) {
      return NextResponse.json({ success: true, message: 'Test message sent to Slack' });
    } else {
      return NextResponse.json(
        { error: 'Failed to send message to Slack' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Slack test error:', error);
    return NextResponse.json(
      { error: 'Failed to send test message' },
      { status: 500 }
    );
  }
}
