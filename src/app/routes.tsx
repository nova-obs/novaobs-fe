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
import { LogsOnboardingPage } from '../pages/logs/LogsOnboardingPage';
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { MetricsEnvironmentsPage } from '../pages/metrics/MetricsEnvironmentsPage';
import { MetricsAlertsPage } from '../pages/metrics/MetricsAlertsPage';
import { MetricsDashboardPage } from '../pages/metrics/MetricsDashboardPage';
import { MetricsLayout } from '../pages/metrics/MetricsLayout';
import { MetricsOverviewPage } from '../pages/metrics/MetricsOverviewPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { ObservabilitySettingsPage } from '../pages/platform/ObservabilitySettingsPage';
import { PlatformAccessAdminPage } from '../pages/platform/PlatformAccessAdminPage';
import { PlatformEnvironmentsPage } from '../pages/platform/PlatformEnvironmentsPage';
import { PlatformLayout } from '../pages/platform/PlatformLayout';
import { PlatformSettingsPage } from '../pages/platform/PlatformSettingsPage';
import { ServicesPage } from '../pages/services/ServicesPage';
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
  { path: 'onboarding', title: '创建日志采集路由', element: <Navigate to="../agents/new" replace /> },
  { path: 'agents/new', title: '创建日志采集路由', element: <LogsOnboardingPage /> },
  { path: 'agents/:id/edit', title: '更新日志采集路由', element: <LogsOnboardingPage /> },
  { path: 'agents', title: 'Logs 日志采集', element: <LogsAgentsPage /> },
  { path: 'alerts/new', title: '创建日志告警', element: <LogsAlertsPage /> },
  { path: 'alerts/:id', title: '更新日志告警', element: <LogsAlertsPage /> },
  { path: 'alerts', title: 'Logs 日志告警', element: <LogsAlertsPage /> },
  { path: 'endpoints', title: 'Logs 下游端点', element: <Navigate to="/observability/endpoints/logs" replace /> },
];

const logsEntryChildRoutes: RouteDefinition[] = [
  { index: true, title: 'Logs 日志分析', element: <Navigate to="/logs/explore" replace /> },
  { path: 'explore', title: 'Logs 日志分析', element: <LogsExplorePage /> },
  { path: 'agents', title: 'Logs 日志采集', element: <LogsAgentsPage /> },
  { path: 'alerts', title: 'Logs 日志告警', element: <LogsAlertsPage /> },
  { path: 'endpoints', title: 'Logs 下游端点', element: <Navigate to="/observability/endpoints/logs" replace /> },
];

const platformChildRoutes: RouteDefinition[] = [
  { index: true, title: '平台管理', element: <Navigate to="/platform/environments" replace /> },
  { path: 'environments', title: '环境管理', element: <PlatformEnvironmentsPage /> },
  { path: 'settings', title: '平台设置', element: <PlatformSettingsPage /> },
  { path: 'access', title: '平台管理', element: <PlatformAccessAdminPage /> },
  { path: 'observability', title: 'Logs 下游端点', element: <Navigate to="/observability/endpoints/logs" replace /> },
];

const metricsEntryChildRoutes: RouteDefinition[] = [
  { index: true, title: '监控总览', element: <Navigate to="/metrics/overview" replace /> },
  { path: 'overview', title: '监控总览', element: <MetricsOverviewPage /> },
  { path: 'dashboard', title: 'Dashboard', element: <MetricsDashboardPage /> },
  { path: 'alerts/new', title: '创建指标告警', element: <MetricsAlertsPage /> },
  { path: 'alerts/:id', title: '编辑指标告警', element: <MetricsAlertsPage /> },
  { path: 'alerts', title: '指标告警', element: <MetricsAlertsPage /> },
  { path: 'environments', title: '环境接入', element: <MetricsEnvironmentsPage /> },
  { path: 'endpoints', title: '指标下游端点', element: <Navigate to="/observability/endpoints/metrics" replace /> },
];

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/services', title: '服务目录', element: <ServicesPage /> },
  { path: '/onboarding', title: '服务接入', element: <Navigate to="/services" replace /> },
	{ path: '/logs', title: 'Logs', element: <LogsWorkspace />, children: logsEntryChildRoutes },
  { path: '/products/:productId/services/:serviceId/logs', title: 'Logs', element: <LogsWorkspace />, children: logsChildRoutes },
  { path: '/products/:productId/services/:serviceId/metrics/endpoints', title: '指标下游端点', element: <Navigate to="/observability/endpoints/metrics" replace /> },
  { path: '/products/:productId/services/:serviceId/metrics/alerts/new', title: '创建指标告警', element: <Navigate to="/metrics/alerts/new" replace /> },
  { path: '/products/:productId/services/:serviceId/metrics/alerts/:id', title: '编辑指标告警', element: <LegacyMetricsAlertRedirect /> },
  { path: '/products/:productId/services/:serviceId/metrics/alerts', title: '指标告警', element: <Navigate to="/metrics/alerts" replace /> },
  { path: '/observability/endpoints', title: 'Logs 下游端点', element: <Navigate to="/observability/endpoints/logs" replace /> },
  { path: '/observability/endpoints/logs', title: 'Logs 下游端点', element: <ObservabilitySettingsPage key="logs-endpoints" domain="logs" /> },
  { path: '/observability/endpoints/metrics', title: '指标下游端点', element: <ObservabilitySettingsPage key="metrics-endpoints" domain="metrics" /> },
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

function K8sObservabilityRedirect() {
  const { clusterId = '' } = useParams();
  return <Navigate to={clusterId ? `/k8s/observability?cluster_id=${encodeURIComponent(clusterId)}` : '/k8s/observability'} replace />;
}

function ServiceLogsIndexRedirect() {
	const { productId = '', serviceId = '' } = useParams();
	return <Navigate to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs/explore`} replace />;
}

function LegacyMetricsAlertRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={id ? `/metrics/alerts/${encodeURIComponent(id)}` : '/metrics/alerts'} replace />;
}
