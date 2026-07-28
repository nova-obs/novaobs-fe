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
const formatDemo = readFileSync(new URL('./LogsFormatDemoPage.tsx', import.meta.url), 'utf8');
const servicePicker = readFileSync(new URL('./ServicePickerPanel.tsx', import.meta.url), 'utf8');

test('Logs 保留服务级入口并把下游端点迁移到可观测性领域入口', () => {
  assert.doesNotMatch(routes, /path: 'targets'/);
  assert.doesNotMatch(workspace, /\/logs\/targets/);
  assert.doesNotMatch(workspace, /日志目标/);
  assert.match(routes, /path: 'agents\/new'/);
  assert.match(routes, /path: 'agents\/:id\/edit'/);
	assert.match(routes, /path: 'onboarding'.*Navigate to="\.\.\/agents\/new"/);
  assert.match(routes, /path: 'alerts\/new'/);
	assert.match(routes, /path: 'alerts\/:id'/);
  assert.match(routes, /path: 'endpoints'/);
	assert.match(routes, /path: '\/observability\/endpoints\/logs'.*ObservabilitySettingsPage key="logs-endpoints" domain="logs"/);
	assert.match(routes, /path: '\/observability\/endpoints\/metrics'.*ObservabilitySettingsPage key="metrics-endpoints" domain="metrics"/);
	assert.match(routes, /path: '\/observability\/endpoints'.*Navigate to="\/observability\/endpoints\/logs"/);
  assert.doesNotMatch(workspace, /entry: 'endpoints'/);
});

test('采集路由保留任务页，日志告警新增编辑进入列表表单抽屉', () => {
  assert.match(primitives, /export function LogsTaskPageHeader/);
  assert.match(primitives, /logs-task-page-header flex shrink-0/);
  assert.doesNotMatch(primitives, /mt-2 flex flex-wrap items-center/);
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

test('日志告警固定使用产品服务路径中的服务上下文', () => {
	assert.match(alerts, /useParams/);
	assert.match(alerts, /find\(\(item\) => item\.id === serviceId\)/);
  assert.match(alerts, /logs-alert-service-selector/);
  assert.match(alerts, /selectedServiceRules/);
  assert.match(alerts, /alertServices/);
	assert.doesNotMatch(alerts, /useSearchParams/);
	assert.doesNotMatch(alerts, /setSelectedServiceId/);
  assert.doesNotMatch(alerts, /logs-alerts-service-list/);
  assert.doesNotMatch(alerts, /lg:grid-cols-\[280px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(alerts, /const logRules = rules;/);
});

test('采集路由使用单一工作面突出列表选择和当前路由功能', () => {
  assert.match(agents, /getRouteRuntimeStatus/);
  assert.match(agents, /预期目标/);
  assert.match(agents, /配置收敛/);
  assert.match(agents, /仅看异常/);
  assert.match(agents, /aria-label="采集路由工作区"/);
  assert.doesNotMatch(agents, /<LogsSection/);
  assert.doesNotMatch(agents, /采集路由列表/);
  assert.doesNotMatch(agents, /路由运行状态/);
});

test('VM 与 K8S 运行状态按执行器分型且不再读取手工 Endpoint', () => {
	assert.match(agents, /runtime\?\.targets/);
	assert.match(agents, /target\.installationId/);
	assert.match(agents, /target\.connectionStatus/);
	assert.doesNotMatch(agents, /target\.dataStatus/);
	assert.match(agents, /k8sRuntime/);
	assert.match(agents, /DaemonSet/);
	assert.doesNotMatch(agents, /listVMAgentEndpoints|地址可达|13133|source\.hostGroup/);
});

test('Logs 模块层只保留统一导航和服务作用域，不在业务页面重复实现入口', () => {
  assert.match(workspace, /ServiceScopedModuleWorkbench/);
  assert.doesNotMatch(workspace, /page-title module-navigation-title/);
  assert.doesNotMatch(workspace, /RefreshCw/);
  assert.doesNotMatch(workspace, /console-panel shrink-0/);
});

test('Logs 日志分析通过产品与服务两级上下文切换当前服务', () => {
  assert.match(explore, /<ServiceContextSelector/);
  assert.match(explore, /查询上下文/);
  assert.match(explore, /VictoriaLogs Endpoint/);
  assert.doesNotMatch(workspace, /选择当前服务/);
});

test('日志格式改造演示区分业务输出与平台补齐且不形成第二套发布路径', () => {
  assert.match(routes, /path: 'format-demo'.*LogsFormatDemoPage/);
  assert.doesNotMatch(workspace, /entry: 'format-demo'/);
  assert.match(formatDemo, /业务输出/);
  assert.match(formatDemo, /平台补齐/);
  assert.match(formatDemo, /仅在当前浏览器/);
  assert.match(formatDemo, /useServiceScope/);
  assert.doesNotMatch(formatDemo, /logsApi|api\./);
  assert.doesNotMatch(formatDemo, /发布|保存到服务/);
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
