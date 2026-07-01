import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('./LogsWorkspace.tsx', import.meta.url), 'utf8');
const primitives = readFileSync(new URL('./LogsPrimitives.tsx', import.meta.url), 'utf8');
const agents = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const onboarding = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const alertRule = readFileSync(new URL('./LogsAlertRulePage.tsx', import.meta.url), 'utf8');
const alerts = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');
const explore = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');
const servicePicker = readFileSync(new URL('./ServicePickerPanel.tsx', import.meta.url), 'utf8');

test('Logs 保留四个子入口并把创建更新归入父模块子路径', () => {
  assert.match(routes, /path: 'agents\/new'/);
  assert.match(routes, /path: 'agents\/:id\/edit'/);
  assert.match(routes, /path: 'onboarding'.*Navigate to="\/logs\/agents\/new"/);
  assert.match(routes, /path: 'alerts\/new'/);
  assert.match(routes, /path: 'alerts\/:id'/);
  assert.match(routes, /path: 'endpoints'/);
  assert.match(routes, /path: '\/observability\/endpoints'.*Navigate to="\/logs\/endpoints"/);
  assert.match(workspace, /to: '\/logs\/endpoints'/);
  assert.match(workspace, /label: '接入配置'/);
});

test('采集路由保留任务页，日志告警新增编辑进入列表表单抽屉', () => {
  assert.match(primitives, /export function LogsTaskPageHeader/);
  assert.doesNotMatch(primitives, /返回\{parentLabel\}/);
  assert.doesNotMatch(primitives, /parentTo/);
  assert.doesNotMatch(primitives, /parentLabel/);
  assert.doesNotMatch(primitives, /logs-task-page-header console-panel/);
  assert.match(onboarding, /<LogsTaskPageHeader/);
  assert.doesNotMatch(onboarding, /parentLabel="采集路由"/);
  assert.doesNotMatch(onboarding, /logs-onboarding-toolbar console-panel/);
  assert.match(routes, /path: 'alerts\/new'.*element: <LogsAlertsPage \/>/);
  assert.match(routes, /path: 'alerts\/:id'.*element: <LogsAlertsPage \/>/);
  assert.match(alerts, /LogsAlertRuleEditorDrawer/);
  assert.match(alertRule, /export function LogsAlertRuleEditorDrawer/);
  assert.match(alertRule, /console-drawer-panel/);
  assert.doesNotMatch(alertRule, /<LogsTaskPageHeader/);
});

test('采集路由使用单一工作面突出列表选择和当前路由功能', () => {
  assert.match(agents, /const \[routeView, setRouteView\] = useState<'overview' \| 'instances'>\('overview'\)/);
  assert.match(agents, />运行概览</);
  assert.match(agents, />Agent 实例</);
  assert.match(agents, /routeView === 'overview'/);
  assert.match(agents, /routeView === 'instances'/);
  assert.match(agents, /aria-label="采集路由工作区"/);
  assert.doesNotMatch(agents, /<LogsSection/);
  assert.doesNotMatch(agents, /采集路由列表/);
  assert.doesNotMatch(agents, /路由运行状态/);
});

test('Logs 模块层只保留导航，不和页面重复提供刷新工具条', () => {
  assert.match(workspace, /sr-only module-navigation-title/);
  assert.doesNotMatch(workspace, /page-title module-navigation-title/);
  assert.doesNotMatch(workspace, /RefreshCw/);
  assert.doesNotMatch(workspace, /console-panel shrink-0/);
});

test('Logs 页面不展示无决策价值的汇总计数和英文追加描述', () => {
  assert.doesNotMatch(agents, /运行中 \{routes\.filter/);
  assert.doesNotMatch(agents, /activeDomainRoutes/);
  assert.doesNotMatch(agents, /\{instances\.length\} instances/);
  assert.doesNotMatch(alerts, /已启用 \{enabledCount\} \/ 全部/);
  assert.doesNotMatch(explore, /\{routes\.length\} routes/);
  assert.doesNotMatch(onboarding, /serviceListMeta/);
  assert.doesNotMatch(servicePicker, /sourceServiceCount/);
  assert.doesNotMatch(servicePicker, /totalServiceCount/);
});
