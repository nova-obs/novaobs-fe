import { apiRequest } from '../../services/api';

export type LogSourceType = 'k8s_stdout' | 'vm_file';
export type LogAccessSource = 'k8s' | 'vm';
export type LogSinkType = 'vl' | 'es' | 'kafka' | 'otel';

export function logSourceLabel(type?: string): string {
  return type === 'vm_file' ? 'VM' : 'K8s';
}

export function logSinkLabel(type?: string): string {
  if (type === 'es') return 'ES';
  if (type === 'kafka') return 'Kafka';
  if (type === 'otel') return 'OTel';
  return 'VL';
}

export interface LogEndpoint {
  id: string;
  name: string;
  description: string;
  sinkType: LogSinkType;
  streamName: string;
  writeURL: string;
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

export function buildVictoriaLogsVMUIURL(endpoint?: Pick<LogEndpoint, 'vmuiURL' | 'sinkType' | 'accountId' | 'projectId'> | null): string {
  const rawURL = endpoint?.vmuiURL?.trim() ?? '';
  if (!rawURL || endpoint?.sinkType !== 'vl' || !endpoint.accountId || !endpoint.projectId) return rawURL;
  try {
    const parsed = new URL(rawURL);
    if (!/\/select\/vmui\/?$/.test(parsed.pathname)) return rawURL;
    const hashValue = parsed.hash.replace(/^#/, '');
    const separator = hashValue.indexOf('?');
    const hashPath = separator >= 0 ? hashValue.slice(0, separator) || '/' : hashValue || '/';
    const params = new URLSearchParams(separator >= 0 ? hashValue.slice(separator + 1) : '');
    params.set('accountID', endpoint.accountId);
    params.set('projectID', endpoint.projectId);
    parsed.hash = `${hashPath}?${params.toString()}`;
    return parsed.toString();
  } catch {
    return rawURL;
  }
}

export interface LogParseRule {
  id?: string;
  name: string;
  ruleType: 'regex' | 'json';
  pattern?: string;
  fields?: Record<string, string>;
  enabled?: boolean;
}

export interface LogSource {
  id: string;
  sourceType: LogSourceType;
  clusterId: string;
  namespace: string;
  agentNamespace: string;
  workloadKind: string;
  workloadName: string;
  hostGroup: string;
  hostSelector: Record<string, string>;
  pathPattern: string;
  parseRules: LogParseRule[];
  collectorFragmentYAML: string;
  collectorYAML: string;
  collectorConfigHash: string;
  deploymentManifestHash: string;
}

export interface LogRoute {
  id: string;
  name: string;
  serviceId: string;
  sourceId: string;
  sourceType: LogSourceType;
  agentGroupId: string;
  endpointId: string;
  status: string;
  collectorConfigHash: string;
  lastProbeStatus: string;
  lastProbeMessage: string;
  lastProbeAt: string;
  lastPublishStatus: string;
  lastPublishMessage: string;
  lastPublishedAt: string;
  lastAuditId: string;
  lastPreviewId: string;
}

export interface LogRouteView {
  route: LogRoute;
  source: LogSource | null;
  endpoint: LogEndpoint | null;
}

export interface LogsServiceSummary {
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

export interface LogsAgentGroupSummary {
  id: string;
  name: string;
  displayName: string;
  mode: string;
  environment: string;
  cluster: string;
  namespace: string;
  status: string;
  onlineInstances: number;
}

export interface LogsClusterSummary {
  id: string;
  name: string;
  version: string;
  region: string;
  status: string;
  accessMode: string;
  readOnly: boolean;
}

export interface LogOnboardingWorkspace {
  services: LogsServiceSummary[];
  collectorGroups: LogsAgentGroupSummary[];
  clusters: LogsClusterSummary[];
  endpoints: LogEndpoint[];
  routes: LogRouteView[];
}

export interface LogsWorkload {
  clusterId: string;
  namespace: string;
  groupKey: string;
  groupName: string;
  key: string;
  name: string;
  kind: string;
  selector: Record<string, string>;
  templateLabels: Record<string, string>;
  serviceAccounts: string[];
  podsTotal: number;
  podsRunning: number;
  restartCount: number;
}

export interface LogRouteInput {
  routeId?: string;
  name?: string;
  serviceId: string;
  sourceType: LogSourceType;
  agentGroupId: string;
  endpointId: string;
  k8s?: {
    clusterId?: string;
    namespace?: string;
    agentNamespace?: string;
    workloadKind?: string;
    workloadName?: string;
    container?: string;
    workloadSelector?: Record<string, string>;
    pathPattern?: string;
    parseRules?: LogParseRule[];
    operatorsYAML?: string;
    collectorFragmentYAML?: string;
  };
  vm?: {
    hostGroup?: string;
    hostSelector?: Record<string, string>;
    pathPattern?: string;
    parseRules?: LogParseRule[];
    collectorYAML?: string;
  };
}

export interface SyncK8sServicesInput {
  clusterId: string;
  namespace: string;
  environment?: string;
  ownerTeam?: string;
  workloadKind?: string;
}

export interface SyncedK8sService {
  service: LogsServiceSummary;
  workload: LogsWorkload;
  targetId: string;
  created: boolean;
}

export interface SyncK8sServicesResult {
  services: SyncedK8sService[];
  total: number;
}

export interface LogRoutePreview {
  source: LogSource;
  endpoint: LogEndpoint;
  agentYAML: string;
  collectorYAML: string;
  collectorConfigHash: string;
  deploymentManifestHash: string;
  mode: string;
  publishBlocked: boolean;
  publishBlockedReason: string;
  warnings: string[];
}

export interface LogRouteCollectorConfig {
  routeId: string;
  collectorConfigHash: string;
  deploymentManifestHash: string;
  sourceType: LogSourceType;
  collectorYAML: string;
}

export interface LogPublishResult {
  status: string;
  message: string;
  requiresConfirmation: boolean;
  previewId: string;
  confirmationToken: string;
  auditId: string;
  resources: K8sPublishResource[];
  diffs: K8sPublishDiff[];
  warnings: string[];
  plan?: {
    id: string;
    routeId: string;
    agentGroupId: string;
    sourceType: LogSourceType;
    collectorConfigHash: string;
    deploymentManifestHash: string;
    renderedYAML: string;
    status: string;
    previewId: string;
    confirmationToken: string;
    auditId: string;
    message: string;
  };
}

export interface K8sPublishResource {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
}

export interface K8sPublishDiff {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  operation: string;
  beforeHash: string;
  afterHash: string;
}

export interface LogProbeResult {
  routeId: string;
  status: string;
  message: string;
  checkedAt: string;
  warnings: string[];
}

export interface LogParsePreviewResult {
  status: string;
  fields: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

function mapEndpoint(raw: any): LogEndpoint {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    description: raw.description ?? '',
    sinkType: raw.sink_type ?? raw.sinkType ?? 'vl',
    streamName: raw.stream_name ?? raw.streamName ?? '',
    writeURL: raw.write_url ?? raw.writeURL ?? '',
    queryURL: raw.query_url ?? raw.queryURL ?? '',
    vmuiURL: raw.vmui_url ?? raw.vmuiURL ?? '',
    accountId: String(raw.account_id ?? raw.accountId ?? ''),
    projectId: String(raw.project_id ?? raw.projectId ?? ''),
    secretRef: raw.secret_ref ?? raw.secretRef ?? '',
    scopeType: raw.scope_type ?? raw.scopeType ?? '',
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    status: raw.status ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapSource(raw: any): LogSource {
  return {
    id: String(raw.id ?? ''),
    sourceType: raw.source_type ?? raw.sourceType ?? 'vm_file',
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    agentNamespace: raw.agent_namespace ?? raw.agentNamespace ?? '',
    workloadKind: raw.workload_kind ?? raw.workloadKind ?? '',
    workloadName: raw.workload_name ?? raw.workloadName ?? '',
    hostGroup: raw.host_group ?? raw.hostGroup ?? '',
    hostSelector: raw.host_selector ?? raw.hostSelector ?? {},
    pathPattern: raw.path_pattern ?? raw.pathPattern ?? '',
    parseRules: mapParseRules(raw.parse_rules ?? raw.parseRules),
    collectorFragmentYAML: raw.collector_fragment_yaml ?? raw.collectorFragmentYAML ?? '',
    collectorYAML: raw.custom_collector_yaml ?? raw.customCollectorYAML ?? '',
    collectorConfigHash: raw.collector_config_hash ?? raw.collectorConfigHash ?? '',
    deploymentManifestHash: raw.deployment_manifest_hash ?? raw.deploymentManifestHash ?? '',
  };
}

function mapRoute(raw: any): LogRoute {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    serviceId: raw.service_id ?? raw.serviceId ?? '',
    sourceId: raw.source_id ?? raw.sourceId ?? '',
    sourceType: raw.source_type ?? raw.sourceType ?? 'vm_file',
    agentGroupId: raw.agent_group_id ?? raw.agentGroupId ?? '',
    endpointId: raw.endpoint_id ?? raw.endpointId ?? '',
    status: raw.status ?? '',
    collectorConfigHash: raw.collector_config_hash ?? raw.collectorConfigHash ?? '',
    lastProbeStatus: raw.last_probe_status ?? raw.lastProbeStatus ?? '',
    lastProbeMessage: raw.last_probe_message ?? raw.lastProbeMessage ?? '',
    lastProbeAt: raw.last_probe_at ?? raw.lastProbeAt ?? '',
    lastPublishStatus: raw.last_publish_status ?? raw.lastPublishStatus ?? '',
    lastPublishMessage: raw.last_publish_message ?? raw.lastPublishMessage ?? '',
    lastPublishedAt: raw.last_published_at ?? raw.lastPublishedAt ?? '',
    lastAuditId: raw.last_audit_id ?? raw.lastAuditId ?? '',
    lastPreviewId: raw.last_preview_id ?? raw.lastPreviewId ?? '',
  };
}

function mapRouteView(raw: any): LogRouteView {
  return {
    route: mapRoute(raw.route ?? {}),
    source: raw.source ? mapSource(raw.source) : null,
    endpoint: raw.endpoint ? mapEndpoint(raw.endpoint) : null,
  };
}

function mapWorkspace(raw: any): LogOnboardingWorkspace {
  return {
    services: Array.isArray(raw.services) ? raw.services.map((item: any) => ({
      id: String(item.id ?? ''),
      name: item.name ?? '',
      displayName: item.display_name ?? item.displayName ?? '',
      environment: item.environment ?? '',
      cluster: item.cluster ?? '',
      namespace: item.namespace ?? '',
      ownerTeam: item.owner_team ?? item.ownerTeam ?? '',
      identityType: item.identity_type ?? item.identityType ?? '',
      serviceType: item.service_type ?? item.serviceType ?? '',
      source: item.source ?? '',
      syncStatus: item.sync_status ?? item.syncStatus ?? '',
    })) : [],
    collectorGroups: Array.isArray(raw.collector_groups ?? raw.collectorGroups) ? (raw.collector_groups ?? raw.collectorGroups).map((item: any) => ({
      id: String(item.id ?? ''),
      name: item.name ?? '',
      displayName: item.display_name ?? item.displayName ?? '',
      mode: item.mode ?? '',
      environment: item.environment ?? '',
      cluster: item.cluster ?? '',
      namespace: item.namespace ?? '',
      status: item.status ?? '',
      onlineInstances: item.online_instances ?? item.onlineInstances ?? 0,
    })) : [],
    clusters: Array.isArray(raw.clusters) ? raw.clusters.map((item: any) => ({
      id: String(item.id ?? ''),
      name: item.name ?? '',
      version: item.version ?? '',
      region: item.region ?? '',
      status: item.status ?? '',
      accessMode: item.access_mode ?? item.accessMode ?? '',
      readOnly: Boolean(item.read_only ?? item.readOnly),
    })) : [],
    endpoints: Array.isArray(raw.endpoints) ? raw.endpoints.map(mapEndpoint) : [],
    routes: Array.isArray(raw.routes) ? raw.routes.map(mapRouteView) : [],
  };
}

function mapWorkload(raw: any): LogsWorkload {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    groupKey: raw.group_key ?? raw.groupKey ?? '',
    groupName: raw.group_name ?? raw.groupName ?? '',
    key: raw.key ?? '',
    name: raw.name ?? '',
    kind: raw.kind ?? '',
    selector: raw.selector ?? {},
    templateLabels: raw.template_labels ?? raw.templateLabels ?? {},
    serviceAccounts: Array.isArray(raw.service_accounts ?? raw.serviceAccounts) ? (raw.service_accounts ?? raw.serviceAccounts).map(String) : [],
    podsTotal: raw.pods_total ?? raw.podsTotal ?? 0,
    podsRunning: raw.pods_running ?? raw.podsRunning ?? 0,
    restartCount: raw.restart_count ?? raw.restartCount ?? 0,
  };
}

function mapParseRules(raw: any): LogParseRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: item.id ?? '',
    name: item.name ?? '',
    ruleType: item.rule_type ?? item.ruleType ?? 'regex',
    pattern: item.pattern ?? '',
    fields: item.fields ?? {},
    enabled: item.enabled ?? true,
  }));
}

