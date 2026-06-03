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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-on-surface">服务接入</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted">
            <span className="rounded-lg border border-outline/70 bg-white/70 px-2.5 py-1">K8s</span>
            <span className="rounded-lg border border-outline/70 bg-white/70 px-2.5 py-1">VM</span>
            <span className="rounded-lg border border-outline/70 bg-white/70 px-2.5 py-1">VictoriaLogs</span>
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
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
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
                    <td className="font-mono text-xs text-muted">VictoriaLogs</td>
                    <td>
                      <Link className="quiet-button h-9 justify-center bg-primary px-3 text-xs text-white hover:bg-primary/90" to={domain.path}>
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
    <span className="inline-flex rounded-lg bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
      {value}
    </span>
  );
}
