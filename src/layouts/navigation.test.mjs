import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNavigationByPath,
  getNavigationDomainByPath,
  getNavigationDomains,
} from './navigation.ts';

test('超级菜单按业务域组织现有叶子入口且路径唯一', () => {
  const domains = getNavigationDomains();
  const items = domains.flatMap((domain) => domain.groups.flatMap((group) => flattenLeafItems(group.items)));

  assert.deepEqual(domains.map((domain) => domain.label), [
    '工作台',
    '可观测性',
    'K8s 运维',
    '平台管理',
  ]);
  assert.deepEqual(items.map((item) => item.path), [
    '/',
    '/services',
	'/logs/explore',
	'/logs/agents',
	'/logs/alerts',
	'/metrics/overview',
	'/metrics/monitoring',
	'/metrics/alerts',
	'/metrics/environments',
    '/traces',
	'/observability/endpoints/logs',
	'/observability/endpoints/metrics',
    '/k8s',
    '/k8s/observability',
	'/platform/environments',
	'/platform/settings',
    '/platform/access',
  ]);
  assert.equal(new Set(items.map((item) => item.path)).size, items.length);
});

test('可观测性导航包含统一接入配置，Logs 只保留服务级功能', () => {
  const observability = getNavigationDomains().find((domain) => domain.id === 'observability');
  const primaryItems = observability?.groups.flatMap((group) => group.items) ?? [];
  const logs = primaryItems.find((item) => item.id === 'logs');
  const metrics = primaryItems.find((item) => item.id === 'metrics');
  const endpoints = primaryItems.find((item) => item.id === 'observability-endpoints');

  assert.deepEqual(primaryItems.map((item) => item.label), ['Logs', '监控', 'Trace', '接入配置']);
  assert.equal(logs?.path, '/logs');
	assert.deepEqual(logs?.children?.map((item) => item.label), ['日志分析', '日志采集', '日志告警']);
	assert.deepEqual(logs?.children?.map((item) => item.path), ['/logs/explore', '/logs/agents', '/logs/alerts']);
  assert.equal(metrics?.path, '/metrics');
	assert.deepEqual(metrics?.children?.map((item) => item.label), ['监控总览', '指标监控', '指标告警', '环境接入']);
	assert.deepEqual(metrics?.children?.map((item) => item.path), ['/metrics/overview', '/metrics/monitoring', '/metrics/alerts', '/metrics/environments']);
	assert.equal(endpoints?.path, '/observability/endpoints/logs');
	assert.deepEqual(endpoints?.children?.map((item) => item.label), ['Logs 下游端点', '指标下游端点']);
	assert.deepEqual(endpoints?.children?.map((item) => item.path), ['/observability/endpoints/logs', '/observability/endpoints/metrics']);
	assert.equal(primaryItems.some((item) => item.id === 'alerts'), false);
});

test('K8s 运维导航按默认父模块卡片承载集群入口', () => {
  const k8s = getNavigationDomains().find((domain) => domain.id === 'k8s');
  const primaryItems = k8s?.groups.flatMap((group) => group.items) ?? [];
  const cluster = primaryItems.find((item) => item.id === 'k8s-cluster');

  assert.deepEqual(primaryItems.map((item) => item.label), ['集群']);
  assert.equal(cluster?.path, '/k8s');
  assert.deepEqual(cluster?.children?.map((item) => item.label), ['集群总览', '观测接入']);
  assert.deepEqual(cluster?.children?.map((item) => item.path), ['/k8s', '/k8s/observability']);
});

test('根据路径解析当前导航项', () => {
  assert.equal(getNavigationByPath('/logs')?.id, 'logs');
	assert.equal(getNavigationByPath('/logs/explore')?.id, 'logs-explore');
	assert.equal(getNavigationByPath('/logs/agents')?.id, 'logs-agents');
	assert.equal(getNavigationByPath('/logs/alerts')?.id, 'logs-alerts');
	assert.equal(getNavigationByPath('/logs/endpoints')?.id, 'observability-logs-endpoints');
	assert.equal(getNavigationByPath('/products/product-1/services/svc-1/logs/agents/new')?.id, 'logs-agents');
	assert.equal(getNavigationByPath('/products/product-1/services/svc-1/logs/alerts/new')?.id, 'logs-alerts');
	assert.equal(getNavigationByPath('/products/product-1/services/svc-1/logs/endpoints')?.id, 'observability-logs-endpoints');
	assert.equal(getNavigationByPath('/observability/endpoints')?.id, 'observability-logs-endpoints');
	assert.equal(getNavigationByPath('/observability/endpoints/logs')?.id, 'observability-logs-endpoints');
	assert.equal(getNavigationByPath('/observability/endpoints/metrics')?.id, 'observability-metrics-endpoints');
  assert.equal(getNavigationByPath('/metrics')?.id, 'metrics');
	assert.equal(getNavigationByPath('/metrics/overview')?.id, 'metrics-overview');
	assert.equal(getNavigationByPath('/metrics/monitoring')?.id, 'metrics-monitoring');
	assert.equal(getNavigationByPath('/metrics/alerts')?.id, 'metrics-alerts');
	assert.equal(getNavigationByPath('/metrics/alerts/new')?.id, 'metrics-alerts');
	assert.equal(getNavigationByPath('/metrics/environments')?.id, 'metrics-environments');
	assert.equal(getNavigationByPath('/metrics/explore')?.id, 'metrics');
  assert.equal(getNavigationByPath('/monitoring'), undefined);
  assert.equal(getNavigationByPath('/traces')?.id, 'traces');
  assert.equal(getNavigationByPath('/platform/settings')?.id, 'platform-settings');
  assert.equal(getNavigationByPath('/platform/access')?.id, 'platform-access');
  assert.equal(getNavigationByPath('/k8s')?.id, 'k8s-fleet');
  assert.equal(getNavigationByPath('/k8s/access'), undefined);
  assert.equal(getNavigationByPath('/k8s/observability')?.id, 'k8s-observability');
  assert.equal(getNavigationByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s-fleet');
  assert.equal(getNavigationByPath('/unknown'), undefined);
});

test('根据任意子页面解析当前业务域', () => {
  assert.equal(getNavigationDomainByPath('/services')?.id, 'workspace');
	assert.equal(getNavigationDomainByPath('/products/product-1/services/svc-1/logs/agents/new')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/agents/agent-1')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/observability/endpoints')?.id, 'observability');
	assert.equal(getNavigationDomainByPath('/metrics/environments')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/monitoring'), undefined);
  assert.equal(getNavigationDomainByPath('/traces')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/alerts')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s');
  assert.equal(getNavigationDomainByPath('/platform/settings')?.id, 'platform');
  assert.equal(getNavigationDomainByPath('/platform/observability')?.id, 'platform');
  assert.equal(getNavigationDomainByPath('/unknown'), undefined);
});

function flattenLeafItems(items) {
  return items.flatMap((item) => item.children?.length ? flattenLeafItems(item.children) : [item]);
}
