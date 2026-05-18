import type { ReactNode } from 'react';
import { AgentDetailPage } from '../pages/agents/AgentDetailPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
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
  { path: '/agents/:uid', title: 'Agent Detail', element: <AgentDetailPage /> },
  { path: '/alerts', title: '告警中心', element: <AlertsPage /> },
];

export const getRouteTitle = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  if (normalizedPath.startsWith('/agents/')) return 'Agent Detail';
  return routeDefinitions.find((route) => route.path === normalizedPath)?.title ?? '平台总览';
};

export const getDocumentTitle = (path: string) => `${getRouteTitle(path)} - NovaObs`;
