import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layoutSource = readFileSync(new URL('./K8sOpsLayout.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('./DashboardPage.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('./navigation.ts', import.meta.url), 'utf8');
const clusterSource = readFileSync(new URL('./ClusterPage.tsx', import.meta.url), 'utf8');
const namespaceSource = readFileSync(new URL('./NamespacePage.tsx', import.meta.url), 'utf8');
const resourceSource = readFileSync(new URL('./ResourcePage.tsx', import.meta.url), 'utf8');
const deploymentHistorySource = readFileSync(new URL('./DeploymentHistoryPage.tsx', import.meta.url), 'utf8');
const auditSource = readFileSync(new URL('./AuditPage.tsx', import.meta.url), 'utf8');
const certificateSource = readFileSync(new URL('./CertificatePage.tsx', import.meta.url), 'utf8');
const serviceAccountSource = readFileSync(new URL('./ServiceAccountPage.tsx', import.meta.url), 'utf8');
const rbacPageSource = readFileSync(new URL('./RbacPage.tsx', import.meta.url), 'utf8');
const kubeconfigSource = readFileSync(new URL('./KubeconfigPage.tsx', import.meta.url), 'utf8');
const templateSource = readFileSync(new URL('./TemplatePage.tsx', import.meta.url), 'utf8');

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

test('K8s 集群页面展示集群连接和来源上下文', () => {
  assert.equal(clusterSource.includes('集群列表'), true);
  assert.equal(clusterSource.includes('startorch'), true);
  assert.equal(clusterSource.includes('/api/v1/k8s/clusters'), true);
});

test('K8s 命名空间页面展示集群、来源和权限上下文', () => {
  assert.equal(namespaceSource.includes('命名空间列表'), true);
  assert.equal(namespaceSource.includes('cluster/prod'), true);
  assert.equal(namespaceSource.includes('NovaObs RBAC'), true);
  assert.equal(namespaceSource.includes('/api/v1/k8s/namespaces'), true);
});

test('K8s 资源页面展示完整资源身份字段', () => {
  assert.equal(resourceSource.includes('资源视图'), true);
  assert.equal(resourceSource.includes('API Version'), true);
  assert.equal(resourceSource.includes('UID'), true);
  assert.equal(resourceSource.includes('cluster/ns/api/kind/name/uid'), true);
});

test('K8s 部署历史和审计页面展示追踪上下文', () => {
  assert.equal(deploymentHistorySource.includes('部署历史'), true);
  assert.equal(deploymentHistorySource.includes('/api/v1/k8s/deployment-history'), true);
  assert.equal(auditSource.includes('操作审计'), true);
  assert.equal(auditSource.includes('Trace'), true);
  assert.equal(auditSource.includes('/api/v1/k8s/audit-events'), true);
});

test('K8s 证书中心只展示证书元数据和安全边界', () => {
  assert.equal(certificateSource.includes('证书中心'), true);
  assert.equal(certificateSource.includes('/api/v1/k8s/certificates'), true);
  assert.equal(certificateSource.includes('Fingerprint'), true);
  assert.equal(certificateSource.includes('Not After'), true);
  assert.equal(certificateSource.includes('密钥材料留在后端受控域'), true);
  assert.equal(certificateSource.includes('privateKey'), false);
  assert.equal(certificateSource.includes('private_key'), false);
});

test('K8s ServiceAccount 页面展示 RBAC 权限不足态和审计结果', () => {
  assert.equal(serviceAccountSource.includes('ServiceAccount'), true);
  assert.equal(serviceAccountSource.includes('/api/v1/k8s/service-accounts'), true);
  assert.equal(serviceAccountSource.includes('权限不足'), true);
  assert.equal(serviceAccountSource.includes('操作已落审计'), true);
  assert.equal(serviceAccountSource.includes('删除确认摘要'), true);
  assert.equal(serviceAccountSource.includes('不会在页面、日志或响应中展示 token'), true);
});

test('K8s RBAC 页面展示确认摘要、权限不足态和审计结果', () => {
  assert.equal(rbacPageSource.includes('RBAC'), true);
  assert.equal(rbacPageSource.includes('/api/v1/k8s/rbac/roles'), true);
  assert.equal(rbacPageSource.includes('/api/v1/k8s/rbac/bindings'), true);
  assert.equal(rbacPageSource.includes('权限不足'), true);
  assert.equal(rbacPageSource.includes('操作已落审计'), true);
  assert.equal(rbacPageSource.includes('删除确认摘要'), true);
});

test('K8s Kubeconfig 页面展示 Secret 元数据、权限不足态和审计导出', () => {
  assert.equal(kubeconfigSource.includes('Kubeconfig'), true);
  assert.equal(kubeconfigSource.includes('Secret 元数据'), true);
  assert.equal(kubeconfigSource.includes('权限不足'), true);
  assert.equal(kubeconfigSource.includes('审计导出'), true);
  assert.equal(kubeconfigSource.includes('普通响应只返回 Secret 元数据'), true);
});

test('K8s 模板页面展示变量摘要、权限不足态和审计结果', () => {
  assert.equal(templateSource.includes('模板管理'), true);
  assert.equal(templateSource.includes('/api/v1/k8s/templates'), true);
  assert.equal(templateSource.includes('变量摘要'), true);
  assert.equal(templateSource.includes('权限不足'), true);
  assert.equal(templateSource.includes('操作已落审计'), true);
  assert.equal(templateSource.includes('删除确认摘要'), true);
  assert.equal(templateSource.includes('rendered_yaml'), true);
});
