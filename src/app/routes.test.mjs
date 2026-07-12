import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDefinitions, getDocumentTitle, getRouteTitle } from './routes.tsx';

test('路由定义覆盖主路径', () => {
  assert.deepEqual(routeDefinitions.map((route) => route.path), [
    '/',
    '/services',
    '/onboarding',
    '/logs',
	'/products/:productId/services/:serviceId/logs',
	'/products/:productId/services/:serviceId/metrics/endpoints',
    '/observability/endpoints',
    '/observability/endpoints/logs',
    '/observability/endpoints/metrics',
    '/metrics',
    '/traces',
    '/platform',
    '/k8s',
    '/agents/:uid',
    '/alerts',
  ]);
});

test('Metrics 使用环境级路由', () => {
	const metricsEntry = routeDefinitions.find((item) => item.path === '/metrics');
  const monitoring = routeDefinitions.find((item) => item.path === '/monitoring');

	assert.deepEqual(metricsEntry?.children?.map((item) => item.path ?? 'index'), ['index', 'overview', 'monitoring', 'environments', 'endpoints']);
	assert.equal(metricsEntry?.element?.type?.name, 'MetricsLayout');
	assert.equal(metricsEntry?.children?.find((item) => item.path === 'monitoring')?.element?.type?.name, 'MetricsMonitoringPage');
  assert.equal(metricsEntry?.children?.find((item) => item.path === 'environments')?.element?.type?.name, 'MetricsEnvironmentsPage');
  assert.equal(metricsEntry?.children?.find((item) => item.path === 'endpoints')?.element?.props?.to, '/observability/endpoints/metrics');
	const serviceEndpoints = routeDefinitions.find((item) => item.path === '/products/:productId/services/:serviceId/metrics/endpoints');
	assert.equal(serviceEndpoints?.element?.props?.to, '/observability/endpoints/metrics');
  assert.equal(monitoring, undefined);
});

test('K8s 运维使用嵌套路由承载模块子页面', () => {
  const route = routeDefinitions.find((item) => item.path === '/k8s');
  assert.equal(route?.children?.[0].index, true);
  assert.equal(route?.children?.some((item) => item.path === 'access'), false);
  assert.equal(route?.children?.some((item) => item.path === 'namespaces'), true);
  assert.equal(route?.children?.some((item) => item.path === 'rbac'), true);
});

test('Logs 保留服务级能力，旧接入配置路径统一跳转观测端点', () => {
  const paths = routeDefinitions.map((r) => r.path);
	const logsEntry = routeDefinitions.find((r) => r.path === '/logs');
	const logs = routeDefinitions.find((r) => r.path === '/products/:productId/services/:serviceId/logs');
	assert.deepEqual(logsEntry?.children?.map((item) => item.path ?? 'index'), ['index', 'explore', 'agents', 'alerts', 'endpoints']);
  assert.equal(logsEntry?.element?.type?.name, 'LogsWorkspace');
  assert.equal(logsEntry?.children?.find((item) => item.path === 'explore')?.element?.type?.name, 'LogsExplorePage');
  assert.equal(logsEntry?.children?.find((item) => item.path === 'agents')?.element?.type?.name, 'LogsAgentsPage');
	assert.equal(logsEntry?.children?.find((item) => item.path === 'endpoints')?.element?.type?.name, 'Navigate');
  assert.deepEqual(logs?.children?.map((item) => item.path ?? 'index'), ['index', 'explore', 'onboarding', 'agents/new', 'agents/:id/edit', 'agents', 'alerts/new', 'alerts/:id', 'alerts', 'endpoints']);
  assert.equal(paths.includes('/pipelines'), false);
  assert.ok(paths.includes('/agents/:uid'));
  assert.equal(paths.includes('/collectors'), false);
});

test('平台管理只保留平台域入口，观测接入配置迁移到可观测性域', () => {
  const platform = routeDefinitions.find((r) => r.path === '/platform');
  const legacyObservabilityRoute = routeDefinitions.find((item) => item.path === '/observability/endpoints');
	const logsEndpointsRoute = routeDefinitions.find((item) => item.path === '/observability/endpoints/logs');
	const metricsEndpointsRoute = routeDefinitions.find((item) => item.path === '/observability/endpoints/metrics');
  assert.deepEqual(platform?.children?.map((item) => item.path ?? 'index'), ['index', 'environments', 'settings', 'access', 'observability']);
  assert.equal(Boolean(legacyObservabilityRoute), true);
	assert.equal(legacyObservabilityRoute?.element?.type?.name, 'Navigate');
	assert.equal(legacyObservabilityRoute?.element?.props?.to, '/observability/endpoints/logs');
	assert.equal(logsEndpointsRoute?.element?.type?.name, 'ObservabilitySettingsPage');
	assert.equal(logsEndpointsRoute?.element?.props?.domain, 'logs');
	assert.equal(logsEndpointsRoute?.element?.key, 'logs-endpoints');
	assert.equal(metricsEndpointsRoute?.element?.type?.name, 'ObservabilitySettingsPage');
	assert.equal(metricsEndpointsRoute?.element?.props?.domain, 'metrics');
	assert.equal(metricsEndpointsRoute?.element?.key, 'metrics-endpoints');
});

