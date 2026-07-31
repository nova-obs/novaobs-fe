import type { ReactNode } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { buildLogsExplorePath } from '../components/navigation/serviceScope';
import { AccessGate, type AccessRequirement } from '../layouts/access';
import { AgentDetailPage } from '../pages/agents/AgentDetailPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { K8sAuditPage } from '../pages/k8s/AuditPage';
import { K8sClusterPage } from '../pages/k8s/ClusterPage';
import { DashboardPage } from '../pages/k8s/DashboardPage';
import { K8sDeploymentHistoryPage } from '../pages/k8s/DeploymentHistoryPage';
import { K8sDeploymentPage } from '../pages/k8s/DeploymentPage';
import { K8sOpsLayout } from '../pages/k8s/K8sOpsLayout';
import { K8sNamespacePage } from '../pages/k8s/NamespacePage';
import { K8sResourcePage } from '../pages/k8s/ResourcePage';
import { K8sRuntimeTopologyPage } from '../pages/k8s/RuntimeTopologyPage';
import { K8sTerminalPage } from '../pages/k8s/TerminalPage';
import { LogsAgentsPage } from '../pages/logs/LogsAgentsPage';
import { LogsAlertsPage } from '../pages/logs/LogsAlertsPage';
import { LogsExplorePage } from '../pages/logs/LogsExplorePage';
import { LogsFormatDemoPage } from '../pages/logs/LogsFormatDemoPage';
import { LogsOnboardingPage } from '../pages/logs/LogsOnboardingPage';
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { MetricsIntegrationsPage } from '../pages/metrics/MetricsIntegrationsPage';
import { MetricsAlertsPage } from '../pages/metrics/MetricsAlertsPage';
import { MetricsDashboardPage } from '../pages/metrics/MetricsDashboardPage';
import { MetricsLayout } from '../pages/metrics/MetricsLayout';
import { MetricsOverviewPage } from '../pages/metrics/MetricsOverviewPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { ObservabilitySettingsPage } from '../pages/platform/ObservabilitySettingsPage';
import { PlatformAccessAdminPage } from '../pages/platform/PlatformAccessAdminPage';
import { PlatformGroupDetailPage } from '../pages/platform/PlatformGroupDetailPage';
import { PlatformK8sClustersPage } from '../pages/platform/PlatformK8sClustersPage';
import { PlatformLayout } from '../pages/platform/PlatformLayout';
import { PlatformSettingsPage } from '../pages/platform/PlatformSettingsPage';
import { ServicesPage } from '../pages/services/ServicesPage';
import { ServiceDeploymentTaskPage } from '../pages/services/ServiceDeploymentTaskPage';
import { TracesPage } from '../pages/traces/TracesPage';

export interface RouteDefinition {
  path?: string;
  index?: boolean;
  title: string;
  element: ReactNode;
  children?: RouteDefinition[];
}

const k8sChildRoutes: RouteDefinition[] = [
  { index: true, title: 'K8s 运维', element: <K8sClusterPage /> },
  { path: 'clusters', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'namespaces', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'resource-view', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'runtime-topology', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'deploy-history', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'audit', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'releases', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'terminal', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'clusters/:clusterId', title: 'K8s 运维', element: gated(<DashboardPage />, { kind: 'k8s', minimum: 'developer' }) },
  { path: 'clusters/:clusterId/namespaces', title: 'K8s 运维', element: gated(<K8sNamespacePage />, { kind: 'k8s', minimum: 'developer' }) },
  { path: 'clusters/:clusterId/resource-view', title: 'K8s 运维', element: gated(<K8sResourcePage />, { kind: 'k8s', minimum: 'developer' }) },
  { path: 'clusters/:clusterId/runtime-topology', title: 'K8s 运维', element: gated(<K8sRuntimeTopologyPage />, { kind: 'k8s', minimum: 'developer' }) },
  { path: 'clusters/:clusterId/deploy-history', title: 'K8s 运维', element: gated(<K8sDeploymentHistoryPage />, { kind: 'k8s', minimum: 'developer' }) },
  { path: 'clusters/:clusterId/audit', title: 'K8s 运维', element: gated(<K8sAuditPage />, { kind: 'k8s', minimum: 'developer' }) },
  { path: 'clusters/:clusterId/releases', title: 'K8s 运维', element: gated(<K8sDeploymentPage />, { kind: 'k8s', minimum: 'namespace-maintainer' }) },
  { path: 'clusters/:clusterId/terminal', title: 'K8s 运维', element: gated(<K8sTerminalPage />, { kind: 'k8s', minimum: 'namespace-maintainer' }) },
];

