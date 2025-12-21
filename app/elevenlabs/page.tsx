'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';

interface ElevenLabsSubscription {
  tier: string;
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix: number;
  voice_limit: number;
  voice_add_edit_counter: number;
  can_use_instant_voice_cloning: boolean;
  can_use_professional_voice_cloning: boolean;
  status: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

interface ElevenLabsHistoryItem {
  history_item_id: string;
  voice_id: string;
  voice_name: string;
  text: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  state: string;
}

interface ElevenLabsData {
  subscription: ElevenLabsSubscription | null;
  voices: ElevenLabsVoice[];
  history: ElevenLabsHistoryItem[];
}

interface DashboardData {
  elevenLabs: ElevenLabsData;
  hasElevenLabsToken: boolean;
}

type TabType = 'overview' | 'voices' | 'history';

async function fetchData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

function timeAgo(unixTime: number): string {
  const seconds = Math.floor((Date.now() / 1000) - unixTime);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(unixTime * 1000).toLocaleDateString();
}

function formatDate(unixTime: number): string {
  return new Date(unixTime * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ElevenLabsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4h2v16H7V4zm8 0h2v16h-2V4z"/>
    </svg>
  );
}

export default function ElevenLabsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [search, setSearch] = useState('');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<DashboardData>('elevenlabs', fetchData, {
    refreshInterval: 60000,
  });

  const elevenLabs = data?.elevenLabs;
  const hasElevenLabsToken = data?.hasElevenLabsToken ?? false;
  const subscription = elevenLabs?.subscription;

  const stats = useMemo(() => {
    const usedChars = subscription?.character_count || 0;
    const limitChars = subscription?.character_limit || 1;
    const usagePercent = Math.round((usedChars / limitChars) * 100);

    return {
      tier: subscription?.tier || 'Unknown',
      usedChars,
      limitChars,
      usagePercent,
      voiceCount: elevenLabs?.voices?.length || 0,
      voiceLimit: subscription?.voice_limit || 0,
      historyCount: elevenLabs?.history?.length || 0,
      resetDate: subscription?.next_character_count_reset_unix
        ? formatDate(subscription.next_character_count_reset_unix)
        : 'N/A',
    };
  }, [subscription, elevenLabs]);

  const filteredVoices = useMemo(() => {
    if (!search) return elevenLabs?.voices || [];
    const searchLower = search.toLowerCase();
    return (elevenLabs?.voices || []).filter(v =>
      v.name.toLowerCase().includes(searchLower) ||
      v.category.toLowerCase().includes(searchLower)
    );
  }, [elevenLabs?.voices, search]);

  const filteredHistory = useMemo(() => {
    if (!search) return elevenLabs?.history || [];
    const searchLower = search.toLowerCase();
    return (elevenLabs?.history || []).filter(h =>
      h.voice_name.toLowerCase().includes(searchLower) ||
      h.text.toLowerCase().includes(searchLower)
    );
  }, [elevenLabs?.history, search]);

