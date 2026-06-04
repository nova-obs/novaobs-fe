export type ServiceStatus = 'active' | 'pending' | 'degraded' | 'deleted';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ServiceSource = 'manual' | 'cmdb' | 'k8s';
export type SyncStatus = 'local' | 'synced';
export type ServiceIdentityType = 'k8s_workload' | 'host_process';
export type ServiceTargetType = 'cloud_native_workload' | 'host_process' | 'physical_or_network_device';

export interface Service {
  id: string;
  cmdbServiceId: string;
  businessId: string;
  applicationId: string;
  name: string;
  displayName: string;
  description: string;
  environment: string;
  cluster: string;
  namespace: string;
  ownerTeam: string;
  owner: string;
  alertRoute: string;
  sloLevel: string;
  identityType: ServiceIdentityType;
  serviceType: string;
  source: ServiceSource;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTarget {
  id: string;
  serviceId: string;
  targetType: ServiceTargetType;
  environment: string;
  displayName: string;
  identityAttributes: Record<string, string>;
  matchRules: Record<string, string>;
  source: ServiceSource | 'discovered';
  syncStatus: SyncStatus | 'stale' | 'conflict';
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceTargetInput {
  targetType: ServiceTargetType;
  environment?: string;
  displayName?: string;
  identityAttributes: Record<string, string>;
  matchRules?: Record<string, string>;
}

export interface ServiceGraphLogRouteSummary {
  total: number;
  routes: Array<{
    route: {
      id: string;
      sourceType: string;
      agentGroupId: string;
      endpointId: string;
      status: string;
      collectorConfigHash: string;
      lastPublishStatus: string;
    };
    source?: {
      sourceType: string;
      clusterId: string;
      namespace: string;
      workloadKind: string;
      workloadName: string;
      hostGroup: string;
      pathPattern: string;
    } | null;
    endpoint?: { id: string; name: string; sinkType: string; streamName: string; vmuiURL: string } | null;
  }>;
}

export interface ServiceObservabilityGraph {
  service: Service;
  targets: ServiceTarget[];
  agents: CollectorInstance[];
  logRoutes: ServiceGraphLogRouteSummary;
  alertRules: AlertRule[];
}

export interface CreateServiceInput {
  name: string;
  environment: string;
  displayName?: string;
  cluster?: string;
  namespace?: string;
  ownerTeam?: string;
  owner?: string;
  alertRoute?: string;
  sloLevel?: string;
  identityType?: ServiceIdentityType;
  serviceType?: string;
}

export interface UpdateServiceInput {
  cmdbServiceId?: string;
  businessId?: string;
  applicationId?: string;
  name?: string;
  displayName?: string;
  description?: string;
  environment?: string;
  cluster?: string;
  namespace?: string;
  ownerTeam?: string;
  owner?: string;
  alertRoute?: string;
  sloLevel?: string;
  identityType?: ServiceIdentityType;
  serviceType?: string;
  status?: ServiceStatus;
}

export interface OpAMPAgent {
  instanceUid: string;
  collectorGroupId: string;
  serviceId: string;
  online: boolean;
  healthy: boolean;
  capabilities: number;
  remoteConfigStatus: string;
  lastConfigHash: string;
  lastError: string;
  lastSeenAt: string;
  runtimeStatus: 'online' | 'stale' | 'offline';
  lastSeenAgeSeconds: number;
}

export interface AgentAttribute {
  key: string;
  value: unknown;
  valueText: string;
  identifying: boolean;
}

export interface AgentState {
  instanceUid: string;
  collectorGroupId: string;
  serviceId: string;
  online: boolean;
  healthy: boolean;
  capabilities: number;
  remoteConfigCapable: boolean;
  effectiveConfigHash: string;
  remoteConfigStatus: string;
  lastConfigHash: string;
  lastError: string;
  lastSeenAt: string;
}

export interface AgentRuntimeDetail {
  state: AgentState;
  identifyingAttributes: AgentAttribute[];
  nonIdentifyingAttributes: AgentAttribute[];
  effectiveConfig: string;
  effectiveConfigFiles: Record<string, string>;
  lastRemoteConfig: string;
  lastRemoteConfigHash: string;
  lastRemoteConfigFiles: Record<string, string>;
  lastSeenAt: string;
}

export interface AgentDetailConfiguration {
  effectiveConfig: string;
  effectiveConfigFiles: Record<string, string>;
  effectiveConfigHash: string;
  lastRemoteConfig: string;
  lastRemoteConfigFiles: Record<string, string>;
  lastRemoteConfigHash: string;
  expectedConfigHash: string;
  inSync: boolean;
  applyStatus: string;
  configSources: CollectorConfigSources | null;
}

export interface AgentDetail {
  instanceUid: string;
  runtime: CollectorInstance;
  agent: AgentRuntimeDetail;
  collectorGroup: CollectorGroup | null;
  services: Service[];
  onboardings: ServiceOnboarding[];
  configuration: AgentDetailConfiguration;
}

export interface ServiceOnboarding {
  id: string;
  serviceId: string;
  mode: 'shared_gateway' | 'dedicated_collector';
  collectorGroupId: string;
  identityId: string;
  status: 'not_started' | 'pending_verification' | 'verified' | 'failed';
  endpoint: string;
  resourceAttributes: string;
  kubernetesLabels: string;
  lastCheckStatus: string;
  lastCheckMessage: string;
  lastSeenLogAt?: string;
}

export interface OnboardingWorkspace {
  service: ServiceSummary;
  onboarding: ServiceOnboarding;
  identity: IdentitySummary | null;
  collectorTarget: CollectorTarget | null;
  generatedConfig: GeneratedConfig;
  checklist: ChecklistItem[];
  lastCheck: CheckResult | null;
  availableActions: string[];
}

export interface ServiceSummary {
  id: string;
  cmdbServiceId: string;
  businessId: string;
  applicationId: string;
  name: string;
  displayName: string;
  identityType: ServiceIdentityType;
  environment: string;
  cluster: string;
  namespace: string;
  ownerTeam: string;
  owner: string;
  alertRoute: string;
  status: string;
}

export interface IdentitySummary {
  id: string;
  identityType: string;
  enabled: boolean;
  tenantId: string;
  environment: string;
  k8sNamespace: string;
  k8sWorkload: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  tokenPresent: boolean;
}

export interface CollectorTarget {
  groupId: string;
  name: string;
  mode: string;
  environment: string;
  cluster: string;
  namespace: string;
  status: string;
  receiverProfile: string;
  exporterProfile: string;
  onlineInstances: number;
  healthyInstances: number;
  remoteConfigCapableInstances: number;
}

export interface GeneratedConfig {
  endpoint: string;
  resourceAttributes: Record<string, string>;
  resourceAttributesText: string;
  kubernetesLabels: Record<string, string>;
  environmentVariables: Record<string, string>;
  envBlock: string;
  otelCollectorHint: string;
  codeSamples: Record<string, string>;
}

export interface ChecklistItem {
  key: string;
  name: string;
  description: string;
  status: 'pending' | 'passed' | 'failed' | 'warning';
  blocking: boolean;
  message: string;
}

export interface CheckResult {
  status: string;
  message: string;
  checkedAt: string;
  details: ChecklistItem[];
}

export type CollectorGroupMode = 'shared_gateway' | 'dedicated_collector';
export type CollectorGroupStatus = 'draft' | 'active' | 'draining' | 'disabled' | 'deleted';
export type IsolationLevel = 'shared' | 'namespace_dedicated' | 'service_dedicated';
export type ReceiverProfile = 'otlp' | 'kafka' | 'syslog' | 'filelog' | 'mixed';
export type PublishStatus = 'none' | 'pending' | 'applying' | 'applied' | 'partial_failed' | 'failed';

export interface CollectorGroup {
  id: string;
  name: string;
  displayName: string;
  description: string;
  mode: CollectorGroupMode;
  environment: string;
  cluster: string;
  namespace: string;
  tenantId: string;
  ownerTeam: string;
  isolationLevel: IsolationLevel;
  platformTemplateId: string;
  receiverProfile: ReceiverProfile;
  exporterProfile: string;
  desiredReplicas: number;
  maxServices: number;
  status: CollectorGroupStatus;
  configVersion: number;
  desiredConfigHash: string;
  lastAppliedConfigHash: string;
  lastPublishStatus: PublishStatus;
  lastPublishMessage: string;
  lastPublishedAt: string;
  instanceCount?: number;
  onlineInstances?: number;
  healthyInstances?: number;
  remoteConfigCapableInstances?: number;
  enabledBindingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectorInstance {
  id: string;
  instanceUid: string;
  collectorGroupId: string;
  serviceId: string;
  hostname: string;
  podName: string;
  nodeName: string;
  ip: string;
  version: string;
  capabilities: number;
  online: boolean;
  healthy: boolean;
  remoteConfigCapable: boolean;
  effectiveConfigHash: string;
  lastConfigHash: string;
  remoteConfigStatus: 'unset' | 'applying' | 'applied' | 'failed';
  runtimeStatus: 'online' | 'stale' | 'offline';
  lastSeenAgeSeconds: number;
  lastError: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectorConfigVersion {
  id: string;
  collectorGroupId: string;
  version: number;
  configHash: string;
  collectorYaml: string;
  serviceIds: string[];
  status: 'draft' | 'pending' | 'applying' | 'applied' | 'partial_failed' | 'failed';
  createdBy: string;
  createdAt: string;
  appliedAt: string;
  message: string;
}

export interface CollectorConfigValidation {
  valid: boolean;
  renderedYaml: string;
  configHash: string;
  sourceBreakdown: ConfigSourceBreakdown[];
  warnings: string[];
  errors: string[];
}

export interface CollectorConfigAgentStatus {
  instanceUid: string;
  runtimeStatus: 'online' | 'stale' | 'offline';
  online: boolean;
  healthy: boolean;
  remoteConfigCapable: boolean;
  remoteConfigStatus: string;
  lastConfigHash: string;
  effectiveConfigHash: string;
  inSync: boolean;
  lastError: string;
  lastSeenAt: string;
}

export interface CollectorGroupConfigStatus {
  collectorGroup: CollectorGroup;
  desiredConfigHash: string;
  latestVersion: CollectorConfigVersion | null;
  agents: CollectorConfigAgentStatus[];
}

export interface CollectorPlatformTemplate {
  id: string;
  name: string;
  description: string;
  source: 'agent_effective_config' | 'manual' | string;
  sourceAgentUid: string;
  baseYaml: string;
  configHash: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectorGroupOverride {
  id: string;
  collectorGroupId: string;
  overrideYaml: string;
  updatedAt: string;
}

export interface ServiceEnrichmentPatch {
  id: string;
  serviceId: string;
  collectorGroupId: string;
  patchYaml: string;
  configHash: string;
  warnings: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePipelinePatch {
  id: string;
  serviceId: string;
  collectorGroupId: string;
  parserRuleId: string;
  patchYaml: string;
  configHash: string;
  status: string;
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigSourceBreakdown {
  type: string;
  id: string;
  name: string;
  status: string;
  hash: string;
  warnings: string[];
}

export interface CollectorConfigSources {
  platformTemplate: CollectorPlatformTemplate | null;
  groupOverride: CollectorGroupOverride | null;
  serviceEnrichmentPatches: ServiceEnrichmentPatch[];
  servicePipelinePatches: ServicePipelinePatch[];
  renderedYaml: string;
  configHash: string;
  warnings: string[];
  errors: string[];
  sourceBreakdown: ConfigSourceBreakdown[];
}

export interface AlertRule {
  id: string;
  name: string;
  source: 'logs' | 'metrics' | 'chain';
  ruleType: 'count' | 'rate' | 'ratio' | 'keyword' | 'absence' | 'chain_health';
  query: string;
  window: string;
  evalInterval: string;
  lookbackDelay: string;
  condition: string;
  groupBy: string[];
  severity: Severity;
  ownerTeam: string;
  alertRoute: string;
  status: 'enabled' | 'disabled' | 'draft';
}

export interface OverviewSummary {
  serviceCount: number;
  logThroughputPerMinute: number;
  healthyLogRouteCount: number;
  activeAlertCount: number;
}

export type K8sHealthStatus = 'healthy' | 'warning' | 'unknown' | 'failed';
export type K8sSyncStatus = 'applied' | 'pending' | 'unknown' | 'failed';

export interface K8sPodStats {
  total: number;
  ready: number;
  warning: number;
}

export interface K8sDashboardStats {
  clusterId: string;
  health: K8sHealthStatus;
  namespaces: number;
  workloads: number;
  pods: K8sPodStats;
}

export interface K8sDashboardSignal {
  key: string;
  label: string;
  status: K8sHealthStatus;
  source: string;
  checkedAt: string;
}

export interface K8sDashboardSyncState {
  status: K8sSyncStatus;
  source: string;
  timeWindow: string;
  lastSyncedAt: string;
}

export interface K8sDashboardSnapshot {
  stats: K8sDashboardStats;
  signals: K8sDashboardSignal[];
  sync: K8sDashboardSyncState;
}
