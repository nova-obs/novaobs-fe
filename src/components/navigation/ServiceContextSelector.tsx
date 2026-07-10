import { Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Service } from '../../services/types';
import { LogsEntitySelector } from '../../pages/logs/LogsEntitySelector';
import { useServiceScope } from './ServiceScopeContext';

interface ServiceContextSelectorProps {
  className?: string;
  icon?: LucideIcon;
}

export function ServiceContextSelector({ className = '', icon: Icon = Server }: ServiceContextSelectorProps) {
  const { products, services, activeService, loading, selectService } = useServiceScope();
  const productNames = new Map(
    products.map((product) => [product.id, product.displayName || product.name]),
  );
  const activeProductName = activeService
    ? productNames.get(activeService.productId) || '未归属产品'
    : '';

  return (
    <div className={className}>
      <LogsEntitySelector<Service>
        items={services}
        activeItem={activeService}
        onSelect={(service) => selectService(service.id)}
        getId={(service) => service.id}
        triggerIcon={Icon}
        triggerTitle={activeService?.displayName || activeService?.name || ''}
        triggerMeta={activeService
          ? `${activeProductName} · ${activeService.environment || '未标注环境'}`
          : '按产品选择服务'}
        placeholder="选择当前服务"
        ariaLabel="选择当前服务"
        disabled={loading || services.length === 0}
        triggerHeight="h-14"
        rowHeight={68}
        minWidth={320}
        emptyMessage="暂无可选择服务"
        renderOption={(service, selected) => (
          <>
            <div className={`truncate text-sm font-semibold ${selected ? 'text-primary' : 'text-on-surface'}`}>
              {productNames.get(service.productId) || '未归属产品'} / {service.displayName || service.name}
            </div>
            <div className="service-context-option mt-1 truncate font-mono text-[10px] text-muted/80">
              {service.environment || '未标注环境'}
            </div>
          </>
        )}
      />
    </div>
  );
}