function toParseRulesPayload(rules?: LogParseRule[]) {
  return (rules ?? []).map((rule) => ({
    id: rule.id,
    name: rule.name,
    rule_type: rule.ruleType,
    pattern: rule.pattern,
    fields: rule.fields ?? {},
    enabled: rule.enabled ?? true,
  }));
}

function mapSyncedService(raw: any): SyncedK8sService {
  const service = raw.service ?? {};
  return {
    service: {
      id: String(service.id ?? ''),
      name: service.name ?? '',
      displayName: service.display_name ?? service.displayName ?? '',
      environment: service.environment ?? '',
      cluster: service.cluster ?? '',
      namespace: service.namespace ?? '',
      ownerTeam: service.owner_team ?? service.ownerTeam ?? '',
      identityType: service.identity_type ?? service.identityType ?? '',
      serviceType: service.service_type ?? service.serviceType ?? '',
      source: service.source ?? '',
      syncStatus: service.sync_status ?? service.syncStatus ?? '',
    },
    workload: mapWorkload(raw.workload ?? {}),
    targetId: raw.target_id ?? raw.targetId ?? '',
    created: Boolean(raw.created),
  };
}

function mapPreview(raw: any): LogRoutePreview {
  return {
    source: mapSource(raw.source ?? {}),
    endpoint: mapEndpoint(raw.endpoint ?? {}),
    agentYAML: raw.agent_yaml ?? raw.agentYAML ?? '',
    collectorYAML: raw.collector_yaml ?? raw.collectorYAML ?? '',
    collectorConfigHash: raw.collector_config_hash ?? raw.collectorConfigHash ?? '',
    deploymentManifestHash: raw.deployment_manifest_hash ?? raw.deploymentManifestHash ?? '',
    mode: raw.mode ?? '',
    publishBlocked: Boolean(raw.publish_blocked ?? raw.publishBlocked),
    publishBlockedReason: raw.publish_blocked_reason ?? raw.publishBlockedReason ?? '',
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
  };
}

