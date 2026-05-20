import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Folder, Layers3, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sNamespacePage() {
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

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });
  const namespaces = data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <NamespaceMetric icon={Folder} label="命名空间" value={String(namespaces.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <NamespaceMetric icon={Layers3} label="资源域" value="tenant" meta="service ownership" />
        <NamespaceMetric icon={ShieldCheck} label="权限范围" value="namespace" meta="NovaObs RBAC" />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr] md:items-end">
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
            数据从已登记集群凭据实时读取；若凭据缺失或 RBAC 不允许读取，会在下方显示后端错误态。
          </div>
        </div>
      </section>

      <DataPanel title="命名空间列表" meta={activeClusterId ? `${namespaces.length} 个命名空间 · 最近 15 分钟` : '等待集群选择'}>
        {isLoading ? (
          <div className="mb-3 rounded-lg bg-white/45 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在从 `/api/v1/k8s/namespaces` 读取命名空间。
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            命名空间读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {!isLoading && !error && namespaces.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[760px] w-full">
              <thead>
                <tr>
                  <th>命名空间</th>
                  <th>集群</th>
                  <th>Phase</th>
                  <th>Owner</th>
                  <th>状态</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {namespaces.map((item) => (
                  <tr key={`${item.clusterId}-${item.name}`} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.name}</div>
                      <div className="text-[11px] text-muted">{item.id}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.phase || '-'}</td>
                    <td className="text-xs text-muted">{item.owner || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td className="text-xs text-muted">novaobs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!activeClusterId ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">{clusterError ? '集群列表读取失败' : '请先在集群管理中登记集群'}</div>
            <p className="mt-2 text-sm text-muted">{clusterError ? '请检查 NovaObs 后端连接后重试。' : '登记集群并录入凭据后，NovaObs 才会读取 Kubernetes 命名空间。'}</p>
          </div>
        ) : null}
        {activeClusterId && !isLoading && !error && !namespaces.length ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">暂无命名空间</div>
            <p className="mt-2 text-sm text-muted">后端已联通，但当前集群没有返回 Kubernetes 命名空间。</p>
          </div>
        ) : null}
      </DataPanel>
    </div>
  );
}

function NamespaceMetric({ icon: Icon, label, value, meta }: { icon: typeof Folder; label: string; value: string; meta: string }) {
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
  const active = status === 'active';
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-primary-soft text-primary' : 'bg-amber-100 text-warning'}`}>
      {active ? '运行中' : status || 'unknown'}
    </span>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}
