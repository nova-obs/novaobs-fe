import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('./session.tsx', import.meta.url), 'utf8');

test('顶层框架展示专业指挥中心状态条', () => {
  assert.equal(source.includes('搜索服务、指标、日志、告警'), true);
  assert.equal(source.includes('平台运行正常'), true);
  assert.equal(source.includes('配置已同步'), true);
  assert.equal(source.includes('最近 15 分钟'), true);
});

test('顶层框架引入搜索和用户入口', () => {
  assert.equal(source.includes('Search'), true);
  assert.equal(source.includes('activeDisplayName'), true);
  assert.equal(source.includes('退出登录'), true);
  assert.equal(source.includes('账户会话'), true);
  assert.equal(source.includes('platform-account-session'), true);
  assert.equal(source.includes('sidebar-account-dock'), true);
  assert.equal(source.includes('platform-logout-action'), true);
  assert.equal(source.includes('createPortal'), false);
  assert.equal(source.includes('z-[9999]'), false);
  assert.equal(source.includes('平台用户菜单'), false);
  assert.equal(source.includes('mobile-account-session'), true);
  assert.equal(source.includes('AccountSessionPanel'), false);
  assert.equal(source.includes('platform-account-session relative flex items-center gap-1.5'), false);
  assert.equal(source.includes('LoginView'), true);
  assert.equal(sessionSource.includes('/api/v1/auth/session'), true);
  assert.equal(sessionSource.includes('/api/v1/auth/login'), true);
  assert.equal(sessionSource.includes('/api/v1/auth/logout'), true);
  assert.equal(sessionSource.includes('clearClientSession'), true);
  assert.equal(sessionSource.includes('finally'), true);
  assert.equal(sessionSource.includes('signed_out=1'), true);
});

test('顶层框架使用柔和观测控制面视觉语言', () => {
  assert.equal(source.includes('min-h-[100dvh]'), true);
  assert.equal(source.includes('border-r border-outline'), false);
  assert.equal(source.includes('bg-app-radial'), true);
  assert.equal(source.includes('Telemetry Atlas'), true);
  assert.equal(source.includes('atlas-sidebar-panel'), true);
  assert.equal(source.includes('atlas-nav-active'), true);
});
