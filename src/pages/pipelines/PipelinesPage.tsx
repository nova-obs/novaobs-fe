import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Link2, Play, RefreshCw, Save, Wand2, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import type {
  OpAMPAgent,
  ParserPreviewResult,
  Service,
  ServiceEnrichmentPatch,
  ServiceParserRule,
  ServicePipelinePatch,
  ServicePipelinePublishResult,
  ServicePipelineSources,
} from '../../services/types';
import { shortHash, sourceTypeLabel } from './pipelineConfig';

const emptyParser: Partial<ServiceParserRule> = {
  parseMode: 'none',
  parseFrom: 'body',
  regexPattern: '',
  jsonMappings: {},
  attributeMappings: {},
  resourceMappings: {},
  ottlStatements: [],
  sampleLog: '',
  enabled: false,
};

function serviceTitle(service: Service | null) {
  if (!service) return '请选择服务';
  return service.displayName || service.name;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('映射配置必须是 JSON 对象');
  }
  return parsed as Record<string, string>;
}

function parseLines(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function PipelinesPage({ embedded }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const { data: services = [], isLoading: servicesLoading, error: servicesError } = useQuery({
    queryKey: ['services', 'pipeline-config'],
    queryFn: () => api.getServices(),
  });
  const { data: allAgents = [] } = useQuery({
    queryKey: ['opamp-agents'],
    queryFn: () => api.getOpAMPAgents(),
    refetchInterval: 5000,
  });

  const [selectedServiceId, setSelectedServiceId] = useState('');
  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? services[0] ?? null,
    [services, selectedServiceId],
  );

  useEffect(() => {
    if (!selectedServiceId && services[0]?.id) setSelectedServiceId(services[0].id);
  }, [services, selectedServiceId]);

  const serviceId = selectedService?.id ?? '';
  const { data: serviceAgents = [], error: agentsError } = useQuery({
    queryKey: ['service-agents', serviceId],
    queryFn: () => api.getServiceAgents(serviceId),
    enabled: !!serviceId,
    refetchInterval: 5000,
  });
  const { data: sources, error: sourcesError, refetch: refetchSources } = useQuery({
    queryKey: ['service-pipeline-sources', serviceId],
    queryFn: () => api.getServicePipelineSources(serviceId),
    enabled: !!serviceId,
    retry: false,
  });

  const [baseYaml, setBaseYaml] = useState('');
  const [parseMode, setParseMode] = useState<ServiceParserRule['parseMode']>('none');
  const [parseFrom, setParseFrom] = useState('body');
  const [regexPattern, setRegexPattern] = useState('');
  const [jsonMappingsText, setJsonMappingsText] = useState('{}');
  const [resourceMappingsText, setResourceMappingsText] = useState('{}');
  const [ottlText, setOttlText] = useState('');
  const [sampleLog, setSampleLog] = useState('');
  const [parserError, setParserError] = useState('');

  useEffect(() => {
    setBaseYaml(sources?.baseTemplate?.baseYaml ?? '');
  }, [sources?.baseTemplate?.id, sources?.baseTemplate?.baseYaml]);

  const saveBaseMutation = useMutation({
    mutationFn: () => api.saveServicePipelineBase(serviceId, baseYaml),
    onSuccess: () => invalidateServicePipeline(queryClient, serviceId),
  });
  const enrichmentMutation = useMutation({
    mutationFn: () => api.regenerateServicePipelineEnrichment(serviceId),
    onSuccess: () => invalidateServicePipeline(queryClient, serviceId),
  });
  const previewParserMutation = useMutation({
    mutationFn: () => api.previewServicePipelineParserRule(serviceId, buildParserInput()),
  });
  const saveParserMutation = useMutation({
    mutationFn: () => api.saveServicePipelineParserRule(serviceId, buildParserInput()),
    onSuccess: () => invalidateServicePipeline(queryClient, serviceId),
  });
  const generateParserPatchMutation = useMutation({
    mutationFn: () => api.generateServicePipelineParserPatch(serviceId),
    onSuccess: () => invalidateServicePipeline(queryClient, serviceId),
  });
  const publishMutation = useMutation({
    mutationFn: () => api.publishServicePipeline(serviceId),
    onSuccess: async () => {
      await invalidateServicePipeline(queryClient, serviceId);
      await queryClient.invalidateQueries({ queryKey: ['service-agents', serviceId] });
      await queryClient.invalidateQueries({ queryKey: ['opamp-agents'] });
    },
  });
  const assignMutation = useMutation({
    mutationFn: (agentUid: string) => api.assignInstanceService(agentUid, serviceId),
    onSuccess: () => invalidateAgents(queryClient, serviceId),
  });
  const unassignMutation = useMutation({
    mutationFn: (agentUid: string) => api.unassignInstanceService(agentUid),
    onSuccess: () => invalidateAgents(queryClient, serviceId),
  });

  function buildParserInput(): Partial<ServiceParserRule> {
    setParserError('');
    try {
      return {
        ...emptyParser,
        parseMode,
        parseFrom,
        regexPattern,
        jsonMappings: parseJsonObject(jsonMappingsText),
        attributeMappings: parseJsonObject(jsonMappingsText),
        resourceMappings: parseJsonObject(resourceMappingsText),
        ottlStatements: parseLines(ottlText),
        sampleLog,
        enabled: parseMode !== 'none',
      };
    } catch (error) {
      const message = (error as Error).message;
      setParserError(message);
      throw new Error(message);
    }
  }

  const bindableAgents = useMemo(() => {
    const bound = new Set(serviceAgents.map((agent) => agent.instanceUid));
    return allAgents.filter((agent) => !bound.has(agent.instanceUid) && agent.serviceId !== serviceId);
  }, [allAgents, serviceAgents, serviceId]);
  const renderedYaml = sources?.renderedYaml ?? '';
  const publishDisabled = !serviceId || !renderedYaml.trim() || publishMutation.isPending || (sources?.errors?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {!embedded ? <PageTitle /> : null}

      {servicesError ? <Notice tone="red" title="服务加载失败" message={(servicesError as Error).message} /> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <ServiceList
          services={services}
          loading={servicesLoading}
          selectedService={selectedService}
          onSelect={setSelectedServiceId}
        />

        <div className="space-y-4">
          <DataPanel title="服务 Agent" meta={`${serviceAgents.length} 个已绑定 · ${bindableAgents.length} 个可绑定`}>
            {agentsError ? <Notice tone="red" title="Agent 加载失败" message={(agentsError as Error).message} /> : null}
            <AgentMatrix
              serviceAgents={serviceAgents}
              bindableAgents={bindableAgents}
              onBind={(uid) => assignMutation.mutate(uid)}
              onUnbind={(uid) => unassignMutation.mutate(uid)}
              busy={assignMutation.isPending || unassignMutation.isPending}
            />
          </DataPanel>

          <PipelineFragment index="1" title="公共处理片段" meta={baseYaml.trim() ? (sources?.baseTemplate ? shortHash(sources.baseTemplate.configHash) : '未保存') : '可留空'}>
            <textarea
              className="console-input min-h-56 w-full font-mono text-xs"
              value={baseYaml}
              onChange={(event) => setBaseYaml(event.target.value)}
              placeholder="processors:\n  memory_limiter:\n  batch:\nextensions:\n  health_check:"
            />
            <ActionRow>
              <button className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!serviceId || saveBaseMutation.isPending} onClick={() => saveBaseMutation.mutate()}>
                <Save className="h-3.5 w-3.5" />保存公共处理
              </button>
            </ActionRow>
            <Notice tone="green" title="可留空" message="如果 Agent 本地配置已经定义 receiver/exporter/service pipelines，这里可以留空；平台发布时只合并服务属性补齐和业务解析片段。" />
            <YamlBlock title="公共处理预览" body={baseYaml || '(empty)'} />
          </PipelineFragment>

          <PipelineFragment index="2" title="服务属性补齐片段" meta={`${sources?.serviceEnrichmentPatches.length ?? 0} 个片段`}>
            <ActionRow>
              <button className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!serviceId || enrichmentMutation.isPending} onClick={() => enrichmentMutation.mutate()}>
                <Wand2 className="h-3.5 w-3.5" />生成属性补齐
              </button>
            </ActionRow>
            <PatchList patches={sources?.serviceEnrichmentPatches ?? []} generated={enrichmentMutation.data} empty="暂无属性补齐片段。" />
          </PipelineFragment>

          <PipelineFragment index="3" title="业务解析片段" meta={`${sources?.servicePipelinePatches.length ?? 0} 个片段`}>
            <ParserEditor
              parseMode={parseMode}
              parseFrom={parseFrom}
              regexPattern={regexPattern}
              jsonMappingsText={jsonMappingsText}
              resourceMappingsText={resourceMappingsText}
              ottlText={ottlText}
              sampleLog={sampleLog}
              onParseMode={setParseMode}
              onParseFrom={setParseFrom}
              onRegexPattern={setRegexPattern}
              onJsonMappingsText={setJsonMappingsText}
              onResourceMappingsText={setResourceMappingsText}
              onOttlText={setOttlText}
              onSampleLog={setSampleLog}
            />
            {parserError ? <Notice tone="red" title="解析配置无效" message={parserError} /> : null}
            <ActionRow>
              <button className="inline-flex items-center gap-1.5 rounded border border-primary bg-white px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60" disabled={!serviceId || previewParserMutation.isPending} onClick={() => previewParserMutation.mutate()}>
                <RefreshCw className="h-3.5 w-3.5" />预览解析
              </button>
              <button className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!serviceId || saveParserMutation.isPending} onClick={() => saveParserMutation.mutate()}>
                <Save className="h-3.5 w-3.5" />保存规则
              </button>
              <button className="inline-flex items-center gap-1.5 rounded border border-primary bg-white px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60" disabled={!serviceId || generateParserPatchMutation.isPending} onClick={() => generateParserPatchMutation.mutate()}>
                <Wand2 className="h-3.5 w-3.5" />生成片段
              </button>
            </ActionRow>
            <ParserPreview preview={previewParserMutation.data} />
            <PatchList patches={sources?.servicePipelinePatches ?? []} generated={generateParserPatchMutation.data} empty="暂无业务解析片段。" />
          </PipelineFragment>
        </div>

        <div className="space-y-4">
          <DataPanel title="发布预览" meta={`${serviceTitle(selectedService)} · ${shortHash(sources?.configHash ?? '')}`}>
            {sourcesError ? <Notice tone="amber" title="配置尚未完整" message={(sourcesError as Error).message} /> : null}
            <SourceBreakdown sources={sources} />
            {(sources?.warnings ?? []).map((warning) => <Notice key={warning} tone="amber" title="Warning" message={warning} />)}
            {(sources?.errors ?? []).map((error) => <Notice key={error} tone="red" title="Error" message={error} />)}
            <YamlBlock title="最终整合 YAML" body={renderedYaml || '(empty)'} tall />
            <ActionRow>
              <button className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={publishDisabled} onClick={() => publishMutation.mutate()}>
                <Play className="h-3.5 w-3.5" />发布到 Agent
              </button>
              <button className="inline-flex items-center gap-1.5 rounded border border-primary bg-white px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60" disabled={!serviceId} onClick={() => refetchSources()}>
                <RefreshCw className="h-3.5 w-3.5" />刷新
              </button>
            </ActionRow>
            <PublishResult result={publishMutation.data} error={publishMutation.error as Error | null} />
          </DataPanel>
        </div>
      </div>
    </div>
  );
}

