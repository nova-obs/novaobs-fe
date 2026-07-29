import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clipboard, Plus, RefreshCw, Search, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { accessAllows, usePlatformAccess } from '../../layouts/access';
import { api } from '../../services/api';
import type { Product } from '../../services/types';
import {
  metricsApi,
  type MetricsCollectionMode,
  type MetricsIntegrationView,
  type MetricsSourceAccess,
} from './api';

const sourceLabels = {
  kubernetes_infra: 'K8s Infra',
  host_infra: 'VM / 主机 Infra',
  log_derived: 'Logs-to-Metrics',
} as const;

export function MetricsIntegrationsPage() {
  const queryClient = useQueryClient();
  const { data: accessContext } = usePlatformAccess();
  const [query, setQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [connectProduct, setConnectProduct] = useState<Product | null>(null);
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts, retry: false });
  const integrationsQuery = useQuery({ queryKey: ['metrics-integrations'], queryFn: metricsApi.listIntegrations, retry: false });
  const products = (productsQuery.data ?? []).filter((item) => item.status === 'active');
  const integrations = integrationsQuery.data ?? [];
  const integrationByProduct = useMemo(
    () => new Map(integrations.map((item) => [item.integration.productId, item])),
    [integrations],
  );

  useEffect(() => {
    if (selectedProductId && products.some((item) => item.id === selectedProductId)) return;
    setSelectedProductId(products[0]?.id ?? '');
  }, [products, selectedProductId]);

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return products.filter((item) => !keyword || [item.name, item.key, item.id].join(' ').toLowerCase().includes(keyword));
  }, [products, query]);
  const selectedProduct = products.find((item) => item.id === selectedProductId) ?? null;
  const selectedIntegration = selectedProduct ? integrationByProduct.get(selectedProduct.id) ?? null : null;
  const canMaintainProduct = (productId: string) => Boolean(accessContext && accessAllows(accessContext, {
    kind: 'product',
    productId,
    minimum: 'product-maintainer',
  }));
  const refresh = () => void Promise.all([productsQuery.refetch(), integrationsQuery.refetch()]);

  return <div className="console-workbench min-h-0 overflow-hidden">
    <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[minmax(660px,1fr)_400px]">
      <DataPanel title="指标接入" help="每个产品维护一个 VictoriaMetrics 写入目标，指标来源直接绑定 K8s 集群、主机组或日志派生链路。">
        {productsQuery.isLoading || integrationsQuery.isLoading ? <Skeleton /> : productsQuery.error || integrationsQuery.error ? (
          <EmptyState title="指标接入加载失败" action={<button type="button" className="console-button" onClick={refresh}>重试</button>} />
        ) : products.length === 0 ? (
          <EmptyState title="尚未登记可用产品" />
        ) : <div className="overflow-hidden rounded-md border border-outline bg-white">
          <div className="console-list-toolbar border-b border-outline">
            <label className="console-list-toolbar-search sm:w-[360px]">
              <span className="sr-only">搜索产品指标接入</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input className="console-input h-8 w-full pl-8 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索产品名称、Key 或 ID" />
            </label>
            <button type="button" className="console-icon-button" onClick={refresh} aria-label="刷新指标接入" title="刷新指标接入">
              <RefreshCw className={`h-3.5 w-3.5 ${productsQuery.isFetching || integrationsQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {rows.length === 0 ? <div className="py-12"><EmptyState title="未找到匹配产品" /></div> : (
            <div className="overflow-auto">
              <table className="console-table w-full min-w-[660px] table-fixed">
                <colgroup><col className="w-[30%]" /><col className="w-[27%]" /><col className="w-[20%]" /><col className="w-[13%]" /><col className="w-[10%]" /></colgroup>
                <thead><tr><th>产品</th><th>写入目标</th><th>指标来源</th><th>状态</th><th className="text-right">操作</th></tr></thead>
                <tbody>{rows.map((product) => {
                  const integration = integrationByProduct.get(product.id);
                  return <tr key={product.id} className={`cursor-pointer ${product.id === selectedProductId ? 'console-selected-row' : ''}`} onClick={() => setSelectedProductId(product.id)}>
                    <td><div className="truncate font-semibold">{product.name}</div><div className="truncate font-mono text-[11px] text-muted">{product.key} · {product.id}</div></td>
                    <td className="truncate font-mono text-[11px] text-muted">{integration?.integration.destinationRef || '未选择'}</td>
                    <td className="text-xs text-muted">{integration ? `${integration.sourceAccesses.length} 个来源` : '待接入'}</td>
                    <td><Status connected={integration?.integration.desiredState === 'connected'} /></td>
                    <td className="text-right">{integration ? <button type="button" className="console-button h-7 px-2" onClick={(event) => { event.stopPropagation(); setSelectedProductId(product.id); }}>查看</button> : canMaintainProduct(product.id) ? <button type="button" className="console-button console-button-primary h-7 px-2" onClick={(event) => { event.stopPropagation(); setConnectProduct(product); }}>接入</button> : <span className="text-xs text-muted">只读</span>}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </div>}
      </DataPanel>
      <ProductIntegrationDetail
        product={selectedProduct}
        integration={selectedIntegration}
        canMaintain={Boolean(selectedProduct && canMaintainProduct(selectedProduct.id))}
        onConnect={() => selectedProduct && setConnectProduct(selectedProduct)}
      />
    </div>
    {connectProduct ? <ConnectProductDialog product={connectProduct} onClose={() => setConnectProduct(null)} onCreated={async () => {
      await queryClient.invalidateQueries({ queryKey: ['metrics-integrations'] });
      setSelectedProductId(connectProduct.id);
      setConnectProduct(null);
    }} /> : null}
  </div>;
}

function ProductIntegrationDetail({ product, integration, canMaintain, onConnect }: { product: Product | null; integration: MetricsIntegrationView | null; canMaintain: boolean; onConnect: () => void }) {
  const queryClient = useQueryClient();
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [handoffSource, setHandoffSource] = useState<MetricsSourceAccess | null>(null);
  const updateMutation = useMutation({
    mutationFn: ({ source, mode }: { source: MetricsSourceAccess; mode: MetricsCollectionMode }) => metricsApi.updateSourceAccess(source.id, { collectionMode: mode }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['metrics-integrations'] }),
  });
  const logDerivedMutation = useMutation({
    mutationFn: metricsApi.enableLogDerivedSource,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['metrics-integrations'] }),
  });
  if (!product) return <aside className="min-h-0 overflow-auto border-l border-outline bg-white p-4"><EmptyState title="请选择产品" /></aside>;
  return <aside className="min-h-0 overflow-auto border-l border-outline bg-white p-4" aria-label="产品指标接入详情">
    <div className="space-y-5">
      <div><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{product.name}</h2>{integration ? <Status connected={integration.integration.desiredState === 'connected'} /> : null}</div><div className="mt-1 font-mono text-[11px] text-muted">{product.id}</div></div>
      {!integration ? <div className="rounded border border-dashed border-outline p-4"><div className="text-sm font-semibold">尚未接入指标</div><p className="mt-1 text-xs leading-5 text-muted">接入后，该产品的指标使用同一个写入目标和稳定产品标签。</p>{canMaintain ? <button type="button" className="console-button console-button-primary mt-3" onClick={onConnect}>接入产品指标</button> : null}</div> : <>
        <section><div className="text-xs font-semibold text-muted">写入目标</div><div className="mt-1 font-mono text-xs">{integration.integration.destinationRef}</div><div className="mt-3 text-xs font-semibold text-muted">身份标签</div><div className="mt-1 font-mono text-xs">{integration.integration.identityLabelKey}={product.id}</div></section>
        <section className="border-t border-outline pt-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">指标来源</h3>{canMaintain ? <div className="flex gap-1"><button type="button" className="console-button h-7 px-2" onClick={() => setSourceDialogOpen(true)}><Plus className="h-3.5 w-3.5" />新增来源</button>{integration.sourceAccesses.some((source) => source.sourceKind === 'log_derived') ? null : <button type="button" className="console-button h-7 px-2" disabled={logDerivedMutation.isPending} onClick={() => logDerivedMutation.mutate(integration.integration.id)}>启用 Logs-to-Metrics</button>}</div> : <span className="text-xs text-muted">只读</span>}</div>
          <div className="mt-3 space-y-2">{integration.sourceAccesses.length === 0 ? <div className="rounded border border-dashed border-outline p-3 text-xs text-muted">尚未绑定指标来源。</div> : integration.sourceAccesses.map((source) => <div key={source.id} className="rounded border border-outline p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-semibold">{sourceLabels[source.sourceKind]}</div>{source.resourceRef ? <div className="mt-1 font-mono text-[11px] text-muted">{source.resourceKind}/{source.resourceRef}</div> : null}</div><Status connected={source.desiredState === 'connected'} /></div><label className="mt-3 block text-xs font-semibold text-muted">采集方式<select className="console-input mt-1 w-full" value={source.collectionMode} disabled={!canMaintain || updateMutation.isPending || source.sourceKind === 'log_derived'} onChange={(event) => updateMutation.mutate({ source, mode: event.target.value as MetricsCollectionMode })}><option value="external_collector">复用现有采集器</option>{source.sourceKind === 'kubernetes_infra' ? <option value="managed_collector">平台受管采集器</option> : null}</select></label>{source.collectionMode === 'external_collector' && source.sourceKind !== 'log_derived' ? <button type="button" className="console-button mt-3 w-full" onClick={() => setHandoffSource(source)}><Clipboard className="h-3.5 w-3.5" />查看接入片段</button> : null}</div>)}</div>
        </section>
      </>}
    </div>
    {canMaintain && sourceDialogOpen && integration ? <CreateSourceDialog integrationId={integration.integration.id} onClose={() => setSourceDialogOpen(false)} /> : null}
    {handoffSource ? <HandoffDialog source={handoffSource} onClose={() => setHandoffSource(null)} /> : null}
  </aside>;
}

function ConnectProductDialog({ product, onClose, onCreated }: { product: Product; onClose: () => void; onCreated: () => void }) {
  const [destination, setDestination] = useState('');
  const optionsQuery = useQuery({ queryKey: ['metrics-write-destinations', product.id], queryFn: () => metricsApi.listWriteDestinationOptions(product.id), retry: false });
  const mutation = useMutation({ mutationFn: () => metricsApi.createIntegration({ productId: product.id, destinationRef: destination }), onSuccess: onCreated });
  const options = optionsQuery.data ?? [];
  useEffect(() => { if (!destination && options[0]) setDestination(options[0].id); }, [destination, options]);
  return <Dialog title="接入产品指标" onClose={onClose}><div className="space-y-4 p-4"><div><div className="text-sm font-semibold">{product.name}</div><div className="mt-1 font-mono text-[11px] text-muted">{product.id}</div></div>{optionsQuery.isLoading ? <Skeleton /> : optionsQuery.error ? <NoticeError error={optionsQuery.error} /> : options.length === 0 ? <div className="rounded border border-dashed border-outline p-4 text-xs text-muted">暂无可用 VictoriaMetrics 写入目标，请先登记指标下游端点。</div> : <label className="block text-sm font-semibold">写入目标<select className="console-input mt-1 w-full" value={destination} onChange={(event) => setDestination(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.remoteWriteURL}</option>)}</select></label>}{mutation.error ? <NoticeError error={mutation.error} /> : null}</div><DialogActions onClose={onClose}><button type="button" className="console-button console-button-primary" disabled={!destination || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? '接入中' : '确认接入'}</button></DialogActions></Dialog>;
}

function CreateSourceDialog({ integrationId, onClose }: { integrationId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [resourceKind, setResourceKind] = useState<'k8s_cluster' | 'host_group'>('k8s_cluster');
  const [resourceRef, setResourceRef] = useState('');
  const mutation = useMutation({ mutationFn: () => metricsApi.createSourceAccess(integrationId, { resourceKind, resourceRef: resourceRef.trim() }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['metrics-integrations'] }); onClose(); } });
  return <Dialog title="新增指标来源" onClose={onClose}><div className="space-y-4 p-4"><label className="block text-sm font-semibold">资源类型<select className="console-input mt-1 w-full" value={resourceKind} onChange={(event) => setResourceKind(event.target.value as 'k8s_cluster' | 'host_group')}><option value="k8s_cluster">K8s 集群</option><option value="host_group">主机组</option></select></label><label className="block text-sm font-semibold">资源标识<input className="console-input mt-1 w-full" value={resourceRef} onChange={(event) => setResourceRef(event.target.value)} placeholder={resourceKind === 'k8s_cluster' ? '集群 ID' : '主机组 ID'} /></label>{mutation.error ? <NoticeError error={mutation.error} /> : null}</div><DialogActions onClose={onClose}><button type="button" className="console-button console-button-primary" disabled={!resourceRef.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? '创建中' : '创建来源'}</button></DialogActions></Dialog>;
}

function HandoffDialog({ source, onClose }: { source: MetricsSourceAccess; onClose: () => void }) {
  const handoffQuery = useQuery({ queryKey: ['metrics-source-handoff', source.id], queryFn: () => metricsApi.getSourceHandoff(source.id), retry: false });
  return <Dialog title="复用现有采集器" onClose={onClose} wide><div className="min-h-0 overflow-auto p-4">{handoffQuery.isLoading ? <Skeleton /> : handoffQuery.error ? <NoticeError error={handoffQuery.error} /> : <div className="space-y-4"><div className="grid grid-cols-2 gap-3 text-xs"><div><span className="text-muted">资源</span><div className="mt-1 font-mono">{handoffQuery.data?.resourceRef}</div></div><div><span className="text-muted">产品身份</span><div className="mt-1 font-mono">novaapm_product_id={handoffQuery.data?.productId}</div></div></div>{handoffQuery.data?.artifacts.map((artifact) => <section key={artifact.kind}><div className="mb-1.5 flex items-center justify-between"><h3 className="text-xs font-semibold">{artifact.kind}</h3><button type="button" className="console-button h-7 px-2" onClick={() => void navigator.clipboard.writeText(artifact.content)}>复制</button></div><pre className="overflow-auto rounded border border-outline bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{artifact.content}</pre><p className="mt-1 text-xs leading-5 text-muted">{artifact.note}</p></section>)}</div>}</div><DialogActions onClose={onClose} /></Dialog>;
}

function Dialog({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-label={title}><div className={`flex max-h-[82vh] w-full flex-col rounded-lg border border-outline bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}><div className="flex items-center justify-between border-b border-outline px-4 py-3"><h2 className="text-base font-semibold">{title}</h2><button type="button" className="console-icon-button" onClick={onClose} aria-label={`关闭${title}`}><X className="h-4 w-4" /></button></div>{children}</div></div>;
}

function DialogActions({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
  return <div className="flex justify-end gap-2 border-t border-outline px-4 py-3"><button type="button" className="console-button" onClick={onClose}>取消</button>{children}</div>;
}

function Status({ connected }: { connected: boolean }) {
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${connected ? 'text-success' : 'text-muted'}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted'}`} />{connected ? '已接入' : '未接入'}</span>;
}

function NoticeError({ error }: { error: unknown }) {
  return <div className="console-notice console-notice-danger">{error instanceof Error ? error.message : '操作失败'}</div>;
}

function Skeleton() {
  return <div className="space-y-2"><div className="h-8 rounded bg-surface" /><div className="h-10 rounded bg-surface" /><div className="h-10 rounded bg-surface" /></div>;
}
