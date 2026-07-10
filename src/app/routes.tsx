import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AgentDetailPage } from '../pages/agents/AgentDetailPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { K8sAuditPage } from '../pages/k8s/AuditPage';
import { K8sCertificatePage } from '../pages/k8s/CertificatePage';
import { K8sClusterPage } from '../pages/k8s/ClusterPage';
import { DashboardPage } from '../pages/k8s/DashboardPage';
import { K8sDeploymentHistoryPage } from '../pages/k8s/DeploymentHistoryPage';
import { K8sDeploymentPage } from '../pages/k8s/DeploymentPage';
import { K8sOpsLayout } from '../pages/k8s/K8sOpsLayout';
import { K8sNamespacePage } from '../pages/k8s/NamespacePage';
import { K8sObservabilityAccessPage } from '../pages/k8s/ObservabilityAccessPage';
import { K8sPlatformAccessPage } from '../pages/k8s/PlatformAccessPage';
import { K8sResourcePage } from '../pages/k8s/ResourcePage';
import { K8sRbacPage } from '../pages/k8s/RbacPage';
import { K8sRuntimeTopologyPage } from '../pages/k8s/RuntimeTopologyPage';
import { K8sServiceAccountPage } from '../pages/k8s/ServiceAccountPage';
import { K8sKubeconfigPage } from '../pages/k8s/KubeconfigPage';
import { K8sTemplatePage } from '../pages/k8s/TemplatePage';
import { K8sTerminalPage } from '../pages/k8s/TerminalPage';
import { LogsAgentsPage } from '../pages/logs/LogsAgentsPage';
import { LogsAlertsPage } from '../pages/logs/LogsAlertsPage';
import { LogsExplorePage } from '../pages/logs/LogsExplorePage';
import { LogsEntryLayout } from '../pages/logs/LogsEntryLayout';
import { LogsOnboardingPage } from '../pages/logs/LogsOnboardingPage';
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { MetricsAlertsPage } from '../pages/metrics/MetricsAlertsPage';
import { MetricsAlertRulePage } from '../pages/metrics/MetricsAlertRulePage';
import { MetricsCollectionPage } from '../pages/metrics/MetricsCollectionPage';
import { MetricsDashboardsPage } from '../pages/metrics/MetricsDashboardsPage';
import { MetricsEndpointsPage } from '../pages/metrics/MetricsEndpointsPage';
import { MetricsExplorePage } from '../pages/metrics/MetricsExplorePage';
import { MetricsEntryLayout } from '../pages/metrics/MetricsEntryLayout';
import { MetricsLayout } from '../pages/metrics/MetricsLayout';
import { MetricsOverviewPage } from '../pages/metrics/MetricsOverviewPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { ObservabilitySettingsPage } from '../pages/platform/ObservabilitySettingsPage';
import { PlatformAccessAdminPage } from '../pages/platform/PlatformAccessAdminPage';
import { PlatformLayout } from '../pages/platform/PlatformLayout';
import { PlatformSettingsPage } from '../pages/platform/PlatformSettingsPage';
import { ServicesPage } from '../pages/services/ServicesPage';
import { ServiceModuleEntryPage } from '../pages/services/ServiceModuleEntryPage';
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
  { path: 'observability', title: 'K8s 观测接入', element: <K8sObservabilityAccessPage /> },
  { path: 'clusters', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'namespaces', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'resource-view', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'runtime-topology', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'platform-access', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'deploy-history', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'audit', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'certificates', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'service-accounts', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'rbac', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'kubeconfig', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'templates', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'releases', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'terminal', title: 'K8s 运维', element: <Navigate to="/k8s" replace /> },
  { path: 'clusters/:clusterId', title: 'K8s 运维', element: <DashboardPage /> },
  { path: 'clusters/:clusterId/observability', title: 'K8s 观测接入', element: <K8sObservabilityRedirect /> },
  { path: 'clusters/:clusterId/namespaces', title: 'K8s 运维', element: <K8sNamespacePage /> },
  { path: 'clusters/:clusterId/resource-view', title: 'K8s 运维', element: <K8sResourcePage /> },
  { path: 'clusters/:clusterId/runtime-topology', title: 'K8s 运维', element: <K8sRuntimeTopologyPage /> },
  { path: 'clusters/:clusterId/credentials', title: 'K8s 运维', element: <K8sClusterPage /> },
  { path: 'clusters/:clusterId/platform-access', title: 'K8s 运维', element: <K8sPlatformAccessPage /> },
  { path: 'clusters/:clusterId/deploy-history', title: 'K8s 运维', element: <K8sDeploymentHistoryPage /> },
  { path: 'clusters/:clusterId/audit', title: 'K8s 运维', element: <K8sAuditPage /> },
  { path: 'clusters/:clusterId/certificates', title: 'K8s 运维', element: <K8sCertificatePage /> },
  { path: 'clusters/:clusterId/service-accounts', title: 'K8s 运维', element: <K8sServiceAccountPage /> },
  { path: 'clusters/:clusterId/rbac', title: 'K8s 运维', element: <K8sRbacPage /> },
  { path: 'clusters/:clusterId/kubeconfig', title: 'K8s 运维', element: <K8sKubeconfigPage /> },
  { path: 'clusters/:clusterId/templates', title: 'K8s 运维', element: <K8sTemplatePage /> },
  { path: 'clusters/:clusterId/releases', title: 'K8s 运维', element: <K8sDeploymentPage /> },
  { path: 'clusters/:clusterId/terminal', title: 'K8s 运维', element: <K8sTerminalPage /> },
];

