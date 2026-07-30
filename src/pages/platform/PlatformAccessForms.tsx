import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { K8sAccessLevel, K8sAccessProfile, K8sNamespaceImpact, ProductAccessRole } from './accessApi';
import type { PlatformGroup, PlatformServiceAccount, PlatformUser } from './api';
import type { Editor, IdentityDraft, IdentityKind } from './PlatformAccessAdminPage';

export function IdentityForm({
  draft,
  setDraft,
  pending,
  onSubmit,
}: {
  draft: IdentityDraft;
  setDraft: (draft: IdentityDraft) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const valid = Boolean(draft.name.trim() && draft.displayName.trim() && (draft.kind !== 'user' || draft.password.length >= 8));
  return (
    <FormStack>
      <Field label="身份类型">
        <select className="console-select w-full" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as IdentityKind })}>
          <option value="user">用户</option>
          <option value="group">用户组</option>
          <option value="service-account">服务账号</option>
        </select>
      </Field>
      <TextField label={draft.kind === 'user' ? '用户名' : '名称'} value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label="显示名称" value={draft.displayName} onChange={(value) => setDraft({ ...draft, displayName: value })} />
      {draft.kind === 'user' ? (
        <>
          <TextField label="邮箱（可选）" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
          <TextField label="初始密码（至少 8 位）" type="password" value={draft.password} onChange={(value) => setDraft({ ...draft, password: value })} />
        </>
      ) : null}
      {draft.kind === 'service-account' ? <TextField label="Owner" value={draft.owner} onChange={(value) => setDraft({ ...draft, owner: value })} /> : null}
      {draft.kind !== 'user' ? <TextField label="说明（可选）" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} /> : null}
      <SubmitButton label="创建身份" disabled={!valid || pending} onClick={onSubmit} />
    </FormStack>
  );
}

export function MembershipForm({
  draft,
  groups,
  subjects,
  setDraft,
  pending,
  onSubmit,
}: {
  draft: { groupId: string; subjectType: string; subjectId: string };
  groups: PlatformGroup[];
  subjects: Array<PlatformUser | PlatformServiceAccount>;
  setDraft: (draft: { groupId: string; subjectType: string; subjectId: string }) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const groupId = draft.groupId || groups[0]?.id || '';
  const subjectId = draft.subjectId || subjects[0]?.id || '';
  return (
    <FormStack>
      <Field label="用户组"><Select value={groupId} options={groups.map((item) => ({ value: item.id, label: item.displayName || item.name }))} onChange={(value) => setDraft({ ...draft, groupId: value })} /></Field>
      <Field label="成员类型">
        <select className="console-select w-full" value={draft.subjectType} onChange={(event) => setDraft({ ...draft, subjectType: event.target.value, subjectId: '' })}>
          <option value="user">用户</option>
          <option value="service-account">服务账号</option>
        </select>
      </Field>
      <Field label="成员"><Select value={subjectId} options={subjects.map((item) => ({ value: item.id, label: identityOptionLabel(item) }))} onChange={(value) => setDraft({ ...draft, subjectId: value })} /></Field>
      <SubmitButton label="加入用户组" disabled={!groupId || !subjectId || pending} onClick={onSubmit} />
    </FormStack>
  );
}

export function PlatformAdminForm({
  draft,
  subjects,
  setDraft,
  pending,
  onSubmit,
}: {
  draft: { subjectType: 'user' | 'group'; subjectId: string };
  subjects: Array<PlatformUser | PlatformGroup>;
  setDraft: (draft: { subjectType: 'user' | 'group'; subjectId: string }) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const subjectId = draft.subjectId || subjects[0]?.id || '';
  return (
    <FormStack>
      <div className="console-notice">平台管理员只管理控制面，不继承 Product 或 K8S 业务访问。</div>
      <Field label="主体类型">
        <select className="console-select w-full" value={draft.subjectType} onChange={(event) => setDraft({ subjectType: event.target.value as 'user' | 'group', subjectId: '' })}>
          <option value="user">用户</option>
          <option value="group">用户组</option>
        </select>
      </Field>
      <Field label="主体"><Select value={subjectId} options={subjects.map((item) => ({ value: item.id, label: identityOptionLabel(item) }))} onChange={(value) => setDraft({ ...draft, subjectId: value })} /></Field>
      <SubmitButton label="授予平台管理员" disabled={!subjectId || pending} onClick={onSubmit} />
    </FormStack>
  );
}

export function ProductAccessForm({
  draft,
  products,
  subjects,
  setDraft,
  pending,
  onSubmit,
}: {
  draft: { productId: string; subjectType: 'group' | 'service-account'; subjectId: string; role: ProductAccessRole };
  products: Array<{ id: string; name: string }>;
  subjects: Array<PlatformGroup | PlatformServiceAccount>;
  setDraft: (draft: { productId: string; subjectType: 'group' | 'service-account'; subjectId: string; role: ProductAccessRole }) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const productId = draft.productId || products[0]?.id || '';
  const subjectId = draft.subjectId || subjects[0]?.id || '';
  return (
    <FormStack>
      <div className="console-notice">授权覆盖 Product 下全部 Service，但不会产生任何 K8S 权限。</div>
      <Field label="Product"><Select value={productId} options={products.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, productId: value })} /></Field>
      <Field label="主体类型">
        <select className="console-select w-full" value={draft.subjectType} onChange={(event) => setDraft({ ...draft, subjectType: event.target.value as 'group' | 'service-account', subjectId: '' })}>
          <option value="group">用户组</option>
          <option value="service-account">服务账号</option>
        </select>
      </Field>
      <Field label="主体"><Select value={subjectId} options={subjects.map((item) => ({ value: item.id, label: item.displayName || item.name }))} onChange={(value) => setDraft({ ...draft, subjectId: value })} /></Field>
      <Field label="能力">
        <select className="console-select w-full" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as ProductAccessRole })}>
          <option value="product-viewer">Product Viewer</option>
          <option value="product-maintainer">Product Maintainer</option>
        </select>
      </Field>
      <SubmitButton label="添加产品授权" disabled={!productId || !subjectId || pending} onClick={onSubmit} />
    </FormStack>
  );
}

