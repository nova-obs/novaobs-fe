import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Database, GitBranch, KeyRound, Layers3, Network, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import { k8sApi } from './api';

const lifecycle = [
  ['接入来源', 'startorch', '能力基线已合并'],
  ['权限模型', 'NovaObs RBAC', '租户 / 集群 / 命名空间'],
  ['凭据托管', 'Secret Store', 'kubeconfig 加密落库'],
  ['操作审计', 'Audit Event', 'trace_id 已预留'],
];

export function DashboardPage() {
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const { data: clusters = [], isLoading: isLoadingClusters, error: clusterError } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const activeClusterId = selectedClusterId || clusters[0]?.id || '';

  useEffect(() => {
    if (!selectedClusterId && clusters[0]?.id) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  const { data, error, isLoading } = useQuery({
    queryKey: ['k8s-dashboard', activeClusterId],
    queryFn: () => api.getK8sDashboard(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });
  const { data: auditEvents = [], error: auditError } = useQuery({
    queryKey: ['k8s-audit-events', activeClusterId],
    queryFn: () => k8sApi.listAuditEvents(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  const stats = data?.stats;
  const sync = data?.sync;
  const readyPods = stats?.pods.ready ?? 0;
  const totalPods = stats?.pods.total ?? 0;
  const warningPods = stats?.pods.warning ?? 0;
  const signals = data?.signals ?? [];

  return (
    <div className="space-y-4">
      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr_auto] md:items-center">
          <label className="block">
            <span className="text-xs font-semibold text-muted">集群选择</span>
            <select
              className="console-input mt-2 w-full"
              value={activeClusterId}
              onChange={(event) => setSelectedClusterId(event.target.value)}
              disabled={isLoadingClusters || !clusters.length}
            >
              {!clusters.length ? <option value="">暂无已登记集群</option> : null}
              {clusters.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.id}</option>
              ))}
            </select>
          </label>
          <div className="text-sm text-muted">
            Dashboard 使用 NovaObs 后端实时只读 Kubernetes API 快照，不再回退到本地占位资源表。
          </div>
          <div className="rounded-lg bg-white/60 px-3 py-2 font-mono text-xs font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            {sync?.timeWindow ?? '最近 15 分钟'}
          </div>
        </div>
      </section>

      {clusterError || error ? (
        <div className="console-panel flex items-center gap-3 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : 'K8s Dashboard 真实快照读取失败，请检查集群凭据、RBAC 与 Kubernetes API 连通性。'}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="console-panel relative min-h-[330px] overflow-hidden p-5">
          <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_24%_22%,rgba(31,122,118,0.12),transparent_28%),radial-gradient(circle_at_72%_64%,rgba(88,127,67,0.1),transparent_32%),linear-gradient(120deg,rgba(255,255,255,0.52),transparent_52%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">集群态势</h2>
                <span className="rounded-full bg-primary-soft/75 px-2 py-0.5 text-[11px] font-semibold text-primary">source: {sync?.source ?? 'Kubernetes API'}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{sync?.timeWindow ?? '最近 15 分钟'} · 配置状态：{sync?.status ?? 'unknown'}</p>
            </div>
            <span className="rounded-lg bg-white/60 px-3 py-1.5 font-mono text-xs font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              cluster/{stats?.clusterId || activeClusterId || '等待登记'}
            </span>
          </div>

          <div className="relative mt-5 grid min-h-[240px] gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-2 md:hidden">
              {[
                ['API Server', signalMeta(signals, 'api-server')],
                ['Workloads', `${stats?.workloads ?? 0} active`],
                ['Namespaces', `${stats?.namespaces ?? 0} domains`],
                ['RBAC Sync', 'NovaObs policy'],
              ].map(([label, meta]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-white/52 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                  <span className="text-sm font-semibold text-on-surface">{label}</span>
                  <span className="font-mono text-[11px] text-muted">{meta}</span>
                </div>
              ))}
            </div>

            <div className="relative hidden overflow-hidden rounded-lg bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:block">
              <svg className="absolute inset-0 h-full w-full text-primary/35" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M12 54 C24 32 38 34 48 24 C62 10 72 32 88 20" fill="none" stroke="currentColor" strokeWidth="0.55" strokeDasharray="1.5 2.5" />
                <path d="M18 78 C30 62 42 68 54 52 C66 35 74 48 88 38" fill="none" stroke="currentColor" strokeWidth="0.55" strokeDasharray="1.5 2.5" />
                <path d="M24 24 C34 45 52 44 64 64 C70 74 80 72 90 82" fill="none" stroke="currentColor" strokeWidth="0.45" strokeDasharray="1 3" />
              </svg>
              <ClusterNode className="left-[24%] top-[42%]" icon={Network} label="API Server" meta={signalMeta(signals, 'api-server')} />
              <ClusterNode className="left-[58%] top-[28%]" icon={Boxes} label="Workloads" meta={`${stats?.workloads ?? 0} active`} />
              <ClusterNode className="left-[75%] top-[62%]" icon={Database} label="Namespaces" meta={`${stats?.namespaces ?? 0} domains`} />
              <ClusterNode className="left-[38%] top-[76%]" icon={GitBranch} label="RBAC Sync" meta="NovaObs policy" />
            </div>

            <div className="grid gap-3">
              <Metric label="Pod Ready" value={`${readyPods} / ${totalPods}`} meta={`${warningPods} warning`} />
              <Metric label="Health" value={stats?.health ?? 'unknown'} meta="API aggregation" />
              <Metric label="Sync" value={sync?.status ?? 'unknown'} meta={sync?.source ?? 'startorch'} />
            </div>
          </div>
        </section>

        <DataPanel title="迁移闭环" meta={isLoading ? '加载 K8sOps Dashboard' : '权限、凭据、审计统一入口'}>
          <div className="space-y-2">
            {lifecycle.map(([label, value, meta]) => (
              <div key={label} className="rounded-lg bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted">{label}</span>
                  <span className="font-mono text-xs font-semibold text-on-surface">{value}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted">{meta}</div>
              </div>
            ))}
          </div>
        </DataPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile icon={Layers3} label="运行工作负载" value={String(stats?.workloads ?? 0)} source="Deployment" />
        <SummaryTile icon={Database} label="命名空间" value={String(stats?.namespaces ?? 0)} source="Kubernetes API" />
        <SummaryTile icon={ShieldCheck} label="Pod Ready" value={`${readyPods} / ${totalPods}`} source={`${warningPods} warning`} />
        <SummaryTile icon={KeyRound} label="已登记集群" value={String(clusters.length)} source="NovaObs metadata" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <DataPanel title="实时信号" meta={`${sync?.source ?? 'Kubernetes API'} · ${sync?.timeWindow ?? '最近 15 分钟'}`}>
          <div className="overflow-auto">
            <table className="console-table min-w-[680px] w-full">
              <thead>
                <tr>
                  <th>信号</th>
                  <th>来源</th>
                  <th>检查时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => (
                  <tr key={signal.key} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold">{signal.label}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted">{signal.key}</div>
                    </td>
                    <td className="text-xs text-muted">{signal.source}</td>
                    <td className="font-mono text-xs">{formatDateTime(signal.checkedAt)}</td>
                    <td><StatePill state={signal.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!signals.length ? (
            <div className="mt-3 rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              {activeClusterId ? '暂无实时信号，等待后端返回 Kubernetes 快照。' : '请先登记并选择集群。'}
            </div>
          ) : null}
        </DataPanel>

        <DataPanel title="操作审计" meta={auditError ? 'Audit Event 读取失败' : 'Audit Event · trace 预留'}>
          <div className="space-y-2">
            {auditEvents.map((event) => (
              <div key={event.id} className="rounded-lg bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-on-surface">{event.resourceKind}/{event.resourceName}</div>
                    <div className="mt-1 text-[11px] text-muted">{formatDateTime(event.createdAt)} · {event.action}</div>
                  </div>
                  <StatePill state={event.status} />
                </div>
              </div>
            ))}
            {!auditEvents.length ? (
              <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                {auditError ? '审计事件读取失败，请稍后重试。' : '当前集群暂无操作审计事件。'}
              </div>
            ) : null}
          </div>
        </DataPanel>
      </div>
    </div>
  );
}

function ClusterNode({ className, icon: Icon, label, meta }: { className: string; icon: typeof Network; label: string; meta: string }) {
  return (
    <div className={`absolute flex min-w-32 -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-lg bg-white/78 px-2.5 py-2 shadow-[0_18px_42px_-28px_rgba(29,36,38,0.55),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-primary/10 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-on-surface">{label}</div>
        <div className="mt-0.5 text-[11px] text-muted">{meta}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-lg bg-white/52 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-2 font-mono text-xl font-semibold text-on-surface">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{meta}</div>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, source }: { icon: typeof Layers3; label: string; value: string; source: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-3 font-mono text-3xl tracking-tight text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{source}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}

function StatePill({ state }: { state: string }) {
  const warning = state === 'warning';
  const failed = state === 'failed';
  const healthy = state === 'healthy' || state === 'active' || state === 'success';
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${failed ? 'bg-red-100 text-danger' : warning ? 'bg-amber-100 text-warning' : healthy ? 'bg-primary-soft text-primary' : 'bg-white/70 text-muted'}`}>
      {failed ? '失败' : warning ? '警告' : healthy ? '正常' : '未知'}
    </span>
  );
}

function signalMeta(signals: Array<{ key: string; status: string }>, key: string) {
  return signals.find((item) => item.key === key)?.status ?? 'unknown';
}

function formatDateTime(value: string) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}
