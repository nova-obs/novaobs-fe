import { apiRequest } from '../../services/api';

export function buildVictoriaMetricsVMUIURL(rawURL: string, expression: string): string {
	const normalizedURL = rawURL.trim();
	const normalizedExpression = expression.trim();
	if (!normalizedURL || !normalizedExpression) return normalizedURL;
	try {
		const parsed = new URL(normalizedURL);
		const hashValue = parsed.hash.replace(/^#/, '');
		const separator = hashValue.indexOf('?');
		const hashPath = separator >= 0 ? hashValue.slice(0, separator) || '/' : hashValue || '/';
		const params = new URLSearchParams(separator >= 0 ? hashValue.slice(separator + 1) : '');
		params.set('g0.expr', normalizedExpression);
		parsed.hash = `${hashPath}?${params.toString()}`;
		return parsed.toString();
	} catch {
		return normalizedURL;
	}
}

export interface MetricsServiceSummary {
  id: string;
	productId: string;
  accountId: string;
  projectId: string;
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
  healthStatus: string;
  healthMessage: string;
  healthCheckedAt: string;
  healthResponseTimeMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface MetricEndpointInput {
  name: string;
  description: string;
  remoteWriteURL: string;
  queryURL: string;
  vmuiURL: string;
  scopeType?: string;
  clusterId?: string;
  status: string;
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
  routes: MetricRoute[];
}

export interface MetricRoute {
  id: string;
  name: string;
  productId: string;
  serviceId: string;
  endpointId: string;
  sourceKind: string;
  clusterId: string;
  namespace: string;
  k8sServiceName: string;
  port: string;
  scheme: 'http' | 'https' | string;
  metricsPath: string;
  scrapeInterval: string;
  scrapeTimeout: string;
  labelMatch: Record<string, string>;
  basePromQL: string;
  status: string;
  desiredConfigHash: string;
  appliedConfigHash: string;
  lastPublishStatus: string;
  lastPublishMessage: string;
  lastPreviewId: string;
  lastAuditId: string;
  lastPublishedAt: string;
  createdAt: string;
  updatedAt: string;
  runtimeId: string;
  service?: MetricsServiceSummary | null;
  endpoint?: MetricEndpoint | null;
}

export interface MetricRouteInput {
  productId: string;
  serviceId: string;
  name: string;
  endpointId: string;
  clusterId: string;
  namespace: string;
  k8sServiceName: string;
  port: string;
  scheme: 'http' | 'https';
  metricsPath: string;
  scrapeInterval: string;
  scrapeTimeout: string;
  status?: string;
}

export interface MetricsCollectorRuntimeResourceStatus {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  required: boolean;
  exists: boolean;
  healthy: boolean;
}

export interface MetricsCollectorRuntimeStatus {
  runtimeId: string;
  clusterId: string;
  namespace: string;
  routeIds: string[];
  ready: boolean;
  status: string;
  message: string;
  resources: MetricsCollectorRuntimeResourceStatus[];
  missingResources: MetricsCollectorRuntimeResourceStatus[];
}

export interface MetricsCollectorRuntimePublishResult {
  runtime: Record<string, unknown> | null;
  routeIds: string[];
  manifestYAML: string;
  configYAML: string;
  configHash: string;
  manifestHash: string;
  status: string;
  message: string;
  requiresConfirmation: boolean;
  previewId: string;
  confirmationToken: string;
  auditId: string;
  resources: unknown[];
  diffs: unknown[];
  warnings: string[];
}

function mapService(raw: any): MetricsServiceSummary {
  return {
    id: String(raw.id ?? ''),
	productId: String(raw.product_id ?? raw.productId ?? ''),
    accountId: String(raw.account_id ?? raw.accountId ?? ''),
    projectId: String(raw.project_id ?? raw.projectId ?? ''),
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
  const health = raw.health ?? {};
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
    healthStatus: health.status ?? raw.health_status ?? raw.healthStatus ?? 'unknown',
    healthMessage: health.message ?? raw.health_message ?? raw.healthMessage ?? '',
    healthCheckedAt: health.checked_at ?? health.checkedAt ?? raw.health_checked_at ?? raw.healthCheckedAt ?? '',
    healthResponseTimeMs: Number(health.response_time_ms ?? health.responseTimeMs ?? raw.health_response_time_ms ?? raw.healthResponseTimeMs ?? 0),
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
    routes: Array.isArray(raw.routes) ? raw.routes.map(mapMetricRoute) : [],
  };
}

function mapMetricRoute(raw: any): MetricRoute {
  const route = raw?.route ?? raw ?? {};
  return {
    id: String(route.id ?? ''),
    name: route.name ?? '',
    productId: route.product_id ?? route.productId ?? '',
    serviceId: route.service_id ?? route.serviceId ?? '',
    endpointId: route.endpoint_id ?? route.endpointId ?? '',
    sourceKind: route.source_kind ?? route.sourceKind ?? '',
    clusterId: route.cluster_id ?? route.clusterId ?? '',
    namespace: route.namespace ?? '',
    k8sServiceName: route.k8s_service_name ?? route.k8sServiceName ?? '',
    port: String(route.port ?? ''),
    scheme: route.scheme ?? 'http',
    metricsPath: route.metrics_path ?? route.metricsPath ?? '/metrics',
    scrapeInterval: route.scrape_interval ?? route.scrapeInterval ?? '30s',
    scrapeTimeout: route.scrape_timeout ?? route.scrapeTimeout ?? '10s',
    labelMatch: mapStringRecord(route.label_match ?? route.labelMatch),
    basePromQL: route.base_promql ?? route.basePromQL ?? '',
    status: route.status ?? '',
    desiredConfigHash: route.desired_config_hash ?? route.desiredConfigHash ?? '',
    appliedConfigHash: route.applied_config_hash ?? route.appliedConfigHash ?? '',
    lastPublishStatus: route.last_publish_status ?? route.lastPublishStatus ?? '',
    lastPublishMessage: route.last_publish_message ?? route.lastPublishMessage ?? '',
    lastPreviewId: route.last_preview_id ?? route.lastPreviewId ?? '',
    lastAuditId: route.last_audit_id ?? route.lastAuditId ?? '',
    lastPublishedAt: route.last_published_at ?? route.lastPublishedAt ?? '',
    createdAt: route.created_at ?? route.createdAt ?? '',
    updatedAt: route.updated_at ?? route.updatedAt ?? '',
    runtimeId: raw?.runtime_id ?? raw?.runtimeId ?? '',
    service: raw?.service ? mapService(raw.service) : null,
    endpoint: raw?.endpoint ? mapEndpoint(raw.endpoint) : null,
  };
}

export interface CreateServiceBindingInput {
	productId: string;
  serviceId: string;
  endpointId: string;
  labelMatch: Record<string, string>;
  basePromQL?: string;
  status?: string;
}

export interface UpdateServiceBindingInput {
  endpointId?: string;
  labelMatch?: Record<string, string>;
  basePromQL?: string;
  status?: string;
}

export interface EndpointTestResult {
  status: string;
  message: string;
  responseTimeMs: number;
  checkedAt: string;
}

export const metricsApi = {
  async getWorkspace(productId: string, serviceId: string): Promise<MetricsWorkspace> {
	return mapWorkspace(await apiRequest<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/workspace`));
  },
  async listEndpoints(): Promise<MetricEndpoint[]> {
    const raw = await apiRequest<any[]>('/observability/endpoints?signal_type=metrics&kind=victoriametrics');
    return Array.isArray(raw) ? raw.map(mapEndpoint) : [];
  },
  async createEndpoint(input: MetricEndpointInput): Promise<MetricEndpoint> {
    return mapEndpoint(await apiRequest<any>('/observability/endpoints', {
      method: 'POST',
      body: JSON.stringify(toMetricEndpointPayload(input)),
    }));
  },
  async updateEndpoint(id: string, input: MetricEndpointInput): Promise<MetricEndpoint> {
    return mapEndpoint(await apiRequest<any>(`/observability/endpoints/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(toMetricEndpointPayload(input)),
    }));
  },
  async listServiceBindings(productId: string, serviceId: string): Promise<MetricServiceBinding[]> {
	const raw = await apiRequest<any[]>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/bindings`);
    return Array.isArray(raw) ? raw.map(mapServiceBinding) : [];
  },
  async createServiceBinding(input: CreateServiceBindingInput): Promise<MetricServiceBinding> {
	const raw = await apiRequest<any>(`/products/${encodeURIComponent(input.productId)}/services/${encodeURIComponent(input.serviceId)}/metrics/bindings`, {
      method: 'POST',
      body: JSON.stringify({
        endpoint_id: input.endpointId,
        label_match: input.labelMatch,
        base_promql: input.basePromQL ?? '',
        status: input.status ?? 'active',
      }),
    });
    return mapServiceBinding(raw);
  },
  async updateServiceBinding(productId: string, serviceId: string, id: string, input: UpdateServiceBindingInput): Promise<MetricServiceBinding> {
    const body: Record<string, unknown> = {};
    if (input.endpointId !== undefined) body.endpoint_id = input.endpointId;
    if (input.labelMatch !== undefined) body.label_match = input.labelMatch;
    if (input.basePromQL !== undefined) body.base_promql = input.basePromQL;
    if (input.status !== undefined) body.status = input.status;
	const raw = await apiRequest<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/bindings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return mapServiceBinding(raw);
  },
  async probeServiceBinding(productId: string, serviceId: string, id: string): Promise<MetricServiceBinding> {
	const raw = await apiRequest<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/bindings/${encodeURIComponent(id)}/probe`, { method: 'POST' });
    return mapServiceBinding(raw);
  },
  async testEndpoint(id: string): Promise<EndpointTestResult> {
    const raw = await apiRequest<any>(`/observability/endpoints/${id}/test`, { method: 'POST' });
    return {
      status: raw.status ?? '',
      message: raw.message ?? '',
      responseTimeMs: raw.response_time_ms ?? raw.responseTimeMs ?? 0,
      checkedAt: raw.checked_at ?? raw.checkedAt ?? '',
    };
  },
  async listRoutes(productId: string, serviceId: string): Promise<MetricRoute[]> {
    const raw = await apiRequest<any[]>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/routes`);
    return Array.isArray(raw) ? raw.map(mapMetricRoute) : [];
  },
  async listRoutesByCluster(clusterId: string): Promise<MetricRoute[]> {
    const params = new URLSearchParams({ cluster_id: clusterId });
    const raw = await apiRequest<any[]>(`/metrics/routes?${params.toString()}`);
    return Array.isArray(raw) ? raw.map(mapMetricRoute) : [];
  },
  async createRoute(input: MetricRouteInput): Promise<MetricRoute> {
    const raw = await apiRequest<any>(`/products/${encodeURIComponent(input.productId)}/services/${encodeURIComponent(input.serviceId)}/metrics/routes`, {
      method: 'POST',
      body: JSON.stringify(toMetricRoutePayload(input)),
    });
    return mapMetricRoute(raw);
  },
  async updateRoute(productId: string, serviceId: string, id: string, input: Partial<MetricRouteInput>): Promise<MetricRoute> {
    const raw = await apiRequest<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/routes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(toMetricRoutePayload(input)),
    });
    return mapMetricRoute(raw);
  },
  async getCollectorRuntimeStatus(input: { routeId: string; namespace?: string }): Promise<MetricsCollectorRuntimeStatus> {
    const params = new URLSearchParams({ route_id: input.routeId, namespace: input.namespace || 'novaapm-system' });
    const raw = await apiRequest<any>(`/observability/runtimes/metrics-collector/status?${params.toString()}`);
    return mapMetricsCollectorRuntimeStatus(raw);
  },
  async publishCollectorRuntime(input: { routeId: string; namespace?: string; previewId?: string; confirmationToken?: string }): Promise<MetricsCollectorRuntimePublishResult> {
    const raw = await apiRequest<any>('/observability/runtimes/metrics-collector/publish', {
      method: 'POST',
      body: JSON.stringify({
        route_id: input.routeId,
        namespace: input.namespace || 'novaapm-system',
        preview_id: input.previewId,
        confirmation_token: input.confirmationToken,
      }),
    });
    return mapMetricsCollectorRuntimePublish(raw);
  },
};

function toMetricEndpointPayload(input: MetricEndpointInput) {
  return {
    name: input.name,
    description: input.description,
    kind: 'victoriametrics',
    signal_types: ['metrics'],
    scope: {
      type: input.scopeType || 'global',
      ...((input.scopeType === 'k8s_cluster' && input.clusterId) ? { cluster_id: input.clusterId } : {}),
    },
    urls: {
      remote_write_url: input.remoteWriteURL,
      query_url: input.queryURL,
      ui_url: input.vmuiURL,
    },
    status: input.status,
  };
}

function toMetricRoutePayload(input: Partial<MetricRouteInput>) {
  return {
    name: input.name,
    endpoint_id: input.endpointId,
    cluster_id: input.clusterId,
    namespace: input.namespace,
    k8s_service_name: input.k8sServiceName,
    port: input.port,
    scheme: input.scheme,
    metrics_path: input.metricsPath,
    scrape_interval: input.scrapeInterval,
    scrape_timeout: input.scrapeTimeout,
    status: input.status,
  };
}

function mapRuntimeResource(raw: any): MetricsCollectorRuntimeResourceStatus {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    apiVersion: raw.api_version ?? raw.apiVersion ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    required: Boolean(raw.required),
    exists: Boolean(raw.exists),
    healthy: Boolean(raw.healthy),
  };
}

function mapMetricsCollectorRuntimeStatus(raw: any): MetricsCollectorRuntimeStatus {
  return {
    runtimeId: raw.runtime_id ?? raw.runtimeId ?? '',
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    routeIds: Array.isArray(raw.route_ids) ? raw.route_ids.map(String) : [],
    ready: Boolean(raw.ready),
    status: raw.status ?? '',
    message: raw.message ?? '',
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapRuntimeResource) : [],
    missingResources: Array.isArray(raw.missing_resources) ? raw.missing_resources.map(mapRuntimeResource) : [],
  };
}

function mapMetricsCollectorRuntimePublish(raw: any): MetricsCollectorRuntimePublishResult {
  return {
    runtime: raw.runtime ?? null,
    routeIds: Array.isArray(raw.route_ids) ? raw.route_ids.map(String) : [],
    manifestYAML: raw.manifest_yaml ?? '',
    configYAML: raw.config_yaml ?? '',
    configHash: raw.config_hash ?? '',
    manifestHash: raw.manifest_hash ?? '',
    status: raw.status ?? '',
    message: raw.message ?? '',
    requiresConfirmation: Boolean(raw.requires_confirmation),
    previewId: raw.preview_id ?? '',
    confirmationToken: raw.confirmation_token ?? '',
    auditId: raw.audit_id ?? '',
    resources: Array.isArray(raw.resources) ? raw.resources : [],
    diffs: Array.isArray(raw.diffs) ? raw.diffs : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
  };
}
