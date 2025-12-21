'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';

interface GCPCloudRunService {
  name: string;
  uid: string;
  uri?: string;
  updateTime: string;
  conditions?: Array<{
    type: string;
    state: string;
  }>;
}

interface GCPCloudFunction {
  name: string;
  state: string;
  updateTime: string;
  buildConfig?: {
    runtime: string;
  };
  serviceConfig?: {
    uri?: string;
  };
}

interface GCPComputeInstance {
  id: string;
  name: string;
  zone: string;
  machineType: string;
  status: string;
  networkInterfaces?: Array<{
    networkIP: string;
    accessConfigs?: Array<{
      natIP?: string;
    }>;
  }>;
}

interface GCPStorageBucket {
  name: string;
  location: string;
  storageClass: string;
  timeCreated: string;
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

interface GCPData {
  cloudRun: GCPCloudRunService[];
  functions: GCPCloudFunction[];
  compute: GCPComputeInstance[];
  storage: GCPStorageBucket[];
  enabledServices: GCPEnabledService[];
  projectId: string | null;
}

interface DashboardData {
  gcp: GCPData;
  hasGCPToken: boolean;
}

type TabType = 'cloudrun' | 'functions' | 'compute' | 'storage' | 'services';

async function fetchData(): Promise<DashboardData> {
  const response = await fetch('/api/github');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

function getStatusColor(status: string): string {
  const s = status.toUpperCase();
  if (s === 'RUNNING' || s === 'ACTIVE' || s === 'READY' || s === 'TRUE') {
    return 'text-[var(--accent-green)]';
  }
  if (s === 'STOPPED' || s === 'TERMINATED' || s === 'FAILED' || s === 'FALSE') {
    return 'text-[var(--accent-red)]';
  }
  if (s === 'PENDING' || s === 'STAGING' || s === 'DEPLOYING' || s === 'BUILDING') {
    return 'text-[var(--accent-orange)]';
  }
  return 'text-[var(--text-muted)]';
}

function getStatusBgColor(status: string): string {
  const s = status.toUpperCase();
  if (s === 'RUNNING' || s === 'ACTIVE' || s === 'READY' || s === 'TRUE') {
    return 'bg-[var(--accent-green)]';
  }
  if (s === 'STOPPED' || s === 'TERMINATED' || s === 'FAILED' || s === 'FALSE') {
    return 'bg-[var(--accent-red)]';
  }
  if (s === 'PENDING' || s === 'STAGING' || s === 'DEPLOYING' || s === 'BUILDING') {
    return 'bg-[var(--accent-orange)]';
  }
  return 'bg-[var(--text-muted)]';
}

function GCPLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-8.825-6.893zM8.073 19.807a4.928 4.928 0 0 1-2.089-.456 4.95 4.95 0 0 1-2.666-5.066 4.93 4.93 0 0 1 1.354-2.58l.013-.014.011-.012a7.578 7.578 0 0 1 5.473-2.32 5.07 5.07 0 0 1 .085-.001c.2.002 4.12.07 5.473 2.321l.012.012.012.014a4.93 4.93 0 0 1 1.354 2.58 4.95 4.95 0 0 1-2.666 5.066 4.93 4.93 0 0 1-2.089.456H8.073z"/>
    </svg>
  );
}

function extractServiceName(fullName: string): string {
  const parts = fullName.split('/');
  return parts[parts.length - 1];
}

function extractZone(zone: string): string {
  const parts = zone.split('/');
  return parts[parts.length - 1];
}

function extractMachineType(machineType: string): string {
  const parts = machineType.split('/');
  return parts[parts.length - 1];
}

