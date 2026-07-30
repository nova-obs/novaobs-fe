import { Outlet } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { ModuleWorkbench } from '../../components/navigation/ModuleWorkbench';
import type { ModuleRailItem } from '../../components/navigation/ModuleRail';
import { platformAccessNavigationItems } from './platformNavigation';

const platformRailItems: ModuleRailItem[] = [
  { to: '/platform/settings', label: '平台设置', description: '镜像模板与平台级运行配置', icon: Settings, end: true },
  ...platformAccessNavigationItems.map((item) => ({
    to: item.path,
    label: item.label,
    description: item.description,
    icon: item.icon,
    end: true,
  })),
];

export function PlatformLayout() {
  return (
    <ModuleWorkbench module="platform" title="平台管理" ariaLabel="平台管理导航" items={platformRailItems}>
      <Outlet />
    </ModuleWorkbench>
  );
}
