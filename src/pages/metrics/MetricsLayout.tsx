import { Outlet } from 'react-router-dom';
import { Activity, BarChart3, Bell, Database, Gauge, RadioTower } from 'lucide-react';
import { ModuleWorkbench } from '../../components/navigation/ModuleWorkbench';
import type { ModuleRailItem } from '../../components/navigation/ModuleRail';

const metricsRailItems: ModuleRailItem[] = [
  { to: '/metrics/explore', label: '指标查询', description: '按服务作用域查看指标查询入口', icon: Activity },
  { to: '/metrics/alerts', label: '指标告警', description: '指标规则与告警入口', icon: Bell, end: true },
  { to: '/metrics/dashboards', label: 'Dashboard', description: 'Grafana 目录与受控代理入口', icon: BarChart3, end: true },
  { to: '/metrics/collection', label: '采集接入', description: 'Collector 接入与服务作用域绑定', icon: RadioTower, end: true },
  { to: '/metrics/overview', label: '监控总览', description: '服务指标健康与接入状态', icon: Gauge, end: true },
  { to: '/metrics/endpoints', label: '接入端点', description: '指标下游端点目录', icon: Database, end: true },
];

export function MetricsLayout() {
  return (
    <ModuleWorkbench module="metrics" title="监控" ariaLabel="Metrics 模块导航" items={metricsRailItems}>
      <Outlet />
    </ModuleWorkbench>
  );
}
