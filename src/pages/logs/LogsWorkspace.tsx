import { Outlet } from 'react-router-dom';
import { Bell, Search, ServerCog } from 'lucide-react';
import { ServiceScopedModuleWorkbench, type ServiceScopedRailItem } from '../../components/navigation/ServiceScopedModuleWorkbench';

function LogsWorkspace() {
  const logsRailItems: ServiceScopedRailItem[] = [
    { entry: 'explore', label: '日志分析', description: '检索原始日志与构建查询', icon: Search },
    { entry: 'agents', label: '日志采集', description: '采集器实例、发布与运行状态', icon: ServerCog },
    { entry: 'alerts', label: '日志告警', description: '基于日志内容的告警规则', icon: Bell },
  ];
  return (
    <ServiceScopedModuleWorkbench
      module="logs"
      title="Logs"
      ariaLabel="Logs 模块导航"
      items={logsRailItems}
      remountOnPathChange
    >
      <Outlet />
    </ServiceScopedModuleWorkbench>
  );
}

export default LogsWorkspace;
