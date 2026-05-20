import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldUser, UserRound, UsersRound } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sRBACBinding } from './api';

export function K8sUserPage() {
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

  const { data: bindings = [], isLoading, error } = useQuery({
    queryKey: ['k8s-user-bindings', activeClusterId, namespace],
    queryFn: () => k8sApi.listRBACBindings(activeClusterId, namespace),
    enabled: Boolean(activeClusterId && namespace),
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

  const rows = useMemo(() => flattenSubjects(bindings), [bindings]);
  const userSubjects = rows.filter((item) => item.subject.kind === 'User' || item.subject.kind === 'Group').length;
  const serviceIdentities = rows.filter((item) => item.subject.kind === 'ServiceAccount').length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <UserMetric icon={UsersRound} label="主体映射" value={String(rows.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <UserMetric icon={UserRound} label="用户 / 用户组" value={String(userSubjects)} meta={namespace ? `namespace/${namespace}` : '等待命名空间'} />
        <UserMetric icon={ShieldUser} label="服务身份" value={String(serviceIdentities)} meta="RoleBinding subjects" />
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
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select className="console-input mt-2 w-full" value={namespace} onChange={(event) => setNamespace(event.target.value)} disabled={!namespaces.length}>
              {!namespaces.length ? <option value="">暂无命名空间</option> : null}
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="text-sm text-muted">
            用户管理以真实 RoleBinding subject 为数据面，展示 Kubernetes 用户、用户组与 ServiceAccount 到角色的访问映射。
          </div>
        </div>
        {clusterError || namespaceError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError)}
          </div>
        ) : null}
      </section>

      <DataPanel title="用户管理" meta={isLoading ? '加载中' : `${rows.length} 条平台用户映射 · /api/v1/k8s/rbac/bindings`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            用户映射读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {isLoading ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">正在读取 RoleBinding subject。</div>
        ) : null}
        {!isLoading && !error && rows.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[860px] w-full">
              <thead>
                <tr>
                  <th>主体</th>
                  <th>类型</th>
                  <th>命名空间</th>
                  <th>RoleBinding</th>
                  <th>RoleRef</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={`${item.binding.id}-${item.subject.kind}-${item.subject.name}-${item.subject.namespace}`} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.subject.name}</div>
                      <div className="font-mono text-[11px] text-muted">{item.binding.clusterId}</div>
                    </td>
                    <td><SubjectPill kind={item.subject.kind} /></td>
                    <td className="font-mono text-xs">{item.subject.namespace || item.binding.namespace || '-'}</td>
                    <td>
                      <div className="font-semibold text-on-surface">{item.binding.name}</div>
                      <div className="font-mono text-[11px] text-muted">{item.binding.kind || 'RoleBinding'}</div>
                    </td>
                    <td className="font-mono text-xs">{item.binding.roleRef.kind}/{item.binding.roleRef.name}</td>
                    <td className="text-xs text-muted">{item.binding.source || 'kubernetes'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!activeClusterId ? <Empty text="请先登记并选择集群" /> : null}
        {activeClusterId && namespace && !isLoading && !error && !rows.length ? <Empty text="暂无平台用户映射" /> : null}
      </DataPanel>
    </div>
  );
}

function flattenSubjects(bindings: K8sRBACBinding[]) {
  return bindings.flatMap((binding) => (
    binding.subjects.map((subject) => ({ binding, subject }))
  ));
}

function UserMetric({ icon: Icon, label, value, meta }: { icon: typeof UsersRound; label: string; value: string; meta: string }) {
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

function SubjectPill({ kind }: { kind: string }) {
  const user = kind === 'User' || kind === 'Group';
  return <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${user ? 'bg-primary-soft text-primary' : 'bg-white/70 text-muted'}`}>{kind || 'Unknown'}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg bg-white/45 px-4 py-8 text-center font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">{text}</div>;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}
