import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDefinitions, getRouteTitle } from './routes.tsx';

test('路由定义覆盖所有路径（含兼容/隐藏路由）', () => {
  assert.deepEqual(routeDefinitions.map((route) => route.path), [
    '/',
    '/services',
    '/onboarding',
    '/collectors',
    '/collectors/agents/:uid',
    '/logs',
    '/pipelines',
    '/alerts',
    '/metrics',
    '/traces',
  ]);
});

test('/collectors 和 /pipelines 作为兼容路由保留', () => {
  const paths = routeDefinitions.map((r) => r.path);
  assert.ok(paths.includes('/collectors'));
  assert.ok(paths.includes('/pipelines'));
});

test('路由标题可按路径查找', () => {
  assert.equal(getRouteTitle('/pipelines'), '日志 Pipeline');
  assert.equal(getRouteTitle('/missing'), '平台总览');
});
