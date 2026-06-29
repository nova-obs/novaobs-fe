import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import { k8sApi } from './api';
import { useK8sOpsContext } from './context';

export function DashboardPage() {
  const { activeClusterId, activeCluster, clusters, clusterError } = useK8sOpsContext();

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
      <section className="console-panel">
        <div className="console-toolbar">
          <div className="console-toolbar-group">
            <div>
              <div className="text-[11px] font-semibold text-muted">当前集群</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
            </div>
            <StatusBadge value={stats?.health ?? activeCluster?.status ?? 'unknown'} />
          </div>
          <div className="console-audit-meta">
            <span>source {sync?.source ?? 'Kubernetes API'}</span>
            <span>配置状态 {sync?.status ?? 'unknown'}</span>
          </div>
        </div>
        <div className="grid divide-y divide-outline md:grid-cols-4 md:divide-x md:divide-y-0">
          <CompactMetric label="运行工作负载" value={String(stats?.workloads ?? 0)} meta="Deployment" />
          <CompactMetric label="命名空间" value={String(stats?.namespaces ?? 0)} meta="Kubernetes API" />
          <CompactMetric label="Pod Ready" value={`${readyPods} / ${totalPods}`} meta={`${warningPods} warning`} />
          <CompactMetric label="已登记集群" value={String(clusters.length)} meta="NovaObs metadata" />
        </div>
      </section>

      {clusterError || error ? (
        <div className="console-notice console-notice-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : 'K8s Dashboard 真实快照读取失败，请检查集群凭据、RBAC 与 Kubernetes API 连通性。'}
        </div>
      ) : null}

      <div className="console-workbench grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <DataPanel title="控制面状态" meta={`cluster/${stats?.clusterId || activeClusterId || '等待登记'}`}>
          <div className="console-resource-list">
            <table className="console-table w-full min-w-[620px]">
              <thead>
                <tr>
                  <th>组件</th>
                  <th>当前值</th>
                  <th>来源</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <ControlPlaneRow label="API Server" value={signalMeta(signals, 'api-server')} source="Kubernetes API" state={signalMeta(signals, 'api-server')} />
                <ControlPlaneRow label="Workloads" value={`${stats?.workloads ?? 0} active`} source="Deployment" state={stats?.health ?? 'unknown'} />
                <ControlPlaneRow label="Namespaces" value={`${stats?.namespaces ?? 0} domains`} source="Kubernetes API" state={sync?.status ?? 'unknown'} />
                <ControlPlaneRow label="RBAC" value={activeCluster?.readOnly ? 'read-only' : 'write-enabled'} source="NovaObs policy" state={activeCluster?.readOnly ? 'warning' : 'healthy'} />
              </tbody>
            </table>
          </div>
        </DataPanel>
        <DataPanel title="集群策略" meta={activeCluster?.id ?? activeClusterId ?? '-'}>
          <div className="space-y-2">
            <PolicyRow label="接入模式" value={activeCluster?.accessMode || '-'} />
            <PolicyRow label="写入保护" value={activeCluster?.readOnly ? '只读' : '允许写入'} />
            <PolicyRow label="K8s 版本" value={activeCluster?.version || '-'} />
            <PolicyRow label="区域" value={activeCluster?.region || '-'} />
          </div>
        </DataPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <DataPanel title="实时信号" meta={sync?.source ?? 'Kubernetes API'}>
          <div className="console-resource-list">
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
                  <tr key={signal.key}>
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
            <div className="console-empty-state mt-3">
              <div className="text-sm font-semibold text-on-surface">{activeClusterId ? '暂无实时信号' : '尚未选择集群'}</div>
              <div className="text-xs text-muted">{activeClusterId ? '等待后端返回 Kubernetes 快照。' : '请先登记并选择集群。'}</div>
            </div>
          ) : null}
        </DataPanel>

        <DataPanel title="操作审计" meta={auditError ? '读取失败' : `${auditEvents.length} 条`}>
          <div className="divide-y divide-outline">
            {auditEvents.map((event) => (
              <div key={event.id} className="px-1 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-on-surface">{event.resourceKind}/{event.resourceName}</div>
                    <div className="console-audit-meta mt-1"><span>{formatDateTime(event.createdAt)}</span><span>{event.action}</span><span>{event.actor || '-'}</span></div>
                  </div>
                  <StatusBadge value={event.status} />
                </div>
              </div>
            ))}
            {!auditEvents.length ? (
              <div className="console-empty-state">
                <div className="text-sm font-semibold text-on-surface">{auditError ? '审计事件读取失败' : '暂无操作审计事件'}</div>
                <div className="text-xs text-muted">{auditError ? '请稍后重试并检查审计服务。' : '当前集群尚未产生受管操作记录。'}</div>
              </div>
            ) : null}
          </div>
        </DataPanel>
      </div>
    </div>
  );
}

function CompactMetric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-on-surface">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{meta}</div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-outline bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <span className="font-mono text-xs font-semibold text-on-surface">{value}</span>
      </div>
    </div>
  );
}

function ControlPlaneRow({ label, value, source, state }: { label: string; value: string; source: string; state: string }) {
  return (
    <tr>
      <td className="font-semibold text-on-surface">{label}</td>
      <td className="font-mono text-xs">{value}</td>
      <td className="text-xs text-muted">{source}</td>
      <td><StatusBadge value={state} /></td>
    </tr>
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
