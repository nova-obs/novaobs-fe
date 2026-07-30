import {
  Bell,
  BookOpenCheck,
  Boxes,
  Activity,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Monitor,
  RadioTower,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlatformAccessContext } from '../pages/platform/accessApi';
import { platformAccessNavigationItems } from '../pages/platform/platformNavigation';

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
          { id: 'products', label: '产品与服务', description: '产品边界与逻辑服务', path: '/products', icon: Boxes },
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
            description: '指标观测与产品接入',
            path: '/metrics',
            icon: Monitor,
            children: [
              { id: 'metrics-overview', label: '监控总览', description: '查看产品指标健康与关键信号', path: '/metrics/overview', icon: Gauge },
              { id: 'metrics-dashboard', label: 'Dashboard', description: '打开 Grafana 工作区', path: '/metrics/dashboard', icon: LayoutDashboard },
              { id: 'metrics-alerts', label: '指标告警', description: '管理产品级指标告警规则', path: '/metrics/alerts', icon: Bell },
              { id: 'metrics-integrations', label: '指标接入', description: '管理产品指标来源和写入目标', path: '/metrics/integrations', icon: RadioTower },
            ],
          },
          { id: 'traces', label: 'Trace', description: '链路查询与 Span 分析', path: '/traces', icon: GitBranch },
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
            description: '查看 Profile 授权的集群与工作负载',
            path: '/k8s',
            icon: Boxes,
            children: [
              { id: 'k8s-fleet', label: '集群总览', description: '查看有效授权范围', path: '/k8s', icon: Boxes },
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
          {
            id: 'platform-access',
            label: '权限控制',
            description: '用户、服务身份与固定授权',
            path: '/platform/access',
            icon: ShieldCheck,
            children: platformAccessNavigationItems.map((item) => ({
              id: item.id,
              label: item.label,
              description: item.description,
              path: item.path,
              icon: item.icon,
            })),
          },
          { id: 'platform-k8s-clusters', label: 'K8s 集群接入', description: '登记集群并管理控制面凭据', path: '/platform/k8s-clusters', icon: ServerCog },
          {
            id: 'platform-observability-endpoints',
            label: '共享观测端点',
            description: '管理日志与指标共享下游',
            path: '/platform/observability/endpoints/logs',
            icon: RadioTower,
            children: [
              { id: 'platform-observability-logs-endpoints', label: 'Logs 下游端点', description: '管理日志写入与查询端点', path: '/platform/observability/endpoints/logs', icon: FileText },
              { id: 'platform-observability-metrics-endpoints', label: '指标下游端点', description: '管理指标写入与查询端点', path: '/platform/observability/endpoints/metrics', icon: Activity },
            ],
          },
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

export const getNavigationDomains = (access?: PlatformAccessContext | null) => navigationDomains
  .map((domain) => ({
    ...domain,
    groups: domain.groups
      .map((group) => ({
        ...group,
        items: group.items
          .map(cloneNavigationItem)
          .map((item) => filterNavigationItem(item, access))
          .filter((item): item is NavigationItem => Boolean(item)),
      }))
      .filter((group) => group.items.length > 0),
  }))
  .filter((domain) => domain.groups.length > 0);

function cloneNavigationItem(item: NavigationItem): NavigationItem {
  return {
    ...item,
    children: item.children?.map(cloneNavigationItem),
  };
}

export const getNavigationByPath = (path: string, access?: PlatformAccessContext | null) => {
  const normalizedPath = path.split('?')[0] || '/';
  const availableItems = access === undefined
    ? allNavigationItems
    : getNavigationDomains(access).flatMap((domain) => domain.groups.flatMap((group) => flattenNavigationItems(group.items)));
	const metricsEntryMatch = normalizedPath.match(/^\/metrics\/([^/]+)/);
	if (metricsEntryMatch && !metricsNavigationChildID(metricsEntryMatch[1])) {
		return metricsEntryMatch[1] === 'explore' ? availableItems.find((item) => item.id === 'metrics') : undefined;
	}
	const logsServiceMatch = normalizedPath.match(/^\/products\/[^/]+\/services\/[^/]+\/logs(?:\/([^/]+))?/);
	if (logsServiceMatch) {
		const childID = logsNavigationChildID(logsServiceMatch[1] ?? '');
		return availableItems.find((item) => item.id === (childID || 'logs'));
	}
	const metricsServiceMatch = normalizedPath.match(/^\/products\/[^/]+\/services\/[^/]+\/metrics(?:\/([^/]+))?/);
	if (metricsServiceMatch) {
		const childID = metricsNavigationChildID(metricsServiceMatch[1] ?? '');
		return availableItems.find((item) => item.id === (childID || 'metrics'));
	}
  if (normalizedPath.startsWith('/k8s/')) {
    if (normalizedPath.startsWith('/k8s/clusters/')) {
      return availableItems.find((item) => item.id === 'k8s-fleet');
    }
    return undefined;
  }
  if (normalizedPath.startsWith('/agents/') || normalizedPath === '/onboarding') {
    return availableItems.find((item) => item.id === 'logs-agents');
  }
  if (normalizedPath === '/observability/endpoints' || normalizedPath === '/logs/endpoints') {
    return availableItems.find((item) => item.id === 'observability-logs-endpoints');
  }
  return [...availableItems]
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
	if (segment === 'integrations') return 'metrics-integrations';
	return undefined;
}

export const getNavigationDomainByPath = (path: string, access?: PlatformAccessContext | null) => {
  const normalizedPath = path.split('?')[0] || '/';
  const visibleDomains = access === undefined ? navigationDomains : getNavigationDomains(access);
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
    return visibleDomains.find((domain) => domain.id === 'observability');
  }
  if (normalizedPath.startsWith('/k8s')) {
    return visibleDomains.find((domain) => domain.id === 'k8s');
  }
  if (normalizedPath.startsWith('/platform')) {
    return visibleDomains.find((domain) => domain.id === 'platform');
  }
  if (normalizedPath === '/' || normalizedPath.startsWith('/services') || normalizedPath.startsWith('/products')) {
    return visibleDomains.find((domain) => domain.id === 'workspace');
  }
  return undefined;
};

