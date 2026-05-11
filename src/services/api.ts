import type {
  AgentDetail,
  AlertRule,
  CheckResult,
  ChecklistItem,
  CollectorConfigSources,
  CollectorConfigValidation,
  CollectorGroupConfigStatus,
  CollectorConfigVersion,
  CollectorAdditionalConfig,
  CollectorGroup,
  CollectorGroupStatus,
  CollectorGroupOverride,
  CollectorInstance,
  CollectorPlatformTemplate,
  CollectorTarget,
  CreateServiceInput,
  GeneratedConfig,
  IdentitySummary,
  LogEntry,
  OnboardingWorkspace,
  OpAMPAgent,
  ParserPreviewResult,
  OverviewSummary,
  ReceiverProfile,
  Service,
  ServiceEnrichmentPatch,
  ServiceOnboarding,
  ServiceParserRule,
  ServicePipelinePatch,
  ServiceSummary,
  UpdateServiceInput,
} from './types';

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { message?: string } | null;
}

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
    throw new Error(body.error?.message ?? `请求失败: ${response.status}`);
  }
  return body.data;
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
    healthyPipelineCount: raw.healthy_pipeline_count ?? raw.healthyPipelineCount ?? 0,
    activeAlertCount: raw.active_alert_count ?? raw.activeAlertCount ?? raw.alerts ?? 0,
  };
}

