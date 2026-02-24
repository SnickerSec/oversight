'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface TokenConfig {
  key: string;
  label: string;
  description: string;
  required: boolean;
  envVar: string;
  docsUrl?: string;
  configured: boolean;
  source: 'redis' | 'env' | 'none';
}

interface SettingsData {
  tokens: TokenConfig[];
  redisConnected: boolean;
}

async function fetchSettings(): Promise<SettingsData> {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error('Failed to fetch settings');
  return response.json();
}

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

function TokenCard({
  token,
  redisConnected,
  onUpdate,
}: {
  token: TokenConfig;
  redisConnected: boolean;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!value.trim()) {
      setError('Token value is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: token.key, value: value.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save token');
      }

      setValue('');
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Remove this token from Redis? The environment variable will still be used if set.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/settings?key=${token.key}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete token');
      }

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: token.key }),
      });

      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: 'Failed to connect to server' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{token.label}</h3>
            {token.required && (
              <span className="text-xs text-[var(--accent-red)]">Required</span>
            )}
            {token.configured && (
              <Badge
                className={`rounded-full ${
                  token.source === 'redis'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--accent-green)] text-white'
                }`}
              >
                {token.source === 'redis' ? 'Redis' : 'Env'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">{token.description}</p>
          <code className="text-xs bg-[var(--card-border)] px-1.5 py-0.5 rounded">
            {token.envVar}
          </code>
          {token.docsUrl && (
            <a
              href={token.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-[var(--accent)] hover:underline"
            >
              Get token
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {token.configured ? (
            <>
              <span className="flex items-center gap-1 text-[var(--accent-green)]">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                </svg>
                <span className="text-sm">Configured</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
                className="h-7 text-xs border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
              >
                {testing ? (
                  <>
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Testing...
                  </>
                ) : (
                  'Test'
                )}
              </Button>
              {token.source === 'redis' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-7 text-xs border-[var(--accent-red)] text-[var(--accent-red)] hover:bg-[var(--accent-red)] hover:text-white"
                >
                  {deleting ? 'Removing...' : 'Remove'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-7 text-xs"
              >
                Update
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              disabled={!redisConnected}
            >
              Configure
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter ${token.label}...`}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setValue('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-[var(--accent-red)]">{error}</p>}
        </div>
      )}

      {testResult && (
        <div
          className={`mt-4 p-3 rounded text-sm flex items-start gap-2 ${
            testResult.success
              ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
              : 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]'
          }`}
        >
          {testResult.success ? (
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          )}
          <div>
            <div className="font-medium">{testResult.message}</div>
            {testResult.details && (
              <div className="opacity-75 text-xs mt-0.5">{testResult.details}</div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTestResult(null)}
            className="h-6 w-6 ml-auto"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { data, error, isLoading } = useSWR<SettingsData>('settings', fetchSettings);
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleUpdate = () => {
    mutate('settings');
    // Also invalidate dashboard data to reflect new tokens
    mutate('dashboard');
  };

  const handleSlackTest = useCallback(async () => {
    setTestingSlack(true);
    setSlackTestResult(null);

    try {
      const response = await fetch('/api/slack/test', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setSlackTestResult({ success: true, message: data.message || 'Test message sent!' });
      } else {
        setSlackTestResult({ success: false, message: data.error || 'Failed to send test message' });
      }
    } catch {
      setSlackTestResult({ success: false, message: 'Failed to connect to server' });
    } finally {
      setTestingSlack(false);
    }
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card className="p-4 text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load settings</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card className="p-4">
          <Skeleton className="h-20 w-full mb-4" />
          <Skeleton className="h-20 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
        </Card>
      </div>
    );
  }

  const tokens = data?.tokens || [];
  const redisConnected = data?.redisConnected ?? false;
  const configuredCount = tokens.filter((t) => t.configured).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </h1>
        <div className="text-sm text-muted-foreground">
          {configuredCount} of {tokens.length} tokens configured
        </div>
      </div>

      {/* Redis Status */}
      <Card
        className={`py-3 px-4 flex items-center gap-3 ${
          redisConnected
            ? 'border-[var(--accent-green)]'
            : 'border-[var(--accent-orange)]'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full ${
            redisConnected ? 'bg-[var(--accent-green)]' : 'bg-[var(--accent-orange)]'
          }`}
        />
        <div className="flex-1">
          <span className="font-medium">
            Redis {redisConnected ? 'Connected' : 'Not Connected'}
          </span>
          {!redisConnected && (
            <p className="text-sm text-muted-foreground">
              Add <code className="bg-[var(--card-border)] px-1 rounded">REDIS_URL</code> to
              enable token storage. Tokens will fall back to environment variables.
            </p>
          )}
        </div>
      </Card>

      {/* Token List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">API Tokens</h2>
        {tokens.map((token) => (
          <TokenCard
            key={token.key}
            token={token}
            redisConnected={redisConnected}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {/* Slack Integration */}
      {tokens.find((t) => t.key === 'SLACK_WEBHOOK_URL')?.configured && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Integrations</h2>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                  Slack Notifications
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Receive alerts for deployment failures and security scan findings
                </p>
              </div>
              <Button
                onClick={handleSlackTest}
                disabled={testingSlack}
              >
                {testingSlack ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Test Message'
                )}
              </Button>
            </div>
            {slackTestResult && (
              <div
                className={`mt-4 p-3 rounded text-sm ${
                  slackTestResult.success
                    ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
                    : 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]'
                }`}
              >
                {slackTestResult.message}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Info Box */}
      <Card className="p-4 bg-muted border-0">
        <h3 className="font-semibold mb-2">How token storage works</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            <strong>Redis tokens</strong> are encrypted using AES-256-GCM and take priority
            over environment variables.
          </li>
          <li>
            <strong>Environment variables</strong> are used as fallback if no Redis token is
            set.
          </li>
          <li>
            Tokens stored in Redis can be updated without redeploying your application.
          </li>
        </ul>
      </Card>
    </div>
  );
}
