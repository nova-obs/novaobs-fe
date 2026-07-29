import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const layoutSource = readFileSync(new URL('./K8sOpsLayout.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('./DashboardPage.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('./navigation.ts', import.meta.url), 'utf8');
const clusterSource = readFileSync(new URL('./ClusterPage.tsx', import.meta.url), 'utf8');
const platformClusterSource = readFileSync(new URL('../platform/PlatformK8sClustersPage.tsx', import.meta.url), 'utf8');
const namespaceSource = readFileSync(new URL('./NamespacePage.tsx', import.meta.url), 'utf8');
const resourceSource = readFileSync(new URL('./ResourcePage.tsx', import.meta.url), 'utf8');
const deploymentHistorySource = readFileSync(new URL('./DeploymentHistoryPage.tsx', import.meta.url), 'utf8');
const auditSource = readFileSync(new URL('./AuditPage.tsx', import.meta.url), 'utf8');
const templateSource = readFileSync(new URL('./TemplatePage.tsx', import.meta.url), 'utf8');
const deploymentSource = readFileSync(new URL('./DeploymentPage.tsx', import.meta.url), 'utf8');
const terminalSource = readFileSync(new URL('./TerminalPage.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');

test('K8s 运维模块使用可折叠垂直 Rail 承接 fleet 入口，并保留集群上下文横幅', () => {
  assert.equal(layoutSource.includes('K8s 运维'), true);
  assert.equal(layoutSource.includes('ModuleWorkbench'), true);
  assert.equal(layoutSource.includes('module="k8s"'), true);
  assert.equal(layoutSource.includes('showRail={!hasClusterContext}'), true);
  assert.equal(layoutSource.includes('FleetNavigation'), false);
  assert.equal(layoutSource.includes('page-title module-navigation-title'), false);
  assert.equal(layoutSource.includes('useParams'), true);
  assert.equal(layoutSource.includes('k8sApi.listClusters'), true);
  assert.equal(layoutSource.includes('hasClusterContext'), true);
  assert.equal(layoutSource.includes('ClusterContextNavigation'), true);
  assert.equal(layoutSource.includes('k8s-context-groups'), true);
  assert.equal(layoutSource.includes('k8s-context-items'), false);
  assert.equal(layoutSource.includes('K8sGroupMenu'), true);
  assert.equal(layoutSource.includes('openGroupId'), true);
  assert.equal(layoutSource.includes('K8s 功能选择'), true);
  assert.equal(layoutSource.includes('<optgroup'), true);
  assert.equal(layoutSource.includes("event.key === 'Escape'"), true);
  assert.equal(layoutSource.includes('aria-expanded'), true);
  assert.equal(layoutSource.includes('module-navigation-bar'), true);
  assert.equal(layoutSource.includes('返回集群列表'), false);
  assert.equal(layoutSource.includes('切换集群'), true);
  assert.equal(layoutSource.includes('.filter((item) => item.requiresCluster)'), true);
  assert.equal(layoutSource.includes('FleetTabs'), false);
  assert.equal(layoutSource.includes('ClusterWorkspaceBar'), false);
  assert.equal(layoutSource.includes('<aside'), false);
  assert.equal(layoutSource.includes('xl:grid-cols-[248px'), false);
  assert.equal(layoutSource.includes('k8s-account-session'), false);
  assert.equal(layoutSource.includes('AccountSessionPanel'), false);
  assert.equal(navigationSource.includes('访问控制'), false);
  assert.equal(layoutSource.includes("to: '/k8s/access'"), false);
  assert.equal(layoutSource.includes("label: '集群接入'"), false);
  assert.equal(navigationSource.includes('观测接入'), false);
  assert.equal(navigationSource.includes('证书中心'), false);
  assert.equal(navigationSource.includes('受控终端'), true);
});

test('K8s 普通工作台不承载平台级集群接入和观测运行时', () => {
  assert.equal(routeSource.includes("path: 'observability'"), false);
  assert.equal(routeSource.includes('K8sObservabilityRedirect'), false);
  assert.equal(layoutSource.includes('/k8s/observability'), false);
  assert.equal(navigationSource.includes("id: 'observability-entry'"), false);
  assert.equal(navigationSource.includes("id: 'cluster-credentials'"), false);
});

test('K8s Dashboard 展示来源、同步和审计上下文', () => {
  assert.equal(dashboardSource.includes('startorch'), false);
  assert.equal(dashboardSource.includes('最近 15 分钟'), false);
  assert.equal(dashboardSource.includes('配置状态'), true);
  assert.equal(dashboardSource.includes('操作审计'), true);
  assert.equal(dashboardSource.includes('集群策略'), true);
  assert.equal(dashboardSource.includes('useK8sOpsContext'), true);
  assert.equal(dashboardSource.includes('k8sAccessLevelForCluster'), true);
  assert.equal(dashboardSource.includes("accessLevel === 'namespace-maintainer'"), true);
  assert.equal(dashboardSource.includes('k8sApi.listAuditEvents'), true);
  assert.equal(dashboardSource.includes('resourceRows'), false);
  assert.equal(dashboardSource.includes('eventRows'), false);
});

test('K8s 集群页面只展示有效 Profile 可访问集群', () => {
  assert.equal(clusterSource.includes('可访问集群'), true);
  assert.equal(clusterSource.includes('useK8sOpsContext'), true);
  assert.equal(clusterSource.includes('k8sApi.listClusters'), false);
  assert.equal(clusterSource.includes('kubeconfig'), false);
  assert.equal(clusterSource.includes('接入集群'), false);
  assert.equal(clusterSource.includes('deleteCluster'), false);
  assert.equal(routeSource.includes("path: 'clusters/:clusterId/credentials'"), false);
});

test('K8s 集群接入和控制面凭据迁移到平台管理', () => {
  assert.equal(routeSource.includes("{ path: 'access', title: 'K8s 运维'"), false);
  assert.equal(navigationSource.includes("id: 'access-entry'"), false);
  assert.equal(navigationSource.includes("path: '/k8s/access'"), false);
  assert.equal(routeSource.includes("path: 'k8s-clusters'"), true);
  assert.equal(platformClusterSource.includes('listClustersForAdministration'), true);
  assert.equal(platformClusterSource.includes('createCluster'), true);
  assert.equal(platformClusterSource.includes('createClusterCredential'), true);
  assert.equal(platformClusterSource.includes('Controller Kubeconfig'), true);
  assert.equal(platformClusterSource.includes('平台不会返回明文'), true);
  assert.equal(platformClusterSource.includes('deleteCluster'), true);
});

test('K8s 工作台不再暴露旧平台授权入口', () => {
  assert.equal(routeSource.includes('K8sPlaceholderPage'), false);
  assert.equal(routeSource.includes("path: 'users'"), false);
  assert.equal(navigationSource.includes('访问授权'), false);
  assert.equal(routeSource.includes('clusters/:clusterId/platform-access'), false);
  assert.equal(routeSource.includes('K8sPlatformAccessPage'), false);
  for (const file of [
    './PlatformAccessPage.tsx',
    './CertificatePage.tsx',
    './ServiceAccountPage.tsx',
    './RbacPage.tsx',
    './KubeconfigPage.tsx',
  ]) {
    assert.equal(existsSync(new URL(file, import.meta.url)), false);
  }
});

test('K8s 命名空间页面展示集群、来源和权限上下文', () => {
  assert.equal(namespaceSource.includes('命名空间列表'), true);
  assert.equal(namespaceSource.includes('当前集群'), true);
  assert.equal(namespaceSource.includes('console-summary-strip'), true);
  assert.equal(namespaceSource.includes('console-detail-rail console-inspector'), true);
  assert.equal(namespaceSource.includes('console-selected-row'), true);
  assert.equal(namespaceSource.includes('console-table-action-danger'), false);
  assert.equal(namespaceSource.includes('命名空间详情'), true);
  assert.equal(namespaceSource.includes('k8sApi.listClusters'), false);
  assert.equal(namespaceSource.includes('请先从集群总览进入工作台'), true);
  assert.equal(namespaceSource.includes('cluster/prod'), false);
  assert.equal(namespaceSource.includes('createNamespace'), false);
  assert.equal(namespaceSource.includes('deleteNamespace'), false);
  assert.equal(namespaceSource.includes('Namespace 由集群侧维护'), true);
  assert.equal(namespaceSource.includes('/api/v1/k8s/namespaces'), true);
});

test('K8s 资源页面展示完整资源身份字段', () => {
  assert.equal(resourceSource.includes('资源视图'), true);
  assert.equal(resourceSource.includes('当前集群'), true);
  assert.equal(resourceSource.includes('k8sApi.listClusters'), false);
  assert.equal(resourceSource.includes('命名空间选择'), true);
  assert.equal(resourceSource.includes('未选择集群或命名空间'), true);
  assert.equal(resourceSource.includes('API Version'), true);
  assert.equal(resourceSource.includes('identity.uid'), true);
  assert.equal(resourceSource.includes('<th>UID</th>'), false);
  assert.equal(resourceSource.includes('cluster/ns/api/kind/name/uid'), false);
  assert.equal(resourceSource.includes('资源详情'), true);
  assert.equal(resourceSource.includes('资源详情抽屉'), true);
  assert.equal(resourceSource.includes('createPortal'), true);
  assert.equal(resourceSource.includes('console-drawer-panel'), true);
  assert.equal(resourceSource.includes('console-drawer-backdrop'), true);
  assert.equal(resourceSource.includes('console-pod-log-workspace'), true);
  assert.equal(resourceSource.includes('console-pod-log-reader'), true);
  assert.equal(resourceSource.includes('console-pod-log-control-panel'), true);
  assert.equal(resourceSource.includes("selected.identity.kind === 'Pod' && activeTab === 'logs'"), true);
  assert.equal(resourceSource.includes('lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]'), true);
  assert.equal(resourceSource.includes('resource-drawer-tab-content'), true);
  assert.equal(resourceSource.includes('resource-detail-stack'), true);
  assert.equal(resourceSource.includes('resource-detail-spec-block'), true);
  assert.equal(resourceSource.includes('lg:grid-cols-[320px_1fr]'), false);
  assert.equal(resourceSource.includes('<CodePreview fill'), true);
  assert.equal(resourceSource.includes("fill ? 'h-full min-h-[320px]'"), true);
  assert.equal(resourceSource.includes('<DataPanel title="资源详情"'), false);
  assert.equal(resourceSource.includes("event.key === 'Escape'"), true);
  assert.equal(resourceSource.includes('YAML 预览'), true);
  assert.equal(resourceSource.includes('Pod 日志'), true);
  assert.equal(resourceSource.includes('容器选择'), true);
  assert.equal(resourceSource.includes('containerOptions'), true);
  assert.equal(resourceSource.includes('命名空间读取失败'), true);
  assert.equal(resourceSource.includes('资源视图为只读'), true);
  assert.equal(resourceSource.includes('发布、回滚和删除统一从“发布部署”进入'), true);
  assert.equal(resourceSource.includes('受控操作闭环'), false);
  assert.equal(resourceSource.includes('k8sApi.previewDeployment'), false);
  assert.equal(resourceSource.includes('k8sApi.applyDeployment'), false);
  assert.equal(resourceSource.includes('k8sApi.previewDeleteDeployment'), false);
  assert.equal(resourceSource.includes('资源 API 暂未连接'), false);
});

test('K8s 部署历史和审计页面展示追踪上下文', () => {
  assert.equal(deploymentHistorySource.includes('部署历史'), true);
  assert.equal(deploymentHistorySource.includes('k8sApi.listDeploymentHistory'), true);
  assert.equal(deploymentHistorySource.includes('useK8sOpsContext'), true);
  assert.equal(deploymentHistorySource.includes('k8sApi.listNamespaces'), true);
  assert.equal(deploymentHistorySource.includes("listDeploymentHistory('prod')"), false);
  assert.equal(deploymentHistorySource.includes('cluster/prod'), false);
  assert.equal(auditSource.includes('操作审计'), true);
  assert.equal(auditSource.includes('Trace'), true);
  assert.equal(auditSource.includes('k8sApi.listAuditEvents'), true);
  assert.equal(auditSource.includes('useK8sOpsContext'), true);
  assert.equal(auditSource.includes('k8sApi.listNamespaces'), true);
  assert.equal(auditSource.includes("listAuditEvents('prod')"), false);
  assert.equal(auditSource.includes('cluster/prod'), false);
});

test('K8s 模板页面展示变量摘要、权限不足态和审计结果', () => {
  assert.equal(templateSource.includes('模板管理'), true);
  assert.equal(templateSource.includes('/api/v1/k8s/templates'), true);
  assert.equal(templateSource.includes('k8sApi.listResources'), true);
  assert.equal(templateSource.includes('k8sApi.getBaseTemplate'), true);
  assert.equal(templateSource.includes('当前集群'), true);
  assert.equal(templateSource.includes('k8sApi.listClusters'), false);
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
  assert.equal(templateSource.includes('novaapm-base'), true);
  assert.equal(templateSource.includes('权限不足'), true);
  assert.equal(templateSource.includes('操作已落审计'), true);
  assert.equal(templateSource.includes('删除确认摘要'), true);
  assert.equal(templateSource.includes('rendered_yaml'), true);
});

test('K8s 发布部署页面展示完整资源身份、高风险确认和审计结果', () => {
  assert.equal(deploymentSource.includes('发布部署'), true);
  assert.equal(deploymentSource.includes('useK8sOpsContext'), true);
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
  assert.equal(terminalSource.includes('k8sApi.execTerminal'), true);
  assert.equal(terminalSource.includes('useK8sOpsContext'), true);
  assert.equal(terminalSource.includes('k8sApi.listNamespaces'), true);
  assert.equal(terminalSource.includes('k8sApi.listResources'), true);
  assert.equal(terminalSource.includes('当前集群'), true);
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
