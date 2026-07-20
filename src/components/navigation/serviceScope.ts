export type ServiceScopedModule = 'logs';

export function serviceScopePreferenceKey(module: ServiceScopedModule): string {
  return `novaapm.service-scope.${module}`;
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
  return `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/${module}/${entry}`;
}

export function resolveRestorableService<T extends { id: string }>(services: T[], preferredServiceId: string): T | null {
  return services.find((service) => service.id === preferredServiceId)
    ?? (services.length === 1 ? services[0] : null);
}
