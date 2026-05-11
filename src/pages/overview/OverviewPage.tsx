import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, GitBranch, Server } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';

const roadmaps = [
  ['日志', '服务接入、标准字段、Pipeline、日志告警', '进行中'],
  ['Metrics', 'VMS 查询、指标告警、服务 SLO 面板', '边界预留'],
  ['Traces', 'trace_id 注入、跨模块跳转、拓扑分析', '边界预留'],
];

export function OverviewPage() {
  const { data } = useQuery({ queryKey: ['overview'], queryFn: api.getOverview });
  const cards = [
    { label: '服务数', value: data?.serviceCount ?? 0, icon: Server },
    { label: '日志吞吐', value: `${(data?.logThroughputPerMinute ?? 0).toLocaleString('en-US')}/min`, icon: Activity },
    { label: '健康 Pipeline', value: data?.healthyPipelineCount ?? 0, icon: GitBranch },
    { label: '启用告警规则', value: data?.activeAlertCount ?? 0, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-on-surface">平台总览</h1>
        <p className="mt-1 text-sm text-muted">统一资源模型、日志链路与后续 Metrics / Traces 入口。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <DataPanel key={card.label} title={card.label}>
              <div className="flex items-center justify-between">
                <div className="font-mono text-2xl text-on-surface">{card.value}</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </DataPanel>
          );
        })}
      </div>
      <DataPanel title="平台化路线" meta="phase-1 control plane">
        <div className="grid gap-2 md:grid-cols-3">
          {roadmaps.map(([name, detail, status]) => (
            <div key={name} className="rounded-lg border border-outline bg-surface-lowest p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">{name}</h2>
                <span className="rounded-sm bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary">{status}</span>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </DataPanel>
      <DataPanel title="链路边界" meta="reserved integrations">
        <div className="grid gap-2 font-mono text-xs text-muted md:grid-cols-5">
          {['VictoriaLogs', 'Kafka', 'OTel Collector', 'CMDB', 'vmalert'].map((item) => (
            <div key={item} className="rounded border border-outline bg-surface-low px-3 py-2 text-primary">{item}</div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
}
