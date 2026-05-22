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
  group: string;
  icon: LucideIcon;
  description: string;
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
  { id: 'dashboard', label: 'Dashboard', path: '/k8s', group: 'overview', icon: Gauge, description: '集群态势与同步状态' },
  { id: 'clusters', label: '集群管理', path: '/k8s/clusters', group: 'resources', icon: Network, description: '集群连接与健康检查' },
  { id: 'namespaces', label: '命名空间', path: '/k8s/namespaces', group: 'resources', icon: Folder, description: '租户边界与资源域' },
  { id: 'runtime-topology', label: '运行时拓扑', path: '/k8s/runtime-topology', group: 'resources', icon: GitBranch, description: 'Service、Workload 与 Istio 治理关系' },
  { id: 'platform-access', label: '访问授权', path: '/k8s/platform-access', group: 'access', icon: UserRoundCog, description: '消费平台 IAM 主体并授予 K8s 权限' },
  { id: 'service-accounts', label: 'ServiceAccount', path: '/k8s/service-accounts', group: 'access', icon: ShieldUser, description: '服务身份与权限' },
  { id: 'rbac', label: 'RBAC', path: '/k8s/rbac', group: 'access', icon: ShieldCheck, description: 'Role 与 Binding' },
  { id: 'kubeconfig', label: 'Kubeconfig', path: '/k8s/kubeconfig', group: 'access', icon: KeyRound, description: '访问凭据托管' },
  { id: 'resource-view', label: '资源视图', path: '/k8s/resource-view', group: 'delivery', icon: Grid3X3, description: '资源拓扑与状态' },
  { id: 'templates', label: '模板管理', path: '/k8s/templates', group: 'delivery', icon: ScrollText, description: 'YAML 模板与参数' },
  { id: 'releases', label: '发布部署', path: '/k8s/releases', group: 'delivery', icon: Layers3, description: '部署编排与发布' },
  { id: 'deploy-history', label: '部署历史', path: '/k8s/deploy-history', group: 'delivery', icon: History, description: '发布记录与回滚' },
  { id: 'audit', label: '操作审计', path: '/k8s/audit', group: 'delivery', icon: FileClock, description: '变更审计与追踪' },
  { id: 'certificates', label: '证书中心', path: '/k8s/certificates', group: 'security', icon: FileKey2, description: '证书与过期风险' },
  { id: 'terminal', label: '受控终端', path: '/k8s/terminal', group: 'security', icon: SquareTerminal, description: '只读命令与审计' },
];

export const getK8sNavigationByPath = (path: string) => {
  const normalizedPath = path.split('?')[0] || '/k8s';
  return [...k8sNavigationItems]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`));
};

export const getK8sNavigationGroupItems = (groupId: string) => (
  k8sNavigationItems.filter((item) => item.group === groupId)
);
