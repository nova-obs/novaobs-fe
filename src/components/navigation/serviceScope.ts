export type ServiceScopedModule = 'logs';

export interface LogsQueryContext {
  productId: string;
  serviceId: string;
  endpointId: string;
}

export function serviceScopePreferenceKey(module: ServiceScopedModule, productId = ''): string {
  const base = `novaapm.service-scope.${module}`;
  return productId ? `${base}.${encodeURIComponent(productId)}` : base;
}

export function serviceModuleEntryFromPath(pathname: string, module: ServiceScopedModule): string {
  const segments = pathname.split('/').filter(Boolean);
  const moduleIndex = segments.lastIndexOf(module);
  const entry = moduleIndex >= 0 ? segments[moduleIndex + 1] : '';
  if (!entry) return 'explore';
  if (module === 'logs' && entry === 'onboarding') return 'agents';
  return entry;
}

export function buildServiceModulePath(
  module: ServiceScopedModule,
  productId: string,
  serviceId: string,
  entry: string,
): string {
  if (entry === 'endpoints') return `/${module}/endpoints`;
  if (module === 'logs' && entry === 'explore') return buildLogsExplorePath(productId, serviceId);
  return `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/${module}/${entry}`;
}

export function buildLogsExplorePath(productId = '', serviceId = '', endpointId = ''): string {
  const search = new URLSearchParams();
  if (productId) search.set('product_id', productId);
  if (serviceId) search.set('service_id', serviceId);
  if (endpointId) search.set('endpoint_id', endpointId);
  const query = search.toString();
  return `/logs/explore${query ? `?${query}` : ''}`;
}

export function selectLogsProductContext<T extends { id: string; productId: string }>(
  services: T[],
  productId: string,
  preferredServiceId: string,
): LogsQueryContext {
  const candidates = services.filter((service) => service.productId === productId);
  const service = resolveRestorableService(candidates, preferredServiceId);
  return {
    productId,
    serviceId: service?.id ?? '',
    endpointId: '',
  };
}

export function resolveRestorableService<T extends { id: string }>(services: T[], preferredServiceId: string): T | null {
  return services.find((service) => service.id === preferredServiceId)
    ?? (services.length === 1 ? services[0] : null);
}
