import { ApiRequestError, apiRequest } from '../../services/api';

export interface K8sCluster {
  id: string;
  name: string;
  version: string;
  region: string;
  description: string;
  status: string;
  accessMode: string;
  readOnly: boolean;
  lastProbe?: K8sClusterProbe;
}

export interface K8sClusterInput {
  id: string;
  name: string;
  version: string;
  region: string;
  description: string;
  accessMode?: string;
  readOnly?: boolean;
}

export interface K8sClusterRegistrationInput extends K8sClusterInput {
  kubeconfig: string;
  expiresAt?: string;
}

export interface K8sClusterRegistrationResult {
  cluster: K8sCluster;
  credentials: {
    controller: K8sClusterCredential;
    broker: K8sClusterCredential;
    auditId: string;
    probe?: K8sClusterProbe;
    probeStatePersisted?: boolean;
  };
}

export interface K8sClusterProbe {
  clusterId: string;
  status: string;
  accessMode: string;
  readOnly: boolean;
  serverVersion: string;
  resourceCount: number;
  warnings: string[];
  checkedAt: string;
  errorCode: string;
}

export interface K8sDeleteResult {
  deleted: boolean;
}

export interface K8sCredentialDeletionResult {
  clusterId: string;
  deletedControllerVersions: number;
  deletedBrokerVersions: number;
  accessInvalidated: boolean;
  auditId: string;
  clusterStatePersisted?: boolean;
}

export interface K8sCredentialRegistrationResult {
  controller: K8sClusterCredential;
  broker: K8sClusterCredential;
  auditId: string;
  probe?: K8sClusterProbe;
  probeStatePersisted?: boolean;
}

export interface K8sClusterCredential {
  secretId: string;
  clusterId: string;
  name: string;
  fingerprint: string;
  status: string;
  active: boolean;
  version: number;
  createdAt: string;
  rotatedAt: string;
  expiresAt: string;
  expired: boolean;
  expiresSoon: boolean;
}

export interface K8sNamespace {
  id: string;
  clusterId: string;
  name: string;
  status: string;
  owner: string;
  phase: string;
  updatedAt: string;
}

export interface K8sResourceIdentity {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
}

export interface K8sResourceSummary {
  identity: K8sResourceIdentity;
  status: string;
  labels: Record<string, string>;
  updatedAt: string;
}

export interface K8sResourceDetail {
  identity: K8sResourceIdentity;
  status: string;
  labels: Record<string, string>;
  spec: Record<string, any>;
  updatedAt: string;
}

export interface K8sResourceYAML {
  identity: K8sResourceIdentity;
  yaml: string;
}

export interface K8sPodLogs {
  identity: K8sResourceIdentity;
  container: string;
  lines: string[];
}

export interface K8sDeploymentHistory {
  id: string;
  clusterId: string;
  namespace: string;
  workload: string;
  action: string;
  status: string;
  revision: string;
  actor: string;
  startedAt: string;
  finishedAt: string;
}

export interface K8sAuditEvent {
  id: string;
  clusterId: string;
  namespace: string;
  resourceKind: string;
  resourceName: string;
  action: string;
  actor: string;
  status: string;
  traceId: string;
  createdAt: string;
}

export interface K8sWriteResult<T> {
  item?: T;
  items?: T[];
  status?: string;
  auditId: string;
  probe?: K8sClusterProbe;
  probeStatePersisted?: boolean;
}

export interface K8sTemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export interface K8sTemplate {
  id: string;
  name: string;
  type: string;
  yamlContent: string;
  variables: K8sTemplateVariable[];
  description: string;
  source: string;
  createdBy: string;
  updatedAt: string;
}

export interface K8sBaseTemplate {
  type: string;
  yamlContent: string;
  variables: K8sTemplateVariable[];
  description: string;
  source: string;
}

export interface K8sTemplateRender {
  renderedYAML: string;
  auditId: string;
}

export interface K8sDeploymentIdentity {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  uid?: string;
}

export interface K8sDeploymentDiff {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  operation: string;
  beforeHash: string;
  afterHash: string;
}

export interface K8sDeploymentOperationResult {
  status: string;
  message: string;
  auditId: string;
  previewId: string;
  confirmationToken: string;
  diffs: K8sDeploymentDiff[];
  warnings: string[];
  resources: K8sDeploymentIdentity[];
}

export interface K8sTerminalResult {
  status: string;
  clusterId: string;
  namespace: string;
  command: string;
  verb: string;
  args: string[];
  output: string;
  exitCode: number;
  auditId: string;
  blockedReason: string;
  mode: string;
  outputTruncated: boolean;
}

export interface K8sRuntimeGroupsResponse {
  clusterId: string;
  namespace: string;
  groups: K8sRuntimeGroup[];
  summary: K8sRuntimeGroupsSummary;
}

