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
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { PipelinesPage } from '../pages/pipelines/PipelinesPage';
import { PlatformAccessAdminPage } from '../pages/platform/PlatformAccessAdminPage';
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

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/services', title: '服务目录', element: <ServicesPage /> },
  { path: '/onboarding', title: '服务接入', element: <OnboardingPage /> },
  { path: '/logs', title: 'Logs', element: <LogsWorkspace /> },
  { path: '/pipelines', title: '日志 Pipeline', element: <PipelinesPage /> },
  { path: '/platform/access', title: '平台管理', element: <PlatformAccessAdminPage /> },
  { path: '/k8s', title: 'K8s 运维', element: <K8sOpsLayout />, children: k8sChildRoutes },
  { path: '/agents/:uid', title: 'Agent Detail', element: <AgentDetailPage /> },
  { path: '/alerts', title: '告警中心', element: <AlertsPage /> },
];

export const getRouteTitle = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  if (normalizedPath.startsWith('/agents/')) return 'Agent Detail';
  const route = routeDefinitions.find((item) => {
    if (!item.path) {
      return false;
    }
    return item.path === '/'
      ? normalizedPath === '/'
      : normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`);
  });
  return route?.title ?? '平台总览';
};

export const getDocumentTitle = (path: string) => `${getRouteTitle(path)} - NovaObs`;
