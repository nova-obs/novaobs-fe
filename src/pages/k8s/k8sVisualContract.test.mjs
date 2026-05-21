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
const deploymentSource = readFileSync(new URL('./DeploymentPage.tsx', import.meta.url), 'utf8');
const terminalSource = readFileSync(new URL('./TerminalPage.tsx', import.meta.url), 'utf8');
const userSource = readFileSync(new URL('./UserPage.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');

test('K8s 运维模块使用专业二级导航和运维信号', () => {
  assert.equal(layoutSource.includes('K8s 运维'), true);
  assert.equal(layoutSource.includes('Prod / CN-SHANGHAI-A'), true);
  assert.equal(navigationSource.includes('访问控制'), true);
  assert.equal(navigationSource.includes('证书中心'), true);
  assert.equal(navigationSource.includes('受控终端'), true);
});

test('K8s Dashboard 展示来源、时间窗口、同步和审计上下文', () => {
  assert.equal(dashboardSource.includes('startorch'), true);
  assert.equal(dashboardSource.includes('最近 15 分钟'), true);
  assert.equal(dashboardSource.includes('配置状态'), true);
  assert.equal(dashboardSource.includes('操作审计'), true);
  assert.equal(dashboardSource.includes('k8sApi.listClusters'), true);
  assert.equal(dashboardSource.includes('k8sApi.listAuditEvents'), true);
  assert.equal(dashboardSource.includes('resourceRows'), false);
  assert.equal(dashboardSource.includes('eventRows'), false);
});

test('K8s 集群页面展示集群连接和来源上下文', () => {
  assert.equal(clusterSource.includes('集群列表'), true);
  assert.equal(clusterSource.includes('集群登记'), true);
  assert.equal(clusterSource.includes('删除元数据'), true);
  assert.equal(clusterSource.includes('fallbackClusters'), false);
  assert.equal(clusterSource.includes('startorch baseline'), false);
  assert.equal(clusterSource.includes("useState('prod')"), false);
  assert.equal(clusterSource.includes("useState('prod-core')"), false);
  assert.equal(clusterSource.includes('/api/v1/k8s/clusters'), true);
  assert.equal(clusterSource.includes('集群凭据'), true);
  assert.equal(clusterSource.includes('凭据录入'), true);
  assert.equal(clusterSource.includes('轮换'), true);
  assert.equal(clusterSource.includes('/api/v1/k8s/cluster-credentials'), true);
  assert.equal(clusterSource.includes('集群凭据 API 暂未连接'), false);
  assert.equal(clusterSource.includes('kubeconfig'), true);
  assert.equal(clusterSource.includes('不在页面回显'), true);
});

test('K8s 用户管理页面接入真实 RBAC subject 数据面', () => {
  assert.equal(routeSource.includes('K8sPlaceholderPage'), false);
  assert.equal(userSource.includes('用户管理'), true);
  assert.equal(userSource.includes('k8sApi.listClusters'), true);
  assert.equal(userSource.includes('k8sApi.listNamespaces'), true);
  assert.equal(userSource.includes('k8sApi.listRBACBindings'), true);
  assert.equal(userSource.includes('平台用户映射'), true);
  assert.equal(userSource.includes('RoleBinding'), true);
  assert.equal(userSource.includes('后续会按 startorch'), false);
});

test('K8s 命名空间页面展示集群、来源和权限上下文', () => {
  assert.equal(namespaceSource.includes('命名空间列表'), true);
  assert.equal(namespaceSource.includes('集群选择'), true);
  assert.equal(namespaceSource.includes('请先在集群管理中登记集群'), true);
  assert.equal(namespaceSource.includes('cluster/prod'), false);
  assert.equal(namespaceSource.includes('NovaObs RBAC'), true);
  assert.equal(namespaceSource.includes('/api/v1/k8s/namespaces'), true);
});

test('K8s 资源页面展示完整资源身份字段', () => {
  assert.equal(resourceSource.includes('资源视图'), true);
  assert.equal(resourceSource.includes('集群选择'), true);
  assert.equal(resourceSource.includes('命名空间选择'), true);
  assert.equal(resourceSource.includes('请先选择集群和命名空间'), true);
  assert.equal(resourceSource.includes('API Version'), true);
  assert.equal(resourceSource.includes('UID'), true);
  assert.equal(resourceSource.includes('cluster/ns/api/kind/name/uid'), true);
  assert.equal(resourceSource.includes('资源详情'), true);
  assert.equal(resourceSource.includes('YAML 预览'), true);
  assert.equal(resourceSource.includes('Pod 日志'), true);
  assert.equal(resourceSource.includes('容器选择'), true);
  assert.equal(resourceSource.includes('containerOptions'), true);
  assert.equal(resourceSource.includes('命名空间读取失败'), true);
  assert.equal(resourceSource.includes('资源 API 暂未连接'), false);
});

test('K8s 部署历史和审计页面展示追踪上下文', () => {
  assert.equal(deploymentHistorySource.includes('部署历史'), true);
  assert.equal(deploymentHistorySource.includes('/api/v1/k8s/deployment-history'), true);
  assert.equal(deploymentHistorySource.includes('k8sApi.listClusters'), true);
  assert.equal(deploymentHistorySource.includes('k8sApi.listNamespaces'), true);
  assert.equal(deploymentHistorySource.includes("listDeploymentHistory('prod')"), false);
  assert.equal(deploymentHistorySource.includes('cluster/prod'), false);
  assert.equal(auditSource.includes('操作审计'), true);
  assert.equal(auditSource.includes('Trace'), true);
  assert.equal(auditSource.includes('/api/v1/k8s/audit-events'), true);
  assert.equal(auditSource.includes('k8sApi.listClusters'), true);
  assert.equal(auditSource.includes('k8sApi.listNamespaces'), true);
  assert.equal(auditSource.includes("listAuditEvents('prod')"), false);
  assert.equal(auditSource.includes('cluster/prod'), false);
});

test('K8s 证书中心只展示证书元数据和安全边界', () => {
  assert.equal(certificateSource.includes('证书中心'), true);
  assert.equal(certificateSource.includes('k8sApi.listCertificates'), true);
  assert.equal(certificateSource.includes('集群选择'), true);
  assert.equal(certificateSource.includes('命名空间选择'), true);
  assert.equal(certificateSource.includes('DEFAULT_CLUSTER'), false);
  assert.equal(certificateSource.includes('DEFAULT_NAMESPACE'), false);
  assert.equal(certificateSource.includes('DEFAULT_CERTIFICATE'), false);
  assert.equal(certificateSource.includes('Fingerprint'), true);
  assert.equal(certificateSource.includes('Not After'), true);
  assert.equal(certificateSource.includes('密钥材料留在后端受控域'), true);
  assert.equal(certificateSource.includes('证书写操作'), true);
  assert.equal(certificateSource.includes('操作已落审计'), true);
  assert.equal(certificateSource.includes('删除确认摘要'), true);
  assert.equal(certificateSource.includes('privateKey'), false);
  assert.equal(certificateSource.includes('private_key'), false);
});

test('K8s ServiceAccount 页面展示 RBAC 权限不足态和审计结果', () => {
  assert.equal(serviceAccountSource.includes('ServiceAccount'), true);
  assert.equal(serviceAccountSource.includes('k8sApi.listServiceAccounts'), true);
  assert.equal(serviceAccountSource.includes('集群选择'), true);
  assert.equal(serviceAccountSource.includes('命名空间选择'), true);
  assert.equal(serviceAccountSource.includes('DEFAULT_CLUSTER'), false);
  assert.equal(serviceAccountSource.includes('DEFAULT_NAMESPACE'), false);
  assert.equal(serviceAccountSource.includes("useState('orders-reader')"), false);
  assert.equal(serviceAccountSource.includes('权限不足'), true);
  assert.equal(serviceAccountSource.includes('操作已落审计'), true);
  assert.equal(serviceAccountSource.includes('删除确认摘要'), true);
  assert.equal(serviceAccountSource.includes('不会在页面、日志或响应中展示 token'), true);
});

test('K8s RBAC 页面展示确认摘要、权限不足态和审计结果', () => {
  assert.equal(rbacPageSource.includes('RBAC'), true);
  assert.equal(rbacPageSource.includes('k8sApi.listRBACRoles'), true);
  assert.equal(rbacPageSource.includes('k8sApi.listRBACBindings'), true);
  assert.equal(rbacPageSource.includes('集群选择'), true);
  assert.equal(rbacPageSource.includes('命名空间选择'), true);
  assert.equal(rbacPageSource.includes('DEFAULT_CLUSTER'), false);
  assert.equal(rbacPageSource.includes('DEFAULT_NAMESPACE'), false);
  assert.equal(rbacPageSource.includes("useState('orders-reader')"), false);
  assert.equal(rbacPageSource.includes('权限不足'), true);
  assert.equal(rbacPageSource.includes('操作已落审计'), true);
  assert.equal(rbacPageSource.includes('删除确认摘要'), true);
});

test('K8s Kubeconfig 页面展示 Secret 元数据、权限不足态和审计导出', () => {
  assert.equal(kubeconfigSource.includes('Kubeconfig'), true);
  assert.equal(kubeconfigSource.includes('k8sApi.listServiceAccounts'), true);
  assert.equal(kubeconfigSource.includes('集群选择'), true);
  assert.equal(kubeconfigSource.includes('命名空间选择'), true);
  assert.equal(kubeconfigSource.includes('ServiceAccount 选择'), true);
  assert.equal(kubeconfigSource.includes('DEFAULT_CLUSTER'), false);
  assert.equal(kubeconfigSource.includes('DEFAULT_NAMESPACE'), false);
  assert.equal(kubeconfigSource.includes("useState('orders-reader')"), false);
  assert.equal(kubeconfigSource.includes('Secret 元数据'), true);
  assert.equal(kubeconfigSource.includes('权限不足'), true);
  assert.equal(kubeconfigSource.includes('审计导出'), true);
  assert.equal(kubeconfigSource.includes('普通响应只返回 Secret 元数据'), true);
});

test('K8s 模板页面展示变量摘要、权限不足态和审计结果', () => {
  assert.equal(templateSource.includes('模板管理'), true);
  assert.equal(templateSource.includes('/api/v1/k8s/templates'), true);
  assert.equal(templateSource.includes('k8sApi.listResources'), true);
  assert.equal(templateSource.includes('集群选择'), true);
  assert.equal(templateSource.includes('命名空间选择'), true);
  assert.equal(templateSource.includes('资源参考'), true);
  assert.equal(templateSource.includes("useState('orders-deployment')"), false);
  assert.equal(templateSource.includes("return 'orders-api'"), false);
  assert.equal(templateSource.includes("return 'orders'"), false);
  assert.equal(templateSource.includes('DEFAULT_YAML'), false);
  assert.equal(templateSource.includes('deployment-baseline'), false);
  assert.equal(templateSource.includes('sample'), false);
  assert.equal(templateSource.includes('模板 API 暂未连接'), false);
  assert.equal(templateSource.includes('变量摘要'), true);
  assert.equal(templateSource.includes('权限不足'), true);
  assert.equal(templateSource.includes('操作已落审计'), true);
  assert.equal(templateSource.includes('删除确认摘要'), true);
  assert.equal(templateSource.includes('rendered_yaml'), true);
});

test('K8s 发布部署页面展示完整资源身份、高风险确认和审计结果', () => {
  assert.equal(deploymentSource.includes('发布部署'), true);
  assert.equal(deploymentSource.includes('k8sApi.listClusters'), true);
  assert.equal(deploymentSource.includes('k8sApi.listNamespaces'), true);
  assert.equal(deploymentSource.includes('k8sApi.listResources'), true);
  assert.equal(deploymentSource.includes('k8sApi.listDeploymentHistory'), true);
  assert.equal(deploymentSource.includes('k8sApi.previewDeployment'), true);
  assert.equal(deploymentSource.includes('DEFAULT_CLUSTER'), false);
  assert.equal(deploymentSource.includes('DEFAULT_IDENTITY'), false);
  assert.equal(deploymentSource.includes('orders-api'), false);
  assert.equal(deploymentSource.includes("namespace: 'orders'"), false);
  assert.equal(deploymentSource.includes('cluster/prod'), false);
  assert.equal(deploymentSource.includes('高风险确认'), true);
  assert.equal(deploymentSource.includes('权限不足'), true);
  assert.equal(deploymentSource.includes('操作已落审计'), true);
  assert.equal(deploymentSource.includes('api_version'), true);
  assert.equal(deploymentSource.includes('uid'), true);
  assert.equal(deploymentSource.includes('预览差异'), true);
  assert.equal(deploymentSource.includes('confirmationToken'), true);
  assert.equal(deploymentSource.includes('previewId'), true);
  assert.equal(deploymentSource.includes('canApplyConfirmedPreview'), true);
  assert.equal(deploymentSource.includes('k8sApi.previewDeleteDeployment'), true);
  assert.equal(deploymentSource.includes('deletePreviewPlan'), true);
});

test('K8s 受控终端页面展示只读策略、权限不足态和审计结果', () => {
  assert.equal(terminalSource.includes('受控终端'), true);
  assert.equal(terminalSource.includes('/api/v1/k8s/terminal/exec'), true);
  assert.equal(terminalSource.includes('k8sApi.listClusters'), true);
  assert.equal(terminalSource.includes('k8sApi.listNamespaces'), true);
  assert.equal(terminalSource.includes('k8sApi.listResources'), true);
  assert.equal(terminalSource.includes('集群选择'), true);
  assert.equal(terminalSource.includes('命名空间选择'), true);
  assert.equal(terminalSource.includes('资源参考'), true);
  assert.equal(terminalSource.includes("useState('prod')"), false);
  assert.equal(terminalSource.includes("useState('orders')"), false);
  assert.equal(terminalSource.includes('orders-api'), false);
  assert.equal(terminalSource.includes('lastTemplateCommand'), true);
  assert.equal(terminalSource.includes('syncTemplateCommandForTarget'), true);
  assert.equal(terminalSource.includes('setResult(null)'), true);
  assert.equal(terminalSource.includes('只读 kubectl'), true);
  assert.equal(terminalSource.includes('命令模板'), true);
  assert.equal(terminalSource.includes('accepted / blocked'), true);
  assert.equal(terminalSource.includes('output_truncated'), true);
  assert.equal(terminalSource.includes('策略阻断'), true);
  assert.equal(terminalSource.includes('权限不足'), true);
  assert.equal(terminalSource.includes('audit_id'), true);
  assert.equal(terminalSource.includes('delete'), true);
  assert.equal(terminalSource.includes('port-forward'), true);
});
