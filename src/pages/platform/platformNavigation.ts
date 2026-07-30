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
    label: '用户与服务身份',
    description: '管理用户、用户组与服务账号',
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
    description: '管理产品边界的主体访问能力',
    path: '/platform/product-access',
    icon: Boxes,
  },
  {
    id: 'platform-k8s-access-profiles',
    section: 'k8s-profiles',
    label: 'K8S Access Profile',
    description: '管理 Namespace 访问模板与用户组授权',
    path: '/platform/k8s-access-profiles',
    icon: KeyRound,
  },
  {
    id: 'platform-break-glass',
    section: 'break-glass',
    label: 'Break Glass 与审计',
    description: '审批紧急访问并追踪审计记录',
    path: '/platform/break-glass',
    icon: AlertTriangle,
  },
];
