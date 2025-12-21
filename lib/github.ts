const GITHUB_USERNAME = 'SnickerSec';
const BASE_URL = 'https://api.github.com';

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  fork: boolean;
}

export interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  pull_request?: object;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  draft: boolean;
}

export interface LanguageStats {
  [language: string]: number;
}

export interface SecurityInfo {
  hasSecurityPolicy: boolean;
  hasLicense: boolean;
  licenseName: string | null;
  hasCodeOfConduct: boolean;
  hasContributing: boolean;
  healthPercentage: number;
}

export interface DependabotAlert {
  number: number;
  state: string;
  security_advisory: {
    severity: string;
    summary: string;
    description: string;
    cve_id: string | null;
  };
  security_vulnerability: {
    package: {
      name: string;
      ecosystem: string;
    };
    severity: string;
    vulnerable_version_range: string;
  };
  created_at: string;
  html_url: string;
}

export interface CodeScanningAlert {
  number: number;
  state: string;
  rule: {
    severity: string;
    description: string;
    name: string;
  };
  tool: {
    name: string;
  };
  most_recent_instance: {
    location: {
      path: string;
      start_line: number;
    };
  };
  created_at: string;
  html_url: string;
}

export interface SecretScanningAlert {
  number: number;
  state: string;
  secret_type: string;
  secret_type_display_name: string;
  created_at: string;
  html_url: string;
  push_protection_bypassed: boolean | null;
}

export interface SecurityAlerts {
  dependabot: DependabotAlert[];
  codeScanning: CodeScanningAlert[];
  secretScanning: SecretScanningAlert[];
}

export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  actor: {
    login: string;
    avatar_url: string;
  };
  event: string;
}

export interface RailwayInfo {
  projectId: string;
  projectName: string;
  serviceId: string;
  serviceName: string;
  environmentName: string;
  deploymentStatus?: string;
  deploymentUrl?: string;
  lastDeployedAt?: string;
}

export interface SupabaseLint {
  name: string;
  title: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  categories: string[];
  description: string;
  detail: string;
  remediation: string;
  metadata: {
    name: string;
    type: string;
    schema: string;
    [key: string]: unknown;
  };
}

export interface SupabaseAdvisors {
  performance: SupabaseLint[];
  security: SupabaseLint[];
}

export interface SupabaseInfo {
  projectId: string;
  projectName: string;
  region: string;
  status: string;
  createdAt: string;
  advisors?: SupabaseAdvisors;
}

export interface RepoWithDetails extends Repository {
  commits: Commit[];
  issues: Issue[];
  pullRequests: PullRequest[];
  languages: LanguageStats;
  workflowRuns: WorkflowRun[];
  security: SecurityInfo;
  securityAlerts: SecurityAlerts;
  railway?: RailwayInfo;
  supabase?: SupabaseInfo;
}

async function fetchGitHub<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchUserRepos(): Promise<Repository[]> {
  return fetchGitHub<Repository[]>(`/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`);
}

export async function fetchRepoCommits(repoName: string, limit = 5): Promise<Commit[]> {
  try {
    return await fetchGitHub<Commit[]>(`/repos/${GITHUB_USERNAME}/${repoName}/commits?per_page=${limit}`);
  } catch {
    return [];
  }
}

export async function fetchRepoIssues(repoName: string): Promise<Issue[]> {
  try {
    const issues = await fetchGitHub<Issue[]>(`/repos/${GITHUB_USERNAME}/${repoName}/issues?state=open&per_page=10`);
    return issues.filter(issue => !issue.pull_request);
  } catch {
    return [];
  }
}

export async function fetchRepoPRs(repoName: string): Promise<PullRequest[]> {
  try {
    return await fetchGitHub<PullRequest[]>(`/repos/${GITHUB_USERNAME}/${repoName}/pulls?state=open&per_page=10`);
  } catch {
    return [];
  }
}

export async function fetchRepoLanguages(repoName: string): Promise<LanguageStats> {
  try {
    return await fetchGitHub<LanguageStats>(`/repos/${GITHUB_USERNAME}/${repoName}/languages`);
  } catch {
    return {};
  }
}

export async function fetchAllData(): Promise<RepoWithDetails[]> {
  const repos = await fetchUserRepos();

  const reposWithDetails = await Promise.all(
    repos.map(async (repo) => {
      const [commits, issues, pullRequests, languages] = await Promise.all([
        fetchRepoCommits(repo.name),
        fetchRepoIssues(repo.name),
        fetchRepoPRs(repo.name),
        fetchRepoLanguages(repo.name),
      ]);

      return {
        ...repo,
        commits,
        issues,
        pullRequests,
        languages,
        workflowRuns: [],
        security: {
          hasSecurityPolicy: false,
          hasLicense: false,
          licenseName: null,
          hasCodeOfConduct: false,
          hasContributing: false,
          healthPercentage: 0,
        },
        securityAlerts: {
          dependabot: [],
          codeScanning: [],
          secretScanning: [],
        },
      };
    })
  );

  return reposWithDetails;
}

export function aggregateLanguages(repos: RepoWithDetails[]): LanguageStats {
  const aggregate: LanguageStats = {};

  repos.forEach(repo => {
    Object.entries(repo.languages).forEach(([lang, bytes]) => {
      aggregate[lang] = (aggregate[lang] || 0) + bytes;
    });
  });

  return aggregate;
}

export function getRecentCommits(repos: RepoWithDetails[], limit = 10): (Commit & { repoName: string })[] {
  const allCommits = repos.flatMap(repo =>
    repo.commits.map(commit => ({ ...commit, repoName: repo.name }))
  );

  return allCommits
    .sort((a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime())
    .slice(0, limit);
}
