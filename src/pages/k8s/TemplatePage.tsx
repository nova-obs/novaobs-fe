import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCode2, Play, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sTemplate } from './api';

const DEFAULT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: <<name>>
  namespace: <<namespace>>
spec:
  replicas: <<replicas>>`;

export function K8sTemplatePage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<K8sTemplate | null>(null);
  const [name, setName] = useState('orders-deployment');
  const [templateType, setTemplateType] = useState('Deployment');
  const [yamlContent, setYamlContent] = useState(DEFAULT_YAML);
  const [renderedYAML, setRenderedYAML] = useState('');
  const [lastAuditId, setLastAuditId] = useState('');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-templates'],
    queryFn: () => k8sApi.listTemplates(),
    retry: false,
  });

  const variables = useMemo(() => extractVariables(yamlContent), [yamlContent]);
  const variableValues = useMemo(() => Object.fromEntries(variables.map((item) => [item.name, item.defaultValue || defaultVariableValue(item.name)])), [variables]);

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createTemplate({ name, type: templateType, yamlContent, variables, description: 'NovaObs 发布模板' }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.item ?? null);
      queryClient.invalidateQueries({ queryKey: ['k8s-templates'] });
    },
  });

  const renderMutation = useMutation({
    mutationFn: () => {
      const target = selected ?? data[0];
      if (!target) throw new Error('请选择要渲染的模板');
      return k8sApi.renderTemplate(target.id, variableValues);
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setRenderedYAML(result.renderedYAML);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const target = selected ?? data[0];
      if (!target) throw new Error('请选择要删除的模板');
      return k8sApi.deleteTemplate(target.id);
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(null);
      setRenderedYAML('');
      queryClient.invalidateQueries({ queryKey: ['k8s-templates'] });
    },
  });

  const permissionError = useMemo(() => {
    const message = createMutation.error?.message || renderMutation.error?.message || deleteMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createMutation.error, renderMutation.error, deleteMutation.error]);

  const current = selected ?? data[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
        <TemplateMetric label="模板" value={String(data.length)} meta="k8s.template" />
        <TemplateMetric label="变量" value={String(variables.length)} meta="render preview" />
        <TemplateMetric label="审计" value={lastAuditId ? 'recorded' : 'pending'} meta="global scope" />
      </div>

      <DataPanel title="模板管理" meta={isLoading ? '加载中' : `${data.length} 个模板 · 渲染和变更受 RBAC 控制`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            模板 API 暂未连接，等待后端 `/api/v1/k8s/templates`。
          </div>
        ) : null}
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.template` 操作权限。
          </div>
        ) : null}
        {lastAuditId ? (
          <div className="mb-3 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            操作已落审计：<span className="font-mono">{lastAuditId}</span>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4 overflow-hidden">
            <section className="overflow-auto">
              {data.length ? (
                <table className="console-table min-w-[820px] w-full">
                  <thead>
                    <tr>
                      <th>模板</th>
                      <th>类型</th>
                      <th>变量</th>
                      <th>来源</th>
                      <th>更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => (
                      <tr
                        key={item.id}
                        className={`cursor-pointer bg-white/35 hover:bg-white/60 ${current?.id === item.id ? 'ring-1 ring-primary/25' : ''}`}
                        onClick={() => {
                          setSelected(item);
                          setName(item.name);
                          setTemplateType(item.type);
                          setYamlContent(item.yamlContent);
                          setRenderedYAML('');
                        }}
                      >
                        <td>
                          <div className="font-semibold text-primary">{item.name}</div>
                          <div className="font-mono text-[11px] text-muted">{item.id}</div>
                        </td>
                        <td>{item.type}</td>
                        <td className="text-xs text-muted">{item.variables.map((variable) => variable.name).join(', ') || '-'}</td>
                        <td className="text-xs text-muted">{item.source || 'novaobs'}</td>
                        <td className="font-mono text-[11px] text-muted">{formatDate(item.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rounded-lg bg-white/45 px-4 py-5 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                  暂无模板记录，可先创建本页右侧确认摘要中的模板。
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="console-panel px-4 py-3">
                <div className="text-sm font-semibold text-on-surface">YAML</div>
                <textarea className="console-input mt-3 min-h-[260px] w-full font-mono text-xs" value={yamlContent} onChange={(event) => setYamlContent(event.target.value)} />
              </div>
              <div className="console-panel px-4 py-3">
                <div className="text-sm font-semibold text-on-surface">渲染预览</div>
                <pre className="mt-3 min-h-[260px] whitespace-pre-wrap break-words rounded-lg bg-white/60 p-3 font-mono text-xs text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                  {renderedYAML || '点击渲染后展示 rendered_yaml'}
                </pre>
              </div>
            </section>
          </div>

          <aside className="console-panel px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <FileCode2 className="h-4 w-4 text-primary" />
              模板确认
            </div>
            <label className="mt-4 block text-xs font-semibold text-muted" htmlFor="template-name">Name</label>
            <input id="template-name" className="console-input mt-2 w-full" value={name} onChange={(event) => setName(event.target.value)} />
            <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="template-type">Type</label>
            <select id="template-type" className="console-input mt-2 w-full" value={templateType} onChange={(event) => setTemplateType(event.target.value)}>
              {['Deployment', 'Service', 'StatefulSet', 'ConfigMap', 'Ingress', 'HorizontalPodAutoscaler'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">变量摘要</div>
              {variables.map((item) => (
                <div key={item.name} className="mt-2 font-mono">{item.name}={variableValues[item.name]}</div>
              ))}
              {!variables.length ? <div className="mt-2">当前模板没有变量。</div> : null}
            </div>
            <div className="mt-3 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">删除确认摘要</div>
              <div className="mt-2 font-mono">id={current?.id ?? '-'}</div>
              <div className="font-mono">name={current?.name ?? '-'}</div>
              <div className="font-mono">type={current?.type ?? '-'}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!name.trim() || !yamlContent.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
                <Plus className="h-4 w-4" />
                创建
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!current || renderMutation.isPending} onClick={() => renderMutation.mutate()}>
                <Play className="h-4 w-4" />
                渲染
              </button>
              <button className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!current || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                <Trash2 className="h-4 w-4" />
                删除模板
              </button>
            </div>
          </aside>
        </div>
      </DataPanel>
    </div>
  );
}

function TemplateMetric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="text-sm font-semibold text-on-surface">{label}</div>
      <div className="mt-3 font-mono text-2xl font-semibold text-on-surface">{value}</div>
      <div className="mt-2 text-xs text-muted">{meta}</div>
    </section>
  );
}

function extractVariables(value: string) {
  const names = Array.from(new Set(Array.from(value.matchAll(/<<([a-zA-Z0-9_-]+)>>/g)).map((match) => match[1])));
  return names.map((name) => ({ name, description: '', defaultValue: defaultVariableValue(name), required: true }));
}

function defaultVariableValue(name: string) {
  if (name === 'name') return 'orders-api';
  if (name === 'namespace') return 'orders';
  if (name === 'replicas') return '2';
  return 'value';
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}