function filterNavigationItem(item: NavigationItem, access?: PlatformAccessContext | null): NavigationItem | null {
  if (access === undefined) return item;
  const visible = navigationItemVisible(item.id, access);
  if (!visible) return null;
  const children = item.children
    ?.map((child) => filterNavigationItem(child, access))
    .filter((child): child is NavigationItem => Boolean(child));
  if (item.children?.length && !children?.length) return null;
  return { ...item, children };
}

function navigationItemVisible(itemId: string, access: PlatformAccessContext | null) {
  if (!access) return itemId === 'overview';
  const hasProducts = access.productAccesses.length > 0;
  const hasK8s = access.k8sProfiles.some((profile) => profile.status === 'active')
    || (access.k8sBreakGlass ?? []).some((grant) => new Date(grant.expiresAt).getTime() > Date.now());
  if (itemId === 'overview') return true;
  if (itemId === 'products') return access.platformAdmin || hasProducts || access.modules.products === 'read' || access.modules.products === 'manage';
  if (itemId === 'logs' || itemId.startsWith('logs-')) return access.modules.logs === 'read' || access.modules.logs === 'manage';
  if (itemId === 'metrics' || itemId.startsWith('metrics-')) return access.modules.metrics === 'read' || access.modules.metrics === 'manage';
  if (itemId === 'traces') return access.modules.traces === 'read' || access.modules.traces === 'manage';
  if (itemId === 'k8s-cluster' || itemId === 'k8s-fleet') return hasK8s;
  if (itemId === 'k8s-observability') return false;
  if (itemId.startsWith('platform-')) return access.platformAdmin;
  return false;
}
