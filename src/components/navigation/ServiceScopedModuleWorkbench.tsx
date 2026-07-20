import { useEffect, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Service } from '../../services/types';
import { ModuleWorkbench } from './ModuleWorkbench';
import type { ModuleRailItem } from './ModuleRail';
import { ServiceContextSelector } from './ServiceContextSelector';
import { ServiceScopeContext } from './ServiceScopeContext';
import {
  buildServiceModulePath,
  resolveRestorableService,
  serviceModuleEntryFromPath,
  serviceScopePreferenceKey,
  type ServiceScopedModule,
} from './serviceScope';

export interface ServiceScopedRailItem extends Omit<ModuleRailItem, 'to'> {
  entry: string;
  serviceScoped?: boolean;
}

interface ServiceScopedModuleWorkbenchProps extends PropsWithChildren {
  module: ServiceScopedModule;
  title: string;
  ariaLabel: string;
  items: ServiceScopedRailItem[];
  remountOnPathChange?: boolean;
}

export function ServiceScopedModuleWorkbench({
  module,
  title,
  ariaLabel,
  items,
  remountOnPathChange = false,
  children,
}: ServiceScopedModuleWorkbenchProps) {
  const { productId = '', serviceId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const entry = serviceModuleEntryFromPath(location.pathname, module);
  const currentItem = items.find((item) => item.entry === entry);
  const serviceContextEnabled = entry !== 'endpoints';
  const serviceRequired = currentItem?.serviceScoped !== false;
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: api.getProducts,
    enabled: serviceContextEnabled,
  });
  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    enabled: serviceContextEnabled,
  });
  const products = productsQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const serviceScopeError = productsQuery.error ?? servicesQuery.error;
  const activeService = services.find((service) => service.id === serviceId && service.productId === productId) ?? null;
  useEffect(() => {
    if (!serviceRequired || servicesQuery.isLoading || servicesQuery.error) return;
    if (activeService) {
      writeServicePreference(module, activeService.id);
      return;
    }
    if (serviceId) return;
    const nextService = resolveRestorableService(services, readServicePreference(module));
    if (!nextService) return;
    navigate(buildServiceModulePath(module, nextService.productId, nextService.id, entry), { replace: true });
  }, [activeService, entry, module, navigate, serviceId, serviceRequired, services, servicesQuery.error, servicesQuery.isLoading]);

  const railItems: ModuleRailItem[] = items.map((item) => {
    const { entry: itemEntry, serviceScoped = itemEntry !== 'endpoints', ...railItem } = item;
    const to = serviceScoped && activeService
      ? buildServiceModulePath(module, activeService.productId, activeService.id, itemEntry)
      : `/${module}/${itemEntry}`;
    return { ...railItem, to };
  });

  const contextValue = useMemo(() => ({
    products,
    services,
    activeService,
    loading: productsQuery.isLoading || servicesQuery.isLoading,
    error: serviceScopeError,
    retry: () => void Promise.all([productsQuery.refetch(), servicesQuery.refetch()]),
    selectService: (nextServiceId: string) => {
      const nextService = services.find((service) => service.id === nextServiceId);
      if (!nextService) return;
      writeServicePreference(module, nextService.id);
      navigate(buildServiceModulePath(module, nextService.productId, nextService.id, entry));
    },
  }), [activeService, entry, module, navigate, products, productsQuery.isLoading, productsQuery.refetch, serviceScopeError, services, servicesQuery.isLoading, servicesQuery.refetch]);

  return (
    <ServiceScopeContext.Provider value={contextValue}>
      <ModuleWorkbench
        module={module}
        title={title}
        ariaLabel={ariaLabel}
        items={railItems}
        remountOnPathChange={remountOnPathChange}
      >
        {serviceRequired ? (
          <ServiceScopeContent
            activeService={activeService}
            loading={productsQuery.isLoading || servicesQuery.isLoading}
            error={serviceScopeError}
            hasServices={services.length > 0}
            onRetry={() => void Promise.all([productsQuery.refetch(), servicesQuery.refetch()])}
          >
            {children}
          </ServiceScopeContent>
        ) : children}
      </ModuleWorkbench>
    </ServiceScopeContext.Provider>
  );
}

function ServiceScopeContent({
  activeService,
  loading,
  error,
  hasServices,
  onRetry,
  children,
}: PropsWithChildren<{
  activeService: Service | null;
  loading: boolean;
  error: unknown;
  hasServices: boolean;
  onRetry: () => void;
}>) {
  if (loading) return <div className="console-panel m-3"><div className="console-skeleton h-24" /></div>;
  if (error) {
    return (
      <div className="console-notice console-notice-danger m-3 flex items-center justify-between gap-3">
        <span>{(error as Error).message || '产品和服务加载失败'}</span>
        <button type="button" className="console-button" onClick={onRetry}>重试</button>
      </div>
    );
  }
  if (activeService) return children;
  return (
    <div className="console-panel m-3 flex min-h-[320px] items-center justify-center">
      <div className="console-empty-state">
        <div className="text-sm font-semibold text-on-surface">{hasServices ? '请选择当前服务' : '暂无可用服务'}</div>
        <div className="max-w-md text-xs leading-5 text-muted">
          {hasServices ? '从上方按产品分组的服务下拉框进入当前模块，服务会写入可分享的嵌套 URL。' : '请先在服务目录创建或同步服务。'}
        </div>
        {hasServices ? <ServiceContextSelector className="mx-auto mt-4 w-full max-w-md" /> : null}
        {!hasServices ? <Link className="console-button" to="/services">前往服务目录</Link> : null}
      </div>
    </div>
  );
}

function readServicePreference(module: ServiceScopedModule): string {
  try {
    return window.localStorage.getItem(serviceScopePreferenceKey(module)) ?? '';
  } catch {
    return '';
  }
}

function writeServicePreference(module: ServiceScopedModule, serviceId: string) {
  try {
    window.localStorage.setItem(serviceScopePreferenceKey(module), serviceId);
  } catch {
    // 浏览器隐私模式或配额不足时，只保留当前 URL 中的服务作用域。
  }
}
