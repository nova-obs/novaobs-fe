import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, RefreshCw, Server } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { api } from '../../services/api';
import type { HostAsset, ServiceDeploymentInput, ServiceDeploymentKind } from '../../services/types';
import { k8sApi } from '../k8s/api';

export function ServiceDeploymentTaskPage() {
  const { productId = '', serviceId = '', deploymentId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = Boolean(deploymentId);
  const [kind, setKind] = useState<ServiceDeploymentKind>('host_set');
  const [name, setName] = useState('');
  const [allowedLogRootsText, setAllowedLogRootsText] = useState('/var/log');
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);
  const [clusterId, setClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [workloadUid, setWorkloadUid] = useState('');
  const [creatingHost, setCreatingHost] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const serviceQuery = useQuery({
    queryKey: ['service', productId, serviceId],
    queryFn: () => api.getService(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const deploymentQuery = useQuery({
    queryKey: ['service-deployment', productId, serviceId, deploymentId],
    queryFn: () => api.getServiceDeployment(productId, serviceId, deploymentId),
    enabled: editing,
  });
  const hostsQuery = useQuery({
    queryKey: ['platform-hosts', 'active'],
    queryFn: () => api.getHostAssets({ status: 'active' }),
    enabled: kind === 'host_set',
  });
  const clustersQuery = useQuery({
    queryKey: ['k8s-clusters', 'service-deployment'],
    queryFn: () => k8sApi.listClusters(),
    enabled: kind === 'kubernetes_workload',
  });
  const namespacesQuery = useQuery({
    queryKey: ['k8s-namespaces', 'service-deployment', clusterId],
    queryFn: () => k8sApi.listNamespaces(clusterId),
    enabled: kind === 'kubernetes_workload' && Boolean(clusterId),
  });
  const workloadsQuery = useQuery({
    queryKey: ['k8s-resources', 'service-deployment', clusterId, namespace, 'Deployment'],
    queryFn: () => k8sApi.listResources({ clusterId, namespace, kind: 'Deployment' }),
    enabled: kind === 'kubernetes_workload' && Boolean(clusterId && namespace),
  });

  useEffect(() => {
    const deployment = deploymentQuery.data;
    if (!deployment) return;
    setKind(deployment.kind);
    setName(deployment.name);
    setAllowedLogRootsText(deployment.allowedLogRoots.join('\n'));
    setSelectedHostIds(deployment.hostTargets.map((host) => host.id));
    setClusterId(deployment.k8sRef?.clusterId ?? '');
    setNamespace(deployment.k8sRef?.namespace ?? '');
    setWorkloadUid(deployment.k8sRef?.workloadUid ?? '');
  }, [deploymentQuery.data]);

  const roots = useMemo(
    () => allowedLogRootsText.split('\n').map((item) => item.trim()).filter(Boolean),
    [allowedLogRootsText],
  );
  const rootsError = kind === 'host_set' && (roots.length === 0 || roots.some((root) => !root.startsWith('/') || root.split('/').includes('..')))
    ? '每个允许日志根目录都必须是绝对路径，且不能包含 ..'
    : '';
  const workload = workloadsQuery.data?.find((item) => item.identity.uid === workloadUid);
  const canSubmit = Boolean(name.trim() && (
    kind === 'host_set'
      ? selectedHostIds.length > 0 && !rootsError
      : clusterId && namespace && workload
  ));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = deploymentInput();
      const deployment = editing
        ? await api.updateServiceDeployment(productId, serviceId, deploymentId, input)
        : await api.createServiceDeployment(productId, serviceId, input);
      if (kind === 'host_set') {
        return api.replaceServiceDeploymentHosts(productId, serviceId, deployment.id, selectedHostIds);
      }
      return deployment;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-deployments', productId, serviceId] });
      navigate(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}`);
    },
  });
  const retireMutation = useMutation({
    mutationFn: () => api.retireServiceDeployment(productId, serviceId, deploymentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-deployments', productId, serviceId] });
      navigate(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}`);
    },
  });

  function deploymentInput(): ServiceDeploymentInput {
    if (kind === 'host_set') {
      return { name: name.trim(), kind, source: 'manual', allowedLogRoots: roots, hostIds: selectedHostIds };
    }
    return {
      name: name.trim(),
      kind,
      source: 'k8s',
      k8sRef: {
        clusterId,
        namespace,
        apiVersion: workload?.identity.apiVersion ?? 'apps/v1',
        workloadKind: workload?.identity.kind ?? 'Deployment',
        workloadName: workload?.identity.name ?? '',
        workloadUid: workload?.identity.uid ?? '',
      },
    };
  }

  const error = serviceQuery.error ?? deploymentQuery.error ?? saveMutation.error ?? retireMutation.error;
  const back = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}`;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary" to={back}><ArrowLeft className="h-3.5 w-3.5" />返回服务详情</Link>
          <h1 className="page-title">{editing ? '编辑服务部署' : '新增服务部署'}</h1>
          <p className="page-description">{serviceQuery.data?.name || serviceId} · Service 保持逻辑身份，部署目标描述实际运行位置。</p>
        </div>
      </div>

      {error ? <div className="console-notice console-notice-danger">{(error as Error).message}</div> : null}
      {serviceQuery.isLoading || (editing && deploymentQuery.isLoading) ? <div className="console-skeleton h-64" /> : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <section className="rounded-md border border-outline bg-white">
              <div className="border-b border-outline px-3 py-2.5"><h2 className="text-sm font-semibold">部署身份</h2></div>
              <div className="space-y-3 p-3">
                <label className="block text-xs font-semibold">名称 *<input className="console-input mt-1.5 w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder="华东生产主机组" /></label>
                <fieldset disabled={editing}>
                  <legend className="text-xs font-semibold">部署类型 *</legend>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    <KindOption selected={kind === 'host_set'} label="VM / 物理机" description="绑定平台主机资产" onClick={() => setKind('host_set')} />
                    <KindOption selected={kind === 'kubernetes_workload'} label="K8S Workload" description="绑定真实 Workload UID" onClick={() => setKind('kubernetes_workload')} />
                  </div>
                </fieldset>
              </div>
            </section>

            {kind === 'host_set' ? (
              <HostSetEditor
                hosts={hostsQuery.data ?? []}
                loading={hostsQuery.isLoading}
                selectedHostIds={selectedHostIds}
                onSelectedHostIdsChange={setSelectedHostIds}
                allowedLogRootsText={allowedLogRootsText}
                onAllowedLogRootsTextChange={setAllowedLogRootsText}
                rootsError={rootsError}
                creatingHost={creatingHost}
                onCreatingHostChange={setCreatingHost}
                onHostCreated={() => hostsQuery.refetch()}
              />
            ) : (
              <section className="rounded-md border border-outline bg-white">
                <div className="border-b border-outline px-3 py-2.5"><h2 className="text-sm font-semibold">K8S Workload</h2></div>
                <div className="grid gap-3 p-3 md:grid-cols-3">
                  <label className="text-xs font-semibold">集群 *<select className="console-input mt-1.5 w-full" value={clusterId} onChange={(event) => { setClusterId(event.target.value); setNamespace(''); setWorkloadUid(''); }}><option value="">选择集群</option>{(clustersQuery.data ?? []).map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id}</option>)}</select></label>
                  <label className="text-xs font-semibold">Namespace *<select className="console-input mt-1.5 w-full" value={namespace} onChange={(event) => { setNamespace(event.target.value); setWorkloadUid(''); }} disabled={!clusterId}><option value="">选择 Namespace</option>{(namespacesQuery.data ?? []).map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></label>
                  <label className="text-xs font-semibold">Deployment *<select className="console-input mt-1.5 w-full" value={workloadUid} onChange={(event) => setWorkloadUid(event.target.value)} disabled={!namespace}><option value="">选择 Deployment</option>{(workloadsQuery.data ?? []).map((item) => <option key={item.identity.uid} value={item.identity.uid}>{item.identity.name}</option>)}</select></label>
                </div>
              </section>
            )}

            <div className="console-action-bar justify-end">
              <Link className="console-button" to={back}>取消</Link>
              <button className="console-button console-button-primary" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}{editing ? '保存部署' : '创建部署'}
              </button>
            </div>
          </div>

          <aside className="space-y-3">
            <section className="rounded-md border border-outline bg-white p-3">
              <div className="text-xs font-semibold text-muted">影响摘要</div>
              <dl className="mt-3 space-y-3 text-xs">
                <Fact label="服务" value={serviceQuery.data?.name || serviceId} />
                <Fact label="类型" value={kind === 'host_set' ? 'VM / 物理机' : 'K8S Workload'} />
                <Fact label="预期目标" value={kind === 'host_set' ? `${selectedHostIds.length} 台主机` : workload?.identity.name || '-'} />
              </dl>
            </section>
            {editing ? (
              <section className="rounded-md border border-red-200 bg-red-50/50 p-3">
                <div className="text-sm font-semibold text-red-700">退役部署</div>
                <p className="mt-1 text-xs text-red-600">存在活动日志路由时后端会拒绝退役，并返回真实阻断原因。</p>
                <button className="console-button mt-3 text-red-700" disabled={retireMutation.isPending} onClick={() => confirmRetire ? retireMutation.mutate() : setConfirmRetire(true)}>
                  {confirmRetire ? '确认退役部署' : '退役部署'}
                </button>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

function HostSetEditor({ hosts, loading, selectedHostIds, onSelectedHostIdsChange, allowedLogRootsText, onAllowedLogRootsTextChange, rootsError, creatingHost, onCreatingHostChange, onHostCreated }: {
  hosts: HostAsset[];
  loading: boolean;
  selectedHostIds: string[];
  onSelectedHostIdsChange: (ids: string[]) => void;
  allowedLogRootsText: string;
  onAllowedLogRootsTextChange: (value: string) => void;
  rootsError: string;
  creatingHost: boolean;
  onCreatingHostChange: (value: boolean) => void;
  onHostCreated: () => void;
}) {
  return (
    <section className="rounded-md border border-outline bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-outline px-3 py-2.5">
        <div><h2 className="text-sm font-semibold">预期主机</h2><p className="mt-1 text-xs text-muted">未安装 Agent 的主机仍计入覆盖率。</p></div>
        <button className="console-button" onClick={() => onCreatingHostChange(!creatingHost)}><Plus className="h-3.5 w-3.5" />新增主机</button>
      </div>
      {creatingHost ? <CreateHostForm onCreated={() => { onCreatingHostChange(false); onHostCreated(); }} /> : null}
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded border border-outline">
          {loading ? <div className="console-skeleton h-24" /> : hosts.length === 0 ? <EmptyState title="主机库为空" action={<span className="text-xs text-muted">先新增平台主机资产。</span>} /> : (
            <div className="max-h-72 overflow-auto">
              <table className="console-table w-full min-w-[560px]">
                <thead><tr><th className="w-12">选择</th><th>主机</th><th>地址</th><th>地域 / 可用区</th></tr></thead>
                <tbody>{hosts.map((host) => {
                  const checked = selectedHostIds.includes(host.id);
                  return <tr key={host.id} className={checked ? 'console-selected-row' : ''}>
                    <td><input type="checkbox" aria-label={`选择主机 ${host.displayName}`} checked={checked} onChange={() => onSelectedHostIdsChange(checked ? selectedHostIds.filter((id) => id !== host.id) : [...selectedHostIds, host.id])} /></td>
                    <td><div className="font-semibold">{host.displayName || host.hostname}</div><div className="mt-1 font-mono text-[11px] text-muted">{host.hostname || host.id}</div></td>
                    <td className="font-mono text-xs">{host.ipAddresses.join(', ') || '-'}</td>
                    <td className="text-xs">{host.region || '-'} / {host.zone || '-'}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </div>
        <label className="text-xs font-semibold">允许日志根目录 *<textarea className={`console-input mt-1.5 min-h-32 w-full font-mono ${rootsError ? 'border-danger' : ''}`} value={allowedLogRootsText} onChange={(event) => onAllowedLogRootsTextChange(event.target.value)} placeholder={'/var/log/orders\n/data/logs'} />{rootsError ? <span className="mt-1 block font-normal text-danger">{rootsError}</span> : <span className="mt-1 block font-normal text-muted">每行一个绝对目录；日志路由不能越过该边界。</span>}</label>
      </div>
    </section>
  );
}

function CreateHostForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ displayName: '', hostname: '', externalId: '', ipAddresses: '', region: '', zone: '' });
  const mutation = useMutation({
    mutationFn: () => api.createHostAsset({
      identitySource: 'manual',
      identityScope: 'global',
      externalId: form.externalId.trim(),
      displayName: form.displayName.trim(),
      hostname: form.hostname.trim(),
      status: 'active',
      ipAddresses: form.ipAddresses.split(',').map((item) => item.trim()).filter(Boolean),
      region: form.region.trim(),
      zone: form.zone.trim(),
      labels: {},
    }),
    onSuccess: onCreated,
  });
  return (
    <div className="border-b border-outline bg-surface p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-semibold">显示名称 *<input className="console-input mt-1.5 w-full" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
        <label className="text-xs font-semibold">Hostname *<input className="console-input mt-1.5 w-full font-mono" value={form.hostname} onChange={(event) => setForm({ ...form, hostname: event.target.value })} /></label>
        <label className="text-xs font-semibold">外部标识 *<input className="console-input mt-1.5 w-full font-mono" value={form.externalId} onChange={(event) => setForm({ ...form, externalId: event.target.value })} /></label>
        <label className="text-xs font-semibold">IP 地址<input className="console-input mt-1.5 w-full font-mono" value={form.ipAddresses} onChange={(event) => setForm({ ...form, ipAddresses: event.target.value })} placeholder="10.0.0.8" /></label>
        <label className="text-xs font-semibold">地域<input className="console-input mt-1.5 w-full" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></label>
        <label className="text-xs font-semibold">可用区<input className="console-input mt-1.5 w-full" value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} /></label>
      </div>
      {mutation.error ? <div className="mt-2 text-xs text-danger">{(mutation.error as Error).message}</div> : null}
      <div className="mt-3 flex justify-end"><button className="console-button console-button-primary" disabled={!form.displayName.trim() || !form.hostname.trim() || !form.externalId.trim() || mutation.isPending} onClick={() => mutation.mutate()}><Server className="h-3.5 w-3.5" />保存主机</button></div>
    </div>
  );
}

function KindOption({ selected, label, description, onClick }: { selected: boolean; label: string; description: string; onClick: () => void }) {
  return <button type="button" className={`rounded border p-3 text-left ${selected ? 'border-primary bg-primary-soft' : 'border-outline bg-white hover:border-primary/40'}`} onClick={onClick}><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-muted">{description}</span></button>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-muted">{label}</dt><dd className="mt-1 break-all text-on-surface">{value}</dd></div>;
}