export interface K8sRuntimeGroupsSummary {
  groupCount: number;
  serviceCount: number;
  workloadCount: number;
  podCount: number;
  pvcCount: number;
  virtualServiceCount: number;
  gatewayCount: number;
  destinationRuleCount: number;
  securityPolicyCount: number;
}

export interface K8sRuntimeGroup {
  key: string;
  displayName: string;
  isVirtual: boolean;
  exposures: K8sRuntimeExposureNode[];
  services: K8sRuntimeServiceNode[];
  workloads: K8sRuntimeWorkloadNode[];
  summary: K8sRuntimeGroupSummary;
}

export interface K8sRuntimeGroupSummary {
  servicesTotal: number;
  workloadsTotal: number;
  podsTotal: number;
  runningPods: number;
  pendingPods: number;
  failedPods: number;
  restartCount: number;
  persistentVolumeClaimsTotal: number;
  virtualServicesTotal: number;
  gatewaysTotal: number;
  destinationRulesTotal: number;
  securityPoliciesTotal: number;
}

export interface K8sRuntimeExposureNode {
  key: string;
  name: string;
  kind: string;
  hosts: string[];
  gateways: string[];
  serviceRefs: string[];
  routeTargets: K8sRuntimeRouteTarget[];
  routeRules: K8sRuntimeVirtualServiceRouteNode[];
}

export interface K8sRuntimeServiceNode {
  name: string;
  serviceType: string;
  clusterIP: string;
  selectors: Record<string, string>;
  ports: K8sRuntimeServicePort[];
  hosts: string[];
  virtualServices: string[];
  virtualServiceDetails: K8sRuntimeVirtualServiceNode[];
  gateways: string[];
  destinationRules: string[];
  destinationRuleDetails: K8sRuntimeDestinationRuleNode[];
}

export interface K8sRuntimeRouteTarget {
  host: string;
  subset: string;
  port: string;
  weight?: number;
}

export interface K8sRuntimeStringMatchNode {
  matchType: string;
  value: string;
}

export interface K8sRuntimeHeaderMatchNode {
  name: string;
  matcher: K8sRuntimeStringMatchNode;
}

export interface K8sRuntimeVirtualServiceMatchNode {
  summary: string;
  uri?: K8sRuntimeStringMatchNode;
  scheme?: K8sRuntimeStringMatchNode;
  method?: K8sRuntimeStringMatchNode;
  authority?: K8sRuntimeStringMatchNode;
  headers: K8sRuntimeHeaderMatchNode[];
  gateways: string[];
  sourceLabels: string[];
  sourceNamespace?: string;
  sourceSubnets: string[];
  port?: string;
  sniHosts: string[];
}

export interface K8sRuntimeVirtualServiceRouteNode {
  name: string;
  protocol: string;
  rewriteURI: string;
  matches: K8sRuntimeVirtualServiceMatchNode[];
  targets: K8sRuntimeRouteTarget[];
}

export interface K8sRuntimeVirtualServiceNode {
  name: string;
  hosts: string[];
  gateways: string[];
  routeTargets: K8sRuntimeRouteTarget[];
  routes: K8sRuntimeVirtualServiceRouteNode[];
}

export interface K8sRuntimeServicePort {
  name: string;
  port: number;
  targetPort: string;
  protocol: string;
  nodePort?: number;
}

export interface K8sRuntimeDestinationRuleSubsetNode {
  name: string;
  labels: Record<string, string>;
}

export interface K8sRuntimeDestinationRuleNode {
  name: string;
  host: string;
  subsets: string[];
  subsetDetails: K8sRuntimeDestinationRuleSubsetNode[];
  hasTrafficPolicy: boolean;
  exportTo: string[];
}

export interface K8sRuntimeWorkloadNode {
  key: string;
  name: string;
  kind: string;
  selector: Record<string, string>;
  templateLabels: Record<string, string>;
  serviceAccounts: string[];
  configMaps: string[];
  persistentVolumeClaims: string[];
  hpas: Array<{ name: string }>;
  securityPolicies: Array<{ name: string; kind: string; summary: string }>;
  podsSummary: {
    total: number;
    running: number;
    pending: number;
    failed: number;
    succeeded: number;
    readyContainers: number;
    totalContainers: number;
    restartCount: number;
  };
}

function mapCluster(raw: any): K8sCluster {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    version: raw.version ?? '',
    region: raw.region ?? '',
    description: raw.description ?? '',
    status: raw.status ?? 'unknown',
    accessMode: raw.access_mode ?? raw.accessMode ?? 'direct',
    readOnly: Boolean(raw.read_only ?? raw.readOnly ?? true),
    lastProbe: raw.last_probe || raw.lastProbe ? mapClusterProbe(raw.last_probe ?? raw.lastProbe) : undefined,
  };
}

