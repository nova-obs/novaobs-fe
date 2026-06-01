import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Copy, Play, Plus, RefreshCw, Save, Search, Server, Settings2, Sparkles, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from '../k8s/api';
import { logSourceLabel, logsApi, type LogAccessSource, type LogEndpoint, type LogParsePreviewResult, type LogParseRule, type LogPublishResult, type LogRouteInput, type LogRoutePreview, type LogRouteView, type LogSourceType, type LogsAgentGroupSummary, type LogsWorkload } from './api';

const sourceTabs: Array<{ value: LogAccessSource; label: string }> = [
  { value: 'k8s', label: 'K8s' },
  { value: 'vm', label: 'VM' },
];

const emptyEndpoint = {
  name: '',
  description: '',
  writeURL: '',
  queryURL: '',
  vmuiURL: '',
  secretRef: '',
  scopeType: 'global',
  clusterId: '',
};

const defaultParseSample = '{"level":"INFO","message":"service started"}';
const collectorEndpointPlaceholder = '<victorialogs-write-url>';

type ParserMode = 'none' | 'json' | 'regex';

function endpointToForm(endpoint: LogEndpoint) {
  return {
    name: endpoint.name ?? '',
    description: endpoint.description ?? '',
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
    && form.writeURL === endpoint.writeURL
    && form.queryURL === endpoint.queryURL
    && form.vmuiURL === endpoint.vmuiURL
    && form.secretRef === endpoint.secretRef
    && form.scopeType === endpoint.scopeType
    && form.clusterId === endpoint.clusterId;
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

function renderCollectorConfigDraft(input: {
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
}) {
  const includePath = input.sourceType === 'vm_file' ? input.vmPath || '/data/logs/*.log' : '/var/log/pods/*_*_*/*/*.log';
  const endpoint = input.endpoint?.writeURL || collectorEndpointPlaceholder;
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
  return [
    'receivers:',
    '  filelog/novaobs:',
    '    include:',
    `      - ${includePath}`,
    '    start_at: end',
    '    include_file_path: true',
    '    include_file_name: false',
    ...(parserOperators.length ? ['    operators:', ...parserOperators] : []),
    'processors:',
    '  resource/novaobs:',
    '    attributes:',
    `        - key: service.name`,
    `          value: ${input.serviceName || input.workloadName || 'unknown-service'}`,
    `          action: upsert`,
    ...scopeAttributes,
    '  batch:',
    '    timeout: 1s',
    'exporters:',
    '  otlphttp/victorialogs:',
    `    endpoint: ${endpoint}`,
    'service:',
    '  pipelines:',
    '    logs:',
    '      receivers: [filelog/novaobs]',
    '      processors: [resource/novaobs, batch]',
    '      exporters: [otlphttp/victorialogs]',
    '',
  ].join('\n');
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

export function LogsOnboardingPage() {
  const queryClient = useQueryClient();
  const { data: workspace, isLoading, error, refetch } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });

  const [sourceMode, setSourceMode] = useState<LogAccessSource>('k8s');
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [agentNamespace, setAgentNamespace] = useState('novaobs-system');
  const [workloadKey, setWorkloadKey] = useState('');
  const [hostGroup, setHostGroup] = useState('');
  const [hostSelectorText, setHostSelectorText] = useState('');
  const [vmPath, setVmPath] = useState('');
  const [syncEnvironment, setSyncEnvironment] = useState('prod');
  const [syncOwnerTeam, setSyncOwnerTeam] = useState('');
  const [collectorConfigYaml, setCollectorConfigYaml] = useState('');
  const [parserMode, setParserMode] = useState<ParserMode>('none');
  const [parserRuleName, setParserRuleName] = useState('default-parser');
  const [parserPattern, setParserPattern] = useState('^(?P<level>[A-Z]+)\\s+(?P<message>.*)$');
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [parseSample, setParseSample] = useState(defaultParseSample);
  const [collectorConfigDraft, setCollectorConfigDraft] = useState('');
  const [parserDraftMode, setParserDraftMode] = useState<ParserMode>('none');
  const [parserDraftRuleName, setParserDraftRuleName] = useState('default-parser');
  const [parserDraftPattern, setParserDraftPattern] = useState('^(?P<level>[A-Z]+)\\s+(?P<message>.*)$');
  const [endpointForm, setEndpointForm] = useState(emptyEndpoint);
  const [preview, setPreview] = useState<LogRoutePreview | null>(null);
  const [createdRoute, setCreatedRoute] = useState<LogRouteView | null>(null);
  const [pendingPublish, setPendingPublish] = useState<LogPublishResult | null>(null);

  const services = workspace?.services ?? [];
  const groups = workspace?.collectorGroups ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const clusters = workspace?.clusters ?? [];
  const routes = workspace?.routes ?? [];
  const sourceType: LogSourceType = sourceMode === 'vm' ? 'vm_file' : 'k8s_stdout';

  useEffect(() => {
    if (!serviceId && services[0]?.id) setServiceId(services[0].id);
    if (!clusterId && clusters[0]?.id) setClusterId(clusters[0].id);
  }, [clusterId, serviceId, services, clusters]);

  useEffect(() => {
    setPreview(null);
    setCreatedRoute(null);
    setPendingPublish(null);
  }, [sourceType, serviceId, endpointId, clusterId, namespace, workloadKey, hostGroup, hostSelectorText, vmPath, collectorConfigYaml, parserMode, parserRuleName, parserPattern]);

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
    if (!query) return services;
    return services.filter((service) => `${service.name} ${service.displayName} ${service.ownerTeam}`.toLowerCase().includes(query));
  }, [serviceQuery, services]);

  const selectedService = services.find((item) => item.id === serviceId) ?? null;
  const selectedGroup = groups.find((item) => item.id === createdRoute?.route.agentGroupId) ?? findCollectorDomain(groups, sourceType, clusterId, agentNamespace, selectedService?.environment || syncEnvironment, hostGroup);
  const availableEndpoints = useMemo(() => {
    if (sourceType === 'vm_file') return endpoints.filter((item) => item.scopeType !== 'k8s_cluster');
    return endpoints.filter((item) => item.scopeType === 'global' || (item.scopeType === 'k8s_cluster' && item.clusterId === clusterId));
  }, [clusterId, endpoints, sourceType]);
  const selectedEndpoint = availableEndpoints.find((item) => item.id === endpointId) ?? null;
  const effectiveEndpoint = selectedEndpoint ?? (sourceType !== 'vm_file' ? availableEndpoints[0] ?? null : null);
  const endpointDraftSaved = selectedEndpoint ? endpointFormMatchesEndpoint(endpointForm, selectedEndpoint) : false;
  const selectedCluster = clusters.find((item) => item.id === clusterId) ?? null;
  const selectedWorkload = workloads.find((item) => workloadIdentity(item) === workloadKey) ?? null;
  const clusterRoutes = useMemo(() => routes.filter((item) => item.source?.clusterId === clusterId), [clusterId, routes]);
  const clusterRouteNamespaces = Array.from(new Set(clusterRoutes.map((item) => item.source?.namespace).filter(Boolean)));
  const clusterRouteWorkloads = clusterRoutes.filter((item) => item.source?.workloadName).length;
  const currentParseRules = useMemo(() => buildParserRules(parserMode, parserRuleName, parserPattern), [parserMode, parserRuleName, parserPattern]);
  const draftParseRules = useMemo(() => buildParserRules(parserDraftMode, parserDraftRuleName, parserDraftPattern), [parserDraftMode, parserDraftRuleName, parserDraftPattern]);

  useEffect(() => {
    if (sourceType !== 'vm_file') {
      const clusterEndpoint = availableEndpoints.find((item) => item.scopeType === 'k8s_cluster' && item.clusterId === clusterId);
      setEndpointId((current) => current && availableEndpoints.some((item) => item.id === current) ? current : clusterEndpoint?.id ?? availableEndpoints[0]?.id ?? '');
      return;
    }
    setEndpointId((current) => current && availableEndpoints.some((item) => item.id === current) ? current : availableEndpoints[0]?.id ?? '');
  }, [availableEndpoints, clusterId, sourceType]);

  const createEndpointMutation = useMutation({
    mutationFn: () => logsApi.createEndpoint({
      ...endpointForm,
      clusterId: endpointForm.scopeType === 'k8s_cluster' ? (endpointForm.clusterId || clusterId) : '',
    }),
    onSuccess: async (endpoint) => {
      setEndpointId(endpoint.id);
      setEndpointForm(endpointToForm(endpoint));
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  const syncK8sServicesMutation = useMutation({
    mutationFn: () => logsApi.syncK8sServices({
      clusterId,
      namespace,
      environment: syncEnvironment,
      ownerTeam: syncOwnerTeam,
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
    mutationFn: () => logsApi.createRoute(buildRouteInput()),
    onSuccess: async (created) => {
      setCreatedRoute(created);
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
    setCollectorConfigDraft(collectorConfigYaml || renderCollectorConfigDraft({
      sourceType,
      clusterId,
      namespace,
      agentNamespace,
      workloadName: selectedWorkload?.name || '',
      hostGroup,
      vmPath,
      endpoint: effectiveEndpoint,
      serviceName: selectedService?.displayName || selectedService?.name || '',
      parseRules: currentParseRules,
    }));
    setParserDraftMode(parserMode);
    setParserDraftRuleName(parserRuleName);
    setParserDraftPattern(parserPattern);
    setParseDialogOpen(true);
  }

  function applyParseDraft() {
    if (!parseDraftValid) return;
    setCollectorConfigYaml(collectorConfigDraft);
    setParserMode(parserDraftMode);
    setParserRuleName(parserDraftRuleName);
    setParserPattern(parserDraftPattern);
    setParseDialogOpen(false);
  }

  function regenerateCollectorConfigDraft() {
    setCollectorConfigDraft(renderCollectorConfigDraft({
      sourceType,
      clusterId,
      namespace,
      agentNamespace,
      workloadName: selectedWorkload?.name || '',
      hostGroup,
      vmPath,
      endpoint: effectiveEndpoint,
      serviceName: selectedService?.displayName || selectedService?.name || '',
      parseRules: draftParseRules,
    }));
  }

  const hasEndpointForSource = sourceType === 'vm_file' ? Boolean(effectiveEndpoint) : Boolean(effectiveEndpoint);
  const parseValid = parserMode !== 'regex' || parserPattern.includes('?P<');
  const previewRequirements: RequirementItem[] = [
    { key: 'service', label: '选择服务', done: Boolean(serviceId) },
    {
      key: 'endpoint',
      label: sourceType === 'vm_file' ? '选择 VictoriaLogs 端点' : '选择或创建当前集群可用的 VictoriaLogs 端点',
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
  const endpointCreateMissing = [
    endpointForm.name ? '' : '名称',
    endpointForm.writeURL ? '' : '写入 URL',
    endpointForm.queryURL ? '' : '查询 URL',
    endpointForm.vmuiURL ? '' : 'VMUI URL',
  ].filter(Boolean);
  const endpointDraftTouched = Boolean(endpointForm.name || endpointForm.writeURL || endpointForm.queryURL || endpointForm.vmuiURL || endpointForm.secretRef);
  const canCreateEndpoint = endpointCreateMissing.length === 0;
  const collectorConfigApplied = Boolean(collectorConfigYaml.trim());
  const collectorConfigState = !parseValid ? '需修正' : collectorConfigApplied ? '已应用' : '未配置';
  const parseDraftValid = parserDraftMode !== 'regex' || parserDraftPattern.includes('?P<');
  const selectedServiceLabel = selectedService?.displayName || selectedService?.name || '-';
  const selectedAgentLabel = selectedGroup?.displayName || selectedGroup?.name || derivedCollectorDomainLabel(sourceType, clusterId, agentNamespace, hostGroup);
  const selectedAgentStatus = selectedGroup ? `${selectedGroup.status || 'unknown'} · online ${selectedGroup.onlineInstances}` : '接入成功后自动创建';
  const selectedEndpointLabel = effectiveEndpoint?.name || (sourceType !== 'vm_file' ? '使用集群绑定端点' : '-');
  const selectedScopeLabel = sourceType === 'vm_file'
    ? `${hostGroup || 'VM'} · ${vmPath || '-'}`
    : `${selectedCluster?.name || clusterId || '-'} / ${namespace || '-'} / ${selectedWorkload ? `${selectedWorkload.kind}/${selectedWorkload.name}` : '-'}`;
  const activeStep = preview ? 4 : selectedService && hasEndpointForSource ? 3 : sourceType === 'vm_file' ? (vmPath ? 2 : 1) : (selectedWorkload ? 2 : 1);
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
              <div className="mt-0.5 font-mono text-[11px] text-muted">{isLoading ? 'loading' : `${services.length} services · ${routes.length} routes`}</div>
            </div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {sourceTabs.map((item) => (
                <button
                  key={item.value}
                  className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition-all active:translate-y-px ${
                    sourceMode === item.value ? 'border-primary bg-primary-soft text-primary' : 'border-outline bg-white/82 text-muted hover:border-primary/40 hover:text-on-surface'
                  }`}
                  onClick={() => setSourceMode(item.value)}
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
            <StepCard index={1} title="采集范围" description={sourceType === 'vm_file' ? '主机组 / 标签 / 路径' : '集群 / Namespace / Workload'} active={activeStep === 1} done={activeStep > 1} />
            <StepCard index={2} title="服务绑定" description="服务 / 采集域 / VL" active={activeStep === 2} done={activeStep > 2} />
            <StepCard index={3} title="Collector 配置" description={collectorConfigState} active={activeStep === 3} done={activeStep > 3} />
            <StepCard index={4} title="预览发布" description={preview ? shortHash(preview.configHash) : '等待预览'} active={activeStep === 4} done={Boolean(createdRoute)} />
          </div>
        </section>

        <DataPanel title="绑定关系" meta="service / collection domain / endpoint">
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="text-sm font-semibold">
              服务
              <div className="relative mt-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input className="console-input w-full pl-8" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="搜索服务" />
              </div>
              <select className="console-input mt-2 w-full" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                <option value="">选择服务</option>
                {filteredServices.map((service) => (
                  <option key={service.id} value={service.id}>{service.displayName || service.name}</option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-outline bg-surface-lowest px-3 py-2.5">
              <div className="text-sm font-semibold text-on-surface">采集域</div>
              <div className="mt-2 truncate font-mono text-xs text-on-surface">{selectedAgentLabel}</div>
              <div className="mt-1 text-[11px] font-semibold text-muted">{selectedAgentStatus}</div>
            </div>
            <label className="text-sm font-semibold">
              VictoriaLogs
              <select className="console-input mt-2 w-full" value={endpointId} onChange={(event) => setEndpointId(event.target.value)}>
                {sourceType !== 'vm_file' ? <option value="">使用集群绑定端点</option> : <option value="">选择端点</option>}
                {availableEndpoints.map((endpoint) => (
                  <option key={endpoint.id} value={endpoint.id}>{endpoint.name}{endpoint.scopeType === 'k8s_cluster' ? ` · ${endpoint.clusterId}` : ''}</option>
                ))}
              </select>
            </label>
          </div>
        </DataPanel>

        <DataPanel title={sourceType === 'vm_file' ? 'VM 采集范围' : 'K8s 采集范围'} meta={logSourceLabel(sourceType)}>
          {sourceType === 'vm_file' ? (
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="text-sm font-semibold">主机组<input className="console-input mt-2 w-full" value={hostGroup} onChange={(event) => setHostGroup(event.target.value)} placeholder="prod-app-vms" /></label>
              <label className="text-sm font-semibold">主机标签<input className="console-input mt-2 w-full" value={hostSelectorText} onChange={(event) => setHostSelectorText(event.target.value)} placeholder="env=prod,role=api" /></label>
              <label className="text-sm font-semibold">日志路径<input className="console-input mt-2 w-full" value={vmPath} onChange={(event) => setVmPath(event.target.value)} placeholder="/data/logs/*.log" /></label>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-on-surface">可用集群</div>
                  <span className="text-[11px] font-semibold text-muted">{clusters.length} clusters</span>
                </div>
                <div className="space-y-2">
                  {clusters.length === 0 ? <Empty label="暂无已登记集群" /> : clusters.map((cluster) => (
                    <button
                      key={cluster.id}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-all active:translate-y-px ${
                        cluster.id === clusterId ? 'border-primary bg-primary-soft text-primary shadow-[inset_3px_0_0_#0d5bd7]' : 'border-outline bg-white text-on-surface hover:border-primary/40 hover:bg-surface-low'
                      }`}
                      onClick={() => { setClusterId(cluster.id); setNamespace(''); setWorkloadKey(''); }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{cluster.name || cluster.id}</span>
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${cluster.readOnly ? 'border-amber-500/30 bg-amber-50 text-amber-700' : 'border-primary/20 bg-white text-primary'}`}>
                          {cluster.readOnly ? '只读' : '可发布'}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted">{cluster.version || '-'} · {cluster.accessMode || '-'}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-outline bg-surface-lowest px-3 py-3">
                    <div className="text-xs font-semibold text-muted">集群采集域</div>
                    <div className="mt-1 truncate font-mono text-sm font-semibold text-on-surface">{selectedAgentLabel}</div>
                    <div className="mt-1 text-[11px] font-semibold text-muted">{selectedAgentStatus}</div>
                  </div>
                  <div className="rounded-lg border border-outline bg-surface-lowest px-3 py-3">
                    <div className="text-xs font-semibold text-muted">已接入范围</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{clusterRouteNamespaces.length} namespaces · {clusterRouteWorkloads} workloads</div>
                    <div className="mt-1 truncate text-[11px] text-muted">{clusterRouteNamespaces.join(', ') || '当前集群暂无日志路由'}</div>
                  </div>
                  <div className="rounded-lg border border-outline bg-surface-lowest px-3 py-3">
                    <div className="text-xs font-semibold text-muted">标准输出路径</div>
                    <div className="mt-1 truncate font-mono text-sm font-semibold text-on-surface">/var/log/pods/*_*_*/*/*.log</div>
                    <div className="mt-1 text-[11px] text-muted">新增业务通过追加 route 更新采集域配置</div>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="text-sm font-semibold">
                    Namespace
                    <select className="console-input mt-2 w-full" value={namespace} onChange={(event) => { setNamespace(event.target.value); setWorkloadKey(''); }} disabled={namespacesQuery.isLoading}>
                      <option value="">选择 Namespace</option>
                      {namespaces.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Workload
                    <select className="console-input mt-2 w-full" value={workloadKey} onChange={(event) => setWorkloadKey(event.target.value)} disabled={workloadsQuery.isLoading}>
                      <option value="">选择 Workload</option>
                      {workloads.map((item) => <option key={workloadIdentity(item)} value={workloadIdentity(item)}>{item.kind}/{item.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">Agent Namespace<input className="console-input mt-2 w-full" value={agentNamespace} onChange={(event) => setAgentNamespace(event.target.value)} /></label>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {workloads.slice(0, 8).map((item) => {
                    const identity = workloadIdentity(item);
                    const checked = workloadKey === identity;
                    return (
                    <button
                      key={identity}
                      className={`rounded-lg border px-3 py-2 text-left transition-all active:translate-y-px ${
                        checked ? 'border-primary bg-primary-soft text-primary' : 'border-outline bg-white text-on-surface hover:border-primary/40'
                      }`}
                      onClick={() => {
                        setWorkloadKey(identity);
                      }}
                    >
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      <div className="mt-1 text-[11px] text-muted">{checked ? '已选择' : item.kind} · running {item.podsRunning}/{item.podsTotal}</div>
                    </button>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-outline bg-surface-lowest px-3 py-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_150px] lg:items-end">
                    <div>
                      <div className="text-sm font-semibold text-on-surface">同步 Namespace 服务</div>
                      <div className="mt-1 text-xs text-muted">K8s Ops workload sync</div>
                    </div>
                    <label className="text-xs font-semibold text-muted">
                      环境
                      <input className="console-input mt-1 w-full" value={syncEnvironment} onChange={(event) => setSyncEnvironment(event.target.value)} />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Owner Team
                      <input className="console-input mt-1 w-full" value={syncOwnerTeam} onChange={(event) => setSyncOwnerTeam(event.target.value)} placeholder="sre" />
                    </label>
                    <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-sm font-semibold text-primary transition-all active:translate-y-px disabled:opacity-60" disabled={!clusterId || !namespace || syncK8sServicesMutation.isPending} onClick={() => syncK8sServicesMutation.mutate()}>
                      {syncK8sServicesMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      同步服务
                    </button>
                  </div>
                  {syncK8sServicesMutation.data ? <SuccessLine message={`已同步 ${syncK8sServicesMutation.data.total} 个 K8s 服务`} /> : null}
                  {syncK8sServicesMutation.error ? <ErrorLine message={(syncK8sServicesMutation.error as Error).message} /> : null}
                </div>
              </div>
            </div>
          )}
        </DataPanel>

        <DataPanel title="VictoriaLogs 端点" meta="endpoint">
          <div className="grid gap-3 lg:grid-cols-3">
            <input className="console-input" placeholder="名称" value={endpointForm.name} onChange={(event) => setEndpointForm({ ...endpointForm, name: event.target.value })} />
            <select className="console-input" value={endpointForm.scopeType} onChange={(event) => setEndpointForm({ ...endpointForm, scopeType: event.target.value, clusterId: event.target.value === 'k8s_cluster' ? clusterId : '' })}>
              <option value="global">全局端点</option>
              <option value="k8s_cluster">K8s 集群端点</option>
              <option value="vm">VM 端点</option>
            </select>
            <input className="console-input" placeholder="Cluster ID" value={endpointForm.scopeType === 'k8s_cluster' ? (endpointForm.clusterId || clusterId) : ''} onChange={(event) => setEndpointForm({ ...endpointForm, clusterId: event.target.value })} disabled={endpointForm.scopeType !== 'k8s_cluster'} />
            <input className="console-input" placeholder="写入 URL" value={endpointForm.writeURL} onChange={(event) => setEndpointForm({ ...endpointForm, writeURL: event.target.value })} />
            <input className="console-input" placeholder="查询 URL" value={endpointForm.queryURL} onChange={(event) => setEndpointForm({ ...endpointForm, queryURL: event.target.value })} />
            <input className="console-input" placeholder="VMUI URL" value={endpointForm.vmuiURL} onChange={(event) => setEndpointForm({ ...endpointForm, vmuiURL: event.target.value })} />
            <input className="console-input" placeholder="Secret Ref" value={endpointForm.secretRef} onChange={(event) => setEndpointForm({ ...endpointForm, secretRef: event.target.value })} />
            <button className="inline-flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!canCreateEndpoint || createEndpointMutation.isPending || endpointDraftSaved} onClick={() => createEndpointMutation.mutate()} title={endpointDraftSaved ? '当前端点已保存并选中' : canCreateEndpoint ? '新增 VictoriaLogs 端点' : `新增端点还需：${formatMissing(endpointCreateMissing)}`}>
              {createEndpointMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {endpointDraftSaved ? '已保存' : '新增端点'}
            </button>
          </div>
          {endpointDraftSaved ? <SuccessLine message={`当前端点已保存并选中：${selectedEndpoint?.name}`} /> : null}
          {endpointDraftTouched && endpointCreateMissing.length > 0 ? <WarnLine message={`新增端点还需：${formatMissing(endpointCreateMissing)}`} /> : null}
          {createEndpointMutation.error ? <ErrorLine message={(createEndpointMutation.error as Error).message} /> : null}
        </DataPanel>

        <DataPanel title="Collector 配置">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
            <div className="rounded-lg border border-outline bg-surface-lowest px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
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
            </div>
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-sm font-semibold text-primary transition-all active:translate-y-px" onClick={openParseDialog}>
              <Settings2 className="h-4 w-4" />
              配置
            </button>
          </div>
          {!parseValid ? <WarnLine message="Regex 需要使用命名捕获组，例如 (?P<level>INFO)。" /> : null}
        </DataPanel>

        <DataPanel title="配置预览" meta={preview ? `config ${shortHash(preview.configHash)}` : '等待预览'}>
          <MutationErrors errors={[previewMutation.error, createRouteMutation.error, probeMutation.error, publishMutation.error]} />
          {preview?.publishBlocked ? <WarnLine message={preview.publishBlockedReason} /> : null}
          {preview?.warnings.map((item) => <WarnLine key={item} message={item} />)}
          {probeMutation.data ? <SuccessLine message={probeMutation.data.message} /> : null}
          {publishMutation.data ? <SuccessLine message={publishMutation.data.message || publishMutation.data.status} /> : null}
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
                    <th>VL</th>
                    <th>Hash</th>
                    <th>发布</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => {
                    const service = services.find((item) => item.id === route.route.serviceId);
                    return (
                      <tr key={route.route.id}>
                        <td className="font-semibold text-on-surface">{service?.displayName || service?.name || route.route.serviceId}</td>
                        <td>{logSourceLabel(route.route.sourceType)}</td>
                        <td className="font-mono text-xs text-muted">{routeTitle(route)}</td>
                        <td>{route.endpoint?.name || '-'}</td>
                        <td className="font-mono text-xs">{shortHash(route.route.configHash)}</td>
                        <td>{route.route.lastPublishStatus || route.route.status}</td>
                        <td><Link className="text-primary hover:underline" to={`/logs/agents?agent_group_id=${route.route.agentGroupId}&route_id=${route.route.id}`}>Agent 状态</Link></td>
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
            publish={publishMutation.data?.status || createdRoute?.route.lastPublishStatus || '-'}
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
            <div className="grid max-h-[86vh] min-h-[720px] grid-rows-[minmax(360px,1fr)_minmax(260px,0.45fr)] divide-y divide-outline overflow-hidden">
              <section className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-outline px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-on-surface">完整 collector.yaml</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="inline-flex h-8 items-center rounded border border-outline bg-white px-3 text-xs font-semibold text-on-surface" onClick={regenerateCollectorConfigDraft}>
                      从当前选择生成
                    </button>
                    <button className="inline-flex h-8 items-center rounded border border-outline bg-white px-3 text-xs font-semibold text-on-surface" onClick={() => navigator.clipboard?.writeText(collectorConfigDraft)}>
                      复制
                    </button>
                  </div>
                </div>
                <textarea
                  className="min-h-0 flex-1 resize-none border-0 bg-white p-4 font-mono text-xs leading-5 text-on-surface outline-none"
                  value={collectorConfigDraft}
                  onChange={(event) => setCollectorConfigDraft(event.target.value)}
                  spellCheck={false}
                />
              </section>
              <div className="grid min-h-0 divide-y divide-outline overflow-hidden lg:grid-cols-[0.9fr_1.1fr_0.9fr] lg:divide-x lg:divide-y-0">
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
              </div>
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
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary transition-all active:translate-y-px disabled:opacity-60" disabled={!preview || createRouteMutation.isPending} onClick={() => createRouteMutation.mutate()} title={saveDisabledReason || '保存日志路由'}>
              {createRouteMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存路由
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline bg-white px-4 text-sm font-semibold text-on-surface transition-all active:translate-y-px disabled:opacity-60" disabled={!createdRoute || probeMutation.isPending} onClick={() => createdRoute && probeMutation.mutate(createdRoute.route.id)} title={probeDisabledReason || '检查日志路由连通性'}>
              <RefreshCw className={`h-4 w-4 ${probeMutation.isPending ? 'animate-spin' : ''}`} />
              连通性检查
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={!createdRoute || publishMutation.isPending || Boolean(preview?.publishBlocked)} onClick={() => publishMutation.mutate(undefined)} title={publishDisabledReason || '发布 Agent 配置'}>
              {publishMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              发布
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

function SummaryCard({ service, source, scope, agent, endpoint, parser, hash, publish, requirements }: { service: string; source: string; scope: string; agent: string; endpoint: string; parser: string; hash: string; publish: string; requirements: RequirementItem[] }) {
  return (
    <DataPanel title="本次接入" meta="summary">
      <div className="space-y-3">
        {[
          ['服务', service],
          ['来源', source],
          ['采集范围', scope],
          ['采集域', agent],
          ['VL 端点', endpoint],
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
