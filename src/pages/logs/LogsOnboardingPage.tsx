import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Play, RefreshCw, Save, Server, Settings2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ServiceDeployment } from '../../services/types';
import {
  defaultLogsCollectorNamespace,
  logSinkLabel,
  logsApi,
  type LogAccessSource,
  type LogParseRule,
  type LogRouteInput,
  type LogRoutePreview,
  type LogRoutePublishResult,
} from './api';
import { LogsParseRuleDialog, type ParserMode } from './LogsParseRuleDialog';
import { LogsErrorLine, LogsTaskPageHeader } from './LogsPrimitives';
import { VMOnboardingFlow } from './VMOnboardingFlow';
import { buildLogsRuntimeURL } from './logsRuntimeViewModel';

const defaultParseSample = '{"timestamp":"2026-07-28T10:32:18.245+08:00","level":"info","message":"service started","event_name":"service.started"}';
const defaultParserRuleName = 'default-parser';
const defaultParserPattern = '^(?P<level>[A-Z]+)\\s+(?P<message>.*)$';

export function LogsOnboardingPage() {
  const { productId = '', serviceId = '', id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const preferredDeploymentId = searchParams.get('deployment_id') ?? '';
  const workspaceQuery = useQuery({
    queryKey: ['logs-onboarding-workspace', productId, serviceId],
    queryFn: () => logsApi.getWorkspace(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const editRoute = workspaceQuery.data?.routes.find((item) => item.route.id === id) ?? null;
  const [sourceMode, setSourceMode] = useState<LogAccessSource>('k8s');

  useEffect(() => {
    if (editRoute) setSourceMode(editRoute.route.sourceType === 'vm_file' ? 'vm' : 'k8s');
    else if (searchParams.get('source') === 'vm') setSourceMode('vm');
    else if (searchParams.get('source') === 'k8s') setSourceMode('k8s');
  }, [editRoute, searchParams]);

  const returnTo = buildLogsRuntimeURL(productId, serviceId, {
    deploymentId: editRoute?.route.serviceDeploymentId || preferredDeploymentId,
    routeId: editRoute?.route.id || '',
  });
  const sourceModeSwitch = (
    <div className="logs-source-mode-switch inline-flex rounded-md border border-outline bg-surface-lowest p-0.5" aria-label="采集来源">
      {([
        { value: 'k8s' as const, label: 'K8s' },
        { value: 'vm' as const, label: 'VM / 物理机' },
      ]).map((item) => (
        <button
          key={item.value}
          type="button"
          className={`h-7 rounded px-3 text-xs font-semibold ${sourceMode === item.value ? 'bg-primary text-white' : 'text-muted hover:text-on-surface'}`}
          disabled={Boolean(id)}
          aria-pressed={sourceMode === item.value}
          title={id ? '更新路由时不能变更采集来源' : undefined}
          onClick={() => setSourceMode(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="logs-task-page flex h-full min-h-[720px] min-w-0 flex-col overflow-hidden">
      <LogsTaskPageHeader
        title={id ? '更新采集路由' : '创建采集路由'}
        description="绑定服务部署目标后，由平台生成、校验并发布采集配置。"
        context={sourceModeSwitch}
        action={<Link className="console-button h-8" to={returnTo}>退出</Link>}
      />
      <div className="mt-3 min-h-0 flex-1 overflow-auto">
        {sourceMode === 'vm'
          ? <VMOnboardingFlow preferredDeploymentId={preferredDeploymentId} />
          : <K8sOnboardingFlow workspaceQuery={workspaceQuery} editRouteId={id} preferredDeploymentId={preferredDeploymentId} />}
      </div>
    </div>
  );
}

function K8sOnboardingFlow({ workspaceQuery, editRouteId, preferredDeploymentId }: {
  workspaceQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof logsApi.getWorkspace>>>>;
  editRouteId: string;
  preferredDeploymentId: string;
}) {
  const queryClient = useQueryClient();
  const { productId = '', serviceId = '' } = useParams();
  const [deploymentId, setDeploymentId] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const agentNamespace = defaultLogsCollectorNamespace;
  const [parserMode, setParserMode] = useState<ParserMode>('none');
  const [parserRuleName, setParserRuleName] = useState(defaultParserRuleName);
  const [parserPattern, setParserPattern] = useState(defaultParserPattern);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [preview, setPreview] = useState<LogRoutePreview | null>(null);
  const [savedRouteId, setSavedRouteId] = useState(editRouteId);
  const [publishConfirmation, setPublishConfirmation] = useState<LogRoutePublishResult | null>(null);

  const deploymentsQuery = useQuery({
    queryKey: ['service-deployments', productId, serviceId],
    queryFn: () => api.getServiceDeployments(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const serviceQuery = useQuery({
    queryKey: ['service', productId, serviceId],
    queryFn: () => api.getService(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const deployments = useMemo(
    () => (deploymentsQuery.data ?? []).filter((deployment) => deployment.kind === 'kubernetes_workload' && deployment.status === 'active'),
    [deploymentsQuery.data],
  );
  const editRoute = workspaceQuery.data?.routes.find((item) => item.route.id === editRouteId) ?? null;
  const selectedDeployment = deployments.find((deployment) => deployment.id === deploymentId) ?? null;
  const endpoints = useMemo(() => {
    const clusterId = selectedDeployment?.k8sRef?.clusterId;
    return (workspaceQuery.data?.endpoints ?? []).filter((endpoint) => (
      endpoint.scopeType === 'global' || (endpoint.scopeType === 'k8s_cluster' && endpoint.clusterId === clusterId)
    ));
  }, [selectedDeployment, workspaceQuery.data?.endpoints]);
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === endpointId) ?? null;

  useEffect(() => {
    if (editRoute?.route.serviceDeploymentId && deployments.some((deployment) => deployment.id === editRoute.route.serviceDeploymentId)) {
      setDeploymentId(editRoute.route.serviceDeploymentId);
      setEndpointId(editRoute.route.endpointId);
      const parser = editRoute.source?.parseRules.find((rule) => rule.enabled !== false);
      setParserMode(parser?.ruleType ?? 'none');
      setParserRuleName(parser?.name || defaultParserRuleName);
      setParserPattern(parser?.pattern || defaultParserPattern);
      return;
    }
    setDeploymentId((current) => deployments.some((deployment) => deployment.id === current)
      ? current
      : deployments.find((deployment) => deployment.id === preferredDeploymentId)?.id ?? deployments[0]?.id ?? '');
  }, [deployments, editRoute, preferredDeploymentId]);

  useEffect(() => {
    setEndpointId((current) => endpoints.some((endpoint) => endpoint.id === current) ? current : endpoints[0]?.id ?? '');
  }, [deploymentId, endpoints]);

  useEffect(() => {
    setPreview(null);
    setPublishConfirmation(null);
  }, [deploymentId, endpointId, agentNamespace, parserMode, parserRuleName, parserPattern]);

  const parseRules = buildParserRules(parserMode, parserRuleName, parserPattern);
  const buildInput = (): LogRouteInput => ({
    routeId: savedRouteId || undefined,
    name: serviceQuery.data?.name,
    serviceId,
    serviceDeploymentId: deploymentId,
    sourceType: 'k8s_stdout',
    endpointId,
    k8s: {
      agentNamespace,
      parseRules,
    },
  });
  const canPreview = Boolean(selectedDeployment && selectedEndpoint && parserValid(parserMode, parserPattern));

  const previewMutation = useMutation({
    mutationFn: () => logsApi.previewRoute(buildInput()),
    onSuccess: setPreview,
  });
  const saveMutation = useMutation({
    mutationFn: () => savedRouteId
      ? logsApi.updateRoute(savedRouteId, buildInput())
      : logsApi.createRoute(buildInput()),
    onSuccess: async (result) => {
      setSavedRouteId(result.route.id);
      setPublishConfirmation(null);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });
  const publishMutation = useMutation({
    mutationFn: () => logsApi.publishRoute(savedRouteId, publishConfirmation?.requiresConfirmation ? {
      previewId: publishConfirmation.previewId,
      confirmationToken: publishConfirmation.confirmationToken,
    } : undefined),
    onSuccess: (result) => {
      setPublishConfirmation(result.requiresConfirmation ? result : null);
      void queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  if (workspaceQuery.error || deploymentsQuery.error || serviceQuery.error) {
    const error = workspaceQuery.error ?? deploymentsQuery.error ?? serviceQuery.error;
    return <div className="p-3"><LogsErrorLine message={(error as Error).message} /></div>;
  }

  return (
    <RouteEditor
      kind="kubernetes_workload"
      deployments={deployments}
      selectedDeployment={selectedDeployment}
      deploymentId={deploymentId}
      onDeploymentChange={setDeploymentId}
      endpointId={endpointId}
      onEndpointChange={setEndpointId}
      endpoints={endpoints}
      parserMode={parserMode}
      parserRuleName={parserRuleName}
      parserPattern={parserPattern}
      onParserModeChange={setParserMode}
      onParserRuleNameChange={setParserRuleName}
      onParserPatternChange={setParserPattern}
      parseDialogOpen={parseDialogOpen}
      onParseDialogOpenChange={setParseDialogOpen}
      preview={preview}
      canPreview={canPreview}
      previewMutation={previewMutation}
      saveMutation={saveMutation}
      savedRouteId={savedRouteId}
      publishMutation={publishMutation}
      publishConfirmation={publishConfirmation}
    />
  );
}

interface RouteEditorProps {
  kind: 'kubernetes_workload' | 'host_set';
  deployments: ServiceDeployment[];
  selectedDeployment: ServiceDeployment | null;
  deploymentId: string;
  onDeploymentChange: (value: string) => void;
  endpointId: string;
  onEndpointChange: (value: string) => void;
  endpoints: Array<{ id: string; name: string; sinkType: string; writeURL: string }>;
  parserMode: ParserMode;
  parserRuleName: string;
  parserPattern: string;
  onParserModeChange: (value: ParserMode) => void;
  onParserRuleNameChange: (value: string) => void;
  onParserPatternChange: (value: string) => void;
  parseDialogOpen: boolean;
  onParseDialogOpenChange: (value: boolean) => void;
  preview: LogRoutePreview | null;
  canPreview: boolean;
  previewMutation: ReturnType<typeof useMutation<LogRoutePreview, Error, void>>;
  saveMutation: ReturnType<typeof useMutation<any, Error, void>>;
  savedRouteId: string;
  publishMutation: ReturnType<typeof useMutation<LogRoutePublishResult, Error, void>>;
  publishConfirmation: LogRoutePublishResult | null;
  extraConfig?: React.ReactNode;
}

export function RouteEditor(props: RouteEditorProps) {
  const deploymentKind = props.kind === 'host_set' ? '主机部署' : 'K8S Workload';
  const parserRules = buildParserRules(props.parserMode, props.parserRuleName, props.parserPattern);
  const parsePreviewMutation = useMutation({
    mutationFn: () => logsApi.previewParseRules(defaultParseSample, parserRules),
  });

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <section className="rounded-md border border-outline bg-white">
          <div className="border-b border-outline px-3 py-2.5">
            <h2 className="text-sm font-semibold">选择部署目标</h2>
            <p className="mt-1 text-xs text-muted">日志路由绑定实际部署，不改变 Service 的逻辑身份。</p>
          </div>
          <div className="space-y-3 p-3">
            <label className="block text-xs font-semibold">
              {deploymentKind} *
              <select className="console-input mt-1.5 w-full" value={props.deploymentId} onChange={(event) => props.onDeploymentChange(event.target.value)}>
                <option value="">请选择部署目标</option>
                {props.deployments.map((deployment) => <option key={deployment.id} value={deployment.id}>{deployment.name}</option>)}
              </select>
            </label>
            {props.deployments.length === 0 ? (
              <div className="console-notice console-notice-warning">当前服务没有可用的{deploymentKind}，请先在服务详情创建部署目标。</div>
            ) : props.selectedDeployment ? <DeploymentFacts deployment={props.selectedDeployment} /> : null}
            {props.extraConfig}
          </div>
        </section>

        <section className="rounded-md border border-outline bg-white">
          <div className="border-b border-outline px-3 py-2.5"><h2 className="text-sm font-semibold">采集与下游</h2></div>
          <div className="space-y-3 p-3">
            <label className="block text-xs font-semibold">
              日志下游端点 *
              <select className="console-input mt-1.5 w-full" value={props.endpointId} onChange={(event) => props.onEndpointChange(event.target.value)}>
                <option value="">请选择端点</option>
                {props.endpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.name} · {logSinkLabel(endpoint.sinkType)}</option>)}
              </select>
            </label>
            <div className="flex items-center justify-between gap-3 border-t border-outline pt-3">
              <div><div className="text-xs font-semibold">日志解析规则</div><div className="mt-1 text-xs text-muted">{parserLabel(props.parserMode)}</div></div>
              <button className="console-button" onClick={() => props.onParseDialogOpenChange(true)}><Settings2 className="h-3.5 w-3.5" />配置解析</button>
            </div>
          </div>
        </section>

        <MutationErrorList errors={[props.previewMutation.error, props.saveMutation.error, props.publishMutation.error]} />
        <div className="console-action-bar justify-end">
          <button className="console-button" disabled={!props.canPreview || props.previewMutation.isPending} onClick={() => props.previewMutation.mutate()}>
            {props.previewMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}生成预览
          </button>
          <button className="console-button" disabled={!props.preview || props.saveMutation.isPending} onClick={() => props.saveMutation.mutate()}>
            <Save className="h-3.5 w-3.5" />{props.savedRouteId ? '保存更新' : '保存路由'}
          </button>
          <button className="console-button console-button-primary" disabled={!props.savedRouteId || !props.preview || props.preview.publishBlocked || props.publishMutation.isPending} onClick={() => props.publishMutation.mutate()}>
            <Play className="h-3.5 w-3.5" />
            {props.publishConfirmation?.requiresConfirmation ? '确认发布' : '发布'}
          </button>
        </div>
      </div>

      <aside className="space-y-3">
        <section className="rounded-md border border-outline bg-white p-3">
          <div className="text-xs font-semibold text-muted">发布摘要</div>
          <dl className="mt-3 space-y-3">
            <SummaryFact label="部署目标" value={props.selectedDeployment?.name || '-'} />
            <SummaryFact label="预期目标" value={props.selectedDeployment ? String(props.selectedDeployment.kind === 'host_set' ? props.selectedDeployment.hostTargets.length : 1) : '-'} />
            <SummaryFact label="配置 Hash" value={props.preview?.collectorConfigHash || '-'} mono />
          </dl>
        </section>
        {props.preview ? (
          <section className="rounded-md border border-outline bg-white p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><CheckCircle className="h-4 w-4" />预览已生成</div>
            {props.preview.publishBlocked ? <div className="console-notice console-notice-danger mt-3">{props.preview.publishBlockedReason}</div> : null}
            {props.preview.warnings.length ? <div className="console-notice console-notice-warning mt-3">{props.preview.warnings.join('；')}</div> : null}
          </section>
        ) : null}
      </aside>

      <LogsParseRuleDialog
        open={props.parseDialogOpen}
        serviceLabel={props.selectedDeployment?.name || '-'}
        scopeLabel={deploymentKind}
        parseSample={defaultParseSample}
        parserDraftMode={props.parserMode}
        parserDraftRuleName={props.parserRuleName}
        parserDraftPattern={props.parserPattern}
        parseDraftValid={parserValid(props.parserMode, props.parserPattern)}
        parsePreviewMutation={parsePreviewMutation}
        onParseSampleChange={() => undefined}
        onParserDraftModeChange={props.onParserModeChange}
        onParserDraftRuleNameChange={props.onParserRuleNameChange}
        onParserDraftPatternChange={props.onParserPatternChange}
        onClose={() => props.onParseDialogOpenChange(false)}
        onApply={() => props.onParseDialogOpenChange(false)}
      />
    </div>
  );
}

function DeploymentFacts({ deployment }: { deployment: ServiceDeployment }) {
  if (deployment.kind === 'host_set') {
    return (
      <dl className="grid gap-3 rounded border border-outline bg-surface-lowest p-3 sm:grid-cols-2">
        <SummaryFact label="主机范围" value={`${deployment.hostTargets.length} 台预期主机`} />
        <SummaryFact label="允许日志根目录" value={deployment.allowedLogRoots.join('、') || '-'} mono />
      </dl>
    );
  }
  return (
    <dl className="grid gap-3 rounded border border-outline bg-surface-lowest p-3 sm:grid-cols-2">
      <SummaryFact label="集群 / Namespace" value={`${deployment.k8sRef?.clusterId || '-'} / ${deployment.k8sRef?.namespace || '-'}`} mono />
      <SummaryFact label="Workload" value={`${deployment.k8sRef?.workloadKind || '-'} / ${deployment.k8sRef?.workloadName || '-'}`} mono />
    </dl>
  );
}

function SummaryFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-[11px] font-semibold text-muted">{label}</dt><dd className={`mt-1 break-all text-xs text-on-surface ${mono ? 'font-mono' : ''}`}>{value}</dd></div>;
}

function MutationErrorList({ errors }: { errors: unknown[] }) {
  return <>{errors.filter(Boolean).map((error, index) => <LogsErrorLine key={index} message={(error as Error).message} />)}</>;
}

function buildParserRules(mode: ParserMode, name: string, pattern: string): LogParseRule[] {
  if (mode === 'none') return [];
  return [{ name: name || `${mode}-parser`, ruleType: mode, pattern: mode === 'regex' ? pattern : undefined, enabled: true }];
}

function parserValid(mode: ParserMode, pattern: string) {
  return mode !== 'regex' || pattern.includes('?P<');
}

function parserLabel(mode: ParserMode) {
  if (mode === 'otel_json') return 'OTel JSON · novaapm-json-v1';
  if (mode === 'json') return 'JSON';
  if (mode === 'regex') return 'Regex';
  return '不解析';
}

// 保留纯函数给生成器测试使用；页面不允许用户编辑完整 Collector YAML。
export function renderK8sRouteFragmentDraft(input: {
  productId: string;
  namespace: string;
  workloadName: string;
  serviceId: string;
  serviceName: string;
  endpointWriteURL: string;
  accountId: string;
  projectId: string;
  parseRules: LogParseRule[];
}) {
  const headers = input.accountId && input.projectId
    ? `\n    headers:\n      AccountID: "${input.accountId}"\n      ProjectID: "${input.projectId}"`
    : '';
  return `receivers:
  file_log/service:
    include: ["/var/log/pods/${input.namespace}_${input.workloadName}_*/*/*.log"]
processors:
  resource/service:
    attributes:
      - key: service.name
        value: "${input.serviceName}"
        action: upsert
      - key: novaapm.service_id
        value: "${input.serviceId}"
        action: upsert
      - key: novaapm.product_id
        value: "${input.productId}"
        action: upsert
exporters:
  otlp_http/service:
    logs_endpoint: "${input.endpointWriteURL}"${headers}
service:
  pipelines:
    logs/service:
      receivers: [file_log/service]
      processors: [resource/service]
      exporters: [otlp_http/service]
`;
}
