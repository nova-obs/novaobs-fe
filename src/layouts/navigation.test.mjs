import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrimaryNavigation, getNavigationByPath } from './navigation.ts';

test('主导航包含第一阶段全部模块且路径唯一', () => {
  const items = getPrimaryNavigation();
  assert.deepEqual(items.map((item) => item.path), [
    '/',
    '/services',
    '/onboarding',
    '/logs',
    '/alerts',
    '/metrics',
    '/traces',
  ]);
  assert.equal(new Set(items.map((item) => item.path)).size, items.length);
});

test('根据路径解析当前导航项', () => {
  assert.equal(getNavigationByPath('/logs?level=error')?.id, 'logs');
  assert.equal(getNavigationByPath('/unknown'), undefined);
});
