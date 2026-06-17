import { createPortal } from 'react-dom';
import { AlertTriangle, Play, RefreshCw, Settings2, XCircle } from 'lucide-react';
import type { LogParsePreviewResult } from './api';

export type ParserMode = 'none' | 'json' | 'regex';

interface ParsePreviewMutationState {
  isPending: boolean;
  error: unknown;
  data?: LogParsePreviewResult;
  mutate: () => void;
}

interface LogsParseRuleDialogProps {
  open: boolean;
  serviceLabel: string;
  scopeLabel: string;
  parseSample: string;
  parserDraftMode: ParserMode;
  parserDraftRuleName: string;
  parserDraftPattern: string;
  parseDraftValid: boolean;
  parsePreviewMutation: ParsePreviewMutationState;
  onParseSampleChange: (value: string) => void;
  onParserDraftModeChange: (value: ParserMode) => void;
  onParserDraftRuleNameChange: (value: string) => void;
  onParserDraftPatternChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export function LogsParseRuleDialog({
  open,
  serviceLabel,
  scopeLabel,
  parseSample,
  parserDraftMode,
  parserDraftRuleName,
  parserDraftPattern,
  parseDraftValid,
  parsePreviewMutation,
  onParseSampleChange,
  onParserDraftModeChange,
  onParserDraftRuleNameChange,
  onParserDraftPatternChange,
  onClose,
  onApply,
}: LogsParseRuleDialogProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/28 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-lg border border-outline bg-white shadow-[0_24px_80px_rgba(24,52,96,0.28)]">
        <div className="flex shrink-0 items-center justify-between border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
              <Settings2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold leading-5 text-on-surface">解析规则</div>
              <div className="mt-1 truncate font-mono text-[11px] text-muted">{serviceLabel} · {scopeLabel}</div>
            </div>
          </div>
          <button className="rounded p-1.5 text-muted hover:bg-surface-low hover:text-on-surface" onClick={onClose} title="关闭">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 divide-y divide-outline overflow-auto lg:grid-cols-[0.9fr_1fr_0.9fr] lg:divide-x lg:divide-y-0">
          <section className="flex min-h-[320px] flex-col">
            <div className="border-b border-outline px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">日志样本</div>
            </div>
            <textarea className="min-h-[260px] flex-1 resize-none border-0 bg-white p-4 font-mono text-xs leading-5 text-on-surface outline-none" value={parseSample} onChange={(event) => onParseSampleChange(event.target.value)} />
          </section>
          <section className="flex min-h-[320px] flex-col">
            <div className="border-b border-outline px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">规则</div>
            </div>
            <div className="grid gap-3 overflow-auto p-4">
              <label className="text-xs font-semibold text-muted">
                规则类型
                <select className="console-input mt-1 w-full" value={parserDraftMode} onChange={(event) => onParserDraftModeChange(event.target.value as ParserMode)}>
                  <option value="none">不解析</option>
                  <option value="json">JSON</option>
                  <option value="regex">Regex</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                规则名
                <input className="console-input mt-1 w-full" value={parserDraftRuleName} onChange={(event) => onParserDraftRuleNameChange(event.target.value)} disabled={parserDraftMode === 'none'} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Regex Pattern
                <textarea className="console-input mt-1 min-h-[120px] w-full resize-y font-mono text-xs leading-5" value={parserDraftPattern} onChange={(event) => onParserDraftPatternChange(event.target.value)} disabled={parserDraftMode !== 'regex'} />
              </label>
              {parserDraftMode === 'regex' && !parseDraftValid ? <WarnLine message="Regex 需要使用命名捕获组，例如 (?P<level>INFO)。" /> : null}
            </div>
          </section>
          <section className="flex min-h-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-outline px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">预览</div>
              <button className="inline-flex h-8 items-center gap-2 rounded border border-primary bg-white px-3 text-xs font-semibold text-primary disabled:opacity-60" disabled={parsePreviewMutation.isPending || !parseDraftValid} onClick={() => parsePreviewMutation.mutate()}>
                {parsePreviewMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                预览
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {parsePreviewMutation.error ? <ErrorLine message={(parsePreviewMutation.error as Error).message} /> : null}
              {parsePreviewMutation.data?.errors.map((item) => <ErrorLine key={item} message={item} />)}
              {parsePreviewMutation.data?.warnings.map((item) => <WarnLine key={item} message={item} />)}
              <pre className="min-h-[220px] rounded border border-outline bg-surface-lowest p-3 font-mono text-xs leading-5 text-on-surface whitespace-pre-wrap">
                {parsePreviewMutation.data ? JSON.stringify(parsePreviewMutation.data.fields, null, 2) : '未预览'}
              </pre>
            </div>
          </section>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-outline bg-surface-lowest px-4 py-3">
          <button className="rounded-lg border border-outline bg-white px-4 py-2 text-sm font-semibold text-on-surface" onClick={onClose}>取消</button>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!parseDraftValid || parsePreviewMutation.data?.status === 'error'} onClick={onApply}>应用</button>
        </div>
      </div>
    </div>
  ), document.body);
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />{message}
    </div>
  );
}

function WarnLine({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-700">
      <AlertTriangle className="h-4 w-4" />{message}
    </div>
  );
}
