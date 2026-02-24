'use client';

import { RepoWithDetails } from '@/lib/github';
import { Card } from '@/components/ui/card';

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
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
        </svg>
      ),
      color: 'text-[var(--accent)]',
    },
    {
      label: 'Total Stars',
      value: totalStars,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
        </svg>
      ),
      color: 'text-[var(--accent-orange)]',
    },
    {
      label: 'Total Forks',
      value: totalForks,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/>
        </svg>
      ),
      color: 'text-[var(--foreground)]',
    },
    {
      label: 'Open Issues',
      value: totalIssues,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
        </svg>
      ),
      color: 'text-[var(--accent-green)]',
    },
    {
      label: 'Open PRs',
      value: totalPRs,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/>
        </svg>
      ),
      color: 'text-[var(--accent-purple)]',
    },
    {
      label: 'Dependabot',
      value: allDependabot.length,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
        </svg>
      ),
      color: allDependabot.length > 0 ? 'text-[var(--accent-orange)]' : 'text-[var(--accent-green)]',
    },
    {
      label: 'Code Scan',
      value: allCodeScanning.length,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
        </svg>
      ),
      color: allCodeScanning.length > 0 ? 'text-[var(--accent-purple)]' : 'text-[var(--accent-green)]',
    },
    {
      label: 'Secrets',
      value: allSecretScanning.length,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M4 4a4 4 0 1 1 2.5 3.7L2.8 12.4a.5.5 0 0 1-.8-.4V9.8a.5.5 0 0 1 .1-.3l3-3A4 4 0 0 1 4 4Zm4-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
        </svg>
      ),
      color: allSecretScanning.length > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]',
    },
    ...(reposWithRailway > 0 ? [{
      label: 'Railway',
      value: `${railwayLive}/${reposWithRailway}`,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M.113 10.27A2.333 2.333 0 0 0 0 11.005v1.986a2.38 2.38 0 0 0 .113.739l8.695-1.264zm8.695 2.64L.113 14.175c.087.253.2.493.335.717l7.307-1.063 1.043-.152zm1.044 2.378-7.307 1.063a2.428 2.428 0 0 0 .638.588l5.626-.819 1.043-.152zm1.044-9.216 7.307-1.063a2.428 2.428 0 0 0-.638-.588l-5.626.819-1.043.152zm-1.044 2.378 7.307-1.063a2.38 2.38 0 0 0-.335-.717L9.217 7.733l-1.043.152 1.678-.485zM.448 15.48a2.337 2.337 0 0 0 .556.39l11.04-1.607 1.043-.152L.448 15.48zm12.639-1.37 1.043-.151 8.695-1.265a2.38 2.38 0 0 0 .112-.739v-1.986a2.38 2.38 0 0 0-.112-.739l-8.695 1.265-1.043.152 8.808 2.54-8.808.923zm10.458-5.792a2.337 2.337 0 0 0-.556-.39L11.95 9.536l-1.043.152 12.638-1.37zM1.578 4.71a2.295 2.295 0 0 0-.746.57l7.973 2.302.696-.101-7.923-2.77zm21.582 14.5c.249-.162.47-.362.66-.592l-7.913-2.286-.756.11 8.009 2.769zm-9.213-3.177-11.04 1.607a2.295 2.295 0 0 0 .746.57l7.923-2.77 1.674.486.697.107zm-1.044-2.377 11.04-1.608a2.295 2.295 0 0 0-.746-.57l-7.923 2.77-1.674-.486-.697-.106z"/>
        </svg>
      ),
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
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Zm.61 1.429a.25.25 0 0 0-.153 0l-5.25 1.68a.25.25 0 0 0-.174.238V7c0 1.358.275 2.666 1.057 3.86.784 1.194 2.121 2.34 4.366 3.297a.196.196 0 0 0 .154 0c2.245-.956 3.582-2.104 4.366-3.298C13.225 9.666 13.5 8.36 13.5 7V3.48a.251.251 0 0 0-.174-.237l-5.25-1.68ZM8.75 4.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 1.5 0ZM9 10.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
        </svg>
      ),
      color: reposWithSecurityPolicy === repos.length ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]',
    },
    {
      label: 'Licensed',
      value: reposWithLicense,
      total: repos.length,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.006.005-.01.01a.969.969 0 0 1-.114.09 1.906 1.906 0 0 1-.293.166c-.248.12-.622.25-1.123.25s-.875-.13-1.123-.25a1.906 1.906 0 0 1-.292-.165 1.3 1.3 0 0 1-.114-.091l-.01-.01-.006-.005-.006-.006-.002-.002v-.001a.75.75 0 0 1-.153-.838l2.111-4.693h-.662L11.4 5.2a2.193 2.193 0 0 1-.867.231h-1.33l-1.4 1.573a.995.995 0 0 1-.823.39H5.574a.75.75 0 1 1 0-1.5h1.102l1.4-1.573A.995.995 0 0 1 8.899 4h1.386c.086 0 .172-.023.247-.066l.29-.165h-.287a.75.75 0 0 1 0-1.5h.287l-.29-.165a.682.682 0 0 0-.247-.066H8.899a.995.995 0 0 1-.823-.39L6.676 0h-.5v.75a.75.75 0 0 1-1.5 0V0H2.75a.75.75 0 0 0-.75.75v1.5h.75a.75.75 0 0 1 0 1.5H2v1.5h.75a.75.75 0 0 1 0 1.5H2v1.5h.75a.75.75 0 0 1 0 1.5H2v1.5h.75a.75.75 0 0 1 0 1.5H2v1.5h.75a.75.75 0 0 1 0 1.5H2v.75c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-.75h-.75a.75.75 0 0 1 0-1.5H14v-1.5h-.75a.75.75 0 0 1 0-1.5H14v-1.5h-.75a.75.75 0 0 1 0-1.5H14v-.5h-.5a.75.75 0 0 1-.75-.75V6H5.75a.25.25 0 0 0-.184.08l-1.1 1.236a.75.75 0 0 1-1.119-1.002L4.524 4.85a1.75 1.75 0 0 1 1.31-.6h5.15l.39-.44a1.752 1.752 0 0 1 .578-.4l.124-.072L9.89 2.15a.25.25 0 0 0-.124-.033H8.75V.75a.75.75 0 0 0-1.5 0Zm4.077 6.986L14 5.082l1.173 2.654a.576.576 0 0 1-.076.063.856.856 0 0 1-.097.05c-.118.056-.287.101-.5.101s-.382-.045-.5-.1a.856.856 0 0 1-.097-.05.576.576 0 0 1-.076-.064Z"/>
        </svg>
      ),
      color: reposWithLicense === repos.length ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]',
    },
    {
      label: 'Code of Conduct',
      value: reposWithCodeOfConduct,
      total: repos.length,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
        </svg>
      ),
      color: reposWithCodeOfConduct === repos.length ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]',
    },
    {
      label: 'Health Score',
      value: `${avgHealthScore}%`,
      isPercentage: true,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"/>
        </svg>
      ),
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
