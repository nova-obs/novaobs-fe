import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helpTipSource = readFileSync(new URL('./HelpTip.tsx', import.meta.url), 'utf8');
const endpointSource = readFileSync(new URL('../pages/platform/ObservabilitySettingsPage.tsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../pages/services/ServicesPage.tsx', import.meta.url), 'utf8');
const servicePickerSource = readFileSync(new URL('../pages/logs/ServicePickerPanel.tsx', import.meta.url), 'utf8');
const metricsEndpointSource = readFileSync(new URL('../pages/metrics/MetricsEndpointsPage.tsx', import.meta.url), 'utf8');
const metricsAlertSource = readFileSync(new URL('../pages/metrics/MetricsAlertsPage.tsx', import.meta.url), 'utf8');
const metricsDashboardSource = readFileSync(new URL('../pages/metrics/MetricsDashboardsPage.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('../pages/alerts/AlertsPage.tsx', import.meta.url), 'utf8');

test('帮助提示使用圆形问号并支持悬浮和键盘焦点', () => {
  assert.match(helpTipSource, /HelpCircle/);
  assert.match(helpTipSource, /rounded-full/);
  assert.match(helpTipSource, /aria-label/);
  assert.match(helpTipSource, /role="tooltip"/);
  assert.match(helpTipSource, /group-hover/);
  assert.match(helpTipSource, /group-focus-within/);
  assert.match(helpTipSource, /createPortal/);
  assert.match(helpTipSource, /max-w-\[calc\(100vw-1rem\)\]/);
  assert.match(helpTipSource, /spaceBelow < 240/);
  assert.match(helpTipSource, /translateY\(-100%\)/);
  assert.match(helpTipSource, /open \? setOpen\(false\) : show\(\)/);
});

test('告警关联资源解析失败时区分未配置并按需保留原始引用', () => {
  assert.match(alertsSource, /function ReferenceLabel/);
  assert.match(alertsSource, /引用不可解析/);
  assert.match(alertsSource, /<HelpTip content=\{`\$\{kind\}标识：\$\{value\}`\}/);
});

test('接入配置把分区说明收进帮助提示且不展示端点内部 ID', () => {
  assert.match(endpointSource, /<HelpTip content=\{description\}/);
  assert.doesNotMatch(endpointSource, /<EndpointFormSection[^>]+meta=/);
  assert.doesNotMatch(endpointSource, />\{endpoint\.id\}<\/div>/);
  assert.doesNotMatch(endpointSource, /<DetailCell label="端点 ID"/);
  assert.doesNotMatch(endpointSource, /const meta = mode === 'edit'/);
});

test('服务与观测入口不把内部 ID 当作列表或抽屉副标题', () => {
  assert.doesNotMatch(serviceSource, />\{service\.id\}<\/div>/);
  assert.doesNotMatch(serviceSource, />\{editingId \?\? 'create draft'\}<\/div>/);
  assert.doesNotMatch(servicePickerSource, />\{service\.id\}<\/div>/);
  assert.doesNotMatch(metricsEndpointSource, />\{endpoint\.id\}<\/div>/);
  assert.doesNotMatch(metricsAlertSource, />\{rule\.id\}<\/div>/);
  assert.doesNotMatch(metricsDashboardSource, />\{grafanaEndpoint\.id\}<\/div>/);
});