function mapService(raw: any): Service {
  return {
    id: String(raw.id),
    cmdbServiceId: raw.cmdb_service_id ?? raw.cmdbServiceId ?? '',
    businessId: raw.business_id ?? raw.businessId ?? '',
    applicationId: raw.application_id ?? raw.applicationId ?? '',
    name: raw.name,
    displayName: raw.display_name ?? raw.displayName ?? '',
    description: raw.description ?? '',
    environment: raw.environment ?? '',
    cluster: raw.cluster ?? '',
    namespace: raw.namespace ?? '',
    ownerTeam: raw.owner_team ?? raw.ownerTeam ?? '',
    owner: raw.owner ?? '',
    alertRoute: raw.alert_route ?? raw.alertRoute ?? '',
    sloLevel: raw.slo_level ?? raw.sloLevel ?? '',
    identityType: raw.identity_type ?? raw.identityType ?? 'k8s_workload',
    source: raw.source ?? 'manual',
    syncStatus: raw.sync_status ?? 'local',
    lastSyncedAt: raw.last_synced_at ?? undefined,
    status: raw.status ?? 'pending',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapLogEntry(raw: any): LogEntry {
  return {
    timestamp: raw.timestamp ?? '',
    level: raw.level ?? 'info',
    message: raw.message ?? '',
    tenant: raw.tenant ?? '',
    service: raw.service ?? '',
    environment: raw.environment ?? '',
    cluster: raw.cluster ?? '',
    namespace: raw.namespace ?? '',
    pod: raw.pod ?? '',
    container: raw.container ?? '',
    traceId: raw.trace_id ?? raw.traceId ?? '',
    spanId: raw.span_id ?? raw.spanId ?? '',
    requestId: raw.request_id ?? raw.requestId ?? '',
    errorCode: raw.error_code ?? raw.errorCode ?? undefined,
    pipelineId: String(raw.pipeline_id ?? raw.pipelineId ?? ''),
    pipelineVersion: raw.pipeline_version ?? raw.pipelineVersion ?? 0,
    parseStatus: raw.parse_status ?? raw.parseStatus ?? 'raw',
    cmdbMatchStatus: raw.cmdb_match_status ?? raw.cmdbMatchStatus ?? 'unmatched',
    labels: raw.labels ?? {},
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
    services: Array.isArray(raw.services) ? raw.services.map(mapService) : [],
    onboardings: Array.isArray(raw.onboardings) ? raw.onboardings.map(mapOnboarding) : [],
    configuration: {
      effectiveConfig: raw.configuration?.effective_config ?? '',
      effectiveConfigFiles: raw.configuration?.effective_config_files ?? {},
      effectiveConfigHash: raw.configuration?.effective_config_hash ?? '',
      lastRemoteConfig: raw.configuration?.last_remote_config ?? '',
      lastRemoteConfigFiles: raw.configuration?.last_remote_config_files ?? {},
      lastRemoteConfigHash: raw.configuration?.last_remote_config_hash ?? '',
      expectedRenderedConfig: raw.configuration?.expected_rendered_config ?? '',
      expectedConfigHash: raw.configuration?.expected_config_hash ?? '',
      inSync: raw.configuration?.in_sync ?? false,
      applyStatus: raw.configuration?.apply_status ?? '',
      configSources: raw.configuration?.config_sources ? mapCollectorConfigSources(raw.configuration.config_sources) : null,
      additionalConfig: raw.configuration?.additional_config?.target_id ? mapCollectorAdditionalConfig(raw.configuration.additional_config) : null,
    },
  };
}

function mapCollectorAdditionalConfig(raw: any): CollectorAdditionalConfig {
  return {
    id: String(raw.id ?? ''),
    scope: raw.scope ?? '',
    targetId: String(raw.target_id ?? ''),
    collectorGroupId: String(raw.collector_group_id ?? ''),
    configMapKey: raw.config_map_key ?? '',
    yamlPatch: raw.yaml_patch ?? '',
    configHash: raw.config_hash ?? '',
    lastRemoteConfigHash: raw.last_remote_config_hash ?? '',
    status: raw.status ?? '',
    version: raw.version ?? 0,
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
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
    environment: raw.environment ?? '',
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
    environment: raw.environment ?? '',
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
    environment: raw.environment ?? '',
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
    environment: raw.environment ?? '',
    cluster: raw.cluster ?? '',
    namespace: raw.namespace ?? '',
    tenantId: raw.tenant_id ?? '',
    ownerTeam: raw.owner_team ?? '',
    isolationLevel: raw.isolation_level ?? 'shared',
    platformTemplateId: raw.platform_template_id ?? '',
    receiverProfile: raw.receiver_profile ?? 'mixed',
    exporterProfile: raw.exporter_profile ?? 'otlphttp/victorialogs',
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
    collectorGroupId: String(raw.collector_group_id ?? ''),
    hostname: raw.hostname ?? '',
    podName: raw.pod_name ?? raw.podName ?? '',
    nodeName: raw.node_name ?? raw.nodeName ?? '',
    ip: raw.ip ?? '',
    version: raw.version ?? '',
    capabilities: raw.capabilities ?? 0,
    online: raw.online ?? false,
    healthy: raw.healthy ?? false,
    remoteConfigCapable: raw.remote_config_capable ?? false,
    effectiveConfigHash: raw.effective_config_hash ?? '',
    lastConfigHash: raw.last_config_hash ?? raw.lastConfigHash ?? '',
    remoteConfigStatus: raw.remote_config_status ?? 'unset',
    runtimeStatus: backendStatus || local.runtimeStatus,
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

function mapServiceParserRule(raw: any): ServiceParserRule {
  return {
    id: String(raw.id ?? ''),
    serviceId: String(raw.service_id ?? ''),
    collectorGroupId: String(raw.collector_group_id ?? ''),
    parseMode: raw.parse_mode ?? 'none',
    parseFrom: raw.parse_from ?? 'body',
    regexPattern: raw.regex_pattern ?? '',
    jsonMappings: raw.json_mappings ?? {},
    attributeMappings: raw.attribute_mappings ?? raw.json_mappings ?? {},
    resourceMappings: raw.resource_mappings ?? {},
    ottlStatements: Array.isArray(raw.ottl_statements) ? raw.ottl_statements.map(String) : [],
    sampleLog: raw.sample_log ?? '',
    enabled: raw.enabled ?? false,
    status: raw.status ?? '',
    version: raw.version ?? 0,
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
  };
}

function mapParserPreviewResult(raw: any): ParserPreviewResult {
  return {
    valid: raw.valid ?? false,
    parseMode: raw.parse_mode ?? '',
    sampleLog: raw.sample_log ?? '',
    parsedFields: raw.parsed_fields ?? {},
    mappedAttributes: raw.mapped_attributes ?? {},
    mappedResources: raw.mapped_resources ?? {},
    unmappedFields: Array.isArray(raw.unmapped_fields) ? raw.unmapped_fields.map(String) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    errors: Array.isArray(raw.errors) ? raw.errors.map(String) : [],
  };
}

function mapAlertRule(raw: any): AlertRule {
  return {
    id: String(raw.id),
    name: raw.name,
    source: raw.source ?? 'logs',
    ruleType: raw.rule_type ?? raw.ruleType ?? 'count',
    query: raw.query ?? '',
    window: raw.window ?? '',
    evalInterval: raw.eval_interval ?? raw.evalInterval ?? '',
    lookbackDelay: raw.lookback_delay ?? raw.lookbackDelay ?? '',
    condition: raw.condition ?? '',
    groupBy: parseStringList(raw.group_by ?? raw.groupBy),
    severity: raw.severity ?? 'medium',
    ownerTeam: raw.owner_team ?? raw.ownerTeam ?? '',
    alertRoute: raw.alert_route ?? raw.alertRoute ?? '',
    status: raw.status ?? 'draft',
  };
}

export const api = {
  async getOverview(): Promise<OverviewSummary> {
    const raw = await request<any>('/overview');
    return mapOverview(raw);
  },
  async getServices(params?: { q?: string; environment?: string; status?: string; source?: string }): Promise<Service[]> {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.environment) search.set('environment', params.environment);
    if (params?.status) search.set('status', params.status);
    if (params?.source) search.set('source', params.source);
    const qs = search.toString();
    const raw = await request<any[]>(`/services${qs ? `?${qs}` : ''}`);
    return raw.map(mapService);
  },
  async createService(input: CreateServiceInput): Promise<Service> {
    const raw = await request<any>('/services', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        environment: input.environment,
        display_name: input.displayName,
        cluster: input.cluster,
        namespace: input.namespace,
        owner_team: input.ownerTeam,
        owner: input.owner,
        alert_route: input.alertRoute,
        slo_level: input.sloLevel,
        identity_type: input.identityType,
      }),
    });
    return mapService(raw);
  },
  async updateService(id: string, patch: UpdateServiceInput): Promise<Service> {
    const raw = await request<any>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        cmdb_service_id: optionalString(patch.cmdbServiceId),
        business_id: optionalString(patch.businessId),
        application_id: optionalString(patch.applicationId),
        name: patch.name,
        display_name: patch.displayName,
        description: patch.description,
        environment: patch.environment,
        cluster: patch.cluster,
        namespace: patch.namespace,
        owner_team: patch.ownerTeam,
        owner: patch.owner,
        alert_route: patch.alertRoute,
        slo_level: patch.sloLevel,
        identity_type: patch.identityType,
        status: patch.status,
      }),
    });
    return mapService(raw);
  },
  async getLogs(): Promise<LogEntry[]> {
    const raw = await request<any[] | { items?: any[] }>('/logs');
    const items = Array.isArray(raw) ? raw : raw.items ?? [];
    return items.map(mapLogEntry);
  },
  async getOpAMPAgents(): Promise<OpAMPAgent[]> {
    const raw = await request<any[]>('/opamp/agents');
    return raw.map(mapAgent);
  },
  async getAgentDetail(uid: string): Promise<AgentDetail> {
    const raw = await request<any>(`/opamp/agents/${uid}`);
    return mapAgentDetail(raw);
  },
  async saveAgentAdditionalConfig(uid: string, yamlPatch: string, send: boolean): Promise<CollectorAdditionalConfig> {
    const raw = await request<any>(`/opamp/agents/${uid}/additional-config`, {
      method: 'PUT',
      body: JSON.stringify({ yaml_patch: yamlPatch, send }),
    });
    return mapCollectorAdditionalConfig(raw);
  },
  async createCollectorGroup(input: Partial<CollectorGroup>): Promise<CollectorGroup> {
    const raw = await request<any>('/collector-groups', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        display_name: input.displayName,
        mode: input.mode,
        environment: input.environment,
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
  async getCollectorGroups(params?: { environment?: string; cluster?: string; namespace?: string; mode?: string; status?: CollectorGroupStatus | 'deleted'; receiver_profile?: ReceiverProfile; q?: string }): Promise<CollectorGroup[]> {
    const search = new URLSearchParams();
    if (params?.environment) search.set('environment', params.environment);
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
        environment: patch.environment,
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
  async getServiceEnrichmentPatch(serviceId: string): Promise<ServiceEnrichmentPatch> {
    const raw = await request<any>(`/services/${serviceId}/enrichment-patch`);
    return mapServiceEnrichmentPatch(raw);
  },
  async regenerateServiceEnrichmentPatch(serviceId: string, collectorGroupId?: string): Promise<ServiceEnrichmentPatch> {
    const raw = await request<any>(`/services/${serviceId}/enrichment-patch/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ collector_group_id: optionalString(collectorGroupId) }),
    });
    return mapServiceEnrichmentPatch(raw);
  },
  async getServiceParserRule(serviceId: string): Promise<ServiceParserRule> {
    const raw = await request<any>(`/services/${serviceId}/parser-rule`);
    return mapServiceParserRule(raw);
  },
  async saveServiceParserRule(serviceId: string, input: Partial<ServiceParserRule>): Promise<ServiceParserRule> {
    const raw = await request<any>(`/services/${serviceId}/parser-rule`, {
      method: 'PUT',
      body: JSON.stringify({
        collector_group_id: input.collectorGroupId,
        parse_mode: input.parseMode ?? 'none',
        parse_from: input.parseFrom ?? 'body',
        regex_pattern: input.regexPattern,
        json_mappings: input.jsonMappings ?? {},
        attribute_mappings: input.attributeMappings ?? input.jsonMappings ?? {},
        resource_mappings: input.resourceMappings ?? {},
        ottl_statements: input.ottlStatements ?? [],
        sample_log: input.sampleLog,
        enabled: input.enabled ?? false,
      }),
    });
    return mapServiceParserRule(raw);
  },
  async previewServiceParserRule(serviceId: string, input: Partial<ServiceParserRule>): Promise<ParserPreviewResult> {
    const raw = await request<any>(`/services/${serviceId}/parser-rule/preview`, {
      method: 'POST',
      body: JSON.stringify({
        parse_mode: input.parseMode ?? 'none',
        parse_from: input.parseFrom ?? 'body',
        regex_pattern: input.regexPattern,
        json_mappings: input.jsonMappings ?? {},
        attribute_mappings: input.attributeMappings ?? input.jsonMappings ?? {},
        resource_mappings: input.resourceMappings ?? {},
        ottl_statements: input.ottlStatements ?? [],
        sample_log: input.sampleLog,
      }),
    });
    return mapParserPreviewResult(raw);
  },
  async generateServicePipelinePatch(serviceId: string): Promise<ServicePipelinePatch> {
    const raw = await request<any>(`/services/${serviceId}/parser-rule/generate-patch`, { method: 'POST' });
    return mapServicePipelinePatch(raw);
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
  async getServiceOnboarding(serviceId: string): Promise<OnboardingWorkspace> {
    const raw = await request<any>(`/services/${serviceId}/onboarding`);
    return mapWorkspace(raw);
  },
  async upsertServiceOnboarding(serviceId: string, payload: Partial<ServiceOnboarding> & {
    k8sNamespace?: string;
    k8sWorkload?: string;
  }): Promise<OnboardingWorkspace> {
    const raw = await request<any>(`/services/${serviceId}/onboarding`, {
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
  async checkServiceOnboarding(serviceId: string): Promise<OnboardingWorkspace> {
    const raw = await request<any>(`/services/${serviceId}/onboarding/check`, { method: 'POST' });
    return mapWorkspace(raw);
  },
  async getAlertRules(): Promise<AlertRule[]> {
    const raw = await request<any[]>('/alert-rules');
    return raw.map(mapAlertRule);
  },
};
