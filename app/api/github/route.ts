import { NextResponse } from 'next/server';
import { withCache } from '@/lib/redis';
import { getToken } from '@/lib/settings';
import { trackApiCall } from '@/lib/metrics';

const GITHUB_USERNAME = 'SnickerSec';
const BASE_URL = 'https://api.github.com';
const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';
const SUPABASE_API_URL = 'https://api.supabase.com';

// Token cache for the current request (populated at request time)
let tokens: {
  GITHUB_TOKEN?: string;
  RAILWAY_TOKEN?: string;
  SUPABASE_ACCESS_TOKEN?: string;
  GCP_PROJECT_ID?: string;
  GCP_SERVICE_ACCOUNT_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
} = {};

// Load all tokens from Redis/env at request time
async function loadTokens() {
  const [
    githubToken,
    railwayToken,
    supabaseToken,
    gcpProjectId,
    gcpServiceAccountKey,
    elevenlabsKey,
    slackWebhook,
  ] = await Promise.all([
    getToken('GITHUB_TOKEN'),
    getToken('RAILWAY_TOKEN'),
    getToken('SUPABASE_ACCESS_TOKEN'),
    getToken('GCP_PROJECT_ID'),
    getToken('GCP_SERVICE_ACCOUNT_KEY'),
    getToken('ELEVENLABS_API_KEY'),
    getToken('SLACK_WEBHOOK_URL'),
  ]);

  tokens = {
    GITHUB_TOKEN: githubToken,
    RAILWAY_TOKEN: railwayToken,
    SUPABASE_ACCESS_TOKEN: supabaseToken,
    GCP_PROJECT_ID: gcpProjectId,
    GCP_SERVICE_ACCOUNT_KEY: gcpServiceAccountKey,
    ELEVENLABS_API_KEY: elevenlabsKey,
    SLACK_WEBHOOK_URL: slackWebhook,
  };
}

// Railway data cache (5 minute TTL to avoid rate limits)
const RAILWAY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms
interface RailwayCacheEntry {
  data: RailwayDataResult;
  timestamp: number;
}
let railwayCache: RailwayCacheEntry | null = null;

// Track previous deployment states for alerting
const previousDeploymentStates = new Map<string, string>();

// Send Slack alert for deployment failures
async function sendSlackAlert(serviceName: string, projectName: string, status: string, url?: string): Promise<void> {
  if (!tokens.SLACK_WEBHOOK_URL) return;

  try {
    const emoji = status === 'FAILED' ? '🔴' : status === 'CRASHED' ? '💥' : '⚠️';
    await fetch(tokens.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `${emoji} Railway Deployment ${status}`, emoji: true }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Project:*\n${projectName}` },
              { type: 'mrkdwn', text: `*Service:*\n${serviceName}` }
            ]
          },
          ...(url ? [{
            type: 'section',
            text: { type: 'mrkdwn', text: `<https://railway.app/project/${projectName}|View in Railway>` }
          }] : [])
        ]
      }),
    });
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}

interface Repository {
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
  owner: {
    login: string;
    id: number;
  };
  license: {
    key: string;
    name: string;
    spdx_id: string;
  } | null;
}

interface CommunityProfile {
  health_percentage: number;
  files: {
    code_of_conduct: { url: string } | null;
    contributing: { url: string } | null;
    license: { url: string } | null;
    readme: { url: string } | null;
    security_policy: { url: string } | null;
  };
}