function mapRouteCollectorConfig(raw: any): LogRouteCollectorConfig {
  return {
    routeId: raw.route_id ?? raw.routeId ?? '',
    collectorConfigHash: raw.collector_config_hash ?? raw.collectorConfigHash ?? '',
    deploymentManifestHash: raw.deployment_manifest_hash ?? raw.deploymentManifestHash ?? '',
    sourceType: raw.source_type ?? raw.sourceType ?? 'k8s_stdout',
    collectorYAML: raw.collector_yaml ?? raw.collectorYAML ?? '',
  };
}

function mapParsePreview(raw: any): LogParsePreviewResult {
  return {
    status: raw.status ?? '',
    fields: raw.fields ?? {},
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    errors: Array.isArray(raw.errors) ? raw.errors.map(String) : [],
  };
}

function mapPublish(raw: any): LogPublishResult {
  return {
    status: raw.status ?? '',
    message: raw.message ?? '',
    requiresConfirmation: Boolean(raw.requires_confirmation ?? raw.requiresConfirmation),
    previewId: raw.preview_id ?? raw.previewId ?? '',
    confirmationToken: raw.confirmation_token ?? raw.confirmationToken ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapPublishResource) : [],
    diffs: Array.isArray(raw.diffs) ? raw.diffs.map(mapPublishDiff) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    plan: raw.plan ? {
      id: String(raw.plan.id ?? ''),
      routeId: raw.plan.route_id ?? raw.plan.routeId ?? '',
      agentGroupId: raw.plan.agent_group_id ?? raw.plan.agentGroupId ?? '',
      sourceType: raw.plan.source_type ?? raw.plan.sourceType ?? 'vm_file',
      collectorConfigHash: raw.plan.collector_config_hash ?? raw.plan.collectorConfigHash ?? '',
      deploymentManifestHash: raw.plan.deployment_manifest_hash ?? raw.plan.deploymentManifestHash ?? '',
      renderedYAML: raw.plan.rendered_yaml ?? raw.plan.renderedYAML ?? '',
      status: raw.plan.status ?? '',
      previewId: raw.plan.preview_id ?? raw.plan.previewId ?? '',
      confirmationToken: raw.plan.confirmation_token ?? raw.plan.confirmationToken ?? '',
      auditId: raw.plan.audit_id ?? raw.plan.auditId ?? '',
      message: raw.plan.message ?? '',
    } : undefined,
  };
}

