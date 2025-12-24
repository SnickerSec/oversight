'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';

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

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{token.label}</h3>
            {token.required && (
              <span className="text-xs text-[var(--accent-red)]">Required</span>
            )}
            {token.configured && (
              <span
                className={`px-2 py-0.5 text-xs rounded ${
                  token.source === 'redis'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--accent-green)] text-white'
                }`}
              >
                {token.source === 'redis' ? 'Redis' : 'Env'}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-2">{token.description}</p>
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
              {token.source === 'redis' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2 py-1 text-xs border border-[var(--accent-red)] text-[var(--accent-red)] rounded hover:bg-[var(--accent-red)] hover:text-white disabled:opacity-50"
                >
                  {deleting ? 'Removing...' : 'Remove'}
                </button>
              )}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-2 py-1 text-xs border border-[var(--card-border)] rounded hover:bg-[var(--card-border)]"
              >
                Update
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(!isEditing)}
              disabled={!redisConnected}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Configure
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 pt-4 border-t border-[var(--card-border)]">
          <div className="flex gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter ${token.label}...`}
              className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="px-4 py-2 bg-[var(--accent-green)] text-white rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setValue('');
                setError(null);
              }}
              className="px-4 py-2 border border-[var(--card-border)] rounded text-sm hover:bg-[var(--card-border)]"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-[var(--accent-red)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { data, error, isLoading } = useSWR<SettingsData>('settings', fetchSettings);

  const handleUpdate = () => {
    mutate('settings');
    // Also invalidate dashboard data to reflect new tokens
    mutate('dashboard');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="card text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load settings</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="card animate-pulse">
          <div className="h-20 bg-[var(--card-border)] rounded mb-4" />
          <div className="h-20 bg-[var(--card-border)] rounded mb-4" />
          <div className="h-20 bg-[var(--card-border)] rounded" />
        </div>
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
        <div className="text-sm text-[var(--text-muted)]">
          {configuredCount} of {tokens.length} tokens configured
        </div>
      </div>

      {/* Redis Status */}
      <div
        className={`card !py-3 flex items-center gap-3 ${
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
            <p className="text-sm text-[var(--text-muted)]">
              Add <code className="bg-[var(--card-border)] px-1 rounded">REDIS_URL</code> to
              enable token storage. Tokens will fall back to environment variables.
            </p>
          )}
        </div>
      </div>

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

      {/* Info Box */}
      <div className="card bg-[var(--card-border)] !border-0">
        <h3 className="font-semibold mb-2">How token storage works</h3>
        <ul className="text-sm text-[var(--text-muted)] space-y-1">
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
      </div>
    </div>
  );
}
