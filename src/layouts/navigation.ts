import { Bell, BookOpenCheck, Boxes, GitBranch, LayoutDashboard, RadioTower, ServerCog } from 'lucide-react';
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
  { id: 'onboarding', label: '服务接入', path: '/onboarding', icon: RadioTower, description: '日志接入入口' },
  { id: 'logs', label: 'Logs', path: '/logs', icon: BookOpenCheck, description: 'Explorer、Pipelines 与 Views' },
  { id: 'pipelines', label: 'Pipeline', path: '/pipelines', icon: GitBranch, description: '配置预览与发布闭环' },
  { id: 'k8s', label: 'K8s 运维', path: '/k8s', icon: ServerCog, description: '集群、资源与访问控制' },
  { id: 'alerts', label: '告警中心', path: '/alerts', icon: Bell, description: '规则模型与路由' },
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