test('路由标题可按路径查找', () => {
  assert.equal(getRouteTitle('/onboarding'), '服务接入');
  assert.equal(getRouteTitle('/logs'), 'Logs 日志分析');
	assert.equal(getRouteTitle('/products/product-1/services/svc-1/logs/explore'), 'Logs 日志分析');
	assert.equal(getRouteTitle('/logs/explore'), 'Logs 日志分析');
	assert.equal(getRouteTitle('/logs/agents'), 'Logs 日志采集');
	assert.equal(getRouteTitle('/logs/alerts'), 'Logs 日志告警');
	assert.equal(getRouteTitle('/products/product-1/services/svc-1/logs/onboarding'), '创建日志采集路由');
  assert.equal(getRouteTitle('/products/product-1/services/svc-1/logs/agents/new'), '创建日志采集路由');
  assert.equal(getRouteTitle('/products/product-1/services/svc-1/logs/agents/route-1/edit'), '更新日志采集路由');
  assert.equal(getRouteTitle('/products/product-1/services/svc-1/logs/agents'), 'Logs 日志采集');
  assert.equal(getRouteTitle('/products/product-1/services/svc-1/logs/endpoints'), 'Logs 下游端点');
  assert.equal(getRouteTitle('/observability/endpoints'), 'Logs 下游端点');
  assert.equal(getRouteTitle('/observability/endpoints/logs'), 'Logs 下游端点');
  assert.equal(getRouteTitle('/observability/endpoints/metrics'), '指标下游端点');
  assert.equal(getRouteTitle('/metrics'), '监控总览');
	assert.equal(getRouteTitle('/metrics/overview'), '监控总览');
	assert.equal(getRouteTitle('/metrics/monitoring'), '指标监控');
	assert.equal(getRouteTitle('/metrics/environments'), '环境接入');
	assert.equal(getRouteTitle('/metrics/endpoints'), '指标下游端点');
	assert.equal(getRouteTitle('/products/product-1/services/svc-1/metrics/endpoints'), '指标下游端点');
  assert.equal(getRouteTitle('/traces'), 'Trace');
  assert.equal(getRouteTitle('/platform/settings'), '平台设置');
  assert.equal(getRouteTitle('/platform/access'), '平台管理');
  assert.equal(getRouteTitle('/platform/observability'), 'Logs 下游端点');
  assert.equal(getRouteTitle('/k8s'), 'K8s 运维');
  assert.equal(getRouteTitle('/k8s/observability'), 'K8s 观测接入');
  assert.equal(getRouteTitle('/k8s/namespaces'), 'K8s 运维');
  assert.equal(getRouteTitle('/k8s/access'), '平台总览');
  assert.equal(getRouteTitle('/agents/018f4f9a'), 'Agent Detail');
  assert.equal(getRouteTitle('/missing'), '平台总览');
});

test('浏览器标签页标题包含当前模块和产品名', () => {
  assert.equal(getDocumentTitle('/logs'), 'Logs 日志分析 - NovaAPM');
	assert.equal(getDocumentTitle('/products/product-1/services/svc-1/logs/agents/new'), '创建日志采集路由 - NovaAPM');
	assert.equal(getDocumentTitle('/products/product-1/services/svc-1/logs/agents/route-1/edit'), '更新日志采集路由 - NovaAPM');
	assert.equal(getDocumentTitle('/products/product-1/services/svc-1/logs/endpoints'), 'Logs 下游端点 - NovaAPM');
  assert.equal(getDocumentTitle('/observability/endpoints'), 'Logs 下游端点 - NovaAPM');
  assert.equal(getDocumentTitle('/observability/endpoints/logs'), 'Logs 下游端点 - NovaAPM');
  assert.equal(getDocumentTitle('/observability/endpoints/metrics'), '指标下游端点 - NovaAPM');
  assert.equal(getDocumentTitle('/metrics'), '监控总览 - NovaAPM');
	assert.equal(getDocumentTitle('/metrics/environments'), '环境接入 - NovaAPM');
	assert.equal(getDocumentTitle('/metrics/monitoring'), '指标监控 - NovaAPM');
	assert.equal(getDocumentTitle('/metrics/endpoints'), '指标下游端点 - NovaAPM');
  assert.equal(getDocumentTitle('/traces'), 'Trace - NovaAPM');
  assert.equal(getDocumentTitle('/platform/settings'), '平台设置 - NovaAPM');
  assert.equal(getDocumentTitle('/platform/access'), '平台管理 - NovaAPM');
  assert.equal(getDocumentTitle('/platform/observability'), 'Logs 下游端点 - NovaAPM');
  assert.equal(getDocumentTitle('/k8s/observability'), 'K8s 观测接入 - NovaAPM');
  assert.equal(getDocumentTitle('/k8s/namespaces'), 'K8s 运维 - NovaAPM');
  assert.equal(getDocumentTitle('/k8s/access'), '平台总览 - NovaAPM');
  assert.equal(getDocumentTitle('/'), '平台总览 - NovaAPM');
});
