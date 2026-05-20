import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CircleSlash2, Play, ShieldCheck, SquareTerminal } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sTerminalResult } from './api';

const SAFE_EXAMPLES = ['get pods -n orders', 'describe deployment orders-api -n orders', 'logs deployment/orders-api -n orders --tail=100'];
const BLOCKED_EXAMPLES = ['delete', 'apply', 'exec', 'port-forward', '|', ';'];

export function K8sTerminalPage() {
  const [clusterId, setClusterId] = useState('prod');
  const [namespace, setNamespace] = useState('orders');
  const [command, setCommand] = useState('get pods -n orders');
  const [result, setResult] = useState<K8sTerminalResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => k8sApi.execTerminal({ clusterId, namespace, command }),
    onSuccess: (next) => setResult(next),
  });

  const permissionError = useMemo(() => {
    const message = mutation.error?.message ?? '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [mutation.error]);

  const policyError = useMemo(() => {
    const message = mutation.error?.message ?? '';
    return message.includes('安全策略') || message.includes('blocked') ? message : '';
  }, [mutation.error]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <TerminalMetric icon={SquareTerminal} label="执行模式" value="dry_run" meta="executor adapter pending" />
        <TerminalMetric icon={ShieldCheck} label="权限域" value="namespace" meta="k8s.terminal:exec" />
        <TerminalMetric icon={CircleSlash2} label="策略" value="read-only" meta="danger verbs blocked" />
      </div>

      <DataPanel title="受控终端" meta="NovaObs terminal · RBAC + audit + policy guard">
        {permissionError ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            权限不足：当前用户缺少 `k8s.terminal:exec` 命名空间权限。
          </div>
        ) : null}
        {policyError ? (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-danger">
            命令已被安全策略阻断，后端会记录阻断审计。
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">运行目标</div>
            <p className="mt-1 text-xs text-muted">第一版只接入只读 kubectl 语义，通过 `/api/v1/k8s/terminal/exec` 进入统一审计。</p>
            <TerminalInput label="cluster_id" value={clusterId} onChange={setClusterId} />
            <TerminalInput label="namespace" value={namespace} onChange={setNamespace} />
            <label className="mt-3 block text-xs font-semibold text-muted">
              command
              <textarea className="console-input mt-2 min-h-28 w-full font-mono text-xs" value={command} onChange={(event) => setCommand(event.target.value)} />
            </label>
            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!clusterId.trim() || !namespace.trim() || !command.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              <Play className="h-4 w-4" />
              执行校验
            </button>
          </section>

          <section className="console-panel px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">执行回显</div>
                <p className="mt-1 text-xs text-muted">输出区只展示策略结果、退出码、审计 ID 和 dry_run 回显。</p>
              </div>
              <span className="rounded-lg bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{result?.mode ?? 'policy_guard'}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <ResultBox label="status" value={result?.status ?? '-'} />
              <ResultBox label="exit_code" value={String(result?.exitCode ?? '-')} />
              <ResultBox label="audit_id" value={result?.auditId ?? '-'} />
            </div>
            <pre className="mt-4 min-h-52 overflow-auto rounded-lg bg-[#111827] p-4 text-xs leading-6 text-[#d1fae5] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
{result?.output ?? '等待命令校验。'}
            </pre>
          </section>
        </div>
      </DataPanel>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-4 md:grid-cols-2">
          <PolicyList title="只读示例" items={SAFE_EXAMPLES} tone="safe" />
          <PolicyList title="阻断示例" items={BLOCKED_EXAMPLES} tone="danger" />
        </div>
      </section>
    </div>
  );
}

function TerminalInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block text-xs font-semibold text-muted">
      {label}
      <input className="console-input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TerminalMetric({ icon: Icon, label, value, meta }: { icon: typeof SquareTerminal; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-4 font-display text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}

function ResultBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="text-[11px] font-semibold uppercase text-muted">{label}</div>
      <div className="mt-2 truncate font-mono text-xs font-semibold text-on-surface">{value}</div>
    </div>
  );
}

function PolicyList({ title, items, tone }: { title: string; items: string[]; tone: 'safe' | 'danger' }) {
  return (
    <div>
      <div className="text-sm font-semibold text-on-surface">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className={`rounded-lg px-3 py-1 text-xs font-semibold ${tone === 'safe' ? 'bg-primary-soft text-primary' : 'bg-rose-50 text-danger'}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
