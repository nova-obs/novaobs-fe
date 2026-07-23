import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Archive, Database, GitBranch, Plus, RefreshCw, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { HelpTip } from '../../components/HelpTip';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import type {
  GrafanaProductIntegration,
  Product,
  Service,
  ServiceObservabilityGraph,
} from '../../services/types';

type ServiceSection = 'overview' | 'graph' | 'settings';

export function ServicesPage() {
  const { productId = '', serviceId = '' } = useParams();
  const location = useLocation();
  if (!productId) return <ProductsIndex />;
  if (!serviceId) {
    return <ProductDetail productId={productId} integrationMode={location.pathname.endsWith('/integrations')} />;
  }
  const section = (location.pathname.split('/').at(-1) || 'overview') as ServiceSection;
  if (!['overview', 'graph', 'settings'].includes(section)) {
    return <Navigate to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/overview`} replace />;
  }
  return <ServiceDetail productId={productId} serviceId={serviceId} section={section} />;
}

function ProductsIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts });
  const products = productsQuery.data ?? [];
  const integrationQueries = useQueries({
    queries: products.map((product) => ({
      queryKey: ['product-grafana', product.id],
      queryFn: () => api.getGrafanaProductIntegration(product.id),
      retry: false,
    })),
  });
  const integrationByProduct = new Map<string, GrafanaProductIntegration | undefined>(
    products.map((product, index) => [product.id, integrationQueries[index]?.data]),
  );
  const createMutation = useMutation({
    mutationFn: api.createProduct,
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setCreating(false);
      navigate(`/products/${encodeURIComponent(product.id)}/services`);
    },
  });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">产品与服务</h1>
          <p className="page-description">产品是权限、VictoriaLogs 租户和 Grafana Folder 的管理边界；服务提供稳定且不可变的观测身份。</p>
        </div>
        <button className="console-button console-button-primary" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />新增产品
        </button>
      </div>
      {productsQuery.error ? (
        <div className="console-notice console-notice-danger">{errorMessage(productsQuery.error)}</div>
      ) : (
        <DataPanel title="产品" meta={productsQuery.isLoading ? '加载中' : `${products.length} 个产品`}>
          {productsQuery.isLoading ? <div className="console-skeleton h-44" /> : products.length === 0 ? (
            <EmptyState title="还没有产品" action={<p className="max-w-md text-xs text-muted">先创建产品，平台会生成不可变产品 ID、VictoriaLogs 租户和 Grafana Folder 协调任务。</p>} />
          ) : (
            <>
            <div className="grid gap-3 p-3 md:hidden">
              {products.map((product) => {
                const integration = integrationByProduct.get(product.id);
                return (
                  <article key={product.id} className="rounded-md border border-outline bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link className="font-semibold text-primary" to={`/products/${encodeURIComponent(product.id)}/services`}>{product.name}</Link>
                        <div className="mt-1 break-all font-mono text-[11px] text-muted">{product.key} · {product.id}</div>
                      </div>
                      <Link className="console-button h-8 shrink-0" to={`/products/${encodeURIComponent(product.id)}/services`}>管理</Link>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-outline pt-3">
                      <Info label="VL 租户" value={`${product.tenant.accountId}:${product.tenant.projectId}`} mono />
                      <div><dt className="text-[11px] text-muted">生命周期</dt><dd className="mt-1"><StatusBadge value={product.status} /></dd></div>
                      <div><dt className="text-[11px] text-muted">Grafana</dt><dd className="mt-1"><StatusBadge value={integration?.state ?? 'pending'} /></dd></div>
                      <div className="col-span-2"><Info label="更新时间" value={formatTime(product.updatedAt)} /></div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <div className="console-resource-list hidden overflow-x-auto md:block">
              <table className="console-table min-w-[900px] w-full">
                <thead><tr><th>产品身份</th><th>VictoriaLogs 租户</th><th>生命周期</th><th>Grafana</th><th>更新时间</th><th /></tr></thead>
                <tbody>
                  {products.map((product) => {
                    const integration = integrationByProduct.get(product.id);
                    return (
                      <tr key={product.id}>
                        <td>
                          <Link className="font-semibold text-primary" to={`/products/${encodeURIComponent(product.id)}/services`}>{product.name}</Link>
                          <div className="mt-1 font-mono text-[11px] text-muted">{product.key} · {product.id}</div>
                        </td>
                        <td className="font-mono text-xs">{product.tenant.accountId}:{product.tenant.projectId}</td>
                        <td><StatusBadge value={product.status} /></td>
                        <td><StatusBadge value={integration?.state ?? 'pending'} /></td>
                        <td className="text-xs text-muted">{formatTime(product.updatedAt)}</td>
                        <td className="text-right"><Link className="console-button h-8" to={`/products/${encodeURIComponent(product.id)}/services`}>管理</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </DataPanel>
      )}
      {creating ? (
        <ProductDrawer
          pending={createMutation.isPending}
          error={createMutation.error}
          onClose={() => setCreating(false)}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      ) : null}
    </div>
  );
}

function ProductDetail({ productId, integrationMode }: { productId: string; integrationMode: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creatingService, setCreatingService] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const productQuery = useQuery({ queryKey: ['product', productId], queryFn: () => api.getProduct(productId) });
  const servicesQuery = useQuery({
    queryKey: ['product-services', productId],
    queryFn: () => api.getProductServices(productId),
    enabled: !integrationMode,
  });
  const integrationQuery = useQuery({
    queryKey: ['product-grafana', productId],
    queryFn: () => api.getGrafanaProductIntegration(productId),
  });
  const createService = useMutation({
    mutationFn: (input: { key: string; name: string; description: string }) => api.createService({ productId, ...input }),
    onSuccess: async (service) => {
      await queryClient.invalidateQueries({ queryKey: ['product-services', productId] });
      setCreatingService(false);
      navigate(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(service.id)}/overview`);
    },
  });
  const archiveProduct = useMutation({
    mutationFn: () => api.archiveProduct(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });
  const reconcile = useMutation({
    mutationFn: () => api.reconcileGrafanaProductIntegration(productId),
    onSuccess: (binding) => queryClient.setQueryData(['product-grafana', productId], binding),
  });
  const product = productQuery.data;
  if (productQuery.isLoading) return <div className="page-shell"><div className="console-skeleton h-52" /></div>;
  if (!product) return <div className="page-shell"><EmptyState title="产品不存在或无权访问" /></div>;

  return (
    <div className="page-shell">
      <ProductHeader product={product} integration={integrationQuery.data} />
      <div className="flex flex-wrap gap-1 border-b border-outline">
        <ProductTab to={`/products/${encodeURIComponent(productId)}/services`} active={!integrationMode}>服务</ProductTab>
        <ProductTab to={`/products/${encodeURIComponent(productId)}/integrations`} active={integrationMode}>集成</ProductTab>
      </div>
      {integrationMode ? (
        <GrafanaIntegrationPanel
          integration={integrationQuery.data}
          loading={integrationQuery.isLoading}
          error={integrationQuery.error ?? reconcile.error}
          reconciling={reconcile.isPending}
          onReconcile={() => reconcile.mutate()}
        />
      ) : (
        <DataPanel
          title="逻辑服务"
          meta={servicesQuery.isLoading ? '加载中' : `${servicesQuery.data?.length ?? 0} 个活动服务`}
          action={<button className="console-button console-button-primary" onClick={() => setCreatingService(true)}><Plus className="h-3.5 w-3.5" />新增服务</button>}
        >
          {servicesQuery.isLoading ? <div className="console-skeleton h-40" /> : servicesQuery.error ? (
            <div className="console-notice console-notice-danger">{errorMessage(servicesQuery.error)}</div>
          ) : !servicesQuery.data?.length ? (
            <EmptyState title="这个产品还没有服务" action={<p className="max-w-md text-xs text-muted">服务只描述逻辑身份；集群、命名空间和主机等采集位置由各观测模块的接入配置维护。</p>} />
          ) : (
            <div className="console-resource-list overflow-x-auto">
              <table className="console-table min-w-[760px] w-full">
                <thead><tr><th>服务</th><th>Owner</th><th>来源</th><th>状态</th><th>更新时间</th><th /></tr></thead>
                <tbody>{servicesQuery.data.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <Link className="font-semibold text-primary" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(service.id)}/overview`}>{service.name}</Link>
                      <div className="mt-1 font-mono text-[11px] text-muted">{service.key} · {service.id}</div>
                    </td>
                    <td>{service.ownerTeam || service.owner || '-'}</td>
                    <td>{sourceLabel(service.source)}</td>
                    <td><StatusBadge value={service.status} /></td>
                    <td className="text-xs text-muted">{formatTime(service.updatedAt)}</td>
                    <td className="text-right"><Link className="console-button h-8" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(service.id)}/overview`}>详情</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </DataPanel>
      )}
      <section className="console-danger-zone rounded-md border border-red-200 bg-red-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-semibold text-red-700">归档产品</div><div className="mt-1 text-xs text-red-600">必须先归档全部活动服务；Grafana 资源只会标记保留，不会自动删除。</div></div>
          <button className="console-button text-red-600" onClick={() => confirmArchive ? archiveProduct.mutate() : setConfirmArchive(true)} disabled={archiveProduct.isPending}>
            <Archive className="h-3.5 w-3.5" />{confirmArchive ? '确认归档产品' : '归档产品'}
          </button>
        </div>
        {archiveProduct.error ? <div className="mt-3 text-xs text-red-700">{errorMessage(archiveProduct.error)}</div> : null}
      </section>
      {creatingService ? (
        <ServiceDrawer
          pending={createService.isPending}
          error={createService.error}
          onClose={() => setCreatingService(false)}
          onSubmit={(input) => createService.mutate(input)}
        />
      ) : null}
    </div>
  );
}

function ServiceDetail({ productId, serviceId, section }: { productId: string; serviceId: string; section: ServiceSection }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const productQuery = useQuery({ queryKey: ['product', productId], queryFn: () => api.getProduct(productId) });
  const serviceQuery = useQuery({ queryKey: ['service', productId, serviceId], queryFn: () => api.getService(productId, serviceId) });
  const graphQuery = useQuery({
    queryKey: ['service-graph', productId, serviceId],
    queryFn: () => api.getServiceObservabilityGraph(productId, serviceId),
    enabled: section === 'graph' || section === 'overview',
  });
  const archive = useMutation({
    mutationFn: () => api.archiveService(productId, serviceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['product-services', productId] });
      navigate(`/products/${encodeURIComponent(productId)}/services`);
    },
  });
  const service = serviceQuery.data;
  if (serviceQuery.isLoading) return <div className="page-shell"><div className="console-skeleton h-52" /></div>;
  if (!service) return <div className="page-shell"><EmptyState title="服务不存在或不属于当前产品" /></div>;
  const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}`;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link className="text-xs font-semibold text-primary" to={`/products/${encodeURIComponent(productId)}/services`}>{productQuery.data?.name ?? '返回产品'}</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="page-title">{service.name}</h1><StatusBadge value={service.status} /></div>
          <p className="page-description font-mono">{service.key} · {service.id}</p>
        </div>
        <Link className="console-button console-button-primary" to={`${base}/logs/explore`}>进入 Logs</Link>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-outline">
        <ProductTab to={`${base}/overview`} active={section === 'overview'}>概览</ProductTab>
        <ProductTab to={`${base}/graph`} active={section === 'graph'}>观测关系</ProductTab>
        <ProductTab to={`${base}/settings`} active={section === 'settings'}>设置</ProductTab>
      </div>
      {section === 'overview' ? <ServiceOverview service={service} graph={graphQuery.data} /> : null}
      {section === 'graph' ? <GraphPanel graph={graphQuery.data} loading={graphQuery.isLoading} error={graphQuery.error} /> : null}
      {section === 'settings' ? (
        <section className="console-danger-zone rounded-md border border-red-200 bg-red-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-semibold text-red-700">归档服务</div><div className="mt-1 text-xs text-red-600">服务身份保留；已有日志路由、Grafana 数据源和审计记录不会被删除。</div></div>
            <button className="console-button text-red-600" onClick={() => confirmArchive ? archive.mutate() : setConfirmArchive(true)} disabled={archive.isPending}>
              <Archive className="h-3.5 w-3.5" />{confirmArchive ? '确认归档服务' : '归档服务'}
            </button>
          </div>
          {archive.error ? <div className="mt-3 text-xs text-red-700">{errorMessage(archive.error)}</div> : null}
        </section>
      ) : null}
    </div>
  );
}

function ProductHeader({ product, integration }: { product: Product; integration?: GrafanaProductIntegration }) {
  return (
    <div className="page-header">
      <div>
        <Link className="text-xs font-semibold text-primary" to="/products">产品与服务</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="page-title">{product.name}</h1><StatusBadge value={product.status} /></div>
        <p className="page-description">{product.description || '暂无产品描述'}</p>
      </div>
      <div className="grid min-w-[300px] grid-cols-2 gap-2 rounded-md border border-outline bg-white p-3">
        <Info label="产品 Key" value={product.key} mono />
        <Info label="租户" value={`${product.tenant.accountId}:${product.tenant.projectId}`} mono />
        <Info label="产品 ID" value={product.id} mono />
        <Info label="Grafana" value={integration?.state ?? 'pending'} />
      </div>
    </div>
  );
}

function ServiceOverview({ service, graph }: { service: Service; graph?: ServiceObservabilityGraph }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <DataPanel title="服务身份" meta="稳定逻辑服务">
        <div className="grid gap-4 md:grid-cols-2">
          <Info label="服务 Key" value={service.key} mono />
          <Info label="服务 ID" value={service.id} mono />
          <Info label="Owner" value={[service.ownerTeam, service.owner].filter(Boolean).join(' / ') || '-'} />
          <Info label="来源" value={sourceLabel(service.source)} />
          <Info label="描述" value={service.description || '-'} />
          <Info label="更新时间" value={formatTime(service.updatedAt)} />
        </div>
      </DataPanel>
      <DataPanel title="模块能力" meta="按真实能力状态">
        <Capability icon={Database} label="Logs" ready={Boolean(graph?.logRoutes.total)} reason="需要已配置的日志路由" />
        <Capability icon={Activity} label="Metrics" ready={false} reason="当前后端尚未支持服务作用域指标" />
        <Capability icon={GitBranch} label="Traces" ready={false} reason="当前后端尚未支持服务作用域链路" />
      </DataPanel>
    </div>
  );
}

function GraphPanel({ graph, loading, error }: { graph?: ServiceObservabilityGraph; loading: boolean; error: unknown }) {
  if (loading) return <DataPanel title="观测关系"><div className="console-skeleton h-52" /></DataPanel>;
  if (error || !graph) return <DataPanel title="观测关系"><div className="console-notice console-notice-danger">{errorMessage(error)}</div></DataPanel>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <GraphStat label="Collector" value={graph.agents.length} />
        <GraphStat label="日志路由" value={graph.logRoutes.total} />
        <GraphStat label="告警规则" value={graph.alertRules.length} />
      </div>
      <DataPanel title="关系明细" meta="服务 → 日志路由 → 采集 → 下游 → 告警">
        <div className="space-y-2">
          {graph.logRoutes.routes.length === 0 ? <EmptyState title="暂无已登记日志路由" /> : graph.logRoutes.routes.map((item) => (
            <div key={item.route.id} className="grid gap-2 rounded border border-outline bg-white px-3 py-2 text-xs md:grid-cols-[1fr_1fr_1fr_auto]">
              <span className="font-mono">{item.route.id}</span><span>{item.route.sourceType}</span><span>{item.endpoint?.name || item.route.endpointId}</span><StatusBadge value={item.route.lastPublishStatus || item.route.status} />
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
}

function GrafanaIntegrationPanel({ integration, loading, error, reconciling, onReconcile }: {
  integration?: GrafanaProductIntegration;
  loading: boolean;
  error: unknown;
  reconciling: boolean;
  onReconcile: () => void;
}) {
  return (
    <DataPanel title="Grafana 集成" meta="Folder 与 VictoriaLogs Datasource" action={<button className="console-button" onClick={onReconcile} disabled={reconciling}><RefreshCw className={`h-3.5 w-3.5 ${reconciling ? 'animate-spin' : ''}`} />立即协调</button>}>
      {loading ? <div className="console-skeleton h-44" /> : error ? <div className="console-notice console-notice-danger">{errorMessage(error)}</div> : !integration ? <EmptyState title="尚未产生协调状态" /> : (
        <div className="space-y-4">
          {integration.lastError ? <div className="console-notice console-notice-danger">{integration.lastError}</div> : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Info label="整体状态" value={integration.state} />
            <Info label="Folder UID" value={integration.folder.uid || '-'} mono />
            <Info label="Folder 标题" value={integration.folder.title || '-'} />
          </div>
          <div className="console-resource-list overflow-x-auto">
            <table className="console-table min-w-[760px] w-full">
              <thead><tr><th>Endpoint</th><th>Datasource UID</th><th>URL</th><th>健康</th><th>状态</th></tr></thead>
              <tbody>{integration.datasources.length === 0 ? <tr><td colSpan={5} className="text-center text-muted">没有已发布日志路由，因此尚不需要产品数据源</td></tr> : integration.datasources.map((item) => (
                <tr key={item.endpointId}><td>{item.endpointName || item.endpointId}</td><td className="font-mono text-xs">{item.uid}</td><td className="font-mono text-xs">{item.url}</td><td>{item.health}</td><td><StatusBadge value={item.state} /></td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </DataPanel>
  );
}

function ProductDrawer({ pending, error, onClose, onSubmit }: {
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: { key: string; name: string; description?: string }) => void;
}) {
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  return (
    <Drawer title="新增产品" onClose={onClose} footer={<button className="console-button console-button-primary" disabled={pending || !form.key.trim() || !form.name.trim()} onClick={() => onSubmit(form)}>{pending ? '创建中…' : '创建产品'}</button>}>
      <div className="console-notice console-notice-info"><HelpTip content="产品 ID、0:ProjectID 租户和 Grafana Folder UID 由平台生成，创建后不可修改。" label="自动生成字段说明" />只填写业务身份，平台负责生成技术身份并异步协调 Grafana。</div>
      {error ? <div className="console-notice console-notice-danger">{errorMessage(error)}</div> : null}
      <Field label="产品 Key *"><input className="console-input w-full font-mono" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="commerce" /></Field>
      <Field label="产品名称 *"><input className="console-input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="交易平台" /></Field>
      <Field label="描述"><textarea className="console-input min-h-24 w-full" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
    </Drawer>
  );
}

function ServiceDrawer({ pending, error, onClose, onSubmit }: {
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: { key: string; name: string; description: string }) => void;
}) {
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  return (
    <Drawer title="新增逻辑服务" onClose={onClose} footer={<button className="console-button console-button-primary" disabled={pending || !form.key.trim() || !form.name.trim()} onClick={() => onSubmit(form)}>{pending ? '创建中…' : '创建服务'}</button>}>
      <div className="console-notice console-notice-info">服务提供稳定的逻辑身份。集群、命名空间和主机信息由各观测模块的接入配置维护。</div>
      {error ? <div className="console-notice console-notice-danger">{errorMessage(error)}</div> : null}
      <Field label="服务 Key *"><input className="console-input w-full font-mono" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="orders-api" /></Field>
      <Field label="服务名称 *"><input className="console-input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="订单服务" /></Field>
      <Field label="描述"><textarea className="console-input min-h-24 w-full" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
    </Drawer>
  );
}

function Drawer({ title, onClose, footer, children }: { title: string; onClose: () => void; footer: ReactNode; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 border-0 bg-transparent" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[620px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.22)]" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-outline px-4 py-3"><div className="text-sm font-semibold">{title}</div><button className="console-icon-button" onClick={onClose}><X className="h-4 w-4" /></button></div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface p-4">{children}</div>
        <div className="console-action-bar justify-end"><button className="console-button" onClick={onClose}>取消</button>{footer}</div>
      </aside>
    </div>
  );
}

function ProductTab({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return <Link className={`border-b-2 px-4 py-2 text-sm font-semibold ${active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface'}`} to={to}>{children}</Link>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2 text-xs font-semibold text-on-surface"><span>{label}</span>{children}</label>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><div className="text-[11px] font-semibold text-muted">{label}</div><div className={`mt-1 break-all text-sm font-semibold text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value || '-'}</div></div>;
}

function Capability({ icon: Icon, label, ready, reason }: { icon: typeof Activity; label: string; ready: boolean; reason: string }) {
  return <div className="flex items-start gap-3 border-b border-outline py-3 last:border-0"><Icon className={`mt-0.5 h-4 w-4 ${ready ? 'text-emerald-600' : 'text-muted'}`} /><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-xs text-muted">{ready ? '能力已就绪' : reason}</div></div><StatusBadge value={ready ? 'ready' : 'disabled'} /></div>;
}

function GraphStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-outline bg-white p-4"><div className="text-xs font-semibold text-muted">{label}</div><div className="mt-2 font-display text-2xl font-semibold">{value}</div></div>;
}

function sourceLabel(source: string) {
  if (source === 'k8s') return 'K8s 同步';
  if (source === 'cmdb') return 'CMDB';
  return '平台创建';
}

function formatTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}
