import {
  Bell,
  BookOpenCheck,
  Boxes,
  Activity,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Layers3,
  Monitor,
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
    description: 'Logs、监控与 Trace',
    icon: BookOpenCheck,
    groups: [
      {
        id: 'observability-core',
        label: '观测域',
        items: [
          {
            id: 'logs',
            label: 'Logs',
            description: '检索、采集与日志告警',
            path: '/logs',
            icon: FileText,
			children: [
			  { id: 'logs-explore', label: '日志分析', description: '选择服务并检索原始日志', path: '/logs/explore', icon: Search },
			  { id: 'logs-agents', label: '日志采集', description: '管理服务日志采集与发布', path: '/logs/agents', icon: ServerCog },
			  { id: 'logs-alerts', label: '日志告警', description: '管理服务级日志告警规则', path: '/logs/alerts', icon: Bell },
			],
          },
          {
            id: 'metrics',
            label: '监控',
            description: '指标观测与环境接入',
            path: '/metrics',
            icon: Monitor,
            children: [
              { id: 'metrics-overview', label: '监控总览', description: '查看环境接入健康与关键信号', path: '/metrics/overview', icon: Gauge },
              { id: 'metrics-dashboard', label: 'Dashboard', description: '打开 Grafana 工作区', path: '/metrics/dashboard', icon: LayoutDashboard },
              { id: 'metrics-alerts', label: '指标告警', description: '管理环境级指标告警规则', path: '/metrics/alerts', icon: Bell },
              { id: 'metrics-environments', label: '环境接入', description: '管理环境指标来源和写入目标', path: '/metrics/environments', icon: RadioTower },
            ],
          },
          { id: 'traces', label: 'Trace', description: '链路查询与 Span 分析', path: '/traces', icon: GitBranch },
          {
            id: 'observability-endpoints',
            label: '接入配置',
            description: '管理日志与指标下游',
            path: '/observability/endpoints/logs',
            icon: RadioTower,
            children: [
              { id: 'observability-logs-endpoints', label: 'Logs 下游端点', description: '管理日志写入与查询端点', path: '/observability/endpoints/logs', icon: FileText },
              { id: 'observability-metrics-endpoints', label: '指标下游端点', description: '管理指标写入与查询端点', path: '/observability/endpoints/metrics', icon: Activity },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'k8s',
    label: 'K8s 运维',
    description: '集群总览与工程运维',
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
              { id: 'k8s-observability', label: '观测接入', description: '启用集群级可观测性运行时', path: '/k8s/observability', icon: Activity },
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
          { id: 'platform-environments', label: '环境管理', description: '统一环境身份与运行资源归属', path: '/platform/environments', icon: Layers3 },
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
	const metricsEntryMatch = normalizedPath.match(/^\/metrics\/([^/]+)/);
	if (metricsEntryMatch && !metricsNavigationChildID(metricsEntryMatch[1])) {
		return metricsEntryMatch[1] === 'explore' ? allNavigationItems.find((item) => item.id === 'metrics') : undefined;
	}
	const logsServiceMatch = normalizedPath.match(/^\/products\/[^/]+\/services\/[^/]+\/logs(?:\/([^/]+))?/);
	if (logsServiceMatch) {
		const childID = logsNavigationChildID(logsServiceMatch[1] ?? '');
		return allNavigationItems.find((item) => item.id === (childID || 'logs'));
	}
	const metricsServiceMatch = normalizedPath.match(/^\/products\/[^/]+\/services\/[^/]+\/metrics(?:\/([^/]+))?/);
	if (metricsServiceMatch) {
		const childID = metricsNavigationChildID(metricsServiceMatch[1] ?? '');
		return allNavigationItems.find((item) => item.id === (childID || 'metrics'));
	}
  if (normalizedPath === '/k8s/access') {
    return undefined;
  }
  if (normalizedPath.startsWith('/agents/') || normalizedPath === '/onboarding') {
    return allNavigationItems.find((item) => item.id === 'logs-agents');
  }
  if (normalizedPath === '/observability/endpoints' || normalizedPath === '/logs/endpoints') {
    return allNavigationItems.find((item) => item.id === 'observability-logs-endpoints');
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

function logsNavigationChildID(segment: string): string | undefined {
	if (segment === 'explore') return 'logs-explore';
	if (segment === 'agents' || segment === 'onboarding') return 'logs-agents';
	if (segment === 'alerts') return 'logs-alerts';
	if (segment === 'endpoints') return 'observability-logs-endpoints';
	return undefined;
}

function metricsNavigationChildID(segment: string): string | undefined {
	if (segment === 'overview') return 'metrics-overview';
	if (segment === 'dashboard') return 'metrics-dashboard';
	if (segment === 'alerts') return 'metrics-alerts';
	if (segment === 'environments') return 'metrics-environments';
	return undefined;
}

export const getNavigationDomainByPath = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/';
  if (
    normalizedPath.startsWith('/logs')
    || normalizedPath.startsWith('/agents/')
    || normalizedPath === '/onboarding'
    || normalizedPath.startsWith('/observability')
    || normalizedPath.startsWith('/metrics')
    || normalizedPath.startsWith('/traces')
    || normalizedPath.startsWith('/alerts')
	|| /^\/products\/[^/]+\/services\/[^/]+\/(?:logs|metrics)(?:\/|$)/.test(normalizedPath)
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
