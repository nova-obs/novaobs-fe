import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileKey2, Fingerprint, Plus, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sCertificate } from './api';
import { useK8sOpsContext } from './context';

export function K8sCertificatePage() {
  const queryClient = useQueryClient();
  const [namespace, setNamespace] = useState('');
  const [selected, setSelected] = useState<K8sCertificate | null>(null);
  const [activeAction, setActiveAction] = useState<'create' | 'delete' | null>(null);
  const [name, setName] = useState('');
  const [commonName, setCommonName] = useState('');
  const [notAfter, setNotAfter] = useState('');
  const [certificatePEM, setCertificatePEM] = useState('');
  const [keyMaterialPEM, setKeyMaterialPEM] = useState('');
  const [lastAuditId, setLastAuditId] = useState('');

  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      setSelected(null);
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-certificates', activeClusterId, namespace],
    queryFn: () => k8sApi.listCertificates(activeClusterId, namespace),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });

  const expiringSoon = data.filter((item) => item.status === 'warning' || item.status === 'expiring_soon').length;
  const current = selected ?? data[0];
  const canList = Boolean(activeClusterId && namespace);

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createCertificate({ clusterId: activeClusterId, namespace, name, commonName, certificatePEM, keyMaterialPEM, notAfter }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.item ?? null);
      setActiveAction(null);
      setName('');
      setCommonName('');
      setNotAfter('');
      setCertificatePEM('');
      setKeyMaterialPEM('');
      queryClient.invalidateQueries({ queryKey: ['k8s-certificates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const target = current;
      if (!target) throw new Error('请选择要删除的证书');
      return k8sApi.deleteCertificate(target);
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(null);
      setActiveAction(null);
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
        <CertificateMetric icon={FileKey2} label="证书资产" value={String(data.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <CertificateMetric icon={CalendarClock} label="过期风险" value={String(expiringSoon)} meta={namespace ? `namespace/${namespace}` : '等待命名空间'} />
        <CertificateMetric icon={ShieldCheck} label="敏感字段" value="masked" meta="private material hidden" />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(200px,280px)_minmax(180px,240px)_1fr] md:items-end">
          <div className="rounded-lg bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-xs font-semibold text-muted">当前集群</div>
            <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select className="console-input mt-2 w-full" value={namespace} onChange={(event) => setNamespace(event.target.value)} disabled={!namespaces.length}>
              {!namespaces.length ? <option value="">暂无命名空间</option> : null}
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="text-sm text-muted">
            证书中心从 Kubernetes TLS Secret 只读提取证书元数据，不读取、不展示 `tls.key`。
          </div>
        </div>
        {clusterError || namespaceError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : `命名空间读取失败：${errorMessage(namespaceError)}`}
          </div>
        ) : null}
      </section>

      <DataPanel
        title="证书中心"
        meta={isLoading ? '加载中' : `${data.length} 张证书`}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <button className="console-button" disabled={!current} onClick={() => setActiveAction('delete')}><Trash2 className="h-4 w-4" />删除证书</button>
            <button className="console-button console-button-primary" disabled={!activeClusterId || !namespace} onClick={() => setActiveAction('create')}><Plus className="h-4 w-4" />创建证书</button>
          </div>
        )}
      >
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            证书中心读取失败：{errorMessage(error)}
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
        <div className="overflow-auto">
          {!canList ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">请先选择集群和命名空间</div>
              <p className="mt-2 text-sm text-muted">TLS Secret 按 namespace 读取，不做默认跨命名空间扫描。</p>
            </div>
          ) : null}
          {canList && !isLoading && !error && data.length ? (
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
                    <td className="text-xs text-muted">{item.source || 'Kubernetes API'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {canList && !isLoading && !error && !data.length ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">暂无证书资产</div>
              <p className="mt-2 text-sm text-muted">当前命名空间没有返回 TLS Secret。</p>
            </div>
          ) : null}
        </div>
      </DataPanel>

      {activeAction === 'create' ? (
        <CertificateActionDrawer title="创建证书" onClose={() => setActiveAction(null)}>
          <div className="text-sm font-semibold text-on-surface">证书写操作</div>
          <p className="text-xs text-muted">真实集群写操作尚未启用；私钥仅作为未来提交输入，不做页面回显。</p>
          <CertInput label="name" value={name} onChange={setName} />
          <CertInput label="common_name" value={commonName} onChange={setCommonName} />
          <CertInput label="not_after" value={notAfter} onChange={setNotAfter} />
          <label className="block text-xs font-semibold text-muted">
            certificate_pem
            <textarea className="console-input mt-2 min-h-20 w-full font-mono text-xs" value={certificatePEM} onChange={(event) => setCertificatePEM(event.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            private material
            <textarea
              className="console-input mt-2 min-h-20 w-full font-mono text-xs"
              placeholder="仅在提交时发送，不做页面回显"
              value={keyMaterialPEM}
              onChange={(event) => setKeyMaterialPEM(event.target.value)}
            />
          </label>
          <DrawerFooter>
            <button className="console-button" onClick={() => setActiveAction(null)}>取消</button>
            <button className="console-button console-button-primary" disabled={!activeClusterId || !namespace || !name.trim() || !certificatePEM.trim() || !keyMaterialPEM.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>创建</button>
          </DrawerFooter>
        </CertificateActionDrawer>
      ) : null}

      {activeAction === 'delete' ? (
        <CertificateActionDrawer title="删除证书" onClose={() => setActiveAction(null)}>
          <div className="text-sm font-semibold text-on-surface">删除确认摘要</div>
          <div className="rounded-lg bg-surface px-3 py-3 text-xs text-muted">
            <div className="font-mono">id={current?.id ?? '-'}</div>
            <div className="font-mono">name={current?.name ?? '-'}</div>
            <div className="font-mono">fingerprint={current?.fingerprint ?? '-'}</div>
          </div>
          <DrawerFooter>
            <button className="console-button" onClick={() => setActiveAction(null)}>取消</button>
            <button className="console-button console-button-danger" disabled={!current || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>删除</button>
          </DrawerFooter>
        </CertificateActionDrawer>
      ) : null}

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

function CertificateActionDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button className="absolute inset-0 cursor-default" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[720px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="certificate-action-title">
        <header className="flex items-start justify-between gap-4 border-b border-outline px-5 py-4">
          <h2 id="certificate-action-title" className="text-base font-semibold text-on-surface">{title}</h2>
          <button className="console-button h-8 w-8 p-0" aria-label={`关闭${title}`} onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex items-center justify-end gap-2 border-t border-outline pt-4">{children}</div>;
}

function CertInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-muted">
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

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}