const logsChildRoutes: RouteDefinition[] = [
  { index: true, title: 'Logs 日志分析', element: <ServiceLogsIndexRedirect /> },
  { path: 'explore', title: 'Logs 日志分析', element: <LegacyLogsExploreRedirect /> },
  { path: 'format-demo', title: '日志格式改造演示', element: <LogsFormatDemoPage /> },
  { path: 'onboarding', title: '创建日志采集路由', element: <Navigate to="../agents/new" replace /> },
  { path: 'agents/new', title: '创建日志采集路由', element: gated(<LogsOnboardingPage />, { kind: 'product', minimum: 'product-maintainer' }) },
  { path: 'agents/:id/edit', title: '更新日志采集路由', element: gated(<LogsOnboardingPage />, { kind: 'product', minimum: 'product-maintainer' }) },
  { path: 'agents', title: 'Logs 日志采集', element: <LogsAgentsPage /> },
  { path: 'alerts/new', title: '创建日志告警', element: gated(<LogsAlertsPage />, { kind: 'product', minimum: 'product-maintainer' }) },
  { path: 'alerts/:id', title: '更新日志告警', element: gated(<LogsAlertsPage />, { kind: 'product', minimum: 'product-maintainer' }) },
  { path: 'alerts', title: 'Logs 日志告警', element: <LogsAlertsPage /> },
  { path: 'endpoints', title: '日志数据端点', element: <Navigate to="/platform/observability/endpoints/logs" replace /> },
];

const logsEntryChildRoutes: RouteDefinition[] = [
  { index: true, title: 'Logs 日志分析', element: <Navigate to="/logs/explore" replace /> },
  { path: 'explore', title: 'Logs 日志分析', element: <LogsExplorePage /> },
  { path: 'format-demo', title: '日志格式改造演示', element: <LogsFormatDemoPage /> },
  { path: 'agents', title: 'Logs 日志采集', element: <LogsAgentsPage /> },
  { path: 'alerts', title: 'Logs 日志告警', element: <LogsAlertsPage /> },
  { path: 'endpoints', title: '日志数据端点', element: <Navigate to="/platform/observability/endpoints/logs" replace /> },
];

const platformChildRoutes: RouteDefinition[] = [
  { index: true, title: '平台管理', element: <Navigate to="/platform/settings" replace /> },
  { path: 'settings', title: '平台设置', element: gated(<PlatformSettingsPage />, { kind: 'platform-admin' }) },
  { path: 'access', title: '身份与授权', element: <Navigate to="/platform/identities" replace /> },
  { path: 'identities', title: '用户与用户组', element: gated(<PlatformAccessAdminPage section="identities" />, { kind: 'platform-admin' }) },
  { path: 'groups/:groupId', title: '用户组授权', element: gated(<PlatformGroupDetailPage />, { kind: 'platform-admin' }) },
  { path: 'admins', title: '平台管理员授权', element: gated(<PlatformAccessAdminPage section="platform-admins" />, { kind: 'platform-admin' }) },
  { path: 'product-access', title: '产品访问授权', element: gated(<PlatformAccessAdminPage section="product-access" />, { kind: 'platform-admin' }) },
  { path: 'k8s-access-profiles', title: 'K8s 集群授权', element: gated(<PlatformAccessAdminPage section="k8s-profiles" />, { kind: 'platform-admin' }) },
  { path: 'break-glass', title: 'K8s 紧急访问', element: gated(<PlatformAccessAdminPage section="break-glass" />, { kind: 'platform-admin' }) },
  { path: 'k8s-clusters', title: 'K8s 集群接入', element: gated(<PlatformK8sClustersPage />, { kind: 'platform-admin' }) },
  { path: 'observability/endpoints/logs', title: '日志数据端点', element: gated(<ObservabilitySettingsPage key="platform-logs-endpoints" domain="logs" />, { kind: 'platform-admin' }) },
  { path: 'observability/endpoints/metrics', title: '指标数据端点', element: gated(<ObservabilitySettingsPage key="platform-metrics-endpoints" domain="metrics" />, { kind: 'platform-admin' }) },
];

