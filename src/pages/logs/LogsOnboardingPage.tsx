import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Copy, Play, RefreshCw, Save, Search, Server, Settings2, Sparkles, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from '../k8s/api';
import { logSinkLabel, logSourceLabel, logsApi, type LogAccessSource, type LogParsePreviewResult, type LogParseRule, type LogPublishResult, type LogRouteInput, type LogRoutePreview, type LogRouteView, type LogSource, type LogSourceType, type LogsAgentGroupSummary, type LogsServiceSummary, type LogsWorkload } from './api';
import { ServicePickerPanel, isCollectingRoute, routeAccessPriority, routeLifecycle, serviceDisplayName } from './ServicePickerPanel';
import { LogsParseRuleDialog, type ParserMode } from './LogsParseRuleDialog';
import { LogsPublishPreviewPanel } from './LogsPublishPreviewPanel';

const sourceTabs: Array<{ value: LogAccessSource; label: string }> = [
  { value: 'k8s', label: 'K8s' },
  { value: 'vm', label: 'VM' },
];

const defaultParseSample = '{"level":"INFO","message":"service started"}';
const defaultParserRuleName = 'default-parser';
const defaultParserPattern = '^(?P<level>[A-Z]+)\\s+(?P<message>.*)$';
const defaultK8sRuntimeLogPaths = '/data/docker/containers';

function serviceMatchesAccessSource(service: LogsServiceSummary, source: LogAccessSource) {
  if (source === 'vm') {
    return service.identityType === 'host_process';
  }
  return service.identityType === 'k8s_workload' || service.source === 'k8s';
}

function shortHash(value?: string) {
  if (!value) return '-';
  return value.length > 12 ? value.slice(0, 12) : value;
}

function publishStatusLabel(status: string) {
  if (status === 'applied' || status === 'ready_for_agent_sync') return '已发布';
  if (status === 'previewed') return '待确认';
  if (status === 'pending_publish') return '待发布';
  if (status === 'failed' || status === 'error') return '失败';
  return status || '-';
}

function formatMissing(items: string[]) {
  if (items.length <= 3) return items.join('、');
  return `${items.slice(0, 3).join('、')} 等 ${items.length} 项`;
}

function safeSegment(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'default';
}

function derivedCollectorDomainName(type: LogSourceType, clusterId: string, agentNamespace: string, environment: string, hostGroup: string) {
  if (type === 'vm_file') {
    return `logs-vm-${safeSegment(environment || 'prod')}-${safeSegment(hostGroup || 'hosts')}`;
  }
  return `logs-k8s-${safeSegment(clusterId)}-${safeSegment(agentNamespace || 'novaobs-system')}`;
}

function derivedCollectorDomainLabel(type: LogSourceType, clusterId: string, agentNamespace: string, hostGroup: string) {
  if (type === 'vm_file') {
    return `${hostGroup || 'VM 主机'} / 自动维护`;
  }
  return `${clusterId || '-'} / ${agentNamespace || 'novaobs-system'} / 自动维护`;
}

function findCollectorDomain(groups: LogsAgentGroupSummary[], type: LogSourceType, clusterId: string, agentNamespace: string, environment: string, hostGroup: string) {
  const expectedName = derivedCollectorDomainName(type, clusterId, agentNamespace, environment, hostGroup);
  return groups.find((item) => item.name === expectedName) ?? null;
}

function k8sLogIncludePath(namespace: string, workloadName: string) {
  const ns = namespace || '*';
  const workload = workloadName ? `${workloadName}*` : '*';
  return `/var/log/pods/${ns}_${workload}_*/*/*.log`;
}

function parseRuntimeLogPaths(value: string) {
  return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim().replace(/\/+$/, '')).filter(Boolean)));
}

