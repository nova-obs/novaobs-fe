import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const routes = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('./MetricsLayout.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const environments = readFileSync(new URL('./MetricsEnvironmentsPage.tsx', import.meta.url), 'utf8');
const overview = readFileSync(new URL('./MetricsOverviewPage.tsx', import.meta.url), 'utf8');
const alerts = readFileSync(new URL('./MetricsAlertsPage.tsx', import.meta.url), 'utf8');
const k8sAccess = readFileSync(new URL('../k8s/ObservabilityAccessPage.tsx', import.meta.url), 'utf8');

test('Metrics 以总览、指标监控、指标告警和环境接入形成四条用户路径', () => {
  assert.deepEqual(Array.from(layout.matchAll(/label: '([^']+)'/g)).map((item) => item[1]), ['监控总览', '指标监控', '指标告警', '环境接入']);
  assert.match(routes, /path: 'overview'.*MetricsOverviewPage/);
  assert.match(routes, /path: 'monitoring'.*MetricsMonitoringPage/);
  assert.match(routes, /path: 'alerts'.*MetricsAlertsPage/);
  assert.match(routes, /path: 'environments'.*MetricsEnvironmentsPage/);
  assert.match(routes, /path: '\/products\/:productId\/services\/:serviceId\/metrics\/endpoints'.*Navigate to="\/observability\/endpoints\/metrics"/);
  assert.doesNotMatch(routes, /path: '\/products\/:productId\/services\/:serviceId\/metrics'[^\n]*MetricsLayout/);
});

test('Metrics 页面集合保留环境级指标告警工作台', () => {
  const pages = readdirSync(new URL('.', import.meta.url)).filter((file) => file.endsWith('Page.tsx')).sort();
  assert.deepEqual(pages, ['MetricsAlertsPage.tsx', 'MetricsEnvironmentsPage.tsx', 'MetricsMonitoringPage.tsx', 'MetricsOverviewPage.tsx']);
  assert.doesNotMatch(k8sAccess, /runtime.*metrics|MetricsCollectorAccessPanel|publishInfrastructureRuntime/);
});

test('指标告警使用环境和已连接写入目标作为唯一作用域', () => {
  assert.match(alerts, /queryKey: \['alerts', 'rules', 'metrics'\]/);
  assert.match(alerts, /api\.getAlertRules\(\{ signalType: 'metrics' \}\)/);
  assert.match(alerts, /platformApi\.listEnvironments/);
  assert.match(alerts, /metricsApi\.listIntegrations/);
  assert.match(alerts, /environment\.status === 'active'/);
  assert.match(alerts, /integration\.desiredState === 'connected'/);
  assert.match(alerts, /signalType: 'metrics'/);
  assert.match(alerts, /environmentId:/);
  assert.match(alerts, /endpointId: selectedContext\?\.integration\.destinationRef/);
  assert.match(alerts, /api\.testAlertRule/);
  assert.match(alerts, /api\.createAlertRule/);
  assert.match(alerts, /api\.updateAlertRule/);
  assert.match(alerts, /api\.disableAlertRule/);
  assert.match(alerts, /rule\.spec\.signalType !== 'metrics'/);
  assert.match(alerts, /!invalidRule && rule\?\.state === 'enabled'/);
  assert.match(alerts, /variables\.snapshot/);
  assert.match(alerts, /alert_test_required/);
  assert.match(alerts, /testExpiresAt > Date\.now\(\)/);
  assert.match(alerts, /disabled=\{mode === 'edit'\}/);
  assert.match(alerts, /event\.key === 'Escape'/);
  assert.match(alerts, /const loading = rulesQuery\.isLoading/);
  assert.match(alerts, /const error = rulesQuery\.error/);
  assert.match(alerts, /mode === 'create' \|\| Boolean\(rule && rule\.spec\.signalType === 'metrics'\)/);
  assert.match(alerts, /testResult\.compiledQuery/);
  assert.match(alerts, /testResult\.warnings/);
  assert.match(alerts, /role="dialog"/);
  assert.match(alerts, /暂无指标告警规则/);
  assert.doesNotMatch(alerts, /metricsBindingId|basePromQL|ServiceContextSelector/);
});

test('环境接入使用 Integration 和 SourceAccess，不暴露任意抓取目标配置', () => {
  assert.match(api, /MetricsIntegrationView/);
  assert.match(api, /MetricsSourceAccess/);
  assert.match(api, /\/metrics\/integrations/);
  assert.match(api, /\/metrics\/source-accesses/);
	assert.doesNotMatch(api, /scrape_path|infrastructure-targets/);
  assert.match(environments, /platformApi\.listEnvironments/);
  assert.match(environments, /metricsApi\.createIntegration/);
  assert.match(environments, /external_collector/);
  assert.match(environments, /managed_collector/);
});

test('Overview 对未验证信号明确显示未验证而不是伪造健康', () => {
  assert.match(overview, /缺失信号不会显示为 0/);
  assert.match(overview, /未验证/);
	assert.doesNotMatch(overview, /vmui|iframe/);
});
