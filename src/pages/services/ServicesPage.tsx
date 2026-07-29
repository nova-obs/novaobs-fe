import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  Boxes,
  ChevronDown,
  ChevronRight,
  Database,
  GitBranch,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { HelpTip } from '../../components/HelpTip';
import { StatusBadge } from '../../components/StatusBadge';
import { buildLogsExplorePath } from '../../components/navigation/serviceScope';
import { api } from '../../services/api';
import { k8sApi } from '../k8s/api';
import { defaultLogsCollectorNamespace, logsApi } from '../logs/api';
import { buildLogsRuntimeURL, summarizeK8sRuntimeStatus } from '../logs/logsRuntimeViewModel';
import { buildProductCatalogGroups, type ProductCatalogSort } from './servicesViewModel';
import type {
  GrafanaProductIntegration,
  Product,
  Service,
  ServiceDeployment,
  ServiceObservabilityGraph,
} from '../../services/types';

type ServiceCreateCommand =
  | { mode: 'manual'; key: string; name: string; description: string }
  | { mode: 'k8s'; clusterId: string; namespace: string; deploymentName: string; deploymentUid: string };

export function ServicesPage() {
  const { productId = '', serviceId = '' } = useParams();
  const location = useLocation();
  return (
    <ProductsIndex
      routeProductId={productId}
      routeServiceId={serviceId}
      integrationOpen={Boolean(productId && !serviceId && location.pathname.endsWith('/integrations'))}
    />
  );
}

