import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Copy, Play, Plus, RefreshCw, Save, Search, Server, Settings2, Sparkles, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from '../k8s/api';
import { logSinkLabel, logSourceLabel, logsApi, type LogAccessSource, type LogEndpoint, type LogParsePreviewResult, type LogParseRule, type LogPublishResult, type LogRouteInput, type LogRoutePreview, type LogRouteView, type LogSinkType, type LogSource, type LogSourceType, type LogsAgentGroupSummary, type LogsServiceSummary, type LogsWorkload } from './api';

const sourceTabs: Array<{ value: LogAccessSource; label: string }> = [
  { value: 'k8s', label: 'K8s' },
  { value: 'vm', label: 'VM' },
];

const emptyEndpoint = {
  name: '',
  description: '',
  sinkType: 'vl' as LogSinkType,
  streamName: '',
  writeURL: '',
  queryURL: '',
  vmuiURL: '',
  secretRef: '',
  scopeType: 'global',
  clusterId: '',
};

const defaultParseSample = '{"level":"INFO","message":"service started"}';
const defaultParserRuleName = 'default-parser';
const defaultParserPattern = '^(?P<level>[A-Z]+)\\s+(?P<message>.*)$';
const collectorEndpointPlaceholder = '<logs-downstream-write-address>';
const defaultK8sRuntimeLogPaths = '/data/docker/containers';

const sinkOptions: Array<{ value: LogSinkType; label: string }> = [
  { value: 'vl', label: 'VL' },
  { value: 'es', label: 'ES' },
  { value: 'kafka', label: 'Kafka' },
];

type ParserMode = 'none' | 'json' | 'regex';

function endpointToForm(endpoint: LogEndpoint) {
  return {
    name: endpoint.name ?? '',
    description: endpoint.description ?? '',
    sinkType: endpoint.sinkType || 'vl',
    streamName: endpoint.streamName ?? '',
    writeURL: endpoint.writeURL ?? '',
    queryURL: endpoint.queryURL ?? '',
    vmuiURL: endpoint.vmuiURL ?? '',
    secretRef: endpoint.secretRef ?? '',
    scopeType: endpoint.scopeType || 'global',
    clusterId: endpoint.clusterId ?? '',
  };
}

function endpointFormMatchesEndpoint(form: typeof emptyEndpoint, endpoint: LogEndpoint) {
  return form.name === endpoint.name
    && form.description === endpoint.description
    && form.sinkType === endpoint.sinkType
    && form.streamName === endpoint.streamName
    && form.writeURL === endpoint.writeURL
    && form.queryURL === endpoint.queryURL
    && form.vmuiURL === endpoint.vmuiURL
    && form.secretRef === endpoint.secretRef
    && form.scopeType === endpoint.scopeType
    && form.clusterId === endpoint.clusterId;
}

function serviceDisplayName(service: LogsServiceSummary) {
  return service.displayName || service.name;
}

function serviceMatchesAccessSource(service: LogsServiceSummary, source: LogAccessSource) {
  if (source === 'vm') {
    return service.identityType === 'host_process';
  }
  return service.identityType === 'k8s_workload' || service.source === 'k8s';
}

interface RequirementItem {
  key: string;
  label: string;
  done: boolean;
}

function shortHash(value?: string) {
  if (!value) return '-';
  return value.length > 12 ? value.slice(0, 12) : value;
}

function routeTitle(route: LogRouteView) {
  const source = route.source;
  if (!source) return route.route.name || route.route.id;
  if (source.sourceType === 'vm_file') return `${source.hostGroup || 'VM'} · ${source.pathPattern}`;
  return `${source.clusterId}/${source.namespace} · ${source.workloadKind}/${source.workloadName}`;
}

type StatusTone = 'success' | 'warning' | 'danger' | 'muted' | 'primary';

function routeLifecycle(route: LogRouteView): { label: string; tone: StatusTone; detail: string } {
  const status = route.route.lastPublishStatus || route.route.status;
  if (status === 'applied' || status === 'ready_for_agent_sync') {
    return { label: '已发布', tone: 'success', detail: route.route.lastPublishMessage || '采集配置已下发' };
  }
  if (status === 'previewed') {
    return { label: '待确认', tone: 'primary', detail: '发布预览已生成' };
  }
  if (status === 'pending_publish') {
    return { label: '待发布', tone: 'warning', detail: route.route.lastPublishMessage || '配置已变更' };
  }
  if (status === 'failed' || status === 'error') {
    return { label: '失败', tone: 'danger', detail: route.route.lastPublishMessage || '发布或探测异常' };
  }
  if (route.route.configHash) {
    return { label: '未发布', tone: 'muted', detail: '路由已保存，等待发布' };
  }
  return { label: '未配置', tone: 'muted', detail: '等待保存路由' };
}

function publishStatusLabel(status: string) {
  if (status === 'applied' || status === 'ready_for_agent_sync') return '已发布';
  if (status === 'previewed') return '待确认';
  if (status === 'pending_publish') return '待发布';
  if (status === 'failed' || status === 'error') return '失败';
  return status || '-';
}

function statusPillClass(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return 'border-primary/20 bg-primary-soft text-primary';
    case 'warning':
      return 'border-warning/30 bg-amber-50 text-warning';
    case 'danger':
      return 'border-danger/30 bg-red-50 text-danger';
    case 'primary':
      return 'border-primary/25 bg-white text-primary';
    default:
      return 'border-outline bg-white text-muted';
  }
}

function formatMissing(items: string[]) {
  if (items.length <= 3) return items.join('、');
  return `${items.slice(0, 3).join('、')} 等 ${items.length} 项`;
}

