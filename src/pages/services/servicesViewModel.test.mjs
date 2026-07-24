import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductCatalogGroups, graphStatItems } from './servicesViewModel.ts';

const products = [
  { id: 'prd-commerce', key: 'commerce', name: '交易平台', description: '订单产品', status: 'active', updatedAt: '2026-07-20T00:00:00Z' },
  { id: 'prd-growth', key: 'growth', name: '增长平台', description: '营销产品', status: 'archived', updatedAt: '2026-07-22T00:00:00Z' },
];

const servicesByProduct = {
  'prd-commerce': [
    { id: 'svc-checkout', productId: 'prd-commerce', key: 'checkout', name: '结算服务', ownerTeam: '交易 SRE', owner: '', source: 'manual', status: 'active', updatedAt: '2026-07-21T00:00:00Z' },
    { id: 'svc-orders', productId: 'prd-commerce', key: 'orders', name: '订单服务', ownerTeam: '', owner: '', source: 'k8s', status: 'archived', updatedAt: '2026-07-23T00:00:00Z' },
  ],
  'prd-growth': [
    { id: 'svc-campaign', productId: 'prd-growth', key: 'campaign', name: '营销服务', ownerTeam: '增长 SRE', owner: '', source: 'k8s', status: 'active', updatedAt: '2026-07-24T00:00:00Z' },
  ],
};

test('关系统计只包含已落地关系类型', () => {
  const items = graphStatItems({
    agents: [{ instanceUid: 'a1' }, { instanceUid: 'a2' }],
    logRoutes: { total: 2, routes: [{ route: { id: 'p1' } }, { route: { id: 'p2' } }] },
    alertRules: [{ id: 'r1' }],
  });
  assert.deepEqual(items.map((item) => item.label), ['Agent', '日志路由', '告警规则']);
  assert.deepEqual(items.map((item) => item.value), [2, 2, 1]);
});

test('查询服务时保留所属产品并只返回命中的服务', () => {
  const groups = buildProductCatalogGroups(products, servicesByProduct, {
    query: 'orders',
    status: '',
    source: '',
    sort: 'updated_desc',
  });

  assert.deepEqual(groups.map((group) => group.product.id), ['prd-commerce']);
  assert.deepEqual(groups[0].services.map((service) => service.id), ['svc-orders']);
});

test('查询产品时展示该产品下符合过滤条件的全部服务', () => {
  const groups = buildProductCatalogGroups(products, servicesByProduct, {
    query: 'commerce',
    status: '',
    source: '',
    sort: 'name_asc',
  });

  assert.deepEqual(groups.map((group) => group.product.id), ['prd-commerce']);
  assert.deepEqual(groups[0].services.map((service) => service.name), ['订单服务', '结算服务']);
});

test('对象状态和服务来源过滤仍保留产品上下文', () => {
  const archivedGroups = buildProductCatalogGroups(products, servicesByProduct, {
    query: '',
    status: 'archived',
    source: '',
    sort: 'name_asc',
  });
  assert.deepEqual(archivedGroups.map((group) => group.product.id), ['prd-commerce', 'prd-growth']);
  assert.deepEqual(archivedGroups.find((group) => group.product.id === 'prd-commerce').services.map((service) => service.id), ['svc-orders']);

  const k8sGroups = buildProductCatalogGroups(products, servicesByProduct, {
    query: '',
    status: '',
    source: 'k8s',
    sort: 'updated_desc',
  });
  assert.deepEqual(k8sGroups.map((group) => group.product.id), ['prd-growth', 'prd-commerce']);
  assert.deepEqual(k8sGroups.flatMap((group) => group.services.map((service) => service.source)), ['k8s', 'k8s']);
});

test('排序同时作用于产品分组和产品内服务且不修改输入', () => {
  const originalOrder = servicesByProduct['prd-commerce'].map((service) => service.id);
  const groups = buildProductCatalogGroups(products, servicesByProduct, {
    query: '',
    status: '',
    source: '',
    sort: 'updated_desc',
  });

  assert.deepEqual(groups.map((group) => group.product.id), ['prd-growth', 'prd-commerce']);
  assert.deepEqual(groups.find((group) => group.product.id === 'prd-commerce').services.map((service) => service.id), ['svc-orders', 'svc-checkout']);
  assert.deepEqual(servicesByProduct['prd-commerce'].map((service) => service.id), originalOrder);
});
