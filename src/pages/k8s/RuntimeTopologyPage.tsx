import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, GitBranch, Network, Route, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sRuntimeGroup, type K8sRuntimeServiceNode, type K8sRuntimeWorkloadNode } from './api';

export function K8sRuntimeTopologyPage() {
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
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

  useEffect(() => {
    if (!selectedClusterId && clusters[0]?.id) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    const exists = namespaces.some((item) => item.name === namespace);
    if (namespace && !exists) {
      setNamespace(namespaces[0]?.name ?? '');
      setSelectedGroupKey('');
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  const topologyQuery = useQuery({
    queryKey: ['k8s-runtime-groups', activeClusterId, namespace],
    queryFn: () => k8sApi.listRuntimeGroups({ clusterId: activeClusterId, namespace }),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });
  const groups = topologyQuery.data?.groups ?? [];
  const selectedGroup = useMemo(() => groups.find((item) => item.key === selectedGroupKey) ?? groups[0], [groups, selectedGroupKey]);

  useEffect(() => {
    if (!groups.length) {
      setSelectedGroupKey('');
      return;
    }
    if (!selectedGroupKey || !groups.some((item) => item.key === selectedGroupKey)) {
      setSelectedGroupKey(groups[0].key);
    }
  }, [groups, selectedGroupKey]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <TopologyMetric icon={GitBranch} label="拓扑分组" value={String(topologyQuery.data?.summary.groupCount ?? groups.length)} meta={namespace ? `namespace/${namespace}` : '等待命名空间'} />
        <TopologyMetric icon={Boxes} label="工作负载" value={String(topologyQuery.data?.summary.workloadCount ?? 0)} meta={`${topologyQuery.data?.summary.podCount ?? 0} Pods`} />
        <TopologyMetric icon={Route} label="Istio 路由" value={String(topologyQuery.data?.summary.virtualServiceCount ?? 0)} meta={`${topologyQuery.data?.summary.gatewayCount ?? 0} Gateway`} />
        <TopologyMetric icon={ShieldCheck} label="安全策略" value={String(topologyQuery.data?.summary.securityPolicyCount ?? 0)} meta="Peer/Auth/RBAC" />
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
                setSelectedGroupKey('');
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
            运行时拓扑按单 namespace 聚合 Service、Workload、Pod、HPA、Ingress、Istio 路由与安全策略。
          </div>
        </div>
        {clusterError || namespaceError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : `命名空间读取失败：${errorMessage(namespaceError)}`}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <DataPanel title="应用分组" meta={topologyQuery.isLoading ? '加载中' : `${groups.length} 个运行时分组`}>
          {topologyQuery.error ? (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
              拓扑读取失败：{errorMessage(topologyQuery.error)}
            </div>
          ) : null}
          {topologyQuery.isLoading ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">正在聚合运行时拓扑。</div>
          ) : null}
          {!topologyQuery.isLoading && !topologyQuery.error && !groups.length ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">暂无拓扑数据</div>
              <p className="mt-2 text-sm text-muted">当前 namespace 下没有可聚合的 Service 或 Workload。</p>
            </div>
          ) : null}
          <div className="space-y-2">
            {groups.map((group) => (
              <button
                key={group.key}
                type="button"
                className={`w-full rounded-lg px-3 py-3 text-left transition ${selectedGroup?.key === group.key ? 'bg-primary-soft text-primary shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : 'bg-white/45 text-on-surface hover:bg-white/70'}`}
                onClick={() => setSelectedGroupKey(group.key)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-semibold">{group.displayName}</span>
                  <span className="rounded-md bg-white/65 px-2 py-1 font-mono text-[11px]">{group.summary.podsTotal} pods</span>
                </div>
                <div className="mt-2 text-xs text-muted">
                  {group.summary.servicesTotal} Service · {group.summary.workloadsTotal} Workload · {group.summary.virtualServicesTotal} VirtualService
                </div>
              </button>
            ))}
          </div>
        </DataPanel>

        <DataPanel title="拓扑详情" meta={selectedGroup ? selectedGroup.displayName : '等待选择分组'}>
          {!selectedGroup ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">选择左侧分组后查看服务链路。</div>
          ) : (
            <RuntimeGroupDetail group={selectedGroup} />
          )}
        </DataPanel>
      </div>
    </div>
  );
}

function RuntimeGroupDetail({ group }: { group: K8sRuntimeGroup }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <TopologyColumn title="入口与路由" count={group.exposures.length}>
          {group.exposures.length ? group.exposures.map((item) => (
            <TopologyNode
              key={item.key}
              kind={item.kind}
              title={item.name}
              meta={[...item.hosts, ...item.gateways, ...item.serviceRefs.map((name) => `svc/${name}`)].join(' · ') || '未声明 host'}
            />
          )) : <EmptyTopologyText text="暂无 Ingress / VirtualService" />}
        </TopologyColumn>
        <TopologyColumn title="Service" count={group.services.length}>
          {group.services.map((item) => (
            <ServiceNode key={item.name} service={item} />
          ))}
        </TopologyColumn>
        <TopologyColumn title="Workload" count={group.workloads.length}>
          {group.workloads.map((item) => (
            <WorkloadNode key={item.key} workload={item} />
          ))}
        </TopologyColumn>
      </div>

      <div className="rounded-lg bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface">
          <Network className="h-4 w-4 text-primary" />
          治理关系
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <GovernanceBlock title="Gateway" items={uniqueFlat(group.services.map((item) => item.gateways))} />
          <GovernanceBlock title="VirtualService" items={uniqueFlat(group.services.map((item) => item.virtualServices))} />
          <GovernanceBlock title="DestinationRule" items={uniqueFlat(group.services.map((item) => item.destinationRules))} />
        </div>
      </div>

      <RuntimeRoutePanel services={group.services} />
      <RuntimeDestinationRulePanel services={group.services} />
    </div>
  );
}