function endpointMissingFields(form: typeof emptyEndpoint) {
  const base = [
    form.name ? '' : '名称',
    form.writeURL ? '' : form.sinkType === 'kafka' ? 'Brokers' : '写入地址',
  ];
  if (form.sinkType === 'vl') {
    base.push(form.queryURL ? '' : '查询地址');
    base.push(form.vmuiURL ? '' : 'VMUI URL');
  }
  if (form.sinkType === 'kafka') {
    base.push(form.streamName ? '' : 'Topic');
  }
  return base.filter(Boolean);
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

type CollectorDraftInput = {
  sourceType: LogSourceType;
  clusterId: string;
  namespace: string;
  agentNamespace: string;
  workloadName: string;
  hostGroup: string;
  vmPath: string;
  endpoint?: LogEndpoint | null;
  serviceName: string;
  parseRules: LogParseRule[];
};

function renderCollectorConfigDraft(input: CollectorDraftInput) {
  const includePath = input.sourceType === 'vm_file' ? input.vmPath || '/data/logs/*.log' : k8sLogIncludePath(input.namespace, input.workloadName);
  const exporter = renderDownstreamExporterDraft(input.endpoint);
  const routeSuffix = input.sourceType === 'vm_file' ? 'novaobs' : safeSegment(`${input.namespace || 'namespace'}-${input.workloadName || input.serviceName || 'workload'}`);
  const scopeAttributes = input.sourceType === 'vm_file'
    ? [
      `        - key: host.group`,
      `          value: ${input.hostGroup || 'default'}`,
      `          action: upsert`,
    ]
    : [
      `        - key: k8s.cluster.name`,
      `          value: ${input.clusterId || 'cluster'}`,
      `          action: upsert`,
      `        - key: k8s.namespace.name`,
      `          value: ${input.namespace || 'namespace'}`,
      `          action: upsert`,
    ];
  const parserOperators = renderParserOperators(input.parseRules);
  const extensions = input.sourceType === 'vm_file' ? [] : [
    'extensions:',
    '  file_storage/filelog_offsets:',
    '    directory: /var/lib/otelcol/filelog_offsets',
    '    create_directory: true',
  ];
  const receiverName = input.sourceType === 'vm_file' ? 'file_log/novaobs' : `file_log/${routeSuffix}`;
  const resourceProcessor = input.sourceType === 'vm_file' ? 'resource/novaobs' : `resource/${routeSuffix}`;
  return [
    ...extensions,
    'receivers:',
    `  ${receiverName}:`,
    '    include:',
    `      - ${includePath}`,
    ...(input.sourceType === 'vm_file' ? [] : [
      '    exclude:',
      '      - /var/log/pods/*_novaobs-logs-agent-*_*/*/*.log',
      '      - /var/log/pods/*/*/*.gz',
      '      - /var/log/pods/*/*/*.tmp',
      '      - /var/log/pods/*/*/*.log.*',
      '    poll_interval: 10s',
      '    max_concurrent_files: 128',
      '    max_batches: 2',
      '    max_log_size: 1MiB',
      '    file_cache_advise: true',
    ]),
    '    start_at: end',
    '    include_file_path: true',
    '    include_file_name: false',
    ...(input.sourceType === 'vm_file' ? [] : [
      '    storage: file_storage/filelog_offsets',
      '    retry_on_failure:',
      '      enabled: true',
      '      initial_interval: 1s',
      '      max_interval: 30s',
      '      max_elapsed_time: 0',
    ]),
    ...(parserOperators.length ? ['    operators:', ...parserOperators] : []),
    'processors:',
    ...(input.sourceType === 'vm_file' ? [] : [
      '  memory_limiter:',
      '    check_interval: 1s',
      '    limit_mib: 512',
      '    spike_limit_mib: 128',
    '  k8s_attributes:',
      '    auth_type: serviceAccount',
      '    passthrough: false',
      '    filter:',
      '      node_from_env_var: KUBE_NODE_NAME',
      '    extract:',
      '      metadata:',
      '        - k8s.namespace.name',
      '        - k8s.pod.name',
      '        - k8s.container.name',
      '        - k8s.deployment.name',
      '        - k8s.statefulset.name',
      '        - k8s.daemonset.name',
      '        - k8s.cronjob.name',
      '        - k8s.job.name',
    ]),
    `  ${resourceProcessor}:`,
    '    attributes:',
    `        - key: service.name`,
    `          value: ${input.serviceName || input.workloadName || 'unknown-service'}`,
    `          action: upsert`,
    ...scopeAttributes,
    '  batch:',
    '    timeout: 1s',
    'exporters:',
    ...exporter.lines,
    'service:',
    ...(input.sourceType === 'vm_file' ? [] : [
      '  extensions: [file_storage/filelog_offsets]',
    ]),
    '  pipelines:',
    '    logs:',
    `      receivers: [${receiverName}]`,
    `      processors: [${input.sourceType === 'vm_file' ? 'resource/novaobs, batch' : `memory_limiter, k8s_attributes, ${resourceProcessor}, batch`}]`,
    `      exporters: [${exporter.name}]`,
    '',
  ].join('\n');
}

function renderCollectorDomainConfigDraft(inputs: CollectorDraftInput[]) {
  if (inputs.length === 0) {
    return '暂无当前采集域配置';
  }
  if (inputs[0].sourceType === 'vm_file') {
    return renderCollectorConfigDraft(inputs[0]);
  }
  const normalized = inputs.map((input) => ({
    input,
    suffix: safeSegment(`${input.namespace || 'namespace'}-${input.workloadName || input.serviceName || 'workload'}`),
    exporter: renderDownstreamExporterDraft(input.endpoint),
  }));
  const exporters = Array.from(new Map(normalized.map((item) => [item.exporter.name, item.exporter])).values());
  return [
    'extensions:',
    '  file_storage/filelog_offsets:',
    '    directory: /var/lib/otelcol/filelog_offsets',
    '    create_directory: true',
    'receivers:',
    ...normalized.flatMap(({ input, suffix }) => [
      `  file_log/${suffix}:`,
      '    include:',
      `      - ${k8sLogIncludePath(input.namespace, input.workloadName)}`,
      '    exclude:',
      '      - /var/log/pods/*_novaobs-logs-agent-*_*/*/*.log',
      '      - /var/log/pods/*/*/*.gz',
      '      - /var/log/pods/*/*/*.tmp',
      '      - /var/log/pods/*/*/*.log.*',
      '    poll_interval: 10s',
      '    max_concurrent_files: 128',
      '    max_batches: 2',
      '    max_log_size: 1MiB',
      '    file_cache_advise: true',
      '    include_file_path: true',
      '    include_file_name: false',
      '    start_at: end',
      '    storage: file_storage/filelog_offsets',
    ]),
    'processors:',
    '  memory_limiter:',
    '    check_interval: 1s',
    '    limit_mib: 512',
    '    spike_limit_mib: 128',
    '  k8s_attributes:',
    '    auth_type: serviceAccount',
    '    passthrough: false',
    '    filter:',
    '      node_from_env_var: KUBE_NODE_NAME',
    ...normalized.flatMap(({ input, suffix }) => [
      `  resource/${suffix}:`,
      '    attributes:',
      '      - key: service.name',
      `        value: ${input.serviceName || input.workloadName || 'unknown-service'}`,
      '        action: upsert',
      '      - key: k8s.cluster.name',
      `        value: ${input.clusterId || 'cluster'}`,
      '        action: upsert',
      '      - key: k8s.namespace.name',
      `        value: ${input.namespace || 'namespace'}`,
      '        action: upsert',
    ]),
    '  batch:',
    '    timeout: 1s',
    'exporters:',
    ...exporters.flatMap((item) => item.lines),
    'service:',
    '  extensions: [file_storage/filelog_offsets]',
    '  pipelines:',
    ...normalized.flatMap(({ input, suffix, exporter }) => [
      `    logs/${suffix}:`,
      `      receivers: [file_log/${suffix}]`,
      `      processors: [memory_limiter, k8s_attributes, resource/${suffix}, batch]`,
      `      exporters: [${exporter.name}]`,
      `      # service: ${input.serviceName || input.workloadName || '-'}`,
    ]),
    '',
  ].join('\n');
}

function routeCollectorPatchDraft(input: CollectorDraftInput) {
  return renderCollectorConfigDraft(input);
}

function k8sLogIncludePath(namespace: string, workloadName: string) {
  const ns = namespace || '*';
  const workload = workloadName ? `${workloadName}*` : '*';
  return `/var/log/pods/${ns}_${workload}_*/*/*.log`;
}

function renderDownstreamExporterDraft(endpoint?: LogEndpoint | null) {
  const sinkType = endpoint?.sinkType || 'vl';
  const address = endpoint?.writeURL || collectorEndpointPlaceholder;
  if (sinkType === 'es') {
    return {
      name: 'elasticsearch/logs_downstream',
      lines: [
        '  elasticsearch/logs_downstream:',
        '    endpoints:',
        `      - ${address}`,
        ...(endpoint?.streamName ? [`    logs_index: ${endpoint.streamName}`] : []),
      ],
    };
  }
  if (sinkType === 'kafka') {
    const brokers = splitEndpointList(address);
    return {
      name: 'kafka/logs_downstream',
      lines: [
        '  kafka/logs_downstream:',
        '    brokers:',
        ...brokers.map((broker) => `      - ${broker}`),
        `    topic: ${endpoint?.streamName || '<kafka-topic>'}`,
      ],
    };
  }
  return {
    name: 'otlp_http/logs_downstream',
    lines: [
      '  otlp_http/logs_downstream:',
      `    logs_endpoint: ${address}`,
    ],
  };
}

function splitEndpointList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseRuntimeLogPaths(value: string) {
  return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim().replace(/\/+$/, '')).filter(Boolean)));
}

