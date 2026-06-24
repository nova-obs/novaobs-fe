import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { getOnboardingDomains } from './onboardingDomains';

const icons = {
  logs: BookOpenCheck,
};

export function OnboardingPage() {
  const domains = getOnboardingDomains();

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">服务接入</h1>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted">
            <span className="status-badge border-outline bg-surface-lowest">K8s</span>
            <span className="status-badge border-outline bg-surface-lowest">VM</span>
            <span className="status-badge border-outline bg-surface-lowest">日志下游</span>
          </div>
        </div>
      </div>

      <DataPanel title="接入域" meta={`${domains.length} available`}>
        <div className="overflow-auto">
          <table className="console-table min-w-[760px] w-full">
            <thead>
              <tr>
                <th>域</th>
                <th>状态</th>
                <th>采集对象</th>
                <th>存储</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => {
                const Icon = icons[domain.id];
                return (
                  <tr key={domain.id} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="font-semibold text-primary">{domain.title}</div>
                          <div className="text-[11px] text-muted">{domain.description}</div>
                        </div>
                      </div>
                    </td>
                    <td><StateChip value={domain.statusLabel} /></td>
                    <td className="text-xs text-muted">{domain.highlights.slice(0, 2).join(' / ')}</td>
                    <td className="font-mono text-xs text-muted">日志下游</td>
                    <td>
                      <Link className="console-button console-button-primary" to={domain.path}>
                        打开
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataPanel>
    </div>
  );
}

function StateChip({ value }: { value: string }) {
  return (
    <span className="status-badge border-emerald-600/20 bg-emerald-50 text-emerald-700">
      <span className="status-dot" aria-hidden />
      {value}
    </span>
  );
}
