import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, RadioTower, RefreshCw, Scan, X } from 'lucide-react';
import { metricsApi, type CreateServiceBindingInput, type MetricEndpoint, type MetricServiceBinding, type MetricsServiceSummary, type UpdateServiceBindingInput } from './api';

function formatLabelMatch(labelMatch: Record<string, string>) {
  const entries = Object.entries(labelMatch);
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

function statusClass(status: string) {
  if (['active', 'verified', 'healthy'].includes(status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error', 'blocked'].includes(status)) return 'border-danger/20 bg-red-50 text-danger';
  if (['pending', 'pending_verification', 'warning'].includes(status)) return 'border-warning/25 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

type DrawerMode = { type: 'create' } | { type: 'edit'; binding: MetricServiceBinding };

export function MetricsCollectionPage() {
  const queryClient = useQueryClient();
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const { data: bindings = [], error, isLoading, refetch } = useQuery({
    queryKey: ['metrics-service-bindings'],
    queryFn: () => metricsApi.listServiceBindings(),
    retry: false,
  });
  const workspaceQuery = useQuery({
    queryKey: ['metrics-workspace'],
    queryFn: () => metricsApi.getWorkspace(),
    retry: false,
  });
  const services = workspaceQuery.data?.services ?? [];
  const endpoints = workspaceQuery.data?.endpoints ?? [];

  const probeMutation = useMutation({
    mutationFn: (id: string) => metricsApi.probeServiceBinding(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['metrics-service-bindings'] });
      void queryClient.invalidateQueries({ queryKey: ['metrics-workspace'] });
    },
  });

  function closeDrawer() { setDrawerMode(null); }

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">采集接入</h2>
            <p className="console-section-meta">service bindings · 共 {bindings.length} 条</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="console-button console-button-primary gap-1.5" onClick={() => setDrawerMode({ type: 'create' })}>
              <Plus className="h-3.5 w-3.5" />
              创建绑定
            </button>
            <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新指标绑定" title="刷新指标绑定" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {error ? <div className="console-notice console-notice-danger m-3 mb-0">{(error as Error).message}</div> : null}
        <div className="console-panel-body">
          <div className="overflow-auto">
            <table className="console-table w-full min-w-[860px]">
              <thead>
                <tr>
                  <th>服务</th>
                  <th>指标端点</th>
                  <th>labelMatch</th>
                  <th>状态</th>
                  <th>最近探测</th>
                  <th className="w-[120px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6}><div className="console-skeleton h-10" /></td>
                  </tr>
                ) : bindings.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="console-empty-state my-2 min-h-[280px]">
                        <RadioTower className="h-5 w-5 text-muted/80" />
                        <div className="text-sm font-semibold text-on-surface">暂无服务指标绑定</div>
                        <div className="max-w-md text-xs leading-5 text-muted">先在接入端点确认 VictoriaMetrics 端点，再为服务建立 labelMatch 绑定。</div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="console-button console-button-primary" onClick={() => setDrawerMode({ type: 'create' })}>创建绑定</button>
                          <Link className="console-button" to="/metrics/endpoints">查看接入端点</Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : bindings.map((binding) => (
                  <tr key={binding.id}>
                    <td className="font-mono text-xs">{binding.serviceId || '-'}</td>
                    <td className="font-mono text-xs">{binding.endpointId || '-'}</td>
                    <td className="max-w-[360px] truncate font-mono text-xs">{formatLabelMatch(binding.labelMatch)}</td>
                    <td>
                      <span className={`status-badge ${statusClass(binding.status)}`}>
                        <span className="status-dot" aria-hidden />
                        {binding.status || '-'}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{binding.lastProbeAt || binding.updatedAt || '-'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="console-button gap-1 text-xs"
                          disabled={probeMutation.isPending}
                          onClick={() => probeMutation.mutate(binding.id)}
                          title="探测绑定连通性"
                        >
                          {probeMutation.isPending && probeMutation.variables === binding.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Scan className="h-3 w-3" />}
                          探测
                        </button>
                        <button type="button" className="console-button text-xs" onClick={() => setDrawerMode({ type: 'edit', binding })}>
                          编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {drawerMode ? (
        <BindingDrawer
          mode={drawerMode}
          services={services}
          endpoints={endpoints}
          onClose={closeDrawer}
          onSuccess={() => {
            closeDrawer();
            void queryClient.invalidateQueries({ queryKey: ['metrics-service-bindings'] });
            void queryClient.invalidateQueries({ queryKey: ['metrics-workspace'] });
          }}
        />
      ) : null}
    </div>
  );
}

function BindingDrawer({ mode, services, endpoints, onClose, onSuccess }: {
  mode: DrawerMode;
  services: MetricsServiceSummary[];
  endpoints: MetricEndpoint[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = mode.type === 'edit';
  const existing = isEdit ? mode.binding : null;
  const [serviceId, setServiceId] = useState(existing?.serviceId ?? '');
  const [endpointId, setEndpointId] = useState(existing?.endpointId ?? '');
  const [labelMatchRaw, setLabelMatchRaw] = useState(existing ? formatLabelMatchEditable(existing.labelMatch) : '');
  const [basePromQL, setBasePromQL] = useState(existing?.basePromQL ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'active');

  const createMutation = useMutation({
    mutationFn: (input: CreateServiceBindingInput) => metricsApi.createServiceBinding(input),
    onSuccess,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateServiceBindingInput }) => metricsApi.updateServiceBinding(id, input),
    onSuccess,
  });

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const labelMatch = parseLabelMatch(labelMatchRaw);
    if (isEdit && existing) {
      updateMutation.mutate({ id: existing.id, input: { endpointId, labelMatch, basePromQL, status } });
    } else {
      createMutation.mutate({ serviceId, endpointId, labelMatch, basePromQL, status });
    }
  }

  const title = isEdit ? '编辑服务绑定' : '创建服务绑定';

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button className="absolute inset-0 cursor-default" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[560px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="binding-drawer-title">
        <header className="flex items-start justify-between gap-4 border-b border-outline px-5 py-4">
          <h2 id="binding-drawer-title" className="text-base font-semibold text-on-surface">{title}</h2>
          <button className="console-button h-8 w-8 p-0" aria-label={`关闭${title}`} onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <form className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4" onSubmit={handleSubmit}>
          {mutationError ? <div className="console-notice console-notice-danger">{(mutationError as Error).message}</div> : null}

          <label className="block text-xs font-semibold text-muted">
            服务
            <select className="console-input mt-2 w-full" value={serviceId} disabled={isEdit} onChange={(e) => setServiceId(e.target.value)} required>
              <option value="">选择服务</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.name || s.id}</option>)}
            </select>
          </label>

          <label className="block text-xs font-semibold text-muted">
            指标端点
            <select className="console-input mt-2 w-full" value={endpointId} onChange={(e) => setEndpointId(e.target.value)} required>
              <option value="">选择端点</option>
              {endpoints.map((ep) => <option key={ep.id} value={ep.id}>{ep.name || ep.id}</option>)}
            </select>
          </label>

          <label className="block text-xs font-semibold text-muted">
            Label Match
            <input className="console-input mt-2 w-full font-mono text-xs" placeholder='例: job=api-server, namespace=prod' value={labelMatchRaw} onChange={(e) => setLabelMatchRaw(e.target.value)} />
            <span className="mt-1 block text-[11px] text-muted">逗号分隔的 key=value 对</span>
          </label>

          <label className="block text-xs font-semibold text-muted">
            Base PromQL（可选）
            <input className="console-input mt-2 w-full font-mono text-xs" placeholder='例: up{job="api-server"}' value={basePromQL} onChange={(e) => setBasePromQL(e.target.value)} />
          </label>

          <label className="block text-xs font-semibold text-muted">
            状态
            <select className="console-input mt-2 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="pending_verification">pending_verification</option>
              <option value="disabled">disabled</option>
            </select>
          </label>

          <div className="mt-auto flex items-center justify-end gap-2 border-t border-outline pt-4">
            <button type="button" className="console-button" onClick={onClose}>取消</button>
            <button type="submit" className="console-button console-button-primary gap-1.5" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isEdit ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function formatLabelMatchEditable(labelMatch: Record<string, string>) {
  return Object.entries(labelMatch).map(([key, value]) => `${key}=${value}`).join(', ');
}

function parseLabelMatch(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return result;
}