function ProductsIndex({ routeProductId, routeServiceId, integrationOpen }: {
  routeProductId: string;
  routeServiceId: string;
  integrationOpen: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [serviceProduct, setServiceProduct] = useState<Product | null>(null);
  const [archiveProductTarget, setArchiveProductTarget] = useState<Product | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogStatus, setCatalogStatus] = useState<'' | 'active' | 'archived'>('');
  const [catalogSource, setCatalogSource] = useState<'' | 'manual' | 'k8s' | 'cmdb'>('');
  const [catalogSort, setCatalogSort] = useState<ProductCatalogSort>('updated_desc');
  const [collapsedProductIds, setCollapsedProductIds] = useState<string[]>([]);
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts });
  const products = productsQuery.data ?? [];
  const productServiceQueries = useQueries({
    queries: products.map((product) => ({
      queryKey: ['product-services', product.id],
      queryFn: () => api.getProductServices(product.id),
      retry: false,
    })),
  });
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
  const servicesByProduct = new Map(
    products.map((product, index) => [product.id, {
      services: productServiceQueries[index]?.data ?? [],
      loading: productServiceQueries[index]?.isLoading ?? true,
      error: productServiceQueries[index]?.error,
    }]),
  );
  const catalogGroups = buildProductCatalogGroups(
    products,
    Object.fromEntries(products.map((product, index) => [product.id, productServiceQueries[index]?.data ?? []])),
    { query: catalogQuery, status: catalogStatus, source: catalogSource, sort: catalogSort },
  );
  const catalogFiltered = Boolean(catalogQuery.trim() || catalogStatus || catalogSource);
  const catalogRefreshing = productsQuery.isFetching
    || productServiceQueries.some((query) => query.isFetching)
    || integrationQueries.some((query) => query.isFetching);
  const selectedProductIndex = products.findIndex((product) => product.id === routeProductId);
  const selectedProduct = selectedProductIndex >= 0 ? products[selectedProductIndex] : undefined;
  const selectedServiceState = selectedProduct ? servicesByProduct.get(selectedProduct.id) : undefined;
  const selectedService = selectedServiceState?.services.find((service) => service.id === routeServiceId);
  const createMutation = useMutation({
    mutationFn: api.createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setCreating(false);
    },
  });
  const createService = useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: ServiceCreateCommand }) => input.mode === 'k8s'
      ? api.importK8sDeploymentService({ productId, ...input })
      : api.createService({ productId, key: input.key, name: input.name, description: input.description }),
    onSuccess: async (service, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['product-services', variables.productId] });
      setServiceProduct(null);
      navigate(`/products/${encodeURIComponent(variables.productId)}/services/${encodeURIComponent(service.id)}`);
    },
  });
  const archiveProduct = useMutation({
    mutationFn: (productId: string) => api.archiveProduct(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setArchiveProductTarget(null);
      navigate('/products');
    },
  });
  const reconcile = useMutation({
    mutationFn: (productId: string) => api.reconcileGrafanaProductIntegration(productId),
    onSuccess: (binding, productId) => queryClient.setQueryData(['product-grafana', productId], binding),
  });
  const archiveService = useMutation({
    mutationFn: ({ productId, serviceId }: { productId: string; serviceId: string }) => api.archiveService(productId, serviceId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['product-services', variables.productId] });
      navigate('/products');
    },
  });
  const graphQuery = useQuery({
    queryKey: ['service-graph', routeProductId, routeServiceId],
    queryFn: () => api.getServiceObservabilityGraph(routeProductId, routeServiceId),
    enabled: Boolean(routeProductId && routeServiceId && selectedService),
    retry: false,
  });
  const deploymentsQuery = useQuery({
    queryKey: ['service-deployments', routeProductId, routeServiceId],
    queryFn: () => api.getServiceDeployments(routeProductId, routeServiceId),
    enabled: Boolean(routeProductId && routeServiceId && selectedService),
    retry: false,
  });
  const toggleProductCollapsed = (productId: string) => {
    setCollapsedProductIds((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
  };
  const resetCatalogFilters = () => {
    setCatalogQuery('');
    setCatalogStatus('');
    setCatalogSource('');
  };
  const refreshCatalog = () => {
    void Promise.all([
      productsQuery.refetch(),
      ...productServiceQueries.map((query) => query.refetch()),
      ...integrationQueries.map((query) => query.refetch()),
    ]);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">产品与服务</h1>
          <p className="page-description">产品定义统一租户和权限边界，服务在产品下维护稳定观测身份。</p>
        </div>
        <button className="console-button console-button-primary" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />新增产品
        </button>
      </div>
      {productsQuery.error ? (
        <div className="console-notice console-notice-danger">{errorMessage(productsQuery.error)}</div>
      ) : productsQuery.isLoading ? (
        <div className="console-skeleton h-64" />
      ) : products.length === 0 ? (
        <div className="rounded-md border border-outline bg-white">
          <EmptyState title="还没有产品" action={<p className="max-w-md text-xs text-muted">创建产品后，平台会生成不可变产品 ID、统一租户和 Grafana Folder 协调任务。</p>} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-outline bg-white">
          <div className="console-list-toolbar">
            <div className="console-list-toolbar-actions min-w-0 flex-1">
              <label className="console-list-toolbar-search">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  className="console-input w-full pl-8"
                  aria-label="查询产品或服务"
                  placeholder="查询产品、服务、ID 或 Owner"
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                />
              </label>
              <select
                className="console-input w-full sm:w-auto"
                aria-label="筛选对象状态"
                value={catalogStatus}
                onChange={(event) => setCatalogStatus(event.target.value as '' | 'active' | 'archived')}
              >
                <option value="">全部状态</option>
                <option value="active">运行中</option>
                <option value="archived">已归档</option>
              </select>
              <select
                className="console-input w-full sm:w-auto"
                aria-label="筛选服务来源"
                value={catalogSource}
                onChange={(event) => setCatalogSource(event.target.value as '' | 'manual' | 'k8s' | 'cmdb')}
              >
                <option value="">全部来源</option>
                <option value="manual">平台创建</option>
                <option value="k8s">K8s 导入</option>
                <option value="cmdb">CMDB</option>
              </select>
              <select
                className="console-input w-full sm:w-auto"
                aria-label="列表排序"
                value={catalogSort}
                onChange={(event) => setCatalogSort(event.target.value as ProductCatalogSort)}
              >
                <option value="updated_desc">最近更新</option>
                <option value="name_asc">名称升序</option>
                <option value="name_desc">名称降序</option>
              </select>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              {catalogFiltered ? <button className="console-button" onClick={resetCatalogFilters}>清除筛选</button> : null}
              <button
                className="console-icon-button"
                aria-label="刷新产品与服务列表"
                title="刷新"
                disabled={catalogRefreshing}
                onClick={refreshCatalog}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${catalogRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {catalogGroups.length === 0 ? (
            <EmptyState
              title="没有符合条件的产品或服务"
              action={<button className="console-button" onClick={resetCatalogFilters}>清除筛选</button>}
            />
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {catalogGroups.map(({ product, services }) => (
                  <ProductServiceMobileCard
                    key={product.id}
                    product={product}
                    integration={integrationByProduct.get(product.id)}
                    state={{ ...(servicesByProduct.get(product.id) ?? { loading: false, error: undefined }), services }}
                    totalServiceCount={servicesByProduct.get(product.id)?.services.length ?? 0}
                    collapsed={!catalogFiltered && collapsedProductIds.includes(product.id)}
                    filtered={catalogFiltered}
                    onToggle={() => toggleProductCollapsed(product.id)}
                    onOpenIntegration={() => navigate(`/products/${encodeURIComponent(product.id)}/integrations`)}
                    onCreateService={() => setServiceProduct(product)}
                    onArchiveProduct={() => setArchiveProductTarget(product)}
                    onOpenService={(serviceId) => navigate(`/products/${encodeURIComponent(product.id)}/services/${encodeURIComponent(serviceId)}`)}
                  />
                ))}
              </div>
              <div className="console-resource-list hidden overflow-x-auto md:block">
                <table className="console-table w-full min-w-[1180px] table-fixed">
                  <colgroup>
                    <col className="w-[21%]" /><col className="w-[18%]" /><col className="w-[12%]" />
                    <col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[12%]" /><col className="w-[14%]" />
                  </colgroup>
                  <thead><tr><th>产品 / 服务</th><th>稳定标识</th><th>统一租户</th><th>Owner / 来源</th><th>状态</th><th>更新时间</th><th className="text-right">操作</th></tr></thead>
                  <tbody>
                    {catalogGroups.map(({ product, services }) => (
                      <ProductServiceRows
                        key={product.id}
                        product={product}
                        integration={integrationByProduct.get(product.id)}
                        state={{ ...(servicesByProduct.get(product.id) ?? { loading: false, error: undefined }), services }}
                        totalServiceCount={servicesByProduct.get(product.id)?.services.length ?? 0}
                        collapsed={!catalogFiltered && collapsedProductIds.includes(product.id)}
                        filtered={catalogFiltered}
                        onToggle={() => toggleProductCollapsed(product.id)}
                        onOpenIntegration={() => navigate(`/products/${encodeURIComponent(product.id)}/integrations`)}
                        onCreateService={() => setServiceProduct(product)}
                        onArchiveProduct={() => setArchiveProductTarget(product)}
                        onOpenService={(serviceId) => navigate(`/products/${encodeURIComponent(product.id)}/services/${encodeURIComponent(serviceId)}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      {creating ? (
        <ProductDrawer
          pending={createMutation.isPending}
          error={createMutation.error}
          onClose={() => setCreating(false)}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      ) : null}
      {serviceProduct ? (
        <ServiceDrawer
          pending={createService.isPending}
          error={createService.error}
          onClose={() => setServiceProduct(null)}
          onSubmit={(input) => createService.mutate({ productId: serviceProduct.id, input })}
        />
      ) : null}
      {integrationOpen && selectedProduct ? (
        <ProductIntegrationDrawer
          product={selectedProduct}
          integration={integrationByProduct.get(selectedProduct.id)}
          loading={integrationQueries[selectedProductIndex]?.isLoading ?? false}
          error={integrationQueries[selectedProductIndex]?.error ?? reconcile.error}
          reconciling={reconcile.isPending}
          onClose={() => navigate('/products')}
          onReconcile={() => reconcile.mutate(selectedProduct.id)}
        />
      ) : null}
      {routeServiceId && selectedProduct ? (
        <ServiceDetailDrawer
          product={selectedProduct}
          service={selectedService}
          loading={selectedServiceState?.loading ?? false}
          error={selectedServiceState?.error}
          graph={graphQuery.data}
          graphLoading={graphQuery.isLoading}
          graphError={graphQuery.error}
          deployments={deploymentsQuery.data}
          deploymentsLoading={deploymentsQuery.isLoading}
          deploymentsError={deploymentsQuery.error}
          archiving={archiveService.isPending}
          archiveError={archiveService.error}
          onClose={() => navigate('/products')}
          onArchive={() => archiveService.mutate({ productId: selectedProduct.id, serviceId: routeServiceId })}
        />
      ) : null}
      {archiveProductTarget ? (
        <Drawer
          title="归档产品"
          onClose={() => setArchiveProductTarget(null)}
          footer={(
            <button className="console-button text-red-600" disabled={archiveProduct.isPending} onClick={() => archiveProduct.mutate(archiveProductTarget.id)}>
              <Archive className="h-3.5 w-3.5" />{archiveProduct.isPending ? '归档中…' : '确认归档产品'}
            </button>
          )}
        >
          <div className="console-notice console-notice-warning">
            归档“{archiveProductTarget.name}”前必须先归档全部活动服务；Grafana 资源只会标记保留，不会自动删除。
          </div>
          {archiveProduct.error ? <div className="console-notice console-notice-danger">{errorMessage(archiveProduct.error)}</div> : null}
        </Drawer>
      ) : null}
    </div>
  );
}

function ProductServiceRows({ product, integration, state, totalServiceCount, collapsed, filtered, onToggle, onOpenIntegration, onCreateService, onArchiveProduct, onOpenService }: {
  product: Product;
  integration?: GrafanaProductIntegration;
  state?: { services: Service[]; loading: boolean; error: unknown };
  totalServiceCount: number;
  collapsed: boolean;
  filtered: boolean;
  onToggle: () => void;
  onOpenIntegration: () => void;
  onCreateService: () => void;
  onArchiveProduct: () => void;
  onOpenService: (serviceId: string) => void;
}) {
  return (
    <>
      <tr className="product-catalog-product-row" data-product-id={product.id}>
        <td>
          <button
            className="flex min-w-0 items-center gap-1.5 text-left font-semibold text-on-surface"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? '展开' : '折叠'}产品 ${product.name}`}
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />}
            <span className="truncate">{product.name}</span>
            <span className="shrink-0 text-[10px] font-medium text-muted">{state?.loading ? '服务加载中' : `${totalServiceCount} 个服务`}</span>
          </button>
          <div className="ml-5 mt-1 truncate text-[11px] text-muted">{product.description || '暂无产品描述'}</div>
        </td>
        <td><Identity primary={product.key} secondary={product.id} /></td>
        <td className="font-mono text-xs">{product.tenant.accountId}:{product.tenant.projectId}</td>
        <td><span className="text-xs text-muted">产品边界</span></td>
        <td>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge value={product.status} appearance="inline" />
            <span className="flex items-center gap-1 text-[10px] text-muted">集成 <StatusBadge value={integration?.state ?? 'pending'} appearance="inline" /></span>
          </div>
        </td>
        <td className="text-xs text-muted">{formatTime(product.updatedAt)}</td>
        <td>
          <div className="flex justify-end gap-1">
            <button className="product-catalog-row-action" onClick={onOpenIntegration}>集成</button>
            <button className="product-catalog-row-action" onClick={onCreateService}><Plus className="h-3.5 w-3.5" />服务</button>
            <button className="product-catalog-row-action product-catalog-row-action-icon product-catalog-row-action-danger" aria-label={`归档产品 ${product.name}`} title="归档产品" onClick={onArchiveProduct}><Archive className="h-3.5 w-3.5" /></button>
          </div>
        </td>
      </tr>
      {collapsed ? null : state?.loading ? (
        <tr><td colSpan={7}><div className="console-skeleton h-9" /></td></tr>
      ) : state?.error ? (
        <tr><td colSpan={7}><div className="text-xs text-red-700">服务加载失败：{errorMessage(state.error)}</div></td></tr>
      ) : state?.services.length ? state.services.map((service, index) => (
        <tr className="product-catalog-service-row" key={service.id} data-service-id={service.id}>
          <td className={`product-catalog-service-cell ${index === state.services.length - 1 ? 'product-catalog-service-cell-last' : ''}`}>
            <button className="flex min-w-0 items-center text-left font-semibold text-primary" onClick={() => onOpenService(service.id)}>
              <span className="truncate">{service.name}</span>
            </button>
          </td>
          <td><Identity primary={service.key} secondary={service.id} /></td>
          <td className="text-xs text-muted">继承产品租户</td>
          <td><div className="text-xs">{service.ownerTeam || service.owner || '-'}</div><div className="mt-1 text-[11px] text-muted">{sourceLabel(service.source)}</div></td>
          <td><StatusBadge value={service.status} appearance="inline" /></td>
          <td className="text-xs text-muted">{formatTime(service.updatedAt)}</td>
          <td><div className="flex justify-end gap-1"><button className="product-catalog-row-action" onClick={() => onOpenService(service.id)}>查看</button><Link className="product-catalog-row-action" to={buildLogsExplorePath(product.id, service.id)}>Logs</Link></div></td>
        </tr>
      )) : (
        <tr>
          <td colSpan={7}>
            {filtered
              ? <span className="ml-6 text-xs text-muted">当前条件下无匹配服务</span>
              : <button className="ml-6 text-xs font-semibold text-primary" onClick={onCreateService}>产品下暂无服务，立即新增</button>}
          </td>
        </tr>
      )}
    </>
  );
}

function ProductServiceMobileCard({ product, integration, state, totalServiceCount, collapsed, filtered, onToggle, onOpenIntegration, onCreateService, onArchiveProduct, onOpenService }: {
  product: Product;
  integration?: GrafanaProductIntegration;
  state?: { services: Service[]; loading: boolean; error: unknown };
  totalServiceCount: number;
  collapsed: boolean;
  filtered: boolean;
  onToggle: () => void;
  onOpenIntegration: () => void;
  onCreateService: () => void;
  onArchiveProduct: () => void;
  onOpenService: (serviceId: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-md border border-outline bg-white" data-product-id={product.id}>
      <div className="product-catalog-mobile-header space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <button
            className="flex min-w-0 items-start gap-1.5 text-left"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? '展开' : '折叠'}产品 ${product.name}`}
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" /> : <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />}
            <span className="min-w-0">
              <span className="flex items-center gap-2"><span className="truncate font-semibold">{product.name}</span><span className="shrink-0 text-[10px] font-medium text-muted">{state?.loading ? '加载中' : `${totalServiceCount} 个服务`}</span></span>
              <span className="mt-1 block break-all font-mono text-[11px] text-muted">{product.key} · {product.id}</span>
            </span>
          </button>
          <StatusBadge value={product.status} appearance="inline" />
        </div>
        <div className="flex items-end justify-between gap-3">
          <Info label="统一租户" value={`${product.tenant.accountId}:${product.tenant.projectId}`} mono />
          <div className="flex gap-1"><button className="product-catalog-row-action" onClick={onOpenIntegration}>集成</button><button className="product-catalog-row-action" onClick={onCreateService}><Plus className="h-3.5 w-3.5" />服务</button><button className="product-catalog-row-action product-catalog-row-action-icon product-catalog-row-action-danger" aria-label={`归档产品 ${product.name}`} title="归档产品" onClick={onArchiveProduct}><Archive className="h-3.5 w-3.5" /></button></div>
        </div>
      </div>
      {!collapsed ? <div className="divide-y divide-outline">
        {state?.loading ? <div className="console-skeleton m-3 h-12" /> : state?.error ? <div className="p-3 text-xs text-red-700">{errorMessage(state.error)}</div> : state?.services.length ? state.services.map((service, index) => (
          <button
            key={service.id}
            data-service-id={service.id}
            className={`product-catalog-mobile-service-row flex w-full items-center justify-between gap-3 py-2.5 pr-3 text-left ${index === state.services.length - 1 ? 'product-catalog-mobile-service-row-last' : ''}`}
            onClick={() => onOpenService(service.id)}
          >
            <div className="min-w-0"><div className="truncate text-sm font-semibold text-primary">{service.name}</div><div className="mt-1 truncate font-mono text-[11px] text-muted">{service.key}</div></div>
            <StatusBadge value={service.status} appearance="inline" />
          </button>
        )) : filtered
          ? <div className="p-3 text-xs text-muted">当前条件下无匹配服务</div>
          : <button className="w-full p-3 text-left text-xs font-semibold text-primary" onClick={onCreateService}>产品下暂无服务，立即新增</button>}
      </div> : null}
      <div className="flex items-center justify-between border-t border-outline px-3 py-2 text-[11px] text-muted"><span>Grafana</span><StatusBadge value={integration?.state ?? 'pending'} appearance="inline" /></div>
    </article>
  );
}

function ProductIntegrationDrawer({ product, integration, loading, error, reconciling, onClose, onReconcile }: {
  product: Product;
  integration?: GrafanaProductIntegration;
  loading: boolean;
  error: unknown;
  reconciling: boolean;
  onClose: () => void;
  onReconcile: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/24">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭产品集成遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[780px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.22)]" role="dialog" aria-modal="true" aria-labelledby="product-integration-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0"><div id="product-integration-title" className="truncate text-sm font-semibold">{product.name} · Grafana 集成</div><div className="mt-1 font-mono text-[11px] text-muted">{product.id}</div></div>
          <div className="flex shrink-0 gap-2">
            <button className="console-button" onClick={onReconcile} disabled={reconciling}><RefreshCw className={`h-3.5 w-3.5 ${reconciling ? 'animate-spin' : ''}`} />立即协调</button>
            <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭产品集成" title="关闭"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          {loading ? <div className="console-skeleton h-44" /> : error ? <div className="console-notice console-notice-danger">{errorMessage(error)}</div> : !integration ? <EmptyState title="尚未产生协调状态" /> : (
            <>
              {integration.lastError ? <div className="console-notice console-notice-danger">{integration.lastError}</div> : null}
              <DetailSection title="产品集成状态">
                <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                  <Info label="整体状态" value={integration.state} />
                  <Info label="统一租户" value={`${product.tenant.accountId}:${product.tenant.projectId}`} mono />
                  <Info label="Folder UID" value={integration.folder.uid || '-'} mono />
                  <Info label="Folder 标题" value={integration.folder.title || '-'} />
                </div>
              </DetailSection>
              <DetailSection title="日志数据源" description="Datasource 通过请求 Header 透传产品统一租户，不改变平台的租户定义。">
                <div className="console-resource-list overflow-x-auto">
                  <table className="console-table w-full min-w-[700px]">
                    <thead><tr><th>Endpoint</th><th>Datasource UID</th><th>URL</th><th>健康</th><th>状态</th></tr></thead>
                    <tbody>{integration.datasources.length === 0 ? <tr><td colSpan={5} className="text-center text-muted">没有已发布日志路由，因此尚不需要产品数据源</td></tr> : integration.datasources.map((item) => (
                      <tr key={item.endpointId}><td>{item.endpointName || item.endpointId}</td><td className="font-mono text-xs">{item.uid}</td><td className="font-mono text-xs">{item.url}</td><td>{item.health}</td><td><StatusBadge value={item.state} /></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </DetailSection>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function ServiceDetailDrawer({ product, service, loading, error, graph, graphLoading, graphError, deployments, deploymentsLoading, deploymentsError, archiving, archiveError, onClose, onArchive }: {
  product: Product;
  service?: Service;
  loading: boolean;
  error: unknown;
  graph?: ServiceObservabilityGraph;
  graphLoading: boolean;
  graphError: unknown;
  deployments?: ServiceDeployment[];
  deploymentsLoading: boolean;
  deploymentsError: unknown;
  archiving: boolean;
  archiveError: unknown;
  onClose: () => void;
  onArchive: () => void;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/24">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭服务详情遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[780px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.22)]" role="dialog" aria-modal="true" aria-labelledby="service-detail-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0"><div className="text-[11px] text-muted">{product.name}</div><div className="mt-1 flex items-center gap-2"><div id="service-detail-title" className="truncate text-sm font-semibold">{service?.name || '服务详情'}</div>{service ? <StatusBadge value={service.status} /> : null}</div></div>
          <div className="flex shrink-0 gap-2">
            {service ? <Link className="console-button console-button-primary" to={buildLogsExplorePath(product.id, service.id)}>进入 Logs</Link> : null}
            <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭服务详情" title="关闭"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          {loading ? <div className="console-skeleton h-52" /> : error ? <div className="console-notice console-notice-danger">{errorMessage(error)}</div> : !service ? <EmptyState title="服务不存在或不属于当前产品" /> : (
            <>
              <DetailSection title="部署与日志采集" description="先确认服务运行在哪里，再查看各部署的日志接入和发布状态。">
                <div className="mb-3 flex justify-end">
                  <Link className="console-button console-button-primary" to={`/products/${encodeURIComponent(product.id)}/services/${encodeURIComponent(service.id)}/deployments/new`}>
                    <Plus className="h-3.5 w-3.5" />新增部署
                  </Link>
                </div>
                {deploymentsLoading ? <div className="console-skeleton h-24" /> : deploymentsError ? (
                  <div className="console-notice console-notice-danger">{errorMessage(deploymentsError)}</div>
                ) : !deployments?.length ? (
                  <EmptyState title="尚未登记部署目标" action={<span className="text-xs text-muted">创建 K8S Workload 或主机部署后，日志路由才能绑定实际采集范围。</span>} />
                ) : (
                  <div className="console-resource-list overflow-x-auto">
                    <table className="console-table w-full min-w-[700px]">
                      <thead><tr><th>部署目标</th><th>类型</th><th>范围</th><th>日志状态</th><th className="text-right">操作</th></tr></thead>
                      <tbody>{deployments.map((deployment) => {
                        const deploymentRoutes = graph?.logRoutes.routes.filter((item) => item.route.serviceDeploymentId === deployment.id) ?? [];
                        const route = deploymentRoutes[0];
                        const source = deployment.kind === 'host_set' ? 'vm' : 'k8s';
                        const configureURL = deploymentRoutes.length === 1
                          ? `/products/${encodeURIComponent(product.id)}/services/${encodeURIComponent(service.id)}/logs/agents/${encodeURIComponent(route.route.id)}/edit`
                          : deploymentRoutes.length > 1
                            ? buildLogsRuntimeURL(product.id, service.id, { deploymentId: deployment.id, routeId: route.route.id })
                            : `/products/${encodeURIComponent(product.id)}/services/${encodeURIComponent(service.id)}/logs/agents/new?deployment_id=${encodeURIComponent(deployment.id)}&source=${source}`;
                        return (
                          <tr key={deployment.id}>
                            <td><div className="font-semibold">{deployment.name}</div><div className="mt-1 font-mono text-[11px] text-muted">{deployment.id}</div></td>
                            <td>{deployment.kind === 'host_set' ? 'VM / 物理机' : 'K8S Workload'}</td>
                            <td className="font-mono text-xs"><DeploymentScope productId={product.id} serviceId={service.id} deployment={deployment} /></td>
                            <td>{graphLoading ? <span className="text-xs text-muted">读取中…</span> : graphError ? <span className="text-xs text-danger">读取失败</span> : <DeploymentLogSummary deployment={deployment} routes={deploymentRoutes} />}</td>
                            <td className="text-right">
                              <div className="flex justify-end gap-3">
                                {!graphLoading && !graphError ? <Link className="text-xs font-semibold text-primary hover:underline" to={configureURL}>{deploymentRoutes.length > 1 ? `管理 ${deploymentRoutes.length} 条路由` : '配置采集'}</Link> : null}
                                {!graphLoading && !graphError && route ? <Link className="text-xs font-semibold text-primary hover:underline" to={buildLogsRuntimeURL(product.id, service.id, { deploymentId: deployment.id, routeId: route.route.id })}>查看采集</Link> : null}
                                <Link className="text-xs font-semibold text-muted hover:text-primary" to={`/products/${encodeURIComponent(product.id)}/services/${encodeURIComponent(service.id)}/deployments/${encodeURIComponent(deployment.id)}/edit`}>编辑部署</Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                )}
              </DetailSection>
              <DetailSection title="服务身份">
                <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                  <Info label="服务 Key" value={service.key} mono />
                  <Info label="服务 ID" value={service.id} mono />
                  <Info label="Owner" value={[service.ownerTeam, service.owner].filter(Boolean).join(' / ') || '-'} />
                  <Info label="来源" value={sourceLabel(service.source)} />
                  <Info label="描述" value={service.description || '-'} />
                  <Info label="更新时间" value={formatTime(service.updatedAt)} />
                </div>
              </DetailSection>
              <DetailSection title="模块能力">
                <Capability icon={Database} label="Logs" ready={Boolean(graph?.logRoutes.total)} reason="需要已配置的日志路由" />
                <Capability icon={Activity} label="Metrics" ready={false} reason="当前后端尚未支持服务作用域指标" />
                <Capability icon={GitBranch} label="Traces" ready={false} reason="当前后端尚未支持服务作用域链路" />
              </DetailSection>
              <DetailSection title="设置">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-red-200 bg-red-50/50 p-3">
                  <div><div className="text-sm font-semibold text-red-700">归档服务</div><div className="mt-1 text-xs text-red-600">服务身份保留；已有日志路由、Grafana 数据源和审计记录不会被删除。</div></div>
                  <button className="console-button text-red-600" onClick={() => confirmArchive ? onArchive() : setConfirmArchive(true)} disabled={archiving}>
                    <Archive className="h-3.5 w-3.5" />{archiving ? '归档中…' : confirmArchive ? '确认归档服务' : '归档服务'}
                  </button>
                </div>
                {archiveError ? <div className="mt-3 text-xs text-red-700">{errorMessage(archiveError)}</div> : null}
              </DetailSection>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function DeploymentScope({ productId, serviceId, deployment }: {
  productId: string;
  serviceId: string;
  deployment: ServiceDeployment;
}) {
  const targetsQuery = useQuery({
    queryKey: ['service-deployment-targets', productId, serviceId, deployment.id],
    queryFn: () => api.getServiceDeploymentTargets(productId, serviceId, deployment.id),
    enabled: deployment.kind === 'host_set',
  });
  if (deployment.kind === 'host_set') {
    if (targetsQuery.isLoading) return <span className="text-muted">读取中…</span>;
    if (targetsQuery.error) return <span className="text-danger" title={errorMessage(targetsQuery.error)}>读取失败</span>;
    return <>{(targetsQuery.data ?? []).filter((target) => target.status === 'active').length} 台主机</>;
  }
  return <>{`${deployment.k8sRef?.clusterId || '-'} / ${deployment.k8sRef?.namespace || '-'} / ${deployment.k8sRef?.workloadKind || '-'}:${deployment.k8sRef?.workloadName || '-'}`}</>;
}

function DeploymentLogSummary({ deployment, routes }: {
  deployment: ServiceDeployment;
  routes: ServiceObservabilityGraph['logRoutes']['routes'];
}) {
  if (!routes.length) return <span className="text-xs text-muted">未配置</span>;
  return deployment.kind === 'host_set'
    ? <VMDeploymentLogSummary deployment={deployment} routes={routes} />
    : <K8sDeploymentLogSummary deployment={deployment} routes={routes} />;
}

function VMDeploymentLogSummary({ deployment, routes }: {
  deployment: ServiceDeployment;
  routes: ServiceObservabilityGraph['logRoutes']['routes'];
}) {
  const runtimeQueries = useQueries({
    queries: routes.map((route) => ({
      queryKey: ['service-deployment-log-runtime', route.route.id, deployment.id],
      queryFn: () => logsApi.getRouteRuntimeStatus(route.route.id),
    })),
  });
  if (runtimeQueries.some((query) => query.isLoading)) return <span className="text-xs text-muted">读取中…</span>;
  const queryError = runtimeQueries.find((query) => query.error)?.error;
  if (queryError) return <span className="text-xs text-danger" title={errorMessage(queryError)}>读取失败</span>;
  const runtimes = runtimeQueries.flatMap((query) => query.data ? [query.data] : []);
  if (!runtimes.length || runtimes.some((runtime) => runtime.expected === 0)) return <StatusBadge value="blocked" appearance="inline" />;
  const expected = Math.max(...runtimes.map((runtime) => runtime.expected));
  const registered = Math.min(...runtimes.map((runtime) => runtime.registered));
  const healthy = Math.min(...runtimes.map((runtime) => runtime.healthy));
  const convergedTargets = Math.min(...runtimes.map((runtime) => runtime.converged));
  const converged = runtimes.every((runtime) => runtime.converged === runtime.expected);
  return (
    <div className="space-y-1">
      <StatusBadge value={converged ? 'converged' : 'degraded'} appearance="inline" />
      <div className="whitespace-nowrap text-[11px] text-muted">
        覆盖 {registered}/{expected} · 健康 {healthy}/{expected} · 配置 {convergedTargets}/{expected}
      </div>
    </div>
  );
}

function K8sDeploymentLogSummary({ deployment, routes }: {
  deployment: ServiceDeployment;
  routes: ServiceObservabilityGraph['logRoutes']['routes'];
}) {
  const agentNamespace = defaultLogsCollectorNamespace;
  const runtimeQuery = useQuery({
    queryKey: ['service-deployment-log-runtime', 'k8s', deployment.k8sRef?.clusterId, agentNamespace],
    queryFn: () => logsApi.getLogsCollectorRuntimeStatus({
      clusterId: deployment.k8sRef?.clusterId ?? '',
      namespace: agentNamespace,
    }),
    enabled: Boolean(deployment.k8sRef?.clusterId),
  });
  if (runtimeQuery.isLoading) return <span className="text-xs text-muted">读取中…</span>;
  if (runtimeQuery.error) return <span className="text-xs text-danger" title={errorMessage(runtimeQuery.error)}>读取失败</span>;
  if (!runtimeQuery.data) return <StatusBadge value="unknown" appearance="inline" />;
  const summary = summarizeK8sRuntimeStatus(runtimeQuery.data);
  return (
    <div className="space-y-1">
      <StatusBadge value={runtimeQuery.data.ready ? 'ready' : runtimeQuery.data.status} appearance="inline" />
      <div className="whitespace-nowrap text-[11px] text-muted">
        共享 DaemonSet · 节点 {summary.nodes} · 配置 {summary.configStatus === 'applied' ? '已收敛' : '待收敛'}
      </div>
    </div>
  );
}

function DetailSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-outline bg-white">
      <div className="border-b border-outline px-3 py-2.5"><div className="text-sm font-semibold">{title}</div>{description ? <div className="mt-1 text-xs text-muted">{description}</div> : null}</div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Identity({ primary, secondary }: { primary: string; secondary: string }) {
  return <div className="min-w-0"><div className="truncate font-mono text-xs text-on-surface">{primary}</div><div className="mt-1 truncate font-mono text-[10px] text-muted">{secondary}</div></div>;
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
      <div className="console-notice console-notice-info"><HelpTip content="产品 ID、统一租户（0:ProjectID）和 Grafana Folder UID 由平台生成，创建后不可修改。" label="自动生成字段说明" />只填写业务身份，平台负责生成技术身份并异步协调 Grafana。</div>
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
  onSubmit: (input: ServiceCreateCommand) => void;
}) {
  const [mode, setMode] = useState<'manual' | 'k8s'>('manual');
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  const [clusterId, setClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [deploymentUid, setDeploymentUid] = useState('');
  const clustersQuery = useQuery({
    queryKey: ['k8s-clusters', 'service-import'],
    queryFn: () => k8sApi.listClusters(),
    enabled: mode === 'k8s',
    retry: false,
  });
  const namespacesQuery = useQuery({
    queryKey: ['k8s-namespaces', 'service-import', clusterId],
    queryFn: () => k8sApi.listNamespaces(clusterId),
    enabled: mode === 'k8s' && Boolean(clusterId),
    retry: false,
  });
  const deploymentsQuery = useQuery({
    queryKey: ['k8s-resources', 'service-import', clusterId, namespace, 'Deployment'],
    queryFn: () => k8sApi.listResources({ clusterId, namespace, kind: 'Deployment' }),
    enabled: mode === 'k8s' && Boolean(clusterId) && Boolean(namespace),
    retry: false,
  });
  const deployment = deploymentsQuery.data?.find((item) => item.identity.uid === deploymentUid);
  const queryError = clustersQuery.error ?? namespacesQuery.error ?? deploymentsQuery.error;
  const canSubmit = mode === 'manual'
    ? Boolean(form.key.trim() && form.name.trim())
    : Boolean(clusterId && namespace && deployment);
  const submit = () => {
    if (mode === 'manual') {
      onSubmit({ mode, ...form });
      return;
    }
    if (!deployment) return;
    onSubmit({
      mode,
      clusterId,
      namespace,
      deploymentName: deployment.identity.name,
      deploymentUid: deployment.identity.uid,
    });
  };

  return (
    <Drawer title="新增逻辑服务" onClose={onClose} footer={<button className="console-button console-button-primary" disabled={pending || !canSubmit} onClick={submit}>{pending ? '创建中…' : mode === 'k8s' ? '导入并创建服务' : '创建服务'}</button>}>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="服务创建方式">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'manual'}
          className={`rounded-md border p-3 text-left transition-colors ${mode === 'manual' ? 'border-primary bg-primary-soft' : 'border-outline bg-white hover:border-primary/50'}`}
          onClick={() => setMode('manual')}
        >
          <span className="flex items-center gap-2 text-sm font-semibold"><PenLine className="h-4 w-4 text-primary" />手动创建</span>
          <span className="mt-1 block text-xs font-normal text-muted">自行填写稳定的服务 Key 和业务名称。</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'k8s'}
          className={`rounded-md border p-3 text-left transition-colors ${mode === 'k8s' ? 'border-primary bg-primary-soft' : 'border-outline bg-white hover:border-primary/50'}`}
          onClick={() => setMode('k8s')}
        >
          <span className="flex items-center gap-2 text-sm font-semibold"><Boxes className="h-4 w-4 text-primary" />从 Kubernetes 导入</span>
          <span className="mt-1 block text-xs font-normal text-muted">选择真实 Deployment，自动生成服务身份。</span>
        </button>
      </div>
      {error ? <div className="console-notice console-notice-danger">{errorMessage(error)}</div> : null}
      {queryError ? <div className="console-notice console-notice-danger">{errorMessage(queryError)}</div> : null}
      {mode === 'manual' ? (
        <>
          <div className="console-notice console-notice-info">服务提供稳定的逻辑身份。集群、命名空间和主机信息由各观测模块的接入配置维护。</div>
          <Field label="服务 Key *"><input className="console-input w-full font-mono" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="orders-api" /></Field>
          <Field label="服务名称 *"><input className="console-input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="订单服务" /></Field>
          <Field label="描述"><textarea className="console-input min-h-24 w-full" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </>
      ) : (
        <>
          <div className="console-notice console-notice-info">平台会在提交时重新校验 Deployment UID。集群和 Namespace 只作为本次导入来源，不会写入逻辑服务。</div>
          <Field label="选择集群 *">
            <select
              className="console-input w-full"
              value={clusterId}
              disabled={clustersQuery.isLoading}
              onChange={(event) => {
                setClusterId(event.target.value);
                setNamespace('');
                setDeploymentUid('');
              }}
            >
              <option value="">{clustersQuery.isLoading ? '集群加载中…' : '请选择已登记集群'}</option>
              {(clustersQuery.data ?? []).map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id} · {cluster.id}</option>)}
            </select>
          </Field>
          <Field label="选择 Namespace *">
            <select
              className="console-input w-full"
              value={namespace}
              disabled={!clusterId || namespacesQuery.isLoading}
              onChange={(event) => {
                setNamespace(event.target.value);
                setDeploymentUid('');
              }}
            >
              <option value="">{!clusterId ? '请先选择集群' : namespacesQuery.isLoading ? 'Namespace 加载中…' : '请选择 Namespace'}</option>
              {(namespacesQuery.data ?? []).map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="选择 Deployment *">
            <select
              className="console-input w-full font-mono"
              value={deploymentUid}
              disabled={!namespace || deploymentsQuery.isLoading}
              onChange={(event) => setDeploymentUid(event.target.value)}
            >
              <option value="">{!namespace ? '请先选择 Namespace' : deploymentsQuery.isLoading ? 'Deployment 加载中…' : '请选择 Deployment'}</option>
              {(deploymentsQuery.data ?? []).map((item) => <option key={item.identity.uid} value={item.identity.uid}>{item.identity.name}</option>)}
            </select>
          </Field>
          {namespace && !deploymentsQuery.isLoading && !deploymentsQuery.error && deploymentsQuery.data?.length === 0 ? (
            <div className="console-notice console-notice-warning">当前 Namespace 没有可读取的 Deployment。</div>
          ) : null}
          {deployment ? (
            <div className="rounded-md border border-outline bg-white p-3">
              <div className="text-xs font-semibold text-muted">将创建的服务身份</div>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="服务名称" value={deployment.identity.name} />
                <Info label="来源" value={`${clusterId} / ${namespace}`} mono />
              </dl>
            </div>
          ) : null}
        </>
      )}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2 text-xs font-semibold text-on-surface"><span>{label}</span>{children}</label>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><div className="text-[11px] font-semibold text-muted">{label}</div><div className={`mt-1 break-all text-sm font-semibold text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value || '-'}</div></div>;
}

function Capability({ icon: Icon, label, ready, reason }: { icon: typeof Activity; label: string; ready: boolean; reason: string }) {
  return <div className="flex items-start gap-3 border-b border-outline py-3 last:border-0"><Icon className={`mt-0.5 h-4 w-4 ${ready ? 'text-emerald-600' : 'text-muted'}`} /><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-xs text-muted">{ready ? '能力已就绪' : reason}</div></div><StatusBadge value={ready ? 'ready' : 'disabled'} /></div>;
}

function sourceLabel(source: string) {
  if (source === 'k8s') return 'K8s 导入';
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