function ServiceNode({ service }: { service: K8sRuntimeServiceNode }) {
  return (
    <TopologyNode kind={service.serviceType || 'Service'} title={service.name} meta={selectorText(service.selectors) || service.clusterIP || '-'} accent="service">
      <div className="mt-2 flex flex-wrap gap-1.5">
        {service.ports.map((item) => (
          <Chip key={`${service.name}-${item.name || item.port}`} text={`${item.name || item.protocol} ${item.port}->${item.targetPort || '-'}`} />
        ))}
      </div>
    </TopologyNode>
  );
}

function WorkloadNode({ workload }: { workload: K8sRuntimeWorkloadNode }) {
  return (
    <TopologyNode
      kind={workload.kind}
      title={workload.name}
      meta={`${workload.podsSummary.running}/${workload.podsSummary.total} running · ${workload.securityPolicies.length} policy`}
      accent={workload.podsSummary.failed > 0 ? 'warning' : 'workload'}
    >
      <div className="mt-2 flex flex-wrap gap-1.5">
        {workload.hpas.map((item) => <Chip key={`hpa-${item.name}`} text={`HPA ${item.name}`} />)}
        {workload.serviceAccounts.map((item) => <Chip key={`sa-${item}`} text={`SA ${item}`} />)}
        {workload.persistentVolumeClaims.map((item) => <Chip key={`pvc-${item}`} text={`PVC ${item}`} />)}
        {workload.securityPolicies.map((item) => <Chip key={`${item.kind}-${item.name}`} text={`${item.kind} ${item.name}`} />)}
      </div>
    </TopologyNode>
  );
}

