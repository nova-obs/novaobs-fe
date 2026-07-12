import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const routes = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('./MetricsLayout.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const environments = readFileSync(new URL('./MetricsEnvironmentsPage.tsx', import.meta.url), 'utf8');
const overview = readFileSync(new URL('./MetricsOverviewPage.tsx', import.meta.url), 'utf8');
const k8sAccess = readFileSync(new URL('../k8s/ObservabilityAccessPage.tsx', import.meta.url), 'utf8');

test('Metrics 以总览、指标监控和环境接入形成三条用户路径', () => {
  assert.deepEqual(Array.from(layout.matchAll(/label: '([^']+)'/g)).map((item) => item[1]), ['监控总览', '指标监控', '环境接入']);
  assert.match(routes, /path: 'overview'.*MetricsOverviewPage/);
  assert.match(routes, /path: 'monitoring'.*MetricsMonitoringPage/);
  assert.match(routes, /path: 'environments'.*MetricsEnvironmentsPage/);
  assert.match(routes, /path: '\/products\/:productId\/services\/:serviceId\/metrics\/endpoints'.*Navigate to="\/observability\/endpoints\/metrics"/);
  assert.doesNotMatch(routes, /path: '\/products\/:productId\/services\/:serviceId\/metrics'[^\n]*MetricsLayout/);
});

test('Metrics 页面集合只保留总览、指标监控和环境接入', () => {
  const pages = readdirSync(new URL('.', import.meta.url)).filter((file) => file.endsWith('Page.tsx')).sort();
  assert.deepEqual(pages, ['MetricsEnvironmentsPage.tsx', 'MetricsMonitoringPage.tsx', 'MetricsOverviewPage.tsx']);
  assert.doesNotMatch(k8sAccess, /runtime.*metrics|MetricsCollectorAccessPanel|publishInfrastructureRuntime/);
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
