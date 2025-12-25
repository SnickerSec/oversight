import { getToken } from './settings';

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
}

interface SlackMessage {
  blocks: SlackBlock[];
}

async function getSlackWebhook(): Promise<string | undefined> {
  return getToken('SLACK_WEBHOOK_URL');
}

export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  const webhookUrl = await getSlackWebhook();
  if (!webhookUrl) {
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send Slack message:', error);
    return false;
  }
}

export async function sendTestMessage(): Promise<boolean> {
  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✅ Oversight Connected', emoji: true }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Your Slack webhook is configured correctly and ready to receive alerts.' }
      },
      {
        type: 'context',
        text: { type: 'mrkdwn', text: `_Test sent at ${new Date().toISOString()}_` }
      }
    ]
  });
}

export async function sendDeploymentAlert(
  serviceName: string,
  projectName: string,
  status: string,
  projectId?: string
): Promise<boolean> {
  const emoji = status === 'FAILED' ? '🔴' : status === 'CRASHED' ? '💥' : '⚠️';

  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} Railway Deployment ${status}`, emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Project:*\n${projectName}` },
          { type: 'mrkdwn', text: `*Service:*\n${serviceName}` }
        ]
      },
      ...(projectId ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `<https://railway.app/project/${projectId}|View in Railway>` }
      }] : [])
    ]
  });
}

export async function sendSecurityScanAlert(
  repoName: string,
  results: {
    trivy?: { critical: number; high: number; medium: number; low: number };
    gitleaks?: { total: number };
    semgrep?: { error: number; warning: number };
  }
): Promise<boolean> {
  const trivyTotal = results.trivy
    ? results.trivy.critical + results.trivy.high + results.trivy.medium + results.trivy.low
    : 0;
  const secretsTotal = results.gitleaks?.total || 0;
  const codeTotal = results.semgrep
    ? results.semgrep.error + results.semgrep.warning
    : 0;

  const totalFindings = trivyTotal + secretsTotal + codeTotal;
  const criticalCount = (results.trivy?.critical || 0) + secretsTotal; // Secrets are always critical

  // Only send alert if there are findings
  if (totalFindings === 0) {
    return true; // Success, just nothing to report
  }

  const emoji = criticalCount > 0 ? '🚨' : '⚠️';
  const severity = criticalCount > 0 ? 'Critical Issues Found' : 'Issues Found';

  const fields: { type: string; text: string }[] = [];

  if (trivyTotal > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Dependencies (Trivy):*\n${results.trivy?.critical || 0} critical, ${results.trivy?.high || 0} high, ${results.trivy?.medium || 0} medium`
    });
  }

  if (secretsTotal > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Secrets (Gitleaks):*\n${secretsTotal} found`
    });
  }

  if (codeTotal > 0) {
    fields.push({
      type: 'mrkdwn',
      text: `*Code Issues (Semgrep):*\n${results.semgrep?.error || 0} errors, ${results.semgrep?.warning || 0} warnings`
    });
  }

  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} Security Scan: ${severity}`, emoji: true }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `Repository: *${repoName}*` }
      },
      {
        type: 'section',
        fields
      },
      {
        type: 'context',
        text: { type: 'mrkdwn', text: `_Scanned at ${new Date().toISOString()}_` }
      }
    ]
  });
}
