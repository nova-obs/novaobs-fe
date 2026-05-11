import { Activity, Bell, BookOpenCheck, Boxes, LayoutDashboard, Network, RadioTower } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
}

export const primaryNavigation: NavigationItem[] = [
  { id: 'overview', label: '平台总览', path: '/', icon: LayoutDashboard, description: '统一控制面摘要' },
  { id: 'services', label: '服务目录', path: '/services', icon: Boxes, description: 'CMDB 服务控制面' },
  { id: 'onboarding', label: '服务接入', path: '/onboarding', icon: RadioTower, description: '日志、告警、Metrics 与 Trace 接入' },
  { id: 'logs', label: 'Logs', path: '/logs', icon: BookOpenCheck, description: 'Explorer、Pipelines 与 Views' },
  { id: 'alerts', label: '告警中心', path: '/alerts', icon: Bell, description: '规则模型与路由' },
  { id: 'metrics', label: 'Metrics', path: '/metrics', icon: Activity, description: '指标入口' },
  { id: 'traces', label: 'Traces', path: '/traces', icon: Network, description: '链路入口' },
];

export const getPrimaryNavigation = () => [...primaryNavigation];

export const getNavigationByPath = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  return primaryNavigation.find((item) => item.path === normalizedPath);
};
