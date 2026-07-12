import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Copy, Play, RefreshCw, Save, Search, Server, Settings2, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from '../k8s/api';
import { defaultLogsCollectorNamespace, logSinkLabel, logsApi, normalizeLogsCollectorNamespace, type LogAccessSource, type LogParsePreviewResult, type LogParseRule, type LogRouteInput, type LogRoutePreview, type LogRouteView, type LogSource, type LogSourceType, type LogsServiceSummary, type LogsWorkload, type VMAgentEndpoint, type VMInstallation } from './api';
import { ServicePickerPanel, isCollectingRoute, routeAccessPriority, routeLifecycle, serviceDisplayName } from './ServicePickerPanel';
import { LogsParseRuleDialog, type ParserMode } from './LogsParseRuleDialog';
import { LogsErrorLine, LogsTaskPageHeader } from './LogsPrimitives';
import { platformApi } from '../platform/api';

const sourceTabs: Array<{ value: LogAccessSource; label: string }> = [
  { value: 'k8s', label: 'K8s' },
  { value: 'vm', label: 'VM' },
];

const defaultParseSample = '{"level":"INFO","message":"service started"}';
const defaultParserRuleName = 'default-parser';
const defaultParserPattern = '^(?P<level>[A-Z]+)\\s+(?P<message>.*)$';

type OnboardingStep = 1 | 2 | 3;
type SetupTask = 'service' | 'target' | 'endpoint';

function serviceMatchesAccessSource(service: LogsServiceSummary, source: LogAccessSource) {
  if (source === 'vm') {
    return service.identityType === 'host_process';
  }
  return service.identityType === 'k8s_workload' || service.source === 'k8s';
}

function formatMissing(items: string[]) {
  if (items.length <= 3) return items.join('、');
  return `${items.slice(0, 3).join('、')} 等 ${items.length} 项`;
}

function safeSegment(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'default';
}

function k8sLogIncludePath(namespace: string, workloadName: string) {
  const ns = namespace || '*';
  const workload = workloadName ? `${workloadName}*` : '*';
  return `/var/log/pods/${ns}_${workload}_*/*/*.log`;
}

export function renderK8sRouteFragmentDraft(input: {
  namespace: string;
  workloadName: string;
	serviceId: string;
  serviceName: string;
  environmentId: string;
  endpointWriteURL: string;
  accountId: string;
  projectId: string;
  parseRules: LogParseRule[];
}) {
  const suffix = safeSegment(`${input.namespace}-${input.workloadName}`);
  const include = k8sLogIncludePath(input.namespace, input.workloadName);
  const enabledRules = input.parseRules.filter((rule) => rule.enabled !== false);
  const transformProcessor = enabledRules.length ? `
  transform/${suffix}:
    log_statements:
      - context: log
        statements:
${enabledRules.map((rule) => {
  if (rule.ruleType === 'json') {
    return `          - "merge_maps(attributes, ParseJSON(body), \\"upsert\\")"`;
  }
  return `          - ${JSON.stringify(`merge_maps(attributes, ExtractPatterns(body, ${JSON.stringify(rule.pattern || '')}), "upsert")`)}`;
}).join('\n')}` : '';
  const pipelineProcessors = enabledRules.length
    ? `memory_limiter, k8s_attributes, resource/${suffix}, transform/${suffix}, batch`
    : `memory_limiter, k8s_attributes, resource/${suffix}, batch`;
  const tenantHeaders = input.accountId && input.projectId
    ? `
    headers:
      AccountID: ${JSON.stringify(input.accountId)}
      ProjectID: ${JSON.stringify(input.projectId)}`
    : '';
  return `receivers:
  file_log/${suffix}:
    include:
      - "${include}"
    exclude:
      - "/var/log/pods/*_novaapm-logs-agent-*_*/*/*.log"
      - "/var/log/pods/*/*/*.gz"
      - "/var/log/pods/*/*/*.tmp"
      - "/var/log/pods/*/*/*.log.*"
    poll_interval: 10s
    max_concurrent_files: 64
    max_batches: 2
    max_log_size: 1MiB
    file_cache_advise: true
    include_file_path: true
    include_file_name: false
    start_at: end
    storage: file_storage/filelog_offsets
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 0
    operators:
      - type: container
processors:
  resource/${suffix}:
    attributes:
      - key: service.name
        value: "${input.serviceName || input.workloadName}"
        action: upsert
      - key: novaapm.service_id
        value: "${input.serviceId}"
        action: upsert
      - key: deployment.environment
        value: "${input.environmentId}"
        action: upsert
${transformProcessor}
exporters:
  otlp_http/endpoint_${suffix}:
    logs_endpoint: "${input.endpointWriteURL}"${tenantHeaders}
service:
  pipelines:
    logs/${suffix}:
      receivers: [file_log/${suffix}]
      processors: [${pipelineProcessors}]
      exporters: [otlp_http/endpoint_${suffix}]
`;
}

function fragmentPlaceholderWarnings(fragment: string, expected: Array<{ label: string; value: string }>) {
  const text = fragment || '';
  return expected
    .filter((item) => item.value && !text.includes(item.value))
    .map((item) => `${item.label} 已不同于表单生成值`);
}

function buildParserRules(mode: ParserMode, name: string, pattern: string): LogParseRule[] {
  if (mode === 'none') return [];
  return [{
    name: name || `${mode}-parser`,
    ruleType: mode,
    pattern: mode === 'regex' ? pattern : undefined,
    enabled: true,
  }];
}

function parserFormFromRules(rules?: LogParseRule[]) {
  const rule = (rules ?? []).find((item) => item.enabled !== false);
  if (!rule) {
    return { mode: 'none' as ParserMode, name: defaultParserRuleName, pattern: defaultParserPattern };
  }
  if (rule.ruleType === 'json') {
    return { mode: 'json' as ParserMode, name: rule.name || defaultParserRuleName, pattern: defaultParserPattern };
  }
  return { mode: 'regex' as ParserMode, name: rule.name || defaultParserRuleName, pattern: rule.pattern || defaultParserPattern };
}

function resolveServiceWorkloadKey(service: LogsServiceSummary, workloads: LogsWorkload[]) {
  if (!service.cluster || !service.namespace) return '';
  const matched = workloads.find((item) => item.name === service.name || item.name === service.displayName);
  return matched ? workloadIdentity(matched) : '';
}