const logsChildRoutes: RouteDefinition[] = [
  { index: true, title: 'Logs 日志分析', element: <ServiceLogsIndexRedirect /> },
  { path: 'explore', title: 'Logs 日志分析', element: <LogsExplorePage /> },
  { path: 'onboarding', title: '创建采集路由', element: <Navigate to="../agents/new" replace /> },
  { path: 'agents/new', title: '创建采集路由', element: <LogsOnboardingPage /> },
  { path: 'agents/:id/edit', title: '更新采集路由', element: <LogsOnboardingPage /> },
  { path: 'agents', title: 'Logs 采集路由', element: <LogsAgentsPage /> },
  { path: 'alerts/new', title: '创建日志告警', element: <LogsAlertsPage /> },
  { path: 'alerts/:id', title: '更新日志告警', element: <LogsAlertsPage /> },
  { path: 'alerts', title: 'Logs 日志告警', element: <LogsAlertsPage /> },
  { path: 'endpoints', title: '观测接入配置', element: <ObservabilitySettingsPage /> },
];

const logsEntryChildRoutes: RouteDefinition[] = [
  { index: true, title: 'Logs 日志分析', element: <Navigate to="/logs/explore" replace /> },
  { path: 'explore', title: 'Logs 日志分析', element: <ServiceModuleEntryPage module="logs" entry="explore" title="日志分析" actionLabel="进入日志分析" /> },
  { path: 'agents', title: 'Logs 采集路由', element: <ServiceModuleEntryPage module="logs" entry="agents" title="采集路由" actionLabel="进入采集路由" /> },
  { path: 'alerts', title: 'Logs 日志告警', element: <ServiceModuleEntryPage module="logs" entry="alerts" title="日志告警" actionLabel="进入日志告警" /> },
  { path: 'endpoints', title: '观测接入配置', element: <ObservabilitySettingsPage /> },
];

const platformChildRoutes: RouteDefinition[] = [
  { index: true, title: '平台管理', element: <Navigate to="/platform/settings" replace /> },
  { path: 'settings', title: '平台设置', element: <PlatformSettingsPage /> },
  { path: 'access', title: '平台管理', element: <PlatformAccessAdminPage /> },
  { path: 'observability', title: '观测接入配置', element: <Navigate to="/observability/endpoints" replace /> },
];

const metricsChildRoutes: RouteDefinition[] = [
  { index: true, title: '指标查询', element: <ServiceMetricsIndexRedirect /> },
  { path: 'explore', title: '指标查询', element: <MetricsExplorePage /> },
  { path: 'alerts/new', title: '创建指标告警', element: <MetricsAlertRulePage /> },
  { path: 'alerts/:id', title: '编辑指标告警', element: <MetricsAlertRulePage /> },
  { path: 'alerts', title: '指标告警', element: <MetricsAlertsPage /> },
  { path: 'dashboards', title: 'Dashboard', element: <MetricsDashboardsPage /> },
  { path: 'collection', title: '采集接入', element: <MetricsCollectionPage /> },
  { path: 'overview', title: '监控总览', element: <MetricsOverviewPage /> },
  { path: 'endpoints', title: '接入端点', element: <MetricsEndpointsPage /> },
];

const metricsEntryChildRoutes: RouteDefinition[] = [
  { index: true, title: '指标查询', element: <Navigate to="/metrics/explore" replace /> },
  { path: 'explore', title: '指标查询', element: <ServiceModuleEntryPage module="metrics" entry="explore" title="指标查询" actionLabel="进入指标查询" /> },
  { path: 'alerts', title: '指标告警', element: <ServiceModuleEntryPage module="metrics" entry="alerts" title="指标告警" actionLabel="进入指标告警" /> },
  { path: 'dashboards', title: 'Dashboard', element: <ServiceModuleEntryPage module="metrics" entry="dashboards" title="Dashboard" actionLabel="进入 Dashboard" /> },
  { path: 'collection', title: '采集接入', element: <ServiceModuleEntryPage module="metrics" entry="collection" title="采集接入" actionLabel="进入采集接入" /> },
  { path: 'overview', title: '监控总览', element: <ServiceModuleEntryPage module="metrics" entry="overview" title="监控总览" actionLabel="进入监控总览" /> },
  { path: 'endpoints', title: '接入端点', element: <ServiceModuleEntryPage module="metrics" entry="endpoints" title="接入端点" actionLabel="进入接入端点" /> },
];

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/services', title: '服务目录', element: <ServicesPage /> },
  { path: '/onboarding', title: '服务接入', element: <Navigate to="/services" replace /> },
	{ path: '/logs', title: 'Logs', element: <LogsEntryLayout />, children: logsEntryChildRoutes },
  { path: '/products/:productId/services/:serviceId/logs', title: 'Logs', element: <LogsWorkspace />, children: logsChildRoutes },
  { path: '/observability/endpoints', title: '观测接入配置', element: <ObservabilitySettingsPage /> },
  { path: '/metrics', title: '指标查询', element: <MetricsEntryLayout />, children: metricsEntryChildRoutes },
	{ path: '/products/:productId/services/:serviceId/metrics', title: '监控', element: <MetricsLayout />, children: metricsChildRoutes },
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

function K8sObservabilityRedirect() {
  const { clusterId = '' } = useParams();
  return <Navigate to={clusterId ? `/k8s/observability?cluster_id=${encodeURIComponent(clusterId)}` : '/k8s/observability'} replace />;
}

function ServiceLogsIndexRedirect() {
	const { productId = '', serviceId = '' } = useParams();
	return <Navigate to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs/explore`} replace />;
}

function ServiceMetricsIndexRedirect() {
	const { productId = '', serviceId = '' } = useParams();
	return <Navigate to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/explore`} replace />;
}
