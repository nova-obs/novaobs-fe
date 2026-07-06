import { apiRequest } from '../../services/api';

export interface MetricsServiceSummary {
  id: string;
  name: string;
  displayName: string;
  environment: string;
  cluster: string;
  namespace: string;
  ownerTeam: string;
  identityType: string;
  serviceType: string;
  source: string;
  syncStatus: string;
}

export interface MetricEndpoint {
  id: string;
  name: string;
  description: string;
  endpointType: string;
  remoteWriteURL: string;
  queryURL: string;
  vmuiURL: string;
  accountId: string;
  projectId: string;
  secretRef: string;
  scopeType: string;
  clusterId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricServiceBinding {
  id: string;
  serviceId: string;
  endpointId: string;
  accountId: string;
  projectId: string;
  labelMatch: Record<string, string>;
  basePromQL: string;
  status: string;
  lastProbeStatus: string;
  lastProbeMessage: string;
  lastProbeAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricsWorkspace {
  services: MetricsServiceSummary[];
  activeServiceId: string;
  endpoints: MetricEndpoint[];
  serviceBindings: MetricServiceBinding[];
}

function mapService(raw: any): MetricsServiceSummary {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    displayName: raw.display_name ?? raw.displayName ?? '',
    environment: raw.environment ?? '',
    cluster: raw.cluster ?? '',
    namespace: raw.namespace ?? '',
    ownerTeam: raw.owner_team ?? raw.ownerTeam ?? '',
    identityType: raw.identity_type ?? raw.identityType ?? '',
    serviceType: raw.service_type ?? raw.serviceType ?? '',
    source: raw.source ?? '',
    syncStatus: raw.sync_status ?? raw.syncStatus ?? '',
  };
}

function mapEndpoint(raw: any): MetricEndpoint {
  const urls = raw.urls ?? {};
  const tenant = raw.tenant ?? {};
  const scope = raw.scope ?? {};
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    description: raw.description ?? '',
    endpointType: raw.kind ?? raw.endpoint_type ?? raw.endpointType ?? 'victoriametrics',
    remoteWriteURL: raw.remote_write_url ?? raw.remoteWriteURL ?? urls.remote_write_url ?? urls.remoteWriteURL ?? urls.write_url ?? urls.writeURL ?? '',
    queryURL: raw.query_url ?? raw.queryURL ?? urls.query_url ?? urls.queryURL ?? '',
    vmuiURL: raw.vmui_url ?? raw.vmuiURL ?? raw.ui_url ?? raw.uiURL ?? urls.ui_url ?? urls.uiURL ?? '',
    accountId: String(raw.account_id ?? raw.accountId ?? tenant.account_id ?? tenant.accountId ?? ''),
    projectId: String(raw.project_id ?? raw.projectId ?? tenant.project_id ?? tenant.projectId ?? ''),
    secretRef: raw.secret_ref ?? raw.secretRef ?? '',
    scopeType: raw.scope_type ?? raw.scopeType ?? scope.type ?? '',
    clusterId: raw.cluster_id ?? raw.clusterId ?? scope.cluster_id ?? scope.clusterId ?? '',
    status: raw.status ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapStringRecord(raw: any): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value ?? '')]));
}

function mapServiceBinding(raw: any): MetricServiceBinding {
  const binding = raw?.binding ?? raw ?? {};
  const tenant = binding.tenant ?? {};
  return {
    id: String(binding.id ?? ''),
    serviceId: binding.service_id ?? binding.serviceId ?? '',
    endpointId: binding.endpoint_id ?? binding.endpointId ?? '',
    accountId: String(binding.account_id ?? binding.accountId ?? tenant.account_id ?? tenant.accountId ?? ''),
    projectId: String(binding.project_id ?? binding.projectId ?? tenant.project_id ?? tenant.projectId ?? ''),
    labelMatch: mapStringRecord(binding.label_match ?? binding.labelMatch),
    basePromQL: binding.base_promql ?? binding.basePromQL ?? '',
    status: binding.status ?? '',
    lastProbeStatus: binding.last_probe_status ?? binding.lastProbeStatus ?? '',
    lastProbeMessage: binding.last_probe_message ?? binding.lastProbeMessage ?? '',
    lastProbeAt: binding.last_probe_at ?? binding.lastProbeAt ?? '',
    createdAt: binding.created_at ?? binding.createdAt ?? '',
    updatedAt: binding.updated_at ?? binding.updatedAt ?? '',
  };
}

function mapWorkspace(raw: any): MetricsWorkspace {
  const serviceBindings = raw.service_bindings ?? raw.serviceBindings;
  const bindings = Array.isArray(serviceBindings) ? serviceBindings.map(mapServiceBinding) : [];
  if (raw.binding) {
    const activeBinding = mapServiceBinding(raw.binding);
    if (activeBinding.id && !bindings.some((binding) => binding.id === activeBinding.id)) {
      bindings.push(activeBinding);
    }
  }
  return {
    services: Array.isArray(raw.services) ? raw.services.map(mapService) : [],
    activeServiceId: raw.active_service_id ?? raw.activeServiceId ?? '',
    endpoints: Array.isArray(raw.endpoints) ? raw.endpoints.map(mapEndpoint) : [],
    serviceBindings: bindings,
  };
}

export const metricsApi = {
  async getWorkspace(serviceId?: string): Promise<MetricsWorkspace> {
    const params = new URLSearchParams();
    if (serviceId) params.set('service_id', serviceId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return mapWorkspace(await apiRequest<any>(`/metrics/workspace${suffix}`));
  },
  async listEndpoints(): Promise<MetricEndpoint[]> {
    const raw = await apiRequest<any[]>('/metrics/endpoints');
    return Array.isArray(raw) ? raw.map(mapEndpoint) : [];
  },
  async listServiceBindings(serviceId?: string): Promise<MetricServiceBinding[]> {
    const params = new URLSearchParams();
    if (serviceId) params.set('service_id', serviceId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const raw = await apiRequest<any[]>(`/metrics/service-bindings${suffix}`);
    return Array.isArray(raw) ? raw.map(mapServiceBinding) : [];
  },
};