function selectorToText(selector?: Record<string, string>) {
  return Object.entries(selector ?? {}).map(([key, value]) => `${key}=${value}`).join(',');
}

function renderParserOperators(rules: LogParseRule[]) {
  return rules.flatMap((rule) => {
    if (rule.ruleType === 'json') {
      return [
        `      - id: ${rule.name || 'json-parser'}`,
        '        type: json_parser',
        '        parse_from: body',
      ];
    }
    return [
      `      - id: ${rule.name || 'regex-parser'}`,
      '        type: regex_parser',
      '        parse_from: body',
      `        regex: '${(rule.pattern || '').replace(/'/g, "''")}'`,
    ];
  });
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

function sameCollectorDomain(source: LogSource | null | undefined, sourceType: LogSourceType, clusterId: string, agentNamespace: string, hostGroup: string) {
  if (!source || source.sourceType !== sourceType) return false;
  if (sourceType === 'vm_file') {
    return (source.hostGroup ?? '') === hostGroup;
  }
  return source.clusterId === clusterId && (source.agentNamespace || 'novaobs-system') === (agentNamespace || 'novaobs-system');
}

function collectorInputFromRoute(route: LogRouteView, services: LogsServiceSummary[]) {
  const source = route.source;
  if (!source) return null;
  const service = services.find((item) => item.id === route.route.serviceId);
  return {
    sourceType: source.sourceType,
    clusterId: source.clusterId,
    namespace: source.namespace,
    agentNamespace: source.agentNamespace || 'novaobs-system',
    workloadName: source.workloadName || service?.name || '',
    hostGroup: source.hostGroup,
    vmPath: source.pathPattern,
    endpoint: route.endpoint,
    serviceName: service?.displayName || service?.name || route.route.name,
    parseRules: source.parseRules ?? [],
  } satisfies CollectorDraftInput;
}

export function LogsOnboardingPage() {
  const queryClient = useQueryClient();
  const suspendDraftResetRef = useRef(false);
  const autoRestoredRouteRef = useRef(false);
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
  const [parseRulesDrawerOpen, setParseRulesDrawerOpen] = useState(false);
  const [parseSample, setParseSample] = useState(defaultParseSample);
  const [collectorConfigDraft, setCollectorConfigDraft] = useState('');
  const [parserDraftMode, setParserDraftMode] = useState<ParserMode>('none');
  const [parserDraftRuleName, setParserDraftRuleName] = useState(defaultParserRuleName);
  const [parserDraftPattern, setParserDraftPattern] = useState(defaultParserPattern);
  const [endpointForm, setEndpointForm] = useState(emptyEndpoint);
  const [endpointCreateOpen, setEndpointCreateOpen] = useState(false);
  const [endpointEditId, setEndpointEditId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [preview, setPreview] = useState<LogRoutePreview | null>(null);
  const [createdRoute, setCreatedRoute] = useState<LogRouteView | null>(null);
  const [pendingPublish, setPendingPublish] = useState<LogPublishResult | null>(null);

  const services = workspace?.services ?? [];
  const groups = workspace?.collectorGroups ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const clusters = workspace?.clusters ?? [];
  const routes = workspace?.routes ?? [];
  const sourceType: LogSourceType = sourceMode === 'vm' ? 'vm_file' : 'k8s_stdout';
  const sourceServices = useMemo(() => services.filter((service) => serviceMatchesAccessSource(service, sourceMode)), [services, sourceMode]);
  const selectedRoute = routes.find((item) => item.route.id === selectedRouteId) ?? null;

  useEffect(() => {
    if (!serviceId || !sourceServices.some((service) => service.id === serviceId)) {
      if (sourceServices[0]) {
        applyServiceRuntimeScope(sourceServices[0]);
      } else {
        setServiceId('');
      }
    }
    if (!clusterId && clusters[0]?.id) setClusterId(clusters[0].id);
  }, [clusterId, serviceId, sourceServices, clusters]);

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
    if (routes.length === 0) {
      setSelectedRouteId('');
      autoRestoredRouteRef.current = false;
      return;
    }
    if (selectedRouteId && routes.some((item) => item.route.id === selectedRouteId)) {
      return;
    }
    if (!autoRestoredRouteRef.current) {
      autoRestoredRouteRef.current = true;
      setSelectedRouteId(routes[0].route.id);
    }
  }, [routes, selectedRouteId]);

  useEffect(() => {
    if (selectedRoute) {
      loadRouteDraft(selectedRoute);
    }
  }, [selectedRoute?.route.id]);

  const namespacesQuery = useQuery({
    queryKey: ['logs-k8s-namespaces', clusterId],
    queryFn: () => k8sApi.listNamespaces(clusterId),
    enabled: sourceType !== 'vm_file' && Boolean(clusterId),
  });
  const namespaces = namespacesQuery.data ?? [];

  useEffect(() => {
    if (sourceType !== 'vm_file' && !namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces, sourceType]);

  const workloadsQuery = useQuery({
    queryKey: ['logs-k8s-workloads', clusterId, namespace],
    queryFn: () => logsApi.listK8sWorkloads(clusterId, namespace),
    enabled: sourceType !== 'vm_file' && Boolean(clusterId && namespace),
  });
  const workloads = workloadsQuery.data ?? [];

  useEffect(() => {
    if (sourceType !== 'vm_file' && !workloadKey && workloads[0]) {
      const identity = workloadIdentity(workloads[0]);
      setWorkloadKey(identity);
    }
  }, [sourceType, workloadKey, workloads]);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return sourceServices;
    return sourceServices.filter((service) => `${service.name} ${service.displayName} ${service.ownerTeam}`.toLowerCase().includes(query));
  }, [serviceQuery, sourceServices]);

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
  const editingEndpoint = endpoints.find((item) => item.id === endpointEditId) ?? null;
  const effectiveEndpoint = selectedEndpoint ?? (sourceType !== 'vm_file' ? availableEndpoints[0] ?? null : null);
  const endpointDraftSaved = Boolean(endpointEditId && editingEndpoint && endpointFormMatchesEndpoint(endpointForm, editingEndpoint));
  const endpointFormTitle = endpointEditId ? '编辑端点' : '端点信息';
  const endpointSaveLabel = endpointDraftSaved ? '已保存' : endpointEditId ? '更新' : '保存';
  const endpointActionLabel = endpointEditId ? '更新端点' : '新增端点';
  const closeEndpointForm = () => {
    setEndpointCreateOpen(false);
    setEndpointEditId('');
  };
  const selectedCluster = clusters.find((item) => item.id === clusterId) ?? null;
  const selectedWorkload = workloads.find((item) => workloadIdentity(item) === workloadKey) ?? null;
  const selectedRouteMatchesDraft = selectedRoute ? routeMatchesCurrentDraft(selectedRoute) : false;
  const shouldUseSavedCollectorYaml = Boolean(collectorConfigYaml.trim() && selectedRouteMatchesDraft);
  const filteredWorkloads = useMemo(() => {
    const query = workloadQuery.trim().toLowerCase();
    if (!query) return workloads;
    return workloads.filter((item) => `${item.kind} ${item.name} ${Object.entries(item.selector ?? {}).map(([key, value]) => `${key}=${value}`).join(' ')}`.toLowerCase().includes(query));
  }, [workloadQuery, workloads]);
  const clusterRoutes = useMemo(() => routes.filter((item) => item.source?.clusterId === clusterId), [clusterId, routes]);
  const clusterRouteNamespaces = Array.from(new Set(clusterRoutes.map((item) => item.source?.namespace).filter(Boolean)));
  const clusterRouteWorkloads = clusterRoutes.filter((item) => item.source?.workloadName).length;
  const currentParseRules = useMemo(() => buildParserRules(parserMode, parserRuleName, parserPattern), [parserMode, parserRuleName, parserPattern]);
  const draftParseRules = useMemo(() => buildParserRules(parserDraftMode, parserDraftRuleName, parserDraftPattern), [parserDraftMode, parserDraftRuleName, parserDraftPattern]);
  const serviceScopeWorkloadKey = selectedService ? resolveServiceWorkloadKey(selectedService, workloads) : '';
  const currentCollectorInput = buildCollectorDraftInput();
  const currentCollectorDomainConfig = useMemo(() => renderCollectorDomainConfigDraft(
    routes
      .filter((route) => route.source?.sourceType === sourceType && sameCollectorDomain(route.source, sourceType, clusterId, agentNamespace, hostGroup))
      .filter((route) => route.route.id !== selectedRouteId)
      .map((route) => collectorInputFromRoute(route, services))
      .filter(Boolean) as CollectorDraftInput[],
  ), [agentNamespace, clusterId, hostGroup, routes, selectedRouteId, services, sourceType]);
  const patchedCollectorDomainConfig = useMemo(() => renderCollectorDomainConfigDraft([
    ...routes
      .filter((route) => route.source?.sourceType === sourceType && sameCollectorDomain(route.source, sourceType, clusterId, agentNamespace, hostGroup))
      .filter((route) => route.route.id !== selectedRouteId)
      .map((route) => collectorInputFromRoute(route, services))
      .filter(Boolean) as CollectorDraftInput[],
    currentCollectorInput,
  ]), [agentNamespace, clusterId, currentCollectorInput, hostGroup, routes, selectedRouteId, services, sourceType]);

  useEffect(() => {
    if (sourceType !== 'vm_file' && serviceScopeWorkloadKey && workloadKey !== serviceScopeWorkloadKey) {
      setWorkloadKey(serviceScopeWorkloadKey);
    }
  }, [serviceScopeWorkloadKey, sourceType, workloadKey]);

  useEffect(() => {
    if (!selectedRouteId || !selectedRoute || selectedRouteMatchesDraft || suspendDraftResetRef.current) {
      return;
    }
    setSelectedRouteId('');
    setCollectorConfigYaml('');
  }, [selectedRouteId, selectedRoute?.route.id, selectedRouteMatchesDraft]);

  useEffect(() => {
    if (sourceType !== 'vm_file') {
      const clusterEndpoint = availableEndpoints.find((item) => item.scopeType === 'k8s_cluster' && item.clusterId === clusterId);
      setEndpointId((current) => current && availableEndpoints.some((item) => item.id === current) ? current : clusterEndpoint?.id ?? availableEndpoints[0]?.id ?? '');
      return;
    }
    setEndpointId((current) => current && availableEndpoints.some((item) => item.id === current) ? current : availableEndpoints[0]?.id ?? '');
  }, [availableEndpoints, clusterId, sourceType]);

  const createEndpointMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...endpointForm,
        clusterId: endpointForm.scopeType === 'k8s_cluster' ? (endpointForm.clusterId || clusterId) : '',
      };
      return endpointEditId ? logsApi.updateEndpoint(endpointEditId, payload) : logsApi.createEndpoint(payload);
    },
    onSuccess: async (endpoint) => {
      setEndpointId(endpoint.id);
      setEndpointForm(endpointToForm(endpoint));
      setEndpointEditId(endpoint.id);
      setEndpointCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

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
      autoRestoredRouteRef.current = true;
      setCreatedRoute(created);
      setSelectedRouteId(created.route.id);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  const probeMutation = useMutation({
    mutationFn: (routeId: string) => logsApi.probeRoute(routeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] }),
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
        workloadKind: selectedWorkload?.kind,
        workloadName: selectedWorkload?.name,
        workloadSelector: selectedWorkload?.selector ?? {},
        runtimeLogPaths: parseRuntimeLogPaths(runtimeLogPathsText),
        parseRules: buildParseRules(),
        collectorYAML: collectorConfigYaml,
      },
      vm: {
        hostGroup,
        hostSelector,
        pathPattern: vmPath,
        parseRules: buildParseRules(),
        collectorYAML: collectorConfigYaml,
      },
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
        collectorYAML: collectorConfigYaml,
      },
      vm: {
        hostGroup,
        hostSelector: parseSelector(hostSelectorText),
        pathPattern: vmPath,
        parseRules: buildParseRules(),
        collectorYAML: collectorConfigYaml,
      },
    };
  }

  function buildParseRules(): LogParseRule[] {
    if (parserMode === 'regex' && !parserPattern.includes('?P<')) return [];
    return currentParseRules;
  }

  function openParseDialog() {
    setCollectorConfigDraft(shouldUseSavedCollectorYaml ? collectorConfigYaml : routeCollectorPatchDraft(currentCollectorInput));
    setParserDraftMode(parserMode);
    setParserDraftRuleName(parserRuleName);
    setParserDraftPattern(parserPattern);
    setParseRulesDrawerOpen(false);
    setParseDialogOpen(true);
  }

  function buildCollectorDraftInput(): CollectorDraftInput {
    return {
      sourceType,
      clusterId,
      namespace,
      agentNamespace,
      workloadName: selectedWorkload?.name || selectedService?.name || '',
      hostGroup,
      vmPath,
      endpoint: effectiveEndpoint,
      serviceName: selectedService?.displayName || selectedService?.name || '',
      parseRules: currentParseRules,
    };
  }

  function applyServiceRuntimeScope(service: LogsServiceSummary) {
    setServiceId(service.id);
    setServiceQuery('');
    if (sourceMode === 'k8s' && service.cluster && service.namespace) {
      setClusterId(service.cluster);
      setNamespace(service.namespace);
      setWorkloadKey('');
      setWorkloadQuery('');
    }
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
    setCollectorConfigYaml(sourceType === 'vm_file' ? collectorConfigDraft : patchedCollectorDomainConfig);
    setParserMode(parserDraftMode);
    setParserRuleName(parserDraftRuleName);
    setParserPattern(parserDraftPattern);
    setParseDialogOpen(false);
  }

  function regenerateCollectorConfigDraft() {
    setCollectorConfigDraft(routeCollectorPatchDraft({ ...currentCollectorInput, parseRules: draftParseRules }));
  }

  function loadRouteDraft(route: LogRouteView) {
    const source = route.source;
    if (!source) return;
    const parserForm = parserFormFromRules(source.parseRules);
    suspendDraftResetRef.current = true;
    autoRestoredRouteRef.current = true;
    setSelectedRouteId(route.route.id);
    setSourceMode(source.sourceType === 'vm_file' ? 'vm' : 'k8s');
    setServiceId(route.route.serviceId);
    setEndpointId(route.route.endpointId);
    setEndpointForm(route.endpoint ? endpointToForm(route.endpoint) : emptyEndpoint);
    setCollectorConfigYaml(source.collectorYAML ?? '');
    setRuntimeLogPathsText((source.runtimeLogPaths ?? []).join('\n') || defaultK8sRuntimeLogPaths);
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

  const hasEndpointForSource = sourceType === 'vm_file' ? Boolean(effectiveEndpoint) : Boolean(effectiveEndpoint);
  const parseValid = parserMode !== 'regex' || parserPattern.includes('?P<');
  const previewRequirements: RequirementItem[] = [
    { key: 'service', label: '选择服务', done: Boolean(serviceId) },
    {
      key: 'endpoint',
      label: sourceType === 'vm_file' ? '选择日志下游端点' : '选择或创建当前集群可用的日志下游端点',
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
  const endpointCreateMissing = endpointMissingFields(endpointForm);
  const endpointDraftTouched = Boolean(endpointForm.sinkType !== 'vl' || endpointForm.name || endpointForm.streamName || endpointForm.writeURL || endpointForm.queryURL || endpointForm.vmuiURL || endpointForm.secretRef);
  const canCreateEndpoint = endpointCreateMissing.length === 0;
  const collectorConfigApplied = Boolean(collectorConfigYaml.trim());
  const collectorConfigState = !parseValid ? '需修正' : collectorConfigApplied ? '已应用' : '未配置';
  const parseDraftValid = parserDraftMode !== 'regex' || parserDraftPattern.includes('?P<');
  const selectedServiceLabel = selectedService?.displayName || selectedService?.name || '-';
  const selectedAgentLabel = selectedGroup?.displayName || selectedGroup?.name || derivedCollectorDomainLabel(sourceType, clusterId, agentNamespace, hostGroup);
  const selectedEndpointLabel = effectiveEndpoint ? `${effectiveEndpoint.name} · ${logSinkLabel(effectiveEndpoint.sinkType)}` : '未选择下游端点';
  const activeRouteForSummary = selectedRoute ?? createdRoute;
  const selectedPublishLabel = publishMutation.data?.status ? publishStatusLabel(publishMutation.data.status) : activeRouteForSummary ? routeLifecycle(activeRouteForSummary).label : '-';
  const restoredSource = selectedRoute?.source ?? createdRoute?.source ?? null;
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
  const probeDisabledReason = createdRoute ? '' : '先保存路由';
  const publishDisabledReason = !createdRoute
    ? '先保存路由'
    : preview?.publishBlocked
      ? preview.publishBlockedReason || '当前配置被后端策略阻断'
      : '';
  const actionHint = previewMissing.length
    ? previewDisabledReason
    : !preview
      ? '配置已满足预览条件，可以生成 Agent YAML。'
      : !createdRoute
        ? '预览已生成，保存路由后可做连通性检查和发布。'
        : publishDisabledReason
          ? `发布阻断：${publishDisabledReason}`
          : '路由已保存，可以检查连通性或发布。';

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
              <div className="mt-0.5 font-mono text-[11px] text-muted">{isLoading ? 'loading' : `${sourceServices.length}/${services.length} services · ${routes.length} routes`}</div>
            </div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {sourceTabs.map((item) => (
                <button
                  key={item.value}
                  className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition-all active:translate-y-px ${
                    sourceMode === item.value ? 'border-primary bg-primary-soft text-primary' : 'border-outline bg-white/82 text-muted hover:border-primary/40 hover:text-on-surface'
                  }`}
                  onClick={() => {
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
              disabled={sourceType === 'vm_file' || !clusterId || !namespace || syncK8sServicesMutation.isPending}
              onClick={() => syncK8sServicesMutation.mutate()}
            >
              {syncK8sServicesMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              同步服务
            </button>
          </div>
          <div className="grid divide-y divide-outline/70 md:grid-cols-4 md:divide-x md:divide-y-0">
            <StepCard index={1} title="服务与运行目标" description={sourceType === 'vm_file' ? '服务 / 主机 / 路径' : '服务 / 集群 / Namespace / Workload'} active={activeStep === 1} done={activeStep > 1} />
            <StepCard index={2} title="日志端点" description={hasEndpointForSource ? selectedEndpointLabel : '等待运行目标'} active={activeStep === 2} done={activeStep > 2} />
            <StepCard index={3} title="Collector 配置" description={collectorConfigState} active={activeStep === 3} done={activeStep > 3} />
            <StepCard index={4} title="预览发布" description={preview ? shortHash(preview.configHash) : '等待预览'} active={activeStep === 4} done={Boolean(createdRoute)} />
          </div>
        </section>

        <DataPanel title="服务与运行目标" meta="service / runtime target">
          <div className="grid gap-3 xl:grid-cols-[330px_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-lg border border-outline bg-surface-lowest">
              <div className="flex items-center justify-between gap-2 border-b border-outline bg-white/72 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(13,91,215,0.12)]" />
                  服务
                </div>
                <span className="rounded-lg bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{sourceServices.length}/{services.length} services</span>
              </div>
              <div className="border-b border-outline px-3 py-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input className="console-input h-9 w-full pl-8 text-sm" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="搜索服务" />
                </div>
              </div>
              <div className="max-h-72 overflow-auto p-2">
                {filteredServices.length === 0 ? <Empty label="暂无匹配服务" /> : filteredServices.map((service) => {
                  const selected = service.id === serviceId;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      className={`mb-1.5 grid w-full gap-1 rounded-lg px-3 py-2.5 text-left transition-all active:translate-y-px ${
                        selected ? 'bg-primary-soft text-primary shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : 'bg-white/62 text-on-surface hover:bg-surface-low/80'
                      }`}
                      onClick={() => {
                        applyServiceRuntimeScope(service);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold">{serviceDisplayName(service)}</span>
                        <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${selected ? 'bg-white text-primary' : 'bg-surface-low text-muted'}`}>{service.source || 'local'}</span>
                      </div>
                      <div className="truncate font-mono text-[11px] font-semibold text-muted">{service.environment || 'env -'} · {service.ownerTeam || 'owner -'} · {service.serviceType || 'service'}</div>
                      {service.identityType === 'k8s_workload' ? <div className="truncate font-mono text-[11px] text-muted">服务选择后绑定运行目标 · {service.cluster || '-'} / {service.namespace || '-'}</div> : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-outline bg-surface-lowest">
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
                        <span className="rounded-lg border border-primary/15 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-primary shadow-[0_4px_12px_rgba(13,91,215,0.08)]">{clusters.length} clusters</span>
                      </div>
                      <div className="space-y-2">
                        {clusters.length === 0 ? <Empty label="暂无已登记集群" /> : clusters.map((cluster) => (
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
                                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                                    cluster.readOnly ? 'border-warning/25 bg-amber-50 text-warning' : 'border-primary/20 bg-primary-soft text-primary'
                                  }`}>
                                    {cluster.readOnly ? '只读' : '可发布'}
                                  </span>
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
                            <span className="rounded-lg bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{filteredWorkloads.length}/{workloads.length} workloads</span>
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
                              {namespaces.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
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
                        {filteredWorkloads.length === 0 ? <div className="px-3"><Empty label={workloadsQuery.isLoading ? '正在加载 Workload' : '暂无匹配 Workload'} /></div> : (
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
                                {filteredWorkloads.map((item) => {
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
            </section>
          </div>
          {!serviceId ? <WarnLine message="请选择服务后再预览配置" /> : null}
        </DataPanel>

        <DataPanel title="日志下游端点" meta="downstream">
          {endpointDisabledReason ? <WarnLine message={endpointDisabledReason} /> : null}
          <div className={`overflow-hidden rounded-lg border border-outline bg-surface-lowest ${endpointBlocked ? 'opacity-60' : ''}`}>
            <div className="flex flex-col gap-2 border-b border-outline bg-white/72 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(13,91,215,0.12)]" />
                日志下游端点
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-lg bg-primary-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">{selectedEndpointLabel}</span>
                <span className="rounded-lg bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{availableEndpoints.length} endpoints</span>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-outline bg-white px-2.5 text-[11px] font-semibold text-primary transition-all hover:bg-primary-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                  aria-expanded={endpointCreateOpen}
                  disabled={endpointBlocked}
                  title={endpointBlocked ? endpointDisabledReason : undefined}
                  onClick={() => {
                    if (endpointCreateOpen && !endpointEditId) {
                      setEndpointCreateOpen(false);
                      return;
                    }
                    setEndpointEditId('');
                    setEndpointForm({
                      ...emptyEndpoint,
                      scopeType: sourceType === 'vm_file' ? 'vm' : 'k8s_cluster',
                      clusterId: sourceType === 'vm_file' ? '' : clusterId,
                    });
                    setEndpointCreateOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {endpointCreateOpen && !endpointEditId ? '收起' : '新增端点'}
                </button>
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
                                if (endpointCreateOpen && endpointEditId === endpoint.id) {
                                  closeEndpointForm();
                                  return;
                                }
                                setEndpointEditId(endpoint.id);
                                setEndpointForm(endpointToForm(endpoint));
                                setEndpointCreateOpen(true);
                              }}
                            >
                              <td className="font-semibold">{endpoint.name}</td>
                              <td>{logSinkLabel(endpoint.sinkType)}</td>
                              <td className="font-mono text-xs text-muted">{endpoint.scopeType}{endpoint.clusterId ? ` · ${endpoint.clusterId}` : ''}</td>
                              <td className="max-w-[280px] truncate font-mono text-xs text-muted">{endpoint.writeURL || '-'}</td>
                              <td>
                                <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${selected ? 'bg-primary-soft text-primary' : 'bg-white/70 text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]'}`}>
                                  {endpointCreateOpen && endpointEditId === endpoint.id ? '编辑中' : selected ? '已选择' : '可选择'}
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
              {endpointCreateOpen && !endpointBlocked ? <div className="rounded-lg border border-outline bg-white/72 p-3">
                <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-on-surface">{endpointFormTitle}</div>
                    <span className={`w-fit rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${canCreateEndpoint ? 'border-primary/20 bg-primary-soft text-primary' : 'border-amber-300 bg-amber-50 text-warning'}`}>
                      {endpointDraftSaved ? 'saved' : canCreateEndpoint ? (endpointEditId ? 'edit ready' : 'ready') : 'pending'}
                    </span>
                  </div>
                  <button type="button" className="w-fit rounded-md border border-outline bg-white px-2.5 py-1 text-[11px] font-semibold text-muted transition-all hover:bg-surface-low active:translate-y-px" onClick={closeEndpointForm}>
                    收起
                  </button>
                </div>
                <div className="grid gap-3 lg:grid-cols-4">
                  <input className="console-input" placeholder="名称" value={endpointForm.name} onChange={(event) => setEndpointForm({ ...endpointForm, name: event.target.value })} />
                  <select className="console-input" value={endpointForm.sinkType} onChange={(event) => setEndpointForm({ ...endpointForm, sinkType: event.target.value as LogSinkType })}>
                    {sinkOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <select className="console-input" value={endpointForm.scopeType} onChange={(event) => setEndpointForm({ ...endpointForm, scopeType: event.target.value, clusterId: event.target.value === 'k8s_cluster' ? clusterId : '' })}>
                    <option value="global">全局端点</option>
                    <option value="k8s_cluster">K8s 集群端点</option>
                    <option value="vm">VM 端点</option>
                  </select>
                  <input className="console-input" placeholder="Cluster ID" value={endpointForm.scopeType === 'k8s_cluster' ? (endpointForm.clusterId || clusterId) : ''} onChange={(event) => setEndpointForm({ ...endpointForm, clusterId: event.target.value })} disabled={endpointForm.scopeType !== 'k8s_cluster'} />
                  <input className="console-input lg:col-span-2" placeholder={endpointForm.sinkType === 'kafka' ? 'Brokers：kafka-0:9092,kafka-1:9092' : '写入地址'} value={endpointForm.writeURL} onChange={(event) => setEndpointForm({ ...endpointForm, writeURL: event.target.value })} />
                  {endpointForm.sinkType !== 'vl' ? <input className="console-input" placeholder={endpointForm.sinkType === 'kafka' ? 'Topic' : 'Index / Stream'} value={endpointForm.streamName} onChange={(event) => setEndpointForm({ ...endpointForm, streamName: event.target.value })} /> : null}
                  {endpointForm.sinkType === 'vl' ? <input className="console-input" placeholder="查询地址" value={endpointForm.queryURL} onChange={(event) => setEndpointForm({ ...endpointForm, queryURL: event.target.value })} /> : null}
                  {endpointForm.sinkType === 'vl' ? <input className="console-input" placeholder="VMUI URL" value={endpointForm.vmuiURL} onChange={(event) => setEndpointForm({ ...endpointForm, vmuiURL: event.target.value })} /> : null}
                  <input className="console-input" placeholder="Secret Ref" value={endpointForm.secretRef} onChange={(event) => setEndpointForm({ ...endpointForm, secretRef: event.target.value })} />
                  <button className="inline-flex h-9 items-center justify-center gap-2 rounded bg-primary px-3 text-sm font-semibold text-white disabled:opacity-60" disabled={!canCreateEndpoint || createEndpointMutation.isPending || endpointDraftSaved} onClick={() => createEndpointMutation.mutate()} title={endpointDraftSaved ? '当前端点配置已保存' : canCreateEndpoint ? endpointActionLabel : `${endpointActionLabel}还需：${formatMissing(endpointCreateMissing)}`}>
                    {createEndpointMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : endpointEditId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {endpointSaveLabel}
                  </button>
                </div>
                {endpointDraftSaved ? <SuccessLine message={`当前端点配置已保存：${editingEndpoint?.name}`} /> : null}
                {endpointDraftTouched && endpointCreateMissing.length > 0 ? <WarnLine message={`${endpointActionLabel}还需：${formatMissing(endpointCreateMissing)}`} /> : null}
                {createEndpointMutation.error ? <ErrorLine message={(createEndpointMutation.error as Error).message} /> : null}
              </div> : null}
            </div>
          </div>
        </DataPanel>

        <DataPanel title="配置预览" meta={preview ? `config ${shortHash(preview.configHash)}` : '等待预览'}>
          <div className="mb-3 flex flex-col gap-3 rounded-lg border border-outline bg-surface-lowest px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                collectorConfigState === '已应用'
                  ? 'border-primary/20 bg-primary-soft text-primary'
                  : collectorConfigState === '需修正'
                    ? 'border-warning/30 bg-amber-50 text-warning'
                    : 'border-outline bg-white text-muted'
              }`}>
                {collectorConfigState}
              </span>
              <span className="font-mono text-xs text-muted">collector.yaml</span>
            </div>
            <button className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-semibold text-primary transition-all active:translate-y-px" onClick={openParseDialog}>
              <Settings2 className="h-3.5 w-3.5" />
              Collector 配置
            </button>
          </div>
          {!parseValid ? <WarnLine message="Regex 需要使用命名捕获组，例如 (?P<level>INFO)。" /> : null}
          <MutationErrors errors={[previewMutation.error, createRouteMutation.error, probeMutation.error, publishMutation.error]} />
          {preview?.publishBlocked ? <WarnLine message={preview.publishBlockedReason} /> : null}
          {preview?.warnings.map((item) => <WarnLine key={item} message={item} />)}
          {probeMutation.data ? <SuccessLine message={probeMutation.data.message} /> : null}
          {publishMutation.data && !pendingPublish ? <SuccessLine message={publishMutation.data.message || publishMutation.data.status} /> : null}
          {pendingPublish ? <PublishPreviewPanel preview={pendingPublish} /> : null}
          {preview ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-mono text-xs text-muted">hash {preview.configHash}</div>
                <button className="rounded p-1.5 text-muted hover:bg-surface-low hover:text-primary" onClick={() => navigator.clipboard?.writeText(preview.agentYAML)} title="复制 YAML">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <pre className="max-h-[460px] overflow-auto rounded border border-outline bg-white p-3 font-mono text-[11px] leading-5 text-on-surface whitespace-pre-wrap">
                {preview.agentYAML}
              </pre>
            </div>
          ) : <Empty label="配置预览为空" />}
        </DataPanel>

        <DataPanel title="已登记路由" meta={`${routes.length} routes`}>
          {routes.length === 0 ? <Empty label="暂无日志路由" /> : (
            <div className="overflow-auto">
              <table className="console-table min-w-[980px] w-full">
                <thead>
                  <tr>
                    <th>服务</th>
                    <th>来源</th>
                    <th>范围</th>
                    <th>下游</th>
                    <th>接入状态</th>
                    <th>配置</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => {
                    const service = services.find((item) => item.id === route.route.serviceId);
                    const selected = route.route.id === selectedRouteId;
                    return (
                      <tr key={route.route.id} className={selected ? 'bg-primary-soft/70 text-primary shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : ''}>
                        <td className="font-semibold text-on-surface">{service?.displayName || service?.name || route.route.serviceId}</td>
                        <td>{logSourceLabel(route.route.sourceType)}</td>
                        <td className="font-mono text-xs text-muted">{routeTitle(route)}</td>
                        <td>{route.endpoint ? `${route.endpoint.name} · ${logSinkLabel(route.endpoint.sinkType)}` : '-'}</td>
                        <td><RouteStatusCell route={route} /></td>
                        <td className="font-mono text-xs">
                          <div>{shortHash(route.route.configHash)}</div>
                          {route.route.lastAuditId ? <div className="mt-1 text-[11px] text-muted">audit {shortHash(route.route.lastAuditId)}</div> : null}
                          {route.route.lastPreviewId && route.route.lastPublishStatus === 'previewed' ? <div className="mt-1 text-[11px] text-primary">preview {shortHash(route.route.lastPreviewId)}</div> : null}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button className="text-primary hover:underline" onClick={() => loadRouteDraft(route)}>
                              {selected ? '已载入' : '载入配置'}
                            </button>
                            <Link className="text-primary hover:underline" to={`/logs/agents?agent_group_id=${route.route.agentGroupId}&route_id=${route.route.id}`}>Agent 状态</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
            hash={preview?.configHash || createdRoute?.route.configHash || '-'}
            publish={selectedPublishLabel}
            requirements={previewRequirements}
          />
        </aside>
      </div>

      {parseDialogOpen && typeof document !== 'undefined' ? createPortal((
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/28 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[1320px] overflow-hidden rounded-lg border border-outline bg-white shadow-[0_24px_80px_rgba(24,52,96,0.28)]">
            <div className="flex items-center justify-between border-b border-outline bg-surface-lowest px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <Settings2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="text-base font-semibold leading-5 text-on-surface">Collector 配置</div>
                    <span className="rounded border border-outline bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-muted">collector.yaml</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">{selectedServiceLabel} · {selectedScopeLabel}</div>
                </div>
              </div>
              <button className="rounded p-1.5 text-muted hover:bg-surface-low hover:text-on-surface" onClick={() => setParseDialogOpen(false)} title="关闭">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="grid max-h-[86vh] min-h-[720px] grid-rows-[minmax(430px,1fr)_auto] divide-y divide-outline overflow-hidden">
              <section className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-outline px-4 py-3">
                  <div className="text-sm font-semibold text-on-surface">采集域配置对照</div>
                  <div className="flex gap-2">
                    <button className="inline-flex h-8 items-center rounded border border-outline bg-white px-3 text-xs font-semibold text-on-surface" onClick={regenerateCollectorConfigDraft}>
                      从当前选择生成
                    </button>
                    <button className="inline-flex h-8 items-center rounded border border-outline bg-white px-3 text-xs font-semibold text-on-surface" onClick={() => navigator.clipboard?.writeText(patchedCollectorDomainConfig)}>
                      复制
                    </button>
                  </div>
                </div>
                <div className="collector-config-compare-grid grid min-h-0 flex-1 divide-y divide-outline overflow-hidden lg:grid-cols-[0.95fr_1.1fr_0.95fr] lg:divide-x lg:divide-y-0">
                  <section className="read-only flex min-h-0 flex-col bg-surface-low/55">
                    <div className="flex items-start justify-between gap-3 border-b border-outline bg-surface-low px-4 py-2.5">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">当前运行配置</div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">{selectedAgentLabel}</div>
                      </div>
                      <span className="rounded border border-outline bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">只读</span>
                    </div>
                    <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[11px] leading-5 text-muted whitespace-pre-wrap">{currentCollectorDomainConfig}</pre>
                  </section>
                  <section className="read-only flex min-h-0 flex-col bg-surface-lowest">
                    <div className="flex items-start justify-between gap-3 border-b border-outline bg-white px-4 py-2.5">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">Patch 后配置</div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">{shortHash(preview?.configHash || createdRoute?.route.configHash || '')}</div>
                      </div>
                      <span className="rounded border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">只读</span>
                    </div>
                    <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[11px] leading-5 text-on-surface whitespace-pre-wrap">{patchedCollectorDomainConfig}</pre>
                  </section>
                  <section className="editable flex min-h-0 flex-col bg-white shadow-[inset_3px_0_0_rgba(13,91,215,0.72)]">
                    <div className="flex items-start justify-between gap-3 border-b border-primary/20 bg-primary-soft/40 px-4 py-2.5">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">本次增量配置</div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">{selectedServiceLabel}</div>
                      </div>
                      <span className="rounded border border-primary/25 bg-white px-2 py-0.5 text-[11px] font-semibold text-primary">可编辑</span>
                    </div>
                    <textarea
                      className="min-h-0 flex-1 resize-none border-0 bg-white p-4 font-mono text-xs leading-5 text-on-surface outline-none focus:bg-primary-soft/10"
                      value={collectorConfigDraft}
                      onChange={(event) => setCollectorConfigDraft(event.target.value)}
                      spellCheck={false}
                    />
                  </section>
                </div>
              </section>
              <section className="规则自检抽屉 flex min-h-0 flex-col bg-surface-lowest">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-low"
                  aria-expanded={parseRulesDrawerOpen}
                  onClick={() => setParseRulesDrawerOpen((open) => !open)}
                >
                  <div>
                    <div className="text-sm font-semibold text-on-surface">解析规则自检</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">{parserDraftMode === 'none' ? '未启用解析' : parserDraftMode}</div>
                  </div>
                  <span className="rounded border border-outline bg-white px-3 py-1 text-xs font-semibold text-primary">
                    {parseRulesDrawerOpen ? '收起自检' : '展开自检'}
                  </span>
                </button>
                {parseRulesDrawerOpen ? <div className="grid min-h-[260px] divide-y divide-outline overflow-hidden border-t border-outline bg-white lg:grid-cols-[0.9fr_1.1fr_0.9fr] lg:divide-x lg:divide-y-0">
                <section className="flex min-h-0 flex-col">
                  <div className="border-b border-outline px-4 py-3">
                    <div className="text-sm font-semibold text-on-surface">日志样本</div>
                  </div>
                  <textarea className="min-h-0 flex-1 resize-none border-0 bg-white p-4 font-mono text-xs leading-5 text-on-surface outline-none" value={parseSample} onChange={(event) => setParseSample(event.target.value)} />
                </section>
                <section className="flex min-h-0 flex-col">
                  <div className="border-b border-outline px-4 py-3">
                    <div className="text-sm font-semibold text-on-surface">解析规则自检</div>
                  </div>
                  <div className="grid gap-3 overflow-auto p-4">
                    <label className="text-xs font-semibold text-muted">
                      规则类型
                      <select className="console-input mt-1 w-full" value={parserDraftMode} onChange={(event) => setParserDraftMode(event.target.value as ParserMode)}>
                        <option value="none">不解析</option>
                        <option value="json">JSON</option>
                        <option value="regex">Regex</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      规则名
                      <input className="console-input mt-1 w-full" value={parserDraftRuleName} onChange={(event) => setParserDraftRuleName(event.target.value)} disabled={parserDraftMode === 'none'} />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Regex Pattern
                      <textarea className="console-input mt-1 min-h-[88px] w-full resize-none font-mono text-xs leading-5" value={parserDraftPattern} onChange={(event) => setParserDraftPattern(event.target.value)} disabled={parserDraftMode !== 'regex'} />
                    </label>
                    {parserDraftMode === 'regex' && !parseDraftValid ? <WarnLine message="Regex 需要使用命名捕获组，例如 (?P<level>INFO)。" /> : null}
                  </div>
                </section>
                <section className="flex min-h-0 flex-col">
                  <div className="flex items-center justify-between border-b border-outline px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-on-surface">预览</div>
                    </div>
                    <button className="inline-flex h-8 items-center gap-2 rounded border border-primary bg-white px-3 text-xs font-semibold text-primary disabled:opacity-60" disabled={parsePreviewMutation.isPending || !parseDraftValid} onClick={() => parsePreviewMutation.mutate()}>
                      {parsePreviewMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      预览
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto p-4">
                    {parsePreviewMutation.error ? <ErrorLine message={(parsePreviewMutation.error as Error).message} /> : null}
                    {parsePreviewMutation.data?.errors.map((item) => <ErrorLine key={item} message={item} />)}
                    {parsePreviewMutation.data?.warnings.map((item) => <WarnLine key={item} message={item} />)}
                    <pre className="min-h-[170px] rounded border border-outline bg-surface-lowest p-3 font-mono text-xs leading-5 text-on-surface whitespace-pre-wrap">
                      {parsePreviewMutation.data ? JSON.stringify(parsePreviewMutation.data.fields, null, 2) : '未预览'}
                    </pre>
                  </div>
                </section>
                </div> : null}
              </section>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-outline bg-surface-lowest px-4 py-3">
              <button className="rounded-lg border border-outline bg-white px-4 py-2 text-sm font-semibold text-on-surface" onClick={() => setParseDialogOpen(false)}>取消</button>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!parseDraftValid || parsePreviewMutation.data?.status === 'error'} onClick={applyParseDraft}>应用</button>
            </div>
          </div>
        </div>
      ), document.body) : null}

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
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={!canPreview || previewMutation.isPending} onClick={() => previewMutation.mutate()} title={previewDisabledReason || '生成 Agent 配置预览'}>
              {previewMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              预览配置
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary transition-all active:translate-y-px disabled:opacity-60" disabled={!preview || createRouteMutation.isPending} onClick={() => createRouteMutation.mutate()} title={saveDisabledReason || (selectedRouteId ? '更新日志路由' : '保存日志路由')}>
              {createRouteMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {selectedRouteId ? '更新路由' : '保存路由'}
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline bg-white px-4 text-sm font-semibold text-on-surface transition-all active:translate-y-px disabled:opacity-60" disabled={!createdRoute || probeMutation.isPending} onClick={() => createdRoute && probeMutation.mutate(createdRoute.route.id)} title={probeDisabledReason || '检查日志路由连通性'}>
              <RefreshCw className={`h-4 w-4 ${probeMutation.isPending ? 'animate-spin' : ''}`} />
              连通性检查
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={!createdRoute || publishMutation.isPending || Boolean(preview?.publishBlocked)} onClick={() => publishMutation.mutate(undefined)} title={publishDisabledReason || '生成发布预览'}>
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

function parseSelector(text: string) {
  return Object.fromEntries(text.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    const [key, ...rest] = item.split('=');
    return [key.trim(), rest.join('=').trim()];
  }).filter(([key, value]) => key && value));
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

function PublishPreviewPanel({ preview }: { preview: LogPublishResult }) {
  const rows = preview.diffs.length > 0
    ? preview.diffs.map((item) => ({
      key: `${item.clusterId}/${item.namespace}/${item.apiVersion}/${item.kind}/${item.name}`,
      operation: publishOperationLabel(item.operation),
      clusterId: item.clusterId,
      namespace: item.namespace || 'cluster',
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
      hash: shortHash(item.afterHash),
    }))
    : preview.resources.map((item) => ({
      key: `${item.clusterId}/${item.namespace}/${item.apiVersion}/${item.kind}/${item.name}`,
      operation: 'dry-run',
      clusterId: item.clusterId,
      namespace: item.namespace || 'cluster',
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
      hash: '-',
    }));
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-primary/25 bg-primary-soft/35">
      <div className="flex flex-col gap-3 border-b border-primary/15 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-on-surface">发布预览</div>
          <div className="mt-1 flex flex-wrap gap-2 font-mono text-[11px] text-muted">
            <span>preview {shortHash(preview.previewId)}</span>
            <span>audit {shortHash(preview.auditId)}</span>
            <span>{rows.length} resources</span>
          </div>
        </div>
        <span className="inline-flex w-fit rounded border border-primary/20 bg-white px-2 py-1 font-mono text-[11px] font-semibold text-primary">等待确认</span>
      </div>
      {preview.warnings.map((item) => <WarnLine key={item} message={item} />)}
      <div className="overflow-auto bg-white/70">
        <table className="console-table min-w-[760px] w-full">
          <thead>
            <tr>
              <th>动作</th>
              <th>资源</th>
              <th>Namespace</th>
              <th>Cluster</th>
              <th>API</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td><span className="rounded border border-outline bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">{row.operation}</span></td>
                <td className="font-mono text-xs font-semibold text-on-surface">{row.kind}/{row.name}</td>
                <td className="font-mono text-xs text-muted">{row.namespace}</td>
                <td className="font-mono text-xs text-muted">{row.clusterId || '-'}</td>
                <td className="font-mono text-xs text-muted">{row.apiVersion}</td>
                <td className="font-mono text-xs text-muted">{row.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function publishOperationLabel(value: string) {
  switch (value) {
    case 'create':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
      return 'delete';
    default:
      return value || 'apply';
  }
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold ${statusPillClass(tone)}`}>
      {label}
    </span>
  );
}

function RouteStatusCell({ route }: { route: LogRouteView }) {
  const lifecycle = routeLifecycle(route);
  const probeFailed = route.route.lastProbeStatus === 'failed' || route.route.lastProbeStatus === 'error';
  return (
    <div className="min-w-[150px]">
      <div className="flex items-center gap-2">
        <StatusPill label={lifecycle.label} tone={lifecycle.tone} />
        {probeFailed ? <AlertTriangle className="h-3.5 w-3.5 text-warning" /> : null}
      </div>
      <div className="mt-1 max-w-[240px] truncate text-xs text-muted">{lifecycle.detail}</div>
      {route.route.lastProbeMessage ? <div className="mt-1 max-w-[240px] truncate text-[11px] text-muted">探测：{route.route.lastProbeMessage}</div> : null}
    </div>
  );
}

function SummaryCard({ service, source, scope, agent, endpoint, parser, hash, publish, requirements }: { service: string; source: string; scope: string; agent: string; endpoint: string; parser: string; hash: string; publish: string; requirements: RequirementItem[] }) {
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
          ['配置 hash', shortHash(hash)],
          ['发布状态', publish],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-outline bg-surface-lowest px-3 py-2">
            <div className="text-[11px] text-muted">{label}</div>
            <div className="mt-1 break-all font-mono text-xs text-on-surface">{value}</div>
          </div>
        ))}
        <div className="rounded border border-outline bg-surface-lowest px-3 py-2">
          <div className="text-[11px] text-muted">配置检查</div>
          <div className="mt-2 grid gap-1.5">
            {requirements.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted">{item.label}</span>
                <span className={`shrink-0 font-mono font-semibold ${item.done ? 'text-primary' : 'text-warning'}`}>{item.done ? 'ready' : 'missing'}</span>
              </div>
            ))}
          </div>
        </div>
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
