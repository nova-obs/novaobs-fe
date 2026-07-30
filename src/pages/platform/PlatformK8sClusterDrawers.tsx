import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Trash2, X } from 'lucide-react';
import { HelpTip } from '../../components/HelpTip';
import type { K8sCluster, K8sClusterCredential } from '../k8s/api';

export interface ClusterRegistrationDraft {
  id: string;
  name: string;
  region: string;
  description: string;
  kubeconfig: string;
}

export const emptyClusterRegistrationDraft: ClusterRegistrationDraft = {
  id: '',
  name: '',
  region: '',
  description: '',
  kubeconfig: '',
};

export function ClusterRegistrationDrawer({
  open,
  draft,
  pending,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: ClusterRegistrationDraft;
  pending: boolean;
  error: Error | null;
  onChange: (draft: ClusterRegistrationDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;
  const disabled = !draft.id.trim() || !draft.name.trim() || !draft.kubeconfig.trim() || pending;
  return (
    <Drawer title="登记 K8S 集群" busy={pending} onClose={onClose}>
      <div className="grid gap-4">
        <div className="console-notice">
          登记时会先验证集群管理凭据、初始化 NovaAPM 所需权限、创建用户请求专用执行凭据并探测版本；全部成功后才写入集群目录。
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="集群 ID" value={draft.id} onChange={(value) => onChange({ ...draft, id: value })} />
          <TextField label="显示名称" value={draft.name} onChange={(value) => onChange({ ...draft, name: value })} />
        </div>
        <TextField label="区域（可选）" value={draft.region} onChange={(value) => onChange({ ...draft, region: value })} />
        <TextField label="描述（可选）" value={draft.description} onChange={(value) => onChange({ ...draft, description: value })} />
        <label className="grid gap-1.5 text-xs font-semibold text-on-surface">
          <span className="inline-flex items-center gap-2">
            Controller Kubeconfig
            <HelpTip
              content="请提供不依赖 exec/auth-provider 插件、文件引用或本机环境的完整 kubeconfig。Server 必须使用 HTTPS，凭据需要能初始化 NovaAPM Broker 并读取 API Discovery。明文只用于本次校验和加密写入，不会返回到前端。"
              label="Controller Kubeconfig 格式说明"
            />
          </span>
          <textarea
            className="console-input min-h-52 w-full font-mono text-[11px]"
            value={draft.kubeconfig}
            onChange={(event) => onChange({ ...draft, kubeconfig: event.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="flex justify-end gap-2 border-t border-outline pt-4">
          <button type="button" className="console-button" disabled={pending} onClick={onClose}>取消</button>
          <button type="button" className="console-button console-button-primary" disabled={disabled} onClick={onSubmit}>
            {pending ? '登记并探测中…' : '登记并探测'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

export function ClusterCredentialDrawer({
  cluster,
  credentials,
  loading,
  kubeconfig,
  pending,
  deleting,
  error,
  success,
  probeStatePersisted,
  deletionSuccess,
  clusterStatePersisted,
  onKubeconfigChange,
  onClose,
  onReplace,
  onDelete,
}: {
  cluster: K8sCluster | null;
  credentials: K8sClusterCredential[];
  loading: boolean;
  kubeconfig: string;
  pending: boolean;
  deleting: boolean;
  error: Error | null;
  success: boolean;
  probeStatePersisted?: boolean;
  deletionSuccess: boolean;
  clusterStatePersisted?: boolean;
  onKubeconfigChange: (value: string) => void;
  onClose: () => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  if (!cluster) return null;
  return (
    <Drawer title={`集群管理凭据 · ${cluster.name || cluster.id}`} busy={pending || deleting} onClose={onClose}>
      <div className="grid gap-4">
        <div className="rounded-md border border-outline bg-surface px-3 py-2">
          <div className="font-mono text-xs text-on-surface">{cluster.id}</div>
          <div className="mt-1 inline-flex items-center gap-2 text-xs text-muted">
            管理凭据只用于权限下发；用户访问使用独立的低权限执行凭据。
            <HelpTip content="系统内部将两者称为 Controller 与 Broker。Controller 仅供平台同步固定权限；Broker 通过 Kubernetes Impersonation 代表当前用户执行请求，不直接持有工作负载权限。" label="两类凭据分工说明" />
          </div>
        </div>
        <section>
          <h3 className="text-xs font-semibold text-muted">已加密保存的版本</h3>
          <div className="mt-2 grid gap-2">
            {loading ? <div className="console-skeleton h-16" /> : credentials.map((item) => (
              <div key={item.secretId} className="rounded-md border border-outline px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-on-surface">{item.name}</span>
                  <span className="text-muted">v{item.version} · {credentialStateLabel(item)}</span>
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-muted">{item.fingerprint || '无指纹'}</div>
                <div className="mt-1 text-[11px] text-muted">有效期：{formatTime(item.expiresAt)}</div>
              </div>
            ))}
            {!loading && !credentials.length ? <div className="rounded-md border border-dashed border-outline px-3 py-5 text-center text-xs text-muted">暂无集群管理凭据</div> : null}
          </div>
        </section>
        <label className="grid gap-1.5 text-xs font-semibold text-on-surface">
          <span className="inline-flex items-center gap-2">
            替换集群管理 Kubeconfig
            <HelpTip content="替换后会重新校验连接、签发 Broker 凭据、保存最近探测结果并刷新集群版本。旧凭据版本不会进入用户资源请求链路。" label="替换凭据说明" />
          </span>
          <textarea
            className="console-input min-h-40 w-full font-mono text-[11px]"
            value={kubeconfig}
            onChange={(event) => onKubeconfigChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {error ? <ErrorNotice error={error} /> : null}
        {success && probeStatePersisted === false ? (
          <div className="rounded-md border border-warning/30 bg-amber-50 px-3 py-2 text-sm font-semibold text-warning" role="status" aria-live="polite">
            凭据已替换，但最近探测状态保存失败。请在集群列表中重新执行探测。
          </div>
        ) : success ? (
          <div className="text-sm font-semibold text-success" role="status" aria-live="polite">凭据已替换并重新探测，明文未保留。</div>
        ) : null}
        {deletionSuccess && clusterStatePersisted === false ? (
          <div className="rounded-md border border-warning/30 bg-amber-50 px-3 py-2 text-sm font-semibold text-warning" role="status" aria-live="polite">
            凭据与权限已删除，但集群连接状态保存失败。刷新后请确认状态并重新探测。
          </div>
        ) : deletionSuccess ? (
          <div className="text-sm font-semibold text-success" role="status" aria-live="polite">凭据与命名空间权限已删除，集群连接状态已重置。</div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-outline pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="console-button text-danger" disabled={loading || !credentials.length || deleting || pending} onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            删除全部凭据并撤销权限
          </button>
          <div className="flex justify-end gap-2">
            <button type="button" className="console-button" disabled={pending || deleting} onClick={onClose}>关闭</button>
            <button type="button" className="console-button console-button-primary" disabled={!kubeconfig.trim() || pending || deleting} onClick={onReplace}>
              <KeyRound className="h-3.5 w-3.5" />
              {pending ? '替换并探测中…' : '替换并重新探测'}
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function Drawer({ title, children, busy = false, onClose }: {
  title: string;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    firstFocusable(panel)?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key === 'Tab') trapFocus(event, panel);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div className="console-drawer-backdrop fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default" tabIndex={-1} aria-hidden="true" disabled={busy} onClick={onClose} />
      <aside ref={panelRef} className="console-drawer-panel relative flex h-full w-full max-w-2xl flex-col border-l border-outline bg-white shadow-xl" role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-center justify-between border-b border-outline px-5 py-4">
          <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          <button type="button" className="console-icon-button" aria-label={`关闭${title}`} disabled={busy} onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-on-surface">
      {label}
      <input className="console-input w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ErrorNotice({ error }: { error: Error }) {
  return <div role="alert" className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger">{error.message}</div>;
}

function credentialStateLabel(item: K8sClusterCredential) {
  if (item.expired) return item.active ? '当前版本已过期' : '已过期';
  if (item.expiresSoon) return item.active ? '当前生效 · 即将过期' : '即将过期';
  if (item.active) return '当前生效';
  return item.status === 'active' ? '可用' : '历史版本';
}

function formatTime(value: string) {
  if (!value) return '未设置';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function focusableElements(panel: HTMLElement | null) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('aria-hidden'));
}

function firstFocusable(panel: HTMLElement | null) {
  return focusableElements(panel)[0];
}

function trapFocus(event: globalThis.KeyboardEvent, panel: HTMLElement | null) {
  const focusable = focusableElements(panel);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
