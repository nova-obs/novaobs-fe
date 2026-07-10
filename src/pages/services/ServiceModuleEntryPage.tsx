import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';

type ServiceModuleEntryPageProps = {
  module: 'logs' | 'metrics';
  entry: string;
  title: string;
  actionLabel: string;
};

export function ServiceModuleEntryPage({ module, entry, title, actionLabel }: ServiceModuleEntryPageProps) {
  const [productId, setProductId] = useState('');
  const [query, setQuery] = useState('');
  const servicesQuery = useQuery({ queryKey: ['services'], queryFn: () => api.getServices() });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts });
  const products = productsQuery.data ?? [];
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const services = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (servicesQuery.data ?? []).filter((service) => {
      if (!service.productId) return false;
      if (productId && service.productId !== productId) return false;
      if (!normalizedQuery) return true;
      const product = productById.get(service.productId);
      return [service.name, service.displayName, service.environment, product?.name, product?.displayName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [productById, productId, query, servicesQuery.data]);
  const error = servicesQuery.error ?? productsQuery.error;
  const loading = servicesQuery.isLoading || productsQuery.isLoading;
  const moduleLabel = module === 'logs' ? 'Logs' : '监控';

  return (
    <section className="console-panel flex h-full min-h-0 flex-col overflow-hidden" aria-label={`${title}服务入口`}>
      <div className="console-panel-header shrink-0">
        <div className="min-w-0">
          <h2 className="console-section-title">{title}</h2>
          <p className="console-section-meta">选择产品下的服务后进入对应{moduleLabel}工作区</p>
        </div>
        <button
          type="button"
          className="console-icon-button border-outline bg-white"
          aria-label="刷新服务列表"
          title="刷新服务列表"
          onClick={() => void Promise.all([servicesQuery.refetch(), productsQuery.refetch()])}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-b border-outline bg-surface/60 px-3 py-3 md:flex-row md:items-center">
        <label className="block w-full md:w-64">
          <span className="sr-only">筛选产品</span>
          <select className="console-input w-full" value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">全部产品</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.displayName || product.name}</option>
            ))}
          </select>
        </label>
        <label className="relative block w-full md:max-w-sm">
          <span className="sr-only">搜索服务</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            className="console-input w-full pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索服务或产品"
          />
        </label>
      </div>

      {error ? (
        <div className="console-notice console-notice-danger m-3">{(error as Error).message || '无法加载服务列表'}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
        <table className="console-table w-full min-w-[760px]">
          <thead>
            <tr>
              <th>服务</th>
              <th>产品</th>
              <th>环境</th>
              <th>状态</th>
              <th className="w-[150px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="console-skeleton h-10" /></td></tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="console-empty-state my-4 min-h-[260px]">
                    <div className="text-sm font-semibold text-on-surface">没有可进入的服务</div>
                    <div className="text-xs text-muted">请调整产品或搜索条件；如果尚未创建服务，可前往服务目录新增。</div>
                    <Link className="console-button" to="/services">前往服务目录</Link>
                  </div>
                </td>
              </tr>
            ) : services.map((service) => {
              const product = productById.get(service.productId);
              const target = `/products/${encodeURIComponent(service.productId)}/services/${encodeURIComponent(service.id)}/${module}/${entry}`;
              return (
                <tr key={service.id}>
                  <td>
                    <div className="font-semibold text-on-surface">{service.displayName || service.name}</div>
                    <div className="font-mono text-[11px] text-muted">{service.name}</div>
                  </td>
                  <td>
                    <div className="text-sm text-on-surface">{product?.displayName || product?.name || service.productId}</div>
                    <div className="font-mono text-[11px] text-muted">ProjectID {service.projectId || '-'}</div>
                  </td>
                  <td>{service.environment || '-'}</td>
                  <td><StatusBadge value={service.status || 'unknown'} /></td>
                  <td>
                    <Link className="console-button gap-1 text-xs" to={target}>
                      {actionLabel}<ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}
