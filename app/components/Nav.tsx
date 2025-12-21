'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { RepoWithDetails, getRecentCommits } from '@/lib/github';
import { timeAgo } from '@/lib/utils';

interface DashboardData {
  repos: RepoWithDetails[];
  hasToken: boolean;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
}

export default function Nav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data } = useSWR<DashboardData>('dashboard', fetchDashboardData);
  const commits = data?.repos ? getRecentCommits(data.repos, 10) : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)] transition-colors"
          title="Recent Activity"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
          </svg>
          {commits.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent)] rounded-full" />
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--card-border)]">
              <h3 className="font-semibold text-sm">Recent Activity</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {commits.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                  No recent commits
                </div>
              ) : (
                <div className="divide-y divide-[var(--card-border)]">
                  {commits.map((commit) => (
                    <a
                      key={commit.sha}
                      href={commit.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 px-4 py-3 hover:bg-[var(--card-border)] transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--card-border)] overflow-hidden">
                        {commit.author?.avatar_url ? (
                          <img
                            src={commit.author.avatar_url}
                            alt={commit.author.login}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">
                            {commit.commit.author.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                          {commit.commit.message.split('\n')[0]}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                          <span className="text-[var(--accent)]">{commit.repoName}</span>
                          <span>{timeAgo(commit.commit.author.date)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  const { data } = useSWR<DashboardData>('/api/github-nav', fetchDashboardData, {
    refreshInterval: 60000,
    revalidateOnFocus: true,
    revalidateIfStale: true,
    revalidateOnMount: true,
  });

  // Calculate total security alerts
  const totalAlerts = data?.repos ? data.repos.reduce((total, repo) => {
    const dependabotCount = repo.securityAlerts?.dependabot?.length || 0;
    const codeScanningCount = repo.securityAlerts?.codeScanning?.length || 0;
    const secretScanningCount = repo.securityAlerts?.secretScanning?.length || 0;
    return total + dependabotCount + codeScanningCount + secretScanningCount;
  }, 0) : 0;

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/repos', label: 'Repositories' },
    { href: '/security', label: 'Security', badge: totalAlerts || undefined },
    { href: '/railway', label: 'Railway' },
    { href: '/supabase', label: 'Supabase' },
    { href: '/gcp', label: 'GCP' },
    { href: '/elevenlabs', label: 'ElevenLabs' },
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors relative ${
            pathname === link.href
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]'
          }`}
        >
          {link.label}
          {link.badge !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 text-xs font-semibold rounded ${
              pathname === link.href
                ? 'bg-white text-[var(--accent)]'
                : 'bg-[var(--accent-red)] text-white'
            }`}>
              {link.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
