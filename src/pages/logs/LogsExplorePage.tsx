import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Database, ExternalLink, ListFilter, RefreshCw, Route, Save, Server, X } from 'lucide-react';
import { buildVictoriaLogsVMUIURL, logSinkLabel, logsApi, type LogEndpoint, type LogRouteView, type LogTargetView, type LogsServiceSummary } from './api';
import { LogsEmptyState, LogsErrorLine, LogsInfoCell, LogsSection } from './LogsPrimitives';
import { routeAccessPriority } from './ServicePickerPanel';
import { ServiceContextSelector } from '../../components/navigation/ServiceContextSelector';

type ServiceLogMode = 'external' | 'platform' | 'none';

interface ServiceLogLink {
  id: string;
  service: LogsServiceSummary;
  serviceId: string;
  serviceName: string;
  mode: ServiceLogMode;
  sourceLabel: string;
  scopeLabel: string;
  endpoint: LogEndpoint | null;
  status: string;
  baseFilter: string;
  route?: LogRouteView;
  target?: LogTargetView;
}

interface ExternalLinkForm {
  name: string;
  endpointId: string;
  baseFilter: string;
  accountId: string;
  projectId: string;
}

function serviceLabel(service?: LogsServiceSummary | null, fallback = '') {
  return service?.displayName || service?.name || fallback || '-';
}

function routeScope(route?: LogRouteView | null) {
  const source = route?.source;
  if (!source) return '-';
  if (source.sourceType === 'vm_file') return `${source.hostGroup || 'VM'} · ${source.pathPattern || '-'}`;
  return `${source.clusterId}/${source.namespace}/${source.workloadKind || 'Workload'}/${source.workloadName || '-'}`;
}

function buildServiceLogLinks(services: LogsServiceSummary[], routes: LogRouteView[], targets: LogTargetView[]): ServiceLogLink[] {
  const routesByService = new Map<string, LogRouteView[]>();
  for (const route of routes) {
    const items = routesByService.get(route.route.serviceId) ?? [];
    routesByService.set(route.route.serviceId, [...items, route]);
  }
  const targetsByService = new Map<string, LogTargetView[]>();
  for (const target of targets) {
    if (target.target.status === 'disabled') continue;
    const items = targetsByService.get(target.target.serviceId) ?? [];
    targetsByService.set(target.target.serviceId, [...items, target]);
  }
  return services.map((service) => {
    const target = (targetsByService.get(service.id) ?? [])[0];
    const route = [...(routesByService.get(service.id) ?? [])].sort((left, right) => routeAccessPriority(left) - routeAccessPriority(right))[0];
    if (target) {
      return {
        id: service.id,
        service,
        serviceId: service.id,
        serviceName: serviceLabel(service, service.id),
        mode: 'external',
        sourceLabel: '纳管日志链路',
        scopeLabel: target.target.baseFilter || '-',
        endpoint: target.endpoint,
        status: target.target.status,
        baseFilter: target.target.baseFilter,
        target,
      };
    }
    if (route) {
      return {
        id: service.id,
        service,
        serviceId: service.id,
        serviceName: serviceLabel(service, service.id),
        mode: 'platform',
        sourceLabel: '平台采集路由',
        scopeLabel: routeScope(route),
        endpoint: route.endpoint,
        status: route.route.lastPublishStatus || route.route.status,
        baseFilter: '',
        route,
      };
    }
    return {
      id: service.id,
      service,
      serviceId: service.id,
      serviceName: serviceLabel(service, service.id),
      mode: 'none',
      sourceLabel: '未登记',
      scopeLabel: '当前服务暂无日志链路',
      endpoint: null,
      status: 'not_configured',
      baseFilter: '',
    };
  });
}

