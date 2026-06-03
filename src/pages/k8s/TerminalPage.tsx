import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleSlash2, Play, ShieldCheck, SquareTerminal } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sResourceSummary, type K8sTerminalResult } from './api';
import { useK8sOpsContext } from './context';

const BLOCKED_EXAMPLES = ['delete', 'apply', 'exec', 'port-forward', '|', ';'];

export function K8sTerminalPage() {
  const [namespace, setNamespace] = useState('');
  const [selectedResourceUID, setSelectedResourceUID] = useState('');
  const [command, setCommand] = useState('');
  const [lastTemplateCommand, setLastTemplateCommand] = useState('');
  const [result, setResult] = useState<K8sTerminalResult | null>(null);

  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  const { data: resources = [], isLoading: isLoadingResources, error: resourceError } = useQuery({
    queryKey: ['k8s-terminal-resources', activeClusterId, namespace],
    queryFn: () => k8sApi.listResources({ clusterId: activeClusterId, namespace, kind: 'Deployment' }),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      setSelectedResourceUID('');
      setCommand('');
      setLastTemplateCommand('');
      setResult(null);
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  useEffect(() => {
    const resourceExists = resources.some((item) => resourceOptionKey(item) === selectedResourceUID);
    if (selectedResourceUID && !resourceExists) {
      const nextResource = resources[0];
      setSelectedResourceUID(nextResource ? resourceOptionKey(nextResource) : '');
      syncTemplateCommandForTarget(namespace, nextResource);
      setResult(null);
      return;
    }
    if (!selectedResourceUID && resources[0]) {
      setSelectedResourceUID(resourceOptionKey(resources[0]));
      syncTemplateCommandForTarget(namespace, resources[0]);
      setResult(null);
    }
  }, [resources, selectedResourceUID]);

  useEffect(() => {
    if (!command.trim() && namespace) {
      const nextCommand = buildPodCommand(namespace);
      setCommand(nextCommand);
      setLastTemplateCommand(nextCommand);
    }
  }, [command, namespace]);

  const currentResource = resources.find((item) => resourceOptionKey(item) === selectedResourceUID) ?? resources[0];
  const commandTemplates = useMemo(() => buildCommandTemplates(namespace, currentResource), [currentResource, namespace]);
  const safeExamples = useMemo(() => commandTemplates.filter((item) => item.tone === 'safe').map((item) => item.command), [commandTemplates]);

  function syncTemplateCommandForTarget(nextNamespace: string, nextResource?: K8sResourceSummary) {
    const matchedTemplate = commandTemplates.find((item) => item.command === command);
    const shouldSyncTemplate = !command.trim() || command === lastTemplateCommand || Boolean(matchedTemplate);
    if (!shouldSyncTemplate || !nextNamespace) {
      return;
    }

    const nextTemplates = buildCommandTemplates(nextNamespace, nextResource);
    const nextCommand = nextTemplates.find((item) => item.label === matchedTemplate?.label)?.command ?? buildPodCommand(nextNamespace);
    setCommand(nextCommand);
    setLastTemplateCommand(nextCommand);
  }

  const mutation = useMutation({
    mutationFn: () => k8sApi.execTerminal({ clusterId: activeClusterId, namespace, command }),
    onSuccess: (next) => setResult(next),
  });

  const permissionError = useMemo(() => {
    const message = mutation.error?.message ?? '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [mutation.error]);

  const policyError = useMemo(() => {
    if (result?.status === 'blocked') return result.blockedReason || '命令已被安全策略阻断';
    const message = mutation.error?.message ?? '';
    return message.includes('安全策略') || message.includes('blocked') ? message : '';
  }, [mutation.error, result]);
  const statusTone = result?.status === 'blocked' ? 'danger' : result?.status === 'accepted' ? 'safe' : 'idle';
  const canExecute = Boolean(activeClusterId && namespace && command.trim());

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <TerminalMetric icon={SquareTerminal} label="执行模式" value={result?.mode || 'kubectl'} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <TerminalMetric icon={ShieldCheck} label="权限域" value="namespace" meta={namespace ? `namespace/${namespace}` : '等待命名空间'} />
        <TerminalMetric icon={CircleSlash2} label="策略" value="read-only" meta="danger verbs blocked" />
      </div>

      <DataPanel title="受控终端" meta={result?.auditId ? `audit/${result.auditId}` : '等待执行'}>
        {permissionError ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            权限不足：当前用户缺少 `k8s.terminal:exec` 命名空间权限。
          </div>
        ) : null}
        {policyError ? (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-danger">
            命令已被安全策略阻断，后端会记录阻断审计。
          </div>
        ) : null}
        {clusterError || namespaceError || resourceError ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError || resourceError)}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">运行目标</div>
            <p className="mt-1 text-xs text-muted">选择命名空间和 Pod 后执行只读命令。</p>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-muted">当前集群</span>
                <div className="mt-2 rounded-lg bg-white/55 px-3 py-2 font-mono text-sm font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                  {activeCluster?.name || activeClusterId || '未选择'}
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted">命名空间选择</span>
                <select
                  className="console-input mt-2 w-full"
                  value={namespace}
                  onChange={(event) => {
                    const nextNamespace = event.target.value;
                    setNamespace(nextNamespace);
                    setSelectedResourceUID('');
                    syncTemplateCommandForTarget(nextNamespace);
                    setResult(null);
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
                <select
                  className="console-input mt-2 w-full"
                  value={selectedResourceUID}
                  onChange={(event) => {
                    const nextResourceUID = event.target.value;
                    const nextResource = resources.find((item) => resourceOptionKey(item) === nextResourceUID);
                    setSelectedResourceUID(nextResourceUID);
                    syncTemplateCommandForTarget(namespace, nextResource);
                    setResult(null);
                  }}
                  disabled={!resources.length}
                >
                  {!resources.length ? <option value="">暂无 Deployment 资源</option> : null}
                  {resources.map((item) => (
                    <option key={resourceOptionKey(item)} value={resourceOptionKey(item)}>{item.identity.kind}/{item.identity.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <TargetItem label="cluster_id" value={activeClusterId || '-'} />
              <TargetItem label="namespace" value={namespace || '-'} />
              <TargetItem label="resource" value={currentResource ? `${currentResource.identity.kind}/${currentResource.identity.name}` : '-'} />
              <TargetItem label="source" value={isLoadingResources ? 'loading' : 'Kubernetes API'} />
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted">命令模板</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {commandTemplates.map((item) => (
                  <button
                    key={item.label}
                    className={`rounded-lg px-3 py-2 text-left text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:bg-white/75 active:scale-[0.98] ${item.tone === 'danger' ? 'bg-rose-50/80 text-danger' : 'bg-white/55 text-on-surface'}`}
                    title={item.description}
                    onClick={() => {
                      setCommand(item.command);
                      setLastTemplateCommand(item.command);
                      setResult(null);
                    }}
                  >
                    {item.label}
                    <span className="mt-1 block truncate font-mono text-[11px] font-medium text-muted">{item.command}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-3 block text-xs font-semibold text-muted">
              command
              <textarea className="console-input mt-2 min-h-28 w-full font-mono text-xs" value={command} onChange={(event) => setCommand(event.target.value)} />
            </label>
            {!canExecute ? (
              <div className="mt-3 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                请先选择集群和命名空间；终端只开放只读 kubectl 语义，危险动词会进入策略阻断。
              </div>
            ) : null}
            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canExecute || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              <Play className="h-4 w-4" />
              执行校验
            </button>
          </section>

          <section className="console-panel px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">执行回显</div>
                <p className="mt-1 text-xs text-muted">输出区展示 accepted / blocked、退出码、审计 ID 和 output_truncated。</p>
              </div>
              <span className={`rounded-lg px-3 py-1 text-xs font-semibold ${statusTone === 'danger' ? 'bg-rose-50 text-danger' : 'bg-primary-soft text-primary'}`}>{result?.mode ?? 'policy_guard'}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <ResultBox label="status" value={result?.status ?? '-'} />
              <ResultBox label="exit_code" value={String(result?.exitCode ?? '-')} />
              <ResultBox label="audit_id" value={result?.auditId ?? '-'} />
              <ResultBox label="output_truncated" value={result?.outputTruncated ? 'true' : 'false'} />
            </div>
            {result?.status === 'blocked' ? (
              <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">
                blocked：{result.blockedReason || result.output}
              </div>
            ) : null}
            {result?.outputTruncated ? (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
                output_truncated：输出已按 NovaObs 终端策略截断。
              </div>
            ) : null}
            <pre className={`mt-4 min-h-52 overflow-auto rounded-lg p-4 text-xs leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${statusTone === 'danger' ? 'bg-[#2b1117] text-[#fecdd3]' : 'bg-[#111827] text-[#d1fae5]'}`}>
{result?.output ?? '等待命令校验。'}
            </pre>
          </section>
        </div>
      </DataPanel>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-4 md:grid-cols-2">
          <PolicyList title="只读示例" items={safeExamples} tone="safe" />
          <PolicyList title="阻断示例" items={BLOCKED_EXAMPLES} tone="danger" />
        </div>
      </section>
    </div>
  );
}

function TargetItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase text-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-[11px] font-semibold text-on-surface">{value}</div>
    </div>
  );
}

function TerminalMetric({ icon: Icon, label, value, meta }: { icon: typeof SquareTerminal; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-4 font-display text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}

function ResultBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="text-[11px] font-semibold uppercase text-muted">{label}</div>
      <div className="mt-2 truncate font-mono text-xs font-semibold text-on-surface">{value}</div>
    </div>
  );
}

function PolicyList({ title, items, tone }: { title: string; items: string[]; tone: 'safe' | 'danger' }) {
  return (
    <div>
      <div className="text-sm font-semibold text-on-surface">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className={`rounded-lg px-3 py-1 text-xs font-semibold ${tone === 'safe' ? 'bg-primary-soft text-primary' : 'bg-rose-50 text-danger'}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function buildCommandTemplates(namespace: string, resource?: K8sResourceSummary) {
  const targetNamespace = namespace || 'default';
  const workloadName = resource?.identity.name || '<deployment>';
  return [
    { label: 'Pods', command: buildPodCommand(targetNamespace), description: '查看命名空间 Pod 列表', tone: 'safe' as const },
    { label: 'Describe', command: `describe deployment ${workloadName} -n ${targetNamespace}`, description: '查看工作负载事件', tone: 'safe' as const },
    { label: 'Logs', command: `logs deployment/${workloadName} -n ${targetNamespace} --tail=100`, description: '读取最近 100 行日志', tone: 'safe' as const },
    { label: 'Blocked', command: `delete pod ${workloadName}`, description: '验证策略阻断与审计', tone: 'danger' as const },
  ];
}

function buildPodCommand(namespace: string) {
  return `get pods -n ${namespace || 'default'}`;
}

function resourceOptionKey(resource: K8sResourceSummary) {
  return resource.identity.uid || `${resource.identity.kind}/${resource.identity.namespace}/${resource.identity.name}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '读取失败';
}
