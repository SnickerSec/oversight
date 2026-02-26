'use client';

import { RepoWithDetails } from '@/lib/github';
import { Card } from '@/components/ui/card';
import { BookMarked, Star, GitFork, CircleDot, GitPullRequest, AlertTriangle, Zap, KeyRound, ShieldAlert, Scale, BookOpen, Heart, TrainFront } from 'lucide-react';

interface StatsOverviewProps {
  repos: RepoWithDetails[];
}

export default function StatsOverview({ repos }: StatsOverviewProps) {
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
  const totalIssues = repos.reduce((sum, repo) => sum + repo.issues.length, 0);
  const totalPRs = repos.reduce((sum, repo) => sum + repo.pullRequests.length, 0);

  const allDependabot = repos.flatMap(repo => repo.securityAlerts?.dependabot || []);
  const allCodeScanning = repos.flatMap(repo => repo.securityAlerts?.codeScanning || []);
  const allSecretScanning = repos.flatMap(repo => repo.securityAlerts?.secretScanning || []);

  const reposWithSecurityPolicy = repos.filter(r => r.security?.hasSecurityPolicy).length;
  const reposWithLicense = repos.filter(r => r.security?.hasLicense).length;
  const reposWithCodeOfConduct = repos.filter(r => r.security?.hasCodeOfConduct).length;
  const avgHealthScore = repos.length > 0
    ? Math.round(repos.reduce((sum, r) => sum + (r.security?.healthPercentage || 0), 0) / repos.length)
    : 0;

  const reposWithRailway = repos.filter(r => r.railway).length;
  const railwayLive = repos.filter(r => r.railway?.deploymentStatus?.toUpperCase() === 'SUCCESS').length;
  const railwayFailed = repos.filter(r => ['FAILED', 'CRASHED'].includes(r.railway?.deploymentStatus?.toUpperCase() || '')).length;

  const reposWithSupabase = repos.filter(r => r.supabase).length;
  const supabaseHealthy = repos.filter(r => r.supabase?.status?.toUpperCase() === 'ACTIVE_HEALTHY').length;
  const supabaseIssues = repos.filter(r => ['INIT_FAILED', 'REMOVED'].includes(r.supabase?.status?.toUpperCase() || '')).length;

  const stats = [
    {
      label: 'Repositories',
      value: repos.length,
      icon: <BookMarked className="w-5 h-5" />,
      color: 'text-[var(--accent)]',
    },
    {
      label: 'Total Stars',
      value: totalStars,
      icon: <Star className="w-5 h-5" />,
      color: 'text-[var(--accent-orange)]',
    },
    {
      label: 'Total Forks',
      value: totalForks,
      icon: <GitFork className="w-5 h-5" />,
      color: 'text-[var(--foreground)]',
    },
    {
      label: 'Open Issues',
      value: totalIssues,
      icon: <CircleDot className="w-5 h-5" />,
      color: 'text-[var(--accent-green)]',
    },
    {
      label: 'Open PRs',
      value: totalPRs,
      icon: <GitPullRequest className="w-5 h-5" />,
      color: 'text-[var(--accent-purple)]',
    },
    {
      label: 'Dependabot',
      value: allDependabot.length,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: allDependabot.length > 0 ? 'text-[var(--accent-orange)]' : 'text-[var(--accent-green)]',
    },
    {
      label: 'Code Scan',
      value: allCodeScanning.length,
      icon: <Zap className="w-5 h-5" />,
      color: allCodeScanning.length > 0 ? 'text-[var(--accent-purple)]' : 'text-[var(--accent-green)]',
    },
    {
      label: 'Secrets',
      value: allSecretScanning.length,
      icon: <KeyRound className="w-5 h-5" />,
      color: allSecretScanning.length > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]',
    },
    ...(reposWithRailway > 0 ? [{
      label: 'Railway',
      value: `${railwayLive}/${reposWithRailway}`,
      icon: <TrainFront className="w-5 h-5" />,
      color: railwayFailed > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]',
    }] : []),
    ...(reposWithSupabase > 0 ? [{
      label: 'Supabase',
      value: `${supabaseHealthy}/${reposWithSupabase}`,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 109 113" fill="currentColor">
          <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-35.151 54.347Z"/>
          <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-35.151 54.347Z" fillOpacity=".2"/>
          <path d="M45.317 2.07c2.86-3.601 8.657-1.628 8.726 2.97l.442 67.251H9.83c-8.19 0-12.759-9.46-7.665-15.875L45.317 2.07Z"/>
        </svg>
      ),
      color: supabaseIssues > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]',
    }] : []),
  ];

  const securityStats = [
    {
      label: 'Security Policy',
      value: reposWithSecurityPolicy,
      total: repos.length,
      icon: <ShieldAlert className="w-5 h-5" />,
      color: reposWithSecurityPolicy === repos.length ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]',
    },
    {
      label: 'Licensed',
      value: reposWithLicense,
      total: repos.length,
      icon: <Scale className="w-5 h-5" />,
      color: reposWithLicense === repos.length ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]',
    },
    {
      label: 'Code of Conduct',
      value: reposWithCodeOfConduct,
      total: repos.length,
      icon: <BookOpen className="w-5 h-5" />,
      color: reposWithCodeOfConduct === repos.length ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]',
    },
    {
      label: 'Health Score',
      value: `${avgHealthScore}%`,
      isPercentage: true,
      icon: <Heart className="w-5 h-5" />,
      color: avgHealthScore >= 70 ? 'text-[var(--accent-green)]' : avgHealthScore >= 40 ? 'text-[var(--accent-orange)]' : 'text-[var(--accent-red)]',
    },
  ];

  const allStats = [
    ...stats,
    ...securityStats.map(stat => ({
      ...stat,
      value: stat.isPercentage ? stat.value : `${stat.value}/${stat.total}`,
    })),
  ];

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
      {allStats.map((stat) => (
        <Card key={stat.label} className="p-2 text-center">
          <div className={`flex justify-center mb-1 ${stat.color} [&>svg]:w-4 [&>svg]:h-4`}>
            {stat.icon}
          </div>
          <div className="text-lg font-bold">{stat.value}</div>
          <div className="text-[10px] text-muted-foreground leading-tight">{stat.label}</div>
        </Card>
      ))}
    </div>
  );
}
