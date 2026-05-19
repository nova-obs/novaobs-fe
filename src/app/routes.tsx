import type { ReactNode } from 'react';
import { AgentDetailPage } from '../pages/agents/AgentDetailPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { K8sOpsLayout } from '../pages/k8s/K8sOpsLayout';
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { PipelinesPage } from '../pages/pipelines/PipelinesPage';
import { ServicesPage } from '../pages/services/ServicesPage';

export interface RouteDefinition {
  path: string;
  title: string;
  element: ReactNode;
}

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/services', title: '服务目录', element: <ServicesPage /> },
  { path: '/onboarding', title: '服务接入', element: <OnboardingPage /> },
  { path: '/logs', title: 'Logs', element: <LogsWorkspace /> },
  { path: '/pipelines', title: '日志 Pipeline', element: <PipelinesPage /> },
  { path: '/k8s/*', title: 'K8s 运维', element: <K8sOpsLayout /> },
  { path: '/agents/:uid', title: 'Agent Detail', element: <AgentDetailPage /> },
  { path: '/alerts', title: '告警中心', element: <AlertsPage /> },
];

export const getRouteTitle = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  if (normalizedPath.startsWith('/agents/')) return 'Agent Detail';
  const route = routeDefinitions.find((item) => {
    if (item.path.endsWith('/*')) {
      const basePath = item.path.slice(0, -2);
      return normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`);
    }
    return item.path === normalizedPath;
  });
  return route?.title ?? '平台总览';
};

export const getDocumentTitle = (path: string) => `${getRouteTitle(path)} - NovaObs`;
