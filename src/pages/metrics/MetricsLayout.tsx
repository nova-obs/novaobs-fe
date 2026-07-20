import { Outlet } from 'react-router-dom';
import { Activity, Bell, Gauge, PlugZap } from 'lucide-react';
import { ModuleWorkbench } from '../../components/navigation/ModuleWorkbench';
import type { ModuleRailItem } from '../../components/navigation/ModuleRail';

const items: ModuleRailItem[] = [
  { to: '/metrics/overview', label: '监控总览', description: '环境接入健康与基础设施关键信号', icon: Gauge },
  { to: '/metrics/monitoring', label: '指标监控', description: '指标监控视图', icon: Activity },
  { to: '/metrics/alerts', label: '指标告警', description: '环境级 PromQL 与 MetricsQL 告警规则', icon: Bell },
  { to: '/metrics/environments', label: '环境接入', description: '环境指标来源、写入目标与生命周期', icon: PlugZap },
];

export function MetricsLayout() {
  return <ModuleWorkbench module="metrics" title="监控" ariaLabel="Metrics 模块导航" items={items}><Outlet /></ModuleWorkbench>;
}
