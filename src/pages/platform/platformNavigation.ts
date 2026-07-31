import {
  AlertTriangle,
  Boxes,
  KeyRound,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PlatformAccessSection =
  | 'identities'
  | 'platform-admins'
  | 'product-access'
  | 'k8s-profiles'
  | 'break-glass';

export interface PlatformAccessNavigationItem {
  id: string;
  section: PlatformAccessSection;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export const platformAccessNavigationItems: readonly PlatformAccessNavigationItem[] = [
  {
    id: 'platform-identities',
    section: 'identities',
    label: '用户与用户组',
    description: '管理登录用户、用户组及成员关系',
    path: '/platform/identities',
    icon: UsersRound,
  },
  {
    id: 'platform-admins',
    section: 'platform-admins',
    label: '平台管理员授权',
    description: '授予或撤销平台控制面管理权限',
    path: '/platform/admins',
    icon: ShieldCheck,
  },
  {
    id: 'platform-product-access',
    section: 'product-access',
    label: '产品访问授权',
    description: '按用户组授予产品查看或维护权限',
    path: '/platform/product-access',
    icon: Boxes,
  },
  {
    id: 'platform-k8s-access-profiles',
    section: 'k8s-profiles',
    label: 'K8s 集群授权',
    description: '按集群、权限级别和命名空间授权用户组',
    path: '/platform/k8s-access-profiles',
    icon: KeyRound,
  },
  {
    id: 'platform-break-glass',
    section: 'break-glass',
    label: 'K8s 紧急访问',
    description: '审批临时集群高权限并查看审计记录',
    path: '/platform/break-glass',
    icon: AlertTriangle,
  },
];
