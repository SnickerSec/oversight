'use client';

import { RepoWithDetails } from '@/lib/github';
import { timeAgo, getSeverityColor } from '@/lib/utils';

interface SecurityAlertsProps {
  repos: RepoWithDetails[];
  hasToken: boolean;
}

export default function SecurityAlerts({ repos, hasToken }: SecurityAlertsProps) {
  const allDependabot = repos.flatMap(repo =>
    repo.securityAlerts?.dependabot?.map(alert => ({ ...alert, repoName: repo.name })) || []
  );
  const allCodeScanning = repos.flatMap(repo =>
    repo.securityAlerts?.codeScanning?.map(alert => ({ ...alert, repoName: repo.name })) || []
  );
  const allSecretScanning = repos.flatMap(repo =>
    repo.securityAlerts?.secretScanning?.map(alert => ({ ...alert, repoName: repo.name })) || []
  );

  const totalAlerts = allDependabot.length + allCodeScanning.length + allSecretScanning.length;

  // Count by severity for all alert types
  const severityCounts = {
    critical:
      allDependabot.filter(a => a.security_advisory?.severity?.toLowerCase() === 'critical').length +
      allCodeScanning.filter(a => a.rule?.severity?.toLowerCase() === 'critical').length +
      allSecretScanning.length, // All secrets are critical
    high:
      allDependabot.filter(a => a.security_advisory?.severity?.toLowerCase() === 'high').length +
      allCodeScanning.filter(a => a.rule?.severity?.toLowerCase() === 'high').length,
    medium:
      allDependabot.filter(a => a.security_advisory?.severity?.toLowerCase() === 'medium').length +
      allCodeScanning.filter(a => a.rule?.severity?.toLowerCase() === 'medium').length,
    low:
      allDependabot.filter(a => a.security_advisory?.severity?.toLowerCase() === 'low').length +
      allCodeScanning.filter(a => a.rule?.severity?.toLowerCase() === 'low').length,
  };

  if (!hasToken) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
            <path d="M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Zm.61 1.429a.25.25 0 0 0-.153 0l-5.25 1.68a.25.25 0 0 0-.174.238V7c0 1.358.275 2.666 1.057 3.86.784 1.194 2.121 2.34 4.366 3.297a.196.196 0 0 0 .154 0c2.245-.956 3.582-2.104 4.366-3.298C13.225 9.666 13.5 8.36 13.5 7V3.48a.251.251 0 0 0-.174-.237l-5.25-1.68ZM8.75 4.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 1.5 0ZM9 10.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
          </svg>
          Security Alerts
        </h2>
        <div className="text-center py-6">
          <svg className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4 4a4 4 0 1 1 2.5 3.7L2.8 12.4a.5.5 0 0 1-.8-.4V9.8a.5.5 0 0 1 .1-.3l3-3A4 4 0 0 1 4 4Zm4-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
          </svg>
          <p className="text-[var(--text-muted)] mb-3">GitHub token required for security alerts</p>
          <p className="text-sm text-[var(--text-muted)]">
            Add <code className="bg-[var(--card-border)] px-1 rounded">GITHUB_TOKEN</code> to <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Required scopes: <code className="bg-[var(--card-border)] px-1 rounded">repo</code>, <code className="bg-[var(--card-border)] px-1 rounded">security_events</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dependabot and Code Scanning side by side */}
      {(allDependabot.length > 0 || allCodeScanning.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Dependabot Alerts List */}
          <div className="card overflow-hidden">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--accent-orange)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
              </svg>
              Dependabot Alerts
              <span className="badge bg-[var(--accent-orange)] text-white text-xs">{allDependabot.length}</span>
            </h2>
            {allDependabot.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden">
                {allDependabot.slice(0, 20).map((alert) => (
                  <a
                    key={`${alert.repoName}-${alert.number}`}
                    href={alert.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm border-b border-[var(--card-border)] pb-2 last:border-0 hover:bg-[var(--card-border)] -mx-2 px-2 py-1 rounded"
                  >
                    <span className={`badge h-fit text-xs shrink-0 ${getSeverityColor(alert.security_advisory?.severity)}`}>
                      {alert.security_advisory?.severity || '?'}
                    </span>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="font-medium truncate">
                        {alert.security_advisory?.summary || 'Security vulnerability'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        <span className="text-[var(--accent)]">{alert.repoName}</span>
                        {' · '}
                        <span>{alert.security_vulnerability?.package?.name}</span>
                        {alert.security_advisory?.cve_id && (
                          <span> · {alert.security_advisory.cve_id}</span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No alerts</p>
            )}
          </div>

          {/* Code Scanning Alerts List */}
          <div className="card overflow-hidden">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Z"/>
              </svg>
              Code Scanning Alerts
              <span className="badge bg-[var(--accent-purple)] text-white text-xs">{allCodeScanning.length}</span>
            </h2>
            {allCodeScanning.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden">
                {allCodeScanning.slice(0, 20).map((alert) => (
                  <a
                    key={`${alert.repoName}-${alert.number}`}
                    href={alert.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm border-b border-[var(--card-border)] pb-2 last:border-0 hover:bg-[var(--card-border)] -mx-2 px-2 py-1 rounded"
                  >
                    <span className={`badge h-fit text-xs shrink-0 ${getSeverityColor(alert.rule?.severity)}`}>
                      {alert.rule?.severity || '?'}
                    </span>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="font-medium truncate">
                        {alert.rule?.description || alert.rule?.name || 'Code issue'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        <span className="text-[var(--accent)]">{alert.repoName}</span>
                        {' · '}
                        <span>{alert.most_recent_instance?.location?.path}:{alert.most_recent_instance?.location?.start_line}</span>
                        {' · '}
                        <span>{alert.tool?.name}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No alerts</p>
            )}
          </div>
        </div>
      )}

      {/* Secret Scanning Alerts List */}
      {allSecretScanning.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-red)]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 4a4 4 0 1 1 2.5 3.7L2.8 12.4a.5.5 0 0 1-.8-.4V9.8a.5.5 0 0 1 .1-.3l3-3A4 4 0 0 1 4 4Zm4-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
            </svg>
            Secret Scanning Alerts
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allSecretScanning.slice(0, 20).map((alert) => (
              <div key={`${alert.repoName}-${alert.number}`} className="flex gap-3 text-sm border-b border-[var(--card-border)] pb-3 last:border-0">
                <span className="badge bg-[var(--accent-red)] text-white h-fit">
                  secret
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={alert.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--accent)] block font-medium"
                  >
                    {alert.secret_type_display_name || alert.secret_type}
                  </a>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-[var(--accent)]">{alert.repoName}</span>
                    {alert.push_protection_bypassed && (
                      <span className="bg-[var(--accent-orange)] text-black px-1 rounded">bypassed</span>
                    )}
                    <span>{timeAgo(alert.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Alerts Message */}
      {totalAlerts === 0 && (
        <div className="card text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-[var(--accent-green)]" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
          </svg>
          <p className="text-[var(--accent-green)] font-semibold">All Clear!</p>
          <p className="text-sm text-[var(--text-muted)]">No security alerts found across your repositories</p>
        </div>
      )}
    </div>
  );
}
