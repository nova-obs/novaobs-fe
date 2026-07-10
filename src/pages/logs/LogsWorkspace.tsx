import { Outlet, useParams } from 'react-router-dom';
import { Bell, RadioTower, Search, ServerCog } from 'lucide-react';
import { ModuleWorkbench } from '../../components/navigation/ModuleWorkbench';
import type { ModuleRailItem } from '../../components/navigation/ModuleRail';

function LogsWorkspace() {
	const { productId = '', serviceId = '' } = useParams();
	const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs`;
  const logsRailItems: ModuleRailItem[] = [
    { to: `${base}/explore`, label: '日志分析', description: '检索原始日志与构建查询', icon: Search },
    { to: `${base}/agents`, label: '采集路由', description: '采集器实例、发布与运行状态', icon: ServerCog },
    { to: `${base}/alerts`, label: '日志告警', description: '基于日志内容的告警规则', icon: Bell },
    { to: `${base}/endpoints`, label: '接入配置', description: '日志下游端点与连接配置', icon: RadioTower },
  ];
  return (
    <ModuleWorkbench
      module="logs"
      title="Logs"
      ariaLabel="Logs 模块导航"
      items={logsRailItems}
      remountOnPathChange
    >
      <Outlet />
    </ModuleWorkbench>
  );
}

export default LogsWorkspace;
