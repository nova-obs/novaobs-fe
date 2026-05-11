import type { ReactNode } from 'react';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { CollectorsPage } from '../pages/collectors/CollectorsPage';
import { AgentDetailPage } from '../pages/collectors/AgentDetailPage';
import LogsWorkspace from '../pages/logs/LogsWorkspace';
import { MetricsPage } from '../pages/metrics/MetricsPage';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { PipelinesPage } from '../pages/pipelines/PipelinesPage';
import { ServicesPage } from '../pages/services/ServicesPage';
import { TracesPage } from '../pages/traces/TracesPage';

export interface RouteDefinition {
  path: string;
  title: string;
  element: ReactNode;
}

export const routeDefinitions: RouteDefinition[] = [
  { path: '/', title: '平台总览', element: <OverviewPage /> },
  { path: '/services', title: '服务目录', element: <ServicesPage /> },
  { path: '/onboarding', title: '服务接入', element: <OnboardingPage /> },
  { path: '/collectors', title: 'Collector Groups', element: <CollectorsPage /> },
  { path: '/collectors/agents/:uid', title: 'Agent Detail', element: <AgentDetailPage /> },
  { path: '/logs', title: 'Logs', element: <LogsWorkspace /> },
  { path: '/pipelines', title: '日志 Pipeline', element: <PipelinesPage /> },
  { path: '/alerts', title: '告警中心', element: <AlertsPage /> },
  { path: '/metrics', title: 'Metrics', element: <MetricsPage /> },
  { path: '/traces', title: 'Traces', element: <TracesPage /> },
];

export const getRouteTitle = (path: string) => {
  return routeDefinitions.find((route) => route.path === path)?.title ?? '平台总览';
};
