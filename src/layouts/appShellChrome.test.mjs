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
  assert.equal(source.includes('platform-logout-action'), true);
  assert.equal(source.includes('createPortal'), false);
  assert.equal(source.includes('z-[9999]'), false);
  assert.equal(source.includes('平台用户菜单'), false);
  assert.equal(source.includes('AccountSessionPanel'), false);
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
  assert.equal(source.includes('font-display text-lg font-semibold tracking-tight">登录'), true);
  assert.equal(source.includes('grid gap-1.5 text-[13px] font-semibold text-muted'), true);
});

test('顶层框架使用顶部业务域和按需展开的超级菜单', () => {
  assert.equal(source.includes('getNavigationDomains'), true);
  assert.equal(source.includes('getNavigationDomainByPath'), true);
  assert.equal(source.includes('openDomainId'), true);
  assert.equal(source.includes('NovaObs 超级菜单'), true);
  assert.equal(source.includes('全部模块'), true);
  assert.equal(source.includes('快速访问'), true);
  assert.equal(source.includes('aria-expanded'), true);
  assert.equal(source.includes("event.key === 'Escape'"), true);
  assert.equal(source.includes('关闭超级菜单'), true);
});

test('超级菜单明确区分模块身份、主功能菜单和辅助入口', () => {
  assert.equal(source.includes('mega-menu-domain'), true);
  assert.equal(source.includes('mega-menu-navigation'), true);
  assert.equal(source.includes('mega-menu-utility'), true);
  assert.equal(source.includes('当前模块'), true);
  assert.equal(source.includes('模块功能'), true);
  assert.equal(source.includes('border-l-[3px] border-primary'), true);
  assert.equal(source.includes('border border-outline/80 bg-surface-lowest'), true);
  assert.equal(source.includes('max-h-[calc(100dvh-4rem)]'), true);
  assert.equal(source.includes('overflow-y-auto'), true);
});

test('超级菜单作为独立悬浮区域与顶部导航保持间距', () => {
  assert.equal(source.includes('px-3 pt-2 md:px-5'), true);
  assert.equal(source.includes('mx-auto'), true);
  assert.equal(source.includes('max-w-[1440px]'), true);
  assert.equal(source.includes('rounded-lg border border-outline'), true);
  assert.equal(source.includes('top-full'), true);
});

test('应用内容使用带当前位置和右侧工具区的工作区外壳', () => {
  assert.equal(source.includes('content-workbench-frame'), true);
  assert.equal(source.includes('content-workbench-header'), true);
  assert.equal(source.includes('content-workbench-location'), true);
  assert.equal(source.includes('content-workbench-tools'), true);
  assert.equal(source.includes('content-workbench-body'), true);
  assert.equal(source.includes('workspaceLabel'), true);
  assert.equal(source.includes('activeDomain.label'), true);
  assert.equal(source.includes('复制当前页面链接'), true);
  assert.equal(source.includes('navigator.clipboard.writeText'), true);
  assert.equal(source.includes("document.execCommand('copy')"), true);
});

test('顶层框架不再保留全局侧栏和 K8s 聚焦侧栏', () => {
  assert.equal(source.includes('sidebar-collapse-toggle'), false);
  assert.equal(source.includes('isSidebarCollapsed'), false);
  assert.equal(source.includes('novaobs.sidebar.collapsed'), false);
  assert.equal(source.includes('K8sFocusRail'), false);
  assert.equal(source.includes('getK8sFocusClusterName'), false);
  assert.equal(source.includes('k8s-focus-mode'), false);
  assert.equal(source.includes('[writing-mode:vertical-rl]'), false);
  assert.equal(source.includes('<aside'), false);
});

test('平台退出登录需要二次确认以降低误操作', () => {
  assert.equal(source.includes('LogoutConfirmDetails'), true);
  assert.equal(source.includes('确认退出'), true);
  assert.equal(source.includes('取消退出'), true);
  assert.equal(source.includes('退出登录需要确认'), true);
  assert.equal(source.includes('退出后需要重新登录才能继续访问控制台'), true);
  assert.equal(source.includes('已清理本地会话'), false);
  assert.equal(source.includes('<div className="font-semibold text-on-surface">Platform IAM</div>'), false);
  assert.equal(source.includes('session active'), false);
});

test('顶层框架提供轻量路由切换过渡', () => {
  assert.equal(source.includes('key={location.pathname}'), true);
  assert.equal(source.includes('route-transition-page'), true);
  assert.equal(styleSource.includes('@keyframes route-enter'), true);
  assert.equal(styleSource.includes('translate3d(0, 4px, 0)'), true);
  assert.equal(styleSource.includes('cubic-bezier(0.22, 1, 0.36, 1)'), true);
  assert.equal(styleSource.includes('prefers-reduced-motion: reduce'), true);
  assert.equal(styleSource.includes('will-change: opacity, transform;'), true);
  assert.equal(styleSource.includes('filter: blur'), false);
});

test('顶层框架使用柔和观测控制面视觉语言', () => {
  assert.equal(source.includes('h-[100dvh] overflow-hidden bg-app-radial'), false);
  assert.equal(source.includes('h-[100dvh] max-h-[100dvh]'), true);
  assert.equal(source.includes('flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden'), true);
  assert.equal(source.includes('content-workbench-body route-transition-page'), true);
  assert.equal(styleSource.includes('.content-workbench-body'), true);
  assert.equal(styleSource.includes('overflow-y: auto'), true);
  assert.equal(source.includes('border-r border-outline'), false);
  assert.equal(source.includes('bg-app-radial'), false);
  assert.equal(source.includes('OBS Console'), false);
  assert.equal(source.includes('Telemetry Atlas'), false);
  assert.equal(source.includes('统一可观测性控制面'), false);
  assert.equal(source.includes('Prod / CN-SHANGHAI-A'), false);
  assert.equal(source.includes('生产观测域'), false);
  assert.equal(source.includes('cn-sh-a'), false);
  assert.equal(source.includes('NovaObs for UCloud'), false);
  assert.equal(source.includes('UCloud Ops'), false);
  assert.equal(source.includes('mega-menu-panel'), true);
  assert.equal(source.includes('mega-menu-backdrop'), true);
});
