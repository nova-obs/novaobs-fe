import { Outlet } from 'react-router-dom';
import { Activity, BarChart3, Bell, Database, Gauge, RadioTower } from 'lucide-react';
import { ServiceScopedModuleWorkbench, type ServiceScopedRailItem } from '../../components/navigation/ServiceScopedModuleWorkbench';

export function MetricsLayout() {
  const metricsRailItems: ServiceScopedRailItem[] = [
    { entry: 'explore', label: '指标查询', description: '按服务作用域查看指标查询入口', icon: Activity },
    { entry: 'alerts', label: '指标告警', description: '指标规则与告警入口', icon: Bell },
    { entry: 'dashboards', label: 'Dashboard', description: 'Grafana 目录与受控代理入口', icon: BarChart3, end: true },
    { entry: 'routes', label: '采集路由', description: 'K8s 服务指标采集与 vmagent 发布', icon: RadioTower },
    { entry: 'overview', label: '监控总览', description: '服务指标健康与接入状态', icon: Gauge, end: true },
    { entry: 'endpoints', label: '接入端点', description: '指标下游端点目录', icon: Database, serviceScoped: false, end: true },
  ];
  return (
    <ServiceScopedModuleWorkbench module="metrics" title="监控" ariaLabel="Metrics 模块导航" items={metricsRailItems}>
      <Outlet />
    </ServiceScopedModuleWorkbench>
  );
}
