import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, FileCode2, Play, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sBaseTemplate, type K8sResourceSummary, type K8sTemplate } from './api';
import { useK8sOpsContext } from './context';

const templateTypeOptions = [
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'Service',
  'ConfigMap',
  'Ingress',
  'HorizontalPodAutoscaler',
  'Gateway',
  'VirtualService',
  'DestinationRule',
  'EnvoyFilter',
];

export function K8sTemplatePage() {
  const queryClient = useQueryClient();
  const [namespace, setNamespace] = useState('');
  const [selectedResourceUID, setSelectedResourceUID] = useState('');
  const [selected, setSelected] = useState<K8sTemplate | null>(null);
  const [name, setName] = useState('');
  const [lastTemplateName, setLastTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('Deployment');
  const [yamlContent, setYamlContent] = useState('');
  const [lastTemplateYAML, setLastTemplateYAML] = useState('');
  const [renderedYAML, setRenderedYAML] = useState('');
  const [lastAuditId, setLastAuditId] = useState('');
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [previewTemplate, setPreviewTemplate] = useState<K8sTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<K8sTemplate | null>(null);

  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  const { data: resources = [], isLoading: isLoadingResources, error: resourceError } = useQuery({
    queryKey: ['k8s-template-resources', activeClusterId, namespace, templateType],
    queryFn: () => k8sApi.listResources({ clusterId: activeClusterId, namespace, kind: templateType }),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-templates'],
    queryFn: () => k8sApi.listTemplates(),
    retry: false,
  });

  const { data: baseTemplate, error: baseTemplateError } = useQuery({
    queryKey: ['k8s-template-base', templateType],
    queryFn: () => k8sApi.getBaseTemplate(templateType),
    enabled: Boolean(templateType),
    retry: false,
  });

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      setSelectedResourceUID('');
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  useEffect(() => {
    const resourceExists = resources.some((item) => resourceOptionKey(item) === selectedResourceUID);
    if (selectedResourceUID && !resourceExists) {
      setSelectedResourceUID(resources[0] ? resourceOptionKey(resources[0]) : '');
      return;
    }
    if (!selectedResourceUID && resources[0]) {
      setSelectedResourceUID(resourceOptionKey(resources[0]));
    }
  }, [resources, selectedResourceUID]);

  const currentResource = resources.find((item) => resourceOptionKey(item) === selectedResourceUID) ?? resources[0];
  const variables = useMemo(
    () => extractVariables(yamlContent, { clusterId: activeClusterId, namespace, resource: currentResource, templateType }),
    [activeClusterId, currentResource, namespace, templateType, yamlContent],
  );
  const variableValues = useMemo(() => Object.fromEntries(variables.map((item) => [item.name, item.defaultValue ?? ''])), [variables]);

  useEffect(() => {
    syncTemplateDraft(namespace, templateType, currentResource, baseTemplate);
  }, [baseTemplate, currentResource, namespace, templateType]);

  function syncTemplateDraft(nextNamespace: string, nextType: string, resource?: K8sResourceSummary, builtIn?: K8sBaseTemplate) {
    if (!nextNamespace) {
      return;
    }
    const generatedName = templateNameFromResource(nextType, resource);
    if (generatedName && (!name.trim() || name === lastTemplateName)) {
      setName(generatedName);
      setLastTemplateName(generatedName);
    }
    const generatedYAML = buildTemplateYAML(nextNamespace, nextType, resource, builtIn);
    if (!yamlContent.trim() || yamlContent === lastTemplateYAML) {
      setYamlContent(generatedYAML);
      setLastTemplateYAML(generatedYAML);
    }
  }

  const createMutation = useMutation({
    mutationFn: () => (
      editorMode === 'edit' && selected
        ? k8sApi.updateTemplate({ id: selected.id, name, type: templateType, yamlContent, variables, description: 'NovaObs 发布模板' })
        : k8sApi.createTemplate({ name, type: templateType, yamlContent, variables, description: 'NovaObs 发布模板' })
    ),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.item ?? null);
      setEditorMode('closed');
      queryClient.invalidateQueries({ queryKey: ['k8s-templates'] });
    },
  });

  const renderMutation = useMutation({
    mutationFn: (target: K8sTemplate) => {
      return k8sApi.renderTemplate(target.id, variableValues);
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setRenderedYAML(result.renderedYAML);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (target: K8sTemplate) => {
      return k8sApi.deleteTemplate(target.id);
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(null);
      setDeleteTarget(null);
      setRenderedYAML('');
      queryClient.invalidateQueries({ queryKey: ['k8s-templates'] });
    },
  });

  const permissionError = useMemo(() => {
    const message = createMutation.error?.message || renderMutation.error?.message || deleteMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createMutation.error, renderMutation.error, deleteMutation.error]);

  const current = selected;

  function applyTemplateDraft(item: K8sTemplate) {
    setSelected(item);
    setName(item.name);
    setLastTemplateName(item.name);
    setTemplateType(item.type);
    setSelectedResourceUID('');
    setYamlContent(item.yamlContent);
    setLastTemplateYAML(item.yamlContent);
    setRenderedYAML('');
  }

  function openCreateEditor() {
    const generatedName = templateNameFromResource(templateType, currentResource);
    const generatedYAML = buildTemplateYAML(namespace, templateType, currentResource, baseTemplate);
    setSelected(null);
    setName(generatedName);
    setLastTemplateName(generatedName);
    setYamlContent(generatedYAML);
    setLastTemplateYAML(generatedYAML);
    setEditorMode('create');
    setRenderedYAML('');
  }

  function openEditEditor(item: K8sTemplate) {
    applyTemplateDraft(item);
    setEditorMode('edit');
  }

  function openPreview(item: K8sTemplate) {
    applyTemplateDraft(item);
    setPreviewTemplate(item);
  }

  return (
    <div className="space-y-4">
      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(180px,260px)_minmax(180px,240px)_minmax(220px,280px)_1fr] xl:items-end">
          <div className="rounded-lg bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-xs font-semibold text-muted">当前集群</div>
            <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select
              className="console-input mt-2 w-full"
              value={namespace}
              onChange={(event) => {
                setNamespace(event.target.value);
                setSelectedResourceUID('');
                setRenderedYAML('');
              }}
              disabled={!namespaces.length}
            >
              {!namespaces.length ? <option value="">暂无命名空间</option> : null}
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">资源参考</span>
            <select className="console-input mt-2 w-full" value={selectedResourceUID} onChange={(event) => setSelectedResourceUID(event.target.value)} disabled={!resources.length}>
              {!resources.length ? <option value="">暂无同类型资源</option> : null}
              {resources.map((item) => (
                <option key={resourceOptionKey(item)} value={resourceOptionKey(item)}>{item.identity.kind}/{item.identity.name}</option>
              ))}
            </select>
          </label>

        </div>
        {clusterError || namespaceError || resourceError || baseTemplateError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError || resourceError || baseTemplateError)}
          </div>
        ) : null}
      </section>

      <DataPanel
        title="模板管理"
        meta={isLoading ? '加载中' : '/api/v1/k8s/templates'}
        action={(
          <button className="console-button console-button-primary" onClick={openCreateEditor}>
            <Plus className="h-3.5 w-3.5" />
            新增模板
          </button>
        )}
      >
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            模板读取失败：{errorMessage(error)}
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
        {isLoadingResources ? (
          <div className="mb-3 rounded-lg bg-white/45 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在读取当前命名空间的资源参考。
          </div>
        ) : null}

        <section className="overflow-auto">
          {data.length ? (
            <table className="console-table min-w-[900px] w-full">
              <thead>
                <tr>
                  <th>模板</th>
                  <th>类型</th>
                  <th>变量</th>
                  <th>来源</th>
                  <th>更新时间</th>
                  <th className="w-[132px] text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer bg-white/35 hover:bg-white/60 ${current?.id === item.id ? 'console-selected-row' : ''}`}
                    onClick={() => openPreview(item)}
                  >
                    <td>
                      <div className="font-semibold text-primary">{item.name}</div>
                      <div className="font-mono text-[11px] text-muted">{item.id}</div>
                    </td>
                    <td>{item.type}</td>
                    <td className="max-w-[280px] truncate text-xs text-muted">{item.variables.map((variable) => variable.name).join(', ') || '-'}</td>
                    <td className="text-xs text-muted">{item.source || 'novaobs'}</td>
                    <td className="font-mono text-[11px] text-muted">{formatDate(item.updatedAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="console-icon-button h-7 w-7" aria-label={`编辑模板 ${item.name}`} title="编辑模板" onClick={(event) => { event.stopPropagation(); openEditEditor(item); }}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button className="console-icon-button h-7 w-7" aria-label={`渲染预览 ${item.name}`} title="渲染预览" onClick={(event) => { event.stopPropagation(); openPreview(item); }}>
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button className="console-icon-button h-7 w-7 text-danger hover:border-danger/30 hover:bg-red-50 hover:text-danger" aria-label={`删除模板 ${item.name}`} title="删除模板" onClick={(event) => { event.stopPropagation(); setDeleteTarget(item); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="console-empty-state">
              <div className="text-sm font-semibold text-on-surface">暂无模板记录</div>
              <button className="console-button console-button-primary" onClick={openCreateEditor}>
                <Plus className="h-3.5 w-3.5" />
                新增模板
              </button>
            </div>
          )}
        </section>
      </DataPanel>
      {editorMode !== 'closed' ? (
        <TemplateEditorDrawer
          mode={editorMode}
          name={name}
          templateType={templateType}
          yamlContent={yamlContent}
          variables={variables}
          variableValues={variableValues}
          baseTemplate={baseTemplate}
          pending={createMutation.isPending}
          error={createMutation.error as Error | null}
          onNameChange={setName}
          onTemplateTypeChange={(value) => {
            setTemplateType(value);
            setSelectedResourceUID('');
            setRenderedYAML('');
          }}
          onYamlChange={setYamlContent}
          onClose={() => setEditorMode('closed')}
          onSave={() => createMutation.mutate()}
        />
      ) : null}
      {previewTemplate ? (
        <TemplatePreviewDrawer
          template={previewTemplate}
          renderedYAML={renderedYAML}
          rendering={renderMutation.isPending}
          error={renderMutation.error as Error | null}
          onRender={() => renderMutation.mutate(previewTemplate)}
          onEdit={() => {
            setPreviewTemplate(null);
            openEditEditor(previewTemplate);
          }}
          onClose={() => setPreviewTemplate(null)}
        />
      ) : null}
      {deleteTarget ? (
        <TemplateDeleteDialog
          template={deleteTarget}
          pending={deleteMutation.isPending}
          error={deleteMutation.error as Error | null}
          onDelete={() => deleteMutation.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}

function TemplateEditorDrawer({
  mode,
  name,
  templateType,
  yamlContent,
  variables,
  variableValues,
  baseTemplate,
  pending,
  error,
  onNameChange,
  onTemplateTypeChange,
  onYamlChange,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  name: string;
  templateType: string;
  yamlContent: string;
  variables: Array<{ name: string; defaultValue?: string }>;
  variableValues: Record<string, string>;
  baseTemplate?: K8sBaseTemplate;
  pending: boolean;
  error: Error | null;
  onNameChange: (value: string) => void;
  onTemplateTypeChange: (value: string) => void;
  onYamlChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const disabledReason = !name.trim() || !yamlContent.trim() ? '请先填写模板名称和 YAML' : undefined;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭模板编辑遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[860px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="template-editor-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div id="template-editor-title" className="truncate text-sm font-semibold text-on-surface">{mode === 'edit' ? '编辑模板' : '新增模板'}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{baseTemplate?.source || 'novaobs-base'}</div>
          </div>
          <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭模板编辑" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <section className="rounded-md border border-outline bg-white px-4 py-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="text-sm font-semibold" htmlFor="template-name">Name<input id="template-name" className="console-input mt-2 w-full" value={name} onChange={(event) => onNameChange(event.target.value)} /></label>
              <label className="text-sm font-semibold" htmlFor="template-type">Type<select id="template-type" className="console-input mt-2 w-full" value={templateType} onChange={(event) => onTemplateTypeChange(event.target.value)}>{templateTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <label className="mt-3 block text-sm font-semibold" htmlFor="template-yaml">YAML<textarea id="template-yaml" className="console-input mt-2 min-h-[440px] w-full font-mono text-xs" value={yamlContent} onChange={(event) => onYamlChange(event.target.value)} /></label>
            {error ? <div className="console-notice console-notice-danger mt-3">{error.message}</div> : null}
          </section>
          <section className="rounded-md border border-outline bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <FileCode2 className="h-4 w-4 text-primary" />
              变量摘要
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted md:grid-cols-2">
              {variables.map((item) => (
                <div key={item.name} className="rounded-md border border-outline bg-surface px-3 py-2 font-mono">{item.name}={variableValues[item.name]}</div>
              ))}
              {!variables.length ? <div className="rounded-md border border-dashed border-outline px-3 py-4">当前模板没有变量。</div> : null}
            </div>
          </section>
        </div>
        <div className="console-action-bar shrink-0">
          <div className="min-w-0 text-xs text-muted">{disabledReason ?? '保存后写入模板生产配置并记录审计'}</div>
          <div className="flex gap-2">
            <button className="console-button" onClick={onClose}>取消</button>
            <button className="console-button console-button-primary" title={disabledReason} disabled={Boolean(disabledReason) || pending} onClick={onSave}>
              {pending ? <Play className="h-3.5 w-3.5 animate-spin" /> : null}
              保存模板
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TemplatePreviewDrawer({ template, renderedYAML, rendering, error, onRender, onEdit, onClose }: {
  template: K8sTemplate;
  renderedYAML: string;
  rendering: boolean;
  error: Error | null;
  onRender: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/24">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭模板预览遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[920px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.22)]" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div id="template-preview-title" className="truncate text-sm font-semibold text-on-surface">{template.name}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{template.id} · {template.type}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="console-button" onClick={onRender} disabled={rendering}>
              <Play className={`h-3.5 w-3.5 ${rendering ? 'animate-spin' : ''}`} />
              渲染预览
            </button>
            <button className="console-button" onClick={onEdit}>
              <Edit3 className="h-3.5 w-3.5" />
              编辑
            </button>
            <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭模板预览" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 grid-cols-2 gap-4 overflow-auto bg-surface px-4 py-4 xl:grid">
          <section className="min-w-0 rounded-md border border-outline bg-white px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">YAML</div>
            <pre className="mt-3 max-h-[72vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-outline bg-surface-lowest p-3 font-mono text-xs text-on-surface">{template.yamlContent}</pre>
          </section>
          <section className="mt-4 min-w-0 rounded-md border border-outline bg-white px-4 py-3 xl:mt-0">
            <div className="text-sm font-semibold text-on-surface">渲染预览</div>
            {error ? <div className="console-notice console-notice-danger mt-3">{error.message}</div> : null}
            <pre className="mt-3 max-h-[72vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-outline bg-surface-lowest p-3 font-mono text-xs text-on-surface">
              {renderedYAML || '点击渲染后展示 rendered_yaml'}
            </pre>
          </section>
        </div>
      </aside>
    </div>
  );
}

function TemplateDeleteDialog({ template, pending, error, onDelete, onClose }: {
  template: K8sTemplate;
  pending: boolean;
  error: Error | null;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/28 px-4 py-6">
      <section className="w-full max-w-md rounded-md border border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]">
        <div className="flex items-center justify-between border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="text-sm font-semibold text-on-surface">删除模板</div>
          <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭删除确认" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="font-semibold text-on-surface">删除确认摘要</div>
          <div className="mt-3 rounded-md border border-outline bg-surface px-3 py-3 text-xs text-muted">
            <div className="font-mono">id={template.id}</div>
            <div className="font-mono">name={template.name}</div>
            <div className="font-mono">type={template.type}</div>
          </div>
          {error ? <div className="console-notice console-notice-danger mt-3">{error.message}</div> : null}
        </div>
        <div className="console-action-bar">
          <div className="text-xs text-muted">删除后会记录审计。</div>
          <div className="flex gap-2">
            <button className="console-button" onClick={onClose}>取消</button>
            <button className="console-button text-danger hover:border-danger/30 hover:bg-red-50" disabled={pending} onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              确认删除
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function extractVariables(value: string, context: TemplateContext) {
  const names = Array.from(new Set(Array.from(value.matchAll(/<<([a-zA-Z0-9_-]+)>>/g)).map((match) => match[1])));
  return names.map((name) => ({ name, description: '', defaultValue: defaultVariableValue(name, context), required: true }));
}

function defaultVariableValue(name: string, context: TemplateContext) {
  const resource = context.resource?.identity;
  if (name === 'cluster' || name === 'cluster_id') return context.clusterId;
  if (name === 'namespace') return context.namespace;
  if (name === 'name') return resource?.name || '';
  if (name === 'kind') return resource?.kind || context.templateType;
  if (name === 'replicas') return '1';
  return '';
}

function templateNameFromResource(templateType: string, resource?: K8sResourceSummary) {
  if (!resource?.identity.name) {
    return '';
  }
  return `${resource.identity.name}-${templateType.toLowerCase()}-template`;
}

function buildTemplateYAML(namespace: string, templateType: string, resource?: K8sResourceSummary, builtIn?: K8sBaseTemplate) {
  const kind = templateType || resource?.identity.kind || 'Deployment';
  const apiVersion = apiVersionForKind(kind, resource);
  if (builtIn?.yamlContent?.trim()) {
    return applyBaseTemplateDefaults(builtIn.yamlContent, namespace, kind, resource);
  }
  return `apiVersion: ${apiVersion}
kind: ${kind}
metadata:
  name: <<name>>
  namespace: ${namespace}
spec:
  replicas: <<replicas>>`;
}

function applyBaseTemplateDefaults(baseYAML: string, namespace: string, kind: string, resource?: K8sResourceSummary) {
  const name = templateNameFromResource(kind, resource).replace(/-template$/, '') || resource?.identity.name || 'app';
  const replacements: Record<string, string> = {
    namespace,
    name,
    app: resource?.labels?.app || name,
    container: name,
    service: resource?.identity.kind === 'Service' ? resource.identity.name : name,
    target: resource?.identity.name || name,
    replicas: '1',
    port: '80',
    target_port: '80',
    image: 'example/app:latest',
    host: 'example.internal',
    gateway: 'default-gateway',
    path: '/',
    value: 'value',
    min_replicas: '1',
    max_replicas: '3',
  };
  return baseYAML.replace(/<<([a-zA-Z0-9_]+)>>/g, (match, key) => replacements[key] ?? match);
}

function apiVersionForKind(kind: string, resource?: K8sResourceSummary) {
  if (resource?.identity.apiVersion) {
    return resource.identity.apiVersion;
  }
  if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet' || kind === 'ReplicaSet') {
    return 'apps/v1';
  }
  if (kind === 'Ingress') {
    return 'networking.k8s.io/v1';
  }
  if (kind === 'HorizontalPodAutoscaler') {
    return 'autoscaling/v2';
  }
  if (kind === 'Gateway' || kind === 'VirtualService' || kind === 'DestinationRule' || kind === 'EnvoyFilter') {
    return 'networking.istio.io/v1';
  }
  return 'v1';
}

function resourceOptionKey(resource: K8sResourceSummary) {
  return resource.identity.uid || `${resource.identity.kind}/${resource.identity.namespace}/${resource.identity.name}`;
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}

type TemplateContext = {
  clusterId: string;
  namespace: string;
  resource?: K8sResourceSummary;
  templateType: string;
};