function toRoutePayload(input: LogRouteInput) {
  const isVM = input.sourceType === 'vm_file';
  return {
    route_id: input.routeId,
    name: input.name,
    service_id: input.serviceId,
    source_type: input.sourceType,
    agent_group_id: input.agentGroupId,
    endpoint_id: input.endpointId,
    k8s: isVM ? {} : {
      cluster_id: input.k8s?.clusterId,
      namespace: input.k8s?.namespace,
      agent_namespace: input.k8s?.agentNamespace,
      workload_kind: input.k8s?.workloadKind,
      workload_name: input.k8s?.workloadName,
      workload_selector: input.k8s?.workloadSelector ?? {},
      path_pattern: input.k8s?.pathPattern,
      parse_rules: toParseRulesPayload(input.k8s?.parseRules),
      operators_yaml: input.k8s?.operatorsYAML ?? '',
      collector_fragment_yaml: input.k8s?.collectorFragmentYAML ?? '',
    },
    vm: isVM ? {
      host_group: input.vm?.hostGroup,
      host_selector: input.vm?.hostSelector ?? {},
      path_pattern: input.vm?.pathPattern,
      parse_rules: toParseRulesPayload(input.vm?.parseRules),
      collector_yaml: input.vm?.collectorYAML,
    } : {},
  };
}

