'use client';

import { RepoWithDetails } from '@/lib/github';
import { timeAgo, getSeverityColor, normalizeSeverity } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, KeyRound, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';

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

  if (!hasToken) {
    return (
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[var(--accent-orange)]" />
          Security Alerts
        </h2>
        <div className="text-center py-6">
          <KeyRound className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-3">GitHub token required for security alerts</p>
          <p className="text-sm text-muted-foreground">
            Add <code className="bg-[var(--card-border)] px-1 rounded">GITHUB_TOKEN</code> to <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Required scopes: <code className="bg-[var(--card-border)] px-1 rounded">repo</code>, <code className="bg-[var(--card-border)] px-1 rounded">security_events</code>
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {(allDependabot.length > 0 || allCodeScanning.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 overflow-hidden">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--accent-orange)]" />
              Dependabot Alerts
              <Badge className="rounded-full bg-[var(--accent-orange)] text-white">{allDependabot.length}</Badge>
            </h2>
            {allDependabot.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden">
                {allDependabot.slice(0, 20).map((alert) => (
                  <a
                    key={`${alert.repoName}-${alert.number}`}
                    href={alert.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm border-b border-border pb-2 last:border-0 hover:bg-[var(--card-border)] -mx-2 px-2 py-1 rounded"
                  >
                    <Badge className={`rounded-full h-fit shrink-0 ${getSeverityColor(alert.security_advisory?.severity)}`}>
                      {normalizeSeverity(alert.security_advisory?.severity)}
                    </Badge>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="font-medium truncate">
                        {alert.security_advisory?.summary || 'Security vulnerability'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
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
              <p className="text-sm text-muted-foreground">No alerts</p>
            )}
          </Card>

          <Card className="p-4 overflow-hidden">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--accent-purple)]" />
              Code Scanning Alerts
              <Badge className="rounded-full bg-[var(--accent-purple)] text-white">{allCodeScanning.length}</Badge>
            </h2>
            {allCodeScanning.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden">
                {allCodeScanning.slice(0, 20).map((alert) => (
                  <a
                    key={`${alert.repoName}-${alert.number}`}
                    href={alert.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm border-b border-border pb-2 last:border-0 hover:bg-[var(--card-border)] -mx-2 px-2 py-1 rounded"
                  >
                    <Badge className={`rounded-full h-fit shrink-0 ${getSeverityColor(alert.rule?.severity)}`}>
                      {normalizeSeverity(alert.rule?.severity)}
                    </Badge>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="font-medium truncate">
                        {alert.rule?.description || alert.rule?.name || 'Code issue'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
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
              <p className="text-sm text-muted-foreground">No alerts</p>
            )}
          </Card>
        </div>
      )}

      {allSecretScanning.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[var(--accent-red)]" />
            Secret Scanning Alerts
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allSecretScanning.slice(0, 20).map((alert) => (
              <div key={`${alert.repoName}-${alert.number}`} className="flex gap-3 text-sm border-b border-border pb-3 last:border-0">
                <Badge className="rounded-full bg-[var(--accent-red)] text-white h-fit">
                  secret
                </Badge>
                <div className="flex-1 min-w-0">
                  <a
                    href={alert.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--accent)] block font-medium"
                  >
                    {alert.secret_type_display_name || alert.secret_type}
                  </a>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-[var(--accent)]">{alert.repoName}</span>
                    {alert.push_protection_bypassed && (
                      <Badge className="rounded bg-[var(--accent-orange)] text-black px-1 py-0 text-xs">bypassed</Badge>
                    )}
                    <span>{timeAgo(alert.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {totalAlerts === 0 && (
        <Card className="p-4 text-center py-8">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-[var(--accent-green)]" />
          <p className="text-[var(--accent-green)] font-semibold">All Clear!</p>
          <p className="text-sm text-muted-foreground">No security alerts found across your repositories</p>
        </Card>
      )}
    </div>
  );
}