export function LogsOnboardingPage() {
  const queryClient = useQueryClient();
	const { productId = '', serviceId: pathServiceId = '', id: onboardingRouteId = '' } = useParams();
  const suspendDraftResetRef = useRef(false);
  const routeParamAppliedRef = useRef('');
  const { data: workspace, isLoading, error, refetch } = useQuery({
	queryKey: ['logs-onboarding-workspace', productId, pathServiceId],
	queryFn: () => logsApi.getWorkspace(productId, pathServiceId),
	enabled: Boolean(productId && pathServiceId),
  });

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [setupTask, setSetupTask] = useState<SetupTask>('service');
  const [sourceMode, setSourceMode] = useState<LogAccessSource>('k8s');
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceId, setServiceId] = useState(pathServiceId);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncClusterId, setSyncClusterId] = useState('');
  const [syncNamespace, setSyncNamespace] = useState('');
	const [syncEnvironmentId, setSyncEnvironmentId] = useState('');
  const [endpointQuery, setEndpointQuery] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [agentNamespace, setAgentNamespace] = useState(defaultLogsCollectorNamespace);
  const [workloadKey, setWorkloadKey] = useState('');
  const [workloadQuery, setWorkloadQuery] = useState('');
  const [vmPath, setVmPath] = useState('');
  const [vmEndpointDraft, setVMEndpointDraft] = useState('');
  const [vmEndpointDraftError, setVMEndpointDraftError] = useState('');
  const [collectorConfigYaml, setCollectorConfigYaml] = useState('');
  const [collectorFragmentTouched, setCollectorFragmentTouched] = useState(false);
  const [parserMode, setParserMode] = useState<ParserMode>('none');
  const [parserRuleName, setParserRuleName] = useState(defaultParserRuleName);
  const [parserPattern, setParserPattern] = useState(defaultParserPattern);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [parseSample, setParseSample] = useState(defaultParseSample);
  const [parserDraftMode, setParserDraftMode] = useState<ParserMode>('none');
  const [parserDraftRuleName, setParserDraftRuleName] = useState(defaultParserRuleName);
  const [parserDraftPattern, setParserDraftPattern] = useState(defaultParserPattern);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [routeEditMode, setRouteEditMode] = useState(false);
  const [preview, setPreview] = useState<LogRoutePreview | null>(null);
  const [createdRoute, setCreatedRoute] = useState<LogRouteView | null>(null);
  const routeUpdateMode = Boolean(onboardingRouteId);

  const services = workspace?.services ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const clusters = workspace?.clusters ?? [];
  const routes = workspace?.routes ?? [];
  const externalLogServiceIds = useMemo(() => new Set((workspace?.targets ?? [])
    .filter((item) => item.target.status !== 'disabled')
    .map((item) => item.target.serviceId)), [workspace?.targets]);
  const sourceType: LogSourceType = sourceMode === 'vm' ? 'vm_file' : 'k8s_stdout';
  const runtimeAgentNamespace = normalizeLogsCollectorNamespace(agentNamespace);
  const writableClusters = useMemo(() => clusters.filter((cluster) => !cluster.readOnly), [clusters]);
  const writableClusterIds = useMemo(() => new Set(writableClusters.map((cluster) => cluster.id)), [writableClusters]);
  const sourceServices = useMemo(() => services.filter((service) => {
    if (!serviceMatchesAccessSource(service, sourceMode)) return false;
    if (sourceMode === 'k8s' && service.cluster && !writableClusterIds.has(service.cluster)) return false;
    return true;
  }), [services, sourceMode, writableClusterIds]);
  const selectedRoute = routes.find((item) => item.route.id === selectedRouteId) ?? null;
  const runningRouteServiceIds = useMemo(() => new Set(routes.filter(isCollectingRoute).map((route) => route.route.serviceId)), [routes]);
  const routeScopedServices = useMemo(() => {
    if (!routeUpdateMode) return null;
    if (!selectedRoute) return [];
    const service = sourceServices.find((item) => item.id === selectedRoute.route.serviceId);
    return service ? [service] : [];
  }, [routeUpdateMode, selectedRoute, sourceServices]);
  const accessServices = useMemo(() => (
    routeScopedServices ?? sourceServices.filter((service) => !runningRouteServiceIds.has(service.id) && !externalLogServiceIds.has(service.id))
  ), [externalLogServiceIds, routeScopedServices, runningRouteServiceIds, sourceServices]);
  const routeUpdateMissing = routeUpdateMode && Boolean(onboardingRouteId) && !isLoading && !selectedRoute;
  const restoredSource = selectedRoute?.source ?? createdRoute?.source ?? null;

  useEffect(() => {
    if (routeUpdateMode && (!serviceId || !accessServices.some((service) => service.id === serviceId))) {
      if (accessServices[0]) {
        applyServiceRuntimeScope(accessServices[0]);
      } else {
        setServiceId('');
      }
    } else if (!routeUpdateMode && serviceId && !accessServices.some((service) => service.id === serviceId)) {
      setServiceId('');
      setSetupTask('service');
    }
    if (!routeUpdateMode && sourceMode === 'k8s' && (!clusterId || !writableClusterIds.has(clusterId))) {
      const nextClusterId = writableClusters[0]?.id ?? '';
      if (nextClusterId !== clusterId) {
        setClusterId(nextClusterId);
        setNamespace('');
        setWorkloadKey('');
        setWorkloadQuery('');
      }
    }
  }, [accessServices, clusterId, routeUpdateMode, serviceId, sourceMode, writableClusterIds, writableClusters]);

  useEffect(() => {
    if (suspendDraftResetRef.current) {
      suspendDraftResetRef.current = false;
      return;
    }
    setPreview(null);
    setCreatedRoute(null);
  }, [sourceType, serviceId, endpointId, clusterId, namespace, workloadKey, vmPath, collectorConfigYaml, parserMode, parserRuleName, parserPattern]);

  useEffect(() => {
    if (!onboardingRouteId) {
      routeParamAppliedRef.current = '';
      return;
    }
    if (routeParamAppliedRef.current === onboardingRouteId) return;
    const route = routes.find((item) => item.route.id === onboardingRouteId);
    if (!route) return;
    routeParamAppliedRef.current = onboardingRouteId;
    loadRouteDraft(route, { edit: routeUpdateMode || isCollectingRoute(route) });
  }, [onboardingRouteId, routeUpdateMode, routes]);

	const platformEnvironmentsQuery = useQuery({ queryKey: ['platform-environments'], queryFn: platformApi.listEnvironments });
	const platformEnvironments = (platformEnvironmentsQuery.data ?? []).filter((item) => item.status === 'active');

  const namespacesQuery = useQuery({
    queryKey: ['logs-k8s-namespaces', clusterId],
    queryFn: () => k8sApi.listNamespaces(clusterId),
    enabled: sourceType !== 'vm_file' && Boolean(clusterId),
  });
  const namespaces = namespacesQuery.data ?? [];
  const syncNamespacesQuery = useQuery({
    queryKey: ['logs-k8s-sync-namespaces', syncClusterId],
    queryFn: () => k8sApi.listNamespaces(syncClusterId),
    enabled: sourceMode === 'k8s' && Boolean(syncClusterId),
  });
  const syncNamespaceOptions = syncNamespacesQuery.data ?? [];
  const namespaceOptions = useMemo(() => {
    const items = [...namespaces];
    if (routeUpdateMode && namespace && !items.some((item) => item.name === namespace)) {
      items.unshift({ id: namespace, clusterId, name: namespace, status: 'active', owner: '', phase: 'Active', updatedAt: '' });
    }
    return items;
  }, [clusterId, namespace, namespaces, routeUpdateMode]);

  useEffect(() => {
    if (routeUpdateMode) return;
    if (sourceType !== 'vm_file' && !namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces, routeUpdateMode, sourceType]);

  const workloadsQuery = useQuery({
    queryKey: ['logs-k8s-workloads', clusterId, namespace],
    queryFn: () => logsApi.listK8sWorkloads(clusterId, namespace),
    enabled: sourceType !== 'vm_file' && Boolean(clusterId && namespace),
  });
  const workloads = workloadsQuery.data ?? [];
  const logsCollectorRuntimeStatusQuery = useQuery({
    queryKey: ['logs-collector-runtime-status', clusterId, runtimeAgentNamespace],
    queryFn: () => logsApi.getLogsCollectorRuntimeStatus({ clusterId, namespace: runtimeAgentNamespace }),
    enabled: sourceType !== 'vm_file' && Boolean(clusterId),
    retry: false,
  });
  const vmRouteId = sourceType === 'vm_file' ? createdRoute?.route.id || selectedRouteId : '';
  const vmInstallationQuery = useQuery({
    queryKey: ['logs-vm-installation', vmRouteId],
    queryFn: () => logsApi.getVMInstallation(vmRouteId),
    enabled: Boolean(vmRouteId),
    retry: false,
  });
  const vmAgentEndpointsQuery = useQuery({
    queryKey: ['logs-vm-agent-endpoints', vmRouteId],
    queryFn: () => logsApi.listVMAgentEndpoints(vmRouteId),
    enabled: Boolean(vmRouteId),
    retry: false,
  });

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return accessServices;
    return accessServices.filter((service) => `${service.name} ${service.displayName} ${service.ownerTeam}`.toLowerCase().includes(query));
  }, [accessServices, serviceQuery]);

  const serviceRoutesByService = useMemo(() => {
    const grouped = new Map<string, LogRouteView[]>();
    for (const route of routes) {
      if (route.route.sourceType !== sourceType) continue;
      const items = grouped.get(route.route.serviceId) ?? [];
      grouped.set(route.route.serviceId, [...items, route]);
    }
    return new Map(Array.from(grouped.entries()).map(([serviceKey, serviceRoutes]) => [
      serviceKey,
      [...serviceRoutes].sort((left, right) => routeAccessPriority(left) - routeAccessPriority(right)),
    ]));
  }, [routes, sourceType]);

  const selectedServiceRoutes = serviceId ? serviceRoutesByService.get(serviceId) ?? [] : [];
  const collectingRoute = selectedServiceRoutes.find(isCollectingRoute) ?? null;
  const collectingConfigLocked = Boolean(collectingRoute && !routeEditMode);
  const selectedService = sourceServices.find((item) => item.id === serviceId) ?? null;
  const availableEndpoints = useMemo(() => {
    if (sourceType === 'vm_file') return endpoints.filter((item) => item.scopeType !== 'k8s_cluster');
    return endpoints.filter((item) => item.scopeType === 'global' || (item.scopeType === 'k8s_cluster' && item.clusterId === clusterId));
  }, [clusterId, endpoints, sourceType]);
  const filteredEndpoints = useMemo(() => {
    const query = endpointQuery.trim().toLowerCase();
    if (!query) return availableEndpoints;
    return availableEndpoints.filter((endpoint) => `${endpoint.name} ${endpoint.sinkType} ${endpoint.scopeType} ${endpoint.clusterId} ${endpoint.writeURL} ${endpoint.streamName}`.toLowerCase().includes(query));
  }, [availableEndpoints, endpointQuery]);
  const selectedEndpoint = availableEndpoints.find((item) => item.id === endpointId) ?? null;
  const effectiveEndpoint = selectedEndpoint ?? (sourceType !== 'vm_file' ? availableEndpoints[0] ?? null : null);
  const selectedCluster = clusters.find((item) => item.id === clusterId) ?? null;
  const logsCollectorRuntimeStatus = sourceType === 'vm_file' ? null : logsCollectorRuntimeStatusQuery.data ?? null;
  const observabilityAccessURL = clusterId
    ? `/k8s/observability?cluster_id=${encodeURIComponent(clusterId)}&namespace=${encodeURIComponent(runtimeAgentNamespace)}&task=incremental`
    : '/k8s/observability';
  const observabilityAccessError = logsCollectorRuntimeStatusQuery.error instanceof Error
    ? logsCollectorRuntimeStatusQuery.error.message
    : logsCollectorRuntimeStatusQuery.error
      ? '观测接入状态读取失败'
      : '';
  const observabilityAccessReady = sourceType === 'vm_file' || Boolean(logsCollectorRuntimeStatus?.ready);
  const observabilityAccessBlockedReason = sourceType === 'vm_file'
    ? ''
    : !clusterId
      ? '请先选择 K8s 集群'
      : logsCollectorRuntimeStatusQuery.isLoading
        ? '正在确认集群观测接入状态'
        : observabilityAccessError
          ? `观测接入状态读取失败：${observabilityAccessError}`
          : !logsCollectorRuntimeStatus?.ready
            ? logsCollectorRuntimeStatus?.message || '目标集群 logs_collector 基础组件未就绪，请先到 K8s / 观测接入重新部署。'
            : '';
  const restoredWorkload = workloadFromRouteSource(restoredSource);
  const selectedWorkloadFromApi = workloads.find((item) => workloadIdentity(item) === workloadKey) ?? null;
  const selectedWorkload = selectedWorkloadFromApi ?? (routeUpdateMode ? restoredWorkload : null);
  const selectedRouteMatchesDraft = selectedRoute ? routeMatchesCurrentDraft(selectedRoute) : false;
  const filteredWorkloads = useMemo(() => {
    const query = workloadQuery.trim().toLowerCase();
    if (!query) return workloads;
    return workloads.filter((item) => `${item.kind} ${item.name} ${Object.entries(item.selector ?? {}).map(([key, value]) => `${key}=${value}`).join(' ')}`.toLowerCase().includes(query));
  }, [workloadQuery, workloads]);
  const displayedWorkloads = useMemo(() => {
    if (!routeUpdateMode || !restoredWorkload || filteredWorkloads.some((item) => workloadIdentity(item) === workloadIdentity(restoredWorkload))) {
      return filteredWorkloads;
    }
    const query = workloadQuery.trim().toLowerCase();
    const restoredText = `${restoredWorkload.kind} ${restoredWorkload.name} ${Object.entries(restoredWorkload.selector ?? {}).map(([key, value]) => `${key}=${value}`).join(' ')}`.toLowerCase();
    return !query || restoredText.includes(query) ? [restoredWorkload, ...filteredWorkloads] : filteredWorkloads;
  }, [filteredWorkloads, restoredWorkload, routeUpdateMode, workloadQuery]);
  const displayedWorkloadTotal = Math.max(workloads.length, displayedWorkloads.length);
  const clusterRoutes = useMemo(() => routes.filter((item) => item.source?.clusterId === clusterId), [clusterId, routes]);
  const clusterRouteNamespaces = Array.from(new Set(clusterRoutes.map((item) => item.source?.namespace).filter(Boolean)));
  const clusterRouteWorkloads = clusterRoutes.filter((item) => item.source?.workloadName).length;
  const currentParseRules = useMemo(() => buildParserRules(parserMode, parserRuleName, parserPattern), [parserMode, parserRuleName, parserPattern]);
  const draftParseRules = useMemo(() => buildParserRules(parserDraftMode, parserDraftRuleName, parserDraftPattern), [parserDraftMode, parserDraftRuleName, parserDraftPattern]);
  const serviceScopeWorkloadKey = selectedService ? resolveServiceWorkloadKey(selectedService, workloads) : '';
  const defaultWorkloadKey = sourceType === 'vm_file'
    ? ''
    : serviceScopeWorkloadKey || (workloads[0] ? workloadIdentity(workloads[0]) : '');
  const generatedK8sFragment = useMemo(() => {
    if (sourceType === 'vm_file' || !namespace || !(selectedWorkload?.name || restoredSource?.workloadName) || !effectiveEndpoint?.writeURL) return '';
    const workloadName = selectedWorkload?.name || restoredSource?.workloadName || '';
    return renderK8sRouteFragmentDraft({
      namespace,
      workloadName,
	  serviceId: selectedService?.id || serviceId,
	  serviceName: selectedService?.name || workloadName,
		environmentId: selectedService?.environmentId || syncEnvironmentId,
      endpointWriteURL: effectiveEndpoint.writeURL,
      accountId: effectiveEndpoint.accountId,
      projectId: effectiveEndpoint.projectId,
      parseRules: buildParseRules(),
    });
	}, [effectiveEndpoint?.accountId, effectiveEndpoint?.projectId, effectiveEndpoint?.writeURL, namespace, parserMode, parserPattern, parserRuleName, restoredSource?.workloadName, selectedService?.environmentId, selectedService?.id, selectedService?.name, selectedWorkload?.name, serviceId, sourceType, syncEnvironmentId]);
  const fragmentWarnings = useMemo(() => {
    if (sourceType === 'vm_file') return [];
    return fragmentPlaceholderWarnings(collectorConfigYaml, [
      { label: 'Namespace', value: namespace || restoredSource?.namespace || '' },
      { label: 'Workload', value: selectedWorkload?.name || restoredSource?.workloadName || '' },
      { label: '日志路径', value: k8sLogIncludePath(namespace || restoredSource?.namespace || '', selectedWorkload?.name || restoredSource?.workloadName || '') },
      { label: '下游端点', value: effectiveEndpoint?.writeURL || '' },
    ]);
  }, [collectorConfigYaml, effectiveEndpoint?.writeURL, namespace, restoredSource?.namespace, restoredSource?.workloadName, selectedWorkload?.name, sourceType]);

  useEffect(() => {
    if (routeUpdateMode) return;
    if (sourceType === 'vm_file' || workloadKey || !defaultWorkloadKey) return;
    setWorkloadKey(defaultWorkloadKey);
  }, [defaultWorkloadKey, routeUpdateMode, sourceType, workloadKey]);

  useEffect(() => {
    if (sourceType === 'vm_file' || collectorFragmentTouched || !generatedK8sFragment) return;
    setCollectorConfigYaml(generatedK8sFragment);
  }, [collectorFragmentTouched, generatedK8sFragment, sourceType]);

  useEffect(() => {
    if (!selectedRouteId || !selectedRoute || selectedRouteMatchesDraft || suspendDraftResetRef.current) {
      return;
    }
    if (routeUpdateMode) return;
    setSelectedRouteId('');
    setCollectorConfigYaml('');
  }, [routeUpdateMode, selectedRouteId, selectedRoute?.route.id, selectedRouteMatchesDraft]);

  useEffect(() => {
    if (sourceType !== 'vm_file') {
      const clusterEndpoint = availableEndpoints.find((item) => item.scopeType === 'k8s_cluster' && item.clusterId === clusterId);
      setEndpointId((current) => current && availableEndpoints.some((item) => item.id === current) ? current : clusterEndpoint?.id ?? availableEndpoints[0]?.id ?? '');
      return;
    }
    setEndpointId((current) => current && availableEndpoints.some((item) => item.id === current) ? current : availableEndpoints[0]?.id ?? '');
  }, [availableEndpoints, clusterId, sourceType]);

  const syncK8sServicesMutation = useMutation({
    mutationFn: () => logsApi.syncK8sServices({
	  productId,
      clusterId: syncClusterId,
      namespace: syncNamespace,
	  environmentId: syncEnvironmentId,
      ownerTeam: '',
      workloadKind: 'Deployment',
    }),
    onSuccess: async () => {
      setClusterId(syncClusterId);
      setNamespace(syncNamespace);
      setWorkloadKey('');
      setWorkloadQuery('');
      setServiceId('');
      setSetupTask('service');
      setServiceQuery('');
      setSyncDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => logsApi.previewRoute(buildRouteInput()),
    onSuccess: (result) => {
      setPreview(result);
      setCurrentStep(3);
    },
  });

  const parsePreviewMutation = useMutation<LogParsePreviewResult>({
    mutationFn: async () => {
      if (parserDraftMode === 'regex' && !parserDraftPattern.includes('?P<')) {
        return { status: 'error', fields: {}, warnings: [], errors: ['Regex 需要使用命名捕获组，例如 (?P<level>INFO)。'] };
      }
      return logsApi.previewParseRules(parseSample, draftParseRules);
    },
  });

  useEffect(() => {
    if (parseDialogOpen) {
      parsePreviewMutation.reset();
    }
  }, [parseDialogOpen, parseSample, parserDraftMode, parserDraftRuleName, parserDraftPattern]);

  const createRouteMutation = useMutation({
    mutationFn: () => {
      const input = buildRouteInput();
      if (selectedRouteId) {
        return logsApi.updateRoute(selectedRouteId, input);
      }
      return logsApi.createRoute(input);
    },
    onSuccess: async (created) => {
      setCreatedRoute(created);
      setSelectedRouteId(created.route.id);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  const createVMEndpointsMutation = useMutation({
    mutationFn: async (items: Array<{ name: string; address: string }>) => {
      if (!vmRouteId) throw new Error('请先保存 VM 路由');
      const settled = await Promise.allSettled(items.map((item) => logsApi.createVMAgentEndpoint(vmRouteId, item)));
      return {
        succeeded: settled.filter((result) => result.status === 'fulfilled').length,
        failed: settled.flatMap((result, index) => result.status === 'rejected' ? [{ item: items[index], reason: result.reason }] : []),
      };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['logs-vm-agent-endpoints', vmRouteId] });
      if (result.failed.length === 0) {
        setVMEndpointDraft('');
        setVMEndpointDraftError('');
        return;
      }
      setVMEndpointDraft(result.failed.map(({ item }) => item.name === item.address ? item.address : `${item.name},${item.address}`).join('\n'));
      const firstReason = result.failed[0]?.reason;
      const message = firstReason instanceof Error ? firstReason.message : '节点登记失败';
      setVMEndpointDraftError(`已登记 ${result.succeeded} 个节点，${result.failed.length} 个失败：${message}`);
    },
  });

  const probeVMEndpointMutation = useMutation({
    mutationFn: (endpointId: string) => {
      if (!vmRouteId) throw new Error('请先保存 VM 路由');
      return logsApi.probeVMAgentEndpoint(vmRouteId, endpointId);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['logs-vm-agent-endpoints', vmRouteId] }),
  });

  const deleteVMEndpointMutation = useMutation({
    mutationFn: (endpointId: string) => {
      if (!vmRouteId) throw new Error('请先保存 VM 路由');
      return logsApi.deleteVMAgentEndpoint(vmRouteId, endpointId);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['logs-vm-agent-endpoints', vmRouteId] }),
  });

  function buildRouteInput(): LogRouteInput {
    if (sourceType !== 'vm_file' && selectedWorkload) {
      return buildK8sRouteInput(selectedWorkload, selectedService);
    }
    return {
      name: selectedService?.displayName || selectedService?.name,
      routeId: selectedRouteId,
      serviceId,
      sourceType,
      agentGroupId: '',
      endpointId: effectiveEndpoint?.id ?? endpointId,
      k8s: {
        clusterId,
        namespace,
        agentNamespace: runtimeAgentNamespace,
        workloadKind: selectedWorkload?.kind || restoredSource?.workloadKind,
        workloadName: selectedWorkload?.name || restoredSource?.workloadName,
        workloadSelector: selectedWorkload?.selector ?? {},
        parseRules: buildParseRules(),
        collectorFragmentYAML: collectorConfigYaml,
      },
      vm: sourceType === 'vm_file' ? {
        pathPattern: vmPath,
        parseRules: buildParseRules(),
      } : {},
    };
  }

  function buildK8sRouteInput(workload: LogsWorkload, service: typeof selectedService): LogRouteInput {
    return {
      name: service?.displayName || service?.name || workload.name,
      routeId: selectedRouteId,
      serviceId: service?.id ?? '',
      sourceType,
      agentGroupId: '',
      endpointId: effectiveEndpoint?.id ?? endpointId,
      k8s: {
        clusterId,
        namespace: workload.namespace,
        agentNamespace: runtimeAgentNamespace,
        workloadKind: workload.kind,
        workloadName: workload.name,
        workloadSelector: workload.selector ?? {},
        parseRules: buildParseRules(),
        collectorFragmentYAML: collectorConfigYaml,
      },
      vm: {},
    };
  }

  function buildParseRules(): LogParseRule[] {
    if (parserMode === 'regex' && !parserPattern.includes('?P<')) return [];
    return currentParseRules;
  }

  function openParseDialog() {
    setParserDraftMode(parserMode);
    setParserDraftRuleName(parserRuleName);
    setParserDraftPattern(parserPattern);
    setParseDialogOpen(true);
  }

  function submitVMEndpointDraft() {
    const parsed = parseVMEndpointDraft(vmEndpointDraft);
    if (parsed.error) {
      setVMEndpointDraftError(parsed.error);
      return;
    }
    setVMEndpointDraftError('');
    createVMEndpointsMutation.mutate(parsed.items);
  }

  function applyServiceRuntimeScope(service: LogsServiceSummary) {
    if (routeUpdateMode && selectedRoute) {
      loadRouteDraft(selectedRoute, { edit: true });
      return;
    }
    if (routeUpdateMode) return;
    const nonRunningRoute = nonRunningServiceRoute(service);
    if (nonRunningRoute) {
      beginRouteEdit(nonRunningRoute);
      return;
    }
    setRouteEditMode(false);
    setCurrentStep(1);
    setSetupTask('target');
    setSelectedRouteId('');
    setCreatedRoute(null);
    setCollectorConfigYaml('');
    setCollectorFragmentTouched(false);
    setServiceId(service.id);
    setServiceQuery('');
    if (sourceMode === 'k8s' && service.cluster && service.namespace) {
      setClusterId(service.cluster);
      setNamespace(service.namespace);
      setWorkloadKey('');
      setWorkloadQuery('');
    }
  }

  function nonRunningServiceRoute(service: LogsServiceSummary) {
    return serviceRoutesByService.get(service.id)?.find((route) => !isCollectingRoute(route));
  }

  function beginRouteEdit(route: LogRouteView) {
    loadRouteDraft(route, { edit: true });
  }

  function routeMatchesCurrentDraft(route: LogRouteView) {
    const source = route.source;
    if (!source) return false;
    if (route.route.serviceId !== serviceId || route.route.sourceType !== sourceType || source.sourceType !== sourceType) {
      return false;
    }
    const currentEndpointId = effectiveEndpoint?.id ?? endpointId;
    if (route.route.endpointId && currentEndpointId && route.route.endpointId !== currentEndpointId) {
      return false;
    }
    if (sourceType === 'vm_file') {
      return (source.pathPattern ?? '') === vmPath;
    }
    return source.clusterId === clusterId
      && source.namespace === namespace
      && normalizeLogsCollectorNamespace(source.agentNamespace) === runtimeAgentNamespace
      && `${source.workloadKind}/${source.workloadName}` === workloadKey;
  }

  function applyParseDraft() {
    if (!parseDraftValid) return;
    setParserMode(parserDraftMode);
    setParserRuleName(parserDraftRuleName);
    setParserPattern(parserDraftPattern);
    setParseDialogOpen(false);
  }

  function loadRouteDraft(route: LogRouteView, options: { edit?: boolean } = {}) {
    const source = route.source;
    if (!source) return;
    const parserForm = parserFormFromRules(source.parseRules);
    suspendDraftResetRef.current = true;
    setSelectedRouteId(route.route.id);
    setCurrentStep(1);
    setRouteEditMode(Boolean(options.edit));
    setSetupTask('target');
    setSourceMode(source.sourceType === 'vm_file' ? 'vm' : 'k8s');
    setServiceId(route.route.serviceId);
    setEndpointId(route.route.endpointId);
    setCollectorConfigYaml(source.collectorYAML ?? '');
    setCollectorFragmentTouched(Boolean(source.collectorFragmentYAML || source.collectorYAML));
    setParserMode(parserForm.mode);
    setParserRuleName(parserForm.name);
    setParserPattern(parserForm.pattern);
    setPreview(null);
    setCreatedRoute(route);
    setServiceQuery('');
    setEndpointQuery('');
    if (source.sourceType === 'vm_file') {
      setVmPath(source.pathPattern ?? '');
      return;
    }
    setClusterId(source.clusterId ?? '');
    setNamespace(source.namespace ?? '');
    setAgentNamespace(normalizeLogsCollectorNamespace(source.agentNamespace));
    setWorkloadKey(source.workloadKind && source.workloadName ? `${source.workloadKind}/${source.workloadName}` : '');
    setCollectorConfigYaml(source.collectorFragmentYAML ?? '');
    setWorkloadQuery('');
  }

  const hasEndpointForSource = Boolean(effectiveEndpoint);
  const parseValid = parserMode !== 'regex' || parserPattern.includes('?P<');
  const previewRequirements = [
    { key: 'service', label: '选择服务', done: Boolean(serviceId) },
    {
      key: 'endpoint',
      label: sourceType === 'vm_file' ? '选择日志下游端点' : '选择当前集群可用的日志下游端点',
      done: hasEndpointForSource,
    },
    { key: 'parser', label: '修正解析规则', done: parseValid },
    ...(sourceType === 'vm_file'
      ? [
        { key: 'vm-path', label: '填写日志路径', done: Boolean(vmPath) },
      ]
      : [
        { key: 'cluster', label: '选择 K8s 集群', done: Boolean(clusterId) },
        { key: 'observability-access', label: '启用集群观测接入', done: observabilityAccessReady },
        { key: 'namespace', label: '选择 Namespace', done: Boolean(namespace) },
        { key: 'workload', label: '选择 Workload', done: Boolean(selectedWorkload) },
        { key: 'agent-namespace', label: '填写 Agent Namespace', done: Boolean(agentNamespace) },
      ]),
  ];
  const targetMissing = previewRequirements.filter((item) => item.key !== 'parser' && !item.done).map((item) => item.label);
  const previewMissing = previewRequirements.filter((item) => !item.done).map((item) => item.label);
  const canPreview = previewMissing.length === 0;
  const collectorConfigState = !parseValid
    ? '需修正'
    : sourceType === 'vm_file'
      ? collectorConfigYaml.trim() ? '自定义' : '后端生成'
      : fragmentWarnings.length > 0
        ? '手动编辑'
        : '示例片段';
  const parseDraftValid = parserDraftMode !== 'regex' || parserDraftPattern.includes('?P<');
  const selectedServiceLabel = selectedService?.displayName || selectedService?.name || '-';
  const selectedEndpointLabel = effectiveEndpoint ? `${effectiveEndpoint.name} · ${logSinkLabel(effectiveEndpoint.sinkType)}` : '未选择下游端点';
  const selectedScopeLabel = sourceType === 'vm_file'
    ? vmPath || '未填写日志路径'
    : `${selectedCluster?.name || clusterId || restoredSource?.clusterId || '-'} / ${namespace || restoredSource?.namespace || '-'} / ${selectedWorkload ? `${selectedWorkload.kind}/${selectedWorkload.name}` : restoredSource?.workloadName ? `${restoredSource.workloadKind}/${restoredSource.workloadName}` : '-'}`;
  const k8sIncludePath = k8sLogIncludePath(
    namespace || restoredSource?.namespace || '',
    selectedWorkload?.name || restoredSource?.workloadName || '',
  );
  const runtimeTargetBound = sourceType === 'vm_file'
    ? Boolean(serviceId && vmPath)
    : Boolean(serviceId && selectedWorkload);
  const runtimeTargetReady = runtimeTargetBound && observabilityAccessReady;
  useEffect(() => {
    if (!serviceId) {
      setSetupTask('service');
    }
  }, [serviceId]);
  const endpointBlocked = !runtimeTargetReady;
  const endpointDisabledReason = endpointBlocked ? observabilityAccessBlockedReason || '运行目标未绑定时禁用日志下游端点' : '';
  const targetStepReady = runtimeTargetReady && hasEndpointForSource;
  const targetDisabledReason = targetMissing.length ? `当前步骤还需：${formatMissing(targetMissing)}` : '';
  const previewDisabledReason = previewMissing.length ? `预览前还需：${formatMissing(previewMissing)}` : '';
  const saveDisabledReason = preview ? '' : '先完成配置预览';
  const publishDisabledReason = !createdRoute
    ? '先保存路由'
    : preview?.publishBlocked
      ? preview.publishBlockedReason || '当前配置被后端策略阻断'
      : '';
  const lockedDisabledReason = collectingConfigLocked ? '当前采集配置处于查看态，请点击更新配置进入编辑。' : '';
	const serviceSyncDisabledReason = sourceMode !== 'k8s'
    ? 'VM 来源不需要同步 K8s 服务'
    : !syncClusterId
      ? '请选择同步集群'
		: !syncNamespace
		  ? '请选择同步 Namespace'
		  : !syncEnvironmentId
			? '请选择所属环境'
		  : '';
  const actionHint = currentStep === 1
    ? targetDisabledReason
    : currentStep === 2
      ? parseValid ? '' : '请先修正解析规则'
      : collectingConfigLocked
        ? '当前服务已有运行路由，请从采集路由页查看配置或进入更新。'
        : previewMissing.length
          ? previewDisabledReason
          : sourceType === 'vm_file' && !createdRoute
            ? '保存路由后获取安装材料'
            : publishDisabledReason
              ? `发布阻断：${publishDisabledReason}`
            : '';
  const activeTaskLabel = currentStep === 1
    ? setupTask === 'service' ? '选择服务' : setupTask === 'target' ? sourceType === 'vm_file' ? '设置日志路径' : '绑定运行目标' : '选择下游端点'
    : currentStep === 2 ? '业务采集配置' : '配置预览';
  const sourceModeLabel = sourceMode === 'k8s' ? 'K8s' : 'VM';
  const summaryImpactLabel = sourceType === 'vm_file'
    ? vmPath || 'VM 日志路径'
    : `${selectedCluster?.name || clusterId || '-'} / ${namespace || '-'} / ${selectedWorkload?.name || restoredSource?.workloadName || '-'}`;
  const summaryAuditLabel = createdRoute?.route.lastAuditId || selectedRoute?.route.lastAuditId || '-';
  const previewPrimaryConfigYAML = preview?.serviceConfigYAML || (sourceType === 'vm_file'
    ? preview?.collectorYAML ?? ''
    : preview?.source.collectorFragmentYAML || collectorConfigYaml);
  const previewPrimaryConfigMeta = preview?.serviceConfigPath
    ? [preview.serviceConfigPath, preview.serviceConfigMapName].filter(Boolean).join(' · ')
    : sourceType === 'vm_file'
      ? '安装脚本写入每台 VM 的 Collector 配置'
      : '发布后写入当前服务独立 ConfigMap';

  const sourceModeSwitch = (
    <div className="logs-source-mode-switch inline-flex rounded-md border border-outline bg-surface-lowest p-0.5" aria-label="采集来源">
      {sourceTabs.map((item) => (
        <button
          key={item.value}
          className={`h-8 rounded px-3 text-xs font-semibold transition-colors ${
            sourceMode === item.value ? 'bg-primary text-white' : 'text-muted hover:bg-primary-soft/60 hover:text-primary'
          } disabled:cursor-not-allowed disabled:opacity-60`}
          disabled={routeUpdateMode}
          title={routeUpdateMode ? '运行路由更新时来源由当前路由决定' : undefined}
          onClick={() => {
            if (routeUpdateMode) return;
            setSourceMode(item.value);
            setCurrentStep(1);
            setSetupTask('service');
            setSyncDialogOpen(false);
            setCollectorConfigYaml('');
            setCollectorFragmentTouched(false);
            setServiceQuery('');
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  const serviceSyncAction = sourceMode === 'k8s' ? (
    <button
      className="logs-service-sync-trigger console-button h-9 text-primary"
      disabled={routeUpdateMode || writableClusters.length === 0}
      title={routeUpdateMode ? '运行路由更新时不触发服务同步' : writableClusters.length === 0 ? '暂无可同步集群' : '选择集群和 Namespace 后同步服务'}
      onClick={() => setSyncDialogOpen(true)}
    >
      <RefreshCw className="h-3.5 w-3.5" />
      同步服务
    </button>
  ) : null;

  const routeActions = (
    <>
      {currentStep > 1 ? (
        <button
          className="console-button h-9 w-full"
          onClick={() => {
            if (currentStep === 3) {
              setCurrentStep(2);
              return;
            }
            setCurrentStep(1);
            setSetupTask(runtimeTargetReady ? 'endpoint' : serviceId ? 'target' : 'service');
          }}
        >
          上一步
        </button>
      ) : null}
      {currentStep === 1 ? (
        <button className="console-button console-button-primary h-9 w-full" disabled={!targetStepReady} onClick={() => setCurrentStep(2)} title={targetStepReady ? '进入采集配置' : targetDisabledReason}>
          下一步：采集配置
        </button>
      ) : currentStep === 2 ? (
        <button className="console-button console-button-primary h-9 w-full" disabled={collectingConfigLocked || !canPreview || previewMutation.isPending} onClick={() => previewMutation.mutate()} title={lockedDisabledReason || previewDisabledReason || '生成路由配置预览'}>
          {previewMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          生成预览
        </button>
      ) : (
        <>
          <button className="console-button h-9 w-full" disabled={collectingConfigLocked || !canPreview || previewMutation.isPending} onClick={() => previewMutation.mutate()} title={lockedDisabledReason || previewDisabledReason || '重新生成路由配置预览'}>
            {previewMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            重新预览
          </button>
          <button className="console-button h-9 w-full border-primary text-primary" disabled={collectingConfigLocked || !preview || createRouteMutation.isPending} onClick={() => createRouteMutation.mutate()} title={lockedDisabledReason || saveDisabledReason || (selectedRouteId ? '更新日志路由' : '保存日志路由')}>
            {createRouteMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {selectedRouteId ? '更新路由' : '保存草稿'}
          </button>
          {sourceType === 'vm_file' ? (
            <div className="rounded border border-outline bg-surface px-2.5 py-2 text-xs leading-5 text-muted">
              {createdRoute ? '路由已保存，可在预览区获取手工安装材料并登记 VM 节点。' : '保存路由后获取手工安装材料。'}
            </div>
          ) : (
            <Link
              className={`console-button console-button-primary h-9 w-full ${!createdRoute ? 'pointer-events-none opacity-60' : ''}`}
              to={observabilityAccessURL}
              aria-disabled={!createdRoute}
              title={createdRoute ? '前往 K8s 观测接入预览并部署 logs_collector 运行时配置' : '先保存路由'}
            >
              <Play className="h-4 w-4" />
              前往观测接入
            </Link>
          )}
        </>
      )}
    </>
  );

  if (error) {
    return (
      <div className="logs-task-page space-y-3">
        <LogsTaskPageHeader
          title={routeUpdateMode ? '更新采集路由' : '创建采集路由'}
        />
        <DataPanel title="采集路由加载失败">
          <ErrorInline message={(error as Error).message} onRetry={() => refetch()} />
        </DataPanel>
      </div>
    );
  }

  return (
    <div className="logs-task-page flex h-full min-h-[720px] min-w-0 flex-col overflow-hidden">
      <LogsTaskPageHeader
        title={routeUpdateMode ? '更新采集路由' : '创建采集路由'}
        context={sourceModeSwitch}
        action={(
          <>
            <button
              className="console-button h-8"
              disabled={collectingConfigLocked || !preview || createRouteMutation.isPending}
              title={lockedDisabledReason || saveDisabledReason || '保存日志路由草稿'}
              onClick={() => createRouteMutation.mutate()}
            >
              <Save className="h-3.5 w-3.5" />
              保存草稿
            </button>
			<Link className="console-button h-8" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(pathServiceId)}/logs/agents`}>退出</Link>
          </>
        )}
      />
      <div className="logs-route-canvas mt-3 grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)_340px] 2xl:grid-cols-[240px_minmax(0,1fr)_380px]">
        <RouteCanvasStepper
          currentStep={currentStep}
          setupTask={setupTask}
          serviceDone={Boolean(serviceId)}
          targetDone={runtimeTargetReady}
          endpointDone={targetStepReady}
          serviceSummary={selectedService ? selectedServiceLabel : '选择后绑定运行目标'}
          targetSummary={runtimeTargetReady ? selectedScopeLabel : serviceId ? '等待绑定运行范围' : '先选择服务'}
          endpointSummary={selectedEndpointLabel}
          onSelectService={() => {
            setCurrentStep(1);
            setSetupTask('service');
          }}
          onSelectTarget={() => {
            setCurrentStep(1);
            setSetupTask('target');
          }}
          onSelectEndpoint={() => {
            if (!runtimeTargetReady) return;
            setCurrentStep(1);
            setSetupTask('endpoint');
          }}
        />
        <div className="logs-route-task-stack flex min-h-0 min-w-0 flex-col overflow-hidden" aria-label="采集路由步骤">
          {routeUpdateMissing ? <WarnLine message="未找到待更新的采集路由，请从采集路由页重新进入。" /> : null}
          <RouteTaskCard
            className="logs-route-service-card"
            index={1}
            title="选择服务"
            summary={selectedService ? selectedServiceLabel : '选择服务后绑定运行目标'}
            active={currentStep === 1 && setupTask === 'service'}
            done={Boolean(serviceId)}
            onSelect={() => {
              setCurrentStep(1);
              setSetupTask('service');
            }}
          >
            <div className="logs-runtime-configuration-panel overflow-hidden rounded-lg border border-outline bg-surface-lowest">
              <ServicePickerPanel
                services={filteredServices}
                selectedServiceId={serviceId}
                serviceQuery={serviceQuery}
                routeEditMode={routeEditMode}
                locked={routeUpdateMode}
                serviceRoutesByService={serviceRoutesByService}
                toolbarAction={serviceSyncAction}
                emptyAction={serviceSyncAction}
                syncMessage={syncK8sServicesMutation.data ? `已同步 ${syncK8sServicesMutation.data.total} 个服务，请在列表选择接入对象。` : null}
                onServiceQueryChange={setServiceQuery}
                onSelectService={applyServiceRuntimeScope}
                onEditRoute={beginRouteEdit}
              />
              <MutationErrors errors={[syncK8sServicesMutation.error]} />
            </div>
          </RouteTaskCard>

          <RouteTaskCard
            className="logs-route-target-card"
            index={2}
            title={sourceType === 'vm_file' ? '设置日志路径' : '绑定运行目标'}
            summary={runtimeTargetReady ? selectedScopeLabel : serviceId ? '等待绑定运行范围' : '先选择服务'}
            active={currentStep === 1 && setupTask === 'target'}
            done={runtimeTargetReady}
            disabled={!serviceId}
            disabledReason="先选择服务"
            onSelect={() => {
              setCurrentStep(1);
              setSetupTask('target');
            }}
          >
            <div className="relative p-3">
                {sourceType === 'vm_file' ? (
                  <div className="max-w-2xl">
                    <label className="text-sm font-semibold">日志路径<input className="console-input mt-2 w-full font-mono" value={vmPath} onChange={(event) => setVmPath(event.target.value)} placeholder="/data/logs/*.log" /></label>
                    <p className="mt-2 text-xs leading-5 text-muted">平台不会登录或修改 VM。保存路由后，由运维人员在每台机器执行安装脚本，再回填 Agent 健康检查地址。</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {observabilityAccessBlockedReason ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-700 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{observabilityAccessBlockedReason}</span>
                        </div>
                        <Link className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100" to={observabilityAccessURL}>
                          前往观测接入
                        </Link>
                      </div>
                    ) : logsCollectorRuntimeStatus?.ready ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary-soft px-3 py-2 text-sm text-primary lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <CheckCircle className="h-4 w-4 shrink-0" />
                          <span>集群 logs_collector 基础组件已就绪，路由会生成当前服务独立 ConfigMap，并由 DaemonSet 按文件集合加载。</span>
                        </div>
                      </div>
                    ) : null}
                    <aside className="logs-k8s-cluster-picker rounded-lg border border-primary/20 bg-primary-soft/30 p-3 shadow-[0_10px_28px_rgba(13,91,215,0.08)]">
                      <div className="mb-3 text-sm font-semibold text-on-surface">选择 K8s 集群</div>
                      <div className="space-y-2">
                        {writableClusters.length === 0 ? <Empty label="暂无可发布集群" /> : writableClusters.map((cluster) => (
                          <button
                            key={cluster.id}
                            className={`logs-k8s-cluster-card group relative w-full overflow-hidden rounded-lg border px-3 py-3 text-left transition-all active:translate-y-px ${
                              cluster.id === clusterId
                                ? 'border-primary bg-white text-on-surface shadow-[0_14px_30px_rgba(13,91,215,0.16),inset_4px_0_0_rgba(13,91,215,0.88)]'
                                : 'border-outline/80 bg-white/78 text-on-surface shadow-[0_8px_20px_rgba(18,32,51,0.05)] hover:border-primary/35 hover:bg-white hover:shadow-[0_12px_26px_rgba(13,91,215,0.10)]'
                            }`}
                            aria-pressed={cluster.id === clusterId}
                            onClick={() => { setClusterId(cluster.id); setNamespace(''); setWorkloadKey(''); setWorkloadQuery(''); }}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                cluster.id === clusterId ? 'border-primary/20 bg-primary-soft text-primary' : 'border-outline bg-surface-lowest text-muted group-hover:text-primary'
                              }`}>
                                {cluster.id === clusterId ? <CheckCircle className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block min-w-0 truncate text-[13px] font-semibold text-on-surface">{cluster.name || cluster.id}</span>
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                  <div className="rounded-md border border-outline/70 bg-surface-lowest/80 px-2 py-1">
                                    <div className="text-[10px] font-semibold text-muted">版本</div>
                                    <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-on-surface">{cluster.version || '-'}</div>
                                  </div>
                                  <div className="rounded-md border border-outline/70 bg-surface-lowest/80 px-2 py-1">
                                    <div className="text-[10px] font-semibold text-muted">模式</div>
                                    <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-on-surface">{cluster.accessMode || '-'}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                    </aside>

                    <div className="min-w-0 space-y-3">
                      <div className="rounded-lg border border-outline bg-white/70 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-on-surface">资源浏览器</div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-lg bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{displayedWorkloads.length}/{displayedWorkloadTotal} workloads</span>
                            <button className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-semibold text-primary transition-all active:translate-y-px disabled:opacity-60" disabled={workloadsQuery.isLoading || !clusterId || !namespace} onClick={() => workloadsQuery.refetch()}>
                              {workloadsQuery.isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              刷新
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[180px_minmax(180px,1fr)] xl:grid-cols-[190px_minmax(200px,1fr)_170px] xl:items-end">
                          <label className="text-xs font-semibold text-muted">
                            Namespace
                            <select className="console-input mt-1.5 h-8 w-full text-xs" value={namespace} onChange={(event) => { setNamespace(event.target.value); setWorkloadKey(''); setWorkloadQuery(''); }} disabled={namespacesQuery.isLoading}>
                              <option value="">选择 Namespace</option>
                              {namespaceOptions.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-semibold text-muted">
                            搜索 Workload
                            <div className="relative mt-1.5">
                              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                              <input className="console-input h-8 w-full pl-8 text-xs" value={workloadQuery} onChange={(event) => setWorkloadQuery(event.target.value)} placeholder="kind / name / selector" />
                            </div>
                          </label>
                          <label className="text-xs font-semibold text-muted">
                            Agent Namespace
                            <input className="console-input mt-1.5 h-8 w-full text-xs" value={agentNamespace} onChange={(event) => setAgentNamespace(event.target.value)} />
                          </label>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-outline bg-white/70">
                        {displayedWorkloads.length === 0 ? <div className="px-3"><Empty label={workloadsQuery.isLoading ? '正在加载 Workload' : '暂无匹配 Workload'} /></div> : (
                          <div className="overflow-auto">
                            <table className="console-table min-w-[680px] w-full">
                              <thead>
                                <tr>
                                  <th>Workload</th>
                                  <th>类型</th>
                                  <th>Pods</th>
                                  <th>Selector</th>
                                  <th>接入状态</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayedWorkloads.map((item) => {
                                  const identity = workloadIdentity(item);
                                  const checked = workloadKey === identity;
                                  const selectorText = Object.entries(item.selector ?? {}).map(([key, value]) => `${key}=${value}`).join(', ') || '-';
                                  return (
                                    <tr
                                      key={identity}
                                      className={`cursor-pointer transition-colors ${checked ? 'bg-primary-soft/70 text-primary shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : 'hover:bg-surface-low/70'}`}
                                      onClick={() => {
                                        setWorkloadKey(identity);
                                        setSetupTask('endpoint');
                                      }}
                                    >
                                      <td className="font-semibold">{item.name}</td>
                                      <td>{item.kind}</td>
                                      <td className="font-mono text-xs">{item.podsRunning} / {item.podsTotal}</td>
                                      <td className="max-w-[280px] truncate font-mono text-xs text-muted">{selectorText}</td>
                                      <td>
                                        <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${checked ? 'bg-primary-soft text-primary' : 'bg-white/70 text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]'}`}>
                                          {checked ? '已选择' : '可选择'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 rounded-lg border border-outline bg-white/70 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-muted">当前范围</div>
                          <div className="mt-1 break-all font-mono text-sm font-semibold text-on-surface">
                            {selectedCluster?.name || clusterId || '-'} / {namespace || '-'} / {selectedWorkload ? `${selectedWorkload.kind}/${selectedWorkload.name}` : '-'}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          <span className="rounded-lg bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{clusterRouteNamespaces.length} ns · {clusterRouteWorkloads} workloads</span>
                          <span className="rounded-lg bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{k8sIncludePath}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {collectingConfigLocked ? (
                  <RunningConfigVeil />
                ) : null}
              </div>
          </RouteTaskCard>

          <RouteTaskCard
            className="logs-route-endpoint-card logs-endpoint-picker"
            index={3}
            title="选择下游端点"
            summary={selectedEndpointLabel}
            active={currentStep === 1 && setupTask === 'endpoint'}
            done={runtimeTargetReady && hasEndpointForSource}
            disabled={endpointBlocked}
            disabledReason={endpointDisabledReason || '先绑定运行目标'}
            onSelect={() => {
              setCurrentStep(1);
              setSetupTask('endpoint');
            }}
          >
            <div className="relative space-y-3 p-3">
              {endpointDisabledReason ? <WarnLine message={endpointDisabledReason} /> : null}
              <div className="flex justify-end">
                <Link
                  className="inline-flex h-7 w-fit items-center justify-center gap-1.5 rounded-md border border-outline bg-white px-2.5 text-[11px] font-semibold text-primary transition-all hover:bg-primary-soft active:translate-y-px"
				  to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(pathServiceId)}/logs/endpoints`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  管理端点
                </Link>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input className="console-input h-9 w-full pl-8 text-sm disabled:cursor-not-allowed" value={endpointQuery} onChange={(event) => setEndpointQuery(event.target.value)} placeholder="搜索端点 / URL / 集群" disabled={endpointBlocked} />
              </div>
              <div className="overflow-hidden rounded-lg border border-outline bg-white">
                {filteredEndpoints.length === 0 ? <div className="px-3"><Empty label="暂无匹配端点" /></div> : (
                  <div className="overflow-auto">
                    <table className="console-table min-w-[700px] w-full">
                      <thead>
                        <tr>
                          <th>端点</th>
                          <th>类型</th>
                          <th>作用域</th>
                          <th>写入地址</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEndpoints.map((endpoint) => {
                          const selected = endpoint.id === effectiveEndpoint?.id;
                          return (
                            <tr
                              key={endpoint.id}
                              className={`transition-colors ${endpointBlocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${selected ? 'bg-primary-soft/70 text-primary shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : endpointBlocked ? '' : 'hover:bg-surface-low/70'}`}
                              onClick={() => {
                                if (endpointBlocked) return;
                                setEndpointId(endpoint.id);
                              }}
                            >
                              <td className="font-semibold">{endpoint.name}</td>
                              <td>{logSinkLabel(endpoint.sinkType)}</td>
                              <td className="font-mono text-xs text-muted">{endpoint.scopeType}{endpoint.clusterId ? ` · ${endpoint.clusterId}` : ''}</td>
                              <td className="max-w-[280px] truncate font-mono text-xs text-muted">{endpoint.writeURL || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {collectingConfigLocked ? (
                <RunningConfigVeil />
              ) : null}
            </div>
          </RouteTaskCard>

          <RouteTaskCard
            className="logs-route-config-card"
            index={4}
            title="业务采集配置"
            summary={`${collectorConfigState} · ${sourceType === 'vm_file' ? 'vm route config' : 'service config fragment'}`}
            active={currentStep === 2}
            done={Boolean(preview)}
            disabled={!targetStepReady}
            disabledReason={targetDisabledReason || '先完成目标与端点'}
            bodyClassName="min-h-0 flex-1 overflow-hidden bg-surface/35"
            onSelect={() => {
              if (!targetStepReady) return;
              setCurrentStep(2);
            }}
          >
          {sourceType === 'vm_file' ? (
            <div className="flex h-full min-h-[260px] flex-col justify-between gap-4 p-4">
              <div>
                <div className="text-sm font-semibold text-on-surface">解析规则</div>
                <p className="mt-1 text-xs leading-5 text-muted">采集配置由平台根据日志路径、解析规则和下游端点生成，保存后作为手工安装材料提供。</p>
                <dl className="mt-4 grid gap-3 rounded border border-outline bg-white p-3 text-xs sm:grid-cols-2">
                  <div><dt className="font-semibold text-muted">日志路径</dt><dd className="mt-1 break-all font-mono text-on-surface">{vmPath || '-'}</dd></div>
                  <div><dt className="font-semibold text-muted">解析方式</dt><dd className="mt-1 text-on-surface">{parserMode === 'none' ? '不解析' : parserMode === 'json' ? 'JSON' : 'Regex'}</dd></div>
                </dl>
              </div>
              <button className="inline-flex h-8 w-fit items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-semibold text-primary transition-all active:translate-y-px" onClick={openParseDialog}>
                <Settings2 className="h-3.5 w-3.5" />
                配置解析规则
              </button>
            </div>
          ) : (
          <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-outline bg-surface-lowest">
              <div className="flex flex-col gap-2 border-b border-outline bg-white/72 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-on-surface">服务 ConfigMap 片段</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">发布后写入当前服务独立 ConfigMap，并由 DaemonSet 按文件集合加载</div>
                </div>
                <button
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-semibold text-primary transition-all active:translate-y-px disabled:opacity-60"
                    disabled={!generatedK8sFragment}
                    onClick={() => {
                      setCollectorConfigYaml(generatedK8sFragment);
                      setCollectorFragmentTouched(false);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重新生成示例
                </button>
              </div>
              <textarea
                className={`logs-route-config-editor min-h-0 flex-1 resize-none overflow-auto border-0 bg-white p-3 font-mono text-[12px] leading-5 text-on-surface outline-none ${fragmentWarnings.length > 0 ? 'shadow-[inset_4px_0_0_rgba(180,35,47,0.72)]' : ''}`}
                value={collectorConfigYaml}
                onChange={(event) => {
                  setCollectorConfigYaml(event.target.value);
                  setCollectorFragmentTouched(true);
                }}
                placeholder="选择服务、Workload 和端点后生成服务 ConfigMap 片段示例。"
                spellCheck={false}
              />
            </div>
            <aside className="space-y-3">
              <div className="rounded-lg border border-outline bg-white px-3 py-3">
                <div className="text-xs font-semibold text-muted">编辑状态</div>
                <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{collectorConfigState}</div>
                <div className="mt-2 text-xs leading-5 text-muted">
                  表单只负责生成初稿；发布以编辑器内容为准。
                </div>
              </div>
              <div className={`rounded-lg border px-3 py-3 ${fragmentWarnings.length > 0 ? 'border-danger/30 bg-red-50 text-danger' : 'border-primary/20 bg-primary-soft text-primary'}`}>
                  <div className="text-xs font-semibold">{fragmentWarnings.length > 0 ? '表单占位已变更' : '表单占位一致'}</div>
                  <div className="mt-2 space-y-1 text-xs leading-5">
                    {fragmentWarnings.length > 0
                      ? fragmentWarnings.map((item) => <div key={item}>{item}</div>)
                      : <div>当前片段仍包含服务、Workload、日志路径和下游端点生成值。</div>}
                  </div>
              </div>
              <button className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-semibold text-primary transition-all active:translate-y-px" onClick={openParseDialog}>
                <Settings2 className="h-3.5 w-3.5" />
                表单生成解析片段
              </button>
            </aside>
          </div>
          )}
          </RouteTaskCard>

          <RouteTaskCard
            className="logs-route-preview-card"
            index={5}
            title="配置预览"
            summary={preview ? '已预览' : '等待预览'}
            active={currentStep === 3}
            done={Boolean(createdRoute)}
            disabled={!preview}
            disabledReason="先生成路由配置预览"
            onSelect={() => {
              if (!preview) return;
              setCurrentStep(3);
            }}
          >
          <div className="relative min-h-[260px]">
          <div className="mb-3 flex flex-col gap-3 rounded-lg border border-outline bg-surface-lowest px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                collectorConfigState === '自定义' || collectorConfigState === '后端生成'
                  ? 'border-primary/20 bg-primary-soft text-primary'
                  : collectorConfigState === '需修正'
                    ? 'border-warning/30 bg-amber-50 text-warning'
                    : 'border-outline bg-white text-muted'
              }`}>
                {collectorConfigState}
              </span>
              <span className="font-mono text-xs text-muted">route draft</span>
            </div>
            <button className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-semibold text-primary transition-all active:translate-y-px" onClick={openParseDialog}>
              <Settings2 className="h-3.5 w-3.5" />
              解析规则
            </button>
          </div>
          {!parseValid ? <WarnLine message="Regex 需要使用命名捕获组，例如 (?P<level>INFO)。" /> : null}
          <MutationErrors errors={[previewMutation.error, createRouteMutation.error]} />
          {preview?.publishBlocked ? <WarnLine message={preview.publishBlockedReason} /> : null}
          {preview?.warnings.map((item) => <WarnLine key={item} message={item} />)}
          {preview ? (
            <div className="logs-route-preview-code-grid mt-3 grid gap-3 2xl:grid-cols-2">
              <RoutePreviewCodePanel
                title={sourceType === 'vm_file' ? 'VM 路由配置文件' : '当前服务 ConfigMap 片段'}
                meta={previewPrimaryConfigMeta}
                content={previewPrimaryConfigYAML}
                emptyLabel={sourceType === 'vm_file' ? 'VM 路由配置为空' : '服务 ConfigMap 片段为空'}
                copyTitle="复制 YAML"
              />
              {sourceType !== 'vm_file' ? (
                <RoutePreviewCodePanel
                  title="采集域合并视图"
                  meta="只读校验视图，发布时按多 ConfigMap 文件集合加载"
                  content={preview.collectorYAML}
                  emptyLabel="采集域合并视图为空"
                  copyTitle="复制 YAML"
                />
              ) : null}
            </div>
          ) : <Empty label="配置预览为空" />}
          {sourceType === 'vm_file' && vmRouteId ? (
            <VMManualInstallationPanel
              installation={vmInstallationQuery.data ?? null}
              installationLoading={vmInstallationQuery.isLoading}
              installationError={vmInstallationQuery.error}
              endpoints={vmAgentEndpointsQuery.data ?? []}
              endpointsLoading={vmAgentEndpointsQuery.isLoading}
              endpointsError={vmAgentEndpointsQuery.error}
              draft={vmEndpointDraft}
              draftError={vmEndpointDraftError}
              mutationErrors={[createVMEndpointsMutation.error, probeVMEndpointMutation.error, deleteVMEndpointMutation.error]}
              adding={createVMEndpointsMutation.isPending}
              probingId={probeVMEndpointMutation.isPending ? probeVMEndpointMutation.variables : ''}
              deletingId={deleteVMEndpointMutation.isPending ? deleteVMEndpointMutation.variables : ''}
              onDraftChange={(value) => {
                setVMEndpointDraft(value);
                setVMEndpointDraftError('');
              }}
              onAdd={submitVMEndpointDraft}
              onProbe={(endpointId) => probeVMEndpointMutation.mutate(endpointId)}
              onDelete={(endpoint) => {
                if (window.confirm(`确认删除 VM 节点“${endpoint.name || endpoint.address}”？`)) {
                  deleteVMEndpointMutation.mutate(endpoint.id);
                }
              }}
            />
          ) : null}
          {collectingConfigLocked ? (
            <RunningConfigVeil />
          ) : null}
          </div>
          </RouteTaskCard>

        </div>
        <RouteTaskSummaryCard
          taskLabel={activeTaskLabel}
          sourceLabel={sourceModeLabel}
          serviceLabel={selectedServiceLabel}
          scopeLabel={selectedScopeLabel}
          endpointLabel={selectedEndpointLabel}
          configLabel={collectorConfigState}
          impactLabel={summaryImpactLabel}
          auditLabel={summaryAuditLabel}
          actionHint={actionHint}
          warning={Boolean(actionHint && (targetDisabledReason || previewMissing.length || publishDisabledReason || lockedDisabledReason))}
          actions={routeActions}
        />
      </div>

      <SyncK8sServicesDialog
        open={syncDialogOpen}
        clusters={writableClusters}
        namespaceOptions={syncNamespaceOptions}
        namespacesLoading={syncNamespacesQuery.isLoading}
        clusterId={syncClusterId}
        namespace={syncNamespace}
		environments={platformEnvironments}
		environmentId={syncEnvironmentId}
        disabledReason={serviceSyncDisabledReason}
        pending={syncK8sServicesMutation.isPending}
        error={syncK8sServicesMutation.error}
        onClusterChange={(value) => {
          setSyncClusterId(value);
          setSyncNamespace('');
        }}
        onNamespaceChange={setSyncNamespace}
		onEnvironmentChange={setSyncEnvironmentId}
        onClose={() => {
          if (!syncK8sServicesMutation.isPending) setSyncDialogOpen(false);
        }}
        onConfirm={() => syncK8sServicesMutation.mutate()}
      />

      <LogsParseRuleDialog
        open={parseDialogOpen}
        serviceLabel={selectedServiceLabel}
        scopeLabel={selectedScopeLabel}
        parseSample={parseSample}
        parserDraftMode={parserDraftMode}
        parserDraftRuleName={parserDraftRuleName}
        parserDraftPattern={parserDraftPattern}
        parseDraftValid={parseDraftValid}
        parsePreviewMutation={parsePreviewMutation}
        onParseSampleChange={setParseSample}
        onParserDraftModeChange={setParserDraftMode}
        onParserDraftRuleNameChange={setParserDraftRuleName}
        onParserDraftPatternChange={setParserDraftPattern}
        onClose={() => setParseDialogOpen(false)}
        onApply={applyParseDraft}
      />
    </div>
  );
}

function workloadIdentity(item: LogsWorkload) {
  return `${item.kind}/${item.name}`;
}

function workloadFromRouteSource(source: LogSource | null): LogsWorkload | null {
  if (!source || source.sourceType !== 'k8s_stdout' || !source.workloadKind || !source.workloadName) return null;
  return {
    clusterId: source.clusterId,
    namespace: source.namespace,
    groupKey: source.workloadKind,
    groupName: source.workloadKind,
    key: `${source.workloadKind}/${source.workloadName}`,
    name: source.workloadName,
    kind: source.workloadKind,
    selector: {},
    templateLabels: {},
    serviceAccounts: [],
    podsTotal: 0,
    podsRunning: 0,
    restartCount: 0,
  };
}

export function parseVMEndpointDraft(text: string): { items: Array<{ name: string; address: string }>; error: string } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { items: [], error: '请至少填写一个 VM 节点地址' };
  const items: Array<{ name: string; address: string }> = [];
  for (const [index, line] of lines.entries()) {
    const parts = line.split(',').map((part) => part.trim());
    if (parts.length > 2 || parts.some((part) => !part)) {
      return { items: [], error: `第 ${index + 1} 行格式错误，请使用“名称,host:port”或仅填写 host:port` };
    }
    const address = parts.length === 2 ? parts[1] : parts[0];
    if (!/^(?:\[[^\]]+\]|[^:\s]+):\d+$/.test(address)) {
      return { items: [], error: `第 ${index + 1} 行地址格式错误，请填写 host:port` };
    }
    items.push({ name: parts.length === 2 ? parts[0] : address, address });
  }
  return { items, error: '' };
}

function VMManualInstallationPanel({
  installation,
  installationLoading,
  installationError,
  endpoints,
  endpointsLoading,
  endpointsError,
  draft,
  draftError,
  mutationErrors,
  adding,
  probingId,
  deletingId,
  onDraftChange,
  onAdd,
  onProbe,
  onDelete,
}: {
  installation: VMInstallation | null;
  installationLoading: boolean;
  installationError: unknown;
  endpoints: VMAgentEndpoint[];
  endpointsLoading: boolean;
  endpointsError: unknown;
  draft: string;
  draftError: string;
  mutationErrors: unknown[];
  adding: boolean;
  probingId?: string;
  deletingId?: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onProbe: (endpointId: string) => void;
  onDelete: (endpoint: VMAgentEndpoint) => void;
}) {
  return (
    <section className="mt-4 space-y-4 border-t border-outline pt-4" aria-label="VM 手工接入">
      <div>
        <h3 className="text-sm font-semibold text-on-surface">手工安装</h3>
        <p className="mt-1 text-xs leading-5 text-muted">在每台 VM 上执行同一服务的安装脚本。平台只生成材料并校验回填地址，不会远程登录机器。</p>
      </div>
      {installationLoading ? <div className="h-32 animate-pulse rounded border border-outline bg-surface" /> : installationError ? (
        <LogsErrorLine message={(installationError as Error).message || '安装材料加载失败'} />
      ) : installation ? (
        <>
          {installation.prerequisites.length ? (
            <div className="rounded border border-outline bg-surface px-3 py-2 text-xs leading-5 text-muted">执行前确认：{installation.prerequisites.join('；')}</div>
          ) : null}
          <div className="grid gap-3 2xl:grid-cols-2">
            <CompactCopyPanel title="安装脚本" meta={installation.collectorConfigHash || installation.routeId} content={installation.installScript} copyTitle="复制安装脚本" />
            <CompactCopyPanel title="Collector 配置" meta="平台生成，只读" content={installation.collectorYAML} copyTitle="复制 Collector 配置" />
          </div>
        </>
      ) : null}

      <div className="border-t border-outline pt-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">VM 节点</h3>
            <p className="mt-1 text-xs leading-5 text-muted">地址可达不代表采集中；这里只校验 Agent 健康检查地址的网络连通性。</p>
          </div>
          {installation?.healthAddressExample ? <span className="font-mono text-[11px] text-muted">示例 {installation.healthAddressExample}</span> : null}
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="text-xs font-semibold text-muted">
            批量录入
            <textarea className="console-input mt-1.5 min-h-20 w-full resize-y font-mono text-xs" value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder={'名称,host:port\n10.0.0.9:13133'} />
          </label>
          <button className="console-button console-button-primary h-9" disabled={adding || !draft.trim()} onClick={onAdd}>
            {adding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}登记节点
          </button>
        </div>
        {draftError ? <div className="mt-2 text-xs font-semibold text-danger">{draftError}</div> : null}
        <MutationErrors errors={mutationErrors} />
        <div className="mt-3 overflow-hidden rounded border border-outline bg-white">
          {endpointsLoading ? <div className="h-24 animate-pulse bg-surface" /> : endpointsError ? (
            <div className="p-3"><LogsErrorLine message={(endpointsError as Error).message || 'VM 节点加载失败'} /></div>
          ) : endpoints.length === 0 ? <Empty label="尚未登记 VM 节点" /> : (
            <div className="overflow-x-auto">
              <table className="console-table min-w-[760px] w-full">
                <thead><tr><th>节点</th><th>健康检查地址</th><th>连通状态</th><th>最近校验</th><th>结果</th><th className="w-24">操作</th></tr></thead>
                <tbody>{endpoints.map((endpoint) => {
                  const status = vmEndpointStatus(endpoint);
                  return <tr key={endpoint.id}>
                    <td className="font-semibold">{endpoint.name || '-'}</td>
                    <td className="font-mono text-xs">{endpoint.address}</td>
                    <td><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status.className}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status.label}</span></td>
                    <td className="font-mono text-[11px] text-muted">{formatVMProbeTime(endpoint.lastProbeAt)}</td>
                    <td className="max-w-[260px] truncate text-xs text-muted" title={endpoint.lastProbeMessage}>{endpoint.lastProbeMessage || (endpoint.lastProbeLatencyMs ? `${endpoint.lastProbeLatencyMs} ms` : '-')}</td>
                    <td><div className="flex items-center gap-1">
                      <button className="console-button h-7 px-2 text-xs" disabled={probingId === endpoint.id} onClick={() => onProbe(endpoint.id)} title="校验地址连通性">{probingId === endpoint.id ? '校验中' : '校验'}</button>
                      <button className="console-button h-7 px-2 text-xs text-danger" disabled={deletingId === endpoint.id} onClick={() => onDelete(endpoint)} title="删除节点">删除</button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CompactCopyPanel({ title, meta, content, copyTitle }: { title: string; meta: string; content: string; copyTitle: string }) {
  return <section className="overflow-hidden rounded border border-outline bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-outline bg-surface px-3 py-2">
      <div className="min-w-0"><div className="text-xs font-semibold">{title}</div><div className="mt-0.5 truncate font-mono text-[11px] text-muted">{meta}</div></div>
      <button className="console-icon-button" onClick={() => navigator.clipboard?.writeText(content)} aria-label={copyTitle} title={copyTitle}><Copy className="h-4 w-4" /></button>
    </div>
    <pre className="max-h-64 min-h-32 overflow-auto p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">{content || '暂无内容'}</pre>
  </section>;
}

function vmEndpointStatus(endpoint: VMAgentEndpoint) {
  const value = (endpoint.lastProbeStatus || endpoint.status).toLowerCase();
  if (['reachable', 'healthy', 'success', 'ok'].includes(value)) return { label: '可达', className: 'text-emerald-700' };
  if (['unreachable', 'failed', 'failure', 'error'].includes(value)) return { label: '不可达', className: 'text-danger' };
  return { label: '待校验', className: 'text-muted' };
}

function formatVMProbeTime(value: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('zh-CN', { hour12: false });
}

function RunningConfigVeil() {
  return (
    <div className="running-config-veil pointer-events-auto absolute inset-0 z-20 cursor-not-allowed rounded-lg bg-slate-100/45 shadow-[inset_0_0_0_1px_rgba(99,112,131,0.16)] backdrop-grayscale" />
  );
}

function SyncK8sServicesDialog({
  open,
  clusters,
  namespaceOptions,
  namespacesLoading,
  clusterId,
  namespace,
	environments,
	environmentId,
  disabledReason,
  pending,
  error,
  onClusterChange,
  onNamespaceChange,
	onEnvironmentChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  clusters: Array<{ id: string; name: string }>;
  namespaceOptions: Array<{ id: string; name: string }>;
  namespacesLoading: boolean;
  clusterId: string;
  namespace: string;
	environments: Array<{ id: string; name: string; stage: string }>;
	environmentId: string;
  disabledReason: string;
  pending: boolean;
  error: unknown;
  onClusterChange: (value: string) => void;
  onNamespaceChange: (value: string) => void;
	onEnvironmentChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/32 px-4 py-6">
      <div className="logs-service-sync-dialog flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-outline bg-white shadow-[0_24px_80px_rgba(24,52,96,0.28)]" role="dialog" aria-modal="true" aria-labelledby="logs-service-sync-title">
        <div className="flex shrink-0 items-center justify-between border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-soft text-primary">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div id="logs-service-sync-title" className="text-base font-semibold leading-5 text-on-surface">同步服务</div>
              <div className="mt-1 truncate text-[11px] font-semibold text-muted">从指定 K8s 范围发现服务，完成后回到服务列表选择接入对象</div>
            </div>
          </div>
          <button className="rounded p-1.5 text-muted hover:bg-surface-low hover:text-on-surface disabled:opacity-60" disabled={pending} onClick={onClose} title="关闭">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 overflow-auto p-4">
          <label className="text-xs font-semibold text-muted">
            同步集群
            <select
              className="console-input mt-1.5 h-9 w-full text-sm"
              value={clusterId}
              disabled={pending || clusters.length === 0}
              onChange={(event) => onClusterChange(event.target.value)}
            >
              <option value="">选择集群</option>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
			所属环境
			<select className="console-input mt-1.5 h-9 w-full text-sm" value={environmentId} disabled={pending} onChange={(event) => onEnvironmentChange(event.target.value)}><option value="">选择环境</option>{environments.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stage}</option>)}</select>
		  </label>
		  <label className="text-xs font-semibold text-muted">
            Namespace
            <select
              className="console-input mt-1.5 h-9 w-full text-sm"
              value={namespace}
              disabled={pending || !clusterId || namespacesLoading}
              onChange={(event) => onNamespaceChange(event.target.value)}
            >
              <option value="">{namespacesLoading ? '加载 Namespace' : '选择 Namespace'}</option>
              {namespaceOptions.map((item) => (
                <option key={item.id || item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          {disabledReason ? <WarnLine message={disabledReason} /> : null}
          {error ? <LogsErrorLine message={(error as Error).message} /> : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-outline bg-surface-lowest px-4 py-3">
          <button className="console-button h-9" disabled={pending} onClick={onClose}>取消</button>
          <button className="console-button console-button-primary h-9" disabled={pending || Boolean(disabledReason)} title={disabledReason || '确认同步服务'} onClick={onConfirm}>
            {pending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
            确认同步
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

function RoutePreviewCodePanel({
  title,
  meta,
  content,
  emptyLabel,
  copyTitle,
}: {
  title: string;
  meta: string;
  content: string;
  emptyLabel: string;
  copyTitle: string;
}) {
  const displayContent = content || emptyLabel;
  return (
    <section className="logs-route-preview-code flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-outline bg-white">
      <div className="flex min-h-[42px] items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-on-surface">{title}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-muted">{meta}</div>
        </div>
        <button className="shrink-0 rounded p-1.5 text-muted hover:bg-surface-low hover:text-primary" onClick={() => navigator.clipboard?.writeText(content)} title={copyTitle}>
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto bg-white p-3 font-mono text-[11px] leading-5 text-on-surface whitespace-pre-wrap">
        {displayContent}
      </pre>
    </section>
  );
}

function RouteCanvasStepper({
  currentStep,
  setupTask,
  serviceDone,
  targetDone,
  endpointDone,
  serviceSummary,
  targetSummary,
  endpointSummary,
  onSelectService,
  onSelectTarget,
  onSelectEndpoint,
}: {
  currentStep: OnboardingStep;
  setupTask: SetupTask;
  serviceDone: boolean;
  targetDone: boolean;
  endpointDone: boolean;
  serviceSummary: string;
  targetSummary: string;
  endpointSummary: string;
  onSelectService: () => void;
  onSelectTarget: () => void;
  onSelectEndpoint: () => void;
}) {
  const steps = [
    { key: 'service' as SetupTask, index: 1, title: '选择服务', summary: serviceSummary, done: serviceDone, disabled: false, onSelect: onSelectService },
    { key: 'target' as SetupTask, index: 2, title: '绑定运行目标', summary: targetSummary, done: targetDone, disabled: !serviceDone, onSelect: onSelectTarget },
    { key: 'endpoint' as SetupTask, index: 3, title: '选择下游端点', summary: endpointSummary, done: endpointDone, disabled: !targetDone, onSelect: onSelectEndpoint },
  ];

  return (
    <aside className="logs-route-stepper min-w-0 rounded-lg border border-outline bg-surface-lowest p-3 xl:sticky xl:top-0 xl:h-fit" aria-label="创建采集路由步骤">
      <div className="space-y-2">
        {steps.map((step) => {
          const active = currentStep === 1 && setupTask === step.key;
          const statusLabel = step.disabled ? '待前置' : step.done ? '已完成' : active ? '进行中' : '未开始';
          return (
            <button
              key={step.key}
              type="button"
              className={`route-stepper-item w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'border-primary bg-primary-soft text-on-surface shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]'
                  : step.done
                    ? 'border-outline bg-white text-on-surface hover:border-primary/30 hover:bg-primary-soft/45'
                    : 'border-outline bg-white text-muted hover:bg-surface-low/65'
              } disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={step.disabled}
              aria-current={active ? 'step' : undefined}
              onClick={step.onSelect}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  step.done ? 'border-primary bg-primary text-white' : active ? 'border-primary bg-white text-primary' : 'border-outline bg-white text-muted'
                }`}>
                  {step.done ? <CheckCircle className="h-3.5 w-3.5" /> : step.index}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{step.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">{step.summary}</span>
                  <span className={`mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    active ? 'border-primary/20 bg-white text-primary' : step.done ? 'border-primary/20 bg-primary-soft text-primary' : 'border-outline bg-white text-muted'
                  }`}>
                    {statusLabel}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function RouteTaskCard({
  className = '',
  bodyClassName = 'min-h-0 flex-1 overflow-auto bg-surface/35',
  index,
  title,
  summary,
  active,
  done,
  disabled = false,
  disabledReason = '',
  children,
}: {
  className?: string;
  bodyClassName?: string;
  index: number;
  title: string;
  summary: string;
  active: boolean;
  done: boolean;
  disabled?: boolean;
  disabledReason?: string;
  children: ReactNode;
  onSelect: () => void;
}) {
  if (!active) return null;
  const statusLabel = disabled ? '待前置' : done ? '已完成' : '进行中';
  return (
    <section className={`logs-route-active-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline bg-surface-lowest ${className}`}>
      <div className="flex flex-col gap-2 border-b border-outline bg-white px-3 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary bg-white text-[11px] font-semibold text-primary">
            {done ? <CheckCircle className="h-3.5 w-3.5" /> : index}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-on-surface">{title}</div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted">{disabled ? disabledReason : summary}</div>
          </div>
        </div>
        <span className="w-fit shrink-0 rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
          {statusLabel}
        </span>
      </div>
      <div className={bodyClassName}>
        {children}
      </div>
    </section>
  );
}

function RouteTaskSummaryCard({
  taskLabel,
  sourceLabel,
  serviceLabel,
  scopeLabel,
  endpointLabel,
  configLabel,
  impactLabel,
  auditLabel,
  actionHint,
  warning,
  actions,
}: {
  taskLabel: string;
  sourceLabel: string;
  serviceLabel: string;
  scopeLabel: string;
  endpointLabel: string;
  configLabel: string;
  impactLabel: string;
  auditLabel: string;
  actionHint: string;
  warning: boolean;
  actions: ReactNode;
}) {
  return (
    <aside className="logs-route-summary-card flex min-h-0 min-w-0 flex-col rounded-lg border border-outline bg-surface-lowest lg:sticky lg:top-0 lg:max-h-full">
      <div className="shrink-0 border-b border-outline px-3 py-3">
        <div className="text-xs font-semibold text-muted">当前任务</div>
        <div className="mt-1 text-sm font-semibold text-on-surface">{taskLabel}</div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
        <SummaryGroup title="基础信息">
          <SummaryValue label="来源" value={sourceLabel} />
          <SummaryValue label="Scope" value={scopeLabel} />
        </SummaryGroup>
        <SummaryGroup title="路由规则">
          <SummaryValue label="服务" value={serviceLabel} />
          <SummaryValue label="下游" value={endpointLabel} />
          <SummaryValue label="配置状态" value={configLabel} />
        </SummaryGroup>
        <SummaryGroup title="发布线索">
          <SummaryValue label="影响范围" value={impactLabel} />
          <SummaryValue label="审计" value={auditLabel} />
        </SummaryGroup>
      </div>
      {actionHint ? (
        <div className={`mx-3 rounded-md border px-2.5 py-2 text-xs font-semibold leading-5 ${
          warning ? 'border-warning/30 bg-amber-50 text-warning' : 'border-primary/20 bg-primary-soft text-primary'
        }`}>
          {actionHint}
        </div>
      ) : null}
      <div className="mt-3 shrink-0 space-y-2 border-t border-outline bg-surface-lowest px-3 py-3">
        {actions}
      </div>
    </aside>
  );
}

function SummaryGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-outline bg-surface px-3 py-3">
      <div className="mb-2 text-xs font-semibold text-on-surface">{title}</div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-0.5 break-all font-mono text-[12px] font-semibold text-on-surface">{value || '-'}</div>
    </div>
  );
}

function MutationErrors({ errors }: { errors: Array<unknown> }) {
  return (
    <>
      {errors.filter(Boolean).map((error, index) => <LogsErrorLine key={index} message={(error as Error).message} />)}
    </>
  );
}

function ErrorInline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <XCircle className="h-5 w-5 text-red-500" />
      <p className="text-sm text-muted">{message}</p>
      <button className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white" onClick={onRetry}>重试</button>
    </div>
  );
}


function WarnLine({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-700">
      <AlertTriangle className="h-4 w-4" />{message}
    </div>
  );
}

function SuccessLine({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded border border-primary/20 bg-primary-soft px-3 py-2 text-sm text-primary">
      <CheckCircle className="h-4 w-4" />{message}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted">
      <Server className="h-4 w-4" />{label}
    </div>
  );
}