export function LogsExplorePage() {
  const queryClient = useQueryClient();
	const { productId = '', serviceId = '' } = useParams();
  const [editorOpen, setEditorOpen] = useState(false);
  const { data: workspace, error, refetch } = useQuery({
	queryKey: ['logs-onboarding-workspace', productId, serviceId],
	queryFn: () => logsApi.getWorkspace(productId, serviceId),
	enabled: Boolean(productId && serviceId),
  });
  const routes = workspace?.routes ?? [];
  const targets = workspace?.targets ?? [];
  const services = workspace?.services ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const serviceLinks = useMemo(() => buildServiceLogLinks(services, routes, targets), [routes, services, targets]);
  const activeLink = useMemo(() => serviceLinks.find((item) => item.serviceId === serviceId) ?? null, [serviceId, serviceLinks]);
	const serviceFilter = activeLink?.baseFilter || (activeLink?.service.name ? `"service.name":=${JSON.stringify(activeLink.service.name)}` : '');
	const vmuiURL = buildVictoriaLogsVMUIURL(activeLink?.endpoint, serviceFilter);
  const activeSinkLabel = logSinkLabel(activeLink?.endpoint?.sinkType);
  const canCreateAlert = Boolean(activeLink && activeLink.mode !== 'none' && activeLink.endpoint);

  async function refreshWorkspace() {
	await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace', productId, serviceId] });
  }

  return (
    <div className="logs-explore-workbench grid min-h-[760px] gap-3 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_300px] xl:overflow-hidden">
      <section className="console-panel min-h-0 flex flex-col overflow-hidden">
        {error ? <LogsErrorLine message={(error as Error).message} /> : null}
        <div className="shrink-0 border-b border-outline bg-surface-low/70 p-3 shadow-[0_10px_24px_rgba(24,52,96,0.10)]">
          <div className="grid items-start gap-2 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
            <div className="logs-explore-context-panel min-w-0 overflow-hidden rounded-md border border-primary/25 bg-white shadow-[0_8px_18px_rgba(24,52,96,0.12)]">
              <div className="logs-explore-context-header flex h-7 items-center justify-between gap-2 border-b border-primary/15 bg-primary-soft/75 px-3 text-[11px] font-semibold text-primary">
                <span>服务</span>
              </div>
              <div className="service-selector p-2">
                <ServiceContextSelector icon={activeLink?.mode === 'platform' ? Route : Server} />
              </div>
            </div>
            <div className="logs-explore-context-panel min-w-0 overflow-hidden rounded-md border border-primary/25 bg-white shadow-[0_8px_18px_rgba(24,52,96,0.12)]">
              <div className="logs-explore-context-header flex h-7 items-center justify-between gap-2 border-b border-primary/15 bg-primary-soft/75 px-2 pl-3 text-[11px] font-semibold text-primary">
                <span>日志链路</span>
                <div className="logs-explore-query-actions flex items-center gap-1">
                  {vmuiURL ? (
                    <a
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-primary/15 bg-white/75 text-primary transition-colors hover:border-primary/35 hover:bg-white"
                      href={vmuiURL}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="在新窗口打开查询"
                      title="新窗口"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-primary/15 bg-white/75 text-primary transition-colors hover:border-primary/35 hover:bg-white"
                    onClick={() => refetch()}
                    aria-label="刷新日志上下文"
                    title="刷新"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-2">
                <div className="query-context-summary flex h-14 min-w-0 items-center gap-3 rounded-md border border-primary/15 bg-primary-soft/35 px-3 shadow-[inset_3px_0_0_#0d5bd7]">
                  <Database className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold text-on-surface">{activeLink?.scopeLabel || '未选择服务'}</div>
                    <div className="mt-1 truncate text-[11px] text-muted">
                      {activeLink?.endpoint ? `${activeSinkLabel} · ${activeLink.endpoint.name || '-'} · tenant ${activeLink.endpoint.accountId || '0'}:${activeLink.endpoint.projectId || '0'}`
                        : activeLink ? '登记外部日志链路后可进入查询' : '选择服务后确定日志链路'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {vmuiURL ? (
          <iframe className="min-h-[420px] w-full flex-1 border-0 bg-white xl:min-h-0" src={vmuiURL} title="Logs query console" />
        ) : (
          <LogsEmptyState
            title={!activeLink ? '暂无服务' : activeLink.mode === 'none' ? '当前服务暂无日志链路' : '当前服务日志端点未提供内嵌查询入口'}
            action={activeLink?.mode === 'none' ? <button className="console-button console-button-primary" onClick={() => setEditorOpen(true)}>登记外部日志链路</button> : undefined}
          />
        )}
      </section>

      <LogsSection title="详情" meta={activeLink?.sourceLabel || 'service context'} className="min-h-0 flex flex-col" bodyClassName="min-h-0 flex-1 overflow-y-auto p-0">
        <LogsInfoCell label="服务" value={activeLink?.serviceName || '-'} tone="primary" />
        <LogsInfoCell label="日志链路" value={activeLink?.sourceLabel || '-'} />
        <LogsInfoCell label="范围" value={activeLink?.scopeLabel || '-'} />
        <LogsInfoCell label="端点" value={activeLink?.endpoint?.name || '-'} />
        <LogsInfoCell
          label="租户"
          value={activeLink?.endpoint?.accountId && activeLink?.endpoint?.projectId
            ? `${activeLink.endpoint.accountId}:${activeLink.endpoint.projectId}${activeLink.target?.target.accountId ? '（外部）' : '（产品）'}`
            : '0:0（默认）'}
        />
        {activeLink?.mode === 'external' ? <LogsInfoCell label="基础过滤条件" value={activeLink.baseFilter || '-'} /> : null}
        <LogsInfoCell label="状态" value={activeLink?.status || '-'} />
        <div className="border-t border-outline/70 p-3">
          <div className="mb-2 text-xs font-semibold text-on-surface">动作</div>
          <div className="grid gap-2">
            {canCreateAlert ? (
			  <Link className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white text-xs font-semibold text-muted hover:border-primary/40 hover:text-on-surface" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs/alerts/new`}>
                <Bell className="h-3.5 w-3.5" />创建告警
              </Link>
            ) : null}
            {activeLink?.mode === 'platform' ? (
			  <Link className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white text-xs font-semibold text-muted hover:border-primary/40 hover:text-on-surface" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs/agents?agent_group_id=${activeLink.route?.route.agentGroupId || ''}&route_id=${activeLink.route?.route.id || ''}`}>
                <ListFilter className="h-3.5 w-3.5" />查看采集路由
              </Link>
            ) : null}
            {activeLink && activeLink.mode !== 'platform' ? (
              <button className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white text-xs font-semibold text-muted hover:border-primary/40 hover:text-on-surface" onClick={() => setEditorOpen(true)}>
                <Server className="h-3.5 w-3.5" />{activeLink.mode === 'external' ? '更新外部链路' : '登记外部链路'}
              </button>
            ) : null}
          </div>
        </div>
      </LogsSection>
      {editorOpen && activeLink ? (
        <ExternalLogLinkDrawer
          link={activeLink}
          endpoints={endpoints}
          onClose={() => setEditorOpen(false)}
          onSaved={async () => {
            setEditorOpen(false);
            await refreshWorkspace();
          }}
        />
      ) : null}
    </div>
  );
}


function ExternalLogLinkDrawer({ link, endpoints, onClose, onSaved }: {
  link: ServiceLogLink;
  endpoints: LogEndpoint[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const queryableEndpoints = endpoints.filter((endpoint) => endpoint.sinkType === 'vl' && endpoint.queryURL);
  const existing = link.target ?? null;
  const [form, setForm] = useState<ExternalLinkForm>(() => formFromLink(link, queryableEndpoints));
  const mutation = useMutation({
    mutationFn: async () => {
      const input = {
        name: form.name,
        serviceId: link.serviceId,
        endpointId: form.endpointId,
        baseFilter: form.baseFilter,
        accountId: form.accountId,
        projectId: form.projectId,
      };
      if (existing) {
        return logsApi.updateTarget(existing.target.id, input);
      }
      return logsApi.createTarget(input);
    },
    onSuccess: async () => {
      await onSaved();
    },
  });
  const missing = validateExternalForm(form);
  const disabled = missing.length > 0 || mutation.isPending || queryableEndpoints.length === 0;

  useEffect(() => {
    setForm(formFromLink(link, queryableEndpoints));
  }, [link.serviceId, existing?.target.id, queryableEndpoints.length]);

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭外部日志链路登记遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[560px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="external-log-link-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div id="external-log-link-title" className="truncate text-sm font-semibold text-on-surface">{existing ? '更新外部日志链路' : '登记外部日志链路'}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{link.serviceName}</div>
          </div>
          <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭外部日志链路登记" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <Field label="服务">
            <input className="console-input mt-1.5 h-9 w-full text-sm" value={link.serviceName} disabled />
          </Field>
          <Field label="链路名称">
            <input className="console-input mt-1.5 h-9 w-full text-sm" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={`${link.serviceName} 外部日志链路`} />
          </Field>
          <Field label="VictoriaLogs 查询端点">
            <select className="console-input mt-1.5 h-9 w-full text-sm" value={form.endpointId} onChange={(event) => setForm({ ...form, endpointId: event.target.value })}>
              <option value="">请选择可查询端点</option>
              {queryableEndpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.name} · {endpoint.accountId || '0'}:{endpoint.projectId || '0'}</option>)}
            </select>
            {queryableEndpoints.length === 0 ? <span className="mt-1 block text-[11px] text-amber-700">请先在接入配置中登记带查询地址的 VictoriaLogs 端点。</span> : null}
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="外部 AccountID">
              <input className="console-input mt-1.5 h-9 w-full font-mono text-sm" inputMode="numeric" value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} placeholder="可选，例如 0" />
            </Field>
            <Field label="外部 ProjectID">
              <input className="console-input mt-1.5 h-9 w-full font-mono text-sm" inputMode="numeric" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} placeholder="可选，例如 9528" />
            </Field>
          </div>
          <div className="-mt-2 text-[11px] text-muted">留空时使用当前产品租户；填写时必须同时提供完整的 AccountID 和 ProjectID。</div>
          <Field label="服务日志过滤条件">
            <textarea className="mt-1.5 min-h-28 w-full resize-none rounded-md border border-outline bg-white p-3 font-mono text-sm text-on-surface outline-none focus:border-primary" value={form.baseFilter} onChange={(event) => setForm({ ...form, baseFilter: event.target.value })} placeholder={'"service.name":="orders-api" AND "deployment.environment":="prod"'} />
            <span className="mt-1 block text-[11px] text-muted">只填写过滤表达式；时间范围、统计和告警阈值由 Explore 或告警流程生成。</span>
          </Field>
          {mutation.error ? <LogsErrorLine message={(mutation.error as Error).message} /> : null}
        </div>
        <div className="console-action-bar shrink-0">
          <div className="min-w-0 text-xs text-muted">{missing.length ? `还需：${missing.join('、')}` : '保存后该服务会按纳管日志链路进入 Explore 和告警。'}</div>
          <div className="flex gap-2">
            <button className="console-button" onClick={onClose}>取消</button>
            <button className="console-button console-button-primary" disabled={disabled} onClick={() => mutation.mutate()}>
              <Save className="h-3.5 w-3.5" />
              保存
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function formFromLink(link: ServiceLogLink, endpoints: LogEndpoint[]): ExternalLinkForm {
  return {
    name: link.target?.target.name || `${link.serviceName} 外部日志链路`,
    endpointId: link.target?.target.endpointId || endpoints[0]?.id || '',
    baseFilter: link.target?.target.baseFilter || `"service.name":=${JSON.stringify(link.service.name || link.serviceName)}`,
    accountId: link.target?.target.accountId || '',
    projectId: link.target?.target.projectId || '',
  };
}

function validateExternalForm(form: ExternalLinkForm) {
  const missing: string[] = [];
  if (!form.endpointId) missing.push('查询端点');
  if (!form.baseFilter.trim()) missing.push('过滤条件');
  if (form.baseFilter.includes('|') || form.baseFilter.toLowerCase().includes('_time')) missing.push('纯过滤表达式');
  if (Boolean(form.accountId.trim()) !== Boolean(form.projectId.trim())) missing.push('完整外部租户');
  if (form.accountId.trim() && !isUint32(form.accountId)) missing.push('有效的 AccountID');
  if (form.projectId.trim() && !isUint32(form.projectId)) missing.push('有效的 ProjectID');
  return missing;
}

function isUint32(value: string) {
  return /^\d+$/.test(value.trim()) && BigInt(value.trim()) <= 4294967295n;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-medium text-muted"><span>{label}</span>{children}</label>;
}
