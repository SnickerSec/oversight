'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { RepoWithDetails } from '@/lib/github';
import RefreshIndicator from './components/RefreshIndicator';
import { useState, useEffect } from 'react';
import { ChevronRight, AlertTriangle, BookMarked, Star, GitFork, ShieldAlert, TrainFront, Database, Cloud, AudioLines } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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
        <AlertTriangle className="w-16 h-16 text-[var(--accent-red)] mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to load data</h2>
        <p className="text-muted-foreground mb-4">
          {error.message || 'Unable to fetch GitHub data'}
        </p>
        <Button onClick={() => mutate()}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading || !repos) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-5 mx-auto mb-2" />
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-4">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-24 mb-4" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <Skeleton key={j} className="h-12" />
                  ))}
                </div>
              </Card>
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
        <p className="text-muted-foreground text-sm">Monitoring all integrations and services</p>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

        {/* Repositories Card */}
        <Link href="/repos">
          <Card className="p-4 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="font-semibold">Repositories</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-[var(--accent)] mb-2">{totalRepos}</div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {totalStars}
              </span>
              <span className="flex items-center gap-1">
                <GitFork className="w-3 h-3" />
                {totalForks}
              </span>
            </div>
          </Card>
        </Link>

        {/* Security Card */}
        <Link href="/security">
          <Card className="p-4 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[var(--accent-red)]" />
                <h2 className="font-semibold">Security</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-[var(--accent-red)] mb-2">{securityAlerts}</div>
            <div className="text-sm text-muted-foreground">
              {securityAlerts === 0 ? 'No alerts' : 'Active alerts across all repos'}
            </div>
          </Card>
        </Link>

        {/* Railway Card */}
        <Link href="/railway">
          <Card className="p-4 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrainFront className="w-5 h-5 text-[var(--accent-purple)]" />
                <h2 className="font-semibold">Railway</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-[var(--accent-purple)] mb-2">{railwayProjects}</div>
            <div className="text-sm text-muted-foreground">
              {railwayProjects === 0 ? 'No projects' : railwayProjects === 1 ? 'Active project' : 'Active projects'}
            </div>
          </Card>
        </Link>

        {/* Supabase Card */}
        <Link href="/supabase">
          <Card className="p-4 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[var(--accent-green)]" />
                <h2 className="font-semibold">Supabase</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-[var(--accent-green)] mb-2">{supabaseProjects}</div>
            <div className="text-sm text-muted-foreground">
              {supabaseProjects === 0 ? 'No projects' : supabaseProjects === 1 ? 'Database project' : 'Database projects'}
            </div>
          </Card>
        </Link>

        {/* GCP Card */}
        <Link href="/gcp">
          <Card className="p-4 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-[var(--accent-orange)]" />
                <h2 className="font-semibold">GCP</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div className="text-2xl font-bold text-[var(--accent)]">{gcpCloudRun}</div>
                <div className="text-xs text-muted-foreground">Cloud Run</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--accent-orange)]">{gcpFunctions}</div>
                <div className="text-xs text-muted-foreground">Functions</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {gcpCompute} VMs · {gcpStorage} Buckets · {gcpServices} APIs
            </div>
          </Card>
        </Link>

        {/* ElevenLabs Card */}
        <Link href="/elevenlabs">
          <Card className="p-4 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AudioLines className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="font-semibold">ElevenLabs</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-[var(--accent)] mb-2">{elevenLabsVoices}</div>
            <div className="text-sm text-muted-foreground">
              {elevenLabsVoices === 0 ? 'No voices' : elevenLabsVoices === 1 ? 'Voice model' : 'Voice models'}
              {elevenLabsLimit > 0 && ` · ${Math.floor((elevenLabsCharacters / elevenLabsLimit) * 100)}% used`}
            </div>
          </Card>
        </Link>

      </div>
    </div>
  );
}
