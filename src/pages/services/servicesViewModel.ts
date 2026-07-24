import type { Product, Service, ServiceObservabilityGraph } from '../../services/types';

export type ProductCatalogSort = 'updated_desc' | 'name_asc' | 'name_desc';

export interface ProductCatalogFilters {
  query: string;
  status: '' | 'active' | 'archived';
  source: '' | 'manual' | 'k8s' | 'cmdb';
  sort: ProductCatalogSort;
}

export interface ProductCatalogGroup {
  product: Product;
  services: Service[];
}

export function graphStatItems(graph: Pick<ServiceObservabilityGraph, 'agents' | 'logRoutes' | 'alertRules'>) {
  return [
    { label: 'Agent', value: graph.agents.length },
    { label: '日志路由', value: graph.logRoutes.total },
    { label: '告警规则', value: graph.alertRules.length },
  ];
}

export function buildProductCatalogGroups(
  products: Product[],
  servicesByProduct: Record<string, Service[]>,
  filters: ProductCatalogFilters,
): ProductCatalogGroup[] {
  const query = filters.query.trim().toLocaleLowerCase('zh-CN');
  const groups = products.flatMap((product) => {
    const productMatchesQuery = matchesQuery([
      product.name,
      product.key,
      product.id,
      product.description,
      `${product.tenant?.accountId ?? ''}:${product.tenant?.projectId ?? ''}`,
    ], query);
    const productMatchesFilters = (!filters.status || product.status === filters.status) && !filters.source;
    const services = (servicesByProduct[product.id] ?? [])
      .filter((service) => !filters.status || service.status === filters.status)
      .filter((service) => !filters.source || service.source === filters.source)
      .filter((service) => productMatchesQuery || matchesQuery([
        service.name,
        service.key,
        service.id,
        service.description,
        service.ownerTeam,
        service.owner,
      ], query))
      .sort((left, right) => compareCatalogItems(left, right, filters.sort));
    const includeProduct = query
      ? (productMatchesFilters && productMatchesQuery) || services.length > 0
      : productMatchesFilters || services.length > 0;
    return includeProduct ? [{ product, services }] : [];
  });
  return groups.sort((left, right) => compareCatalogItems(left.product, right.product, filters.sort));
}

function matchesQuery(values: Array<string | undefined>, query: string) {
  if (!query) return true;
  return values.some((value) => String(value ?? '').toLocaleLowerCase('zh-CN').includes(query));
}

function compareCatalogItems(left: { name: string; updatedAt: string }, right: { name: string; updatedAt: string }, sort: ProductCatalogSort) {
  if (sort === 'name_asc') return left.name.localeCompare(right.name, 'zh-CN');
  if (sort === 'name_desc') return right.name.localeCompare(left.name, 'zh-CN');
  const byUpdatedAt = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  return Number.isNaN(byUpdatedAt) || byUpdatedAt === 0 ? left.name.localeCompare(right.name, 'zh-CN') : byUpdatedAt;
}