function TopologyMetric({ icon: Icon, label, value, meta }: { icon: LucideIcon; label: string; value: string; meta: string }) {
  return (
    <div className="console-panel px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted">{label}</div>
          <div className="mt-1 font-display text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-1 text-xs text-muted">{meta}</div>
        </div>
        <div className="rounded-xl bg-primary-soft p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TopologyColumn({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-semibold text-on-surface">{title}</span>
        <span className="rounded-md bg-white/70 px-2 py-1 font-mono text-[11px] text-muted">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function TopologyNode({ kind, title, meta, accent = 'route', children }: { kind: string; title: string; meta: string; accent?: 'route' | 'service' | 'workload' | 'warning'; children?: ReactNode }) {
  const accentClass = {
    route: 'border-l-sky-400',
    service: 'border-l-primary',
    workload: 'border-l-secondary',
    warning: 'border-l-amber-500',
  }[accent];
  return (
    <div className={`rounded-lg border-l-4 ${accentClass} bg-white/62 px-3 py-2.5 shadow-[0_8px_18px_rgba(16,32,55,0.06)]`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-on-surface">{title}</span>
        <span className="rounded bg-surface-low px-1.5 py-0.5 text-[10px] font-semibold text-muted">{kind}</span>
      </div>
      <div className="mt-1 truncate text-xs text-muted">{meta}</div>
      {children}
    </div>
  );
}

function GovernanceBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-white/48 px-3 py-3">
      <div className="text-xs font-semibold text-muted">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length ? items.map((item) => <Chip key={`${title}-${item}`} text={item} />) : <span className="text-xs text-muted">无关联</span>}
      </div>
    </div>
  );
}

function RuntimeRoutePanel({ services }: { services: K8sRuntimeServiceNode[] }) {
  const routes = services.flatMap((service) => service.virtualServiceDetails.map((item) => ({ service: service.name, virtualService: item })));
  if (!routes.length) {
    return null;
  }
  return (
    <div className="rounded-lg bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <div className="mb-3 text-sm font-semibold text-on-surface">VirtualService 路由规则</div>
      <div className="space-y-2">
        {routes.map(({ service, virtualService }) => (
          <div key={`${service}-${virtualService.name}`} className="rounded-lg bg-white/60 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface">
              <span>{virtualService.name}</span>
              <Chip text={`svc/${service}`} />
              {virtualService.gateways.map((item) => <Chip key={`${virtualService.name}-gw-${item}`} text={`gw/${item}`} />)}
            </div>
            <div className="mt-2 space-y-2">
              {virtualService.routes.map((route, index) => (
                <div key={`${virtualService.name}-${route.protocol}-${route.name || index}`} className="rounded-md bg-surface-low px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                    <span>{route.protocol}</span>
                    {route.rewriteURI ? <Chip text={`rewrite ${route.rewriteURI}`} /> : null}
                    {route.targets.map((target) => <Chip key={`${target.host}-${target.subset}-${target.port}-${target.weight}`} text={`${target.host}${target.subset ? `/${target.subset}` : ''}${target.weight ? ` ${target.weight}%` : ''}`} />)}
                  </div>
                  <div className="mt-1 text-xs text-muted">{route.matches.map((item) => item.summary).join('；') || 'Default match'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuntimeDestinationRulePanel({ services }: { services: K8sRuntimeServiceNode[] }) {
  const rules = services.flatMap((service) => service.destinationRuleDetails.map((item) => ({ service: service.name, rule: item })));
  if (!rules.length) {
    return null;
  }
  return (
    <div className="rounded-lg bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <div className="mb-3 text-sm font-semibold text-on-surface">DestinationRule 子集</div>
      <div className="grid gap-2 md:grid-cols-2">
        {rules.map(({ service, rule }) => (
          <div key={`${service}-${rule.name}`} className="rounded-lg bg-white/60 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface">
              <span>{rule.name}</span>
              <Chip text={`host ${rule.host}`} />
              {rule.hasTrafficPolicy ? <Chip text="trafficPolicy" /> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rule.subsetDetails.length ? rule.subsetDetails.map((item) => <Chip key={`${rule.name}-${item.name}`} text={`${item.name} ${selectorText(item.labels)}`} />) : <span className="text-xs text-muted">未声明 subset</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return <span className="rounded-md bg-primary-soft/70 px-2 py-1 text-[11px] font-semibold text-primary">{text}</span>;
}

function EmptyTopologyText({ text }: { text: string }) {
  return <div className="rounded-lg bg-white/45 px-3 py-6 text-center text-sm font-semibold text-muted">{text}</div>;
}

function selectorText(labels: Record<string, string>) {
  return Object.entries(labels).map(([key, value]) => `${key}=${value}`).join(', ');
}

function uniqueFlat(values: string[][]) {
  return Array.from(new Set(values.flat().filter(Boolean))).sort();
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}
