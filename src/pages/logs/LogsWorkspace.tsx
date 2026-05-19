import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PipelinesPage } from '../pipelines/PipelinesPage';
import { LogsPage } from './LogsPage';

type LogsTab = 'explorer' | 'pipelines' | 'views';
type PipelinesSection = 'config' | 'history';

function LogsWorkspace() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<LogsTab>(() => (searchParams.get('tab') as LogsTab) || 'explorer');
  const [section, setSection] = useState<PipelinesSection>(() => {
    const requested = searchParams.get('section');
    return requested === 'history' ? 'history' : 'config';
  });

  const tabs: { key: LogsTab; label: string }[] = [
    { key: 'explorer', label: 'Explorer' },
    { key: 'pipelines', label: 'Pipelines' },
    { key: 'views', label: 'Views' },
  ];

  const pipelineSections: { key: PipelinesSection; label: string }[] = [
    { key: 'config', label: 'Config' },
    { key: 'history', label: 'Change History' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-on-surface">Logs</h1>
        <p className="mt-1 text-sm text-muted">
          {tab === 'explorer' && '按时间、服务、环境、级别与关键字查询日志。'}
          {tab === 'pipelines' && '按服务管理日志 Pipeline 片段、发布配置并跟踪 Agent 应用状态。'}
          {tab === 'views' && '保存的日志查询视图。'}
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-lg bg-white/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all active:translate-y-px ${
              tab === t.key
                ? 'bg-primary text-white shadow-[0_10px_24px_-18px_rgba(31,122,118,0.9)]'
                : 'text-muted hover:bg-white/70 hover:text-on-surface'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'explorer' && <LogsPage />}

      {tab === 'pipelines' && (
        <div className="space-y-4">
          <div className="inline-flex gap-1 rounded-lg bg-white/60 p-1">
            {pipelineSections.map((s) => (
              <button
                key={s.key}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  section === s.key
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-white/70 hover:text-on-surface'
                }`}
                onClick={() => setSection(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {section === 'config' && <PipelinesPage embedded />}

          {section === 'history' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-muted">暂无变更历史记录。</p>
              <p className="text-xs text-muted">保存片段或发布服务配置后，变更记录将显示在此处。</p>
            </div>
          )}
        </div>
      )}

      {tab === 'views' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted">暂无保存的日志视图。</p>
          <p className="text-xs text-muted">在 Explorer 中执行查询后可保存为视图，方便快速复用。</p>
        </div>
      )}
    </div>
  );
}

export default LogsWorkspace;