function mapClusterProbe(raw: any): K8sClusterProbe {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    status: raw.status ?? 'unknown',
    accessMode: raw.access_mode ?? raw.accessMode ?? 'direct',
    readOnly: Boolean(raw.read_only ?? raw.readOnly ?? true),
    serverVersion: raw.server_version ?? raw.serverVersion ?? '',
    resourceCount: Number(raw.resource_count ?? raw.resourceCount ?? 0),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    checkedAt: raw.checked_at ?? raw.checkedAt ?? '',
    errorCode: raw.error_code ?? raw.errorCode ?? '',
  };
}

function mapClusterCredential(raw: any): K8sClusterCredential {
  return {
    secretId: raw.secret_id ?? raw.secretId ?? '',
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    name: raw.name ?? '',
    fingerprint: raw.fingerprint ?? '',
    status: raw.status ?? 'unknown',
    active: Boolean(raw.active),
    version: Number(raw.version ?? 0),
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    rotatedAt: raw.rotated_at ?? raw.rotatedAt ?? '',
    expiresAt: raw.expires_at ?? raw.expiresAt ?? '',
    expired: Boolean(raw.expired),
    expiresSoon: Boolean(raw.expires_soon ?? raw.expiresSoon),
  };
}

function mapNamespace(raw: any): K8sNamespace {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    name: raw.name ?? '',
    status: raw.status ?? 'unknown',
    owner: raw.owner ?? '',
    phase: raw.phase ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapResourceIdentity(raw: any): K8sResourceIdentity {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    apiVersion: raw.api_version ?? raw.apiVersion ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? '',
  };
}

