import { Outlet } from 'react-router-dom';
import { Activity, BarChart3, Bell, Database, Gauge, RadioTower } from 'lucide-react';
import { ModuleWorkbench } from '../../components/navigation/ModuleWorkbench';
import type { ModuleRailItem } from '../../components/navigation/ModuleRail';

const metricsEntryRailItems: ModuleRailItem[] = [
  { to: '/metrics/explore', label: '指标查询', description: '选择服务后查询指标', icon: Activity, end: true },
  { to: '/metrics/alerts', label: '指标告警', description: '选择服务后管理指标告警', icon: Bell, end: true },
  { to: '/metrics/dashboards', label: 'Dashboard', description: '选择服务后查看 Dashboard', icon: BarChart3, end: true },
  { to: '/metrics/routes', label: '采集路由', description: '选择服务后配置指标采集', icon: RadioTower, end: true },
  { to: '/metrics/overview', label: '监控总览', description: '选择服务后查看监控总览', icon: Gauge, end: true },
  { to: '/metrics/endpoints', label: '接入端点', description: '选择服务后管理指标端点', icon: Database, end: true },
];

export function MetricsEntryLayout() {
  return (
    <ModuleWorkbench module="metrics" title="监控" ariaLabel="Metrics 模块导航" items={metricsEntryRailItems}>
      <Outlet />
    </ModuleWorkbench>
  );
}
