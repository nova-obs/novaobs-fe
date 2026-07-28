import type {
  AgentDetail,
  AlertRule,
  AlertSignalType,
  AlertRuleSpec,
  AlertRuleTestResult,
  AlertRuleUpdateRecord,
  NotificationPolicy,
  AlertInstance,
  AlertEvent,
  CheckResult,
  ChecklistItem,
  CollectorConfigSources,
  CollectorEnrollmentCredential,
  CollectorInstallationCredential,
  CollectorInstallation,
  CollectorConfigValidation,
  CollectorGroupConfigStatus,
  CollectorConfigVersion,
  CollectorGroup,
  CollectorGroupStatus,
  CollectorGroupOverride,
  CollectorInstance,
  CollectorPlatformTemplate,
  CollectorTarget,
  CreateServiceInput,
  GeneratedConfig,
  GrafanaProductIntegration,
  IdentitySummary,
  ImportK8sDeploymentServiceInput,
  K8sDashboardSnapshot,
  OnboardingWorkspace,
  OpAMPAgent,
  OverviewSummary,
  Product,
  ReceiverProfile,
  Service,
  ServiceDeployment,
  ServiceDeploymentInput,
  ServiceDeploymentTarget,
  HostAsset,
  HostAssetInput,
  HostAssetPatch,
  ServiceObservabilityGraph,
  ServiceEnrichmentPatch,
  ServiceOnboarding,
  ServicePipelinePatch,
  ServiceSummary,
  UpdateServiceInput,
} from './types';

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string } | null;
}

export class ApiRequestError<T = unknown> extends Error {
  status: number;
  code?: string;
  data?: T;

  constructor(message: string, status: number, code?: string, data?: T) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const signedOutStorageKey = 'novaapm_signed_out';
const clientSessionKeys = ['novaapm_session', 'novaapm_token', 'novaapm_subject', 'auth_token', 'access_token', 'refresh_token'];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const contentLength = response.headers?.get?.('content-length');
  if (response.status === 204 || contentLength === '0') {
    if (!response.ok) throw new Error(`请求失败: ${response.status}`);
    return undefined as T;
  }
  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    throw new Error('响应 JSON 无效');
  }
  if (!response.ok || !body.success) {
    if (response.status === 401) {
      redirectToLogin();
    }
    throw new ApiRequestError(body.error?.message ?? `请求失败: ${response.status}`, response.status, body.error?.code, body.data);
  }
  return body.data;
}

export const apiRequest = request;

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }
  for (const key of clientSessionKeys) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
  window.sessionStorage.setItem(signedOutStorageKey, '1');
  const target = '/?signed_out=1';
  if (window.location.pathname + window.location.search !== target) {
    window.location.replace(target);
  }
}

function computeRuntimeStatus(lastSeenAt: string): { runtimeStatus: 'online' | 'stale' | 'offline'; lastSeenAgeSeconds: number } {
  if (!lastSeenAt) return { runtimeStatus: 'offline', lastSeenAgeSeconds: Infinity };
  const age = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  if (age <= 60) return { runtimeStatus: 'online', lastSeenAgeSeconds: Math.round(age) };
  if (age <= 300) return { runtimeStatus: 'stale', lastSeenAgeSeconds: Math.round(age) };
  return { runtimeStatus: 'offline', lastSeenAgeSeconds: Math.round(age) };
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value);
}

function parseStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function mapOverview(raw: any): OverviewSummary {
  return {
    serviceCount: raw.service_count ?? raw.serviceCount ?? raw.services ?? 0,
    logThroughputPerMinute: raw.log_throughput_per_minute ?? raw.logThroughputPerMinute ?? 0,
    healthyLogRouteCount: raw.healthy_log_route_count ?? raw.healthyLogRouteCount ?? raw.healthy_pipeline_count ?? raw.healthyPipelineCount ?? 0,
    activeAlertCount: raw.active_alert_count ?? raw.activeAlertCount ?? raw.alerts ?? 0,
  };
}

function mapK8sDashboardSnapshot(raw: any): K8sDashboardSnapshot {
  return {
    stats: {
      clusterId: String(raw.stats?.cluster_id ?? raw.stats?.clusterId ?? ''),
      health: raw.stats?.health ?? 'unknown',
      namespaces: raw.stats?.namespaces ?? 0,
      workloads: raw.stats?.workloads ?? 0,
      pods: {
        total: raw.stats?.pods?.total ?? 0,
        ready: raw.stats?.pods?.ready ?? 0,
        warning: raw.stats?.pods?.warning ?? 0,
      },
    },
    signals: Array.isArray(raw.signals)
      ? raw.signals.map((signal: any) => ({
        key: String(signal.key ?? ''),
        label: signal.label ?? '',
        status: signal.status ?? 'unknown',
        source: signal.source ?? '',
        checkedAt: signal.checked_at ?? signal.checkedAt ?? '',
      }))
      : [],
    sync: {
      status: raw.sync?.status ?? 'unknown',
      source: raw.sync?.source ?? 'startorch',
      timeWindow: raw.sync?.time_window ?? raw.sync?.timeWindow ?? '',
      lastSyncedAt: raw.sync?.last_synced_at ?? raw.sync?.lastSyncedAt ?? '',
    },
  };
}

function mapService(raw: any): Service {
	return {
		id: String(raw.id),
		productId: String(raw.product_id ?? raw.productId ?? ''),
    key: raw.key ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    cmdbServiceId: raw.cmdb_service_id ?? raw.cmdbServiceId ?? '',
    businessId: raw.business_id ?? raw.businessId ?? '',
    applicationId: raw.application_id ?? raw.applicationId ?? '',
    ownerTeam: raw.owner_team ?? raw.ownerTeam ?? '',
    owner: raw.owner ?? '',
    alertRoute: raw.alert_route ?? raw.alertRoute ?? '',
    sloLevel: raw.slo_level ?? raw.sloLevel ?? '',
    source: raw.source ?? 'manual',
    syncStatus: raw.sync_status ?? 'local',
    lastSyncedAt: raw.last_synced_at ?? undefined,
    status: raw.status ?? 'active',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
    deploymentKinds: parseStringList(raw.deployment_kinds ?? raw.deploymentKinds)
      .filter((kind): kind is Service['deploymentKinds'][number] => kind === 'kubernetes_workload' || kind === 'host_set'),
  };
}

