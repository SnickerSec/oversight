'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { RepoWithDetails } from '@/lib/github';
import RefreshIndicator from './components/RefreshIndicator';
import { useState, useEffect } from 'react';

const REFRESH_INTERVAL = 60000; // 60 seconds

interface GCPData {
  cloudRun: any[];
  functions: any[];
  compute: any[];
  storage: any[];
  enabledServices: any[];
  projectId: string | null;
}

interface ElevenLabsData {
  subscription: any;
  voices: any[];
  history: any[];
}

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
  gcp?: GCPData;
  elevenLabs?: ElevenLabsData;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
}

export default function Dashboard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    'dashboard',
    fetchDashboardData,
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      onSuccess: () => {
        setLastUpdated(new Date());
      },
    }
  );

  useEffect(() => {
    if (data) {
      setLastUpdated(new Date());
    }
  }, [data]);

  const repos = data?.repos;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <svg className="w-16 h-16 text-[var(--accent-red)] mb-4" fill="currentColor" viewBox="0 0 16 16">
          <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
        </svg>
        <h2 className="text-xl font-semibold mb-2">Failed to load data</h2>
        <p className="text-[var(--text-muted)] mb-4">
          {error.message || 'Unable to fetch GitHub data'}
        </p>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoading || !repos) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 w-5 bg-[var(--card-border)] rounded mx-auto mb-2" />
              <div className="h-8 w-12 bg-[var(--card-border)] rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-[var(--card-border)] rounded mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card animate-pulse">
              <div className="h-6 w-32 bg-[var(--card-border)] rounded mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-[var(--card-border)] rounded" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-6 w-24 bg-[var(--card-border)] rounded mb-4" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-12 bg-[var(--card-border)] rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const totalRepos = repos?.length || 0;
  const totalStars = repos?.reduce((sum, repo) => sum + repo.stargazers_count, 0) || 0;
  const totalForks = repos?.reduce((sum, repo) => sum + repo.forks_count, 0) || 0;

  const securityAlerts = repos?.reduce((total, repo) => {
    const dependabot = repo.securityAlerts?.dependabot?.length || 0;
    const codeScanning = repo.securityAlerts?.codeScanning?.length || 0;
    const secretScanning = repo.securityAlerts?.secretScanning?.length || 0;
    return total + dependabot + codeScanning + secretScanning;
  }, 0) || 0;

  // Count repos with Railway/Supabase integrations
  const railwayProjects = repos?.filter(repo => repo.railway).length || 0;
  const supabaseProjects = repos?.filter(repo => repo.supabase).length || 0;

  const gcpCloudRun = data?.gcp?.cloudRun?.length || 0;
  const gcpFunctions = data?.gcp?.functions?.length || 0;
  const gcpCompute = data?.gcp?.compute?.length || 0;
  const gcpStorage = data?.gcp?.storage?.length || 0;
  const gcpServices = data?.gcp?.enabledServices?.length || 0;

  const elevenLabsVoices = data?.elevenLabs?.voices?.length || 0;
  const elevenLabsCharacters = data?.elevenLabs?.subscription?.character_count || 0;
  const elevenLabsLimit = data?.elevenLabs?.subscription?.character_limit || 0;

  return (
    <div className="space-y-6">
      <RefreshIndicator
        lastUpdated={lastUpdated}
        refreshInterval={REFRESH_INTERVAL}
        onRefresh={() => mutate()}
        isLoading={isLoading}
        repos={repos}
      />

      <div>
        <h1 className="text-2xl font-bold mb-1">Dashboard Overview</h1>
        <p className="text-[var(--text-muted)] text-sm">Monitoring all integrations and services</p>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Repositories Card */}
        <Link href="/repos" className="card hover:border-[var(--accent)] transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
              </svg>
              <h2 className="font-semibold">Repositories</h2>
            </div>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[var(--accent)] mb-2">{totalRepos}</div>
          <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
              </svg>
              {totalStars}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/>
              </svg>
              {totalForks}
            </span>
          </div>
        </Link>

        {/* Security Card */}
        <Link href="/security" className="card hover:border-[var(--accent)] transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-red)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.835.866a1.5 1.5 0 0 0-1.024 1.524L1.1 5.5a7.5 7.5 0 0 0 14.8 0l-.1-2.55a1.5 1.5 0 0 0-1.024-1.524c-.606-.21-1.725-.566-2.835-.866C10.843.265 9.69 0 8 0Zm0 3.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5ZM8 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
              </svg>
              <h2 className="font-semibold">Security</h2>
            </div>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[var(--accent-red)] mb-2">{securityAlerts}</div>
          <div className="text-sm text-[var(--text-muted)]">
            {securityAlerts === 0 ? 'No alerts' : 'Active alerts across all repos'}
          </div>
        </Link>

        {/* Railway Card */}
        <Link href="/railway" className="card hover:border-[var(--accent)] transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 24 12">
                <path d="M0.5 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0zm1.9 0h0.8v12h-0.8V0z"/>
              </svg>
              <h2 className="font-semibold">Railway</h2>
            </div>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[var(--accent-purple)] mb-2">{railwayProjects}</div>
          <div className="text-sm text-[var(--text-muted)]">
            {railwayProjects === 0 ? 'No projects' : railwayProjects === 1 ? 'Active project' : 'Active projects'}
          </div>
        </Link>

        {/* Supabase Card */}
        <Link href="/supabase" className="card hover:border-[var(--accent)] transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16ZM5.496 6.033h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286a.237.237 0 0 0 .241.247Zm2.325 6.443c.61 0 1.029-.394 1.029-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94 0 .533.425.927 1.01.927Z"/>
              </svg>
              <h2 className="font-semibold">Supabase</h2>
            </div>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[var(--accent-green)] mb-2">{supabaseProjects}</div>
          <div className="text-sm text-[var(--text-muted)]">
            {supabaseProjects === 0 ? 'No projects' : supabaseProjects === 1 ? 'Database project' : 'Database projects'}
          </div>
        </Link>

        {/* GCP Card */}
        <Link href="/gcp" className="card hover:border-[var(--accent)] transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6 0a.5.5 0 0 1 .5.5V3h3V.5a.5.5 0 0 1 1 0V3h1a.5.5 0 0 1 .5.5v3A3.5 3.5 0 0 1 8.5 10c-.002.434-.01.845-.04 1.22-.041.514-.126 1.003-.317 1.424a2.083 2.083 0 0 1-.97 1.028C6.725 13.9 6.169 14 5.5 14c-.998 0-1.61.33-1.974.718A1.922 1.922 0 0 0 3 16H2c0-.616.232-1.367.797-1.968C3.374 13.42 4.261 13 5.5 13c.581 0 .962-.088 1.218-.219.241-.123.4-.3.514-.55.121-.266.193-.621.23-1.09.027-.34.035-.718.037-1.141A3.5 3.5 0 0 1 4 6.5v-3a.5.5 0 0 1 .5-.5h1V.5A.5.5 0 0 1 6 0Z"/>
              </svg>
              <h2 className="font-semibold">GCP</h2>
            </div>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="text-2xl font-bold text-[var(--accent)]">{gcpCloudRun}</div>
              <div className="text-xs text-[var(--text-muted)]">Cloud Run</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--accent-orange)]">{gcpFunctions}</div>
              <div className="text-xs text-[var(--text-muted)]">Functions</div>
            </div>
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            {gcpCompute} VMs · {gcpStorage} Buckets · {gcpServices} APIs
          </div>
        </Link>

        {/* ElevenLabs Card */}
        <Link href="/elevenlabs" className="card hover:border-[var(--accent)] transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8.5 2.687c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687ZM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783Z"/>
              </svg>
              <h2 className="font-semibold">ElevenLabs</h2>
            </div>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[var(--accent)] mb-2">{elevenLabsVoices}</div>
          <div className="text-sm text-[var(--text-muted)]">
            {elevenLabsVoices === 0 ? 'No voices' : elevenLabsVoices === 1 ? 'Voice model' : 'Voice models'}
            {elevenLabsLimit > 0 && ` · ${Math.floor((elevenLabsCharacters / elevenLabsLimit) * 100)}% used`}
          </div>
        </Link>

      </div>
    </div>
  );
}
