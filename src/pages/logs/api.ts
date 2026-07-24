import { apiRequest } from '../../services/api';

export const defaultLogsCollectorNamespace = 'novaapm-system';
const legacyLogsCollectorNamespace = 'novaobs-system';

export function normalizeLogsCollectorNamespace(namespace?: string | null): string {
  const value = String(namespace ?? '').trim();
  if (!value || value === legacyLogsCollectorNamespace) return defaultLogsCollectorNamespace;
  return value;
}

function normalizeExistingLogsCollectorNamespace(namespace?: string | null): string {
  const value = String(namespace ?? '').trim();
  if (value === legacyLogsCollectorNamespace) return defaultLogsCollectorNamespace;
  return value;
}

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
  scopeType: string;
  clusterId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function buildVictoriaLogsVMUIURL(endpoint?: Pick<LogEndpoint, 'vmuiURL' | 'sinkType' | 'accountId' | 'projectId'> | null, baseFilter = ''): string {
  const rawURL = endpoint?.vmuiURL?.trim() ?? '';
  if (!rawURL || endpoint?.sinkType !== 'vl' || !endpoint.accountId || !endpoint.projectId) return rawURL;
  try {
    const parsed = new URL(rawURL);
    if (!/\/select\/vmui\/?$/.test(parsed.pathname)) return rawURL;
    const hashValue = parsed.hash.replace(/^#/, '');
    const separator = hashValue.indexOf('?');
    const hashPath = separator >= 0 ? hashValue.slice(0, separator) || '/' : hashValue || '/';
    const params = new URLSearchParams(separator >= 0 ? hashValue.slice(separator + 1) : '');
	const normalizedFilter = baseFilter.trim();
	if (normalizedFilter) {
	  const existingQuery = params.get('query')?.trim() ?? '';
	  params.set('query', existingQuery ? `${normalizedFilter} AND (${existingQuery})` : normalizedFilter);
	}
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

export interface LogActorRef {
  id: string;
  type: string;
  name: string;
}

export interface LogTarget {
  id: string;
  name: string;
  serviceId: string;
  endpointId: string;
  sourceKind: 'external_vlogs';
  logRouteId: string;
  baseFilter: string;
  accountId: string;
  projectId: string;
  status: 'pending_verification' | 'verified' | 'disabled' | string;
  lastProbeStatus: string;
  lastProbeMessage: string;
  lastProbeAt: string;
  lastSeenLogAt: string;
  createdBy: LogActorRef;
  updatedBy: LogActorRef;
  createdAt: string;
  updatedAt: string;
}

export interface LogTargetView {
  target: LogTarget;
  service: LogsServiceSummary | null;
  endpoint: LogEndpoint | null;
}

export interface LogTargetInput {
  name?: string;
  serviceId: string;
  endpointId: string;
  baseFilter: string;
  accountId?: string;
  projectId?: string;
  status?: string;
}

export interface LogsServiceSummary {
  id: string;
  productId: string;
  key: string;
  name: string;
  ownerTeam: string;
  source: string;
  syncStatus: string;
}

export interface LogsAgentGroupSummary {
  id: string;
  name: string;
  displayName: string;
  mode: string;
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
  targets: LogTargetView[];
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
    pathPattern?: string;
    parseRules?: LogParseRule[];
    collectorYAML?: string;
  };
}

export interface SyncK8sServicesInput {
	productId: string;
  clusterId: string;
  namespace: string;
  ownerTeam?: string;
  workloadKind?: string;
}

export interface SyncedK8sService {
  service: LogsServiceSummary;
  workload: LogsWorkload;
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
  collectorConfigFiles: Record<string, string>;
  serviceConfigPath: string;
  serviceConfigMapName: string;
  serviceConfigYAML: string;
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
  collectorConfigFiles: Record<string, string>;
  serviceConfigPath: string;
  serviceConfigMapName: string;
  serviceConfigYAML: string;
}

export interface LogRoutePublishResult {
  status: string;
  message: string;
  requiresConfirmation: boolean;
  previewId: string;
  confirmationToken: string;
  auditId: string;
  warnings: string[];
}

export interface VMInstallation {
  routeId: string;
  serviceId: string;
  collectorConfigHash: string;
  collectorYAML: string;
  installScript: string;
  healthAddressExample: string;
  prerequisites: string[];
}

export interface VMAgentEndpoint {
  id: string;
  routeId: string;
  serviceId: string;
  name: string;
  address: string;
  status: string;
  lastProbeStatus: string;
  lastProbeMessage: string;
  lastProbeLatencyMs: number;
  lastProbeAt: string;
}

export interface LogRuntimePublishInput {
  deployClusterId?: string;
  namespace?: string;
  alertIngestURL?: string;
  previewId?: string;
  confirmationToken?: string;
}

export interface LogRuntimePublishResult {
  runtimeId: string;
  endpointId: string;
  deployClusterId: string;
  namespace: string;
  datasourceURL: string;
  alertIngestURL: string;
  artifactHash: string;
  manifestHash: string;
  manifestYAML: string;
  status: string;
  message: string;
  requiresConfirmation: boolean;
  previewId: string;
  confirmationToken: string;
  auditId: string;
  appliedRules: number;
  resources: K8sPublishResource[];
  diffs: K8sPublishDiff[];
  warnings: string[];
}

export interface ObservabilityRuntime {
  id: string;
  kind: string;
  signalType: string;
  clusterId: string;
  namespace: string;
  endpointId: string;
  collectorConfigHash: string;
  artifactHash: string;
  manifestHash: string;
  status: string;
  lastPreviewId: string;
  lastAuditId: string;
  lastError: string;
  lastPublishedAt: string;
  resources: K8sPublishResource[];
}

export interface LogsCollectorRuntimeResourceStatus {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  required: boolean;
  exists: boolean;
}

export interface LogsCollectorRuntimeStatus {
  clusterId: string;
  namespace: string;
  ready: boolean;
  status: string;
  message: string;
  runtime?: ObservabilityRuntime;
  resources: LogsCollectorRuntimeResourceStatus[];
  missingResources: LogsCollectorRuntimeResourceStatus[];
}

export interface LogsCollectorRuntimePublishResult extends LogRoutePublishResult {
  runtime?: ObservabilityRuntime;
  taskType: string;
  manifestYAML: string;
  collectorYAML: string;
  collectorConfigFiles: Record<string, string>;
  collectorConfigHash: string;
  manifestHash: string;
  changedConfigMaps: string[];
  resources: K8sPublishResource[];
  diffs: K8sPublishDiff[];
  expiresAt: string;
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

export interface LogTargetProbeResult extends LogTargetView {}

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
    scopeType: raw.scope_type ?? raw.scopeType ?? '',
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    status: raw.status ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapSource(raw: any): LogSource {
  const sourceType = raw.source_type ?? raw.sourceType ?? 'vm_file';
  return {
    id: String(raw.id ?? ''),
    sourceType,
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    agentNamespace: sourceType === 'k8s_stdout'
      ? normalizeLogsCollectorNamespace(raw.agent_namespace ?? raw.agentNamespace)
      : normalizeExistingLogsCollectorNamespace(raw.agent_namespace ?? raw.agentNamespace),
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

function mapActorRef(raw: any): LogActorRef {
  return {
    id: raw?.id ?? '',
    type: raw?.type ?? '',
    name: raw?.name ?? '',
  };
}

function mapTarget(raw: any): LogTarget {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    serviceId: raw.service_id ?? raw.serviceId ?? '',
    endpointId: raw.endpoint_id ?? raw.endpointId ?? '',
    sourceKind: raw.source_kind ?? raw.sourceKind ?? 'external_vlogs',
    logRouteId: raw.log_route_id ?? raw.logRouteId ?? '',
    baseFilter: raw.base_filter ?? raw.baseFilter ?? '',
    accountId: String(raw.account_id ?? raw.accountId ?? ''),
    projectId: String(raw.project_id ?? raw.projectId ?? ''),
    status: raw.status ?? '',
    lastProbeStatus: raw.last_probe_status ?? raw.lastProbeStatus ?? '',
    lastProbeMessage: raw.last_probe_message ?? raw.lastProbeMessage ?? '',
    lastProbeAt: raw.last_probe_at ?? raw.lastProbeAt ?? '',
    lastSeenLogAt: raw.last_seen_log_at ?? raw.lastSeenLogAt ?? '',
    createdBy: mapActorRef(raw.created_by ?? raw.createdBy),
    updatedBy: mapActorRef(raw.updated_by ?? raw.updatedBy),
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapServiceSummary(raw: any): LogsServiceSummary {
  return {
    id: String(raw.id ?? ''),
    productId: String(raw.product_id ?? raw.productId ?? ''),
    key: raw.key ?? '',
    name: raw.name ?? '',
    ownerTeam: raw.owner_team ?? raw.ownerTeam ?? '',
    source: raw.source ?? '',
    syncStatus: raw.sync_status ?? raw.syncStatus ?? '',
  };
}

function mapTargetView(raw: any): LogTargetView {
  return {
    target: mapTarget(raw.target ?? {}),
    service: raw.service ? mapServiceSummary(raw.service) : null,
    endpoint: raw.endpoint ? mapEndpoint(raw.endpoint) : null,
  };
}

function mapWorkspace(raw: any): LogOnboardingWorkspace {
  return {
    services: Array.isArray(raw.services) ? raw.services.map(mapServiceSummary) : [],
    collectorGroups: Array.isArray(raw.collector_groups ?? raw.collectorGroups) ? (raw.collector_groups ?? raw.collectorGroups).map((item: any) => ({
      id: String(item.id ?? ''),
      name: item.name ?? '',
      displayName: item.display_name ?? item.displayName ?? '',
      mode: item.mode ?? '',
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
    targets: Array.isArray(raw.targets) ? raw.targets.map(mapTargetView) : [],
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
      productId: String(service.product_id ?? service.productId ?? ''),
      key: service.key ?? '',
      name: service.name ?? '',
      ownerTeam: service.owner_team ?? service.ownerTeam ?? '',
      source: service.source ?? '',
      syncStatus: service.sync_status ?? service.syncStatus ?? '',
    },
    workload: mapWorkload(raw.workload ?? {}),
    created: Boolean(raw.created),
  };
}

function mapConfigFiles(raw: any): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).map(([path, content]) => [String(path), String(content ?? '')]));
}

function mapPreview(raw: any): LogRoutePreview {
  return {
    source: mapSource(raw.source ?? {}),
    endpoint: mapEndpoint(raw.endpoint ?? {}),
    agentYAML: raw.agent_yaml ?? raw.agentYAML ?? '',
    collectorYAML: raw.collector_yaml ?? raw.collectorYAML ?? '',
    collectorConfigFiles: mapConfigFiles(raw.collector_config_files),
    serviceConfigPath: raw.service_config_path ?? '',
    serviceConfigMapName: raw.service_config_map_name ?? '',
    serviceConfigYAML: raw.service_config_yaml ?? '',
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
    collectorConfigFiles: mapConfigFiles(raw.collector_config_files),
    serviceConfigPath: raw.service_config_path ?? '',
    serviceConfigMapName: raw.service_config_map_name ?? '',
    serviceConfigYAML: raw.service_config_yaml ?? '',
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

function mapRoutePublish(raw: any): LogRoutePublishResult {
  return {
    status: raw.status ?? '',
    message: raw.message ?? '',
    requiresConfirmation: Boolean(raw.requires_confirmation ?? raw.requiresConfirmation),
    previewId: raw.preview_id ?? raw.previewId ?? '',
    confirmationToken: raw.confirmation_token ?? raw.confirmationToken ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
  };
}

function mapVMInstallation(raw: any): VMInstallation {
  return {
    routeId: raw.route_id ?? raw.routeId ?? '',
    serviceId: raw.service_id ?? raw.serviceId ?? '',
    collectorConfigHash: raw.collector_config_hash ?? raw.config_hash ?? raw.collectorConfigHash ?? '',
    collectorYAML: raw.collector_yaml ?? raw.collectorYAML ?? '',
    installScript: raw.install_script ?? raw.installScript ?? '',
    healthAddressExample: raw.health_address_example ?? raw.healthAddressExample ?? '',
    prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites.map(String) : [],
  };
}

function mapVMAgentEndpoint(raw: any): VMAgentEndpoint {
  return {
    id: raw.id ?? '',
    routeId: raw.route_id ?? raw.routeId ?? '',
    serviceId: raw.service_id ?? raw.serviceId ?? '',
    name: raw.name ?? '',
    address: raw.address ?? '',
    status: raw.status ?? '',
    lastProbeStatus: raw.last_probe_status ?? raw.lastProbeStatus ?? '',
    lastProbeMessage: raw.last_probe_message ?? raw.lastProbeMessage ?? '',
    lastProbeLatencyMs: raw.last_probe_latency_ms ?? raw.latency_ms ?? raw.lastProbeLatencyMs ?? 0,
    lastProbeAt: raw.last_probe_at ?? raw.lastProbeAt ?? '',
  };
}

function mapCollectorRuntimePublish(raw: any): LogsCollectorRuntimePublishResult {
  return {
    status: raw.status ?? '',
    message: raw.message ?? '',
    requiresConfirmation: Boolean(raw.requires_confirmation),
    previewId: raw.preview_id ?? '',
    confirmationToken: raw.confirmation_token ?? '',
    expiresAt: raw.expires_at ?? '',
    auditId: raw.audit_id ?? '',
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    runtime: raw.runtime ? mapObservabilityRuntime(raw.runtime) : undefined,
    taskType: raw.task_type ?? '',
    manifestYAML: raw.manifest_yaml ?? '',
    collectorYAML: raw.collector_yaml ?? '',
    collectorConfigFiles: mapConfigFiles(raw.collector_config_files),
    collectorConfigHash: raw.collector_config_hash ?? '',
    manifestHash: raw.manifest_hash ?? '',
    changedConfigMaps: Array.isArray(raw.changed_config_maps) ? raw.changed_config_maps.map(String) : [],
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapPublishResource) : [],
    diffs: Array.isArray(raw.diffs) ? raw.diffs.map(mapPublishDiff) : [],
  };
}

function mapObservabilityRuntime(raw: any): ObservabilityRuntime {
  return {
    id: String(raw.id ?? ''),
    kind: raw.kind ?? '',
    signalType: raw.signal_type ?? '',
    clusterId: raw.cluster_id ?? '',
    namespace: raw.namespace ?? '',
    endpointId: raw.endpoint_id ?? '',
    collectorConfigHash: raw.collector_config_hash ?? '',
    artifactHash: raw.artifact_hash ?? '',
    manifestHash: raw.manifest_hash ?? '',
    status: raw.status ?? '',
    lastPreviewId: raw.last_preview_id ?? '',
    lastAuditId: raw.last_audit_id ?? '',
    lastError: raw.last_error ?? '',
    lastPublishedAt: raw.last_published_at ?? '',
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapPublishResource) : [],
  };
}

function mapCollectorRuntimeResourceStatus(raw: any): LogsCollectorRuntimeResourceStatus {
  return {
    clusterId: raw.cluster_id ?? '',
    namespace: normalizeExistingLogsCollectorNamespace(raw.namespace),
    apiVersion: raw.api_version ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    required: Boolean(raw.required),
    exists: Boolean(raw.exists),
  };
}

function mapCollectorRuntimeStatus(raw: any): LogsCollectorRuntimeStatus {
  return {
    clusterId: raw.cluster_id ?? '',
    namespace: normalizeLogsCollectorNamespace(raw.namespace),
    ready: Boolean(raw.ready),
    status: raw.status ?? '',
    message: raw.message ?? '',
    runtime: raw.runtime ? mapObservabilityRuntime(raw.runtime) : undefined,
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapCollectorRuntimeResourceStatus) : [],
    missingResources: Array.isArray(raw.missing_resources)
      ? raw.missing_resources.map(mapCollectorRuntimeResourceStatus)
      : [],
  };
}

function mapRuntimePublish(raw: any): LogRuntimePublishResult {
  return {
    runtimeId: raw.runtime_id ?? raw.runtimeId ?? '',
    endpointId: raw.endpoint_id ?? raw.endpointId ?? '',
    deployClusterId: raw.deploy_cluster_id ?? raw.deployClusterId ?? '',
    namespace: raw.namespace ?? '',
    datasourceURL: raw.datasource_url ?? raw.datasourceURL ?? '',
    alertIngestURL: raw.alert_ingest_url ?? raw.alertIngestURL ?? '',
    artifactHash: raw.artifact_hash ?? raw.artifactHash ?? '',
    manifestHash: raw.manifest_hash ?? raw.manifestHash ?? '',
    manifestYAML: raw.manifest_yaml ?? raw.manifestYAML ?? '',
    status: raw.status ?? '',
    message: raw.message ?? '',
    requiresConfirmation: Boolean(raw.requires_confirmation ?? raw.requiresConfirmation),
    previewId: raw.preview_id ?? raw.previewId ?? '',
    confirmationToken: raw.confirmation_token ?? raw.confirmationToken ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
    appliedRules: raw.applied_rules ?? raw.appliedRules ?? 0,
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapPublishResource) : [],
    diffs: Array.isArray(raw.diffs) ? raw.diffs.map(mapPublishDiff) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
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
      agent_namespace: normalizeLogsCollectorNamespace(input.k8s?.agentNamespace),
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
      path_pattern: input.vm?.pathPattern,
      parse_rules: toParseRulesPayload(input.vm?.parseRules),
      collector_yaml: input.vm?.collectorYAML,
    } : {},
  };
}

function toTargetPayload(input: Partial<LogTargetInput>) {
  return {
    name: input.name,
    service_id: input.serviceId,
    endpoint_id: input.endpointId,
    source_kind: 'external_vlogs',
    base_filter: input.baseFilter,
    account_id: input.accountId,
    project_id: input.projectId,
    status: input.status,
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
  async getWorkspace(productId: string, serviceId: string): Promise<LogOnboardingWorkspace> {
	return mapWorkspace(await apiRequest<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs/workspace`));
  },
  async listK8sWorkloads(clusterId: string, namespace: string): Promise<LogsWorkload[]> {
    const params = new URLSearchParams({ cluster_id: clusterId, namespace });
    const raw = await apiRequest<any[]>(`/logs/onboarding/k8s/workloads?${params.toString()}`);
    return raw.map(mapWorkload);
  },
  async syncK8sServices(input: SyncK8sServicesInput): Promise<SyncK8sServicesResult> {
	const raw = await apiRequest<any>(`/products/${encodeURIComponent(input.productId)}/logs/onboarding/k8s/sync-services`, {
      method: 'POST',
	      body: JSON.stringify({
	        cluster_id: input.clusterId,
	        namespace: input.namespace,
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
        scope_type: input.scopeType,
        cluster_id: input.clusterId,
        status: input.status,
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
        scope_type: input.scopeType,
        cluster_id: input.clusterId,
        status: input.status,
      }),
    });
    return mapEndpoint(raw);
  },
  async listEndpoints(): Promise<LogEndpoint[]> {
    const raw = await apiRequest<any[] | null>('/logs/endpoints');
    return Array.isArray(raw) ? raw.map(mapEndpoint) : [];
  },
  async listTargets(serviceId?: string): Promise<LogTargetView[]> {
    const params = new URLSearchParams();
    if (serviceId) params.set('service_id', serviceId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const raw = await apiRequest<any[]>(`/logs/targets${suffix}`);
    return raw.map(mapTargetView);
  },
  async createTarget(input: LogTargetInput): Promise<LogTargetView> {
    return mapTargetView(await apiRequest<any>('/logs/targets', {
      method: 'POST',
      body: JSON.stringify(toTargetPayload(input)),
    }));
  },
  async updateTarget(targetId: string, input: Partial<LogTargetInput>): Promise<LogTargetView> {
    return mapTargetView(await apiRequest<any>(`/logs/targets/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify(toTargetPayload(input)),
    }));
  },
  async probeTarget(targetId: string): Promise<LogTargetView> {
    return mapTargetView(await apiRequest<any>(`/logs/targets/${targetId}/probe`, { method: 'POST' }));
  },
  async publishEndpointVmalertRuntime(endpointId: string, input: LogRuntimePublishInput): Promise<LogRuntimePublishResult> {
    return mapRuntimePublish(await apiRequest<any>(`/logs/endpoints/${endpointId}/vmalert-runtime/publish`, {
      method: 'POST',
      body: JSON.stringify({
        deploy_cluster_id: input.deployClusterId,
        namespace: input.namespace,
        alert_ingest_url: input.alertIngestURL,
        preview_id: input.previewId,
        confirmation_token: input.confirmationToken,
      }),
    }));
  },
  async publishLogsCollectorRuntime(input: { clusterId: string; namespace?: string; taskType: 'base' | 'incremental' }): Promise<LogsCollectorRuntimePublishResult> {
    return mapCollectorRuntimePublish(await apiRequest<any>('/observability/runtimes/logs-collector/publish', {
      method: 'POST',
      body: JSON.stringify({
        cluster_id: input.clusterId,
        namespace: normalizeLogsCollectorNamespace(input.namespace),
        task_type: input.taskType,
      }),
    }));
  },
  async confirmLogsCollectorRuntime(input: { previewId: string; confirmationToken: string }): Promise<LogsCollectorRuntimePublishResult> {
    return mapCollectorRuntimePublish(await apiRequest<any>('/observability/runtimes/logs-collector/publish', {
      method: 'POST',
      body: JSON.stringify({
        preview_id: input.previewId,
        confirmation_token: input.confirmationToken,
      }),
    }));
  },
  async getLogsCollectorRuntimeStatus(input: { clusterId: string; namespace?: string }): Promise<LogsCollectorRuntimeStatus> {
    const params = new URLSearchParams({ cluster_id: input.clusterId });
    params.set('namespace', normalizeLogsCollectorNamespace(input.namespace));
    return mapCollectorRuntimeStatus(await apiRequest<any>(`/observability/runtimes/logs-collector/status?${params.toString()}`));
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
  async publishRoute(routeId: string, confirmation?: { previewId?: string; confirmationToken?: string }): Promise<LogRoutePublishResult> {
    return mapRoutePublish(await apiRequest<any>(`/logs/routes/${routeId}/publish`, {
      method: 'POST',
      body: JSON.stringify({
        preview_id: confirmation?.previewId,
        confirmation_token: confirmation?.confirmationToken,
      }),
    }));
  },
  async getVMInstallation(routeId: string): Promise<VMInstallation> {
    return mapVMInstallation(await apiRequest<any>(`/logs/routes/${encodeURIComponent(routeId)}/vm-installation`));
  },
  async listVMAgentEndpoints(routeId: string): Promise<VMAgentEndpoint[]> {
    const raw = await apiRequest<any[] | null>(`/logs/routes/${encodeURIComponent(routeId)}/vm-agent-endpoints`);
    return Array.isArray(raw) ? raw.map(mapVMAgentEndpoint) : [];
  },
  async createVMAgentEndpoint(routeId: string, input: { name: string; address: string }): Promise<VMAgentEndpoint> {
    return mapVMAgentEndpoint(await apiRequest<any>(`/logs/routes/${encodeURIComponent(routeId)}/vm-agent-endpoints`, {
      method: 'POST',
      body: JSON.stringify({ name: input.name, address: input.address }),
    }));
  },
  async probeVMAgentEndpoint(routeId: string, endpointId: string): Promise<VMAgentEndpoint> {
    return mapVMAgentEndpoint(await apiRequest<any>(`/logs/routes/${encodeURIComponent(routeId)}/vm-agent-endpoints/${encodeURIComponent(endpointId)}/probe`, { method: 'POST' }));
  },
  async deleteVMAgentEndpoint(routeId: string, endpointId: string): Promise<void> {
    await apiRequest<any>(`/logs/routes/${encodeURIComponent(routeId)}/vm-agent-endpoints/${encodeURIComponent(endpointId)}`, { method: 'DELETE' });
  },
  async deleteRoute(routeId: string): Promise<void> {
    await apiRequest<any>(`/logs/routes/${routeId}`, { method: 'DELETE' });
  },
};
