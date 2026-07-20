import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routesSource = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('./PlatformLayout.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./PlatformEnvironmentsPage.tsx', import.meta.url), 'utf8');

test('平台环境作为平台管理一级能力接入真实路由和现有 Rail', () => {
  assert.match(routesSource, /path: 'environments'/);
  assert.match(routesSource, /PlatformEnvironmentsPage/);
  assert.match(layoutSource, /\/platform\/environments/);
  assert.match(layoutSource, /环境管理/);
});

test('环境页面使用列表详情和独立创建上下文而非卡片功能墙', () => {
  assert.match(pageSource, /console-table/);
  assert.match(pageSource, /环境资源/);
  assert.match(pageSource, /创建环境/);
  assert.doesNotMatch(pageSource, /gradient|bento|hero/i);
});
