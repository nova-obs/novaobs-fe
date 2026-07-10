import { Outlet } from 'react-router-dom';
import { Bell, RadioTower, Search, ServerCog } from 'lucide-react';
import { ModuleWorkbench } from '../../components/navigation/ModuleWorkbench';
import type { ModuleRailItem } from '../../components/navigation/ModuleRail';

const logsEntryRailItems: ModuleRailItem[] = [
  { to: '/logs/explore', label: '日志分析', description: '选择服务后进入日志检索', icon: Search, end: true },
  { to: '/logs/agents', label: '采集路由', description: '选择服务后管理采集路由', icon: ServerCog, end: true },
  { to: '/logs/alerts', label: '日志告警', description: '选择服务后管理日志告警', icon: Bell, end: true },
  { to: '/logs/endpoints', label: '接入配置', description: '维护平台日志下游端点', icon: RadioTower, end: true },
];

export function LogsEntryLayout() {
  return (
    <ModuleWorkbench
      module="logs"
      title="Logs"
      ariaLabel="Logs 模块导航"
      items={logsEntryRailItems}
      remountOnPathChange
    >
      <Outlet />
    </ModuleWorkbench>
  );
}