interface DependabotAlert {
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

interface CodeScanningAlert {
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

interface SecretScanningAlert {
  number: number;
  state: string;
  secret_type: string;
  secret_type_display_name: string;
  created_at: string;
  html_url: string;
  push_protection_bypassed: boolean | null;
}

interface WorkflowRun {
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

function getHeaders() {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (tokens.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${tokens.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchGitHub<T>(endpoint: string): Promise<T> {
  trackApiCall('github');
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: getHeaders(),
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    trackApiCall('github', true);
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

async function fetchUserRepos(): Promise<Repository[]> {
  // Use authenticated endpoint to include private repos when token is available
  if (tokens.GITHUB_TOKEN) {
    const allRepos = await fetchGitHub<Repository[]>(`/user/repos?sort=updated&per_page=100&affiliation=owner`);
    // Filter to only repos owned by the user (in case of org repos)
    return allRepos.filter(repo => repo.owner?.login?.toLowerCase() === GITHUB_USERNAME.toLowerCase());
  }
  // Fallback to public repos only
  return fetchGitHub<Repository[]>(`/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`);
}

async function fetchRepoCommits(repoName: string, limit = 5) {
  try {
    return await fetchGitHub(`/repos/${GITHUB_USERNAME}/${repoName}/commits?per_page=${limit}`);
  } catch {
    return [];
  }
}

async function fetchRepoIssues(repoName: string) {
  try {
    const issues = await fetchGitHub<Array<{ pull_request?: object }>>(`/repos/${GITHUB_USERNAME}/${repoName}/issues?state=open&per_page=10`);
    return issues.filter(issue => !issue.pull_request);
  } catch {
    return [];
  }
}

async function fetchRepoPRs(repoName: string) {
  try {
    return await fetchGitHub(`/repos/${GITHUB_USERNAME}/${repoName}/pulls?state=open&per_page=10`);
  } catch {
    return [];
  }
}

async function fetchRepoLanguages(repoName: string) {
  try {
    return await fetchGitHub(`/repos/${GITHUB_USERNAME}/${repoName}/languages`);
  } catch {
    return {};
  }
}

async function fetchCommunityProfile(repoName: string): Promise<CommunityProfile | null> {
  try {
    return await fetchGitHub<CommunityProfile>(`/repos/${GITHUB_USERNAME}/${repoName}/community/profile`);
  } catch {
    return null;
  }
}

async function fetchDependabotAlerts(repoName: string): Promise<DependabotAlert[]> {
  if (!tokens.GITHUB_TOKEN) return [];
  try {
    return await fetchGitHub<DependabotAlert[]>(`/repos/${GITHUB_USERNAME}/${repoName}/dependabot/alerts?state=open&per_page=100`);
  } catch {
    return [];
  }
}

async function fetchCodeScanningAlerts(repoName: string): Promise<CodeScanningAlert[]> {
  if (!tokens.GITHUB_TOKEN) return [];
  try {
    return await fetchGitHub<CodeScanningAlert[]>(`/repos/${GITHUB_USERNAME}/${repoName}/code-scanning/alerts?state=open&per_page=100`);
  } catch {
    return [];
  }
}

async function fetchSecretScanningAlerts(repoName: string): Promise<SecretScanningAlert[]> {
  if (!tokens.GITHUB_TOKEN) return [];
  try {
    return await fetchGitHub<SecretScanningAlert[]>(`/repos/${GITHUB_USERNAME}/${repoName}/secret-scanning/alerts?state=open&per_page=100`);
  } catch {
    return [];
  }
}

async function fetchWorkflowRuns(repoName: string): Promise<WorkflowRun[]> {
  try {
    const response = await fetchGitHub<{ workflow_runs: WorkflowRun[] }>(`/repos/${GITHUB_USERNAME}/${repoName}/actions/runs?per_page=10`);
    return response.workflow_runs || [];
  } catch {
    return [];
  }
}

// Railway API integration
interface RailwayGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface RailwayProjectsResponse {
  me: {
    projects: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          environments: {
            edges: Array<{
              node: {
                id: string;
                name: string;
              };
            }>;
          };
          services: {
            edges: Array<{
              node: {
                id: string;
                name: string;
                repoTriggers: {
                  edges: Array<{
                    node: {
                      repository: string;
                      branch: string;
                    };
                  }>;
                };
              };
            }>;
          };
        };
      }>;
    };
  };
}

interface RailwayDeploymentsResponse {
  deployments: {
    edges: Array<{
      node: {
        id: string;
        status: string;
        createdAt: string;
        staticUrl?: string;
      };
    }>;
  };
}

interface RailwayServiceMapping {
  projectId: string;
  projectName: string;
  serviceId: string;
  serviceName: string;
  environmentId: string;
  environmentName: string;
  repo: string;
}

// Standalone Railway project (not linked to a GitHub repo)
interface RailwayStandaloneProject {
  projectId: string;
  projectName: string;
  serviceId: string;
  serviceName: string;
  environmentId: string;
  environmentName: string;
  deployment?: {
    status: string;
    url?: string;
    createdAt: string;
  };
}

interface RailwayDataResult {
  repoMap: Map<string, RailwayServiceMapping & { deployment?: { status: string; url?: string; createdAt: string } }>;
  standaloneProjects: RailwayStandaloneProject[];
}

interface RailwayWorkspacesResponse {
  me: {
    workspaces: Array<{
      id: string;
      name: string;
      team: {
        id: string;
        name: string;
      };
    }>;
  };
}

interface RailwayTeamProjectsResponse {
  team: {
    projects: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          environments: {
            edges: Array<{
              node: {
                id: string;
                name: string;
              };
            }>;
          };
          services: {
            edges: Array<{
              node: {
                id: string;
                name: string;
                repoTriggers: {
                  edges: Array<{
                    node: {
                      repository: string;
                      branch: string;
                    };
                  }>;
                };
              };
            }>;
          };
        };
      }>;
    };
  };
}

async function fetchRailwayData(): Promise<RailwayDataResult> {
  const repoMap = new Map<string, RailwayServiceMapping & { deployment?: { status: string; url?: string; createdAt: string } }>();
  const standaloneProjects: RailwayStandaloneProject[] = [];

  if (!tokens.RAILWAY_TOKEN) return { repoMap, standaloneProjects };

  // Check cache first
  if (railwayCache && (Date.now() - railwayCache.timestamp) < RAILWAY_CACHE_TTL) {
    return railwayCache.data;
  }

  try {
    // First get workspaces to find team IDs
    trackApiCall('railway');
    const workspacesResponse = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.RAILWAY_TOKEN}`,
      },
      body: JSON.stringify({
        query: `query { me { workspaces { id name team { id name } } } }`,
      }),
    });

    if (!workspacesResponse.ok) {
      trackApiCall('railway', true);
      return { repoMap, standaloneProjects };
    }

    const workspacesData: RailwayGraphQLResponse<RailwayWorkspacesResponse> = await workspacesResponse.json();
    const workspaces = workspacesData.data?.me?.workspaces || [];

    if (workspaces.length === 0) return { repoMap, standaloneProjects };

    // Fetch projects from all teams
    const allProjects: Array<{
      id: string;
      name: string;
      environments: { edges: Array<{ node: { id: string; name: string } }> };
      services: { edges: Array<{ node: { id: string; name: string; repoTriggers: { edges: Array<{ node: { repository: string; branch: string } }> } } }> };
    }> = [];

    for (const workspace of workspaces) {
      trackApiCall('railway');
      const teamProjectsResponse = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.RAILWAY_TOKEN}`,
        },
        body: JSON.stringify({
          query: `
            query($teamId: String!) {
              team(id: $teamId) {
                projects {
                  edges {
                    node {
                      id
                      name
                      environments {
                        edges {
                          node {
                            id
                            name
                          }
                        }
                      }
                      services {
                        edges {
                          node {
                            id
                            name
                            repoTriggers {
                              edges {
                                node {
                                  repository
                                  branch
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { teamId: workspace.team.id },
        }),
      });

      if (teamProjectsResponse.ok) {
        const teamData: RailwayGraphQLResponse<RailwayTeamProjectsResponse> = await teamProjectsResponse.json();
        const projects = teamData.data?.team?.projects?.edges || [];
        allProjects.push(...projects.map(p => p.node));
      }
    }

    // Deduplicate projects by ID (same project can appear in multiple workspaces)
    const seenProjectIds = new Set<string>();
    const uniqueProjects = allProjects.filter(project => {
      if (seenProjectIds.has(project.id)) {
        return false;
      }
      seenProjectIds.add(project.id);
      return true;
    });

    if (uniqueProjects.length === 0) return { repoMap, standaloneProjects };

    // Build mapping of repos to Railway services and track standalone projects
    const servicesToFetch: RailwayServiceMapping[] = [];
    const standaloneServicesToFetch: RailwayStandaloneProject[] = [];

    for (const project of uniqueProjects) {
      const environments = project.environments?.edges?.map(e => e.node) || [];
      const prodEnv = environments.find(e =>
        e.name.toLowerCase() === 'production' || e.name.toLowerCase() === 'prod'
      ) || environments[0];

      if (!prodEnv) continue;

      for (const { node: service } of project.services?.edges || []) {
        const repoTrigger = service.repoTriggers?.edges?.[0]?.node;
        if (repoTrigger?.repository) {
          // Service linked to a GitHub repo
          const mapping: RailwayServiceMapping = {
            projectId: project.id,
            projectName: project.name,
            serviceId: service.id,
            serviceName: service.name,
            environmentId: prodEnv.id,
            environmentName: prodEnv.name,
            repo: repoTrigger.repository,
          };
          servicesToFetch.push(mapping);
          repoMap.set(repoTrigger.repository.toLowerCase(), mapping);
        } else {
          // Standalone service (not linked to GitHub)
          const standaloneProject: RailwayStandaloneProject = {
            projectId: project.id,
            projectName: project.name,
            serviceId: service.id,
            serviceName: service.name,
            environmentId: prodEnv.id,
            environmentName: prodEnv.name,
          };
          standaloneServicesToFetch.push(standaloneProject);
        }
      }
    }

    // Fetch deployments for each service
    await Promise.all(
      servicesToFetch.map(async (mapping) => {
        try {
          trackApiCall('railway');
          const deployResponse = await fetch(RAILWAY_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.RAILWAY_TOKEN}`,
            },
            body: JSON.stringify({
              query: `
                query($projectId: String!, $serviceId: String!, $environmentId: String!) {
                  deployments(
                    first: 1
                    input: {
                      projectId: $projectId
                      serviceId: $serviceId
                      environmentId: $environmentId
                    }
                  ) {
                    edges {
                      node {
                        id
                        status
                        createdAt
                        staticUrl
                      }
                    }
                  }
                }
              `,
              variables: {
                projectId: mapping.projectId,
                serviceId: mapping.serviceId,
                environmentId: mapping.environmentId,
              },
            }),
          });

          if (deployResponse.ok) {
            const deployData: RailwayGraphQLResponse<RailwayDeploymentsResponse> = await deployResponse.json();
            const deployment = deployData.data?.deployments?.edges?.[0]?.node;
            if (deployment) {
              const existing = repoMap.get(mapping.repo.toLowerCase());
              if (existing) {
                repoMap.set(mapping.repo.toLowerCase(), {
                  ...existing,
                  deployment: {
                    status: deployment.status,
                    url: deployment.staticUrl,
                    createdAt: deployment.createdAt,
                  },
                });

                // Check for deployment failures and send alerts
                const serviceKey = `${mapping.projectId}:${mapping.serviceId}`;
                const previousStatus = previousDeploymentStates.get(serviceKey);
                const currentStatus = deployment.status;

                // Alert if status changed to FAILED or CRASHED
                if (previousStatus && previousStatus !== currentStatus &&
                    (currentStatus === 'FAILED' || currentStatus === 'CRASHED')) {
                  sendSlackAlert(mapping.serviceName, mapping.projectName, currentStatus, deployment.staticUrl);
                }

                previousDeploymentStates.set(serviceKey, currentStatus);
              }
            }
          }
        } catch {
          // Ignore individual deployment fetch errors
        }
      })
    );

    // Fetch deployments for standalone services
    await Promise.all(
      standaloneServicesToFetch.map(async (project) => {
        try {
          trackApiCall('railway');
          const deployResponse = await fetch(RAILWAY_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.RAILWAY_TOKEN}`,
            },
            body: JSON.stringify({
              query: `
                query($projectId: String!, $serviceId: String!, $environmentId: String!) {
                  deployments(
                    first: 1
                    input: {
                      projectId: $projectId
                      serviceId: $serviceId
                      environmentId: $environmentId
                    }
                  ) {
                    edges {
                      node {
                        id
                        status
                        createdAt
                        staticUrl
                      }
                    }
                  }
                }
              `,
              variables: {
                projectId: project.projectId,
                serviceId: project.serviceId,
                environmentId: project.environmentId,
              },
            }),
          });

          if (deployResponse.ok) {
            const deployData: RailwayGraphQLResponse<RailwayDeploymentsResponse> = await deployResponse.json();
            const deployment = deployData.data?.deployments?.edges?.[0]?.node;
            if (deployment) {
              project.deployment = {
                status: deployment.status,
                url: deployment.staticUrl,
                createdAt: deployment.createdAt,
              };
            }
          }
        } catch {
          // Ignore individual deployment fetch errors
        }
      })
    );

    // Add standalone projects to the result, but filter out services that belong to
    // projects which already have linked services (to avoid duplicate project names)
    const linkedProjectIds = new Set(servicesToFetch.map(s => s.projectId));
    const filteredStandaloneProjects = standaloneServicesToFetch.filter(
      project => !linkedProjectIds.has(project.projectId)
    );
    standaloneProjects.push(...filteredStandaloneProjects);

    // Update cache
    const result = { repoMap, standaloneProjects };
    railwayCache = { data: result, timestamp: Date.now() };

    return result;
  } catch (error) {
    console.error('Railway fetch error:', error);
    return { repoMap, standaloneProjects };
  }
}

// Supabase API integration
interface SupabaseProject {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  database: {
    host: string;
    version: string;
  };
  status: string;
}

interface SupabaseLint {
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

interface SupabaseAdvisors {
  performance: SupabaseLint[];
  security: SupabaseLint[];
}

interface SupabaseMapping {
  projectId: string;
  projectName: string;
  region: string;
  status: string;
  createdAt: string;
  advisors?: SupabaseAdvisors;
}

// Custom mapping: Supabase project name -> GitHub repo name
// Can be configured via SUPABASE_REPO_MAP environment variable as JSON
// Example: SUPABASE_REPO_MAP='{"chokepidgin":"ispeakpidgin","project1":"repo1"}'
const getSupabaseRepoMap = (): Record<string, string> => {
  const mapEnv = process.env.SUPABASE_REPO_MAP;
  if (mapEnv) {
    try {
      return JSON.parse(mapEnv);
    } catch (error) {
      console.warn('Failed to parse SUPABASE_REPO_MAP environment variable:', error);
    }
  }
  // Default mapping for backwards compatibility
  return {
    'chokepidgin': 'ispeakpidgin',
  };
};

const SUPABASE_TO_REPO_MAP = getSupabaseRepoMap();

async function fetchSupabaseAdvisors(projectId: string): Promise<SupabaseAdvisors> {
  const advisors: SupabaseAdvisors = { performance: [], security: [] };

  try {
    trackApiCall('supabase');
    trackApiCall('supabase');
    const [perfResponse, secResponse] = await Promise.all([
      fetch(`${SUPABASE_API_URL}/v1/projects/${projectId}/advisors/performance`, {
        headers: { 'Authorization': `Bearer ${tokens.SUPABASE_ACCESS_TOKEN}` },
      }),
      fetch(`${SUPABASE_API_URL}/v1/projects/${projectId}/advisors/security`, {
        headers: { 'Authorization': `Bearer ${tokens.SUPABASE_ACCESS_TOKEN}` },
      }),
    ]);

    if (perfResponse.ok) {
      const perfData = await perfResponse.json();
      advisors.performance = perfData.lints || [];
    }
    if (secResponse.ok) {
      const secData = await secResponse.json();
      advisors.security = secData.lints || [];
    }
  } catch (error) {
    console.error('Supabase advisors fetch error:', error);
  }

  return advisors;
}

async function fetchSupabaseData(): Promise<Map<string, SupabaseMapping>> {
  const projectMap = new Map<string, SupabaseMapping>();

  if (!tokens.SUPABASE_ACCESS_TOKEN) return projectMap;

  try {
    trackApiCall('supabase');
    const response = await fetch(`${SUPABASE_API_URL}/v1/projects`, {
      headers: {
        'Authorization': `Bearer ${tokens.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      trackApiCall('supabase', true);
      console.error('Supabase API error:', response.status);
      return projectMap;
    }

    const projects: SupabaseProject[] = await response.json();

    // Fetch advisors for all projects in parallel
    const advisorsResults = await Promise.all(
      projects.map(project => fetchSupabaseAdvisors(project.id))
    );

    // Map projects by name (normalized to lowercase for matching)
    projects.forEach((project, index) => {
      const mapping: SupabaseMapping = {
        projectId: project.id,
        projectName: project.name,
        region: project.region,
        status: project.status,
        createdAt: project.created_at,
        advisors: advisorsResults[index],
      };
      // Check for custom mapping, otherwise use project name
      const repoName = SUPABASE_TO_REPO_MAP[project.name.toLowerCase()] || project.name;
      projectMap.set(repoName.toLowerCase(), mapping);
    });

    return projectMap;
  } catch (error) {
    console.error('Supabase fetch error:', error);
    return projectMap;
  }
}

// GCP Integration
interface GCPCloudRunService {
  name: string;
  uid: string;
  generation: string;
  labels?: Record<string, string>;
  createTime: string;
  updateTime: string;
  creator?: string;
  lastModifier?: string;
  uri?: string;
  reconciling: boolean;
  conditions?: Array<{
    type: string;
    state: string;
    lastTransitionTime: string;
    severity?: string;
    reason?: string;
    message?: string;
  }>;
  latestReadyRevision?: string;
  latestCreatedRevision?: string;
  traffic?: Array<{
    type: string;
    revision?: string;
    percent: number;
    tag?: string;
  }>;
}

interface GCPCloudFunction {
  name: string;
  description?: string;
  state: string;
  updateTime: string;
  buildConfig?: {
    runtime: string;
    entryPoint: string;
    source?: {
      storageSource?: {
        bucket: string;
        object: string;
      };
    };
  };
  serviceConfig?: {
    uri?: string;
    serviceAccountEmail?: string;
    availableMemory?: string;
    timeoutSeconds?: number;
    maxInstanceCount?: number;
  };
  labels?: Record<string, string>;
}

interface GCPComputeInstance {
  id: string;
  name: string;
  description?: string;
  zone: string;
  machineType: string;
  status: string;
  creationTimestamp: string;
  networkInterfaces?: Array<{
    networkIP: string;
    accessConfigs?: Array<{
      natIP?: string;
    }>;
  }>;
  disks?: Array<{
    diskSizeGb: string;
    type: string;
  }>;
  labels?: Record<string, string>;
}

interface GCPStorageBucket {
  name: string;
  location: string;
  storageClass: string;
  timeCreated: string;
  updated: string;
  labels?: Record<string, string>;
}

interface GCPEnabledService {
  name: string;
  title: string;
  state: string;
  usage?: {
    requestCount: number;
    errorCount: number;
    latencyMs: number;
  };
  cost?: {
    amount: number;
    currency: string;
  };
}

interface GCPBillingAccount {
  name: string;
  displayName: string;
  open: boolean;
  masterBillingAccount?: string;
}

interface GCPBillingInfo {
  billingAccountName?: string;
  billingEnabled: boolean;
}

interface GCPBudget {
  name: string;
  displayName: string;
  budgetAmount: {
    specifiedAmount?: {
      currencyCode: string;
      units: string;
    };
  };
  thresholdRules?: Array<{
    thresholdPercent: number;
    spendBasis: string;
  }>;
}

interface GCPCostData {
  billingAccount: GCPBillingAccount | null;
  billingInfo: GCPBillingInfo | null;
  budgets: GCPBudget[];
  currentMonthCost: number | null;
  currency: string;
  lastUpdated: string | null;
  error?: string;
}

interface GCPData {
  cloudRun: GCPCloudRunService[];
  functions: GCPCloudFunction[];
  compute: GCPComputeInstance[];
  storage: GCPStorageBucket[];
  enabledServices: GCPEnabledService[];
  projectId: string | null;
  billing?: GCPCostData;
}

async function getGCPAccessToken(): Promise<string | null> {
  if (!tokens.GCP_SERVICE_ACCOUNT_KEY) return null;

  try {
    const key = JSON.parse(tokens.GCP_SERVICE_ACCOUNT_KEY);
    const now = Math.floor(Date.now() / 1000);

    // Create JWT header and claim
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Base64URL encode
    const base64url = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const headerB64 = base64url(header);
    const claimB64 = base64url(claim);
    const unsignedToken = `${headerB64}.${claimB64}`;

    // Sign with private key
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedToken);
    const signature = sign.sign(key.private_key, 'base64url');

    const jwt = `${unsignedToken}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('GCP auth error:', error);
    return null;
  }
}

async function fetchGCPBillingData(accessToken: string): Promise<GCPCostData> {
  const result: GCPCostData = {
    billingAccount: null,
    billingInfo: null,
    budgets: [],
    currentMonthCost: null,
    currency: 'USD',
    lastUpdated: null,
  };

  const headers = { 'Authorization': `Bearer ${accessToken}` };

  try {
    // 1. Get billing info for the project (which billing account is linked)
    trackApiCall('gcp');
    const billingInfoRes = await fetch(
      `https://cloudbilling.googleapis.com/v1/projects/${tokens.GCP_PROJECT_ID}/billingInfo`,
      { headers }
    );

    if (billingInfoRes.ok) {
      const billingInfo = await billingInfoRes.json();
      result.billingInfo = {
        billingAccountName: billingInfo.billingAccountName,
        billingEnabled: billingInfo.billingEnabled || false,
      };

      // 2. If we have a billing account, get its details
      if (billingInfo.billingAccountName) {
        trackApiCall('gcp');
        const billingAccountRes = await fetch(
          `https://cloudbilling.googleapis.com/v1/${billingInfo.billingAccountName}`,
          { headers }
        );

        if (billingAccountRes.ok) {
          const account = await billingAccountRes.json();
          result.billingAccount = {
            name: account.name,
            displayName: account.displayName,
            open: account.open || false,
            masterBillingAccount: account.masterBillingAccount,
          };

          // 3. Try to get budgets for this billing account
          trackApiCall('gcp');
          const budgetsRes = await fetch(
            `https://billingbudgets.googleapis.com/v1/${billingInfo.billingAccountName}/budgets`,
            { headers }
          );

          if (budgetsRes.ok) {
            const budgetsData = await budgetsRes.json();
            result.budgets = (budgetsData.budgets || []).map((b: any) => ({
              name: b.name,
              displayName: b.displayName || 'Unnamed Budget',
              budgetAmount: b.amount?.specifiedAmount ? {
                specifiedAmount: {
                  currencyCode: b.amount.specifiedAmount.currencyCode || 'USD',
                  units: b.amount.specifiedAmount.units || '0',
                },
              } : { specifiedAmount: undefined },
              thresholdRules: b.thresholdRules,
            }));
          }
        }
      }

      result.lastUpdated = new Date().toISOString();
    } else {
      const error = await billingInfoRes.json().catch(() => ({}));
      result.error = error.error?.message || `HTTP ${billingInfoRes.status}`;
      console.error('GCP Billing API error:', error);
    }
  } catch (error) {
    console.error('GCP billing fetch error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

async function fetchGCPData(): Promise<GCPData> {
  const result: GCPData = {
    cloudRun: [],
    functions: [],
    compute: [],
    storage: [],
    enabledServices: [],
    projectId: tokens.GCP_PROJECT_ID || null,
  };

  if (!tokens.GCP_PROJECT_ID || !tokens.GCP_SERVICE_ACCOUNT_KEY) return result;

  const accessToken = await getGCPAccessToken();
  if (!accessToken) return result;

  const headers = { 'Authorization': `Bearer ${accessToken}` };

  try {
    // Track all GCP API calls (5 parallel calls)
    trackApiCall('gcp');
    trackApiCall('gcp');
    trackApiCall('gcp');
    trackApiCall('gcp');
    trackApiCall('gcp');
    // Fetch all GCP resources in parallel
    const [cloudRunRes, functionsRes, computeRes, storageRes, servicesRes] = await Promise.all([
      // Cloud Run services
      fetch(`https://run.googleapis.com/v2/projects/${tokens.GCP_PROJECT_ID}/locations/-/services`, { headers })
        .then(r => r.ok ? r.json() : { services: [] })
        .catch(() => ({ services: [] })),
      // Cloud Functions
      fetch(`https://cloudfunctions.googleapis.com/v2/projects/${tokens.GCP_PROJECT_ID}/locations/-/functions`, { headers })
        .then(r => r.ok ? r.json() : { functions: [] })
        .catch(() => ({ functions: [] })),
      // Compute Engine instances
      fetch(`https://compute.googleapis.com/compute/v1/projects/${tokens.GCP_PROJECT_ID}/aggregated/instances`, { headers })
        .then(r => r.ok ? r.json() : { items: {} })
        .catch(() => ({ items: {} })),
      // Cloud Storage buckets
      fetch(`https://storage.googleapis.com/storage/v1/b?project=${tokens.GCP_PROJECT_ID}`, { headers })
        .then(r => r.ok ? r.json() : { items: [] })
        .catch(() => ({ items: [] })),
      // Enabled Services
      fetch(`https://serviceusage.googleapis.com/v1/projects/${tokens.GCP_PROJECT_ID}/services?filter=state:ENABLED&pageSize=200`, { headers })
        .then(async r => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ error: 'Unknown error' }));
            console.error('GCP Service Usage API error:', err);
            return { services: [] };
          }
          return r.json();
        })
        .catch(err => {
          console.error('GCP Service Usage API fetch error:', err);
          return { services: [] };
        }),
    ]);

    result.cloudRun = cloudRunRes.services || [];
    result.functions = functionsRes.functions || [];

    // Flatten compute instances from zones
    if (computeRes.items) {
      Object.values(computeRes.items).forEach((zone: unknown) => {
        const zoneData = zone as { instances?: GCPComputeInstance[] };
        if (zoneData.instances) {
          result.compute.push(...zoneData.instances);
        }
      });
    }

    result.storage = storageRes.items || [];

    // Process enabled services
    if (servicesRes.services) {
      const services = servicesRes.services.map((service: any) => ({
        name: service.config?.name || service.name,
        title: service.config?.title || service.name,
        state: service.state || 'ENABLED',
      }));

      // Fetch metrics for enabled services
      const metricsPromises = services.map(async (service: GCPEnabledService) => {
        try {
          // Extract service name (e.g., "compute.googleapis.com" from full name)
          const serviceName = service.name.includes('/')
            ? service.name.split('/').pop() ?? service.name
            : service.name;

          const isGenerativeLanguage = serviceName.includes('generativelanguage');

          // Fetch API usage metrics from Cloud Monitoring using MQL
          const metricsQuery = {
            query: `fetch consumed_api
              | metric 'serviceruntime.googleapis.com/api/request_count'
              | filter resource.service == '${serviceName}'
              | group_by [], [value_request_count_aggregate: sum(value.request_count)]
              | within 7d`,
          };

          trackApiCall('gcp');
          const metricsResponse = await fetch(
            `https://monitoring.googleapis.com/v3/projects/${tokens.GCP_PROJECT_ID}/timeSeries:query`,
            {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(metricsQuery),
            }
          ).catch(err => {
            if (isGenerativeLanguage) {
              console.error(`Metrics fetch error for ${serviceName}:`, err);
            }
            return null;
          });

          if (metricsResponse?.ok) {
            const metricsData = await metricsResponse.json();

            // Sum all data points to get total request count
            let requestCount = 0;
            if (metricsData.timeSeriesData && metricsData.timeSeriesData.length > 0) {
              const timeSeries = metricsData.timeSeriesData[0];
              if (timeSeries.pointData && timeSeries.pointData.length > 0) {
                // Sum all points in the time series
                requestCount = timeSeries.pointData.reduce((sum: number, point: any) => {
                  const value = parseInt(point.values?.[0]?.int64Value || point.values?.[0]?.doubleValue || 0);
                  return sum + value;
                }, 0);
              }
            }

            if (requestCount > 0 || isGenerativeLanguage) {
              service.usage = {
                requestCount: requestCount || 0,
                errorCount: 0,
                latencyMs: 0,
              };
            }
          }
        } catch (error) {
          console.error(`Metrics processing error for ${service.name}:`, error);
        }
        return service;
      });

      result.enabledServices = await Promise.all(metricsPromises);

      // Sort services by request count (utilization)
      result.enabledServices.sort((a, b) => {
        const aCount = a.usage?.requestCount || 0;
        const bCount = b.usage?.requestCount || 0;
        return bCount - aCount;
      });
    }

    // Fetch billing data
    result.billing = await fetchGCPBillingData(accessToken);
  } catch (error) {
    console.error('GCP fetch error:', error);
  }

  return result;
}