function mapResource(raw: any): K8sResourceSummary {
  return {
    identity: mapResourceIdentity(raw.identity ?? {}),
    status: raw.status ?? 'unknown',
    labels: raw.labels ?? {},
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapResourceDetail(raw: any): K8sResourceDetail {
  return {
    identity: mapResourceIdentity(raw.identity ?? {}),
    status: raw.status ?? 'unknown',
    labels: raw.labels ?? {},
    spec: raw.spec ?? {},
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapResourceYAML(raw: any): K8sResourceYAML {
  return {
    identity: mapResourceIdentity(raw.identity ?? {}),
    yaml: raw.yaml ?? '',
  };
}

function mapPodLogs(raw: any): K8sPodLogs {
  return {
    identity: mapResourceIdentity(raw.identity ?? {}),
    container: raw.container ?? '',
    lines: Array.isArray(raw.lines) ? raw.lines.map(String) : [],
  };
}

function resourceIdentityParams(identity: K8sResourceIdentity): URLSearchParams {
  const params = new URLSearchParams();
  params.set('cluster_id', identity.clusterId);
  params.set('namespace', identity.namespace);
  params.set('api_version', identity.apiVersion);
  params.set('kind', identity.kind);
  params.set('name', identity.name);
  params.set('uid', identity.uid);
  return params;
}

function mapDeploymentHistory(raw: any): K8sDeploymentHistory {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    workload: raw.workload ?? '',
    action: raw.action ?? '',
    status: raw.status ?? 'unknown',
    revision: raw.revision ?? '',
    actor: raw.actor ?? '',
    startedAt: raw.started_at ?? raw.startedAt ?? '',
    finishedAt: raw.finished_at ?? raw.finishedAt ?? '',
  };
}

function mapAuditEvent(raw: any): K8sAuditEvent {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    resourceKind: raw.resource_kind ?? raw.resourceKind ?? '',
    resourceName: raw.resource_name ?? raw.resourceName ?? '',
    action: raw.action ?? '',
    actor: raw.actor ?? '',
    status: raw.status ?? 'unknown',
    traceId: raw.trace_id ?? raw.traceId ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
  };
}

function mapWriteResult<T>(raw: any, mapItem?: (value: any) => T): K8sWriteResult<T> {
  return {
    item: raw.item && mapItem ? mapItem(raw.item) : undefined,
    items: Array.isArray(raw.items) && mapItem ? raw.items.map(mapItem) : undefined,
    status: raw.status ?? undefined,
    auditId: raw.audit_id ?? raw.auditId ?? '',
    probe: raw.probe ? mapClusterProbe(raw.probe) : undefined,
    probeStatePersisted: typeof (raw.probe_state_persisted ?? raw.probeStatePersisted) === 'boolean'
      ? Boolean(raw.probe_state_persisted ?? raw.probeStatePersisted)
      : undefined,
  };
}

function mapTemplateVariable(raw: any): K8sTemplateVariable {
  return {
    name: raw.name ?? '',
    description: raw.description ?? '',
    defaultValue: raw.default_value ?? raw.defaultValue ?? undefined,
    required: Boolean(raw.required),
  };
}

function mapTemplate(raw: any): K8sTemplate {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    type: raw.type ?? '',
    yamlContent: raw.yaml_content ?? raw.yamlContent ?? '',
    variables: Array.isArray(raw.variables) ? raw.variables.map(mapTemplateVariable) : [],
    description: raw.description ?? '',
    source: raw.source ?? '',
    createdBy: raw.created_by ?? raw.createdBy ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapBaseTemplate(raw: any): K8sBaseTemplate {
  return {
    type: raw.type ?? '',
    yamlContent: raw.yaml_content ?? raw.yamlContent ?? '',
    variables: Array.isArray(raw.variables) ? raw.variables.map(mapTemplateVariable) : [],
    description: raw.description ?? '',
    source: raw.source ?? '',
  };
}

function mapTemplateRender(raw: any): K8sTemplateRender {
  return {
    renderedYAML: raw.rendered_yaml ?? raw.renderedYAML ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
  };
}

function mapDeploymentIdentity(raw: any): K8sDeploymentIdentity {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    apiVersion: raw.api_version ?? raw.apiVersion ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? undefined,
  };
}

function mapDeploymentDiff(raw: any): K8sDeploymentDiff {
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

function mapDeploymentOperationResult(raw: any): K8sDeploymentOperationResult {
  return {
    status: raw.status ?? '',
    message: raw.message ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
    previewId: raw.preview_id ?? raw.previewId ?? '',
    confirmationToken: raw.confirmation_token ?? raw.confirmationToken ?? '',
    diffs: Array.isArray(raw.diffs) ? raw.diffs.map(mapDeploymentDiff) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapDeploymentIdentity) : [],
  };
}

function mapTerminalResult(raw: any): K8sTerminalResult {
  return {
    status: raw.status ?? '',
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    command: raw.command ?? '',
    verb: raw.verb ?? '',
    args: raw.args ?? [],
    output: raw.output ?? '',
    exitCode: raw.exit_code ?? raw.exitCode ?? 0,
    auditId: raw.audit_id ?? raw.auditId ?? '',
    blockedReason: raw.blocked_reason ?? raw.blockedReason ?? '',
    mode: raw.mode ?? '',
    outputTruncated: raw.output_truncated ?? raw.outputTruncated ?? false,
  };
}

function mapRuntimeGroups(raw: any): K8sRuntimeGroupsResponse {
  const summary = raw.summary ?? {};
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    groups: Array.isArray(raw.groups) ? raw.groups.map(mapRuntimeGroup) : [],
    summary: {
      groupCount: summary.group_count ?? summary.groupCount ?? 0,
      serviceCount: summary.service_count ?? summary.serviceCount ?? 0,
      workloadCount: summary.workload_count ?? summary.workloadCount ?? 0,
      podCount: summary.pod_count ?? summary.podCount ?? 0,
      pvcCount: summary.pvc_count ?? summary.pvcCount ?? 0,
      virtualServiceCount: summary.virtual_service_count ?? summary.virtualServiceCount ?? 0,
      gatewayCount: summary.gateway_count ?? summary.gatewayCount ?? 0,
      destinationRuleCount: summary.destination_rule_count ?? summary.destinationRuleCount ?? 0,
      securityPolicyCount: summary.security_policy_count ?? summary.securityPolicyCount ?? 0,
    },
  };
}

function mapRuntimeGroup(raw: any): K8sRuntimeGroup {
  const summary = raw.summary ?? {};
  return {
    key: raw.key ?? '',
    displayName: raw.display_name ?? raw.displayName ?? '',
    isVirtual: Boolean(raw.is_virtual ?? raw.isVirtual),
    exposures: Array.isArray(raw.exposures) ? raw.exposures.map(mapRuntimeExposure) : [],
    services: Array.isArray(raw.services) ? raw.services.map(mapRuntimeService) : [],
    workloads: Array.isArray(raw.workloads) ? raw.workloads.map(mapRuntimeWorkload) : [],
    summary: {
      servicesTotal: summary.services_total ?? summary.servicesTotal ?? 0,
      workloadsTotal: summary.workloads_total ?? summary.workloadsTotal ?? 0,
      podsTotal: summary.pods_total ?? summary.podsTotal ?? 0,
      runningPods: summary.running_pods ?? summary.runningPods ?? 0,
      pendingPods: summary.pending_pods ?? summary.pendingPods ?? 0,
      failedPods: summary.failed_pods ?? summary.failedPods ?? 0,
      restartCount: summary.restart_count ?? summary.restartCount ?? 0,
      persistentVolumeClaimsTotal: summary.persistent_volume_claims_total ?? summary.persistentVolumeClaimsTotal ?? 0,
      virtualServicesTotal: summary.virtual_services_total ?? summary.virtualServicesTotal ?? 0,
      gatewaysTotal: summary.gateways_total ?? summary.gatewaysTotal ?? 0,
      destinationRulesTotal: summary.destination_rules_total ?? summary.destinationRulesTotal ?? 0,
      securityPoliciesTotal: summary.security_policies_total ?? summary.securityPoliciesTotal ?? 0,
    },
  };
}

function mapRuntimeExposure(raw: any): K8sRuntimeExposureNode {
  return {
    key: raw.key ?? '',
    name: raw.name ?? '',
    kind: raw.kind ?? '',
    hosts: arrayOfStrings(raw.hosts),
    gateways: arrayOfStrings(raw.gateways),
    serviceRefs: arrayOfStrings(raw.service_refs ?? raw.serviceRefs),
    routeTargets: mapArray(raw.route_targets ?? raw.routeTargets, mapRuntimeRouteTarget),
    routeRules: mapArray(raw.route_rules ?? raw.routeRules, mapRuntimeVirtualServiceRoute),
  };
}

function mapRuntimeService(raw: any): K8sRuntimeServiceNode {
  return {
    name: raw.name ?? '',
    serviceType: raw.service_type ?? raw.serviceType ?? '',
    clusterIP: raw.cluster_ip ?? raw.clusterIP ?? '',
    selectors: raw.selectors ?? {},
    ports: mapArray(raw.ports, mapRuntimeServicePort),
    hosts: arrayOfStrings(raw.hosts),
    virtualServices: arrayOfStrings(raw.virtual_services ?? raw.virtualServices),
    virtualServiceDetails: mapArray(raw.virtual_service_details ?? raw.virtualServiceDetails, mapRuntimeVirtualService),
    gateways: arrayOfStrings(raw.gateways),
    destinationRules: arrayOfStrings(raw.destination_rules ?? raw.destinationRules),
    destinationRuleDetails: mapArray(raw.destination_rule_details ?? raw.destinationRuleDetails, mapRuntimeDestinationRule),
  };
}

function mapRuntimeRouteTarget(raw: any): K8sRuntimeRouteTarget {
  return {
    host: raw.host ?? '',
    subset: raw.subset ?? '',
    port: raw.port ?? '',
    weight: raw.weight,
  };
}

function mapRuntimeStringMatch(raw: any): K8sRuntimeStringMatchNode | undefined {
  if (!raw) return undefined;
  return {
    matchType: raw.match_type ?? raw.matchType ?? '',
    value: raw.value ?? '',
  };
}

function mapRuntimeHeaderMatch(raw: any): K8sRuntimeHeaderMatchNode {
  return {
    name: raw.name ?? '',
    matcher: mapRuntimeStringMatch(raw.matcher) ?? { matchType: '', value: '' },
  };
}

function mapRuntimeVirtualServiceMatch(raw: any): K8sRuntimeVirtualServiceMatchNode {
  return {
    summary: raw.summary ?? '',
    uri: mapRuntimeStringMatch(raw.uri),
    scheme: mapRuntimeStringMatch(raw.scheme),
    method: mapRuntimeStringMatch(raw.method),
    authority: mapRuntimeStringMatch(raw.authority),
    headers: mapArray(raw.headers, mapRuntimeHeaderMatch),
    gateways: arrayOfStrings(raw.gateways),
    sourceLabels: arrayOfStrings(raw.source_labels ?? raw.sourceLabels),
    sourceNamespace: raw.source_namespace ?? raw.sourceNamespace,
    sourceSubnets: arrayOfStrings(raw.source_subnets ?? raw.sourceSubnets),
    port: raw.port,
    sniHosts: arrayOfStrings(raw.sni_hosts ?? raw.sniHosts),
  };
}

function mapRuntimeVirtualServiceRoute(raw: any): K8sRuntimeVirtualServiceRouteNode {
  return {
    name: raw.name ?? '',
    protocol: raw.protocol ?? '',
    rewriteURI: raw.rewrite_uri ?? raw.rewriteURI ?? '',
    matches: mapArray(raw.matches, mapRuntimeVirtualServiceMatch),
    targets: mapArray(raw.targets, mapRuntimeRouteTarget),
  };
}

function mapRuntimeVirtualService(raw: any): K8sRuntimeVirtualServiceNode {
  return {
    name: raw.name ?? '',
    hosts: arrayOfStrings(raw.hosts),
    gateways: arrayOfStrings(raw.gateways),
    routeTargets: mapArray(raw.route_targets ?? raw.routeTargets, mapRuntimeRouteTarget),
    routes: mapArray(raw.routes, mapRuntimeVirtualServiceRoute),
  };
}

function mapRuntimeServicePort(raw: any): K8sRuntimeServicePort {
  return {
    name: raw.name ?? '',
    port: raw.port ?? 0,
    targetPort: raw.target_port ?? raw.targetPort ?? '',
    protocol: raw.protocol ?? '',
    nodePort: raw.node_port ?? raw.nodePort,
  };
}

function mapRuntimeDestinationRule(raw: any): K8sRuntimeDestinationRuleNode {
  return {
    name: raw.name ?? '',
    host: raw.host ?? '',
    subsets: arrayOfStrings(raw.subsets),
    subsetDetails: mapArray(raw.subset_details ?? raw.subsetDetails, (item: any) => ({
      name: item.name ?? '',
      labels: item.labels ?? {},
    })),
    hasTrafficPolicy: Boolean(raw.has_traffic_policy ?? raw.hasTrafficPolicy),
    exportTo: arrayOfStrings(raw.export_to ?? raw.exportTo),
  };
}

function mapRuntimeWorkload(raw: any): K8sRuntimeWorkloadNode {
  const podsSummary = raw.pods_summary ?? raw.podsSummary ?? {};
  return {
    key: raw.key ?? '',
    name: raw.name ?? '',
    kind: raw.kind ?? '',
    selector: raw.selector ?? {},
    templateLabels: raw.template_labels ?? raw.templateLabels ?? {},
    serviceAccounts: arrayOfStrings(raw.service_accounts ?? raw.serviceAccounts),
    configMaps: arrayOfStrings(raw.config_maps ?? raw.configMaps),
    persistentVolumeClaims: arrayOfStrings(raw.persistent_volume_claims ?? raw.persistentVolumeClaims),
    hpas: Array.isArray(raw.hpas) ? raw.hpas.map((item: any) => ({ name: item.name ?? '' })) : [],
    securityPolicies: Array.isArray(raw.security_policies ?? raw.securityPolicies)
      ? (raw.security_policies ?? raw.securityPolicies).map((item: any) => ({ name: item.name ?? '', kind: item.kind ?? '', summary: item.summary ?? '' }))
      : [],
    podsSummary: {
      total: podsSummary.total ?? 0,
      running: podsSummary.running ?? 0,
      pending: podsSummary.pending ?? 0,
      failed: podsSummary.failed ?? 0,
      succeeded: podsSummary.succeeded ?? 0,
      readyContainers: podsSummary.ready_containers ?? podsSummary.readyContainers ?? 0,
      totalContainers: podsSummary.total_containers ?? podsSummary.totalContainers ?? 0,
      restartCount: podsSummary.restart_count ?? podsSummary.restartCount ?? 0,
    },
  };
}

function arrayOfStrings(value: any): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function mapArray<T>(value: any, mapper: (item: any) => T): T[] {
  return Array.isArray(value) ? value.map(mapper) : [];
}

async function terminalRequest(input: { clusterId: string; namespace: string; command: string }): Promise<any> {
  try {
    return await apiRequest<any>('/k8s/terminal/exec', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, namespace: input.namespace, command: input.command }),
    });
  } catch (error) {
    if (error instanceof ApiRequestError && (error.data as any)?.status === 'blocked') {
      return error.data;
    }
    throw error;
  }
}

