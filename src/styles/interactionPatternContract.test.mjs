import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const servicesPage = readFileSync(new URL('../pages/services/ServicesPage.tsx', import.meta.url), 'utf8');
const agentDetailPage = readFileSync(new URL('../pages/agents/AgentDetailPage.tsx', import.meta.url), 'utf8');
const logsAgentsPage = readFileSync(new URL('../pages/logs/LogsAgentsPage.tsx', import.meta.url), 'utf8');
const k8sDashboardPage = readFileSync(new URL('../pages/k8s/DashboardPage.tsx', import.meta.url), 'utf8');
const k8sAuditPage = readFileSync(new URL('../pages/k8s/AuditPage.tsx', import.meta.url), 'utf8');
const k8sLayout = readFileSync(new URL('../pages/k8s/K8sOpsLayout.tsx', import.meta.url), 'utf8');
const platformAccessPage = [
  '../pages/platform/PlatformAccessAdminPage.tsx',
  '../pages/platform/PlatformAccessForms.tsx',
  '../pages/platform/PlatformAccessWorkspaces.tsx',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');

test('全站具备公司控制台式工作区、工具栏、详情栏和固定动作语义', () => {
  for (const className of [
    '.console-workbench',
    '.console-resource-list',
    '.console-selected-row',
    '.console-detail-rail',
    '.console-action-bar',
    '.console-toolbar-group',
    '.console-split-workbench',
    '.console-summary-strip',
    '.console-inspector',
    '.console-table-action',
    '.console-panel-body',
  ]) {
    assert.match(css, new RegExp(className.replace('.', '\\.')));
  }
});

test('全站具备表单反馈、图标动作、加载骨架、危险操作和审计语义', () => {
  for (const className of [
    '.console-field',
    '.console-field-label',
    '.console-field-help',
    '.console-field-error',
    '.console-icon-button',
    '.console-skeleton',
    '.console-danger-zone',
    '.console-audit-meta',
  ]) {
    assert.match(css, new RegExp(className.replace('.', '\\.')));
  }
});

test('产品与服务采用产品服务树表、按需抽屉和可发现的危险操作', () => {
  assert.match(servicesPage, /console-resource-list/);
  assert.match(servicesPage, /ProductServiceRows/);
  assert.match(servicesPage, /ServiceDetailDrawer/);
  assert.match(servicesPage, /ProductIntegrationDrawer/);
  assert.match(servicesPage, /确认归档产品/);
  assert.match(servicesPage, /确认归档服务/);
  assert.doesNotMatch(servicesPage, /ProductTab/);
});

test('Agent 与 Logs 运行页面展示连续上下文和按需详情', () => {
  assert.match(agentDetailPage, /连接状态/);
  assert.match(agentDetailPage, /高级诊断/);
  assert.match(agentDetailPage, /<details/);
  assert.match(logsAgentsPage, /console-workbench/);
  assert.match(logsAgentsPage, /aria-label="采集路由"/);
  assert.match(logsAgentsPage, /仅看异常/);
  assert.match(logsAgentsPage, /查看配置/);
  assert.match(css, /\.console-drawer-panel/);
});

test('K8s 与平台 IAM 从指标卡墙收敛为工具栏、工程表格和轻量上下文导航', () => {
  assert.match(k8sDashboardPage, /console-toolbar/);
  assert.match(k8sDashboardPage, /console-resource-list/);
  assert.match(k8sDashboardPage, /console-audit-meta/);
  assert.doesNotMatch(k8sDashboardPage, /ClusterNode/);
  assert.match(k8sAuditPage, /console-skeleton/);
  assert.match(k8sAuditPage, /console-empty-state/);
  assert.match(k8sLayout, /K8s 运维导航/);
  assert.match(k8sLayout, /k8s-context-groups/);
  assert.match(k8sLayout, /K8sGroupMenu/);
  assert.match(k8sLayout, /K8s 功能选择/);
  assert.doesNotMatch(k8sLayout, /k8s-context-items/);
  assert.doesNotMatch(k8sLayout, /<aside/);
  assert.match(platformAccessPage, /console-workbench/);
  assert.match(platformAccessPage, /console-drawer-panel/);
  assert.match(platformAccessPage, /console-table-action-danger/);
});