  const playPreview = (voiceId: string, previewUrl?: string) => {
    if (!previewUrl) return;

    if (playingVoice === voiceId) {
      setPlayingVoice(null);
      return;
    }

    const audio = new Audio(previewUrl);
    audio.onended = () => setPlayingVoice(null);
    audio.play();
    setPlayingVoice(voiceId);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <ElevenLabsLogo className="w-7 h-7" />
          ElevenLabs
        </h1>
        <div className="card text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load ElevenLabs data</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <ElevenLabsLogo className="w-7 h-7" />
          ElevenLabs
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 bg-[var(--card-border)] rounded mb-2" />
              <div className="h-4 w-16 bg-[var(--card-border)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasElevenLabsToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <ElevenLabsLogo className="w-7 h-7" />
          ElevenLabs
        </h1>
        <div className="card text-center py-12">
          <ElevenLabsLogo className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h2 className="text-xl font-semibold mb-2">ElevenLabs API Key Required</h2>
          <p className="text-[var(--text-muted)] mb-4">Connect your ElevenLabs account to see usage</p>
          <p className="text-sm text-[var(--text-muted)]">
            Add <code className="bg-[var(--card-border)] px-1 rounded">ELEVENLABS_API_KEY</code> to{' '}
            <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Get your API key at{' '}
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              elevenlabs.io/app/settings/api-keys
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <ElevenLabsLogo className="w-7 h-7" />
          ElevenLabs
        </h1>
        <a
          href="https://elevenlabs.io/app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
        >
          Open ElevenLabs
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Subscription Tier */}
      <div className="text-sm text-[var(--text-muted)]">
        Plan: <span className="text-[var(--foreground)] font-medium">{stats.tier}</span>
        {subscription?.status && (
          <span className={`ml-2 ${subscription.status === 'active' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]'}`}>
            ({subscription.status})
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-[var(--text-muted)] mb-2">Character Usage</div>
          <div className="text-2xl font-bold">
            {stats.usedChars.toLocaleString()} <span className="text-sm font-normal text-[var(--text-muted)]">/ {stats.limitChars.toLocaleString()}</span>
          </div>
          <div className="mt-2 h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                stats.usagePercent > 90 ? 'bg-[var(--accent-red)]' :
                stats.usagePercent > 70 ? 'bg-[var(--accent-orange)]' :
                'bg-[var(--accent-green)]'
              }`}
              style={{ width: `${Math.min(stats.usagePercent, 100)}%` }}
            />
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{stats.usagePercent}% used</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats.voiceCount}</div>
          <div className="text-sm text-[var(--text-muted)]">Voices</div>
          <div className="text-xs text-[var(--text-muted)]">Limit: {stats.voiceLimit}</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">{stats.historyCount}</div>
          <div className="text-sm text-[var(--text-muted)]">Recent Items</div>
        </div>
        <div className="card text-center">
          <div className="text-lg font-bold">{stats.resetDate}</div>
          <div className="text-sm text-[var(--text-muted)]">Quota Reset</div>
        </div>
      </div>

      {/* Features */}
      <div className="flex gap-2 flex-wrap">
        {subscription?.can_use_instant_voice_cloning && (
          <span className="text-xs px-2 py-1 bg-[var(--accent-green)]/20 text-[var(--accent-green)] rounded">
            Instant Voice Cloning
          </span>
        )}
        {subscription?.can_use_professional_voice_cloning && (
          <span className="text-xs px-2 py-1 bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] rounded">
            Professional Voice Cloning
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--card-border)]">
        {[
          { id: 'overview' as const, label: 'Overview' },
          { id: 'voices' as const, label: `Voices (${stats.voiceCount})` },
          { id: 'history' as const, label: `History (${stats.historyCount})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search (for voices and history) */}
      {activeTab !== 'overview' && (
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={activeTab === 'voices' ? 'Search voices...' : 'Search history...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      )}

      {/* Content */}
      <div className="space-y-3">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Voices */}
            <div className="card">
              <h3 className="font-semibold mb-3">Recent Voices</h3>
              <div className="space-y-2">
                {(elevenLabs?.voices || []).slice(0, 5).map(voice => (
                  <div key={voice.voice_id} className="flex items-center justify-between p-2 bg-[var(--background)] rounded">
                    <div>
                      <div className="font-medium text-sm">{voice.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{voice.category}</div>
                    </div>
                    {voice.preview_url && (
                      <button
                        onClick={() => playPreview(voice.voice_id, voice.preview_url)}
                        className="p-1.5 hover:bg-[var(--card-border)] rounded"
                      >
                        {playingVoice === voice.voice_id ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent History */}
            <div className="card">
              <h3 className="font-semibold mb-3">Recent Generations</h3>
              <div className="space-y-2">
                {(elevenLabs?.history || []).slice(0, 5).map(item => (
                  <div key={item.history_item_id} className="p-2 bg-[var(--background)] rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{item.voice_name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{timeAgo(item.date_unix)}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Voices Tab */}
        {activeTab === 'voices' && (
          filteredVoices.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-[var(--text-muted)]">No voices found</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVoices.map(voice => (
                <div key={voice.voice_id} className="card !p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{voice.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-[var(--card-border)] rounded">{voice.category}</span>
                    </div>
                    {voice.preview_url && (
                      <button
                        onClick={() => playPreview(voice.voice_id, voice.preview_url)}
                        className={`p-2 rounded-full ${playingVoice === voice.voice_id ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--card-border)]'}`}
                      >
                        {playingVoice === voice.voice_id ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {voice.description && (
                    <p className="text-sm text-[var(--text-muted)] line-clamp-2">{voice.description}</p>
                  )}
                  {voice.labels && Object.keys(voice.labels).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(voice.labels).map(([key, value]) => (
                        <span key={key} className="text-xs px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded">
                          {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          filteredHistory.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-[var(--text-muted)]">No history found</p>
            </div>
          ) : (
            filteredHistory.map(item => (
              <div key={item.history_item_id} className="card !p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${item.state === 'created' ? 'bg-[var(--accent-green)]' : 'bg-[var(--text-muted)]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{item.voice_name}</h3>
                      <span className="text-xs text-[var(--text-muted)]">{timeAgo(item.date_unix)}</span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] line-clamp-3">{item.text}</p>
                    <div className="text-xs text-[var(--text-muted)] mt-2">
                      Characters: {item.character_count_change_to - item.character_count_change_from}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
