import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, History, RotateCcw } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sDeploymentHistoryPage() {
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
    queryKey: ['k8s-deployment-history', activeClusterId, namespace],
    queryFn: () => k8sApi.listDeploymentHistory(activeClusterId, namespace),
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
        <HistoryMetric icon={History} label="部署记录" value={String(data.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <HistoryMetric icon={GitBranch} label="版本维度" value="revision" meta="rollout trace" />
        <HistoryMetric icon={RotateCcw} label="回滚依据" value="read-only" meta={namespace ? `namespace/${namespace}` : 'cluster scope'} />
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
            部署历史按真实集群筛选，通过 `/api/v1/k8s/deployment-history` 读取；回滚仍要求完整资源身份和 NovaObs RBAC 审计。
          </div>
        </div>
        {clusterError || namespaceError ? (
          <Warning text={clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError)} />
        ) : null}
      </section>

      <DataPanel title="部署历史" meta={isLoading ? '加载中' : `${data.length} 条记录 · 最近 15 分钟`}>
        {error ? <Warning text={`部署历史读取失败：${errorMessage(error)}`} /> : null}
        {isLoading ? <Loading text="正在读取部署历史。" /> : null}
        {!isLoading && !error && data.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[880px] w-full">
              <thead>
                <tr>
                  <th>Workload</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>动作</th>
                  <th>版本</th>
                  <th>执行人</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="bg-white/35 hover:bg-white/60">
                    <td className="font-semibold text-primary">{item.workload}</td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.namespace}</td>
                    <td className="font-mono text-xs">{item.action}</td>
                    <td className="font-mono text-xs">{item.revision || '-'}</td>
                    <td className="text-xs text-muted">{item.actor || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!activeClusterId ? <Empty text="请先登记并选择集群" /> : null}
        {activeClusterId && !isLoading && !error && !data.length ? <Empty text="暂无部署历史" /> : null}
      </DataPanel>
    </div>
  );
}

function HistoryMetric({ icon: Icon, label, value, meta }: { icon: typeof History; label: string; value: string; meta: string }) {
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

function Warning({ text }: { text: string }) {
  return <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">{text}</div>;
}

function Loading({ text }: { text: string }) {
  return <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">{text}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg bg-white/45 px-4 py-8 text-center font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">{text}</div>;
}

function StatusPill({ status }: { status: string }) {
  const warning = status === 'warning';
  return <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>{warning ? '警告' : status || 'unknown'}</span>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '读取失败';
}
