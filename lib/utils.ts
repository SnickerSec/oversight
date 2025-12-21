/**
 * Shared utility functions for the Oversight Dashboard
 */

/**
 * Formats a date string into a human-readable relative time
 * @param date - ISO date string
 * @returns Relative time string (e.g., "just now", "5m ago", "2d ago")
 */
export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * Returns the Tailwind CSS classes for a security severity level
 * @param severity - Severity level (critical, high, medium, low)
 * @returns CSS class string for badge styling
 */
export function getSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-[#f85149] text-white';
    case 'high':
      return 'bg-[#db6d28] text-white';
    case 'medium':
      return 'bg-[#d29922] text-black';
    case 'low':
      return 'bg-[#8b949e] text-white';
    default:
      return 'bg-[var(--card-border)] text-[var(--foreground)]';
  }
}

/**
 * Returns the sort order for a severity level (lower = more severe)
 * @param severity - Severity level
 * @returns Numeric sort order (0 = critical, 4 = unknown)
 */
export function getSeverityOrder(severity: string): number {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    default:
      return 4;
  }
}
