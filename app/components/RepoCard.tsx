'use client';

import { RepoWithDetails } from '@/lib/github';
import { LANGUAGE_COLORS, DEFAULT_LANGUAGE_COLOR } from '@/lib/constants';
import { getRailwayStatusColor, getRailwayStatusLabel } from '@/lib/railway';
import { getSupabaseStatusColor, getSupabaseStatusLabel } from '@/lib/supabase';
import { Star, GitFork, ExternalLink, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RepoCardProps {
  repo: RepoWithDetails;
}

export default function RepoCard({ repo }: RepoCardProps) {
  const langColor = repo.language ? LANGUAGE_COLORS[repo.language] || DEFAULT_LANGUAGE_COLOR : DEFAULT_LANGUAGE_COLOR;
  const securityIssueCount =
    (repo.securityAlerts?.dependabot?.length || 0) +
    (repo.securityAlerts?.codeScanning?.length || 0) +
    (repo.securityAlerts?.secretScanning?.length || 0);

  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="h-full"
    >
      <Card className="p-3 h-full flex flex-col hover:border-[var(--accent)] transition-colors cursor-pointer">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[var(--accent)] font-medium text-sm truncate">
            {repo.name}
          </span>
          {repo.private && (
            <Badge variant="outline" className="rounded text-[10px] px-1 py-0 text-[var(--accent-orange)] border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/20">
              <svg className="w-2.5 h-2.5 mr-0.5" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z"/>
              </svg>
              private
            </Badge>
          )}
          {repo.fork && (
            <Badge variant="secondary" className="rounded text-[10px] px-1 py-0">fork</Badge>
          )}
          {repo.railway && (
            <span
              className={`flex items-center gap-1 text-[10px] ${getRailwayStatusColor(repo.railway.deploymentStatus)}`}
              title={`Railway: ${repo.railway.projectName} (${repo.railway.environmentName})`}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.113 10.27A2.333 2.333 0 0 0 0 11.005v1.986a2.38 2.38 0 0 0 .113.739l8.695-1.264zm8.695 2.64L.113 14.175c.087.253.2.493.335.717l7.307-1.063 1.043-.152zm1.044 2.378-7.307 1.063a2.428 2.428 0 0 0 .638.588l5.626-.819 1.043-.152zm1.044-9.216 7.307-1.063a2.428 2.428 0 0 0-.638-.588l-5.626.819-1.043.152zm-1.044 2.378 7.307-1.063a2.38 2.38 0 0 0-.335-.717L9.217 7.733l-1.043.152 1.678-.485zM.448 15.48a2.337 2.337 0 0 0 .556.39l11.04-1.607 1.043-.152L.448 15.48zm12.639-1.37 1.043-.151 8.695-1.265a2.38 2.38 0 0 0 .112-.739v-1.986a2.38 2.38 0 0 0-.112-.739l-8.695 1.265-1.043.152 8.808 2.54-8.808.923zm10.458-5.792a2.337 2.337 0 0 0-.556-.39L11.95 9.536l-1.043.152 12.638-1.37zM1.578 4.71a2.295 2.295 0 0 0-.746.57l7.973 2.302.696-.101-7.923-2.77zm21.582 14.5c.249-.162.47-.362.66-.592l-7.913-2.286-.756.11 8.009 2.769zm-9.213-3.177-11.04 1.607a2.295 2.295 0 0 0 .746.57l7.923-2.77 1.674.486.697.107zm-1.044-2.377 11.04-1.608a2.295 2.295 0 0 0-.746-.57l-7.923 2.77-1.674-.486-.697-.106z"/>
              </svg>
              {getRailwayStatusLabel(repo.railway.deploymentStatus)}
            </span>
          )}
          {repo.supabase && (
            <span
              className={`flex items-center gap-1 text-[10px] ${getSupabaseStatusColor(repo.supabase.status)}`}
              title={`Supabase: ${repo.supabase.projectName} (${repo.supabase.region})`}
            >
              <svg className="w-3 h-3" viewBox="0 0 109 113" fill="currentColor">
                <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-35.151 54.347Z"/>
                <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-35.151 54.347Z" fillOpacity=".2"/>
                <path d="M45.317 2.07c2.86-3.601 8.657-1.628 8.726 2.97l.442 67.251H9.83c-8.19 0-12.759-9.46-7.665-15.875L45.317 2.07Z"/>
              </svg>
              {getSupabaseStatusLabel(repo.supabase.status)}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-2 line-clamp-1 flex-1">
          {repo.description || '\u00A0'}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-auto">
          {repo.language && (
            <span className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: langColor }}
              />
              {repo.language}
            </span>
          )}

          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" />
            {repo.stargazers_count}
          </span>

          <span className="flex items-center gap-1">
            <GitFork className="w-3 h-3" />
            {repo.forks_count}
          </span>

          {repo.open_issues_count > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
              </svg>
              {repo.open_issues_count}
            </span>
          )}

          {securityIssueCount > 0 ? (
            <span className="flex items-center gap-1 text-[var(--accent-red)]" title={`${securityIssueCount} open security alert${securityIssueCount !== 1 ? 's' : ''}`}>
              <ShieldAlert className="w-3 h-3" />
              {securityIssueCount}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[var(--accent-green)]" title="No open security alerts">
              <ShieldAlert className="w-3 h-3" />
              0
            </span>
          )}

          {repo.railway?.deploymentUrl && (
            <span
              className="flex items-center gap-1 text-[var(--accent-green)] hover:underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(`https://${repo.railway!.deploymentUrl}`, '_blank');
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Live
            </span>
          )}

          <span className="ml-auto">
            {new Date(repo.updated_at).toLocaleDateString()}
          </span>
        </div>
      </Card>
    </a>
  );
}
