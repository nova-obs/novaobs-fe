import { Outlet, useLocation } from 'react-router-dom';
import { Bell, RadioTower, Search, ServerCog } from 'lucide-react';
import { ModuleRail, type ModuleRailItem } from '../../components/navigation/ModuleRail';

const logsRailItems: ModuleRailItem[] = [
  { to: '/logs/explore', label: '日志分析', description: '检索原始日志与构建查询', icon: Search },
  { to: '/logs/agents', label: '采集路由', description: '采集器实例、发布与运行状态', icon: ServerCog },
  { to: '/logs/alerts', label: '日志告警', description: '基于日志内容的告警规则', icon: Bell },
  { to: '/logs/endpoints', label: '接入配置', description: '日志下游端点与接入密钥', icon: RadioTower },
];

function LogsWorkspace() {
  const location = useLocation();

  return (
    <div className="logs-workbench route-transition-page relative flex h-full min-h-0">
      <h1 className="sr-only">Logs</h1>
      <ModuleRail
        items={logsRailItems}
        ariaLabel="Logs 模块导航"
        storageKey="novaobs.module-rail.logs"
      />
      <div className="logs-workbench-outlet route-transition-page min-h-0 flex-1" key={location.pathname}>
        <Outlet />
      </div>
    </div>
  );
}

export default LogsWorkspace;