export function K8sProfileForm({
  draft,
  clusters,
  namespaces,
  invalidNamespace,
  impacts,
  impactsLoading,
  impactsError,
  editing,
  setDraft,
  pending,
  onSubmit,
}: {
  draft: { name: string; clusterId: string; accessLevel: K8sAccessLevel; namespacesText: string; wholeNamespaceConfirmed: boolean };
  clusters: Array<{ id: string; name: string }>;
  namespaces: string[];
  invalidNamespace: boolean;
  impacts: K8sNamespaceImpact[];
  impactsLoading: boolean;
  impactsError: Error | null;
  editing: boolean;
  setDraft: (draft: { name: string; clusterId: string; accessLevel: K8sAccessLevel; namespacesText: string; wholeNamespaceConfirmed: boolean }) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const clusterId = draft.clusterId || clusters[0]?.id || '';
  const impactCheckReady = namespaces.length > 0 && !impactsLoading && !impactsError;
  const valid = Boolean(draft.name.trim() && clusterId && namespaces.length && !invalidNamespace && impactCheckReady && draft.wholeNamespaceConfirmed);
  return (
    <FormStack>
      <TextField label="Profile 名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <Field label="集群">
        {editing ? (
          <div className="console-input w-full bg-surface text-on-surface">
            {clusters.find((item) => item.id === clusterId)?.name || clusterId} ({clusterId})
          </div>
        ) : (
          <Select
            value={clusterId}
            options={clusters.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))}
            onChange={(value) => setDraft({ ...draft, clusterId: value, wholeNamespaceConfirmed: false })}
          />
        )}
      </Field>
      <Field label="固定能力等级">
        <select
          className="console-select w-full"
          value={draft.accessLevel}
          onChange={(event) => setDraft({
            ...draft,
            accessLevel: event.target.value as K8sAccessLevel,
            wholeNamespaceConfirmed: false,
          })}
        >
          <option value="developer">Developer（查看资源与日志）</option>
          <option value="namespace-maintainer">Namespace Maintainer（含发布、删除与 Pod exec）</option>
        </select>
      </Field>
      <Field label="Namespaces（换行或逗号分隔）">
        <textarea
          className="console-input min-h-28 w-full font-mono"
          value={draft.namespacesText}
          onChange={(event) => setDraft({
            ...draft,
            namespacesText: event.target.value,
            wholeNamespaceConfirmed: false,
          })}
          placeholder={'orders-prod\npayments-prod'}
        />
      </Field>
      {invalidNamespace ? <div className="console-notice console-notice-warning">禁止使用空 Namespace、* 或 all_namespaces。</div> : null}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
        <div className="flex gap-2 text-sm font-semibold text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />整 Namespace 风险确认</div>
        <p className="mt-2 text-xs leading-5 text-muted">
          被授权组可看到所选 Namespace 内所有工作负载；Maintainer 还可执行发布、删除、回滚和 Pod exec。
        </p>
        <div className="mt-2 rounded border border-dashed border-amber-300 bg-white px-3 py-2 text-xs text-muted">
          <div className="font-semibold text-on-surface">关联 Product / Service</div>
          {!namespaces.length ? <p className="mt-1">输入具体 Namespace 后显示 ServiceDeployment 生产真值。</p> : null}
          {impactsLoading ? <p className="mt-1">正在解析 Namespace 影响范围…</p> : null}
          {impactsError ? <p className="mt-1 text-danger">影响范围读取失败，暂不能确认或保存：{impactsError.message}</p> : null}
          {!impactsLoading && !impactsError && namespaces.length && !impacts.length ? (
            <p className="mt-1">未发现已登记的 Product / Service；这不代表 Namespace 中不存在其他工作负载。</p>
          ) : null}
          {!impactsLoading && !impactsError && impacts.length ? (
            <ul className="mt-2 space-y-1.5">
              {impacts.map((impact) => (
                <li key={`${impact.namespace}:${impact.deploymentId}`} className="rounded bg-amber-50 px-2 py-1.5">
                  <span className="font-mono text-[11px] text-warning">{impact.namespace}</span>
                  <span className="mx-1.5 text-outline-strong">·</span>
                  <span className="font-semibold text-on-surface">{impact.productName || impact.productId}</span>
                  <span className="mx-1">/</span>
                  <span>{impact.serviceName || impact.serviceId}</span>
                  <span className="ml-1.5 font-mono text-[11px]">{impact.workloadKind}/{impact.workloadName}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-on-surface">
          <input
            className="mt-0.5"
            type="checkbox"
            disabled={!impactCheckReady}
            checked={draft.wholeNamespaceConfirmed}
            onChange={(event) => setDraft({ ...draft, wholeNamespaceConfirmed: event.target.checked })}
          />
          我已确认整 Namespace 可见性与机密访问风险
        </label>
      </div>
      <SubmitButton label={editing ? '保存 Profile' : '创建 Profile'} disabled={!valid || pending} onClick={onSubmit} />
    </FormStack>
  );
}

export function K8sGrantForm({
  draft,
  profiles,
  groups,
  setDraft,
  pending,
  onSubmit,
}: {
  draft: { profileId: string; groupId: string };
  profiles: K8sAccessProfile[];
  groups: PlatformGroup[];
  setDraft: (draft: { profileId: string; groupId: string }) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const profileId = draft.profileId || profiles[0]?.id || '';
  const groupId = draft.groupId || groups[0]?.id || '';
  return (
    <FormStack>
      {profiles.length === 0 ? <div className="console-notice console-notice-warning">请先同步至少一个 Profile，成功后才能授权用户组。</div> : null}
      <Field label="K8S Access Profile"><Select value={profileId} options={profiles.map((item) => ({ value: item.id, label: `${item.name} · ${k8sLevelLabel(item.accessLevel)}` }))} onChange={(value) => setDraft({ ...draft, profileId: value })} /></Field>
      <Field label="用户组"><Select value={groupId} options={groups.map((item) => ({ value: item.id, label: item.displayName || item.name }))} onChange={(value) => setDraft({ ...draft, groupId: value })} /></Field>
      <SubmitButton label="授权用户组" disabled={!profileId || !groupId || pending} onClick={onSubmit} />
    </FormStack>
  );
}

export function BreakGlassForm({
  draft,
  clusters,
  setDraft,
  pending,
  onSubmit,
}: {
  draft: { clusterId: string; reason: string };
  clusters: Array<{ id: string; name: string }>;
  setDraft: (draft: { clusterId: string; reason: string }) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const clusterId = draft.clusterId || clusters[0]?.id || '';
  return (
    <FormStack>
      <div className="console-notice console-notice-warning">申请不会立即生效，必须由另一名平台管理员审批，且最长 120 分钟。</div>
      <Field label="目标集群"><Select value={clusterId} options={clusters.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))} onChange={(value) => setDraft({ ...draft, clusterId: value })} /></Field>
      <Field label="紧急原因">
        <textarea className="console-input min-h-28 w-full" value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
      </Field>
      <SubmitButton label="提交申请" disabled={!clusterId || draft.reason.trim().length < 8 || pending} onClick={onSubmit} />
    </FormStack>
  );
}

export function EditorDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button className="absolute inset-0 cursor-default" type="button" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-xl flex-col border-l border-outline bg-white shadow-xl" role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-center justify-between border-b border-outline px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold text-muted">固定授权任务</div>
            <h2 className="mt-1 text-base font-semibold text-on-surface">{title}</h2>
          </div>
          <button className="console-icon-button" type="button" aria-label={`关闭${title}`} onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

function FormStack({ children }: { children: ReactNode }) {
  return <div className="grid gap-4">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-muted">{label}{children}</label>;
}

function TextField({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <Field label={label}><input className="console-input w-full" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></Field>;
}

function Select({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <select className="console-select w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      {!options.length ? <option value="">暂无可选项</option> : null}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function SubmitButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <button className="console-button console-button-primary justify-center" type="button" disabled={disabled} onClick={onClick}>{label}</button>;
}

export function parseNamespaces(value: string) {
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
}

function k8sLevelLabel(level: K8sAccessLevel) {
  return level === 'namespace-maintainer' ? 'Namespace Maintainer' : 'Developer';
}

function identityOptionLabel(item: PlatformUser | PlatformGroup | PlatformServiceAccount) {
  if (item.displayName) return item.displayName;
  if ('username' in item) return item.username;
  return item.name;
}

export function editorTitle(editor: Editor) {
  if (editor === 'identity') return '创建用户、用户组或服务账号';
  if (editor === 'membership') return '维护用户组成员';
  if (editor === 'platform-admin') return '添加平台管理员';
  if (editor === 'product-access') return '添加 Product 授权';
  if (editor === 'k8s-profile') return '创建 K8S Access Profile';
  if (editor === 'k8s-grant') return '授权 K8S 用户组';
  return '申请 Break Glass';
}
