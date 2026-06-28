import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDefinitions, getDocumentTitle, getRouteTitle } from './routes.tsx';

test('路由定义覆盖主路径', () => {
  assert.deepEqual(routeDefinitions.map((route) => route.path), [
    '/',
    '/services',
    '/onboarding',
    '/logs',
    '/observability/endpoints',
    '/monitoring',
    '/platform',
    '/k8s',
    '/agents/:uid',
    '/alerts',
  ]);
});

test('K8s 运维使用嵌套路由承载模块子页面', () => {
  const route = routeDefinitions.find((item) => item.path === '/k8s');
  assert.equal(route?.children?.[0].index, true);
  assert.equal(route?.children?.some((item) => item.path === 'namespaces'), true);
  assert.equal(route?.children?.some((item) => item.path === 'rbac'), true);
});

test('Logs 保留三个默认模块入口，并把创建更新归入对应父模块', () => {
  const paths = routeDefinitions.map((r) => r.path);
  const logs = routeDefinitions.find((r) => r.path === '/logs');
  assert.deepEqual(logs?.children?.map((item) => item.path ?? 'index'), ['index', 'explore', 'onboarding', 'agents/new', 'agents/:id/edit', 'agents', 'alerts/new', 'alerts/:id', 'alerts']);
  assert.equal(paths.includes('/pipelines'), false);
  assert.ok(paths.includes('/agents/:uid'));
  assert.equal(paths.includes('/collectors'), false);
});

test('平台管理只保留平台域入口，观测接入配置迁移到可观测性域', () => {
  const platform = routeDefinitions.find((r) => r.path === '/platform');
  assert.deepEqual(platform?.children?.map((item) => item.path ?? 'index'), ['index', 'settings', 'access', 'observability']);
  assert.equal(routeDefinitions.some((item) => item.path === '/observability/endpoints'), true);
});

test('路由标题可按路径查找', () => {
  assert.equal(getRouteTitle('/onboarding'), '服务接入');
  assert.equal(getRouteTitle('/logs'), 'Logs 日志分析');
  assert.equal(getRouteTitle('/logs/explore'), 'Logs 日志分析');
  assert.equal(getRouteTitle('/logs/onboarding'), '创建采集路由');
  assert.equal(getRouteTitle('/logs/agents/new'), '创建采集路由');
  assert.equal(getRouteTitle('/logs/agents/route-1/edit'), '更新采集路由');
  assert.equal(getRouteTitle('/logs/agents'), 'Logs 采集路由');
  assert.equal(getRouteTitle('/observability/endpoints'), '观测接入配置');
  assert.equal(getRouteTitle('/monitoring'), '监控');
  assert.equal(getRouteTitle('/platform/settings'), '平台设置');
  assert.equal(getRouteTitle('/platform/access'), '平台管理');
  assert.equal(getRouteTitle('/platform/observability'), '观测接入配置');
  assert.equal(getRouteTitle('/k8s'), 'K8s 运维');
  assert.equal(getRouteTitle('/k8s/namespaces'), 'K8s 运维');
  assert.equal(getRouteTitle('/agents/018f4f9a'), 'Agent Detail');
  assert.equal(getRouteTitle('/missing'), '平台总览');
});

test('浏览器标签页标题包含当前模块和产品名', () => {
  assert.equal(getDocumentTitle('/logs'), 'Logs 日志分析 - NovaObs');
  assert.equal(getDocumentTitle('/logs/agents/new'), '创建采集路由 - NovaObs');
  assert.equal(getDocumentTitle('/logs/agents/route-1/edit'), '更新采集路由 - NovaObs');
  assert.equal(getDocumentTitle('/observability/endpoints'), '观测接入配置 - NovaObs');
  assert.equal(getDocumentTitle('/monitoring'), '监控 - NovaObs');
  assert.equal(getDocumentTitle('/platform/settings'), '平台设置 - NovaObs');
  assert.equal(getDocumentTitle('/platform/access'), '平台管理 - NovaObs');
  assert.equal(getDocumentTitle('/platform/observability'), '观测接入配置 - NovaObs');
  assert.equal(getDocumentTitle('/k8s/namespaces'), 'K8s 运维 - NovaObs');
  assert.equal(getDocumentTitle('/'), '平台总览 - NovaObs');
});