// ElevenLabs Integration
interface ElevenLabsSubscription {
  tier: string;
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
  allowed_to_extend_character_limit: boolean;
  next_character_count_reset_unix: number;
  voice_limit: number;
  max_voice_add_edits: number;
  voice_add_edit_counter: number;
  professional_voice_limit: number;
  can_extend_voice_limit: boolean;
  can_use_instant_voice_cloning: boolean;
  can_use_professional_voice_cloning: boolean;
  currency: string;
  status: string;
  billing_period?: string;
  next_invoice?: {
    amount_due_cents: number;
    next_payment_attempt_unix: number;
  };
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
  fine_tuning?: {
    is_allowed_to_fine_tune: boolean;
    finetuning_state?: string;
  };
}

interface ElevenLabsHistoryItem {
  history_item_id: string;
  request_id: string;
  voice_id: string;
  voice_name: string;
  text: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  state: string;
  settings?: {
    stability: number;
    similarity_boost: number;
  };
}

interface ElevenLabsData {
  subscription: ElevenLabsSubscription | null;
  voices: ElevenLabsVoice[];
  history: ElevenLabsHistoryItem[];
}

async function fetchElevenLabsData(): Promise<ElevenLabsData> {
  const result: ElevenLabsData = {
    subscription: null,
    voices: [],
    history: [],
  };

  if (!tokens.ELEVENLABS_API_KEY) return result;

  const headers = { 'xi-api-key': tokens.ELEVENLABS_API_KEY };

  try {
    // Track all 3 ElevenLabs API calls
    trackApiCall('elevenlabs');
    trackApiCall('elevenlabs');
    trackApiCall('elevenlabs');
    const [subRes, voicesRes, historyRes] = await Promise.all([
      // Subscription info
      fetch('https://api.elevenlabs.io/v1/user/subscription', { headers })
        .then(async r => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('ElevenLabs subscription error:', err);
            return null;
          }
          return r.json();
        })
        .catch(err => {
          console.error('ElevenLabs subscription fetch error:', err);
          return null;
        }),
      // Voices
      fetch('https://api.elevenlabs.io/v1/voices', { headers })
        .then(async r => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('ElevenLabs voices error:', err);
            return { voices: [] };
          }
          return r.json();
        })
        .catch(err => {
          console.error('ElevenLabs voices fetch error:', err);
          return { voices: [] };
        }),
      // History
      fetch('https://api.elevenlabs.io/v1/history?page_size=20', { headers })
        .then(async r => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('ElevenLabs history error:', err);
            return { history: [] };
          }
          return r.json();
        })
        .catch(err => {
          console.error('ElevenLabs history fetch error:', err);
          return { history: [] };
        }),
    ]);

    result.subscription = subRes;
    result.voices = voicesRes.voices || [];
    result.history = historyRes.history || [];
  } catch (error) {
    console.error('ElevenLabs fetch error:', error);
  }

  return result;
}

