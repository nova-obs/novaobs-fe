import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
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
import { LogsAlertRulePage } from '../pages/logs/LogsAlertRulePage';
import { LogsExplorePage } from '../pages/logs/LogsExplorePage';
import { LogsOnboardingPage } from '../pages/logs/LogsOnboardingPage';
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { MonitoringPage } from '../pages/monitoring/MonitoringPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { ObservabilitySettingsPage } from '../pages/platform/ObservabilitySettingsPage';
import { PlatformAccessAdminPage } from '../pages/platform/PlatformAccessAdminPage';
import { PlatformLayout } from '../pages/platform/PlatformLayout';
import { PlatformSettingsPage } from '../pages/platform/PlatformSettingsPage';
import { ServicesPage } from '../pages/services/ServicesPage';

export interface RouteDefinition {
  path?: string;
  index?: boolean;
  title: string;
  element: ReactNode;
  children?: RouteDefinition[];
}

const k8sChildRoutes: RouteDefinition[] = [
  { index: true, title: 'K8s 运维', element: <K8sClusterPage /> },
  { path: 'access', title: 'K8s 运维', element: <K8sClusterPage /> },
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
  { index: true, title: 'Logs 日志分析', element: <Navigate to="/logs/explore" replace /> },
  { path: 'explore', title: 'Logs 日志分析', element: <LogsExplorePage /> },
  { path: 'onboarding', title: '创建采集路由', element: <Navigate to="/logs/agents/new" replace /> },
  { path: 'agents/new', title: '创建采集路由', element: <LogsOnboardingPage /> },
  { path: 'agents/:id/edit', title: '更新采集路由', element: <LogsOnboardingPage /> },
  { path: 'agents', title: 'Logs 采集路由', element: <LogsAgentsPage /> },
  { path: 'alerts/new', title: '创建日志告警', element: <LogsAlertRulePage /> },
  { path: 'alerts/:id', title: '更新日志告警', element: <LogsAlertRulePage /> },
  { path: 'alerts', title: 'Logs 日志告警', element: <LogsAlertsPage /> },
];

const platformChildRoutes: RouteDefinition[] = [
  { index: true, title: '平台管理', element: <Navigate to="/platform/settings" replace /> },
  { path: 'settings', title: '平台设置', element: <PlatformSettingsPage /> },
  { path: 'access', title: '平台管理', element: <PlatformAccessAdminPage /> },
  { path: 'observability', title: '观测接入配置', element: <Navigate to="/observability/endpoints" replace /> },
];

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/services', title: '服务目录', element: <ServicesPage /> },
  { path: '/onboarding', title: '服务接入', element: <Navigate to="/logs/agents/new" replace /> },
  { path: '/logs', title: 'Logs', element: <LogsWorkspace />, children: logsChildRoutes },
  { path: '/observability/endpoints', title: '观测接入配置', element: <ObservabilitySettingsPage /> },
  { path: '/monitoring', title: '监控', element: <MonitoringPage /> },
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

export const getDocumentTitle = (path: string) => `${getRouteTitle(path)} - NovaObs`;

function findRouteTitle(routes: RouteDefinition[], normalizedPath: string, basePath = ''): RouteDefinition | undefined {
  for (const route of routes) {
    const fullPath = route.index ? basePath : route.path?.startsWith('/') ? route.path : `${basePath}/${route.path ?? ''}`.replace(/\/+/g, '/');
    if (!fullPath) continue;
    const matched = route.index
      ? normalizedPath === fullPath
      : fullPath === '/'
        ? normalizedPath === '/'
        : routePathMatches(fullPath, normalizedPath);
    if (!matched) continue;
    const child = route.children ? findRouteTitle(route.children, normalizedPath, fullPath) : undefined;
    return child ?? route;
  }
  return undefined;
}

function routePathMatches(pattern: string, path: string) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);
  if (pathSegments.length < patternSegments.length) return false;
  return patternSegments.every((segment, index) => segment.startsWith(':') || segment === pathSegments[index]);
}