function mapHostAsset(raw: any): HostAsset {
  return {
    id: String(raw.id ?? ''),
    identitySource: raw.identity_source ?? 'manual',
    identityScope: raw.identity_scope ?? '',
    externalId: raw.external_id ?? '',
    displayName: raw.display_name ?? '',
    hostname: raw.hostname ?? '',
    ipAddresses: parseStringList(raw.ip_addresses),
    status: raw.status ?? 'active',
    region: raw.region ?? '',
    zone: raw.zone ?? '',
    labels: raw.labels && typeof raw.labels === 'object' ? raw.labels : {},
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function hostAssetInputPayload(input: HostAssetInput) {
  return {
    identity_source: input.identitySource,
    identity_scope: input.identityScope,
    external_id: input.externalId,
    display_name: input.displayName,
    hostname: input.hostname,
    status: input.status,
    ip_addresses: input.ipAddresses,
    region: input.region,
    zone: input.zone,
    labels: input.labels,
  };
}

function hostAssetPatchPayload(input: HostAssetPatch) {
  return {
    display_name: input.displayName,
    hostname: input.hostname,
    ip_addresses: input.ipAddresses,
    region: input.region,
    zone: input.zone,
    labels: input.labels,
  };
}

function mapServiceDeployment(raw: any): ServiceDeployment {
  const ref = raw.k8s_ref ?? raw.k8sRef;
  return {
    id: String(raw.id ?? ''),
    productId: String(raw.product_id ?? raw.productId ?? ''),
    serviceId: String(raw.service_id ?? raw.serviceId ?? ''),
    name: raw.name ?? '',
    kind: raw.kind ?? 'host_set',
    status: raw.status ?? 'active',
    source: raw.source ?? 'manual',
    k8sRef: ref ? {
      clusterId: ref.cluster_id ?? ref.clusterId ?? '',
      namespace: ref.namespace ?? '',
      apiVersion: ref.api_version ?? ref.apiVersion ?? '',
      workloadKind: ref.workload_kind ?? ref.workloadKind ?? '',
      workloadName: ref.workload_name ?? ref.workloadName ?? '',
      workloadUid: ref.workload_uid ?? ref.workloadUid ?? '',
    } : null,
    allowedLogRoots: parseStringList(raw.allowed_log_roots ?? raw.allowedLogRoots),
    hostTargets: Array.isArray(raw.host_targets ?? raw.hostTargets)
      ? (raw.host_targets ?? raw.hostTargets).map(mapHostAsset)
      : [],
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapServiceDeploymentTarget(raw: any): ServiceDeploymentTarget {
  return {
    id: String(raw.id ?? ''),
    serviceDeploymentId: String(raw.service_deployment_id ?? raw.serviceDeploymentId ?? ''),
    hostAssetId: String(raw.host_asset_id ?? raw.hostAssetId ?? ''),
    status: raw.status ?? 'active',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function serviceDeploymentPayload(input: ServiceDeploymentInput) {
  return {
    name: input.name,
    kind: input.kind,
    source: input.source ?? 'manual',
    allowed_log_roots: input.allowedLogRoots ?? [],
    ...(input.k8sRef ? {
      k8s_ref: {
        cluster_id: input.k8sRef.clusterId,
        namespace: input.k8sRef.namespace,
        api_version: input.k8sRef.apiVersion,
        workload_kind: input.k8sRef.workloadKind,
        workload_name: input.k8sRef.workloadName,
        workload_uid: input.k8sRef.workloadUid,
      },
    } : {}),
  };
}

function mapCollectorInstallation(raw: any): CollectorInstallation {
  const status = raw.status ?? (
    raw.active === false || raw.revoked_at
      ? 'revoked'
      : raw.enrollment_state === 'enrolled'
        ? 'active'
        : 'pending'
  );
  return {
    id: String(raw.id ?? raw.installation_id ?? ''),
    installationId: String(raw.installation_id ?? raw.installationId ?? raw.id ?? ''),
    hostAssetId: String(raw.host_asset_id ?? raw.hostAssetId ?? ''),
    agentRole: raw.agent_role ?? raw.agentRole ?? 'logs_agent',
    status,
    version: raw.version ?? '',
    connectionStatus: raw.connection_status ?? raw.connectionStatus ?? 'offline',
    processStatus: raw.process_status ?? raw.processStatus ?? 'unknown',
    configStatus: raw.config_status ?? raw.configStatus ?? 'pending',
    lastSeenAt: raw.last_seen_at ?? raw.lastSeenAt ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapProduct(raw: any): Product {
  const tenant = raw.tenant ?? {};
	return {
		id: String(raw.id ?? ''),
    key: raw.key ?? '',
		name: raw.name ?? '',
		description: raw.description ?? '',
    tenant: {
      accountId: String(tenant.account_id ?? tenant.accountId ?? '0'),
      projectId: String(tenant.project_id ?? tenant.projectId ?? ''),
    },
		status: raw.status ?? 'active',
		createdAt: raw.created_at ?? raw.createdAt ?? '',
		updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
	};
}

function mapGrafanaProductIntegration(raw: any): GrafanaProductIntegration {
  return {
    productId: String(raw.product_id ?? raw.productId ?? ''),
    state: raw.state ?? 'pending',
    folder: {
      uid: raw.folder?.uid ?? '',
      title: raw.folder?.title ?? '',
      state: raw.folder?.state ?? 'pending',
    },
    datasources: Array.isArray(raw.datasources) ? raw.datasources.map((item: any) => ({
      endpointId: String(item.endpoint_id ?? item.endpointId ?? ''),
      endpointName: item.endpoint_name ?? item.endpointName ?? '',
      uid: item.uid ?? '',
      name: item.name ?? '',
      url: item.url ?? '',
      state: item.state ?? 'pending',
      health: item.health ?? '',
      lastError: item.last_error ?? item.lastError ?? '',
      lastCheckedAt: item.last_checked_at ?? item.lastCheckedAt ?? '',
    })) : [],
    lastError: raw.last_error ?? raw.lastError ?? '',
    attempts: Number(raw.attempts ?? 0),
    nextRetryAt: raw.next_retry_at ?? raw.nextRetryAt ?? '',
    lastReconciledAt: raw.last_reconciled_at ?? raw.lastReconciledAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapAgent(raw: any): OpAMPAgent {
  const backendStatus = raw.runtime_status as 'online' | 'stale' | 'offline' | undefined;
  const local = computeRuntimeStatus(raw.last_seen_at ?? raw.lastSeenAt ?? '');
  return {
    instanceUid: String(raw.instance_uid ?? raw.instanceUid ?? ''),
    collectorGroupId: String(raw.collector_group_id ?? ''),
    online: raw.online ?? false,
    healthy: raw.healthy ?? false,
    capabilities: raw.capabilities ?? 0,
    remoteConfigStatus: raw.remote_config_status ?? raw.remoteConfigStatus ?? 'unset',
    lastConfigHash: raw.last_config_hash ?? raw.lastConfigHash ?? '',
    lastError: raw.last_error ?? raw.lastError ?? '',
    lastSeenAt: raw.last_seen_at ?? raw.lastSeenAt ?? '',
    runtimeStatus: backendStatus || local.runtimeStatus,
    lastSeenAgeSeconds: local.lastSeenAgeSeconds,
  };
}

function mapAgentDetail(raw: any): AgentDetail {
  return {
    instanceUid: String(raw.instance_uid ?? raw.instanceUid ?? ''),
    runtime: mapCollectorInstance(raw.runtime ?? {}),
    agent: {
      state: {
        instanceUid: raw.agent?.state?.instance_uid ?? raw.instance_uid ?? '',
        collectorGroupId: String(raw.agent?.state?.collector_group_id ?? ''),
        online: raw.agent?.state?.online ?? false,
        healthy: raw.agent?.state?.healthy ?? false,
        capabilities: raw.agent?.state?.capabilities ?? 0,
        remoteConfigCapable: raw.agent?.state?.remote_config_capable ?? false,
        effectiveConfigHash: raw.agent?.state?.effective_config_hash ?? '',
        remoteConfigStatus: raw.agent?.state?.remote_config_status ?? '',
        lastConfigHash: raw.agent?.state?.last_config_hash ?? '',
        lastError: raw.agent?.state?.last_error ?? '',
        lastSeenAt: raw.agent?.state?.last_seen_at ?? '',
      },
      identifyingAttributes: Array.isArray(raw.agent?.identifying_attributes)
        ? raw.agent.identifying_attributes.map((a: any) => ({ key: a.key ?? '', value: a.value, valueText: a.value_text ?? String(a.value ?? ''), identifying: a.identifying ?? false }))
        : [],
      nonIdentifyingAttributes: Array.isArray(raw.agent?.non_identifying_attributes)
        ? raw.agent.non_identifying_attributes.map((a: any) => ({ key: a.key ?? '', value: a.value, valueText: a.value_text ?? String(a.value ?? ''), identifying: a.identifying ?? false }))
        : [],
      effectiveConfig: raw.agent?.effective_config ?? '',
      effectiveConfigFiles: raw.agent?.effective_config_files ?? {},
      lastRemoteConfig: raw.agent?.last_remote_config ?? '',
      lastRemoteConfigHash: raw.agent?.last_remote_config_hash ?? '',
      lastRemoteConfigFiles: raw.agent?.last_remote_config_files ?? {},
      lastSeenAt: raw.agent?.last_seen_at ?? '',
    },
    collectorGroup: raw.collector_group ? mapCollectorGroup(raw.collector_group) : null,
    configuration: {
      effectiveConfig: raw.configuration?.effective_config ?? '',
      effectiveConfigFiles: raw.configuration?.effective_config_files ?? {},
      effectiveConfigHash: raw.configuration?.effective_config_hash ?? '',
      lastRemoteConfig: raw.configuration?.last_remote_config ?? '',
      lastRemoteConfigFiles: raw.configuration?.last_remote_config_files ?? {},
      lastRemoteConfigHash: raw.configuration?.last_remote_config_hash ?? '',
      expectedConfigHash: raw.configuration?.expected_config_hash ?? '',
      inSync: raw.configuration?.in_sync ?? false,
      applyStatus: raw.configuration?.apply_status ?? '',
      configSources: raw.configuration?.config_sources ? mapCollectorConfigSources(raw.configuration.config_sources) : null,
    },
  };
}

function mapOnboarding(raw: any): ServiceOnboarding {
  return {
    id: String(raw.id),
    serviceId: String(raw.service_id),
    mode: raw.mode,
    collectorGroupId: String(raw.collector_group_id ?? ''),
    identityId: String(raw.identity_id ?? ''),
    status: raw.status,
    endpoint: raw.endpoint,
    resourceAttributes: raw.resource_attributes ?? '',
    kubernetesLabels: raw.kubernetes_labels ?? '',
    lastCheckStatus: raw.last_check_status ?? '',
    lastCheckMessage: raw.last_check_message ?? '',
    lastSeenLogAt: raw.last_seen_log_at ?? undefined,
  };
}

function mapServiceSummary(raw: any): ServiceSummary {
  return {
    id: String(raw.id),
    cmdbServiceId: raw.cmdb_service_id ?? '',
    businessId: raw.business_id ?? '',
    applicationId: raw.application_id ?? '',
    name: raw.name,
    displayName: raw.display_name ?? '',
    identityType: raw.identity_type ?? 'k8s_workload',
    cluster: raw.cluster ?? '',
    namespace: raw.namespace ?? '',
    ownerTeam: raw.owner_team ?? '',
    owner: raw.owner ?? '',
    alertRoute: raw.alert_route ?? '',
    status: raw.status ?? 'active',
  };
}

function mapIdentitySummary(raw: any): IdentitySummary {
  return {
    id: String(raw.id),
    identityType: raw.identity_type ?? '',
    enabled: raw.enabled ?? false,
    tenantId: raw.tenant_id ?? '',
    k8sNamespace: raw.k8s_namespace ?? '',
    k8sWorkload: raw.k8s_workload ?? '',
    expiresAt: raw.expires_at ?? '',
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
    tokenPresent: raw.token_present ?? false,
  };
}

function mapCollectorTarget(raw: any): CollectorTarget {
  return {
    groupId: String(raw.group_id),
    name: raw.name,
    mode: raw.mode,
    cluster: raw.cluster ?? '',
    namespace: raw.namespace ?? '',
    status: raw.status ?? 'active',
    receiverProfile: raw.receiver_profile ?? '',
    exporterProfile: raw.exporter_profile ?? '',
    onlineInstances: raw.online_instances ?? 0,
    healthyInstances: raw.healthy_instances ?? 0,
    remoteConfigCapableInstances: raw.remote_config_capable_instances ?? 0,
  };
}

function mapChecklistItem(raw: any): ChecklistItem {
  return {
    key: raw.key ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    status: raw.status ?? 'pending',
    blocking: raw.blocking ?? false,
    message: raw.message ?? '',
  };
}

function mapGeneratedConfig(raw: any): GeneratedConfig {
  return {
    endpoint: raw.endpoint ?? '',
    resourceAttributes: raw.resource_attributes ?? {},
    resourceAttributesText: raw.resource_attributes_text ?? '',
    kubernetesLabels: raw.kubernetes_labels ?? {},
    environmentVariables: raw.environment_variables ?? {},
    envBlock: raw.env_block ?? '',
    otelCollectorHint: raw.otel_collector_hint ?? '',
    codeSamples: raw.code_samples ?? {},
  };
}

function mapWorkspace(raw: any): OnboardingWorkspace {
  return {
    service: mapServiceSummary(raw.service ?? {}),
    onboarding: mapOnboarding(raw.onboarding ?? {}),
    identity: raw.identity ? mapIdentitySummary(raw.identity) : null,
    collectorTarget: raw.collector_target ? mapCollectorTarget(raw.collector_target) : null,
    generatedConfig: mapGeneratedConfig(raw.generated_config ?? {}),
    checklist: Array.isArray(raw.checklist) ? raw.checklist.map(mapChecklistItem) : [],
    lastCheck: raw.last_check
      ? { status: raw.last_check.status ?? '', message: raw.last_check.message ?? '', checkedAt: raw.last_check.checked_at ?? '', details: Array.isArray(raw.last_check.details) ? raw.last_check.details.map(mapChecklistItem) : [] }
      : null,
    availableActions: Array.isArray(raw.available_actions) ? raw.available_actions.map(String) : [],
  };
}

function mapCollectorGroup(raw: any): CollectorGroup {
  return {
    id: String(raw.id),
    name: raw.name,
    displayName: raw.display_name ?? '',
    description: raw.description ?? '',
    mode: raw.mode,
    cluster: raw.cluster ?? '',
    namespace: raw.namespace ?? '',
    tenantId: raw.tenant_id ?? '',
    ownerTeam: raw.owner_team ?? '',
    isolationLevel: raw.isolation_level ?? 'shared',
    platformTemplateId: raw.platform_template_id ?? '',
    receiverProfile: raw.receiver_profile ?? 'mixed',
    exporterProfile: raw.exporter_profile ?? 'logs/downstream',
    desiredReplicas: raw.desired_replicas ?? 1,
    maxServices: raw.max_services ?? 0,
    status: raw.status ?? 'draft',
    configVersion: raw.config_version ?? 0,
    desiredConfigHash: raw.desired_config_hash ?? '',
    lastAppliedConfigHash: raw.last_applied_config_hash ?? '',
    lastPublishStatus: raw.last_publish_status ?? 'none',
    lastPublishMessage: raw.last_publish_message ?? '',
    lastPublishedAt: raw.last_published_at ?? '',
    instanceCount: raw.instance_count ?? raw.instanceCount ?? 0,
    onlineInstances: raw.online_instances ?? raw.onlineInstances ?? 0,
    healthyInstances: raw.healthy_instances ?? raw.healthyInstances ?? 0,
    remoteConfigCapableInstances: raw.remote_config_capable_instances ?? 0,
    enabledBindingCount: raw.enabled_binding_count ?? raw.enabledBindingCount ?? 0,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapCollectorInstance(raw: any): CollectorInstance {
  const backendStatus = raw.runtime_status as 'online' | 'stale' | 'offline' | undefined;
  const local = computeRuntimeStatus(raw.last_seen_at ?? raw.lastSeenAt ?? '');
  return {
    id: String(raw.id ?? ''),
    instanceUid: String(raw.instance_uid ?? raw.instanceUid ?? ''),
    opampInstanceUid: String(raw.opamp_instance_uid ?? raw.opampInstanceUid ?? raw.instance_uid ?? raw.instanceUid ?? ''),
    runtimeIdentity: String(raw.runtime_identity ?? raw.runtimeIdentity ?? ''),
    collectorGroupId: String(raw.collector_group_id ?? ''),
    installationId: String(raw.installation_id ?? raw.installationId ?? ''),
    hostAssetId: String(raw.host_asset_id ?? raw.hostAssetId ?? ''),
    agentRole: raw.agent_role ?? raw.agentRole ?? '',
    clusterId: String(raw.cluster_id ?? raw.clusterId ?? ''),
    namespace: String(raw.namespace ?? ''),
    agentNamespace: String(raw.agent_namespace ?? raw.agentNamespace ?? ''),
    hostname: raw.hostname ?? '',
    podUid: raw.pod_uid ?? raw.podUid ?? '',
    podName: raw.pod_name ?? raw.podName ?? '',
    nodeName: raw.node_name ?? raw.nodeName ?? '',
    ip: raw.ip ?? '',
    podIp: raw.pod_ip ?? raw.podIp ?? raw.ip ?? '',
    version: raw.version ?? '',
    capabilities: raw.capabilities ?? 0,
    online: raw.online ?? false,
    healthy: raw.healthy ?? false,
    healthObservedAt: raw.health_observed_at ?? raw.healthObservedAt ?? '',
    remoteConfigCapable: raw.remote_config_capable ?? false,
    effectiveConfigHash: raw.effective_config_hash ?? '',
    lastConfigHash: raw.last_config_hash ?? raw.lastConfigHash ?? '',
    remoteConfigStatus: raw.remote_config_status ?? 'unset',
    runtimeStatus: backendStatus || local.runtimeStatus,
    connectionStatus: raw.connection_status ?? raw.connectionStatus ?? (raw.online ? 'online' : 'offline'),
    processStatus: raw.process_status ?? raw.processStatus ?? (raw.online ? (raw.healthy ? 'healthy' : 'unhealthy') : 'unknown'),
    configStatus: raw.config_status ?? raw.configStatus ?? raw.remote_config_status ?? 'pending',
    lastSeenAgeSeconds: local.lastSeenAgeSeconds,
    lastError: raw.last_error ?? raw.lastError ?? '',
    lastSeenAt: raw.last_seen_at ?? raw.lastSeenAt ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapCollectorConfigVersion(raw: any): CollectorConfigVersion {
  return {
    id: String(raw.id),
    collectorGroupId: String(raw.collector_group_id),
    version: raw.version ?? 0,
    configHash: raw.config_hash ?? '',
    collectorYaml: raw.collector_yaml ?? '',
    serviceIds: Array.isArray(raw.service_ids) ? raw.service_ids.map(String) : [],
    status: raw.status ?? 'pending',
    createdBy: raw.created_by ?? '',
    createdAt: raw.created_at ?? '',
    appliedAt: raw.applied_at ?? '',
    message: raw.message ?? '',
  };
}

function mapCollectorConfigValidation(raw: any): CollectorConfigValidation {
  return {
    valid: raw.valid ?? false,
    renderedYaml: raw.rendered_yaml ?? '',
    configHash: raw.config_hash ?? '',
    sourceBreakdown: Array.isArray(raw.source_breakdown) ? raw.source_breakdown.map(mapSourceBreakdown) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    errors: Array.isArray(raw.errors) ? raw.errors.map(String) : [],
  };
}

function mapCollectorConfigAgentStatus(raw: any) {
  return {
    instanceUid: raw.instance_uid ?? '',
    runtimeStatus: raw.runtime_status ?? 'offline',
    online: raw.online ?? false,
    healthy: raw.healthy ?? false,
    remoteConfigCapable: raw.remote_config_capable ?? false,
    remoteConfigStatus: raw.remote_config_status ?? 'unset',
    lastConfigHash: raw.last_config_hash ?? '',
    effectiveConfigHash: raw.effective_config_hash ?? '',
    inSync: raw.in_sync ?? false,
    lastError: raw.last_error ?? '',
    lastSeenAt: raw.last_seen_at ?? '',
  };
}

function mapCollectorGroupConfigStatus(raw: any): CollectorGroupConfigStatus {
  return {
    collectorGroup: mapCollectorGroup(raw.collector_group ?? {}),
    desiredConfigHash: raw.desired_config_hash ?? '',
    latestVersion: raw.latest_version ? mapCollectorConfigVersion(raw.latest_version) : null,
    agents: Array.isArray(raw.agents) ? raw.agents.map(mapCollectorConfigAgentStatus) : [],
  };
}

function mapCollectorPlatformTemplate(raw: any): CollectorPlatformTemplate {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    description: raw.description ?? '',
    source: raw.source ?? '',
    sourceAgentUid: raw.source_agent_uid ?? '',
    baseYaml: raw.base_yaml ?? '',
    configHash: raw.config_hash ?? '',
    status: raw.status ?? '',
    version: raw.version ?? 0,
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
  };
}

function mapCollectorGroupOverride(raw: any): CollectorGroupOverride {
  return {
    id: String(raw.id ?? ''),
    collectorGroupId: String(raw.collector_group_id ?? ''),
    overrideYaml: raw.override_yaml ?? '',
    updatedAt: raw.updated_at ?? '',
  };
}

function mapServiceEnrichmentPatch(raw: any): ServiceEnrichmentPatch {
  return {
    id: String(raw.id ?? ''),
    serviceId: String(raw.service_id ?? ''),
    collectorGroupId: String(raw.collector_group_id ?? ''),
    patchYaml: raw.patch_yaml ?? '',
    configHash: raw.config_hash ?? '',
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    status: raw.status ?? '',
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
  };
}

function mapServicePipelinePatch(raw: any): ServicePipelinePatch {
  return {
    id: String(raw.id ?? ''),
    serviceId: String(raw.service_id ?? ''),
    collectorGroupId: String(raw.collector_group_id ?? ''),
    parserRuleId: String(raw.parser_rule_id ?? ''),
    patchYaml: raw.patch_yaml ?? '',
    configHash: raw.config_hash ?? '',
    status: raw.status ?? '',
    enabled: raw.enabled ?? false,
    version: raw.version ?? 0,
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
  };
}

function mapSourceBreakdown(raw: any) {
  return {
    type: raw.type ?? '',
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    status: raw.status ?? '',
    hash: raw.hash ?? '',
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
  };
}

function mapCollectorConfigSources(raw: any): CollectorConfigSources {
  return {
    platformTemplate: raw.platform_template ? mapCollectorPlatformTemplate(raw.platform_template) : null,
    groupOverride: raw.group_override ? mapCollectorGroupOverride(raw.group_override) : null,
    serviceEnrichmentPatches: Array.isArray(raw.service_enrichment_patches) ? raw.service_enrichment_patches.map(mapServiceEnrichmentPatch) : [],
    servicePipelinePatches: Array.isArray(raw.service_pipeline_patches) ? raw.service_pipeline_patches.map(mapServicePipelinePatch) : [],
    renderedYaml: raw.rendered_yaml ?? '',
    configHash: raw.config_hash ?? '',
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    errors: Array.isArray(raw.errors) ? raw.errors.map(String) : [],
    sourceBreakdown: Array.isArray(raw.source_breakdown) ? raw.source_breakdown.map(mapSourceBreakdown) : [],
  };
}

function mapServiceObservabilityGraph(raw: any): ServiceObservabilityGraph {
  return {
    service: mapService(raw.service ?? {}),
    deployments: Array.isArray(raw.deployments) ? raw.deployments.map(mapServiceDeployment) : [],
    logRoutes: {
      total: raw.log_routes?.total ?? raw.logRoutes?.total ?? 0,
      routes: Array.isArray(raw.log_routes?.routes ?? raw.logRoutes?.routes)
        ? (raw.log_routes?.routes ?? raw.logRoutes?.routes).map((item: any) => ({
          route: {
            id: String(item.route?.id ?? ''),
            sourceType: item.route?.source_type ?? item.route?.sourceType ?? '',
            serviceDeploymentId: item.route?.service_deployment_id ?? item.route?.serviceDeploymentId ?? '',
            endpointId: item.route?.endpoint_id ?? item.route?.endpointId ?? '',
            status: item.route?.status ?? '',
            collectorConfigHash: item.route?.collector_config_hash ?? item.route?.collectorConfigHash ?? '',
            lastPublishStatus: item.route?.last_publish_status ?? item.route?.lastPublishStatus ?? '',
          },
          endpoint: item.endpoint ? {
            id: String(item.endpoint.id ?? ''),
            name: item.endpoint.name ?? '',
            sinkType: item.endpoint.sink_type ?? item.endpoint.sinkType ?? 'vl',
            streamName: item.endpoint.stream_name ?? item.endpoint.streamName ?? '',
            vmuiURL: item.endpoint.vmui_url ?? item.endpoint.vmuiURL ?? '',
          } : null,
        }))
        : [],
    },
    alertRules: Array.isArray(raw.alert_rules) ? raw.alert_rules.map(mapAlertRule) : [],
  };
}

function mapAlertRule(raw: any): AlertRule {
  return {
    id: String(raw.id),
    spec: mapAlertRuleSpec(raw.spec ?? {}),
    state: raw.state ?? 'disabled',
    applyStatus: raw.apply_status ?? raw.applyStatus ?? 'pending',
    currentUpdateId: raw.current_update_id ?? raw.currentUpdateId ?? '',
    appliedUpdateId: raw.applied_update_id ?? raw.appliedUpdateId ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapAlertRuleSpec(raw: any): AlertRuleSpec {
  const scope = raw.scope ?? {};
  const notification = raw.notification ?? {};
  return {
    signalType: raw.signal_type ?? raw.signalType ?? 'logs',
    name: raw.name ?? '',
    description: raw.description ?? '',
    scope: {
      productId: scope.product_id ?? scope.productId ?? '',
      serviceId: scope.service_id ?? scope.serviceId ?? '',
      serviceName: scope.service_name ?? scope.serviceName ?? '',
		scopeLabels: scope.scope_labels ?? scope.scopeLabels ?? {},
      logRouteId: scope.log_route_id ?? scope.logRouteId ?? '',
      logTargetId: scope.log_target_id ?? scope.logTargetId ?? '',
      endpointId: scope.endpoint_id ?? scope.endpointId ?? '',
      accountId: scope.account_id ?? scope.accountId ?? '',
      projectId: scope.project_id ?? scope.projectId ?? '',
      baseFilter: scope.base_filter ?? scope.baseFilter ?? '',
    },
    query: { mode: raw.query?.mode ?? 'contains', expression: raw.query?.expression ?? '' },
    trigger: {
      mode: 'window',
      aggregation: raw.trigger?.aggregation ?? 'count',
      operator: raw.trigger?.operator ?? 'gte',
      threshold: Number(raw.trigger?.threshold ?? 1),
      window: raw.trigger?.window ?? '1m',
      evaluationInterval: raw.trigger?.evaluation_interval ?? '30s',
      evaluationDelay: raw.trigger?.evaluation_delay ?? '0s',
      pendingFor: raw.trigger?.pending_for ?? '0s',
      keepFiringFor: raw.trigger?.keep_firing_for ?? '0s',
    },
    grouping: { fields: parseStringList(raw.grouping?.fields), maxInstances: Number(raw.grouping?.max_instances ?? 100) },
    notification: {
      policyId: notification.policy_id ?? notification.policyId ?? '',
      severity: notification.severity ?? 'warning',
      ownerTeam: notification.owner_team ?? notification.ownerTeam ?? '',
      runbookUrl: notification.runbook_url ?? notification.runbookUrl ?? '',
    },
    derivedMetric: raw.derived_metric ? {
      enabled: Boolean(raw.derived_metric.enabled),
      signal: raw.derived_metric.signal ?? '',
      labels: raw.derived_metric.labels ?? {},
    } : undefined,
  };
}

function alertRuleSpecBody(spec: AlertRuleSpec) {
  return {
    signal_type: spec.signalType,
    name: spec.name,
    description: spec.description,
    scope: {
      product_id: spec.scope.productId,
      service_id: spec.scope.serviceId,
      service_name: spec.scope.serviceName,
		scope_labels: spec.scope.scopeLabels,
      log_route_id: spec.scope.logRouteId,
      log_target_id: spec.scope.logTargetId,
      endpoint_id: spec.scope.endpointId,
      account_id: spec.scope.accountId,
      project_id: spec.scope.projectId,
      base_filter: spec.scope.baseFilter,
    },
    query: spec.query,
    trigger: {
      mode: spec.trigger.mode,
      aggregation: spec.trigger.aggregation,
      operator: spec.trigger.operator,
      threshold: spec.trigger.threshold,
      window: spec.trigger.window,
      evaluation_interval: spec.trigger.evaluationInterval,
      evaluation_delay: spec.trigger.evaluationDelay,
      pending_for: spec.trigger.pendingFor,
      keep_firing_for: spec.trigger.keepFiringFor,
    },
    grouping: { fields: spec.grouping.fields, max_instances: spec.grouping.maxInstances },
    notification: {
      policy_id: spec.notification.policyId,
      severity: spec.notification.severity,
      owner_team: spec.notification.ownerTeam,
      runbook_url: spec.notification.runbookUrl || undefined,
    },
    derived_metric: spec.derivedMetric ? {
      enabled: spec.derivedMetric.enabled,
      signal: spec.derivedMetric.signal,
      labels: spec.derivedMetric.labels,
    } : undefined,
  };
}

function mapNotificationPolicy(raw: any): NotificationPolicy {
  return {
    id: String(raw.id ?? ''), name: raw.name ?? '', description: raw.description ?? '', serviceId: raw.service_id ?? '',
    receiver: raw.receiver ?? '',
    enabled: Boolean(raw.enabled), createdAt: raw.created_at ?? '', updatedAt: raw.updated_at ?? '',
  };
}

export const api = {
	async getProducts(): Promise<Product[]> {
		const raw = await request<any[]>('/products');
		return Array.isArray(raw) ? raw.map(mapProduct) : [];
	},
  async getProduct(productId: string): Promise<Product> {
    return mapProduct(await request<any>(`/products/${encodeURIComponent(productId)}`));
  },
	async createProduct(input: { key: string; name: string; description?: string }): Promise<Product> {
		return mapProduct(await request<any>('/products', {
			method: 'POST',
			body: JSON.stringify({ key: input.key, name: input.name, description: input.description }),
		}));
	},
  async updateProduct(productId: string, patch: { name?: string; description?: string }): Promise<Product> {
    return mapProduct(await request<any>(`/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }));
  },
  async archiveProduct(productId: string): Promise<Product> {
    return mapProduct(await request<any>(`/products/${encodeURIComponent(productId)}`, { method: 'DELETE' }));
  },
  async getGrafanaProductIntegration(productId: string): Promise<GrafanaProductIntegration> {
    return mapGrafanaProductIntegration(await request<any>(`/products/${encodeURIComponent(productId)}/integrations/grafana`));
  },
  async reconcileGrafanaProductIntegration(productId: string): Promise<GrafanaProductIntegration> {
    return mapGrafanaProductIntegration(await request<any>(`/products/${encodeURIComponent(productId)}/integrations/grafana/reconcile`, { method: 'POST' }));
  },
  async getOverview(): Promise<OverviewSummary> {
    const raw = await request<any>('/overview');
    return mapOverview(raw);
  },
  async getProductServices(productId: string, params?: { q?: string; status?: string; source?: string }): Promise<Service[]> {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.status) search.set('status', params.status);
    if (params?.source) search.set('source', params.source);
    const qs = search.toString();
    const raw = await request<any[]>(`/products/${encodeURIComponent(productId)}/services${qs ? `?${qs}` : ''}`);
    return Array.isArray(raw) ? raw.map(mapService) : [];
  },
  async getService(productId: string, serviceId: string): Promise<Service> {
    return mapService(await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}`));
  },
  async getServices(params?: { q?: string; status?: string; source?: string }): Promise<Service[]> {
    const products = await api.getProducts();
    const lists = await Promise.all(products.map((product) => api.getProductServices(product.id, params)));
    return lists.flat();
  },
  async createService(input: CreateServiceInput): Promise<Service> {
	const raw = await request<any>(`/products/${encodeURIComponent(input.productId)}/services`, {
      method: 'POST',
      body: JSON.stringify({
        key: input.key,
		name: input.name,
        description: input.description,
        owner_team: input.ownerTeam,
        owner: input.owner,
        alert_route: input.alertRoute,
        slo_level: input.sloLevel,
      }),
    });
    return mapService(raw);
  },
  async importK8sDeploymentService(input: ImportK8sDeploymentServiceInput): Promise<Service> {
    const raw = await request<any>(`/products/${encodeURIComponent(input.productId)}/services/imports/k8s`, {
      method: 'POST',
      body: JSON.stringify({
        cluster_id: input.clusterId,
        namespace: input.namespace,
        deployment_name: input.deploymentName,
        deployment_uid: input.deploymentUid,
      }),
    });
    return mapService(raw.service ?? raw);
  },
  async updateService(productId: string, id: string, patch: UpdateServiceInput): Promise<Service> {
    const raw = await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        key: patch.key,
        cmdb_service_id: optionalString(patch.cmdbServiceId),
        business_id: optionalString(patch.businessId),
        application_id: optionalString(patch.applicationId),
        name: patch.name,
        description: patch.description,
        owner_team: patch.ownerTeam,
        owner: patch.owner,
        alert_route: patch.alertRoute,
        slo_level: patch.sloLevel,
        status: patch.status,
      }),
    });
    return mapService(raw);
  },
  async archiveService(productId: string, id: string): Promise<Service> {
    return mapService(await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  },
  async getServiceDeployments(productId: string, serviceId: string): Promise<ServiceDeployment[]> {
    const raw = await request<any[] | null>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/deployments`);
    return Array.isArray(raw) ? raw.map(mapServiceDeployment) : [];
  },
  async getServiceDeployment(productId: string, serviceId: string, deploymentId: string): Promise<ServiceDeployment> {
    return mapServiceDeployment(await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}`));
  },
  async getServiceDeploymentTargets(productId: string, serviceId: string, deploymentId: string): Promise<ServiceDeploymentTarget[]> {
    const raw = await request<any[] | null>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}/hosts`);
    return Array.isArray(raw) ? raw.map(mapServiceDeploymentTarget) : [];
  },
  async getServiceDeploymentHostAssets(productId: string, serviceId: string, deploymentId: string): Promise<HostAsset[]> {
    const targets = await api.getServiceDeploymentTargets(productId, serviceId, deploymentId);
    return Promise.all(
      targets
        .filter((target) => target.status === 'active')
        .map((target) => api.getHostAsset(target.hostAssetId)),
    );
  },
  async createServiceDeployment(productId: string, serviceId: string, input: ServiceDeploymentInput): Promise<ServiceDeployment> {
    return mapServiceDeployment(await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/deployments`, {
      method: 'POST',
      body: JSON.stringify(serviceDeploymentPayload(input)),
    }));
  },
  async updateServiceDeployment(productId: string, serviceId: string, deploymentId: string, input: ServiceDeploymentInput): Promise<ServiceDeployment> {
    return mapServiceDeployment(await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(serviceDeploymentPayload(input)),
    }));
  },
  async replaceServiceDeploymentHosts(productId: string, serviceId: string, deploymentId: string, hostIds: string[]): Promise<ServiceDeploymentTarget[]> {
    const raw = await request<any[] | null>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}/hosts`, {
      method: 'PUT',
      body: JSON.stringify({ host_asset_ids: hostIds }),
    });
    return Array.isArray(raw) ? raw.map(mapServiceDeploymentTarget) : [];
  },
  async retireServiceDeployment(productId: string, serviceId: string, deploymentId: string): Promise<ServiceDeployment> {
    return mapServiceDeployment(await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/deployments/${encodeURIComponent(deploymentId)}`, {
      method: 'DELETE',
    }));
  },
  async getHostAssets(params?: { q?: string; status?: string }): Promise<HostAsset[]> {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.status) search.set('status', params.status);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const raw = await request<any[] | null>(`/platform/hosts${suffix}`);
    return Array.isArray(raw) ? raw.map(mapHostAsset) : [];
  },
  async getHostAsset(hostId: string): Promise<HostAsset> {
    return mapHostAsset(await request<any>(`/platform/hosts/${encodeURIComponent(hostId)}`));
  },
  async createHostAsset(input: HostAssetInput): Promise<HostAsset> {
    return mapHostAsset(await request<any>('/platform/hosts', {
      method: 'POST',
      body: JSON.stringify(hostAssetInputPayload(input)),
    }));
  },
  async importHostAssets(inputs: HostAssetInput[]): Promise<HostAsset[]> {
    const raw = await request<any[] | null>('/platform/hosts/import', {
      method: 'POST',
      body: JSON.stringify({ hosts: inputs.map(hostAssetInputPayload) }),
    });
    return Array.isArray(raw) ? raw.map(mapHostAsset) : [];
  },
  async updateHostAsset(hostId: string, input: HostAssetPatch): Promise<HostAsset> {
    return mapHostAsset(await request<any>(`/platform/hosts/${encodeURIComponent(hostId)}`, {
      method: 'PATCH',
      body: JSON.stringify(hostAssetPatchPayload(input)),
    }));
  },
  async retireHostAsset(hostId: string): Promise<HostAsset> {
    return mapHostAsset(await request<any>(`/platform/hosts/${encodeURIComponent(hostId)}/retire`, {
      method: 'POST',
    }));
  },
  async createCollectorInstallation(input: { hostAssetId: string; agentRole?: string }): Promise<CollectorInstallation> {
    return mapCollectorInstallation(await request<any>('/collector/installations', {
      method: 'POST',
      body: JSON.stringify({ host_asset_id: input.hostAssetId, agent_role: input.agentRole ?? 'logs_agent' }),
    }));
  },
  async getCollectorInstallations(): Promise<CollectorInstallation[]> {
    const raw = await request<any[] | null>('/collector/installations');
    return Array.isArray(raw) ? raw.map(mapCollectorInstallation) : [];
  },
  async issueCollectorEnrollmentToken(installationId: string): Promise<CollectorEnrollmentCredential> {
    const raw = await request<any>(`/collector/installations/${encodeURIComponent(installationId)}/enrollment-token`, { method: 'POST' });
    return {
      installation: mapCollectorInstallation(raw.installation ?? {}),
      token: raw.enrollment_token ?? '',
    };
  },
  async rotateCollectorInstallationCredential(installationId: string): Promise<CollectorInstallationCredential> {
    const raw = await request<any>(`/collector/installations/${encodeURIComponent(installationId)}/rotate-credential`, { method: 'POST' });
    return {
      installation: mapCollectorInstallation(raw.installation ?? {}),
      credential: raw.installation_credential ?? '',
    };
  },
  async revokeCollectorInstallation(installationId: string): Promise<CollectorInstallation> {
    return mapCollectorInstallation(await request<any>(`/collector/installations/${encodeURIComponent(installationId)}/revoke`, { method: 'POST' }));
  },
  async getServiceObservabilityGraph(productId: string, serviceId: string): Promise<ServiceObservabilityGraph> {
    const raw = await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/observability-graph`);
    return mapServiceObservabilityGraph(raw);
  },
  async getOpAMPAgents(): Promise<OpAMPAgent[]> {
    const raw = await request<any[]>('/opamp/agents');
    return raw.map(mapAgent);
  },
  async getAgentDetail(uid: string): Promise<AgentDetail> {
    const raw = await request<any>(`/opamp/agents/${uid}`);
    return mapAgentDetail(raw);
  },
  async createCollectorGroup(input: Partial<CollectorGroup>): Promise<CollectorGroup> {
    const raw = await request<any>('/collector-groups', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        display_name: input.displayName,
        mode: input.mode,
        cluster: input.cluster,
        namespace: input.namespace,
        owner_team: input.ownerTeam,
        isolation_level: input.isolationLevel,
        receiver_profile: input.receiverProfile,
        exporter_profile: input.exporterProfile,
        desired_replicas: input.desiredReplicas,
        max_services: input.maxServices,
      }),
    });
    return mapCollectorGroup(raw);
  },
  async getCollectorGroups(params?: { cluster?: string; namespace?: string; mode?: string; status?: CollectorGroupStatus | 'deleted'; receiver_profile?: ReceiverProfile; q?: string }): Promise<CollectorGroup[]> {
    const search = new URLSearchParams();
    if (params?.cluster) search.set('cluster', params.cluster);
    if (params?.namespace) search.set('namespace', params.namespace);
    if (params?.mode) search.set('mode', params.mode);
    if (params?.status) search.set('status', params.status);
    if (params?.receiver_profile) search.set('receiver_profile', params.receiver_profile);
    if (params?.q) search.set('q', params.q);
    const qs = search.toString();
    const raw = await request<any[]>(`/collector-groups${qs ? `?${qs}` : ''}`);
    return raw.map(mapCollectorGroup);
  },
  async getCollectorGroup(id: string): Promise<CollectorGroup> {
    const raw = await request<any>(`/collector-groups/${id}`);
    return mapCollectorGroup(raw);
  },
  async updateCollectorGroup(id: string, patch: Partial<CollectorGroup>): Promise<CollectorGroup> {
    const raw = await request<any>(`/collector-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: patch.name,
        display_name: patch.displayName,
        description: patch.description,
        mode: patch.mode,
        cluster: patch.cluster,
        namespace: patch.namespace,
        owner_team: patch.ownerTeam,
        isolation_level: patch.isolationLevel,
        receiver_profile: patch.receiverProfile,
        exporter_profile: patch.exporterProfile,
        desired_replicas: patch.desiredReplicas,
        max_services: patch.maxServices,
        status: patch.status,
      }),
    });
    return mapCollectorGroup(raw);
  },
  async activateCollectorGroup(id: string): Promise<CollectorGroup> {
    const raw = await request<any>(`/collector-groups/${id}/activate`, { method: 'POST' });
    return mapCollectorGroup(raw);
  },
  async getCollectorInstances(groupId: string): Promise<CollectorInstance[]> {
    const raw = await request<any[]>(`/collector-groups/${groupId}/instances`);
    return raw.map(mapCollectorInstance);
  },
  async getCollectorGroupConfigVersions(groupId: string): Promise<CollectorConfigVersion[]> {
    const raw = await request<any[]>(`/collector-groups/${groupId}/config-versions`);
    return raw.map(mapCollectorConfigVersion);
  },
  async getCollectorGroupConfigSources(groupId: string): Promise<CollectorConfigSources> {
    const raw = await request<any>(`/collector-groups/${groupId}/config/sources`);
    return mapCollectorConfigSources(raw);
  },
  async saveCollectorGroupOverride(groupId: string, overrideYaml: string): Promise<CollectorGroupOverride> {
    const raw = await request<any>(`/collector-groups/${groupId}/config/override`, {
      method: 'PUT',
      body: JSON.stringify({ override_yaml: overrideYaml }),
    });
    return mapCollectorGroupOverride(raw);
  },
  async validateCollectorGroupConfig(groupId: string): Promise<CollectorConfigValidation> {
    const raw = await request<any>(`/collector-groups/${groupId}/config/validate`, {
      method: 'POST',
    });
    return mapCollectorConfigValidation(raw);
  },
  async publishCollectorGroupConfig(groupId: string): Promise<CollectorConfigVersion> {
    const raw = await request<any>(`/collector-groups/${groupId}/config/publish`, { method: 'POST' });
    return mapCollectorConfigVersion(raw);
  },
  async importCollectorPlatformTemplate(input: { name: string; description?: string; sourceAgentUid?: string; baseYaml?: string; collectorGroupId?: string }): Promise<CollectorPlatformTemplate> {
    const raw = await request<any>('/collector-platform-templates/import-from-agent', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        source_agent_uid: input.sourceAgentUid,
        base_yaml: input.baseYaml,
        collector_group_id: input.collectorGroupId,
      }),
    });
    return mapCollectorPlatformTemplate(raw);
  },
  async getCollectorPlatformTemplates(): Promise<CollectorPlatformTemplate[]> {
    const raw = await request<any[]>('/collector-platform-templates');
    return raw.map(mapCollectorPlatformTemplate);
  },
  async updateCollectorPlatformTemplate(id: string, input: Partial<CollectorPlatformTemplate>): Promise<CollectorPlatformTemplate> {
    const raw = await request<any>(`/collector-platform-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        base_yaml: input.baseYaml,
      }),
    });
    return mapCollectorPlatformTemplate(raw);
  },
  async getCollectorGroupConfigStatus(groupId: string): Promise<CollectorGroupConfigStatus> {
    const raw = await request<any>(`/collector-groups/${groupId}/config/status`);
    return mapCollectorGroupConfigStatus(raw);
  },
  async assignInstanceGroup(instanceUid: string, groupId: string): Promise<CollectorInstance> {
    const raw = await request<any>(`/opamp/instances/${instanceUid}/group`, {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId }),
    });
    return mapCollectorInstance(raw);
  },
  async unassignInstanceGroup(instanceUid: string): Promise<void> {
    await request<any>(`/opamp/instances/${instanceUid}/group`, { method: 'DELETE' });
  },
  async deleteCollectorInstance(instanceUid: string): Promise<void> {
    await request<any>(`/opamp/instances/${instanceUid}`, { method: 'DELETE' });
  },
  async deleteCollectorGroup(id: string): Promise<void> {
    await request<any>(`/collector-groups/${id}`, { method: 'DELETE' });
  },
  async getServiceOnboarding(productId: string, serviceId: string): Promise<OnboardingWorkspace> {
    const raw = await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/onboarding`);
    return mapWorkspace(raw);
  },
  async upsertServiceOnboarding(productId: string, serviceId: string, payload: Partial<ServiceOnboarding> & {
    k8sNamespace?: string;
    k8sWorkload?: string;
  }): Promise<OnboardingWorkspace> {
    const raw = await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/onboarding`, {
      method: 'POST',
      body: JSON.stringify({
        mode: payload.mode,
        collector_group_id: optionalString(payload.collectorGroupId),
        k8s_namespace: payload.k8sNamespace,
        k8s_workload: payload.k8sWorkload,
      }),
    });
    return mapWorkspace(raw);
  },
  async checkServiceOnboarding(productId: string, serviceId: string): Promise<OnboardingWorkspace> {
    const raw = await request<any>(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/onboarding/check`, { method: 'POST' });
    return mapWorkspace(raw);
  },
  async getAlertRules(params?: { signalType?: AlertSignalType }): Promise<AlertRule[]> {
    const search = new URLSearchParams();
    if (params?.signalType) search.set('signal_type', params.signalType);
    const raw = await request<any[]>(`/alerts/rules${search.size ? `?${search}` : ''}`);
    return Array.isArray(raw) ? raw.map(mapAlertRule) : [];
  },
  async getAlertRule(id: string): Promise<AlertRule> {
    return mapAlertRule(await request<any>(`/alerts/rules/${id}`));
  },
  async testAlertRule(spec: AlertRuleSpec, rangeMinutes = 5): Promise<AlertRuleTestResult> {
    const rangeEnd = new Date();
    const rangeStart = new Date(rangeEnd.getTime() - rangeMinutes * 60_000);
    const raw = await request<any>('/alerts/rules/test', {
      method: 'POST',
      body: JSON.stringify({ spec: alertRuleSpecBody(spec), range_start: rangeStart.toISOString(), range_end: rangeEnd.toISOString() }),
    });
    return {
      inputHash: raw.input_hash ?? '',
      testToken: raw.test_token ?? '',
      testedAt: raw.tested_at ?? '',
      compiledQuery: raw.compiled_query ?? '',
      matchedLogCount: Number(raw.matched_log_count ?? 0),
      estimatedInstanceCount: Number(raw.estimated_instance_count ?? 0),
      queryDurationMillis: Number(raw.query_duration_ms ?? 0),
      partialResponse: Boolean(raw.partial_response),
      topGroups: Array.isArray(raw.top_groups) ? raw.top_groups : [],
      warnings: parseStringList(raw.warnings),
    };
  },
  async createAlertRule(spec: AlertRuleSpec, testToken: string): Promise<AlertRule> {
    const raw = await request<any>('/alerts/rules', {
      method: 'POST',
      body: JSON.stringify({ spec: alertRuleSpecBody(spec), test_token: testToken, change_summary: spec.signalType === 'metrics' ? '创建并启用指标告警' : '创建并启用日志告警' }),
    });
    return mapAlertRule(raw.rule);
  },
  async updateAlertRule(id: string, spec: AlertRuleSpec, testToken: string): Promise<AlertRule> {
    const raw = await request<any>(`/alerts/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ spec: alertRuleSpecBody(spec), test_token: testToken, change_summary: spec.signalType === 'metrics' ? '更新指标告警' : '更新日志告警' }),
    });
    return mapAlertRule(raw.rule);
  },
  async disableAlertRule(id: string, signalType: AlertSignalType = 'logs'): Promise<AlertRule> {
    const changeSummary = signalType === 'metrics' ? '停用指标告警' : '停用日志告警';
    const raw = await request<any>(`/alerts/rules/${id}/disable`, { method: 'POST', body: JSON.stringify({ expected_signal_type: signalType, change_summary: changeSummary }) });
    return mapAlertRule(raw.rule);
  },
  async getAlertRuleUpdates(id: string): Promise<AlertRuleUpdateRecord[]> {
    const raw = await request<any[]>(`/alerts/rules/${id}/updates`);
    return Array.isArray(raw) ? raw.map((item) => ({
      id: item.id ?? '', ruleId: item.rule_id ?? '', action: item.action ?? 'update',
      changeSummary: item.change_summary ?? '', createdAt: item.created_at ?? '',
      actor: { id: item.actor?.id ?? '', name: item.actor?.name ?? '' },
    })) : [];
  },
  async rollbackAlertRule(id: string, updateId: string): Promise<AlertRule> {
    const raw = await request<any>(`/alerts/rules/${id}/rollback`, {
      method: 'POST', body: JSON.stringify({ update_id: updateId, change_summary: '从更新记录回退' }),
    });
    return mapAlertRule(raw.rule);
  },
  async getNotificationPolicies(serviceId?: string): Promise<NotificationPolicy[]> {
    const search = new URLSearchParams();
    if (serviceId) search.set('service_id', serviceId);
    const raw = await request<any[]>(`/alerts/notification-policies${search.size ? `?${search}` : ''}`);
    return Array.isArray(raw) ? raw.map(mapNotificationPolicy) : [];
  },
  async createNotificationPolicy(input: {
    name: string; receiver: string; serviceId?: string; description?: string;
  }): Promise<NotificationPolicy> {
    const raw = await request<any>('/alerts/notification-policies', {
      method: 'POST', body: JSON.stringify({
        name: input.name, description: input.description ?? '', service_id: input.serviceId ?? '',
        receiver: input.receiver, enabled: true,
      }),
    });
    return mapNotificationPolicy(raw);
  },
  async setNotificationPolicyEnabled(policy: NotificationPolicy, enabled: boolean): Promise<NotificationPolicy> {
    const raw = await request<any>(`/alerts/notification-policies/${policy.id}`, {
      method: 'PUT', body: JSON.stringify({
        name: policy.name, description: policy.description, service_id: policy.serviceId,
        receiver: policy.receiver, enabled,
      }),
    });
    return mapNotificationPolicy(raw);
  },
  async getAlertInstances(params?: { ruleId?: string; state?: string }): Promise<AlertInstance[]> {
    const search = new URLSearchParams();
    if (params?.ruleId) search.set('rule_id', params.ruleId);
    if (params?.state) search.set('state', params.state);
    const raw = await request<any[]>(`/alerts/instances${search.size ? `?${search}` : ''}`);
    return Array.isArray(raw) ? raw.map((item) => ({
      fingerprint: item.fingerprint ?? '', ruleId: item.rule_id ?? '', serviceId: item.service_id ?? '',
      state: item.state ?? 'resolved', labels: item.labels ?? {}, annotations: item.annotations ?? {},
      startsAt: item.starts_at ?? '', endsAt: item.ends_at ?? '', lastReceivedAt: item.last_received_at ?? '',
      lastEventId: item.last_event_id ?? '',
    })) : [];
  },
  async getAlertEvents(ruleId: string, fingerprint?: string): Promise<AlertEvent[]> {
    const search = new URLSearchParams({ rule_id: ruleId });
    if (fingerprint) search.set('fingerprint', fingerprint);
    const raw = await request<any[]>(`/alerts/events?${search}`);
    return Array.isArray(raw) ? raw.map((item) => ({
      id: item.id ?? '', fingerprint: item.fingerprint ?? '', ruleId: item.rule_id ?? '',
      previousState: item.previous_state ?? '', state: item.state ?? 'resolved', labels: item.labels ?? {},
      annotations: item.annotations ?? {}, occurredAt: item.occurred_at ?? '', receivedAt: item.received_at ?? '',
    })) : [];
  },
  async getK8sDashboard(clusterId = 'prod'): Promise<K8sDashboardSnapshot> {
    const raw = await request<any>(`/k8sops/dashboard?cluster_id=${encodeURIComponent(clusterId)}`);
    return mapK8sDashboardSnapshot(raw);
  },
};
