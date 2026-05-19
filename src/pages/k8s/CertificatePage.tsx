import { useQuery } from '@tanstack/react-query';
import { CalendarClock, FileKey2, Fingerprint, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sCertificatePage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-certificates', 'prod'],
    queryFn: () => k8sApi.listCertificates('prod'),
    retry: false,
  });

  const expiringSoon = data.filter((item) => item.status === 'expiring_soon').length;

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
        {isLoading ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在读取证书元数据。
          </div>
        ) : null}
        {!isLoading && !error && data.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[940px] w-full">
              <thead>
                <tr>
                  <th>证书</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>Common Name</th>
                  <th>Fingerprint</th>
                  <th>Not After</th>
                  <th>状态</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.name}</div>
                      <div className="text-[11px] text-muted">{item.id}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.namespace || '-'}</td>
                    <td className="font-mono text-xs">{item.commonName || '-'}</td>
                    <td className="font-mono text-[11px] text-muted">{item.fingerprint || '-'}</td>
                    <td className="font-mono text-xs">{formatDate(item.notAfter)}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td className="text-xs text-muted">{item.source || 'startorch'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!isLoading && !error && !data.length ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">暂无证书资产</div>
            <p className="mt-2 text-sm text-muted">后端已联通，但当前集群没有返回证书元数据。</p>
          </div>
        ) : null}
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
