import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { k8sApi } from './api';
import { useK8sOpsContext } from './context';

export function K8sAuditPage() {
  const [namespace, setNamespace] = useState('');
  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

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
    if (namespace && !namespaces.some((item) => item.name === namespace)) {
      setNamespace('');
    }
  }, [namespace, namespaces]);

  return (
    <div className="space-y-4">
      <div className="console-panel grid divide-y divide-outline md:grid-cols-3 md:divide-x md:divide-y-0">
        <AuditMetric label="审计事件" value={String(data.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <AuditMetric label="追踪字段" value="trace_id" meta="request lineage" />
        <AuditMetric label="权限上下文" value="RBAC" meta={namespace ? `namespace/${namespace}` : 'cluster scope'} />
      </div>

      <section className="console-panel">
        <div className="console-toolbar">
          <div>
            <div className="text-xs font-semibold text-muted">当前集群</div>
            <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
          </div>
          <label className="console-field w-full md:w-60">
            <span className="console-field-label">命名空间筛选</span>
            <select className="console-input w-full" value={namespace} onChange={(event) => setNamespace(event.target.value)} disabled={!namespaces.length} title={!namespaces.length ? '当前集群暂无可筛选命名空间' : undefined}>
              <option value="">全部命名空间</option>
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
        {clusterError || namespaceError ? (
          <div className="console-notice console-notice-warning m-3">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError)}
          </div>
        ) : null}
      </section>

      <DataPanel title="操作审计" meta={isLoading ? '加载中' : `${data.length} 条事件`}>
        {error ? (
          <div className="console-notice console-notice-warning mb-3">
            操作审计读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {isLoading ? (
          <div className="space-y-2 py-2"><div className="console-skeleton h-10" /><div className="console-skeleton h-10" /><div className="console-skeleton h-10" /></div>
        ) : null}
        {!isLoading && !error && data.length ? (
          <div className="console-resource-list">
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
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold text-primary">{item.resourceName}</div>
                      <div className="text-[11px] text-muted">{item.resourceKind}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.namespace}</td>
                    <td className="font-mono text-xs">{item.action}</td>
                    <td className="text-xs text-muted">{item.actor || '-'}</td>
                    <td className="font-mono text-[11px] text-muted">{item.traceId || '-'}</td>
                    <td><StatusBadge value={item.status || 'unknown'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!activeClusterId ? (
          <div className="console-empty-state"><div className="text-sm font-semibold text-on-surface">尚未选择集群</div><div className="text-xs text-muted">请先登记并选择集群后查看操作审计。</div></div>
        ) : null}
        {activeClusterId && !isLoading && !error && !data.length ? (
          <div className="console-empty-state"><div className="text-sm font-semibold text-on-surface">暂无操作审计</div><div className="text-xs text-muted">当前集群与筛选范围尚未产生受管操作记录。</div></div>
        ) : null}
      </DataPanel>
    </div>
  );
}

function AuditMetric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <section className="px-4 py-3">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-on-surface">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{meta}</div>
    </section>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '读取失败';
}
