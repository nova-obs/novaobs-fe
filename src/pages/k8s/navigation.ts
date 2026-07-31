import {
  Boxes,
  FileClock,
  Folder,
  Gauge,
  GitBranch,
  Grid3X3,
  History,
  Layers3,
  SquareTerminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { accessAllows, type AccessRequirement } from '../../layouts/access';
import type { PlatformAccessContext } from '../platform/accessApi';

export interface K8sNavigationItem {
  id: string;
  label: string;
  path: string;
  segment: string;
  group: string;
  icon: LucideIcon;
  requiresCluster?: boolean;
  requiredAccess: AccessRequirement;
}

export interface K8sNavigationGroup {
  id: string;
  label: string;
}

export const k8sNavigationGroups: K8sNavigationGroup[] = [
  { id: 'overview', label: '总览' },
  { id: 'resources', label: '资源' },
  { id: 'delivery', label: '交付运维' },
  { id: 'security', label: '安全' },
];

export const k8sNavigationItems: K8sNavigationItem[] = [
  { id: 'fleet', label: '集群总览', path: '/k8s', segment: '', group: 'overview', icon: Boxes, requiredAccess: { kind: 'k8s-module' } },
  { id: 'dashboard', label: 'Dashboard', path: '/k8s/clusters/:clusterId', segment: '', group: 'overview', icon: Gauge, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'developer' } },
  { id: 'namespaces', label: '命名空间', path: '/k8s/clusters/:clusterId/namespaces', segment: 'namespaces', group: 'resources', icon: Folder, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'developer' } },
  { id: 'runtime-topology', label: '运行时拓扑', path: '/k8s/clusters/:clusterId/runtime-topology', segment: 'runtime-topology', group: 'resources', icon: GitBranch, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'developer' } },
  { id: 'resource-view', label: '资源视图', path: '/k8s/clusters/:clusterId/resource-view', segment: 'resource-view', group: 'delivery', icon: Grid3X3, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'developer' } },
  { id: 'releases', label: '发布部署', path: '/k8s/clusters/:clusterId/releases', segment: 'releases', group: 'delivery', icon: Layers3, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'namespace-maintainer' } },
  { id: 'deploy-history', label: '部署历史', path: '/k8s/clusters/:clusterId/deploy-history', segment: 'deploy-history', group: 'delivery', icon: History, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'developer' } },
  { id: 'audit', label: '操作审计', path: '/k8s/clusters/:clusterId/audit', segment: 'audit', group: 'delivery', icon: FileClock, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'developer' } },
  { id: 'terminal', label: '受控终端', path: '/k8s/clusters/:clusterId/terminal', segment: 'terminal', group: 'security', icon: SquareTerminal, requiresCluster: true, requiredAccess: { kind: 'k8s', minimum: 'namespace-maintainer' } },
];

export const getK8sNavigationByPath = (path: string, access?: PlatformAccessContext | null) => {
  const normalizedPath = path.split('?')[0] || '/k8s';
  const activeClusterId = /^\/k8s\/clusters\/([^/]+)/.exec(normalizedPath)?.[1] ?? '';
  const availableItems = access === undefined ? k8sNavigationItems : getVisibleK8sNavigationItems(access, decodeURIComponent(activeClusterId));
  if (normalizedPath === '/k8s' || normalizedPath === '/k8s/clusters') {
    return availableItems.find((item) => item.id === 'fleet');
  }
  const clusterMatch = /^\/k8s\/clusters\/[^/]+(?:\/([^/]+))?/.exec(normalizedPath);
  if (clusterMatch) {
    const segment = clusterMatch[1] ?? '';
    return availableItems.find((item) => item.requiresCluster && item.segment === segment);
  }
  return [...availableItems]
    .filter((item) => item.path !== '/k8s')
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`));
};

export const getK8sNavigationGroupItems = (groupId: string, access?: PlatformAccessContext | null, clusterId = '') => (
  (access === undefined ? k8sNavigationItems : getVisibleK8sNavigationItems(access, clusterId))
    .filter((item) => item.group === groupId)
);

export const getVisibleK8sNavigationItems = (access: PlatformAccessContext | null, clusterId = '') => {
  if (!access) return [];
  return k8sNavigationItems.filter((item) => accessAllows(access, resolveK8sRequirement(item.requiredAccess, clusterId)));
};

export const k8sClusterPath = (clusterId: string, item: K8sNavigationItem) => {
  if (!item.requiresCluster) {
    return item.path;
  }
  const encoded = encodeURIComponent(clusterId);
  return item.segment ? `/k8s/clusters/${encoded}/${item.segment}` : `/k8s/clusters/${encoded}`;
};

function resolveK8sRequirement(requirement: AccessRequirement, clusterId: string): AccessRequirement {
  if (requirement.kind === 'k8s') return { ...requirement, clusterId };
  return requirement;
}
