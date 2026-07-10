import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Rocket, Save } from 'lucide-react';
import { metricsApi, type MetricRouteInput } from './api';

const defaultForm: MetricRouteInput = {
  productId: '', serviceId: '', name: '', endpointId: '', clusterId: '', namespace: 'default',
  k8sServiceName: '', port: 'metrics', scheme: 'http', metricsPath: '/metrics',
  scrapeInterval: '30s', scrapeTimeout: '10s', status: 'active',
};

function durationSeconds(value: string) {
  const match = /^(\d+)(ms|s|m)$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === 'm' ? amount * 60 : match[2] === 'ms' ? amount / 1000 : amount;
}

export function MetricsRouteEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { productId = '', serviceId = '', id = '' } = useParams();
  const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics`;
  const editing = Boolean(id);
  const [form, setForm] = useState<MetricRouteInput>({ ...defaultForm, productId, serviceId });
  const [savedRouteId, setSavedRouteId] = useState(id);
  const [validationError, setValidationError] = useState('');

  const workspaceQuery = useQuery({
    queryKey: ['metrics-workspace', productId, serviceId],
    queryFn: () => metricsApi.getWorkspace(productId, serviceId),
    enabled: Boolean(productId && serviceId), retry: false,
  });
  const routesQuery = useQuery({
    queryKey: ['metrics-routes', productId, serviceId],
    queryFn: () => metricsApi.listRoutes(productId, serviceId),
    enabled: editing && Boolean(productId && serviceId), retry: false,
  });
  const existing = useMemo(() => routesQuery.data?.find((route) => route.id === id), [id, routesQuery.data]);
  const service = workspaceQuery.data?.services.find((item) => item.id === serviceId);
  const endpoints = (workspaceQuery.data?.endpoints ?? []).filter((endpoint) => endpoint.endpointType === 'victoriametrics');

  useEffect(() => {
    if (existing) {
      setForm({
        productId, serviceId, name: existing.name, endpointId: existing.endpointId,
        clusterId: existing.clusterId, namespace: existing.namespace,
        k8sServiceName: existing.k8sServiceName, port: existing.port,
        scheme: existing.scheme === 'https' ? 'https' : 'http', metricsPath: existing.metricsPath,
        scrapeInterval: existing.scrapeInterval, scrapeTimeout: existing.scrapeTimeout, status: existing.status,
      });
      return;
    }
    if (!editing && service) {
      setForm((current) => ({
        ...current,
        clusterId: current.clusterId || service.cluster,
        namespace: service.namespace || current.namespace,
      }));
    }
  }, [editing, existing, productId, service, serviceId]);

  const saveMutation = useMutation({
    mutationFn: (input: MetricRouteInput) => editing
      ? metricsApi.updateRoute(productId, serviceId, id, input)
      : metricsApi.createRoute(input),
    onSuccess: (route) => {
      setSavedRouteId(route.id);
      void queryClient.invalidateQueries({ queryKey: ['metrics-routes', productId, serviceId] });
      navigate(`${base}/routes`, { replace: true });
    },
  });

  function setField<K extends keyof MetricRouteInput>(key: K, value: MetricRouteInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!formReady) return;
    const interval = durationSeconds(form.scrapeInterval);
    const timeout = durationSeconds(form.scrapeTimeout);
    if (!interval || interval < 10 || interval > 300) return setValidationError('Scrape Interval 必须为 10s 到 5m。');
    if (!timeout || timeout >= interval) return setValidationError('Scrape Timeout 必须大于 0 且小于 Scrape Interval。');
    if (!form.metricsPath.startsWith('/') || form.metricsPath.includes('?')) return setValidationError('Metrics Path 必须是无查询参数的绝对路径。');
    setValidationError('');
    saveMutation.mutate(form);
  }

  const runtimeURL = `/k8s/observability?runtime=metrics&cluster_id=${encodeURIComponent(form.clusterId)}&route_id=${encodeURIComponent(savedRouteId)}`;
  const loading = workspaceQuery.isLoading || (editing && routesQuery.isLoading);
  const notFound = editing && routesQuery.isSuccess && !existing;
  const loadError = (workspaceQuery.error as Error | null)?.message || (routesQuery.error as Error | null)?.message || '';
  const formReady = !loading && !notFound && !loadError;
  const error = validationError || (saveMutation.error as Error | null)?.message || loadError || (notFound ? '指标采集路由不存在或已被删除。' : '');

  return (
    <form className="space-y-3 pb-16" onSubmit={submit}>
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="flex min-w-0 items-center gap-3">
            <Link className="console-icon-button border-outline bg-white" to={`${base}/routes`} aria-label="返回采集路由"><ArrowLeft className="h-3.5 w-3.5" /></Link>
            <div><h2 className="console-section-title">{editing ? '更新指标采集路由' : '创建指标采集路由'}</h2><p className="console-section-meta">结构化 K8s Service 发现，不接受任意抓取配置</p></div>
          </div>
        </div>
        {error ? <div className="console-notice console-notice-danger m-4 mb-0">{error}</div> : null}
        {loading ? <div className="console-panel-body grid gap-3 p-4"><div className="console-skeleton h-10" /><div className="console-skeleton h-64" /></div> : !formReady ? (
          <div className="console-empty-state m-4 min-h-[300px]"><div className="text-sm font-semibold text-on-surface">无法编辑采集路由</div><div className="text-xs text-muted">请返回路由列表刷新后重试。</div></div>
        ) : <div className="console-panel-body grid gap-x-5 gap-y-4 p-4 lg:grid-cols-2">
          <Field label="路由名称"><input className="console-input w-full" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="例如：订单服务指标" required /></Field>
          <Field label="指标存储端点"><select className="console-input w-full" value={form.endpointId} disabled={Boolean(existing?.appliedConfigHash)} onChange={(e) => setField('endpointId', e.target.value)} required><option value="">选择 VictoriaMetrics 端点</option>{endpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.name || endpoint.id}</option>)}</select>{existing?.appliedConfigHash ? <Hint>已部署路由的运行时分组不可迁移；更换端点需停用并发布旧路由后新建。</Hint> : null}</Field>
          <Field label="K8s 集群"><input className="console-input w-full font-mono text-xs" value={form.clusterId} readOnly={Boolean(service?.cluster)} onChange={(e) => setField('clusterId', e.target.value)} required /><Hint>服务已绑定集群时不可跨集群采集。</Hint></Field>
          <Field label="Namespace"><input className="console-input w-full font-mono text-xs" value={form.namespace} readOnly={Boolean(service?.namespace)} onChange={(e) => setField('namespace', e.target.value)} required /></Field>
          <Field label="K8s Service"><input className="console-input w-full font-mono text-xs" value={form.k8sServiceName} onChange={(e) => setField('k8sServiceName', e.target.value)} placeholder="order-api" required /></Field>
          <Field label="Service Port"><input className="console-input w-full font-mono text-xs" value={form.port} onChange={(e) => setField('port', e.target.value)} placeholder="metrics 或 9090" required /></Field>
          <Field label="Scheme"><select className="console-input w-full" value={form.scheme} onChange={(e) => setField('scheme', e.target.value as 'http' | 'https')}><option value="http">HTTP</option><option value="https">HTTPS</option></select></Field>
          <Field label="Metrics Path"><input className="console-input w-full font-mono text-xs" value={form.metricsPath} onChange={(e) => setField('metricsPath', e.target.value)} required /></Field>
          <Field label="Scrape Interval"><input className="console-input w-full font-mono text-xs" value={form.scrapeInterval} onChange={(e) => setField('scrapeInterval', e.target.value)} required /><Hint>允许 10s–5m。</Hint></Field>
          <Field label="Scrape Timeout"><input className="console-input w-full font-mono text-xs" value={form.scrapeTimeout} onChange={(e) => setField('scrapeTimeout', e.target.value)} required /><Hint>必须小于 Scrape Interval。</Hint></Field>
          <Field label="状态"><select className="console-input w-full" value={form.status} onChange={(e) => setField('status', e.target.value)}><option value="active">启用采集</option><option value="disabled">停用采集</option></select></Field>
          <div className="rounded-md border border-outline bg-surface-low px-3 py-3 text-xs leading-5 text-muted">
            <div className="font-semibold text-on-surface">租户归属</div>
            <div className="mt-1 font-mono">AccountID: {service?.accountId || '0'}</div>
            <div className="font-mono">ProjectID: {service?.projectId || '-'}</div>
            <div className="mt-1">由产品与服务自动确定，vmagent 发布时写入对应 VictoriaMetrics 租户路径。</div>
          </div>
        </div>}
      </section>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline bg-white/95 px-4 py-3 backdrop-blur md:left-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-end gap-2">
          <Link className="console-button" to={`${base}/routes`}>取消</Link>
          {editing && savedRouteId && formReady ? <Link className="console-button gap-1" to={runtimeURL}><Rocket className="h-3.5 w-3.5" />前往观测接入部署</Link> : null}
          <button className="console-button console-button-primary gap-1" type="submit" disabled={!formReady || saveMutation.isPending}>{saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{editing ? '保存变更' : '创建路由'}</button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-muted"><span className="mb-2 block">{label}</span>{children}</label>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-[11px] font-normal text-muted">{children}</span>;
}