export default function GCPPage() {
  const [activeTab, setActiveTab] = useState<TabType>('cloudrun');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const { data, error, isLoading } = useSWR<DashboardData>('gcp', fetchData, {
    refreshInterval: 60000,
  });

  const gcp = data?.gcp;
  const hasGCPToken = data?.hasGCPToken ?? false;

  const stats = useMemo(() => ({
    cloudRun: gcp?.cloudRun?.length || 0,
    functions: gcp?.functions?.length || 0,
    compute: gcp?.compute?.length || 0,
    storage: gcp?.storage?.length || 0,
    enabledServices: gcp?.enabledServices?.length || 0,
    runningVMs: gcp?.compute?.filter(vm => vm.status === 'RUNNING').length || 0,
    activeFunctions: gcp?.functions?.filter(f => f.state === 'ACTIVE').length || 0,
  }), [gcp]);

  const filteredItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    let items: any[] = [];

    switch (activeTab) {
      case 'cloudrun':
        items = (gcp?.cloudRun || []).filter(s => {
          const matchesSearch = extractServiceName(s.name).toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;

          if (statusFilter === 'all') return true;
          const readyCondition = s.conditions?.find(c => c.type === 'Ready');
          const status = readyCondition?.state || 'UNKNOWN';

          if (statusFilter === 'healthy') return status.toUpperCase() === 'TRUE' || status.toUpperCase() === 'READY';
          if (statusFilter === 'unhealthy') return status.toUpperCase() === 'FALSE' || status.toUpperCase() === 'FAILED';
          if (statusFilter === 'pending') return status.toUpperCase() === 'UNKNOWN' || status.toUpperCase() === 'PENDING';

          return true;
        });
        break;
      case 'functions':
        items = (gcp?.functions || []).filter(f => {
          const matchesSearch = extractServiceName(f.name).toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;

          if (statusFilter === 'all') return true;
          if (statusFilter === 'healthy') return f.state === 'ACTIVE';
          if (statusFilter === 'unhealthy') return f.state === 'FAILED';
          if (statusFilter === 'pending') return ['DEPLOYING', 'BUILDING', 'STAGING'].includes(f.state);

          return true;
        });
        break;
      case 'compute':
        items = (gcp?.compute || []).filter(vm => {
          const matchesSearch = vm.name.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;

          if (statusFilter === 'all') return true;
          if (statusFilter === 'healthy') return vm.status === 'RUNNING';
          if (statusFilter === 'unhealthy') return ['TERMINATED', 'STOPPED'].includes(vm.status);
          if (statusFilter === 'pending') return ['PENDING', 'STAGING', 'PROVISIONING'].includes(vm.status);

          return true;
        });
        break;
      case 'storage':
        items = (gcp?.storage || []).filter(b =>
          b.name.toLowerCase().includes(searchLower)
        );
        break;
      case 'services':
        items = (gcp?.enabledServices || []).filter(s =>
          s.title.toLowerCase().includes(searchLower) ||
          s.name.toLowerCase().includes(searchLower)
        );
        break;
    }

    return items;
  }, [gcp, activeTab, search, statusFilter]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <GCPLogo className="w-7 h-7" />
          Google Cloud Platform
        </h1>
        <div className="card text-center py-12">
          <p className="text-[var(--accent-red)]">Failed to load GCP data</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <GCPLogo className="w-7 h-7" />
          Google Cloud Platform
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 bg-[var(--card-border)] rounded mb-2" />
              <div className="h-4 w-16 bg-[var(--card-border)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasGCPToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <GCPLogo className="w-7 h-7" />
          Google Cloud Platform
        </h1>
        <div className="card text-center py-12">
          <GCPLogo className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h2 className="text-xl font-semibold mb-2">GCP Credentials Required</h2>
          <p className="text-[var(--text-muted)] mb-4">Connect your GCP project to see resources</p>
          <p className="text-sm text-[var(--text-muted)]">
            Add <code className="bg-[var(--card-border)] px-1 rounded">GCP_PROJECT_ID</code> and{' '}
            <code className="bg-[var(--card-border)] px-1 rounded">GCP_SERVICE_ACCOUNT_KEY</code> to{' '}
            <code className="bg-[var(--card-border)] px-1 rounded">.env.local</code>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Create a service account at{' '}
            <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              console.cloud.google.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <GCPLogo className="w-7 h-7" />
          Google Cloud Platform
        </h1>
        <a
          href={`https://console.cloud.google.com/home/dashboard?project=${gcp?.projectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
        >
          Open GCP Console
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Project ID */}
      {gcp?.projectId && (
        <div className="text-sm text-[var(--text-muted)]">
          Project: <span className="text-[var(--foreground)]">{gcp.projectId}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">{stats.cloudRun}</div>
          <div className="text-sm text-[var(--text-muted)]">Cloud Run</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-orange)]">{stats.functions}</div>
          <div className="text-sm text-[var(--text-muted)]">Functions</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats.compute}</div>
          <div className="text-sm text-[var(--text-muted)]">VMs</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-green)]">{stats.runningVMs}</div>
          <div className="text-sm text-[var(--text-muted)]">Running</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-purple)]">{stats.storage}</div>
          <div className="text-sm text-[var(--text-muted)]">Buckets</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent-green)]">{stats.activeFunctions}</div>
          <div className="text-sm text-[var(--text-muted)]">Active Fn</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">{stats.enabledServices}</div>
          <div className="text-sm text-[var(--text-muted)]">APIs</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--card-border)]">
        {[
          { id: 'cloudrun' as const, label: 'Cloud Run', count: stats.cloudRun },
          { id: 'functions' as const, label: 'Functions', count: stats.functions },
          { id: 'compute' as const, label: 'Compute', count: stats.compute },
          { id: 'storage' as const, label: 'Storage', count: stats.storage },
          { id: 'services' as const, label: 'APIs & Services', count: stats.enabledServices },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {activeTab !== 'storage' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="unhealthy">Unhealthy</option>
            <option value="pending">Pending</option>
          </select>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="card text-center py-12">
            <GCPLogo className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">No {activeTab} resources found</p>
          </div>
        ) : (
          <>
            {/* Cloud Run Services */}
            {activeTab === 'cloudrun' && (filteredItems as GCPCloudRunService[]).map((service) => {
              const name = extractServiceName(service.name);
              const readyCondition = service.conditions?.find(c => c.type === 'Ready');
              const status = readyCondition?.state || 'UNKNOWN';
              const isExpanded = expandedServices.has(service.uid);
              const hasConditions = service.conditions && service.conditions.length > 1;

              return (
                <div key={service.uid} className="card !p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatusBgColor(status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{name}</h3>
                        <span className={`text-sm ${getStatusColor(status)}`}>{status}</span>
                        {hasConditions && (
                          <button
                            onClick={() => {
                              const next = new Set(expandedServices);
                              if (next.has(service.uid)) {
                                next.delete(service.uid);
                              } else {
                                next.add(service.uid);
                              }
                              setExpandedServices(next);
                            }}
                            className="text-xs px-2 py-0.5 rounded bg-[var(--card-border)] hover:bg-[var(--accent)]/20 flex items-center gap-1"
                          >
                            {service.conditions?.length} condition{service.conditions?.length !== 1 ? 's' : ''}
                            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                        {service.uri && (
                          <a href={service.uri} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate max-w-xs">
                            {service.uri.replace('https://', '')}
                          </a>
                        )}
                        <span>Updated: {timeAgo(service.updateTime)}</span>
                      </div>

                      {/* Expanded Conditions */}
                      {isExpanded && service.conditions && (
                        <div className="mt-3 space-y-2">
                          <h4 className="text-sm font-medium">Service Conditions</h4>
                          {service.conditions.map((condition, i) => (
                            <div key={i} className="text-sm p-2 rounded bg-[var(--background)] border border-[var(--card-border)] flex items-center justify-between">
                              <span className="font-medium">{condition.type}</span>
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${getStatusColor(condition.state)}`}>
                                {condition.state}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <a
                      href={`https://console.cloud.google.com/run/detail/${service.name.split('/')[3]}/${name}?project=${gcp?.projectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-md hover:bg-[var(--card-border)]"
                    >
                      View
                    </a>
                  </div>
                </div>
              );
            })}

            {/* Cloud Functions */}
            {activeTab === 'functions' && (filteredItems as GCPCloudFunction[]).map((fn) => {
              const name = extractServiceName(fn.name);
              const location = fn.name.split('/')[3];

              return (
                <div key={fn.name} className="card !p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatusBgColor(fn.state)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{name}</h3>
                        <span className={`text-sm ${getStatusColor(fn.state)}`}>{fn.state}</span>
                        {fn.buildConfig?.runtime && (
                          <span className="text-xs px-2 py-0.5 bg-[var(--card-border)] rounded">{fn.buildConfig.runtime}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                        <span>Region: {location}</span>
                        {fn.serviceConfig?.uri && (
                          <a href={fn.serviceConfig.uri} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate max-w-xs">
                            {fn.serviceConfig.uri.replace('https://', '')}
                          </a>
                        )}
                        <span>Updated: {timeAgo(fn.updateTime)}</span>
                      </div>
                    </div>
                    <a
                      href={`https://console.cloud.google.com/functions/details/${location}/${name}?project=${gcp?.projectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-md hover:bg-[var(--card-border)]"
                    >
                      View
                    </a>
                  </div>
                </div>
              );
            })}

            {/* Compute Instances */}
            {activeTab === 'compute' && (filteredItems as GCPComputeInstance[]).map((vm) => {
              const zone = extractZone(vm.zone);
              const machineType = extractMachineType(vm.machineType);
              const externalIP = vm.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
              const internalIP = vm.networkInterfaces?.[0]?.networkIP;

              return (
                <div key={vm.id} className="card !p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatusBgColor(vm.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{vm.name}</h3>
                        <span className={`text-sm ${getStatusColor(vm.status)}`}>{vm.status}</span>
                        <span className="text-xs px-2 py-0.5 bg-[var(--card-border)] rounded">{machineType}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                        <span>Zone: {zone}</span>
                        {internalIP && <span>Internal: {internalIP}</span>}
                        {externalIP && <span>External: {externalIP}</span>}
                      </div>
                    </div>
                    <a
                      href={`https://console.cloud.google.com/compute/instancesDetail/zones/${zone}/instances/${vm.name}?project=${gcp?.projectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-md hover:bg-[var(--card-border)]"
                    >
                      View
                    </a>
                  </div>
                </div>
              );
            })}

            {/* Storage Buckets */}
            {activeTab === 'storage' && (filteredItems as GCPStorageBucket[]).map((bucket) => (
              <div key={bucket.name} className="card !p-4">
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 rounded-full mt-1.5 bg-[var(--accent-purple)]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{bucket.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-[var(--card-border)] rounded">{bucket.storageClass}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                      <span>Location: {bucket.location}</span>
                      <span>Created: {timeAgo(bucket.timeCreated)}</span>
                    </div>
                  </div>
                  <a
                    href={`https://console.cloud.google.com/storage/browser/${bucket.name}?project=${gcp?.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-md hover:bg-[var(--card-border)]"
                  >
                    View
                  </a>
                </div>
              </div>
            ))}

            {/* Enabled APIs & Services */}
            {activeTab === 'services' && (filteredItems as GCPEnabledService[]).map((service) => (
              <div key={service.name} className="card !p-4">
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 rounded-full mt-1.5 bg-[var(--accent-green)]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{service.title}</h3>
                      <span className="text-xs px-2 py-0.5 bg-[var(--accent-green)] text-white rounded">{service.state}</span>
                      {service.usage && service.usage.requestCount > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-[var(--accent)] text-white rounded">
                          {service.usage.requestCount.toLocaleString()} requests
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mb-2">
                      {service.name}
                    </div>
                    {service.usage && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                          </svg>
                          {service.usage.requestCount.toLocaleString()} requests (7d)
                        </span>
                        {service.usage.errorCount > 0 && (
                          <span className="flex items-center gap-1 text-[var(--accent-red)]">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                            </svg>
                            {service.usage.errorCount} errors
                          </span>
                        )}
                        {service.cost && (
                          <span className="flex items-center gap-1 text-[var(--accent-orange)]">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718H4zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73l.348.086z"/>
                            </svg>
                            ${service.cost.amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <a
                    href={`https://console.cloud.google.com/apis/library/${service.name.split('/').pop()}?project=${gcp?.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-md hover:bg-[var(--card-border)]"
                  >
                    View
                  </a>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
