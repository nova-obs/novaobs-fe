import { AlertTriangle, CheckCircle2, Clipboard, FileJson2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useServiceScope } from '../../components/navigation/ServiceScopeContext';
import {
  assessBusinessLogProposal,
  buildCollectedLogPreview,
  formatDemoScenarios,
  maxBusinessLogProposalLength,
  type FormatCheck,
  type FormatDemoScenario,
} from './logFormatDemoModel';

type ResultTab = 'checks' | 'recommendation' | 'collected';
const resultTabs: ResultTab[] = ['checks', 'recommendation', 'collected'];

const checkStatusMeta: Record<FormatCheck['status'], { label: string; className: string }> = {
  pass: { label: '通过', className: 'border-emerald-600/20 bg-emerald-50 text-emerald-700' },
  change: { label: '需规范', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  missing: { label: '未提供', className: 'border-outline bg-surface-low text-muted' },
  invalid: { label: '格式不符', className: 'border-red-200 bg-red-50 text-red-700' },
};

export function LogsFormatDemoPage() {
  const { activeService } = useServiceScope();
  const [scenarioId, setScenarioId] = useState<FormatDemoScenario['id']>('java-text');
  const scenario = formatDemoScenarios.find((item) => item.id === scenarioId) ?? formatDemoScenarios[0];
  const [proposal, setProposal] = useState(scenario.proposal);
  const [activeTab, setActiveTab] = useState<ResultTab>('checks');
  const [copyStatus, setCopyStatus] = useState('');
  const assessment = useMemo(() => assessBusinessLogProposal(proposal), [proposal]);
  const collectedPreview = useMemo(() => buildCollectedLogPreview(assessment.recommendation, {
    productId: activeService?.productId ?? '',
    serviceKey: activeService?.key ?? '',
    serviceId: activeService?.id ?? '',
    serviceDeploymentId: '',
    logRouteId: '',
    sourceType: '',
  }), [activeService, assessment.recommendation]);
  const passedRequired = assessment.checks.filter((item) => item.requirement === '必填' && item.status === 'pass').length;
  const passedRecommended = assessment.checks.filter((item) => item.requirement === '推荐' && item.status === 'pass').length;

  function selectScenario(nextId: FormatDemoScenario['id']) {
    const next = formatDemoScenarios.find((item) => item.id === nextId) ?? formatDemoScenarios[0];
    setScenarioId(next.id);
    setProposal(next.proposal);
    setCopyStatus('');
  }

  async function copyRecommendation() {
    if (!assessment.recommendation || assessment.status === 'blocked') return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(assessment.recommendation));
      setCopyStatus('已复制');
    } catch {
      setCopyStatus('复制失败');
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: ResultTab) {
    const currentIndex = resultTabs.indexOf(current);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? resultTabs.length - 1
        : event.key === 'ArrowRight'
          ? (currentIndex + 1) % resultTabs.length
          : event.key === 'ArrowLeft'
            ? (currentIndex - 1 + resultTabs.length) % resultTabs.length
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = resultTabs[nextIndex];
    setActiveTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`logs-format-tab-${nextTab}`)?.focus());
  }

  return (
    <div className="logs-format-demo console-workbench h-full min-h-0 overflow-auto">
      <section className="console-panel flex min-h-full flex-col overflow-hidden" aria-label="日志格式改造洽谈演示">
        <header className="flex shrink-0 flex-col gap-3 border-b border-outline bg-surface-lowest px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-on-surface">日志格式改造</h2>
              <span className="status-badge border-primary/25 bg-primary-soft text-primary">
                <span className="status-dot" aria-hidden />洽谈稿
              </span>
              <span className="font-mono text-[11px] text-muted">{activeService?.name ?? '当前服务'}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">对齐业务输出责任与 NovaAPM 平台补齐边界，样例仅在当前浏览器内校验，不上传、不保存。</p>
          </div>
          <label className="w-full shrink-0 sm:w-56">
            <span className="mb-1 block text-[11px] font-semibold text-muted">业务现状样例</span>
            <select
              className="console-input h-9 w-full text-xs font-semibold"
              value={scenario.id}
              onChange={(event) => selectScenario(event.target.value as FormatDemoScenario['id'])}
              aria-label="选择业务现状样例"
            >
              {formatDemoScenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </header>

        <div className="grid shrink-0 divide-y divide-outline lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <section className="min-w-0">
            <div className="flex h-10 items-center justify-between border-b border-outline/70 bg-surface-low px-4">
              <div>
                <span className="text-xs font-semibold text-on-surface">改造前 · 当前日志</span>
                <span className="ml-2 text-[11px] text-muted">{scenario.summary}</span>
              </div>
            </div>
            <pre className="min-h-44 whitespace-pre-wrap break-all bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">{scenario.currentSample}</pre>
          </section>

          <section className="min-w-0">
            <div className="flex h-10 items-center justify-between border-b border-outline/70 bg-surface-low px-4">
              <span className="text-xs font-semibold text-on-surface">改造后 · 业务输出建议</span>
              <button
                type="button"
                className="console-button h-7 px-2"
                onClick={() => {
                  setProposal(scenario.proposal);
                  setCopyStatus('');
                }}
                title="恢复当前场景的建议格式"
              >
                <RotateCcw className="h-3.5 w-3.5" />恢复样例
              </button>
            </div>
            <textarea
              className="min-h-44 w-full resize-y border-0 bg-white p-4 font-mono text-xs leading-6 text-on-surface outline-none"
              value={proposal}
              onChange={(event) => {
                setProposal(event.target.value);
                setCopyStatus('');
              }}
              aria-label="业务输出建议 JSON"
              maxLength={maxBusinessLogProposalLength}
              spellCheck={false}
            />
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-y border-outline bg-surface-lowest px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2" role="status" aria-live="polite">
            <AssessmentStatus status={assessment.status} />
            <span className="text-xs text-muted">必填 <strong className="text-on-surface">{passedRequired}/4</strong></span>
            <span className="text-xs text-muted">推荐 <strong className="text-on-surface">{passedRecommended}/3</strong></span>
            {assessment.parseError ? <span className="truncate text-xs text-danger">{assessment.parseError}</span> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {copyStatus ? <span className={`text-xs ${copyStatus === '已复制' ? 'text-emerald-700' : 'text-danger'}`}>{copyStatus}</span> : null}
            <button
              type="button"
              className="console-button"
              disabled={!assessment.recommendation || assessment.status === 'blocked'}
              onClick={() => void copyRecommendation()}
              title={assessment.status === 'blocked' ? '请先修正阻断项' : '复制符合一行一事件要求的 JSON'}
            >
              <Clipboard className="h-3.5 w-3.5" />复制单行 JSON
            </button>
          </div>
        </div>

        {assessment.blockingIssues.length > 0 && !assessment.parseError ? (
          <div className="shrink-0 border-b border-outline bg-surface-lowest px-4 py-2">
            <div className="console-notice console-notice-danger" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">阻断原因</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {assessment.blockingIssues.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-[260px] flex-1 flex-col">
          <div className="flex w-full min-w-0 shrink-0 items-center gap-1 overflow-x-auto border-b border-outline bg-surface-low px-3 py-2" role="tablist" aria-label="格式评估结果">
            <ResultTabButton tab="checks" activeTab={activeTab} onSelect={setActiveTab} onKeyDown={handleTabKeyDown}>字段责任与校验</ResultTabButton>
            <ResultTabButton tab="recommendation" activeTab={activeTab} onSelect={setActiveTab} onKeyDown={handleTabKeyDown}>推荐业务 JSON</ResultTabButton>
            <ResultTabButton tab="collected" activeTab={activeTab} onSelect={setActiveTab} onKeyDown={handleTabKeyDown}>平台补齐后目标</ResultTabButton>
          </div>
          <div
            id="logs-format-result-panel"
            className="min-h-0 flex-1 overflow-auto"
            role="tabpanel"
            aria-labelledby={`logs-format-tab-${activeTab}`}
          >
            {activeTab === 'checks' ? <ChecksTable checks={assessment.checks} parseError={assessment.parseError} /> : null}
            {activeTab === 'recommendation' ? (
              <CodePreview
                title="业务输出"
                description="业务只负责日志事件本身；未知业务字段会保留，日志级别会按规范给出推荐值。页面为便于阅读而换行，实际输出必须一行一条事件。"
                value={assessment.recommendation}
              />
            ) : null}
            {activeTab === 'collected' ? (
              <CodePreview
                title="平台补齐"
                description="这是采集后的目标字段视图；产品、服务、部署、路由和来源身份由 NovaAPM 采集链路注入，不要求业务重复输出。"
                value={collectedPreview}
              />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function AssessmentStatus({ status }: { status: ReturnType<typeof assessBusinessLogProposal>['status'] }) {
  if (status === 'ready') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />业务格式已满足</span>;
  }
  if (status === 'ready_with_advice') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning"><AlertTriangle className="h-4 w-4" />可联调，仍有建议项</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger"><AlertTriangle className="h-4 w-4" />需先完成阻断项</span>;
}

function ResultTabButton({
  tab,
  activeTab,
  onSelect,
  onKeyDown,
  children,
}: {
  tab: ResultTab;
  activeTab: ResultTab;
  onSelect: (tab: ResultTab) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tab: ResultTab) => void;
  children: string;
}) {
  const active = tab === activeTab;
  return (
    <button
      type="button"
      className={`console-button h-8 ${active ? 'border-primary/30 bg-primary-soft text-primary' : 'border-transparent bg-transparent'}`}
      id={`logs-format-tab-${tab}`}
      role="tab"
      aria-selected={active}
      aria-controls="logs-format-result-panel"
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(tab)}
      onKeyDown={(event) => onKeyDown(event, tab)}
    >
      {children}
    </button>
  );
}

function ChecksTable({ checks, parseError }: { checks: FormatCheck[]; parseError: string }) {
  if (parseError) {
    return (
      <div className="m-4 console-notice console-notice-danger">
        <AlertTriangle className="h-4 w-4 shrink-0" />{parseError}
      </div>
    );
  }
  return (
    <table className="console-table w-full min-w-[760px] table-fixed">
      <thead>
        <tr>
          <th className="w-36">目标字段</th>
          <th className="w-20">要求</th>
          <th className="w-20">责任方</th>
          <th className="w-24">状态</th>
          <th className="w-52">当前值</th>
          <th>改造说明</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((item) => {
          const status = checkStatusMeta[item.status];
          return (
            <tr key={item.field}>
              <td className="font-mono text-xs font-semibold">{item.field}</td>
              <td>{item.requirement}</td>
              <td>{item.owner}</td>
              <td><span className={`status-badge ${status.className}`}><span className="status-dot" aria-hidden />{status.label}</span></td>
              <td className="truncate font-mono text-xs" title={item.currentValue}>{item.currentValue || '-'}</td>
              <td className="text-xs text-muted">{item.message}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CodePreview({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: object | null;
}) {
  return (
    <div className="grid min-h-full gap-3 p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="rounded-md border border-outline bg-surface-low p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          {title === '平台补齐' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <FileJson2 className="h-4 w-4 text-primary" />}
          {title}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">{description}</p>
      </div>
      <pre className="min-h-48 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
        {value ? JSON.stringify(value, null, 2) : '请先修正 JSON 格式。'}
      </pre>
    </div>
  );
}
