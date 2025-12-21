/**
 * Shared constants for the Oversight Dashboard
 */

/**
 * Color mappings for programming languages
 * Used for displaying language indicators in repository cards
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
};

/**
 * Default color for languages not in the mapping
 */
export const DEFAULT_LANGUAGE_COLOR = '#8b949e';

/**
 * Severity level colors for security alerts
 */
export const SEVERITY_COLORS = {
  critical: '#f85149',
  high: '#db6d28',
  medium: '#d29922',
  low: '#8b949e',
} as const;
