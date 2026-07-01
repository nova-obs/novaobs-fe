import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const alertsSource = readFileSync(new URL('./AlertsPage.tsx', import.meta.url), 'utf8');

test('告警中心用单一工作台承载实例、策略和规则视图', () => {
  assert.equal(alertsSource.includes('AlertViewTabs'), true);
  assert.equal(alertsSource.includes("type AlertView = 'instances' | 'policies' | 'rules'"), true);
  assert.equal(alertsSource.includes('title="告警工作台"'), true);
  assert.equal(alertsSource.includes('title="告警实例"'), false);
  assert.equal(alertsSource.includes('title="通知策略"'), false);
  assert.equal(alertsSource.includes('title="规则列表"'), false);
});

test('告警状态更新和通知策略创建不在主页面平铺', () => {
  assert.equal(alertsSource.includes('AlertEventsDrawer'), true);
  assert.equal(alertsSource.includes('NotificationPolicyDrawer'), true);
  assert.equal(alertsSource.includes('role="dialog"'), true);
  assert.equal(alertsSource.includes('xl:grid-cols-[minmax(0,1fr)_360px]'), false);
  assert.equal(alertsSource.includes('DataPanel title="状态更新记录"'), false);
});