export const k8sApi = {
  async listClusters(query = ''): Promise<K8sCluster[]> {
    const search = query.trim();
    const raw = await apiRequest<any[] | null>(`/k8s/clusters${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    return Array.isArray(raw) ? raw.map(mapCluster) : [];
  },
  async listClustersForAdministration(query = ''): Promise<K8sCluster[]> {
    const search = query.trim();
    const raw = await apiRequest<any[] | null>(`/platform/k8s/clusters${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    return Array.isArray(raw) ? raw.map(mapCluster) : [];
  },
  async registerCluster(input: K8sClusterRegistrationInput): Promise<K8sClusterRegistrationResult> {
    const body: Record<string, unknown> = {
      cluster: {
        id: input.id,
        name: input.name,
        version: input.version,
        region: input.region,
        description: input.description,
        access_mode: input.accessMode ?? 'direct',
        read_only: input.readOnly ?? true,
      },
      kubeconfig: input.kubeconfig,
    };
    if (input.expiresAt) body.expires_at = input.expiresAt;
    const raw = await apiRequest<any>('/k8s/cluster-registrations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return {
      cluster: mapCluster(raw.cluster),
      credentials: {
        controller: mapClusterCredential(raw.credentials?.controller),
        broker: mapClusterCredential(raw.credentials?.broker),
        auditId: raw.credentials?.audit_id ?? '',
        probe: raw.credentials?.probe ? mapClusterProbe(raw.credentials.probe) : undefined,
        probeStatePersisted: typeof raw.credentials?.probe_state_persisted === 'boolean'
          ? raw.credentials.probe_state_persisted
          : undefined,
      },
    };
  },
  async probeCluster(id: string): Promise<K8sClusterProbe> {
    const raw = await apiRequest<any>(`/k8s/clusters/${encodeURIComponent(id)}/probe`, { method: 'POST' });
    return mapClusterProbe(raw);
  },
  async deleteCluster(id: string): Promise<K8sDeleteResult> {
    const raw = await apiRequest<any>(`/k8s/clusters/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { deleted: Boolean(raw.deleted) };
  },
  async listClusterCredentials(clusterId = ''): Promise<K8sClusterCredential[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    const raw = await apiRequest<any[]>(`/k8s/cluster-credentials${params.toString() ? `?${params.toString()}` : ''}`);
    return raw.map(mapClusterCredential);
  },
  async createClusterCredential(input: { clusterId: string; name: string; kubeconfig: string; expiresAt?: string }): Promise<K8sCredentialRegistrationResult> {
    const body: Record<string, string> = {
      cluster_id: input.clusterId,
      name: input.name,
      kubeconfig: input.kubeconfig,
    };
    if (input.expiresAt) body.expires_at = input.expiresAt;
    const raw = await apiRequest<any>('/k8s/cluster-credentials', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return {
      controller: mapClusterCredential(raw.controller),
      broker: mapClusterCredential(raw.broker),
      auditId: raw.audit_id ?? raw.auditId ?? '',
      probe: raw.probe ? mapClusterProbe(raw.probe) : undefined,
      probeStatePersisted: typeof (raw.probe_state_persisted ?? raw.probeStatePersisted) === 'boolean'
        ? Boolean(raw.probe_state_persisted ?? raw.probeStatePersisted)
        : undefined,
    };
  },
  async deleteClusterCredentials(clusterId: string): Promise<K8sCredentialDeletionResult> {
    const raw = await apiRequest<any>(`/k8s/cluster-credentials/${encodeURIComponent(clusterId)}`, {
      method: 'DELETE',
    });
    return {
      clusterId: raw.cluster_id ?? raw.clusterId ?? '',
      deletedControllerVersions: Number(raw.deleted_controller_versions ?? raw.deletedControllerVersions ?? 0),
      deletedBrokerVersions: Number(raw.deleted_broker_versions ?? raw.deletedBrokerVersions ?? 0),
      accessInvalidated: Boolean(raw.access_invalidated ?? raw.accessInvalidated),
      auditId: raw.audit_id ?? raw.auditId ?? '',
      clusterStatePersisted: typeof (raw.cluster_state_persisted ?? raw.clusterStatePersisted) === 'boolean'
        ? Boolean(raw.cluster_state_persisted ?? raw.clusterStatePersisted)
        : undefined,
    };
  },
  async listNamespaces(clusterId = '', query = ''): Promise<K8sNamespace[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    if (query.trim()) params.set('q', query.trim());
    const raw = await apiRequest<any[]>(`/k8s/namespaces${params.toString() ? `?${params.toString()}` : ''}`);
    return raw.map(mapNamespace);
  },
  async createNamespace(input: { clusterId: string; name: string; owner?: string }): Promise<K8sWriteResult<K8sNamespace>> {
    const raw = await apiRequest<any>('/k8s/namespaces', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, name: input.name, owner: input.owner ?? '' }),
    });
    return mapWriteResult(raw, mapNamespace);
  },
  async deleteNamespace(target: K8sNamespace): Promise<K8sWriteResult<never>> {
    const params = new URLSearchParams();
    params.set('cluster_id', target.clusterId);
    params.set('name', target.name);
    params.set('uid', target.id);
    const raw = await apiRequest<any>(`/k8s/namespaces?${params.toString()}`, { method: 'DELETE' });
    return mapWriteResult(raw);
  },
  async listResources(filter: { clusterId?: string; namespace?: string; kind?: string; query?: string } = {}): Promise<K8sResourceSummary[]> {
    const params = new URLSearchParams();
    if (filter.clusterId) params.set('cluster_id', filter.clusterId);
    if (filter.namespace) params.set('namespace', filter.namespace);
    if (filter.kind) params.set('kind', filter.kind);
    if (filter.query?.trim()) params.set('q', filter.query.trim());
    const raw = await apiRequest<any[]>(`/k8s/resources?${params.toString()}`);
    return raw.map(mapResource);
  },
  async getResourceDetail(identity: K8sResourceIdentity): Promise<K8sResourceDetail> {
    const raw = await apiRequest<any>(`/k8s/resources/detail?${resourceIdentityParams(identity).toString()}`);
    return mapResourceDetail(raw);
  },
  async getResourceYAML(identity: K8sResourceIdentity): Promise<K8sResourceYAML> {
    const raw = await apiRequest<any>(`/k8s/resources/yaml?${resourceIdentityParams(identity).toString()}`);
    return mapResourceYAML(raw);
  },
  async getPodLogs(input: { clusterId: string; namespace: string; pod: string; container?: string }): Promise<K8sPodLogs> {
    const params = new URLSearchParams();
    params.set('cluster_id', input.clusterId);
    params.set('namespace', input.namespace);
    params.set('pod', input.pod);
    if (input.container) params.set('container', input.container);
    const raw = await apiRequest<any>(`/k8s/pod-logs?${params.toString()}`);
    return mapPodLogs(raw);
  },
  async listRuntimeGroups(input: { clusterId: string; namespace: string }): Promise<K8sRuntimeGroupsResponse> {
    const params = new URLSearchParams();
    params.set('cluster_id', input.clusterId);
    params.set('namespace', input.namespace);
    const raw = await apiRequest<any>(`/k8s/runtime-groups?${params.toString()}`);
    return mapRuntimeGroups(raw);
  },
  async listDeploymentHistory(clusterId = '', namespace = ''): Promise<K8sDeploymentHistory[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    if (namespace) params.set('namespace', namespace);
    const raw = await apiRequest<any[]>(`/k8s/deployment-history${params.toString() ? `?${params.toString()}` : ''}`);
    return raw.map(mapDeploymentHistory);
  },
  async listAuditEvents(clusterId = '', namespace = ''): Promise<K8sAuditEvent[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    if (namespace) params.set('namespace', namespace);
    const raw = await apiRequest<any[]>(`/k8s/audit-events${params.toString() ? `?${params.toString()}` : ''}`);
    return raw.map(mapAuditEvent);
  },
  async listTemplates(type = ''): Promise<K8sTemplate[]> {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    const raw = await apiRequest<any[]>(`/k8s/templates${params.toString() ? `?${params.toString()}` : ''}`);
    return raw.map(mapTemplate);
  },
  async getBaseTemplate(type: string): Promise<K8sBaseTemplate> {
    const params = new URLSearchParams({ type });
    const raw = await apiRequest<any>(`/k8s/templates/base?${params.toString()}`);
    return mapBaseTemplate(raw);
  },
  async createTemplate(input: { name: string; type: string; yamlContent: string; variables: K8sTemplateVariable[]; description?: string }): Promise<K8sWriteResult<K8sTemplate>> {
    const raw = await apiRequest<any>('/k8s/templates', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        type: input.type,
        yaml_content: input.yamlContent,
        variables: input.variables.map((item) => ({ name: item.name, description: item.description, default_value: item.defaultValue, required: item.required })),
        description: input.description ?? '',
      }),
    });
    return mapWriteResult(raw, mapTemplate);
  },
  async updateTemplate(input: { id: string; name: string; type: string; yamlContent: string; variables: K8sTemplateVariable[]; description?: string }): Promise<K8sWriteResult<K8sTemplate>> {
    const raw = await apiRequest<any>('/k8s/templates', {
      method: 'PUT',
      body: JSON.stringify({
        id: input.id,
        name: input.name,
        type: input.type,
        yaml_content: input.yamlContent,
        variables: input.variables.map((item) => ({ name: item.name, description: item.description, default_value: item.defaultValue, required: item.required })),
        description: input.description ?? '',
      }),
    });
    return mapWriteResult(raw, mapTemplate);
  },
  async deleteTemplate(id: string): Promise<K8sWriteResult<never>> {
    const raw = await apiRequest<any>(`/k8s/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return mapWriteResult(raw);
  },
  async renderTemplate(id: string, variables: Record<string, string>): Promise<K8sTemplateRender> {
    const raw = await apiRequest<any>('/k8s/templates/render', {
      method: 'POST',
      body: JSON.stringify({ id, variables }),
    });
    return mapTemplateRender(raw);
  },
  async previewDeployment(input: { clusterId: string; yamlContent: string }): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments/preview', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, yaml_content: input.yamlContent }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async applyDeployment(input: { clusterId: string; yamlContent: string; previewId?: string; confirmationToken?: string }): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments', {
      method: 'POST',
      body: JSON.stringify({
        cluster_id: input.clusterId,
        yaml_content: input.yamlContent,
        preview_id: input.previewId,
        confirmation_token: input.confirmationToken,
      }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async previewDeleteDeployment(identity: K8sDeploymentIdentity): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments/delete-preview', {
      method: 'POST',
      body: JSON.stringify({
        identity: {
          cluster_id: identity.clusterId,
          namespace: identity.namespace,
          api_version: identity.apiVersion,
          kind: identity.kind,
          name: identity.name,
          uid: identity.uid,
        },
      }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async deleteDeployment(identity: K8sDeploymentIdentity, confirmation: { previewId?: string; confirmationToken?: string } = {}): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments', {
      method: 'DELETE',
      body: JSON.stringify({
        identity: {
          cluster_id: identity.clusterId,
          namespace: identity.namespace,
          api_version: identity.apiVersion,
          kind: identity.kind,
          name: identity.name,
          uid: identity.uid,
        },
        preview_id: confirmation.previewId,
        confirmation_token: confirmation.confirmationToken,
      }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async rollbackDeployment(input: { identity: K8sDeploymentIdentity; historyId: string }): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments/rollback', {
      method: 'POST',
      body: JSON.stringify({
        history_id: input.historyId,
        identity: {
          cluster_id: input.identity.clusterId,
          namespace: input.identity.namespace,
          api_version: input.identity.apiVersion,
          kind: input.identity.kind,
          name: input.identity.name,
          uid: input.identity.uid,
        },
      }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async execTerminal(input: { clusterId: string; namespace: string; command: string }): Promise<K8sTerminalResult> {
    const raw = await terminalRequest(input);
    return mapTerminalResult(raw);
  },
};
