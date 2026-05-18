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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-on-surface">服务接入</h1>
        <p className="mt-1 text-sm text-muted">
          服务接入是服务进入统一可观测性平台的总入口，当前聚焦日志采集、解析和发布闭环。
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {domains.map((domain) => {
          const Icon = icons[domain.id];
          const available = domain.status === 'available';
          return (
            <DataPanel key={domain.id} title={domain.title} meta={domain.statusLabel}>
              <div className="flex h-full min-h-64 flex-col justify-between gap-5">
                <div>
                  <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${available ? 'bg-primary-soft text-primary' : 'bg-surface-low text-muted'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm leading-6 text-muted">{domain.description}</p>
                  <div className="mt-4 space-y-2">
                    {domain.highlights.map((item) => (
                      <div key={item} className="rounded border border-outline bg-surface-lowest px-3 py-2 text-xs font-semibold text-on-surface">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to={domain.path}
                  className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold ${
                    available
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'border border-outline text-muted hover:bg-surface-low hover:text-on-surface'
                  }`}
                >
                  {available ? '进入配置' : '查看入口'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </DataPanel>
          );
        })}
      </div>

      <DataPanel title="接入域边界" meta="service onboarding model">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <Boundary title="日志接入" body="负责日志采集入口、解析、字段标准化、Pipeline 配置发布和 Agent 应用状态。" />
          <Boundary title="告警规则" body="当前在告警中心维护规则模型和路由字段；告警接入向导不在主 UI 占位展示。" />
        </div>
      </DataPanel>
    </div>
  );
}

function Boundary({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest p-4">
      <div className="font-semibold text-on-surface">{title}</div>
      <p className="mt-2 leading-6 text-muted">{body}</p>
    </div>
  );
}
