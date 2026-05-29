import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, ExternalLink, Search } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { logsApi } from './api';

export function LogsExplorePage() {
  const { data: workspace, isLoading, error } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });
  const routes = workspace?.routes ?? [];
  const services = workspace?.services ?? [];
  const [routeId, setRouteId] = useState('');
  const activeRoute = useMemo(() => routes.find((item) => item.route.id === routeId) ?? routes[0] ?? null, [routeId, routes]);
  const service = activeRoute ? services.find((item) => item.id === activeRoute.route.serviceId) : null;
  const vmuiURL = activeRoute?.endpoint?.vmuiURL ?? '';
  const source = activeRoute?.source;
  const scope = source?.sourceType === 'vm_file'
    ? `${source.hostGroup || 'VM'} · ${source.pathPattern || '-'}`
    : source
      ? `${source.clusterId}/${source.namespace}/${source.workloadName || '-'}`
      : '-';

  return (
    <div className="space-y-4">
      <DataPanel title="日志分析" meta={isLoading ? '加载中...' : `${routes.length} routes · VictoriaLogs`}>
        {error ? <p className="text-sm text-red-500">{(error as Error).message}</p> : null}
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,520px)_1fr_180px]">
          <label className="text-sm font-semibold text-on-surface">
            服务 / 日志路由
            <select className="console-input mt-2 w-full" value={activeRoute?.route.id ?? ''} onChange={(event) => setRouteId(event.target.value)}>
              {routes.length === 0 ? <option value="">暂无日志路由</option> : null}
              {routes.map((route) => (
                <option key={route.route.id} value={route.route.id}>
                  {(services.find((item) => item.id === route.route.serviceId)?.displayName || services.find((item) => item.id === route.route.serviceId)?.name || route.route.serviceId)} · {route.endpoint?.name || '-'}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 md:grid-cols-3">
            <Info label="来源" value={scope} />
            <Info label="端点" value={activeRoute?.endpoint?.name || '-'} />
            <Info label="Hash" value={activeRoute?.route.configHash || '-'} />
          </div>
          <div className="flex items-end">
            {vmuiURL ? (
              <a className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-all active:translate-y-px" href={vmuiURL} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />打开 VMUI
              </a>
            ) : (
              <button className="h-9 w-full rounded-lg border border-outline bg-white px-3 text-sm font-semibold text-muted" disabled>VMUI 未登记</button>
            )}
          </div>
        </div>
      </DataPanel>

      <DataPanel title={service?.displayName || service?.name || 'VictoriaLogs'} meta={activeRoute?.endpoint?.name || 'VMUI'}>
        {vmuiURL ? (
          <iframe className="h-[720px] w-full rounded-lg border border-outline bg-white" src={vmuiURL} title="VictoriaLogs VMUI" />
        ) : (
          <div className="flex items-center gap-2 py-12 text-sm text-muted">
            {routes.length === 0 ? <Database className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            {routes.length === 0 ? '暂无可分析的日志路由。' : '选择带 VMUI URL 的日志路由后开始分析。'}
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline bg-surface-lowest px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-on-surface" title={value}>{value || '-'}</div>
    </div>
  );
}
