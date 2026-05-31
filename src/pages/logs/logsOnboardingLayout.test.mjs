import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./LogsWorkspace.tsx', import.meta.url), 'utf8');
const exploreSource = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');
const agentsSource = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');

test('Logs 接入配置使用工具栏流程和集群维度工作台', () => {
  assert.equal(source.includes('logs-onboarding-toolbar'), true);
  assert.equal(source.includes('可用集群'), true);
  assert.equal(source.includes('kubeconfig / namespace / workload'), true);
  assert.equal(source.includes('logs-onboarding-action-bar'), true);
});

test('Logs 接入配置突出主操作而不是平均铺陈', () => {
  assert.equal(source.includes('接入配置'), true);
  assert.equal(source.includes('本次接入'), true);
  assert.equal(source.includes('预览配置'), true);
});

test('Logs 模块壳层使用专业工作台导航', () => {
  assert.equal(workspaceSource.includes('logs-workbench'), true);
  assert.equal(workspaceSource.includes('日志工作台'), true);
  assert.equal(workspaceSource.includes('VictoriaLogs'), true);
  assert.equal(workspaceSource.includes('15m'), true);
});

test('Logs 日志分析采用路由列表、查询区和详情面板', () => {
  assert.equal(exploreSource.includes('logs-explore-workbench'), true);
  assert.equal(exploreSource.includes('日志路由'), true);
  assert.equal(exploreSource.includes('LogQL / VictoriaLogs query'), true);
  assert.equal(exploreSource.includes('详情'), true);
  assert.equal(exploreSource.includes('创建告警'), true);
});

test('Logs Agent 和告警页面采用分栏工作台', () => {
  assert.equal(agentsSource.includes('logs-agents-workbench'), true);
  assert.equal(agentsSource.includes('实例状态'), true);
  assert.equal(agentsSource.includes('Remote Config'), true);
  assert.equal(alertsSource.includes('logs-alerts-workbench'), true);
  assert.equal(alertsSource.includes('日志告警规则'), true);
  assert.equal(alertsSource.includes('规则上下文'), true);
});
