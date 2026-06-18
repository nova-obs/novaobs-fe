import { Bell, BookOpenCheck, Boxes, LayoutDashboard, Monitor, ServerCog, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

export const primaryNavigation: NavigationItem[] = [
  { id: 'overview', label: '平台总览', path: '/', icon: LayoutDashboard },
  { id: 'services', label: '服务目录', path: '/services', icon: Boxes },
  { id: 'logs', label: 'Logs', path: '/logs', icon: BookOpenCheck },
  { id: 'monitoring', label: '监控', path: '/monitoring', icon: Monitor },
  { id: 'platform-access', label: '平台管理', path: '/platform', icon: ShieldCheck },
  { id: 'k8s', label: 'K8s 运维', path: '/k8s', icon: ServerCog },
  { id: 'alerts', label: '告警中心', path: '/alerts', icon: Bell },
];

export const getPrimaryNavigation = () => [...primaryNavigation];

export const getNavigationByPath = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  return primaryNavigation.find((item) => (
    item.path === '/'
      ? normalizedPath === '/'
      : normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`)
  ));
};
