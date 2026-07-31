import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ServiceContextSelector } from '../../components/navigation/ServiceContextSelector';
import { useServiceScope } from '../../components/navigation/ServiceScopeContext';
import { api } from '../../services/api';
import type { GrafanaDatasourceBinding } from '../../services/types';
import { LogsEmptyState, LogsErrorLine, LogsInfoCell, LogsSection } from './LogsPrimitives';

export function LogsExplorePage() {
  const queryClient = useQueryClient();
  const { activeProduct, activeService, products, services, loading, error } = useServiceScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const productId = activeProduct?.id ?? '';
  const serviceId = activeService?.id ?? '';
  const contextReady = Boolean(productId && serviceId);
  const noProductAccess = !loading && !error && products.length === 0;
  const productServices = useMemo(
    () => services.filter((service) => service.productId === productId),
    [productId, services],
  );
  const integrationQuery = useQuery({
    queryKey: ['product-grafana', productId],
    queryFn: () => api.getGrafanaProductIntegration(productId),
    enabled: contextReady,
    refetchInterval: (query) => query.state.data?.state === 'pending' || query.state.data?.state === 'degraded' ? 5_000 : false,
  });
  const reconcile = useMutation({
    mutationFn: () => api.reconcileGrafanaProductIntegration(productId),
    onSuccess: (binding) => queryClient.setQueryData(['product-grafana', productId], binding),
  });
  const datasources = useMemo(
    () => (integrationQuery.data?.datasources ?? []).filter((item) => item.state === 'ready'),
    [integrationQuery.data?.datasources],
  );
  const endpointId = searchParams.get('endpoint_id') ?? '';
  const selectedDatasource = datasources.find((item) => item.endpointId === endpointId) ?? null;

  useEffect(() => {
    if (datasources.length !== 1 || endpointId === datasources[0].endpointId) return;
    const next = new URLSearchParams(searchParams);
    next.set('endpoint_id', datasources[0].endpointId);
    setSearchParams(next, { replace: true });
  }, [datasources, endpointId, searchParams, setSearchParams]);

  const filter = contextReady ? buildLogsServiceFilter(activeService?.name, serviceId) : '';
  const exploreURL = contextReady && selectedDatasource ? buildGrafanaExploreURL(selectedDatasource, filter) : '';
  const integration = integrationQuery.data;
  const unavailable = !integrationQuery.isLoading && (
    !integration
    || integration.state === 'pending'
    || integration.state === 'degraded'
    || integration.state === 'conflict'
    || datasources.length === 0
  );

  return (
    <div className="logs-explore-workbench grid min-h-[720px] gap-3 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_300px] xl:overflow-hidden">
      <section className="console-panel min-h-0 flex flex-col overflow-hidden">
        {integrationQuery.error ? <LogsErrorLine message={(integrationQuery.error as Error).message} /> : null}
        <div className="shrink-0 border-b border-outline bg-surface-low/70 p-3 shadow-[0_10px_24px_rgba(24,52,96,0.10)]">
          <div className="grid items-end gap-3 lg:grid-cols-[minmax(360px,520px)_minmax(260px,1fr)]">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">查询上下文</div>
              <ServiceContextSelector />
            </div>
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">VictoriaLogs Endpoint</span>
              <select
                className="console-input h-9 w-full text-xs font-semibold"
                value={selectedDatasource?.endpointId ?? ''}
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams);
                  next.set('endpoint_id', event.target.value);
                  setSearchParams(next);
                }}
                disabled={!contextReady || datasources.length === 0}
                aria-label="选择日志 Endpoint"
              >
                <option value="">{!contextReady ? '请先选择产品和服务' : datasources.length ? '请选择 Endpoint' : '数据源尚未就绪'}</option>
                {datasources.map((item) => <option key={item.endpointId} value={item.endpointId}>{item.endpointName || item.endpointId}</option>)}
              </select>
            </label>
          </div>
        </div>

        {!activeProduct ? (
          <LogsEmptyState
            title={noProductAccess ? '暂无可访问的产品' : '请选择产品'}
            description={noProductAccess
              ? '可观测性模块对所有登录用户可见，但产品、服务和观测数据仍按产品授权隔离。'
              : '选择查询产品后，可继续选择该产品内的服务。'}
          />
        ) : !activeService ? (
          <LogsEmptyState
            title={productServices.length ? '请选择服务' : '当前产品暂无服务'}
            description={productServices.length ? '服务是当前日志查询的过滤边界。' : '创建服务后才能建立稳定的日志查询上下文。'}
            action={!productServices.length ? <Link className="console-button" to={`/products/${encodeURIComponent(productId)}/services`}>前往创建服务</Link> : undefined}
          />
        ) : exploreURL ? (
          <iframe className="min-h-[460px] w-full flex-1 border-0 bg-white xl:min-h-0" src={exploreURL} title="Grafana Logs Explore" />
        ) : integrationQuery.isLoading ? (
          <div className="m-4 console-skeleton min-h-[360px]" />
        ) : unavailable ? (
          <LogsEmptyState
            title="产品日志数据源尚未就绪"
            description="NovaAPM 不会回退到 Grafana 的 0:0 默认数据源。请先发布日志路由并完成产品数据源协调。"
            action={(
              <div className="flex flex-wrap justify-center gap-2">
                <button className="console-button console-button-primary" onClick={() => reconcile.mutate()} disabled={reconcile.isPending}>
                  <RefreshCw className={`h-3.5 w-3.5 ${reconcile.isPending ? 'animate-spin' : ''}`} />重试协调
                </button>
                <Link className="console-button" to={`/products/${encodeURIComponent(productId)}/integrations`}>查看产品集成</Link>
              </div>
            )}
          />
        ) : (
          <LogsEmptyState title="请选择 Endpoint" description="该产品存在多个 VictoriaLogs Endpoint；选择结果会写入当前可分享 URL。" />
        )}
      </section>

      <LogsSection title="查询详情" meta="Grafana Explore" className="min-h-0 flex flex-col" bodyClassName="min-h-0 flex-1 overflow-y-auto p-0">
        <LogsInfoCell label="产品" value={activeProduct?.name || '-'} />
        <LogsInfoCell label="产品租户" value={activeProduct ? `${activeProduct.tenant.accountId}:${activeProduct.tenant.projectId}` : '-'} />
        <LogsInfoCell label="服务" value={activeService?.name || '-'} tone="primary" />
        <LogsInfoCell label="稳定服务 ID" value={serviceId || '-'} />
        <LogsInfoCell label="LogsQL 预填过滤" value={filter} />
        <LogsInfoCell label="Datasource UID" value={selectedDatasource?.uid || '-'} />
        <LogsInfoCell label="Endpoint" value={selectedDatasource?.endpointName || '-'} />
        <LogsInfoCell label="健康" value={selectedDatasource?.health || integration?.state || '-'} />
        {integration?.lastError ? (
          <div className="m-3 flex gap-2 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <ShieldAlert className="h-4 w-4 shrink-0" />{integration.lastError}
          </div>
        ) : null}
        <div className="m-3 rounded border border-outline bg-surface-lowest p-3 text-xs leading-5 text-muted">
          <div className="mb-1 flex items-center gap-2 font-semibold text-on-surface"><Database className="h-3.5 w-3.5" />隔离边界</div>
          当前 Grafana OSS Organization 内 Viewer 仍可看到全部数据源；NovaAPM 的管理操作按产品授权，严格查询隔离需后续接入 Datasource Permissions 或独立 Organization。
        </div>
      </LogsSection>
    </div>
  );
}

export function buildLogsServiceFilter(serviceName: string | undefined, serviceId: string): string {
  const normalizedServiceName = serviceName?.trim() ?? '';
  const field = normalizedServiceName ? 'service.name' : 'novaapm.service_id';
  const value = normalizedServiceName || serviceId;
  return `"${field}":${JSON.stringify(value)}`;
}

export function buildGrafanaExploreURL(datasource: Pick<GrafanaDatasourceBinding, 'uid'>, expression: string): string {
  const paneId = 'novaapm-logs';
  const panes = {
    [paneId]: {
      datasource: datasource.uid,
      queries: [{
        refId: 'A',
        datasource: { type: 'victoriametrics-logs-datasource', uid: datasource.uid },
        expr: expression,
        queryType: 'instant',
      }],
      range: { from: 'now-1h', to: 'now' },
    },
  };
  const params = new URLSearchParams({
    schemaVersion: '1',
    panes: JSON.stringify(panes),
    kiosk: '1',
  });
  return `/grafana/explore?${params.toString()}`;
}