const metricsEntryChildRoutes: RouteDefinition[] = [
  { index: true, title: '监控总览', element: <Navigate to="/metrics/overview" replace /> },
  { path: 'overview', title: '监控总览', element: <MetricsOverviewPage /> },
  { path: 'dashboard', title: 'Dashboard', element: <MetricsDashboardPage /> },
  { path: 'alerts/new', title: '创建指标告警', element: <MetricsAlertsPage /> },
  { path: 'alerts/:id', title: '编辑指标告警', element: <MetricsAlertsPage /> },
  { path: 'alerts', title: '指标告警', element: <MetricsAlertsPage /> },
  { path: 'integrations', title: '指标接入', element: <MetricsIntegrationsPage /> },
  { path: 'endpoints', title: '指标数据端点', element: <Navigate to="/platform/observability/endpoints/metrics" replace /> },
];

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/products', title: '产品与服务', element: <ServicesPage /> },
  { path: '/products/:productId/services', title: '产品服务', element: <ServicesPage /> },
  { path: '/products/:productId/integrations', title: '产品集成', element: <ServicesPage /> },
  { path: '/products/:productId/services/:serviceId', title: '服务详情', element: <ServicesPage /> },
  { path: '/products/:productId/services/:serviceId/deployments/new', title: '新增服务部署', element: gated(<ServiceDeploymentTaskPage />, { kind: 'product', minimum: 'product-maintainer' }) },
  { path: '/products/:productId/services/:serviceId/deployments/:deploymentId/edit', title: '编辑服务部署', element: gated(<ServiceDeploymentTaskPage />, { kind: 'product', minimum: 'product-maintainer' }) },
  { path: '/products/:productId/services/:serviceId/overview', title: '服务详情', element: <LegacyServiceSectionRedirect /> },
  { path: '/products/:productId/services/:serviceId/graph', title: '服务详情', element: <LegacyServiceSectionRedirect /> },
  { path: '/products/:productId/services/:serviceId/settings', title: '服务详情', element: <LegacyServiceSectionRedirect /> },
  { path: '/services', title: '产品与服务', element: <Navigate to="/products" replace /> },
  { path: '/onboarding', title: '服务接入', element: <Navigate to="/products" replace /> },
	{ path: '/logs', title: 'Logs', element: <LogsWorkspace />, children: logsEntryChildRoutes },
  { path: '/products/:productId/services/:serviceId/logs', title: 'Logs', element: <LogsWorkspace />, children: logsChildRoutes },
  { path: '/products/:productId/services/:serviceId/metrics/endpoints', title: '指标数据端点', element: <Navigate to="/platform/observability/endpoints/metrics" replace /> },
  { path: '/products/:productId/services/:serviceId/metrics/alerts/new', title: '创建指标告警', element: <Navigate to="/metrics/alerts/new" replace /> },
  { path: '/products/:productId/services/:serviceId/metrics/alerts/:id', title: '编辑指标告警', element: <LegacyMetricsAlertRedirect /> },
  { path: '/products/:productId/services/:serviceId/metrics/alerts', title: '指标告警', element: <Navigate to="/metrics/alerts" replace /> },
  { path: '/observability/endpoints', title: '日志数据端点', element: <Navigate to="/platform/observability/endpoints/logs" replace /> },
  { path: '/observability/endpoints/logs', title: '日志数据端点', element: <Navigate to="/platform/observability/endpoints/logs" replace /> },
  { path: '/observability/endpoints/metrics', title: '指标数据端点', element: <Navigate to="/platform/observability/endpoints/metrics" replace /> },
  { path: '/metrics', title: '监控总览', element: <MetricsLayout />, children: metricsEntryChildRoutes },
  { path: '/traces', title: 'Trace', element: <TracesPage /> },
  { path: '/platform', title: '平台管理', element: <PlatformLayout />, children: platformChildRoutes },
  { path: '/k8s', title: 'K8s 运维', element: <K8sOpsLayout />, children: k8sChildRoutes },
  { path: '/agents/:uid', title: 'Agent Detail', element: <AgentDetailPage /> },
  { path: '/alerts', title: '告警中心', element: <AlertsPage /> },
];

export const getRouteTitle = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  if (normalizedPath.startsWith('/agents/')) return 'Agent Detail';
  const route = findRouteTitle(routeDefinitions, normalizedPath);
  return route?.title ?? '平台总览';
};

export const getDocumentTitle = (path: string) => `${getRouteTitle(path)} - NovaAPM`;

function findRouteTitle(routes: RouteDefinition[], normalizedPath: string, basePath = ''): RouteDefinition | undefined {
  for (const route of routes) {
    const fullPath = route.index ? basePath : route.path?.startsWith('/') ? route.path : `${basePath}/${route.path ?? ''}`.replace(/\/+/g, '/');
    if (!fullPath) continue;
    const hasChildren = Boolean(route.children?.length);
    const matched = route.index
      ? normalizedPath === fullPath
      : fullPath === '/'
        ? normalizedPath === '/'
        : routePathMatches(fullPath, normalizedPath, hasChildren);
    if (!matched) continue;
    const child = route.children ? findRouteTitle(route.children, normalizedPath, fullPath) : undefined;
    if (child) return child;
    if (hasChildren && normalizedPath !== fullPath) continue;
    return route;
  }
  return undefined;
}

function routePathMatches(pattern: string, path: string, allowPrefix = false) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);
  if (allowPrefix ? pathSegments.length < patternSegments.length : pathSegments.length !== patternSegments.length) return false;
  return patternSegments.every((segment, index) => segment.startsWith(':') || segment === pathSegments[index]);
}


function ServiceLogsIndexRedirect() {
	const { productId = '', serviceId = '' } = useParams();
	return <Navigate to={buildLogsExplorePath(productId, serviceId)} replace />;
}

function LegacyLogsExploreRedirect() {
  const { productId = '', serviceId = '' } = useParams();
  const [searchParams] = useSearchParams();
  return <Navigate to={buildLogsExplorePath(productId, serviceId, searchParams.get('endpoint_id') ?? '')} replace />;
}

function LegacyServiceSectionRedirect() {
  const { productId = '', serviceId = '' } = useParams();
  return <Navigate to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}`} replace />;
}

function LegacyMetricsAlertRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={id ? `/metrics/alerts/${encodeURIComponent(id)}` : '/metrics/alerts'} replace />;
}

function gated(element: ReactNode, requirement: AccessRequirement) {
  return <AccessGate requirement={requirement}>{element}</AccessGate>;
}
