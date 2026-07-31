import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Product Viewer 页面不暴露日志与指标写操作', () => {
  const logsAgents = source('../logs/LogsAgentsPage.tsx');
  const logsAlerts = source('../logs/LogsAlertsPage.tsx');
  const metricsIntegrations = source('../metrics/MetricsIntegrationsPage.tsx');
  const metricsAlerts = source('../metrics/MetricsAlertsPage.tsx');

  assert.match(logsAgents, /canMaintain \? <Link[^>]+agents\/new/);
  assert.match(logsAgents, /canMaintain=\{canMaintain\}/);
  assert.match(logsAlerts, /editorOpen && canMaintain/);
  assert.match(metricsIntegrations, /canMaintainProduct\(product\.id\)/);
  assert.match(metricsIntegrations, /disabled=\{!canMaintain \|\| updateMutation/);
  assert.match(metricsAlerts, /maintainableContexts/);
  assert.match(metricsAlerts, /editorOpen && editorAllowed/);
});
test('K8S 写入口只使用 Maintainer Namespace，资源视图保持只读', () => {
  const deployment = source('../k8s/DeploymentPage.tsx');
  const terminal = source('../k8s/TerminalPage.tsx');
  const resource = source('../k8s/ResourcePage.tsx');

  for (const content of [deployment, terminal]) {
    assert.match(content, /k8sNamespacesForLevel\(accessContext, activeClusterId, 'namespace-maintainer'\)/);
    assert.match(content, /hasBreakGlassAccess\(accessContext, activeClusterId\)/);
  }
  assert.match(resource, /资源视图为只读/);
  assert.doesNotMatch(resource, /useMutation|applyDeployment|deleteDeployment/);
});

test('Break Glass 使用后端 requested 和 approved 状态并进入有效访问上下文', () => {
  const workspaces = source('./PlatformAccessWorkspaces.tsx');
  const accessApi = source('./accessApi.ts');

  assert.match(workspaces, /grant\.status === 'requested'/);
  assert.match(workspaces, /grant\.status === 'approved'/);
  assert.doesNotMatch(workspaces, /grant\.status === 'pending'|grant\.status === 'active'/);
  assert.match(accessApi, /k8s_break_glass/);
  assert.match(accessApi, /k8sBreakGlass:/);
});
