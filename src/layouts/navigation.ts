import {
  Bell,
  BookOpenCheck,
  Boxes,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Monitor,
  Network,
  RadioTower,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  children?: NavigationItem[];
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
}

export interface NavigationDomain {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  groups: NavigationGroup[];
}

const navigationDomains: NavigationDomain[] = [
  {
    id: 'workspace',
    label: '工作台',
    description: '平台状态与服务视图',
    icon: LayoutDashboard,
    groups: [
      {
        id: 'workspace-core',
        label: '工作区',
        items: [
          { id: 'overview', label: '平台总览', description: '服务、告警与平台状态', path: '/', icon: Gauge },
          { id: 'services', label: '服务目录', description: '服务真值与观测关系', path: '/services', icon: Boxes },
        ],
      },
    ],
  },
  {
    id: 'observability',
    label: '可观测性',
    description: 'Logs、监控、Trace 与告警',
    icon: BookOpenCheck,
    groups: [
      {
        id: 'observability-core',
        label: '观测域',
        items: [
          {
            id: 'logs',
            label: 'Logs',
            description: '日志检索、采集路由与服务级告警',
            path: '/logs',
            icon: FileText,
            children: [
              { id: 'logs-explore', label: '日志分析', description: '检索与分析日志', path: '/logs/explore', icon: Search },
              { id: 'logs-agents', label: '采集路由', description: '采集、发布与运行状态', path: '/logs/agents', icon: ServerCog },
              { id: 'logs-alerts', label: '日志告警', description: '日志匹配与告警规则', path: '/logs/alerts', icon: Bell },
              { id: 'logs-endpoints', label: '接入配置', description: '日志下游端点', path: '/logs/endpoints', icon: RadioTower },
            ],
          },
          { id: 'monitoring', label: '监控', description: '指标与运行信号', path: '/monitoring', icon: Monitor },
          { id: 'traces', label: 'Trace', description: '链路查询、Span 详情与日志反跳', path: '/traces', icon: GitBranch },
          { id: 'alerts', label: '告警', description: '告警实例、通知策略与处置记录', path: '/alerts', icon: Bell },
        ],
      },
    ],
  },
  {
    id: 'k8s',
    label: 'K8s 运维',
    description: '集群接入与工程运维',
    icon: ServerCog,
    groups: [
      {
        id: 'k8s-fleet',
        label: '集群',
        items: [
          {
            id: 'k8s-cluster',
            label: '集群',
            description: '集群总览、登记接入与连接状态',
            path: '/k8s',
            icon: Boxes,
            children: [
              { id: 'k8s-fleet', label: '集群总览', description: '集群登记与连接状态', path: '/k8s', icon: Boxes },
              { id: 'k8s-access', label: '集群接入', description: '登记集群与维护凭据', path: '/k8s/access', icon: Network },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'platform',
    label: '平台管理',
    description: '身份权限与平台配置',
    icon: ShieldCheck,
    groups: [
      {
        id: 'platform-settings',
        label: '平台设置',
        items: [
          { id: 'platform-settings', label: '平台设置', description: '平台级模板与运行配置', path: '/platform/settings', icon: Settings },
          { id: 'platform-access', label: '访问控制', description: '用户、组、角色与授权', path: '/platform/access', icon: ShieldCheck },
        ],
      },
    ],
  },
];

const flattenNavigationItems = (items: NavigationItem[]): NavigationItem[] => items.flatMap((item) => [
  item,
  ...flattenNavigationItems(item.children ?? []),
]);

const allNavigationItems = navigationDomains.flatMap((domain) => (
  domain.groups.flatMap((group) => flattenNavigationItems(group.items))
));

export const getNavigationDomains = () => navigationDomains.map((domain) => ({
  ...domain,
  groups: domain.groups.map((group) => ({
    ...group,
    items: group.items.map(cloneNavigationItem),
  })),
}));

function cloneNavigationItem(item: NavigationItem): NavigationItem {
  return {
    ...item,
    children: item.children?.map(cloneNavigationItem),
  };
}

export const getNavigationByPath = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  if (normalizedPath.startsWith('/agents/') || normalizedPath === '/onboarding') {
    return allNavigationItems.find((item) => item.id === 'logs-agents');
  }
  if (normalizedPath === '/observability/endpoints') {
    return allNavigationItems.find((item) => item.id === 'logs-endpoints');
  }
  return [...allNavigationItems]
    .sort((left, right) => {
      const pathDelta = right.path.length - left.path.length;
      if (pathDelta !== 0) return pathDelta;
      return Number(Boolean(left.children?.length)) - Number(Boolean(right.children?.length));
    })
    .find((item) => (
      item.path === '/'
        ? normalizedPath === '/'
        : normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`)
    ));
};

export const getNavigationDomainByPath = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  if (
    normalizedPath.startsWith('/logs')
    || normalizedPath.startsWith('/agents/')
    || normalizedPath === '/onboarding'
    || normalizedPath.startsWith('/observability')
    || normalizedPath.startsWith('/monitoring')
    || normalizedPath.startsWith('/traces')
    || normalizedPath.startsWith('/alerts')
  ) {
    return navigationDomains.find((domain) => domain.id === 'observability');
  }
  if (normalizedPath.startsWith('/k8s')) {
    return navigationDomains.find((domain) => domain.id === 'k8s');
  }
  if (normalizedPath.startsWith('/platform')) {
    return navigationDomains.find((domain) => domain.id === 'platform');
  }
  if (normalizedPath === '/' || normalizedPath.startsWith('/services')) {
    return navigationDomains.find((domain) => domain.id === 'workspace');
  }
  return undefined;
};
