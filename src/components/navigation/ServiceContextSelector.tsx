import { Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useServiceScope } from './ServiceScopeContext';

interface ServiceContextSelectorProps {
  className?: string;
  icon?: LucideIcon;
}

export function ServiceContextSelector({ className = '', icon: Icon = Server }: ServiceContextSelectorProps) {
  const {
    products,
    services,
    activeProduct,
    activeService,
    loading,
    selectProduct,
    selectService,
  } = useServiceScope();
  const productServices = activeProduct
    ? services.filter((service) => service.productId === activeProduct.id)
    : [];

  return (
    <div className={`grid min-w-0 gap-2 sm:grid-cols-2 ${className}`}>
      <label className="min-w-0">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">产品</span>
        <select
          className="console-input h-9 w-full truncate text-xs font-semibold"
          value={activeProduct?.id ?? ''}
          onChange={(event) => selectProduct(event.target.value)}
          disabled={loading || products.length === 0}
          aria-label="选择产品"
        >
          <option value="">选择产品</option>
          {products.filter((product) => product.status === 'active').map((product) => (
            <option key={product.id} value={product.id}>{product.name} · {product.key}</option>
          ))}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted"><Icon className="h-3 w-3" />服务</span>
        <select
          className="console-input h-9 w-full truncate text-xs font-semibold"
          value={activeService?.id ?? ''}
          onChange={(event) => selectService(event.target.value)}
          disabled={loading || !activeProduct || productServices.length === 0}
          aria-label="选择产品内服务"
        >
          <option value="">选择服务</option>
          {productServices.map((service) => (
            <option key={service.id} value={service.id}>{service.name} · {service.key}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
