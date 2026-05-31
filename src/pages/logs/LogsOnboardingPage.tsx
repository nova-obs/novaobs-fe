import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Copy, Play, Plus, RefreshCw, Save, Search, Server, Sparkles, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from '../k8s/api';
import { logSourceLabel, logsApi, type LogAccessSource, type LogEndpoint, type LogPublishResult, type LogRouteInput, type LogRoutePreview, type LogRouteView, type LogSourceType, type LogsWorkload } from './api';

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

export function LogsOnboardingPage() {
  const queryClient = useQueryClient();
  const { data: workspace, isLoading, error, refetch } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });

  const [sourceMode, setSourceMode] = useState<LogAccessSource>('k8s');
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [agentGroupId, setAgentGroupId] = useState('');
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
  const [parseMode, setParseMode] = useState<'none' | 'json' | 'regex'>('none');
  const [parseRuleName, setParseRuleName] = useState('default-parser');
  const [parsePattern, setParsePattern] = useState('^(?P<level>[A-Z]+)\\s+(?P<message>.*)$');
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
    if (!agentGroupId && groups[0]?.id) setAgentGroupId(groups[0].id);
    if (!clusterId && clusters[0]?.id) setClusterId(clusters[0].id);
  }, [agentGroupId, clusterId, groups, serviceId, services, clusters]);

  useEffect(() => {
    setPreview(null);
    setCreatedRoute(null);
    setPendingPublish(null);
  }, [sourceType, serviceId, agentGroupId, endpointId, clusterId, namespace, workloadKey, hostGroup, hostSelectorText, vmPath, parseMode, parseRuleName, parsePattern]);

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
      setWorkloadKey(workloadIdentity(workloads[0]));
    }
  }, [sourceType, workloadKey, workloads]);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return services;
    return services.filter((service) => `${service.name} ${service.displayName} ${service.ownerTeam}`.toLowerCase().includes(query));
  }, [serviceQuery, services]);

  const selectedService = services.find((item) => item.id === serviceId) ?? null;
  const selectedGroup = groups.find((item) => item.id === agentGroupId) ?? null;
  const availableEndpoints = useMemo(() => {
    if (sourceType === 'vm_file') return endpoints.filter((item) => item.scopeType !== 'k8s_cluster');
    return endpoints.filter((item) => item.scopeType === 'global' || (item.scopeType === 'k8s_cluster' && item.clusterId === clusterId));
  }, [clusterId, endpoints, sourceType]);
  const selectedEndpoint = availableEndpoints.find((item) => item.id === endpointId) ?? null;
  const selectedCluster = clusters.find((item) => item.id === clusterId) ?? null;
  const selectedWorkload = workloads.find((item) => workloadIdentity(item) === workloadKey) ?? null;

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
      setEndpointForm(emptyEndpoint);
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

  const createRouteMutation = useMutation({
    mutationFn: () => logsApi.createRoute(buildRouteInput()),
    onSuccess: async (route) => {
      setCreatedRoute(route);
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
    const hostSelector = parseSelector(hostSelectorText);
    return {
      name: selectedService?.displayName || selectedService?.name,
      serviceId,
      sourceType,
      agentGroupId,
      endpointId,
      k8s: {
        clusterId,
        namespace,
        agentNamespace,
        workloadKind: selectedWorkload?.kind,
        workloadName: selectedWorkload?.name,
        workloadSelector: selectedWorkload?.selector ?? {},
        parseRules: buildParseRules(),
      },
      vm: {
        hostGroup,
        hostSelector,
        pathPattern: vmPath,
        parseRules: buildParseRules(),
      },
    };
  }

  function buildParseRules() {
    if (parseMode === 'none') return [];
    return [{
      name: parseRuleName || `${parseMode}-parser`,
      ruleType: parseMode,
      pattern: parseMode === 'regex' ? parsePattern : undefined,
      enabled: true,
    }];
  }

  const hasEndpointForSource = sourceType === 'vm_file' ? Boolean(endpointId) : Boolean(endpointId || availableEndpoints.length);
  const parseValid = parseMode !== 'regex' || parsePattern.includes('?P<');
  const canPreview = Boolean(serviceId && agentGroupId && hasEndpointForSource && parseValid)
    && (sourceType === 'vm_file'
      ? Boolean(vmPath && (hostGroup || hostSelectorText.trim()))
      : Boolean(clusterId && namespace && selectedWorkload));
  const canCreateEndpoint = Boolean(endpointForm.name && endpointForm.writeURL && endpointForm.queryURL && endpointForm.vmuiURL);
  const selectedServiceLabel = selectedService?.displayName || selectedService?.name || '-';
  const selectedAgentLabel = selectedGroup?.displayName || selectedGroup?.name || '-';
  const selectedEndpointLabel = selectedEndpoint?.name || (sourceType !== 'vm_file' ? '使用集群绑定端点' : '-');
  const selectedScopeLabel = sourceType === 'vm_file'
    ? `${hostGroup || 'VM'} · ${vmPath || '-'}`
    : `${selectedCluster?.name || clusterId || '-'} / ${namespace || '-'} / ${selectedWorkload ? `${selectedWorkload.kind}/${selectedWorkload.name}` : '-'}`;
  const activeStep = preview ? 4 : selectedService && selectedGroup && hasEndpointForSource ? 3 : sourceType === 'vm_file' ? (vmPath ? 2 : 1) : (selectedWorkload ? 2 : 1);

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
            <StepCard index={2} title="服务绑定" description="服务 / AgentGroup / VL" active={activeStep === 2} done={activeStep > 2} />
            <StepCard index={3} title="解析策略" description={parseMode === 'none' ? 'raw' : parseMode} active={activeStep === 3} done={activeStep > 3} />
            <StepCard index={4} title="预览发布" description={preview ? shortHash(preview.configHash) : '等待预览'} active={activeStep === 4} done={Boolean(createdRoute)} />
          </div>
        </section>

        <DataPanel title="绑定关系" meta="service / agent / endpoint">
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
            <label className="text-sm font-semibold">
              AgentGroup
              <select className="console-input mt-2 w-full" value={agentGroupId} onChange={(event) => setAgentGroupId(event.target.value)}>
                <option value="">选择 AgentGroup</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.displayName || group.name}</option>
                ))}
              </select>
            </label>
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
                  {workloads.slice(0, 4).map((item) => (
                    <button
                      key={workloadIdentity(item)}
                      className={`rounded-lg border px-3 py-2 text-left transition-all active:translate-y-px ${
                        workloadIdentity(item) === workloadKey ? 'border-primary bg-primary-soft text-primary' : 'border-outline bg-white text-on-surface hover:border-primary/40'
                      }`}
                      onClick={() => setWorkloadKey(workloadIdentity(item))}
                    >
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      <div className="mt-1 text-[11px] text-muted">{item.kind} · running {item.podsRunning}/{item.podsTotal}</div>
                    </button>
                  ))}
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
            <button className="inline-flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!canCreateEndpoint || createEndpointMutation.isPending} onClick={() => createEndpointMutation.mutate()}>
              {createEndpointMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              新增端点
            </button>
          </div>
          {createEndpointMutation.error ? <ErrorLine message={(createEndpointMutation.error as Error).message} /> : null}
        </DataPanel>

        <DataPanel title="解析策略" meta={parseMode === 'none' ? 'raw log' : parseMode}>
          <div className="grid gap-3 lg:grid-cols-[180px_220px_minmax(0,1fr)]">
            <label className="text-sm font-semibold">
              模式
              <select className="console-input mt-2 w-full" value={parseMode} onChange={(event) => setParseMode(event.target.value as typeof parseMode)}>
                <option value="none">不解析</option>
                <option value="json">JSON</option>
                <option value="regex">Regex</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              规则名
              <input className="console-input mt-2 w-full" value={parseRuleName} onChange={(event) => setParseRuleName(event.target.value)} disabled={parseMode === 'none'} />
            </label>
            <label className="text-sm font-semibold">
              Regex Pattern
              <input className="console-input mt-2 w-full font-mono text-xs" value={parsePattern} onChange={(event) => setParsePattern(event.target.value)} disabled={parseMode !== 'regex'} />
            </label>
          </div>
          {parseMode === 'regex' && !parsePattern.includes('?P<') ? <WarnLine message="Regex 需要使用命名捕获组，例如 (?P<level>INFO)。" /> : null}
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
            parser={parseMode === 'none' ? 'raw' : parseMode}
            hash={preview?.configHash || createdRoute?.route.configHash || '-'}
            publish={publishMutation.data?.status || createdRoute?.route.lastPublishStatus || '-'}
          />
        </aside>
      </div>

      <div className="logs-onboarding-action-bar sticky bottom-3 z-[4] mt-4 rounded-lg border border-primary/20 bg-white/95 p-3 shadow-[0_12px_36px_rgba(24,52,96,0.18)] backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-muted">当前选择</div>
            <div className="mt-1 truncate text-sm font-semibold text-on-surface">
              {selectedScopeLabel} · {selectedServiceLabel} · {selectedEndpointLabel}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={!canPreview || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
              {previewMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              预览配置
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary transition-all active:translate-y-px disabled:opacity-60" disabled={!preview || createRouteMutation.isPending} onClick={() => createRouteMutation.mutate()}>
              {createRouteMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存路由
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline bg-white px-4 text-sm font-semibold text-on-surface transition-all active:translate-y-px disabled:opacity-60" disabled={!createdRoute || probeMutation.isPending} onClick={() => createdRoute && probeMutation.mutate(createdRoute.route.id)}>
              <RefreshCw className={`h-4 w-4 ${probeMutation.isPending ? 'animate-spin' : ''}`} />
              连通性检查
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all active:translate-y-px disabled:opacity-60" disabled={!createdRoute || publishMutation.isPending || Boolean(preview?.publishBlocked)} onClick={() => publishMutation.mutate(undefined)}>
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

function SummaryCard({ service, source, scope, agent, endpoint, parser, hash, publish }: { service: string; source: string; scope: string; agent: string; endpoint: string; parser: string; hash: string; publish: string }) {
  return (
    <DataPanel title="本次接入" meta="summary">
      <div className="space-y-3">
        {[
          ['服务', service],
          ['来源', source],
          ['采集范围', scope],
          ['AgentGroup', agent],
          ['VL 端点', endpoint],
          ['解析', parser],
          ['配置 hash', shortHash(hash)],
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
