import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDefinitions, getRouteTitle } from './routes.tsx';

test('路由定义覆盖主路径', () => {
  assert.deepEqual(routeDefinitions.map((route) => route.path), [
    '/',
    '/services',
    '/onboarding',
    '/logs',
    '/pipelines',
    '/agents/:uid',
    '/alerts',
    '/metrics',
    '/traces',
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
  assert.equal(getRouteTitle('/missing'), '平台总览');
});
