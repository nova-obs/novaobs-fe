import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles/index.css', import.meta.url), 'utf8');
const routesSource = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');
const servicesSource = readFileSync(new URL('../services/ServicesPage.tsx', import.meta.url), 'utf8');

test('资源列表工具栏具备左操作右检索语义', () => {
  assert.match(css, /\.console-list-toolbar/);
  assert.match(css, /\.console-list-toolbar-actions/);
  assert.match(css, /\.console-list-toolbar-search/);
});

test('采集路由工具栏先选择路由，再放刷新、新增', () => {
  const toolbarIndex = routesSource.indexOf('console-panel-header shrink-0');
  const selectorIndex = routesSource.indexOf('logs-route-selector', toolbarIndex);
  const refreshIndex = routesSource.indexOf('刷新', toolbarIndex);
  const createIndex = routesSource.indexOf('创建采集路由', toolbarIndex);

  assert.ok(toolbarIndex >= 0);
  assert.ok(selectorIndex > toolbarIndex);
  assert.ok(refreshIndex > selectorIndex);
  assert.ok(createIndex > refreshIndex);
  assert.match(routesSource, /LogsEntitySelector<LogRouteView>/);
  assert.match(routesSource, /function selectRoute\(routeId: string\)/);
  assert.doesNotMatch(routesSource, /const \[routeQuery, setRouteQuery\]/);
  assert.doesNotMatch(routesSource, /搜索采集路由/);
});

test('日志告警工具栏先选择服务，再放搜索、刷新、新增', () => {
  const toolbarIndex = alertsSource.indexOf('console-panel-header shrink-0');
  const serviceIndex = alertsSource.indexOf('logs-alert-service-selector', toolbarIndex);
  const searchIndex = alertsSource.indexOf('搜索告警规则', toolbarIndex);
  const refreshIndex = alertsSource.indexOf('刷新', toolbarIndex);
  const createIndex = alertsSource.indexOf('创建告警', toolbarIndex);

  assert.ok(toolbarIndex >= 0);
  assert.ok(serviceIndex > toolbarIndex);
  assert.ok(searchIndex > serviceIndex);
  assert.ok(refreshIndex > searchIndex);
  assert.ok(createIndex > refreshIndex);
  assert.match(alertsSource, /className="relative w-full md:w-80"/);
  assert.doesNotMatch(alertsSource, /console-list-toolbar-actions/);
  assert.match(alertsSource, /const \[ruleQuery, setRuleQuery\] = useState\(''\)/);
  assert.match(alertsSource, /filteredRules/);
});

test('服务目录复用左操作右检索工具栏', () => {
  const toolbarIndex = servicesSource.indexOf('console-list-toolbar');
  const createIndex = servicesSource.indexOf('新增服务', toolbarIndex);
  const refreshIndex = servicesSource.indexOf('刷新', toolbarIndex);
  const searchIndex = servicesSource.indexOf('名称 / CMDB ID / 业务 / 负责人', toolbarIndex);

  assert.ok(toolbarIndex >= 0);
  assert.ok(createIndex > toolbarIndex);
  assert.ok(refreshIndex > toolbarIndex);
  assert.ok(searchIndex > createIndex);
});
