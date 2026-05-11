import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ExternalLink, Play, RefreshCw, Save } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import type { ServiceParserRule } from '../../services/types';

type ParseMode = ServiceParserRule['parseMode'];

export function OnboardingPage() {
  const queryClient = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [mode, setMode] = useState<'shared_gateway' | 'dedicated_collector'>('shared_gateway');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [parseMode, setParseMode] = useState<ParseMode>('none');
  const [regexPattern, setRegexPattern] = useState('');
  const [attributeMappingsText, setAttributeMappingsText] = useState('');
  const [resourceMappingsText, setResourceMappingsText] = useState('');
  const [ottlStatementsText, setOttlStatementsText] = useState('');
  const [sampleLog, setSampleLog] = useState('');

  const { data: services = [], isLoading: servicesLoading, error: servicesError } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
  });
  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useQuery({
    queryKey: ['collector-groups'],
    queryFn: () => api.getCollectorGroups(),
  });

  const service = useMemo(() => services.find((item) => item.id === selectedServiceId) ?? services[0], [services, selectedServiceId]);
  const availableGroups = useMemo(
    () => groups.filter((group) => group.mode === mode && (group.status === 'active' || group.status === 'draft')),
    [groups, mode],
  );
  const collectorGroup = useMemo(
    () => availableGroups.find((group) => group.id === selectedGroupId) ?? availableGroups[0],
    [availableGroups, selectedGroupId],
  );

  const { data: enrichmentPatch, refetch: refetchEnrichment } = useQuery({
    queryKey: ['service-enrichment-patch', service?.id],
    queryFn: () => api.getServiceEnrichmentPatch(service!.id),
    enabled: !!service,
    retry: false,
  });
  const { data: parserRule } = useQuery({
    queryKey: ['service-parser-rule', service?.id],
    queryFn: () => api.getServiceParserRule(service!.id),
    enabled: !!service,
    retry: false,
  });

  useEffect(() => {
    setSelectedGroupId('');
  }, [mode]);

  useEffect(() => {
    setParseMode(parserRule?.parseMode ?? 'none');
    setRegexPattern(parserRule?.regexPattern ?? '');
    setAttributeMappingsText(formatMappings(parserRule?.attributeMappings ?? parserRule?.jsonMappings ?? {}));
    setResourceMappingsText(formatMappings(parserRule?.resourceMappings ?? {}));
    setOttlStatementsText((parserRule?.ottlStatements ?? []).join('\n'));
    setSampleLog(parserRule?.sampleLog ?? '');
  }, [parserRule?.id, service?.id]);

  const parserInput = useMemo(() => ({
    collectorGroupId: collectorGroup?.id,
    parseMode,
    parseFrom: 'body',
    regexPattern,
    attributeMappings: parseMappings(attributeMappingsText),
    resourceMappings: parseMappings(resourceMappingsText),
    ottlStatements: splitLines(ottlStatementsText),
    sampleLog,
    enabled: parseMode !== 'none',
  }), [attributeMappingsText, collectorGroup?.id, ottlStatementsText, parseMode, regexPattern, resourceMappingsText, sampleLog]);

  const saveBindingMutation = useMutation({
    mutationFn: async () => {
      if (!service || !collectorGroup) throw new Error('请选择服务和采集组');
      await api.upsertServiceOnboarding(service.id, {
        mode,
        collectorGroupId: collectorGroup.id,
        k8sNamespace: service.namespace,
        k8sWorkload: service.name,
      });
      return api.regenerateServiceEnrichmentPatch(service.id, collectorGroup.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding', service?.id] });
      await queryClient.invalidateQueries({ queryKey: ['service-enrichment-patch', service?.id] });
    },
  });

  const saveParserMutation = useMutation({
    mutationFn: async () => {
      if (!service || !collectorGroup) throw new Error('请选择服务和采集组');
      return api.saveServiceParserRule(service.id, parserInput);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-parser-rule', service?.id] });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!service) throw new Error('请先选择服务');
      return api.previewServiceParserRule(service.id, parserInput);
    },
  });

  const generatePatchMutation = useMutation({
    mutationFn: async () => {
      if (!service) throw new Error('请先选择服务');
      if (parseMode !== 'none') {
        await api.saveServiceParserRule(service.id, { ...parserInput, enabled: true });
      }
      return api.generateServicePipelinePatch(service.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-parser-rule', service?.id] });
      if (collectorGroup?.id) {
        await queryClient.invalidateQueries({ queryKey: ['collector-group-config-sources', collectorGroup.id] });
      }
    },
  });

  const hasError = !!servicesError || !!groupsError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-on-surface">服务接入</h1>
        <p className="mt-1 text-sm text-muted">服务接入只负责选择承载 Agent/Collector Group、补齐服务属性，并按需追加业务解析规则。</p>
      </div>

      {hasError ? (
        <DataPanel title="加载失败" meta="error">
          <p className="py-3 text-sm text-red-400">无法加载服务列表或采集组。</p>
        </DataPanel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <DataPanel title="服务列表" meta={servicesLoading ? '加载中...' : `${services.length} services`}>
          {services.length === 0 ? (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted">暂无已注册服务，请先在服务目录中创建服务。</p>
              <Link to="/services" className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                前往服务目录 <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((item) => (
                <button
                  key={item.id}
                  className={`w-full rounded border px-3 py-3 text-left ${
                    item.id === service?.id ? 'border-primary bg-primary-soft' : 'border-outline bg-white hover:bg-surface-low'
                  }`}
                  onClick={() => setSelectedServiceId(item.id)}
                >
                  <div className="font-semibold text-on-surface">{item.name}</div>
                  <div className="mt-1 text-xs text-muted">{item.environment || '-'} · {item.cluster || '-'} · {item.namespace || '-'}</div>
                </button>
              ))}
            </div>
          )}
        </DataPanel>

        <div className="space-y-4">
          <DataPanel title="步骤 1 · 目标采集组" meta={groupsLoading ? '加载中...' : collectorGroup?.name ?? '未选择'}>
            {availableGroups.length === 0 ? (
              <div className="space-y-3 py-3">
                <p className="text-sm text-muted">暂无匹配的采集组。</p>
                <Link to="/logs?tab=pipelines&section=collectors" className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                  前往 Collectors <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <label className="text-sm font-semibold">
                  模式
                  <select className="console-input mt-2 w-full" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                    <option value="shared_gateway">共享 Gateway</option>
                    <option value="dedicated_collector">独立 Collector</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  采集组
                  <select className="console-input mt-2 w-full" value={collectorGroup?.id ?? ''} onChange={(event) => setSelectedGroupId(event.target.value)}>
                    {availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </DataPanel>

          <DataPanel title="步骤 2 · 基础属性补齐" meta={enrichmentPatch ? enrichmentPatch.status : '未生成'}>
            <div className="grid gap-3 md:grid-cols-3">
              <ReadOnlyField label="服务名" value={service?.name ?? ''} />
              <ReadOnlyField label="环境" value={service?.environment ?? ''} />
              <ReadOnlyField label="Namespace" value={service?.namespace ?? ''} />
            </div>
            <Notice tone="amber" message="这里不会生成 receiver。日志采集入口由平台模板或 Group Override 统一提供；服务接入只把服务目录/CMDB 属性补进日志流。" />
            <div className="mt-3 flex gap-2">
              <button className="rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!service || !collectorGroup || saveBindingMutation.isPending} onClick={() => saveBindingMutation.mutate()}>
                <Save className="mr-1 inline h-3.5 w-3.5" />保存接入目标并生成属性补齐
              </button>
            </div>
            {enrichmentPatch ? (
              <div className="mt-3 space-y-3">
                {enrichmentPatch.warnings.length > 0 ? <Notice tone="amber" message={enrichmentPatch.warnings.join('; ')} /> : <Notice tone="green" message="服务基础属性补齐 patch 已生成。" />}
                <YamlBlock body={enrichmentPatch.patchYaml} />
                <button className="rounded border border-primary px-3 py-2 text-sm font-semibold text-primary" onClick={() => refetchEnrichment()}>
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5" />刷新
                </button>
              </div>
            ) : (
              <p className="py-3 text-sm text-muted">保存接入目标后会生成基础属性补齐 patch。</p>
            )}
            {saveBindingMutation.error ? <Notice tone="red" message={(saveBindingMutation.error as Error).message} /> : null}
          </DataPanel>

          <DataPanel title="步骤 3 · 业务解析规则" meta={parseMode}>
            <Notice tone="amber" message="推荐流程：先选择 json 或 regex 提取原始字段，再用字段映射写入标准 attributes/resource；需要进一步清洗、归一化或条件处理时，再追加 OTTL Statements。生成补丁时会按“提取 → 映射 → OTTL 后处理”的顺序组合。" />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold">
                解析模式
                <select className="console-input mt-2 w-full" value={parseMode} onChange={(event) => setParseMode(event.target.value as ParseMode)}>
                  <option value="none">none · 只做基础补齐</option>
                  <option value="json">json</option>
                  <option value="regex">regex</option>
                  <option value="ottl">ottl</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                正则表达式
                <input className="console-input mt-2 w-full" disabled={parseMode !== 'regex'} value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} placeholder="order_id=(?P<order_id>[\\w-]+)" />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Attributes 字段映射
                <textarea className="mt-2 min-h-28 w-full rounded border border-outline bg-white p-3 font-mono text-xs" value={attributeMappingsText} onChange={(event) => setAttributeMappingsText(event.target.value)} placeholder={'DevIP=device.ip\nsrcIP=source.ip\nop=snmp.operation\nnode=snmp.node'} />
              </label>
              <label className="text-sm font-semibold">
                Resource 字段映射（可选）
                <textarea className="mt-2 min-h-28 w-full rounded border border-outline bg-white p-3 font-mono text-xs" value={resourceMappingsText} onChange={(event) => setResourceMappingsText(event.target.value)} placeholder="namespace=k8s.namespace.name" />
              </label>
            </div>
            <label className="mt-3 block text-sm font-semibold">
              OTTL Statements（可选，每行一条）
              <textarea className="mt-2 min-h-20 w-full rounded border border-outline bg-white p-3 font-mono text-xs" value={ottlStatementsText} onChange={(event) => setOttlStatementsText(event.target.value)} placeholder={'set(attributes["log.category"], "network")'} />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              样例日志
              <textarea className="mt-2 min-h-24 w-full rounded border border-outline bg-white p-3 font-mono text-xs" value={sampleLog} onChange={(event) => setSampleLog(event.target.value)} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60" disabled={parseMode === 'none' || !sampleLog || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                <Play className="mr-1 inline h-3.5 w-3.5" />预览
              </button>
              <button className="rounded border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60" disabled={!service || saveParserMutation.isPending} onClick={() => saveParserMutation.mutate()}>
                <Save className="mr-1 inline h-3.5 w-3.5" />保存规则
              </button>
              <button className="rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!service || generatePatchMutation.isPending} onClick={() => generatePatchMutation.mutate()}>
                生成业务补丁
              </button>
            </div>
            {previewMutation.data ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <PreviewBlock title="提取字段" value={previewMutation.data.parsedFields} />
                <PreviewBlock title="Attributes 映射结果" value={previewMutation.data.mappedAttributes} />
                <PreviewBlock title="Resource 映射结果" value={previewMutation.data.mappedResources} />
              </div>
            ) : null}
            {previewMutation.data?.warnings.length ? <Notice tone="amber" message={previewMutation.data.warnings.join('; ')} /> : null}
            {saveParserMutation.data ? <Notice tone="green" message="业务解析规则已保存。" /> : null}
            {generatePatchMutation.data ? (
              <div className="mt-3 space-y-3">
                <Notice tone="green" message={`业务补丁已生成，状态：${generatePatchMutation.data.status}，Hash：${generatePatchMutation.data.configHash || '-'}`} />
                <YamlBlock body={generatePatchMutation.data.patchYaml} />
              </div>
            ) : null}
            {(previewMutation.error || saveParserMutation.error || generatePatchMutation.error) ? (
              <Notice tone="red" message={((previewMutation.error || saveParserMutation.error || generatePatchMutation.error) as Error).message} />
            ) : null}
          </DataPanel>

          <DataPanel title="步骤 4 · 发布引导" meta="Pipeline 配置">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted">服务接入保存后，配置不会自动下发。请前往 Pipeline 配置查看来源、校验渲染后配置，并发布到 Collector Agent。</p>
              <Link to={`/logs?tab=pipelines&section=config`} className="shrink-0 rounded bg-primary px-3 py-2 text-sm font-semibold text-white">
                前往发布 <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
              </Link>
            </div>
          </DataPanel>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input className="console-input mt-2 w-full" value={value || '-'} readOnly />
    </label>
  );
}

function YamlBlock({ body }: { body: string }) {
  return <pre className="max-h-72 overflow-auto rounded border border-outline bg-white p-3 font-mono text-[11px] whitespace-pre-wrap break-all">{body || '(empty)'}</pre>;
}

function PreviewBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <pre className="max-h-64 overflow-auto rounded border border-outline bg-surface-lowest p-3 font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function Notice({ tone, message }: { tone: 'amber' | 'red' | 'green'; message: string }) {
  const classes = {
    amber: 'border-amber-500/30 bg-amber-900/10 text-amber-500',
    red: 'border-red-500/30 bg-red-900/10 text-red-400',
    green: 'border-emerald-500/30 bg-emerald-900/10 text-emerald-500',
  };
  const Icon = tone === 'green' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`mt-3 flex items-start gap-2 rounded border p-3 text-sm ${classes[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseMappings(value: string): Record<string, string> {
  return splitLines(value).reduce<Record<string, string>>((acc, line) => {
    const separator = line.includes('->') ? '->' : '=';
    const [source, ...targetParts] = line.split(separator);
    const target = targetParts.join(separator).trim();
    if (source?.trim() && target) {
      acc[source.trim()] = target;
    }
    return acc;
  }, {});
}

function formatMappings(value: Record<string, string>): string {
  return Object.entries(value)
    .map(([source, target]) => `${source}=${target}`)
    .join('\n');
}
