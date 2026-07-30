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
    description: '管理登录用户、用户组和成员关系',
    path: '/platform/identities',
    icon: UsersRound,
  },
  {
    id: 'platform-admins',
    section: 'platform-admins',
    label: '平台管理员',
    description: '管理平台控制面管理员授权',
    path: '/platform/admins',
    icon: ShieldCheck,
  },
  {
    id: 'platform-product-access',
    section: 'product-access',
    label: '产品授权',
    description: '按用户组分配产品查看或维护权限',
    path: '/platform/product-access',
    icon: Boxes,
  },
  {
    id: 'platform-k8s-access-profiles',
    section: 'k8s-profiles',
    label: '命名空间权限',
    description: '按集群和命名空间分配只读或维护权限',
    path: '/platform/k8s-access-profiles',
    icon: KeyRound,
  },
  {
    id: 'platform-break-glass',
    section: 'break-glass',
    label: '紧急访问与审计',
    description: '双人审批临时高权限并追踪审计记录',
    path: '/platform/break-glass',
    icon: AlertTriangle,
  },
];
