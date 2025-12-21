export interface SupabaseProject {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  database: {
    host: string;
    version: string;
  };
  status: 'ACTIVE_HEALTHY' | 'INACTIVE' | 'INIT_FAILED' | 'REMOVED' | 'RESTORING' | 'UPGRADING' | 'PAUSING' | 'PAUSED' | 'COMING_UP' | 'GOING_DOWN' | 'UNKNOWN';
}

export interface SupabaseData {
  projects: SupabaseProject[];
  hasToken: boolean;
}

export interface RepoSupabaseMapping {
  projectId: string;
  projectName: string;
  region: string;
  status: string;
  createdAt: string;
}

/**
 * Returns the Tailwind CSS text color class for a Supabase project status
 * @param status - Supabase project status
 * @returns CSS class string for text color
 */
export function getSupabaseStatusColor(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'ACTIVE_HEALTHY':
      return 'text-[var(--accent-green)]';
    case 'INACTIVE':
    case 'PAUSED':
    case 'PAUSING':
      return 'text-[var(--text-muted)]';
    case 'INIT_FAILED':
    case 'REMOVED':
      return 'text-[var(--accent-red)]';
    case 'RESTORING':
    case 'UPGRADING':
    case 'COMING_UP':
    case 'GOING_DOWN':
      return 'text-[var(--accent-orange)]';
    default:
      return 'text-[var(--accent)]';
  }
}

/**
 * Returns a human-readable label for a Supabase project status
 * @param status - Supabase project status
 * @returns Human-readable status label
 */
export function getSupabaseStatusLabel(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'ACTIVE_HEALTHY':
      return 'Healthy';
    case 'INACTIVE':
      return 'Inactive';
    case 'INIT_FAILED':
      return 'Failed';
    case 'REMOVED':
      return 'Removed';
    case 'RESTORING':
      return 'Restoring';
    case 'UPGRADING':
      return 'Upgrading';
    case 'PAUSING':
      return 'Pausing';
    case 'PAUSED':
      return 'Paused';
    case 'COMING_UP':
      return 'Starting';
    case 'GOING_DOWN':
      return 'Stopping';
    default:
      return status || 'Unknown';
  }
}

/**
 * Returns the Tailwind CSS background color class for a Supabase project status
 * @param status - Supabase project status
 * @returns CSS class string for background color
 */
export function getSupabaseStatusBgColor(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'ACTIVE_HEALTHY':
      return 'bg-[var(--accent-green)]';
    case 'INACTIVE':
    case 'PAUSED':
    case 'PAUSING':
      return 'bg-[var(--text-muted)]';
    case 'INIT_FAILED':
    case 'REMOVED':
      return 'bg-[var(--accent-red)]';
    case 'RESTORING':
    case 'UPGRADING':
    case 'COMING_UP':
    case 'GOING_DOWN':
      return 'bg-[var(--accent-orange)]';
    default:
      return 'bg-[var(--accent)]';
  }
}