// Cache TTL in seconds (30 seconds for dashboard data)
const CACHE_TTL = 30;

async function fetchDashboardData() {
  // Fetch all data in parallel
  const [repos, railwayData, supabaseMap, gcpData, elevenLabsData] = await Promise.all([
    fetchUserRepos(),
    fetchRailwayData(),
    fetchSupabaseData(),
    fetchGCPData(),
    fetchElevenLabsData(),
  ]);

  const { repoMap: railwayMap, standaloneProjects: railwayStandaloneProjects } = railwayData;

  const reposWithDetails = await Promise.all(
    repos.map(async (repo) => {
      const [
        commits,
        issues,
        pullRequests,
        languages,
        communityProfile,
        dependabotAlerts,
        codeScanningAlerts,
        secretScanningAlerts,
        workflowRuns,
      ] = await Promise.all([
        fetchRepoCommits(repo.name),
        fetchRepoIssues(repo.name),
        fetchRepoPRs(repo.name),
        fetchRepoLanguages(repo.name),
        fetchCommunityProfile(repo.name),
        fetchDependabotAlerts(repo.name),
        fetchCodeScanningAlerts(repo.name),
        fetchSecretScanningAlerts(repo.name),
        fetchWorkflowRuns(repo.name),
      ]);

      // Check if this repo has a Railway deployment
      const railwayKey = `${GITHUB_USERNAME}/${repo.name}`.toLowerCase();
      const railwayInfo = railwayMap.get(railwayKey);

      // Check if this repo has a Supabase project (match by repo name)
      const supabaseInfo = supabaseMap.get(repo.name.toLowerCase());

      return {
        ...repo,
        commits,
        issues,
        pullRequests,
        languages,
        workflowRuns,
        security: {
          hasSecurityPolicy: !!communityProfile?.files?.security_policy,
          hasLicense: !!repo.license,
          licenseName: repo.license?.name || null,
          hasCodeOfConduct: !!communityProfile?.files?.code_of_conduct,
          hasContributing: !!communityProfile?.files?.contributing,
          healthPercentage: communityProfile?.health_percentage || 0,
        },
        securityAlerts: {
          dependabot: dependabotAlerts,
          codeScanning: codeScanningAlerts,
          secretScanning: secretScanningAlerts,
        },
        railway: railwayInfo ? {
          projectId: railwayInfo.projectId,
          projectName: railwayInfo.projectName,
          serviceId: railwayInfo.serviceId,
          serviceName: railwayInfo.serviceName,
          environmentName: railwayInfo.environmentName,
          deploymentStatus: railwayInfo.deployment?.status,
          deploymentUrl: railwayInfo.deployment?.url,
          lastDeployedAt: railwayInfo.deployment?.createdAt,
        } : undefined,
        supabase: supabaseInfo ? {
          projectId: supabaseInfo.projectId,
          projectName: supabaseInfo.projectName,
          region: supabaseInfo.region,
          status: supabaseInfo.status,
          createdAt: supabaseInfo.createdAt,
          advisors: supabaseInfo.advisors,
        } : undefined,
      };
    })
  );

  return {
    repos: reposWithDetails,
    hasToken: !!tokens.GITHUB_TOKEN,
    hasRailwayToken: !!tokens.RAILWAY_TOKEN,
    hasSupabaseToken: !!tokens.SUPABASE_ACCESS_TOKEN,
    hasGCPToken: !!(tokens.GCP_PROJECT_ID && tokens.GCP_SERVICE_ACCOUNT_KEY),
    hasElevenLabsToken: !!tokens.ELEVENLABS_API_KEY,
    gcp: gcpData,
    elevenLabs: elevenLabsData,
    railwayStandaloneProjects,
  };
}

export async function GET() {
  try {
    // Load tokens from Redis/env before fetching data
    await loadTokens();

    // Use Redis cache if available, otherwise fetch directly
    const data = await withCache('dashboard:data', fetchDashboardData, CACHE_TTL);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GitHub API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub data' },
      { status: 500 }
    );
  }
}
