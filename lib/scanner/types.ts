export type ScanStatus = 'pending' | 'cloning' | 'scanning' | 'completed' | 'failed';

export type ScanTool = 'trivy' | 'gitleaks' | 'semgrep';

export interface ScanJob {
  id: string;
  repoName: string;
  repoFullName: string;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  tools: ScanTool[];
  currentTool?: ScanTool;
  progress?: number;
  error?: string;
  results?: ScanResults;
}

export interface ScanResults {
  trivy?: TrivyResult;
  gitleaks?: GitleaksResult;
  semgrep?: SemgrepResult;
  toolErrors?: Record<ScanTool, string>;
}

// Trivy types
export interface TrivyVulnerability {
  id: string;
  pkgName: string;
  installedVersion: string;
  fixedVersion?: string;
  severity: string;
  title: string;
  description: string;
  primaryUrl?: string;
}

export interface TrivyResult {
  vulnerabilities: TrivyVulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  scanTarget: string;
}

// Gitleaks types
export interface GitleaksSecret {
  ruleId: string;
  description: string;
  file: string;
  startLine: number;
  endLine: number;
  commit?: string;
  author?: string;
  date?: string;
  match: string;
}

export interface GitleaksResult {
  secrets: GitleaksSecret[];
  summary: {
    total: number;
    byRule: Record<string, number>;
  };
}

// Semgrep types
export interface SemgrepFinding {
  ruleId: string;
  message: string;
  severity: string;
  path: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  category: string;
  cwe?: string[];
  owasp?: string[];
}

export interface SemgrepResult {
  findings: SemgrepFinding[];
  summary: {
    error: number;
    warning: number;
    info: number;
    byCategory: Record<string, number>;
  };
  debug?: {
    rawOutputLength?: number;
    rawOutputPreview?: string;
    parseError?: string;
  };
}
