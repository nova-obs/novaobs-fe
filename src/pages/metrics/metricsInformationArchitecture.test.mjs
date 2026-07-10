import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routes = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');
const moduleRail = readFileSync(new URL('../../components/navigation/ModuleRail.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('./MetricsLayout.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const explore = readFileSync(new URL('./MetricsExplorePage.tsx', import.meta.url), 'utf8');
const overview = readFileSync(new URL('./MetricsOverviewPage.tsx', import.meta.url), 'utf8');
const collection = readFileSync(new URL('./MetricsCollectionPage.tsx', import.meta.url), 'utf8');
const dashboards = readFileSync(new URL('./MetricsDashboardsPage.tsx', import.meta.url), 'utf8');
const alerts = readFileSync(new URL('./MetricsAlertsPage.tsx', import.meta.url), 'utf8');
const endpoints = readFileSync(new URL('./MetricsEndpointsPage.tsx', import.meta.url), 'utf8');

test('Metrics 路由使用 app/routes.tsx 单一路由入口且不保留 monitoring 兼容路径', () => {
  assert.equal(existsSync(new URL('../../routes.tsx', import.meta.url)), false);
	assert.match(routes, /path: '\/products\/:productId\/services\/:serviceId\/metrics'.*element: <MetricsLayout \/>/s);
	assert.match(routes, /index: true, title: '指标查询', element: <ServiceMetricsIndexRedirect \/>/);
  assert.doesNotMatch(routes, /path: '\/monitoring'/);
  assert.doesNotMatch(routes, /<MonitoringPage \/>/);
});

test('Metrics rail 顺序稳定并使用 ModuleWorkbench 非重挂载工作台', () => {
  assert.match(moduleRail, /'metrics'/);
  assert.match(layout, /ModuleWorkbench/);
  assert.match(layout, /module="metrics"/);
  assert.doesNotMatch(layout, /remountOnPathChange/);
  assert.doesNotMatch(layout, /label: '指标告警'.*end: true/);
  assert.deepEqual(
    Array.from(layout.matchAll(/label: '([^']+)'/g)).map((match) => match[1]),
    ['指标查询', '指标告警', 'Dashboard', '采集接入', '监控总览', '接入端点'],
  );
});

test('Metrics Explore 以路径中的产品与服务作为固定查询作用域', () => {
  assert.match(explore, /useQuery/);
  assert.match(explore, /metricsApi\.getWorkspace/);
	assert.match(explore, /useParams/);
	assert.match(explore, /productId/);
	assert.match(explore, /serviceId/);
  assert.match(explore, /当前绑定/);
  assert.match(explore, /labelMatch/);
  assert.match(explore, /basePromQL/);
  assert.match(explore, /activeTenant/);
  assert.match(explore, /尚未绑定指标端点/);
  assert.match(explore, /创建指标告警/);
	assert.match(explore, /const base = `\/products\/\$\{encodeURIComponent\(productId\)\}\/services\/\$\{encodeURIComponent\(serviceId\)\}\/metrics`/);
	assert.match(explore, /navigate\(`\$\{base\}\/alerts\/new`/);
  assert.match(explore, /vmuiURL/);
  assert.match(explore, /vmui 查询面板/);
  assert.doesNotMatch(explore, /mock/i);
});

test('Metrics API 只保留真实资源契约，不在前端伪造数据', () => {
  assert.match(api, /MetricsWorkspace/);
  assert.match(api, /MetricEndpoint/);
  assert.match(api, /MetricServiceBinding/);
  assert.match(api, /label_match \?\? binding\.labelMatch/);
  assert.match(api, /raw\.binding/);
  assert.match(api, /binding\.tenant/);
  assert.match(api, /base_promql/);
  assert.match(api, /urls\.query_url/);
	assert.match(api, /apiRequest<any>\(`\/products\/\$\{encodeURIComponent\(productId\)\}\/services\/\$\{encodeURIComponent\(serviceId\)\}\/metrics\/workspace/);
  assert.doesNotMatch(api, /mock/i);
});

test('Metrics 待接入页面使用控制台面板、表格或真实空态', () => {
  for (const source of [overview, collection, dashboards, alerts, endpoints]) {
    assert.match(source, /console-panel/);
    assert.doesNotMatch(source, /hero/i);
    assert.doesNotMatch(source, /gradient/i);
  }
  assert.match(overview, /metricsApi\.getWorkspace/);
  assert.match(overview, /api\.getMetricsAlertRules/);
  assert.match(overview, /refetchInterval/);
  assert.match(collection, /metricsApi\.listServiceBindings/);
  assert.match(collection, /metricsApi\.createServiceBinding/);
  assert.doesNotMatch(dashboards, /searchGrafanaDashboards/);
  assert.doesNotMatch(api, /\bfetch\(/);
  assert.match(dashboards, /grafanaEndpoint/);
  assert.match(alerts, /api\.getMetricsAlertRules/);
  assert.match(alerts, /暂无指标告警规则/);
	assert.match(endpoints, /metricsApi\.getWorkspace/);
  assert.match(endpoints, /metricsApi\.testEndpoint/);
});
