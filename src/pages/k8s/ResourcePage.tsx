import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, FileCode2, Layers3 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sResourcePage() {
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [kind, setKind] = useState('');
  const { data: clusters = [], isLoading: isLoadingClusters, error: clusterError } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const activeClusterId = selectedClusterId || clusters[0]?.id || '';

  const { data: namespaces = [] } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  useEffect(() => {
    if (!selectedClusterId && clusters[0]?.id) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-resources', activeClusterId, namespace, kind],
    queryFn: () => k8sApi.listResources({ clusterId: activeClusterId, namespace, kind }),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });
  const canReadResources = Boolean(activeClusterId && namespace);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ResourceMetric icon={Boxes} label="资源对象" value={String(data.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <ResourceMetric icon={Layers3} label="身份字段" value="6" meta="cluster/ns/api/kind/name/uid" />
        <ResourceMetric icon={FileCode2} label="详情能力" value="YAML" meta="read-only preview" />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(200px,280px)_minmax(180px,240px)_minmax(160px,220px)_1fr] md:items-end">
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
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select className="console-input mt-2 w-full" value={namespace} onChange={(event) => setNamespace(event.target.value)} disabled={!namespaces.length}>
              {!namespaces.length ? <option value="">暂无命名空间</option> : null}
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Kind</span>
            <select className="console-input mt-2 w-full" value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="">全部</option>
              <option value="Pod">Pod</option>
              <option value="Deployment">Deployment</option>
              <option value="Service">Service</option>
              <option value="ConfigMap">ConfigMap</option>
            </select>
          </label>
          <div className="text-sm text-muted">
            资源身份按 cluster/ns/api/kind/name/uid 固定展示，详情和 YAML 读取要求 UID 精确匹配。
          </div>
        </div>
      </section>

      <DataPanel title="资源视图" meta={isLoading ? '加载中' : `${data.length} 个资源 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            资源读取失败，请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。
          </div>
        ) : null}
        {isLoading ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在读取 Kubernetes 资源对象。
          </div>
        ) : null}
        {!canReadResources ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">{clusterError ? '集群列表读取失败' : '请先选择集群和命名空间'}</div>
            <p className="mt-2 text-sm text-muted">{clusterError ? '请检查 NovaObs 后端连接后重试。' : '资源读取按 namespace 级 RBAC 执行，不进行默认全命名空间扫描。'}</p>
          </div>
        ) : null}
        {canReadResources && !isLoading && !error && data.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[980px] w-full">
              <thead>
                <tr>
                  <th>资源</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>API Version</th>
                  <th>Kind</th>
                  <th>UID</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={`${item.identity.clusterId}-${item.identity.namespace}-${item.identity.kind}-${item.identity.name}-${item.identity.uid}`} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.identity.name}</div>
                      <div className="text-[11px] text-muted">{Object.entries(item.labels).map(([key, value]) => `${key}=${value}`).join(', ') || 'no labels'}</div>
                    </td>
                    <td className="font-mono text-xs">{item.identity.clusterId}</td>
                    <td className="font-mono text-xs">{item.identity.namespace}</td>
                    <td className="font-mono text-xs">{item.identity.apiVersion}</td>
                    <td className="font-mono text-xs">{item.identity.kind}</td>
                    <td className="font-mono text-[11px] text-muted">{item.identity.uid || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {canReadResources && !isLoading && !error && !data.length ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">暂无资源</div>
            <p className="mt-2 text-sm text-muted">后端已联通，但当前过滤条件下没有返回 Kubernetes 资源。</p>
          </div>
        ) : null}
      </DataPanel>
    </div>
  );
}

function ResourceMetric({ icon: Icon, label, value, meta }: { icon: typeof Boxes; label: string; value: string; meta: string }) {
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
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>
      {warning ? '警告' : status || 'unknown'}
    </span>
  );
}