function selectorToText(selector?: Record<string, string>) {
  return Object.entries(selector ?? {}).map(([key, value]) => `${key}=${value}`).join(',');
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
  const [routeParams] = useSearchParams();
  const suspendDraftResetRef = useRef(false);
  const routeParamAppliedRef = useRef('');
  const { data: workspace, isLoading, error, refetch } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });

  const [sourceMode, setSourceMode] = useState<LogAccessSource>('k8s');
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [endpointQuery, setEndpointQuery] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [agentNamespace, setAgentNamespace] = useState('novaobs-system');
  const [runtimeLogPathsText, setRuntimeLogPathsText] = useState(defaultK8sRuntimeLogPaths);
  const [workloadKey, setWorkloadKey] = useState('');
  const [workloadQuery, setWorkloadQuery] = useState('');
  const [hostGroup, setHostGroup] = useState('');
  const [hostSelectorText, setHostSelectorText] = useState('');
  const [vmPath, setVmPath] = useState('');
  const syncEnvironment = 'prod';
  const [collectorConfigYaml, setCollectorConfigYaml] = useState('');
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
  const [pendingPublish, setPendingPublish] = useState<LogPublishResult | null>(null);
  const onboardingRouteId = routeParams.get('route_id') ?? '';
  const routeUpdateMode = routeParams.get('mode') === 'update';

  const services = workspace?.services ?? [];
  const groups = workspace?.collectorGroups ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const clusters = workspace?.clusters ?? [];
  const routes = workspace?.routes ?? [];
  const sourceType: LogSourceType = sourceMode === 'vm' ? 'vm_file' : 'k8s_stdout';
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
    routeScopedServices ?? sourceServices.filter((service) => !runningRouteServiceIds.has(service.id))
  ), [routeScopedServices, runningRouteServiceIds, sourceServices]);
  const serviceListSourceCount = routeScopedServices ? accessServices.length : sourceServices.length;
  const serviceListTotalCount = routeScopedServices ? accessServices.length : services.length;
  const serviceListMeta = isLoading ? 'loading' : `${serviceListSourceCount}/${serviceListTotalCount} services · ${routes.length} routes`;
  const routeUpdateMissing = routeUpdateMode && Boolean(onboardingRouteId) && !isLoading && !selectedRoute;
  const restoredSource = selectedRoute?.source ?? createdRoute?.source ?? null;

  useEffect(() => {
    if (!serviceId || !accessServices.some((service) => service.id === serviceId)) {
      if (accessServices[0]) {
        applyServiceRuntimeScope(accessServices[0]);
      } else {
        setServiceId('');
      }
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
    setPendingPublish(null);
  }, [sourceType, serviceId, endpointId, clusterId, namespace, workloadKey, hostGroup, hostSelectorText, vmPath, collectorConfigYaml, parserMode, parserRuleName, parserPattern]);

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

  const namespacesQuery = useQuery({
    queryKey: ['logs-k8s-namespaces', clusterId],
    queryFn: () => k8sApi.listNamespaces(clusterId),
    enabled: sourceType !== 'vm_file' && Boolean(clusterId),
  });
  const namespaces = namespacesQuery.data ?? [];
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

  useEffect(() => {
    if (routeUpdateMode) return;
    if (sourceType !== 'vm_file' && !workloadKey && workloads[0]) {
      const identity = workloadIdentity(workloads[0]);
      setWorkloadKey(identity);
    }
  }, [routeUpdateMode, sourceType, workloadKey, workloads]);

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
  const selectedGroup = groups.find((item) => item.id === createdRoute?.route.agentGroupId) ?? findCollectorDomain(groups, sourceType, clusterId, agentNamespace, selectedService?.environment || syncEnvironment, hostGroup);
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

  useEffect(() => {
    if (routeUpdateMode) return;
    if (sourceType !== 'vm_file' && serviceScopeWorkloadKey && workloadKey !== serviceScopeWorkloadKey) {
      setWorkloadKey(serviceScopeWorkloadKey);
    }
  }, [routeUpdateMode, serviceScopeWorkloadKey, sourceType, workloadKey]);

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
      clusterId,
      namespace,
      environment: syncEnvironment,
      ownerTeam: '',
      workloadKind: 'Deployment',
    }),
    onSuccess: async (result) => {
      const matched = selectedWorkload ? result.services.find((item) => item.service.name === selectedWorkload.name) : result.services[0];
      if (matched?.service.id) {
        setServiceId(matched.service.id);
      }
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => logsApi.previewRoute(buildRouteInput()),
    onSuccess: (result) => setPreview(result),
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

  const publishMutation = useMutation({
    mutationFn: (confirmation?: { previewId?: string; confirmationToken?: string }) => {
      if (!createdRoute) throw new Error('请先保存路由');
      return logsApi.publishRoute(createdRoute.route.id, confirmation);
    },
    onSuccess: async (result) => {
      setPendingPublish(result.requiresConfirmation ? result : null);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  function buildRouteInput(): LogRouteInput {
    if (sourceType !== 'vm_file' && selectedWorkload) {
      return buildK8sRouteInput(selectedWorkload, selectedService);
    }
    const hostSelector = parseSelector(hostSelectorText);
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
        agentNamespace,
        workloadKind: selectedWorkload?.kind || restoredSource?.workloadKind,
        workloadName: selectedWorkload?.name || restoredSource?.workloadName,
        workloadSelector: selectedWorkload?.selector ?? {},
        runtimeLogPaths: parseRuntimeLogPaths(runtimeLogPathsText),
        parseRules: buildParseRules(),
      },
      vm: sourceType === 'vm_file' ? {
        hostGroup,
        hostSelector,
        pathPattern: vmPath,
        parseRules: buildParseRules(),
        collectorYAML: collectorConfigYaml,
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
        agentNamespace,
        workloadKind: workload.kind,
        workloadName: workload.name,
        workloadSelector: workload.selector ?? {},
        runtimeLogPaths: parseRuntimeLogPaths(runtimeLogPathsText),
        parseRules: buildParseRules(),
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
    setSelectedRouteId('');
    setCreatedRoute(null);
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
      return (source.hostGroup ?? '') === hostGroup
        && selectorToText(source.hostSelector) === hostSelectorText.trim()
        && (source.pathPattern ?? '') === vmPath;
    }
    return source.clusterId === clusterId
      && source.namespace === namespace
      && (source.agentNamespace || 'novaobs-system') === agentNamespace
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
    setRouteEditMode(Boolean(options.edit));
    setSourceMode(source.sourceType === 'vm_file' ? 'vm' : 'k8s');
    setServiceId(route.route.serviceId);
    setEndpointId(route.route.endpointId);
    setCollectorConfigYaml(source.collectorYAML ?? '');
    setRuntimeLogPathsText(defaultK8sRuntimeLogPaths);
    setParserMode(parserForm.mode);
    setParserRuleName(parserForm.name);
    setParserPattern(parserForm.pattern);
    setPreview(null);
    setCreatedRoute(route);
    setPendingPublish(null);
    setServiceQuery('');
    setEndpointQuery('');
    if (source.sourceType === 'vm_file') {
      setHostGroup(source.hostGroup ?? '');
      setHostSelectorText(selectorToText(source.hostSelector));
      setVmPath(source.pathPattern ?? '');
      return;
    }
    setClusterId(source.clusterId ?? '');
    setNamespace(source.namespace ?? '');
    setAgentNamespace(source.agentNamespace || 'novaobs-system');
    setWorkloadKey(source.workloadKind && source.workloadName ? `${source.workloadKind}/${source.workloadName}` : '');
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
        { key: 'vm-scope', label: '填写主机组或主机标签', done: Boolean(hostGroup || hostSelectorText.trim()) },
        { key: 'vm-path', label: '填写日志路径', done: Boolean(vmPath) },
      ]
      : [
        { key: 'cluster', label: '选择 K8s 集群', done: Boolean(clusterId) },
        { key: 'namespace', label: '选择 Namespace', done: Boolean(namespace) },
        { key: 'workload', label: '选择 Workload', done: Boolean(selectedWorkload) },
        { key: 'agent-namespace', label: '填写 Agent Namespace', done: Boolean(agentNamespace) },
      ]),
  ];
  const previewMissing = previewRequirements.filter((item) => !item.done).map((item) => item.label);
  const canPreview = previewMissing.length === 0;
  const collectorConfigState = !parseValid ? '需修正' : sourceType === 'vm_file' ? collectorConfigYaml.trim() ? '自定义' : '后端生成' : '后端生成';
  const parseDraftValid = parserDraftMode !== 'regex' || parserDraftPattern.includes('?P<');
  const selectedServiceLabel = selectedService?.displayName || selectedService?.name || '-';
  const selectedAgentLabel = selectedGroup?.displayName || selectedGroup?.name || derivedCollectorDomainLabel(sourceType, clusterId, agentNamespace, hostGroup);
  const selectedEndpointLabel = effectiveEndpoint ? `${effectiveEndpoint.name} · ${logSinkLabel(effectiveEndpoint.sinkType)}` : '未选择下游端点';
  const activeRouteForSummary = selectedRoute ?? createdRoute;
  const selectedPublishLabel = publishMutation.data?.status ? publishStatusLabel(publishMutation.data.status) : activeRouteForSummary ? routeLifecycle(activeRouteForSummary).label : '-';
  const selectedScopeLabel = sourceType === 'vm_file'
    ? `${hostGroup || 'VM'} · ${vmPath || '-'}`
    : `${selectedCluster?.name || clusterId || restoredSource?.clusterId || '-'} / ${namespace || restoredSource?.namespace || '-'} / ${selectedWorkload ? `${selectedWorkload.kind}/${selectedWorkload.name}` : restoredSource?.workloadName ? `${restoredSource.workloadKind}/${restoredSource.workloadName}` : '-'}`;
  const k8sIncludePath = k8sLogIncludePath(
    namespace || restoredSource?.namespace || '',
    selectedWorkload?.name || restoredSource?.workloadName || '',
  );
  const runtimeTargetReady = sourceType === 'vm_file'
    ? Boolean(serviceId && (hostGroup || hostSelectorText.trim()) && vmPath)
    : Boolean(serviceId && selectedWorkload);
  const endpointBlocked = !runtimeTargetReady;
  const endpointDisabledReason = endpointBlocked ? '运行目标未绑定时禁用日志下游端点' : '';
  const activeStep = preview ? 4 : runtimeTargetReady && hasEndpointForSource ? 3 : runtimeTargetReady ? 2 : 1;
  const previewDisabledReason = previewMissing.length ? `预览前还需：${formatMissing(previewMissing)}` : '';
  const saveDisabledReason = preview ? '' : '先完成配置预览';
  const publishDisabledReason = !createdRoute
    ? '先保存路由'
    : preview?.publishBlocked
      ? preview.publishBlockedReason || '当前配置被后端策略阻断'
      : '';
  const lockedDisabledReason = collectingConfigLocked ? '当前采集配置处于查看态，请点击更新配置进入编辑。' : '';
  const actionHint = collectingConfigLocked
    ? '当前服务已有运行路由，请从采集路由页查看配置或进入更新。'
    : previewMissing.length
    ? previewDisabledReason
    : !preview
      ? '配置已满足预览条件，可以生成部署清单预览。'
      : !createdRoute
        ? '预览已生成，保存草稿后可生成发布预览。'
        : publishDisabledReason
          ? `发布阻断：${publishDisabledReason}`
          : '路由已保存，可以生成发布预览。';

  if (error) {
    return (
      <DataPanel title="接入配置加载失败" meta="Logs">
        <ErrorInline message={(error as Error).message} onRetry={() => refetch()} />
      </DataPanel>
    );
  }

  return (
    <div className="relative pb-24">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
        <section className="logs-onboarding-toolbar console-panel overflow-hidden">
          <div className="grid gap-3 border-b border-outline/70 bg-white/74 px-3 py-3 xl:grid-cols-[220px_minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-on-surface">接入配置</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted">{serviceListMeta}</div>
            </div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {sourceTabs.map((item) => (
                <button
                  key={item.value}
                  className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition-all active:translate-y-px ${
                    sourceMode === item.value ? 'border-primary bg-primary-soft text-primary' : 'border-outline bg-white/82 text-muted hover:border-primary/40 hover:text-on-surface'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={routeUpdateMode}
                  title={routeUpdateMode ? '运行路由更新时来源由当前路由决定' : undefined}
                  onClick={() => {
                    if (routeUpdateMode) return;
                    setSourceMode(item.value);
                    setServiceQuery('');
                  }}
                >
                  {item.label}
                </button>
              ))}
              <span className="inline-flex h-8 items-center rounded-md border border-outline bg-white/68 px-2.5 font-mono text-[11px] text-muted">
                {sourceType === 'vm_file' ? 'host group / path' : 'kubeconfig / namespace / workload'}
              </span>
            </div>
            <button
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-white transition-all active:translate-y-px disabled:opacity-60"
              disabled={routeUpdateMode || sourceType === 'vm_file' || !clusterId || !namespace || syncK8sServicesMutation.isPending}
              title={routeUpdateMode ? '运行路由更新时不触发服务同步' : undefined}
              onClick={() => syncK8sServicesMutation.mutate()}
            >
              {syncK8sServicesMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              同步服务
            </button>
          </div>
          <div className="grid divide-y divide-outline/70 md:grid-cols-4 md:divide-x md:divide-y-0">
            <StepCard index={1} title="服务与运行目标" description={sourceType === 'vm_file' ? '服务 / 主机 / 路径' : '服务 / 集群 / Namespace / Workload'} active={activeStep === 1} done={activeStep > 1} />
            <StepCard index={2} title="日志端点" description={hasEndpointForSource ? selectedEndpointLabel : '等待运行目标'} active={activeStep === 2} done={activeStep > 2} />
            <StepCard index={3} title="采集配置" description={collectorConfigState} active={activeStep === 3} done={activeStep > 3} />
            <StepCard index={4} title="预览发布" description={preview ? shortHash(preview.collectorConfigHash) : '等待预览'} active={activeStep === 4} done={Boolean(createdRoute)} />
          </div>
        </section>

        <DataPanel title="服务与运行目标" meta="service / runtime target">
          {routeUpdateMissing ? <WarnLine message="未找到待更新的采集路由，请从采集路由页重新进入。" /> : null}
          <div className="grid gap-3 xl:grid-cols-[380px_minmax(0,1fr)]">
            <ServicePickerPanel
              services={filteredServices}
              sourceServiceCount={serviceListSourceCount}
              totalServiceCount={serviceListTotalCount}
              selectedServiceId={serviceId}
              serviceQuery={serviceQuery}
              routeEditMode={routeEditMode}
              locked={routeUpdateMode}
              serviceRoutesByService={serviceRoutesByService}
              onServiceQueryChange={setServiceQuery}
              onSelectService={applyServiceRuntimeScope}
              onEditRoute={beginRouteEdit}
            />

            <section className="relative overflow-hidden rounded-lg border border-outline bg-surface-lowest">
              <div className="flex flex-col gap-2 border-b border-outline bg-white/72 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(13,91,215,0.12)]" />
                  运行目标
                </div>
                <span className={`w-fit rounded-lg px-2 py-0.5 font-mono text-[11px] font-semibold ${runtimeTargetReady ? 'bg-primary-soft text-primary' : 'bg-white/70 text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]'}`}>
                  {runtimeTargetReady ? selectedScopeLabel : '等待绑定'}
                </span>
              </div>
              <div className="p-3">
                {sourceType === 'vm_file' ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    <label className="text-sm font-semibold">主机组<input className="console-input mt-2 w-full" value={hostGroup} onChange={(event) => setHostGroup(event.target.value)} placeholder="prod-app-vms" /></label>
                    <label className="text-sm font-semibold">主机标签<input className="console-input mt-2 w-full" value={hostSelectorText} onChange={(event) => setHostSelectorText(event.target.value)} placeholder="env=prod,role=api" /></label>
                    <label className="text-sm font-semibold">日志路径<input className="console-input mt-2 w-full" value={vmPath} onChange={(event) => setVmPath(event.target.value)} placeholder="/data/logs/*.log" /></label>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <aside className="logs-k8s-cluster-picker rounded-lg border border-primary/20 bg-primary-soft/30 p-3 shadow-[0_10px_28px_rgba(13,91,215,0.08)]">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-on-surface">选择 K8s 集群</div>
                          <div className="mt-1 text-[11px] font-semibold text-muted">可用集群</div>
                        </div>
                        <span className="rounded-lg border border-primary/15 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-primary shadow-[0_4px_12px_rgba(13,91,215,0.08)]">{writableClusters.length} clusters</span>
                      </div>
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
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-[13px] font-semibold text-on-surface">{cluster.name || cluster.id}</span>
                                  <span className="shrink-0 rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">可发布</span>
                                </div>
                                <div className="mt-2 grid grid-cols-3 gap-1.5">
                                  <div className="rounded-md border border-outline/70 bg-surface-lowest/80 px-2 py-1">
                                    <div className="text-[10px] font-semibold text-muted">版本</div>
                                    <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-on-surface">{cluster.version || '-'}</div>
                                  </div>
                                  <div className="rounded-md border border-outline/70 bg-surface-lowest/80 px-2 py-1">
                                    <div className="text-[10px] font-semibold text-muted">模式</div>
                                    <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-on-surface">{cluster.accessMode || '-'}</div>
                                  </div>
                                  <div className="rounded-md border border-outline/70 bg-surface-lowest/80 px-2 py-1">
                                    <div className="text-[10px] font-semibold text-muted">Cluster ID</div>
                                    <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-on-surface">{cluster.id}</div>
                                  </div>
                                </div>
                                {cluster.id === clusterId ? <div className="mt-2 inline-flex items-center rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">已选择</div> : null}
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
                        <label className="mt-3 block text-xs font-semibold text-muted">
                          Runtime 日志目录
                          <input className="console-input mt-1.5 h-8 w-full font-mono text-xs" value={runtimeLogPathsText} onChange={(event) => setRuntimeLogPathsText(event.target.value)} placeholder="/data/docker/containers" />
                        </label>
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
                                      onClick={() => setWorkloadKey(identity)}
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
              </div>
              {collectingConfigLocked ? (
                <RunningConfigVeil />
              ) : null}
            </section>
          </div>
          {!serviceId ? <WarnLine message="请选择服务后再预览配置" /> : null}
        </DataPanel>

        <DataPanel title="日志下游端点" meta="downstream">
          {endpointDisabledReason ? <WarnLine message={endpointDisabledReason} /> : null}
          <div className={`relative overflow-hidden rounded-lg border border-outline bg-surface-lowest ${endpointBlocked ? 'opacity-60' : ''}`}>
            <div className="flex flex-col gap-2 border-b border-outline bg-white/72 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(13,91,215,0.12)]" />
                日志下游端点
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-lg bg-primary-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">{selectedEndpointLabel}</span>
                <span className="rounded-lg bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{availableEndpoints.length} endpoints</span>
                <Link
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-outline bg-white px-2.5 text-[11px] font-semibold text-primary transition-all hover:bg-primary-soft active:translate-y-px"
                  to="/platform/observability"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  管理端点
                </Link>
              </div>
            </div>
            <div className="space-y-3 p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input className="console-input h-9 w-full pl-8 text-sm disabled:cursor-not-allowed" value={endpointQuery} onChange={(event) => setEndpointQuery(event.target.value)} placeholder="搜索端点 / URL / 集群" disabled={endpointBlocked} />
              </div>
              <div className="overflow-hidden rounded-lg border border-outline bg-white">
                {filteredEndpoints.length === 0 ? <div className="px-3"><Empty label="暂无匹配端点" /></div> : (
                  <div className="overflow-auto">
                    <table className="console-table min-w-[760px] w-full">
                      <thead>
                        <tr>
                          <th>端点</th>
                          <th>类型</th>
                          <th>作用域</th>
                          <th>写入地址</th>
                          <th>状态</th>
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
                              <td>
                                <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${selected ? 'bg-primary-soft text-primary' : 'bg-white/70 text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]'}`}>
                                  {selected ? '已选择' : '可选择'}
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
              <div className="rounded-lg border border-outline bg-white/72 px-3 py-2 text-xs text-muted">
                日志下游端点由平台管理统一维护；接入配置只选择已登记端点。
              </div>
            </div>
            {collectingConfigLocked ? (
              <RunningConfigVeil />
            ) : null}
          </div>
        </DataPanel>

        <DataPanel title="发布预览" meta={preview ? `config ${shortHash(preview.collectorConfigHash)}` : '等待预览'}>
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
          <MutationErrors errors={[previewMutation.error, createRouteMutation.error, publishMutation.error]} />
          {preview?.publishBlocked ? <WarnLine message={preview.publishBlockedReason} /> : null}
          {preview?.warnings.map((item) => <WarnLine key={item} message={item} />)}
          {publishMutation.data && !pendingPublish ? <SuccessLine message={publishMutation.data.message || publishMutation.data.status} /> : null}
          {pendingPublish ? <LogsPublishPreviewPanel preview={pendingPublish} /> : null}
          {preview ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-mono text-xs text-muted">部署清单预览 · 采集配置 hash {preview.collectorConfigHash}</div>
                <button className="rounded p-1.5 text-muted hover:bg-surface-low hover:text-primary" onClick={() => navigator.clipboard?.writeText(preview.agentYAML)} title="复制 YAML">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <pre className="max-h-[460px] overflow-auto rounded border border-outline bg-white p-3 font-mono text-[11px] leading-5 text-on-surface whitespace-pre-wrap">
                {preview.agentYAML}
              </pre>
            </div>
          ) : <Empty label="部署清单预览为空" />}
          {collectingConfigLocked ? (
            <RunningConfigVeil />
          ) : null}
          </div>
        </DataPanel>

        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <SummaryCard
            service={selectedServiceLabel}
            source={logSourceLabel(sourceType)}
            scope={selectedScopeLabel}
            agent={selectedAgentLabel}
            endpoint={selectedEndpointLabel}
            parser={collectorConfigState}
            collectorHash={preview?.collectorConfigHash || createdRoute?.route.collectorConfigHash || '-'}
            publish={selectedPublishLabel}
          />
        </aside>
      </div>

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

      <div className="logs-onboarding-action-bar sticky bottom-3 z-[4] mt-4 rounded-lg border border-primary/20 bg-white/95 p-3 shadow-[0_12px_36px_rgba(24,52,96,0.18)] backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-muted">当前选择</div>
            <div className="mt-1 truncate text-sm font-semibold text-on-surface">
              {selectedScopeLabel} · {selectedServiceLabel} · {selectedEndpointLabel}
            </div>
            <div className={`mt-1 text-xs font-semibold ${previewMissing.length || publishDisabledReason ? 'text-warning' : 'text-primary'}`}>
              {actionHint}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={collectingConfigLocked || !canPreview || previewMutation.isPending} onClick={() => previewMutation.mutate()} title={lockedDisabledReason || previewDisabledReason || '生成部署清单预览'}>
              {previewMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              生成预览
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary transition-all active:translate-y-px disabled:opacity-60" disabled={collectingConfigLocked || !preview || createRouteMutation.isPending} onClick={() => createRouteMutation.mutate()} title={lockedDisabledReason || saveDisabledReason || (selectedRouteId ? '更新日志路由' : '保存日志路由')}>
              {createRouteMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {selectedRouteId ? '更新路由' : '保存草稿'}
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={collectingConfigLocked || !createdRoute || publishMutation.isPending || Boolean(preview?.publishBlocked)} onClick={() => publishMutation.mutate(undefined)} title={lockedDisabledReason || publishDisabledReason || '生成发布预览'}>
              {publishMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              发布预览
            </button>
            {pendingPublish ? (
              <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate({ previewId: pendingPublish.previewId, confirmationToken: pendingPublish.confirmationToken })}>
                确认发布
              </button>
            ) : null}
          </div>
        </div>
      </div>
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

function parseSelector(text: string) {
  return Object.fromEntries(text.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    const [key, ...rest] = item.split('=');
    return [key.trim(), rest.join('=').trim()];
  }).filter(([key, value]) => key && value));
}

function RunningConfigVeil() {
  return (
    <div className="running-config-veil pointer-events-auto absolute inset-0 z-20 cursor-not-allowed rounded-lg bg-slate-100/45 shadow-[inset_0_0_0_1px_rgba(99,112,131,0.16)] backdrop-grayscale" />
  );
}

function StepCard({ index, title, description, active, done }: { index: number; title: string; description: string; active: boolean; done: boolean }) {
  return (
    <div className={`px-3 py-2.5 transition-colors ${
      active ? 'bg-primary-soft/70' : done ? 'bg-white/68' : 'bg-white/36'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold ${
          done ? 'border-primary bg-primary text-white' : active ? 'border-primary bg-white text-primary' : 'border-outline bg-white text-muted'
        }`}>
          {done ? <CheckCircle className="h-3 w-3" /> : index}
        </span>
        <span className={`text-xs font-semibold ${active || done ? 'text-on-surface' : 'text-muted'}`}>{title}</span>
      </div>
      <p className="mt-1 truncate pl-7 font-mono text-[11px] text-muted">{description}</p>
    </div>
  );
}

function SummaryCard({ service, source, scope, agent, endpoint, parser, collectorHash, publish }: { service: string; source: string; scope: string; agent: string; endpoint: string; parser: string; collectorHash: string; publish: string }) {
  return (
    <DataPanel title="本次接入" meta="summary">
      <div className="space-y-3">
        {[
          ['服务', service],
          ['来源', source],
          ['采集范围', scope],
          ['采集域', agent],
          ['下游端点', endpoint],
          ['配置', parser],
          ['采集配置 hash', shortHash(collectorHash)],
          ['发布状态', publish],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-outline bg-surface-lowest px-3 py-2">
            <div className="text-[11px] text-muted">{label}</div>
            <div className="mt-1 break-all font-mono text-xs text-on-surface">{value}</div>
          </div>
        ))}
      </div>
    </DataPanel>
  );
}

function MutationErrors({ errors }: { errors: Array<unknown> }) {
  return (
    <>
      {errors.filter(Boolean).map((error, index) => <ErrorLine key={index} message={(error as Error).message} />)}
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

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />{message}
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
