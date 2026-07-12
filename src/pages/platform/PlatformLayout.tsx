import { Outlet } from 'react-router-dom';
import { Layers3, Settings, ShieldCheck } from 'lucide-react';
import { ModuleWorkbench } from '../../components/navigation/ModuleWorkbench';
import type { ModuleRailItem } from '../../components/navigation/ModuleRail';

const platformRailItems: ModuleRailItem[] = [
  { to: '/platform/environments', label: '环境管理', description: '统一环境身份与运行资源归属', icon: Layers3 },
  { to: '/platform/settings', label: '平台设置', description: '镜像模板与平台级运行配置', icon: Settings },
  { to: '/platform/access', label: '访问控制', description: '平台用户、角色与授权', icon: ShieldCheck },
];

export function PlatformLayout() {
  return (
    <ModuleWorkbench module="platform" title="平台管理" ariaLabel="平台管理导航" items={platformRailItems}>
      <Outlet />
    </ModuleWorkbench>
  );
}
