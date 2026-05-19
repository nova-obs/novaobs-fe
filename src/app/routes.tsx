import type { ReactNode } from 'react';
import { AgentDetailPage } from '../pages/agents/AgentDetailPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { K8sClusterPage } from '../pages/k8s/ClusterPage';
import { DashboardPage } from '../pages/k8s/DashboardPage';
import { K8sOpsLayout } from '../pages/k8s/K8sOpsLayout';
import { K8sNamespacePage } from '../pages/k8s/NamespacePage';
import { K8sResourcePage } from '../pages/k8s/ResourcePage';
import { K8sPlaceholderPage } from '../pages/k8s/K8sPlaceholderPage';
import { k8sNavigationItems } from '../pages/k8s/navigation';
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { PipelinesPage } from '../pages/pipelines/PipelinesPage';
import { ServicesPage } from '../pages/services/ServicesPage';

export interface RouteDefinition {
  path?: string;
  index?: boolean;
  title: string;
  element: ReactNode;
  children?: RouteDefinition[];
}

const k8sChildRoutes: RouteDefinition[] = [
  { index: true, title: 'K8s 运维', element: <DashboardPage /> },
  { path: 'clusters', title: 'K8s 运维', element: <K8sClusterPage /> },
  { path: 'namespaces', title: 'K8s 运维', element: <K8sNamespacePage /> },
  { path: 'resource-view', title: 'K8s 运维', element: <K8sResourcePage /> },
  ...k8sNavigationItems
    .filter((item) => item.path !== '/k8s' && item.path !== '/k8s/clusters' && item.path !== '/k8s/namespaces' && item.path !== '/k8s/resource-view')
    .map((item) => ({
      path: item.path.replace('/k8s/', ''),
      title: 'K8s 运维',
      element: <K8sPlaceholderPage title={item.label} />,
    })),
];

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/services', title: '服务目录', element: <ServicesPage /> },
  { path: '/onboarding', title: '服务接入', element: <OnboardingPage /> },
  { path: '/logs', title: 'Logs', element: <LogsWorkspace /> },
  { path: '/pipelines', title: '日志 Pipeline', element: <PipelinesPage /> },
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
