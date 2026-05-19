import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layoutSource = readFileSync(new URL('./K8sOpsLayout.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('./DashboardPage.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('./navigation.ts', import.meta.url), 'utf8');

test('K8s 运维模块使用专业二级导航和运维信号', () => {
  assert.equal(layoutSource.includes('K8s 运维'), true);
  assert.equal(layoutSource.includes('Prod / CN-SHANGHAI-A'), true);
  assert.equal(navigationSource.includes('访问控制'), true);
  assert.equal(navigationSource.includes('证书中心'), true);
});

test('K8s Dashboard 展示来源、时间窗口、同步和审计上下文', () => {
  assert.equal(dashboardSource.includes('startorch'), true);
  assert.equal(dashboardSource.includes('最近 15 分钟'), true);
  assert.equal(dashboardSource.includes('配置状态'), true);
  assert.equal(dashboardSource.includes('操作审计'), true);
});
