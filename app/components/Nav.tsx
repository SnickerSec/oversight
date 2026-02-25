'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { Menu } from 'lucide-react';
import { RepoWithDetails, getRecentCommits } from '@/lib/github';
import { timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

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
  const { data } = useSWR<DashboardData>('dashboard', fetchDashboardData);
  const commits = data?.repos ? getRecentCommits(data.repos, 10) : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-[var(--text-muted)] hover:text-[var(--foreground)]"
          title="Recent Activity"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
          </svg>
          {commits.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent)] rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Recent Activity</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {commits.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No recent commits
            </div>
          ) : (
            <div className="divide-y divide-border">
              {commits.map((commit) => (
                <a
                  key={commit.sha}
                  href={commit.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 px-4 py-3 hover:bg-[var(--card-border)] transition-colors"
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
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="text-[var(--accent)]">{commit.repoName}</span>
                      <span>{timeAgo(commit.commit.author.date)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { href: '/repos', label: 'Repos' },
    { href: '/security', label: 'Security', badge: totalAlerts || undefined },
    { href: '/railway', label: 'Railway' },
    { href: '/supabase', label: 'Supabase' },
    { href: '/gcp', label: 'GCP' },
    { href: '/elevenlabs', label: 'ElevenLabs' },
    { href: '/costs', label: 'Costs' },
  ];

  return (
    <>
      {/* Mobile hamburger - Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-[var(--text-muted)] hover:text-[var(--foreground)]"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-[var(--background)]">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 mt-4">
            {[...links, { href: '/settings', label: 'Settings' }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-between ${
                  pathname === link.href
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]'
                }`}
              >
                {link.label}
                {'badge' in link && link.badge !== undefined && (
                  <Badge className={`rounded-full ${
                    pathname === link.href
                      ? 'bg-white text-[var(--accent)]'
                      : 'bg-[var(--accent-red)] text-white'
                  }`}>
                    {link.badge}
                  </Badge>
                )}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop nav */}
      <nav className="hidden lg:flex items-center gap-1">
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
              <Badge className={`ml-1.5 rounded-full ${
                pathname === link.href
                  ? 'bg-white text-[var(--accent)]'
                  : 'bg-[var(--accent-red)] text-white'
              }`}>
                {link.badge}
              </Badge>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}
