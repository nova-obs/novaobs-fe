import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDefinitions, getDocumentTitle, getRouteTitle } from './routes.tsx';

test('路由定义覆盖主路径', () => {
  assert.deepEqual(routeDefinitions.map((route) => route.path), [
    '/',
    '/services',
    '/onboarding',
    '/logs',
    '/pipelines',
    '/agents/:uid',
    '/alerts',
  ]);
});

test('日志 Pipeline 保留独立入口，旧接入入口已移除', () => {
  const paths = routeDefinitions.map((r) => r.path);
  assert.ok(paths.includes('/pipelines'));
  assert.ok(paths.includes('/agents/:uid'));
  assert.equal(paths.includes('/collectors'), false);
});

test('路由标题可按路径查找', () => {
  assert.equal(getRouteTitle('/onboarding'), '服务接入');
  assert.equal(getRouteTitle('/pipelines'), '日志 Pipeline');
  assert.equal(getRouteTitle('/logs?tab=pipelines'), 'Logs');
  assert.equal(getRouteTitle('/agents/018f4f9a'), 'Agent Detail');
  assert.equal(getRouteTitle('/missing'), '平台总览');
});

test('浏览器标签页标题包含当前模块和产品名', () => {
  assert.equal(getDocumentTitle('/logs'), 'Logs - NovaObs');
  assert.equal(getDocumentTitle('/pipelines'), '日志 Pipeline - NovaObs');
  assert.equal(getDocumentTitle('/'), '平台总览 - NovaObs');
});