function mapPublishResource(raw: any): K8sPublishResource {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    apiVersion: raw.api_version ?? raw.apiVersion ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? '',
  };
}

function mapPublishDiff(raw: any): K8sPublishDiff {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    apiVersion: raw.api_version ?? raw.apiVersion ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    operation: raw.operation ?? '',
    beforeHash: raw.before_hash ?? raw.beforeHash ?? '',
    afterHash: raw.after_hash ?? raw.afterHash ?? '',
  };
}

export const logsApi = {
  async getWorkspace(): Promise<LogOnboardingWorkspace> {
    return mapWorkspace(await apiRequest<any>('/logs/onboarding/workspace'));
  },
  async listK8sWorkloads(clusterId: string, namespace: string): Promise<LogsWorkload[]> {
    const params = new URLSearchParams({ cluster_id: clusterId, namespace });
    const raw = await apiRequest<any[]>(`/logs/onboarding/k8s/workloads?${params.toString()}`);
    return raw.map(mapWorkload);
  },
  async syncK8sServices(input: SyncK8sServicesInput): Promise<SyncK8sServicesResult> {
    const raw = await apiRequest<any>('/logs/onboarding/k8s/sync-services', {
      method: 'POST',
      body: JSON.stringify({
        cluster_id: input.clusterId,
        namespace: input.namespace,
        environment: input.environment,
        owner_team: input.ownerTeam,
        workload_kind: input.workloadKind,
      }),
    });
    const services = Array.isArray(raw.services) ? raw.services.map(mapSyncedService) : [];
    return { services, total: raw.total ?? services.length };
  },
  async createEndpoint(input: Partial<LogEndpoint>): Promise<LogEndpoint> {
    const raw = await apiRequest<any>('/logs/endpoints', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        sink_type: input.sinkType,
        stream_name: input.streamName,
        write_url: input.writeURL,
        query_url: input.queryURL,
        vmui_url: input.vmuiURL,
        account_id: input.accountId,
        project_id: input.projectId,
        secret_ref: input.secretRef,
        scope_type: input.scopeType,
        cluster_id: input.clusterId,
      }),
    });
    return mapEndpoint(raw);
  },
  async updateEndpoint(endpointId: string, input: Partial<LogEndpoint>): Promise<LogEndpoint> {
    const raw = await apiRequest<any>(`/logs/endpoints/${endpointId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        sink_type: input.sinkType,
        stream_name: input.streamName,
        write_url: input.writeURL,
        query_url: input.queryURL,
        vmui_url: input.vmuiURL,
        account_id: input.accountId,
        project_id: input.projectId,
        secret_ref: input.secretRef,
        scope_type: input.scopeType,
        cluster_id: input.clusterId,
        status: input.status,
      }),
    });
    return mapEndpoint(raw);
  },
  async listEndpoints(): Promise<LogEndpoint[]> {
    const raw = await apiRequest<any[]>('/logs/endpoints');
    return raw.map(mapEndpoint);
  },
  async previewRoute(input: LogRouteInput): Promise<LogRoutePreview> {
    return mapPreview(await apiRequest<any>('/logs/routes/preview', {
      method: 'POST',
      body: JSON.stringify(toRoutePayload(input)),
    }));
  },
  async previewParseRules(sample: string, parseRules: LogParseRule[]): Promise<LogParsePreviewResult> {
    return mapParsePreview(await apiRequest<any>('/logs/parse-preview', {
      method: 'POST',
      body: JSON.stringify({
        sample,
        parse_rules: toParseRulesPayload(parseRules),
      }),
    }));
  },
  async createRoute(input: LogRouteInput): Promise<LogRouteView> {
    return mapRouteView(await apiRequest<any>('/logs/routes', {
      method: 'POST',
      body: JSON.stringify(toRoutePayload(input)),
    }));
  },
  async updateRoute(routeId: string, input: LogRouteInput): Promise<LogRouteView> {
    return mapRouteView(await apiRequest<any>(`/logs/routes/${routeId}`, {
      method: 'PATCH',
      body: JSON.stringify(toRoutePayload({ ...input, routeId })),
    }));
  },
  async getRouteCollectorConfig(routeId: string): Promise<LogRouteCollectorConfig> {
    return mapRouteCollectorConfig(await apiRequest<any>(`/logs/routes/${routeId}/collector-config`));
  },
  async probeRoute(routeId: string): Promise<LogProbeResult> {
    const raw = await apiRequest<any>(`/logs/routes/${routeId}/probe`, { method: 'POST' });
    return {
      routeId: raw.route_id ?? raw.routeId ?? '',
      status: raw.status ?? '',
      message: raw.message ?? '',
      checkedAt: raw.checked_at ?? raw.checkedAt ?? '',
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    };
  },
  async publishRoute(routeId: string, confirmation?: { previewId?: string; confirmationToken?: string }): Promise<LogPublishResult> {
    return mapPublish(await apiRequest<any>(`/logs/routes/${routeId}/publish`, {
      method: 'POST',
      body: JSON.stringify({
        preview_id: confirmation?.previewId,
        confirmation_token: confirmation?.confirmationToken,
      }),
    }));
  },
};
