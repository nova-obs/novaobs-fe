import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');

test('顶层框架展示专业指挥中心状态条', () => {
  assert.equal(source.includes('搜索服务、指标、日志、告警'), true);
  assert.equal(source.includes('平台运行正常'), true);
  assert.equal(source.includes('配置已同步'), true);
  assert.equal(source.includes('最近 15 分钟'), true);
});

test('顶层框架引入搜索和用户入口', () => {
  assert.equal(source.includes('Search'), true);
  assert.equal(source.includes('系统管理员'), true);
});

test('顶层框架使用柔和观测控制面视觉语言', () => {
  assert.equal(source.includes('min-h-[100dvh]'), true);
  assert.equal(source.includes('border-r border-outline'), false);
  assert.equal(source.includes('bg-app-radial'), true);
  assert.equal(source.includes('Telemetry Atlas'), true);
  assert.equal(source.includes('atlas-sidebar-panel'), true);
  assert.equal(source.includes('atlas-nav-active'), true);
});