async function invalidateServicePipeline(queryClient: ReturnType<typeof useQueryClient>, serviceId: string) {
  await queryClient.invalidateQueries({ queryKey: ['service-pipeline-sources', serviceId] });
}

async function invalidateAgents(queryClient: ReturnType<typeof useQueryClient>, serviceId: string) {
  await queryClient.invalidateQueries({ queryKey: ['service-agents', serviceId] });
  await queryClient.invalidateQueries({ queryKey: ['opamp-agents'] });
}

function PageTitle() {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
        <span>Logs</span><span>/</span><span className="text-primary">Pipelines</span>
      </div>
      <h1 className="font-display text-2xl font-semibold text-on-surface">Pipeline 配置</h1>
      <p className="mt-1 text-sm text-muted">按服务收敛 Agent、维护日志片段，并在发布前查看最终合成配置。</p>
    </div>
  );
}

function ServiceList({ services, loading, selectedService, onSelect }: { services: Service[]; loading: boolean; selectedService: Service | null; onSelect: (id: string) => void }) {
  return (
    <DataPanel title="服务" meta={loading ? '加载中...' : `${services.length} 个服务`}>
      {services.length === 0 ? (
        <p className="py-6 text-sm text-muted">暂无服务。</p>
      ) : (
        <div className="space-y-2 max-h-[720px] overflow-auto">
          {services.map((service) => (
            <button
              key={service.id}
              className={`w-full rounded border px-3 py-3 text-left ${service.id === selectedService?.id ? 'border-primary bg-primary-soft' : 'border-outline bg-white hover:bg-surface-low'}`}
              onClick={() => onSelect(service.id)}
            >
              <div className="truncate font-semibold text-on-surface">{service.displayName || service.name}</div>
              <div className="mt-1 text-xs text-muted">{service.environment || '-'} · {service.cluster || '-'} · {service.namespace || '-'}</div>
              <div className="mt-2 text-[11px] text-muted">{service.ownerTeam || service.owner || '未设置负责人'}</div>
            </button>
          ))}
        </div>
      )}
    </DataPanel>
  );
}

