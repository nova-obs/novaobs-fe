import {
  Boxes,
  FileClock,
  FileKey2,
  Folder,
  Gauge,
  GitBranch,
  Grid3X3,
  History,
  KeyRound,
  Layers3,
  Network,
  ScrollText,
  ShieldCheck,
  ShieldUser,
  SquareTerminal,
  UserRoundCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface K8sNavigationItem {
  id: string;
  label: string;
  path: string;
  segment: string;
  group: string;
  icon: LucideIcon;
  requiresCluster?: boolean;
}

export interface K8sNavigationGroup {
  id: string;
  label: string;
}

export const k8sNavigationGroups: K8sNavigationGroup[] = [
  { id: 'overview', label: '总览' },
  { id: 'resources', label: '资源' },
  { id: 'access', label: '访问控制' },
  { id: 'delivery', label: '交付运维' },
  { id: 'security', label: '安全' },
];

export const k8sNavigationItems: K8sNavigationItem[] = [
  { id: 'fleet', label: '集群总览', path: '/k8s', segment: '', group: 'overview', icon: Boxes },
  { id: 'access-entry', label: '集群接入', path: '/k8s/access', segment: 'access', group: 'overview', icon: Network },
  { id: 'dashboard', label: 'Dashboard', path: '/k8s/clusters/:clusterId', segment: '', group: 'overview', icon: Gauge, requiresCluster: true },
  { id: 'namespaces', label: '命名空间', path: '/k8s/clusters/:clusterId/namespaces', segment: 'namespaces', group: 'resources', icon: Folder, requiresCluster: true },
  { id: 'runtime-topology', label: '运行时拓扑', path: '/k8s/clusters/:clusterId/runtime-topology', segment: 'runtime-topology', group: 'resources', icon: GitBranch, requiresCluster: true },
  { id: 'cluster-credentials', label: '接入凭据', path: '/k8s/clusters/:clusterId/credentials', segment: 'credentials', group: 'access', icon: KeyRound, requiresCluster: true },
  { id: 'platform-access', label: '访问授权', path: '/k8s/clusters/:clusterId/platform-access', segment: 'platform-access', group: 'access', icon: UserRoundCog, requiresCluster: true },
  { id: 'service-accounts', label: 'ServiceAccount', path: '/k8s/clusters/:clusterId/service-accounts', segment: 'service-accounts', group: 'access', icon: ShieldUser, requiresCluster: true },
  { id: 'rbac', label: 'RBAC', path: '/k8s/clusters/:clusterId/rbac', segment: 'rbac', group: 'access', icon: ShieldCheck, requiresCluster: true },
  { id: 'kubeconfig', label: 'Kubeconfig', path: '/k8s/clusters/:clusterId/kubeconfig', segment: 'kubeconfig', group: 'access', icon: KeyRound, requiresCluster: true },
  { id: 'resource-view', label: '资源视图', path: '/k8s/clusters/:clusterId/resource-view', segment: 'resource-view', group: 'delivery', icon: Grid3X3, requiresCluster: true },
  { id: 'templates', label: '模板管理', path: '/k8s/clusters/:clusterId/templates', segment: 'templates', group: 'delivery', icon: ScrollText, requiresCluster: true },
  { id: 'releases', label: '发布部署', path: '/k8s/clusters/:clusterId/releases', segment: 'releases', group: 'delivery', icon: Layers3, requiresCluster: true },
  { id: 'deploy-history', label: '部署历史', path: '/k8s/clusters/:clusterId/deploy-history', segment: 'deploy-history', group: 'delivery', icon: History, requiresCluster: true },
  { id: 'audit', label: '操作审计', path: '/k8s/clusters/:clusterId/audit', segment: 'audit', group: 'delivery', icon: FileClock, requiresCluster: true },
  { id: 'certificates', label: '证书中心', path: '/k8s/clusters/:clusterId/certificates', segment: 'certificates', group: 'security', icon: FileKey2, requiresCluster: true },
  { id: 'terminal', label: '受控终端', path: '/k8s/clusters/:clusterId/terminal', segment: 'terminal', group: 'security', icon: SquareTerminal, requiresCluster: true },
];

export const getK8sNavigationByPath = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/k8s';
  if (normalizedPath === '/k8s' || normalizedPath === '/k8s/clusters') {
    return k8sNavigationItems.find((item) => item.id === 'fleet');
  }
  if (normalizedPath === '/k8s/access') {
    return k8sNavigationItems.find((item) => item.id === 'access-entry');
  }
  const clusterMatch = /^\/k8s\/clusters\/[^/]+(?:\/([^/]+))?/.exec(normalizedPath);
  if (clusterMatch) {
    const segment = clusterMatch[1] ?? '';
    return k8sNavigationItems.find((item) => item.requiresCluster && item.segment === segment);
  }
  return [...k8sNavigationItems]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`));
};

export const getK8sNavigationGroupItems = (groupId: string) => (
  k8sNavigationItems.filter((item) => item.group === groupId)
);

export const k8sClusterPath = (clusterId: string, item: K8sNavigationItem) => {
  if (!item.requiresCluster) {
    return item.path;
  }
  const encoded = encodeURIComponent(clusterId);
  return item.segment ? `/k8s/clusters/${encoded}/${item.segment}` : `/k8s/clusters/${encoded}`;
};
