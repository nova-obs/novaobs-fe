import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('./session.tsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf8');

test('顶层框架展示专业指挥中心状态条', () => {
  assert.equal(source.includes('搜索服务、指标、日志、告警'), true);
  assert.equal(source.includes('平台运行正常'), false);
  assert.equal(source.includes('配置已同步'), false);
  assert.equal(source.includes('最近 15 分钟'), true);
  assert.equal(source.includes('采集状态'), false);
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
  assert.equal(source.includes('isK8sClusterFocus'), true);
  assert.equal(source.includes('k8s-focus-mode'), true);
  assert.equal(source.includes('w-[72px] p-2'), true);
  assert.equal(source.includes('K8sFocusRail'), true);
  assert.equal(source.includes('getK8sFocusClusterName'), true);
  assert.equal(source.includes('返回 K8s 集群总览'), true);
  assert.equal(source.includes('[writing-mode:vertical-rl]'), true);
  assert.equal(source.includes('平台级模块入口暂时收起'), false);
  assert.equal(source.includes('K8s</div>'), false);
  assert.equal(source.includes('Focus</div>'), false);
  assert.equal(source.includes('>N<'), false);
  assert.equal(source.includes('LoginView'), true);
  assert.equal(sessionSource.includes('/api/v1/auth/session'), true);
  assert.equal(sessionSource.includes('/api/v1/auth/login'), true);
  assert.equal(sessionSource.includes('/api/v1/auth/logout'), true);
  assert.equal(sessionSource.includes('clearClientSession'), true);
  assert.equal(sessionSource.includes('finally'), true);
  assert.equal(sessionSource.includes('signed_out=1'), true);
});

test('登录表单通过提交事件调用平台登录', () => {
  assert.equal(source.includes('<form className="console-panel relative w-full max-w-sm p-8" onSubmit={submit}>'), true);
  assert.equal(source.includes('<button type="submit"'), true);
});

test('主侧边导航支持桌面端收起和展开', () => {
  assert.equal(source.includes('sidebar-collapse-toggle'), true);
  assert.equal(source.includes('isSidebarCollapsed'), true);
  assert.equal(source.includes('novaobs.sidebar.collapsed'), true);
  assert.equal(source.includes('w-52 p-2.5'), true);
  assert.equal(source.includes('w-56 p-3'), false);
  assert.equal(source.includes('w-64 p-4'), false);
  assert.equal(source.includes('w-[84px] p-2'), true);
  assert.equal(source.includes('展开主导航'), true);
  assert.equal(source.includes('收起主导航'), true);
});

test('平台退出登录需要二次确认以降低误操作', () => {
  assert.equal(source.includes('LogoutConfirmDetails'), true);
  assert.equal(source.includes('确认退出'), true);
  assert.equal(source.includes('取消退出'), true);
  assert.equal(source.includes('退出登录需要确认'), true);
  assert.equal(source.includes('收起状态下展开主导航后可退出登录'), true);
  assert.equal(source.includes('已清理本地会话'), false);
  assert.equal(source.includes('<div className="font-semibold text-on-surface">Platform IAM</div>'), false);
  assert.equal(source.includes('session active'), false);
});

test('顶层框架提供轻量路由切换过渡', () => {
  assert.equal(source.includes('key={location.pathname}'), true);
  assert.equal(source.includes('route-transition-page'), true);
  assert.equal(styleSource.includes('@keyframes route-enter'), true);
  assert.equal(styleSource.includes('translate3d(0, 12px, 0)'), true);
  assert.equal(styleSource.includes('cubic-bezier(0.22, 1, 0.36, 1)'), true);
  assert.equal(styleSource.includes('prefers-reduced-motion: reduce'), true);
  assert.equal(styleSource.includes('will-change: opacity, transform, filter'), true);
});

test('顶层框架使用柔和观测控制面视觉语言', () => {
  assert.equal(source.includes('h-[100dvh] overflow-hidden bg-app-radial'), false);
  assert.equal(source.includes('h-[100dvh] max-h-[100dvh]'), true);
  assert.equal(source.includes('relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden'), true);
  assert.equal(source.includes('min-h-0 flex-1 overflow-y-auto'), true);
  assert.equal(source.includes('border-r border-outline'), false);
  assert.equal(source.includes('bg-app-radial'), false);
  assert.equal(source.includes('OBS Console'), false);
  assert.equal(source.includes('Telemetry Atlas'), false);
  assert.equal(source.includes('统一可观测性控制面'), false);
  assert.equal(source.includes('Prod / CN-SHANGHAI-A'), false);
  assert.equal(source.includes('生产观测域'), false);
  assert.equal(source.includes('cn-sh-a'), false);
  assert.equal(source.includes('space-y-1.5 overflow-y-auto pt-1'), true);
  assert.equal(source.includes('h-9 gap-3 px-3'), true);
  assert.equal(source.includes('NovaObs for UCloud'), false);
  assert.equal(source.includes('UCloud Ops'), false);
  assert.equal(source.includes('atlas-sidebar-panel'), true);
  assert.equal(source.includes('atlas-nav-active'), true);
});