function AgentMatrix({ serviceAgents, bindableAgents, onBind, onUnbind, busy }: { serviceAgents: OpAMPAgent[]; bindableAgents: OpAMPAgent[]; onBind: (uid: string) => void; onUnbind: (uid: string) => void; busy: boolean }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <AgentColumn title="已绑定" agents={serviceAgents} empty="该服务还没有 Agent。" action={(agent) => (
        <button className="rounded p-1.5 text-muted hover:bg-surface-low hover:text-red-400" disabled={busy} onClick={() => onUnbind(agent.instanceUid)} title="解除绑定">
          <X className="h-3.5 w-3.5" />
        </button>
      )} />
      <AgentColumn title="可绑定" agents={bindableAgents} empty="暂无可绑定 Agent。" action={(agent) => (
        <button className="rounded p-1.5 text-muted hover:bg-surface-low hover:text-primary" disabled={busy} onClick={() => onBind(agent.instanceUid)} title="绑定到服务">
          <Link2 className="h-3.5 w-3.5" />
        </button>
      )} />
    </div>
  );
}

function AgentColumn({ title, agents, empty, action }: { title: string; agents: OpAMPAgent[]; empty: string; action: (agent: OpAMPAgent) => ReactNode }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest p-3">
      <div className="mb-2 text-xs font-semibold text-muted">{title}</div>
      {agents.length === 0 ? <p className="py-4 text-sm text-muted">{empty}</p> : (
        <div className="space-y-2 max-h-64 overflow-auto">
          {agents.map((agent) => (
            <div key={agent.instanceUid} className="flex items-start justify-between gap-2 rounded border border-outline bg-white p-2">
              <div className="min-w-0">
                <Link className="truncate font-mono text-xs text-primary hover:underline" to={`/agents/${agent.instanceUid}`}>{agent.instanceUid}</Link>
                <div className="mt-1 text-[11px] text-muted">{agent.runtimeStatus} · {agent.remoteConfigStatus || 'unset'} · {shortHash(agent.lastConfigHash)}</div>
                {agent.lastError ? <div className="mt-1 text-[11px] text-red-400">{agent.lastError}</div> : null}
              </div>
              {action(agent)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineFragment({ index, title, meta, children }: { index: string; title: string; meta: string; children: ReactNode }) {
  return (
    <DataPanel title={`${index}. ${title}`} meta={meta}>
      <div className="space-y-3">{children}</div>
    </DataPanel>
  );
}

function ParserEditor(props: {
  parseMode: ServiceParserRule['parseMode'];
  parseFrom: string;
  regexPattern: string;
  jsonMappingsText: string;
  resourceMappingsText: string;
  ottlText: string;
  sampleLog: string;
  onParseMode: (value: ServiceParserRule['parseMode']) => void;
  onParseFrom: (value: string) => void;
  onRegexPattern: (value: string) => void;
  onJsonMappingsText: (value: string) => void;
  onResourceMappingsText: (value: string) => void;
  onOttlText: (value: string) => void;
  onSampleLog: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <label className="text-sm font-semibold text-on-surface">解析模式
        <select className="console-input mt-2 w-full" value={props.parseMode} onChange={(event) => props.onParseMode(event.target.value as ServiceParserRule['parseMode'])}>
          <option value="none">none</option>
          <option value="json">json</option>
          <option value="regex">regex</option>
          <option value="ottl">ottl</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-on-surface">解析字段
        <input className="console-input mt-2 w-full" value={props.parseFrom} onChange={(event) => props.onParseFrom(event.target.value)} />
      </label>
      <label className="text-sm font-semibold text-on-surface lg:col-span-2">Regex Pattern
        <input className="console-input mt-2 w-full font-mono text-xs" value={props.regexPattern} onChange={(event) => props.onRegexPattern(event.target.value)} />
      </label>
      <label className="text-sm font-semibold text-on-surface">字段映射 JSON
        <textarea className="console-input mt-2 min-h-36 w-full font-mono text-xs" value={props.jsonMappingsText} onChange={(event) => props.onJsonMappingsText(event.target.value)} />
      </label>
      <label className="text-sm font-semibold text-on-surface">资源映射 JSON
        <textarea className="console-input mt-2 min-h-36 w-full font-mono text-xs" value={props.resourceMappingsText} onChange={(event) => props.onResourceMappingsText(event.target.value)} />
      </label>
      <label className="text-sm font-semibold text-on-surface lg:col-span-2">OTTL Statements
        <textarea className="console-input mt-2 min-h-24 w-full font-mono text-xs" value={props.ottlText} onChange={(event) => props.onOttlText(event.target.value)} />
      </label>
      <label className="text-sm font-semibold text-on-surface lg:col-span-2">Sample Log
        <textarea className="console-input mt-2 min-h-24 w-full font-mono text-xs" value={props.sampleLog} onChange={(event) => props.onSampleLog(event.target.value)} />
      </label>
    </div>
  );
}

function ParserPreview({ preview }: { preview?: ParserPreviewResult }) {
  if (!preview) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <JsonBlock title="解析字段" value={preview.parsedFields} />
      <JsonBlock title="属性映射" value={preview.mappedAttributes} />
      <JsonBlock title="资源映射" value={preview.mappedResources} />
      {preview.warnings.length > 0 ? <Notice tone="amber" title="Preview Warning" message={preview.warnings.join('; ')} /> : null}
      {preview.errors.length > 0 ? <Notice tone="red" title="Preview Error" message={preview.errors.join('; ')} /> : null}
    </div>
  );
}

function PatchList({ patches, generated, empty }: { patches: Array<ServiceEnrichmentPatch | ServicePipelinePatch>; generated?: ServiceEnrichmentPatch | ServicePipelinePatch; empty: string }) {
  const list = generated ? [generated, ...patches.filter((patch) => patch.id !== generated.id)] : patches;
  if (list.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="space-y-2">
      {list.map((patch) => (
        <details key={patch.id || `${patch.serviceId}-${patch.configHash}`} className="rounded border border-outline bg-white p-2" open={patch === generated}>
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            {patch.status || 'generated'} · {shortHash(patch.configHash)}
          </summary>
          {'warnings' in patch && patch.warnings.length > 0 ? <p className="mt-2 text-xs text-amber-500">{patch.warnings.join('; ')}</p> : null}
          <YamlBlock title="片段预览" body={patch.patchYaml || '(empty)'} />
        </details>
      ))}
    </div>
  );
}

function SourceBreakdown({ sources }: { sources?: ServicePipelineSources }) {
  if (!sources?.sourceBreakdown?.length) return <p className="text-sm text-muted">暂无可发布片段。</p>;
  return (
    <div className="space-y-2">
      {sources.sourceBreakdown.map((source) => (
        <div key={`${source.type}-${source.id}`} className="rounded border border-outline bg-surface-lowest p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-on-surface">{sourceTypeLabel(source.type)}</span>
            <span className="font-mono text-[11px] text-muted">{shortHash(source.hash)}</span>
          </div>
          <div className="mt-1 text-xs text-muted">{source.name || source.id} · {source.status || '-'}</div>
        </div>
      ))}
    </div>
  );
}

function PublishResult({ result, error }: { result?: ServicePipelinePublishResult; error: Error | null }) {
  if (error) return <Notice tone="red" title="发布失败" message={error.message} />;
  if (!result) return null;
  return (
    <Notice
      tone="green"
      title="发布已提交"
      message={`${result.activeDeliveryCount} 个在线 Agent 已下发，${result.queuedDeliveryCount} 个已进入队列，配置 ${shortHash(result.configHash)}`}
    />
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function YamlBlock({ title, body, tall }: { title: string; body: string; tall?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <pre className={`${tall ? 'max-h-[560px]' : 'max-h-72'} overflow-auto rounded border border-outline bg-white p-3 font-mono text-[11px] text-on-surface whitespace-pre-wrap break-all`}>
        {body}
      </pre>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return <YamlBlock title={title} body={JSON.stringify(value ?? {}, null, 2)} />;
}

function Notice({ tone, title, message }: { tone: 'amber' | 'red' | 'green'; title: string; message: string }) {
  const color = tone === 'red'
    ? 'border-red-500/30 bg-red-900/10 text-red-400'
    : tone === 'green'
      ? 'border-primary/25 bg-primary-soft text-primary'
      : 'border-amber-500/30 bg-amber-900/10 text-amber-500';
  const Icon = tone === 'red' ? AlertTriangle : CheckCircle;
  return (
    <div className={`flex items-start gap-2 rounded border p-3 ${color}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs">{message}</p>
      </div>
    </div>
  );
}
