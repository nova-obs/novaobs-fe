import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileClock, Fingerprint, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sAuditPage() {
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const { data: clusters = [], isLoading: isLoadingClusters, error: clusterError } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const activeClusterId = selectedClusterId || clusters[0]?.id || '';

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-audit-events', activeClusterId, namespace],
    queryFn: () => k8sApi.listAuditEvents(activeClusterId, namespace),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  useEffect(() => {
    if (!selectedClusterId && clusters[0]?.id) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    if (namespace && !namespaces.some((item) => item.name === namespace)) {
      setNamespace('');
    }
  }, [namespace, namespaces]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <AuditMetric icon={FileClock} label="审计事件" value={String(data.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <AuditMetric icon={Fingerprint} label="Trace" value="trace_id" meta="request lineage" />
        <AuditMetric icon={ShieldCheck} label="权限上下文" value="RBAC" meta={namespace ? `namespace/${namespace}` : 'cluster scope'} />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(200px,280px)_minmax(180px,240px)_1fr] md:items-end">
          <label className="block">
            <span className="text-xs font-semibold text-muted">集群选择</span>
            <select
              className="console-input mt-2 w-full"
              value={activeClusterId}
              onChange={(event) => {
                setSelectedClusterId(event.target.value);
                setNamespace('');
              }}
              disabled={isLoadingClusters || !clusters.length}
            >
              {!clusters.length ? <option value="">暂无已登记集群</option> : null}
              {clusters.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.id}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间筛选</span>
            <select className="console-input mt-2 w-full" value={namespace} onChange={(event) => setNamespace(event.target.value)} disabled={!namespaces.length}>
              <option value="">全部命名空间</option>
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="text-sm text-muted">
            审计事件来自 `/api/v1/k8s/audit-events` 与 NovaObs 平台审计流，并按真实集群和命名空间聚合展示。
          </div>
        </div>
        {clusterError || namespaceError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError)}
          </div>
        ) : null}
      </section>

      <DataPanel title="操作审计" meta={isLoading ? '加载中' : `${data.length} 条事件 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            操作审计读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {isLoading ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">正在读取操作审计。</div>
        ) : null}
        {!isLoading && !error && data.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[880px] w-full">
              <thead>
                <tr>
                  <th>资源</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>动作</th>
                  <th>Actor</th>
                  <th>Trace</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.resourceName}</div>
                      <div className="text-[11px] text-muted">{item.resourceKind}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.namespace}</td>
                    <td className="font-mono text-xs">{item.action}</td>
                    <td className="text-xs text-muted">{item.actor || '-'}</td>
                    <td className="font-mono text-[11px] text-muted">{item.traceId || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!activeClusterId ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">请先登记并选择集群</div>
        ) : null}
        {activeClusterId && !isLoading && !error && !data.length ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">暂无操作审计</div>
        ) : null}
      </DataPanel>
    </div>
  );
}

function AuditMetric({ icon: Icon, label, value, meta }: { icon: typeof FileClock; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-3 font-mono text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const warning = status === 'warning';
  return <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>{warning ? '警告' : status || 'unknown'}</span>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '读取失败';
}
