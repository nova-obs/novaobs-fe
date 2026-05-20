import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileKey2, Fingerprint, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sCertificate } from './api';

const DEFAULT_CLUSTER = 'prod';
const DEFAULT_NAMESPACE = 'ingress';
const DEFAULT_CERTIFICATE = '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----';

export function K8sCertificatePage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<K8sCertificate | null>(null);
  const [name, setName] = useState('wildcard-prod');
  const [commonName, setCommonName] = useState('*.prod.example.com');
  const [notAfter, setNotAfter] = useState('2026-08-19');
  const [certificatePEM, setCertificatePEM] = useState(DEFAULT_CERTIFICATE);
  const [keyMaterialPEM, setKeyMaterialPEM] = useState('');
  const [lastAuditId, setLastAuditId] = useState('');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-certificates', DEFAULT_CLUSTER],
    queryFn: () => k8sApi.listCertificates(DEFAULT_CLUSTER),
    retry: false,
  });

  const expiringSoon = data.filter((item) => item.status === 'expiring_soon').length;
  const current = selected ?? data[0];

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createCertificate({ clusterId: DEFAULT_CLUSTER, namespace: DEFAULT_NAMESPACE, name, commonName, certificatePEM, keyMaterialPEM, notAfter }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.item ?? null);
      queryClient.invalidateQueries({ queryKey: ['k8s-certificates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const target = current;
      if (!target) throw new Error('请选择要删除的证书');
      return k8sApi.deleteCertificate(target.id);
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['k8s-certificates'] });
    },
  });

  const permissionError = useMemo(() => {
    const message = createMutation.error?.message || deleteMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createMutation.error, deleteMutation.error]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <CertificateMetric icon={FileKey2} label="证书资产" value={String(data.length)} meta="cluster/prod" />
        <CertificateMetric icon={CalendarClock} label="过期风险" value={String(expiringSoon)} meta="not_after watch" />
        <CertificateMetric icon={ShieldCheck} label="敏感字段" value="masked" meta="private material hidden" />
      </div>

      <DataPanel title="证书中心" meta={isLoading ? '加载中' : `${data.length} 张证书 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            证书中心 API 暂未连接，等待后端 `/api/v1/k8s/certificates`。
          </div>
        ) : null}
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.certificate` 写权限。
          </div>
        ) : null}
        {lastAuditId ? (
          <div className="mb-3 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            操作已落审计：<span className="font-mono">{lastAuditId}</span>
          </div>
        ) : null}
        {isLoading ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在读取证书元数据。
          </div>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="overflow-auto">
            {!isLoading && !error && data.length ? (
              <table className="console-table min-w-[940px] w-full">
                <thead>
                  <tr>
                    <th>证书</th>
                    <th>集群</th>
                    <th>命名空间</th>
                    <th>Common Name</th>
                    <th>Fingerprint</th>
                    <th>Secret</th>
                    <th>Not After</th>
                    <th>状态</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.id}
                      className={`cursor-pointer bg-white/35 hover:bg-white/60 ${current?.id === item.id ? 'ring-1 ring-primary/25' : ''}`}
                      onClick={() => setSelected(item)}
                    >
                      <td>
                        <div className="font-semibold text-primary">{item.name}</div>
                        <div className="text-[11px] text-muted">{item.id}</div>
                      </td>
                      <td className="font-mono text-xs">{item.clusterId}</td>
                      <td className="font-mono text-xs">{item.namespace || '-'}</td>
                      <td className="font-mono text-xs">{item.commonName || '-'}</td>
                      <td className="font-mono text-[11px] text-muted">{item.fingerprint || '-'}</td>
                      <td className="font-mono text-[11px] text-muted">{item.secretId || '-'}</td>
                      <td className="font-mono text-xs">{formatDate(item.notAfter)}</td>
                      <td><StatusPill status={item.status} /></td>
                      <td className="text-xs text-muted">{item.source || 'startorch'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {!isLoading && !error && !data.length ? (
              <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <div className="font-semibold text-on-surface">暂无证书资产</div>
                <p className="mt-2 text-sm text-muted">后端已联通，但当前集群没有返回证书元数据。</p>
              </div>
            ) : null}
          </div>

          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">证书写操作</div>
            <p className="mt-1 text-xs text-muted">私钥仅作为提交输入写入 platform/secret，列表与审计不展示明文。</p>
            <CertInput label="name" value={name} onChange={setName} />
            <CertInput label="common_name" value={commonName} onChange={setCommonName} />
            <CertInput label="not_after" value={notAfter} onChange={setNotAfter} />
            <label className="mt-3 block text-xs font-semibold text-muted">
              certificate_pem
              <textarea className="console-input mt-2 min-h-20 w-full font-mono text-xs" value={certificatePEM} onChange={(event) => setCertificatePEM(event.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-muted">
              private material
              <textarea
                className="console-input mt-2 min-h-20 w-full font-mono text-xs"
                placeholder="仅在提交时发送，不做页面回显"
                value={keyMaterialPEM}
                onChange={(event) => setKeyMaterialPEM(event.target.value)}
              />
            </label>
            <div className="mt-3 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">删除确认摘要</div>
              <div className="mt-2 font-mono">id={current?.id ?? '-'}</div>
              <div className="font-mono">name={current?.name ?? '-'}</div>
              <div className="font-mono">fingerprint={current?.fingerprint ?? '-'}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!name.trim() || !certificatePEM.trim() || !keyMaterialPEM.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
                <Plus className="h-4 w-4" />
                创建
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!current || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          </aside>
        </div>
      </DataPanel>

      <section className="console-panel px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-on-surface">证书安全边界</div>
            <p className="mt-1 text-xs text-muted">仅展示名称、指纹、有效期和来源；密钥材料留在后端受控域。</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">
            <Fingerprint className="h-3.5 w-3.5" />
            metadata only
          </div>
        </div>
      </section>
    </div>
  );
}

function CertInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block text-xs font-semibold text-muted">
      {label}
      <input className="console-input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CertificateMetric({ icon: Icon, label, value, meta }: { icon: typeof FileKey2; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-3 font-mono text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const warning = status === 'expiring_soon' || status === 'warning';
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>
      {warning ? '临期' : status || 'unknown'}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}
