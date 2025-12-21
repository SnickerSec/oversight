export interface RailwayDeployment {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  staticUrl?: string;
}

export interface RailwayService {
  id: string;
  name: string;
  icon?: string;
  source?: {
    repo?: string;
    branch?: string;
  };
  deployments: RailwayDeployment[];
}

export interface RailwayEnvironment {
  id: string;
  name: string;
}

export interface RailwayProject {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  environments: RailwayEnvironment[];
  services: RailwayService[];
}

export interface RailwayData {
  projects: RailwayProject[];
  hasToken: boolean;
}

// Map GitHub repo full name to Railway project/service
export interface RepoRailwayMapping {
  projectId: string;
  projectName: string;
  serviceId: string;
  serviceName: string;
  environmentId: string;
  environmentName: string;
  latestDeployment?: RailwayDeployment;
}

/**
 * Returns the Tailwind CSS text color class for a Railway deployment status
 * @param status - Railway deployment status
 * @returns CSS class string for text color
 */
export function getRailwayStatusColor(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
      return 'text-[var(--accent-green)]';
    case 'FAILED':
    case 'CRASHED':
      return 'text-[var(--accent-red)]';
    case 'DEPLOYING':
    case 'BUILDING':
    case 'INITIALIZING':
      return 'text-[var(--accent-orange)]';
    case 'REMOVED':
    case 'REMOVING':
      return 'text-[var(--text-muted)]';
    default:
      return 'text-[var(--accent)]';
  }
}

/**
 * Returns a human-readable label for a Railway deployment status
 * @param status - Railway deployment status
 * @returns Human-readable status label
 */
export function getRailwayStatusLabel(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
      return 'Live';
    case 'FAILED':
      return 'Failed';
    case 'CRASHED':
      return 'Crashed';
    case 'DEPLOYING':
      return 'Deploying';
    case 'BUILDING':
      return 'Building';
    case 'INITIALIZING':
      return 'Starting';
    case 'REMOVED':
      return 'Removed';
    default:
      return status || 'Unknown';
  }
}

/**
 * Returns the Tailwind CSS background color class for a Railway deployment status
 * @param status - Railway deployment status
 * @returns CSS class string for background color
 */
export function getRailwayStatusBgColor(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
      return 'bg-[var(--accent-green)]';
    case 'FAILED':
    case 'CRASHED':
      return 'bg-[var(--accent-red)]';
    case 'DEPLOYING':
    case 'BUILDING':
    case 'INITIALIZING':
      return 'bg-[var(--accent-orange)]';
    default:
      return 'bg-[var(--text-muted)]';
  }
}
