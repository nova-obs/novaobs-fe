import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Copy, Database, GitBranch, Server, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';

const topologyNodes = [
  { name: '用户中心', meta: '12 服务', status: 'healthy', x: 18, y: 42 },
  { name: '支付中心', meta: '8 服务', status: 'healthy', x: 42, y: 22 },
  { name: '订单中心', meta: '10 服务', status: 'healthy', x: 54, y: 55 },
  { name: '库存中心', meta: '7 服务', status: 'warning', x: 78, y: 40 },
  { name: '消息中心', meta: '5 服务', status: 'healthy', x: 36, y: 72 },
];

const serviceRows = [
  ['用户中心', '健康', '512 MB/s', '0.12%', '120 ms', 'VictoriaLogs', '已同步'],
  ['订单中心', '健康', '748 MB/s', '0.18%', '150 ms', 'VictoriaLogs', '已同步'],
  ['支付中心', '健康', '688 MB/s', '0.22%', '180 ms', 'OTel Collector', '已同步'],
  ['库存中心', '警告', '263 MB/s', '1.35%', '320 ms', 'VictoriaLogs', '延迟 32s'],
  ['消息中心', '健康', '421 MB/s', '0.09%', '98 ms', 'Kafka', '已同步'],
];

const recentAlerts = [
  ['库存中心', '库存同步延迟过高', 'P2', '10:24:31 触发'],
  ['订单中心', '错误率升高', 'P2', '10:27:11 触发'],
  ['支付中心', '第三方支付超时', 'P3', '10:29:02 触发'],
];

const integrations = ['OTel Collector', 'VictoriaLogs', 'Kafka', 'Alertmanager', 'OpAMP'];

export function OverviewPage() {
  const { data } = useQuery({ queryKey: ['overview'], queryFn: api.getOverview });
  const serviceCount = data?.serviceCount ?? 0;
  const logThroughput = data?.logThroughputPerMinute ?? 0;
  const healthyPipelineCount = data?.healthyPipelineCount ?? 0;
  const activeAlertCount = data?.activeAlertCount ?? 0;

  const metrics = [
    {
      label: '服务数',
      value: serviceCount.toLocaleString('en-US'),
      source: '服务目录',
      detail: '较昨日 +8',
      icon: Server,
      path: 'M4 28 C18 18 26 23 40 16 C54 9 61 20 76 10',
    },
    {
      label: '日志吞吐',
      value: `${logThroughput.toLocaleString('en-US')}/min`,
      source: 'VictoriaLogs',
      detail: '15m window',
      icon: Database,
      path: 'M4 26 C16 26 20 15 32 18 C44 21 48 10 60 14 C70 17 72 8 78 6',
    },
    {
      label: '健康 Pipeline',
      value: `${healthyPipelineCount} / 118`,
      source: 'OTel Collector',
      detail: 'config a1b2c3d4',
      icon: GitBranch,
      path: 'M4 30 C18 24 28 28 40 19 C52 10 62 19 78 8',
    },
    {
      label: '启用告警规则',
      value: String(activeAlertCount),
      source: 'Alertmanager',
      detail: '最近 15 分钟',
      icon: AlertTriangle,
      path: 'M4 25 C16 13 25 28 36 18 C47 8 54 26 64 13 C70 6 74 18 78 10',
      warning: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-on-surface">平台总览</h1>
        <p className="mt-1 text-sm text-muted">统一观测平台实时状态与关键指标。</p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="console-panel relative min-h-[330px] overflow-hidden p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold tracking-tight">服务拓扑</h2>
                <span className="rounded-full bg-primary-soft/80 px-2 py-0.5 text-[11px] font-semibold text-primary">实时</span>
              </div>
              <p className="mt-1 text-xs text-muted">节点健康状态、服务依赖与日志流向。</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-lg border border-outline/70 bg-white/75 px-2.5 py-1.5 font-semibold text-muted">视图：拓扑图</span>
              <span className="rounded-lg border border-outline/70 bg-white/75 px-2.5 py-1.5 font-semibold text-muted">全屏</span>
            </div>
          </div>

          <div className="relative mt-4 min-h-[245px] overflow-hidden rounded-lg border border-outline/70 bg-white/70">
            <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_50%_50%,rgba(13,91,215,0.08),transparent_36%),linear-gradient(rgba(13,91,215,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(13,91,215,0.055)_1px,transparent_1px)] [background-size:auto,28px_28px,28px_28px]" />
            <svg className="absolute inset-0 h-full w-full text-primary/40" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M18 42 C28 32 34 31 42 22 C47 32 48 42 54 55 C63 50 70 42 78 40" fill="none" stroke="currentColor" strokeWidth="0.55" strokeDasharray="1.2 2" />
              <path d="M18 42 C30 46 42 50 54 55 C48 62 44 68 36 72" fill="none" stroke="currentColor" strokeWidth="0.55" strokeDasharray="1.2 2" />
              <path d="M42 22 C55 20 64 27 78 40" fill="none" stroke="currentColor" strokeWidth="0.45" strokeDasharray="1 2.5" />
              <path d="M36 72 C44 72 48 64 54 55" fill="none" stroke="currentColor" strokeWidth="0.45" strokeDasharray="1 2.5" />
            </svg>
            {topologyNodes.map((node) => (
              <TopologyNode key={node.name} {...node} />
            ))}
            <div className="absolute bottom-3 right-3 flex items-center gap-3 rounded-lg border border-outline/70 bg-white/85 px-3 py-2 text-[11px] font-semibold text-muted">
              <LegendDot tone="healthy" />健康
              <LegendDot tone="warning" />警告
              <LegendDot tone="unknown" />未知
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <DataPanel title="平台健康度" meta="updated 10:24:15">
            <div className="flex items-center gap-5">
              <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#0d5bd7_0_82%,#e5f0ff_82%_100%)]">
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-surface-lowest/95">
                  <div className="font-mono text-2xl font-semibold">98.2%</div>
                  <div className="text-[11px] text-muted">健康评分</div>
                </div>
              </div>
              <div className="grid flex-1 gap-2 text-xs">
                {[
                  ['服务健康', '98.2%'],
                  ['Pipeline 健康', '95.6%'],
                  ['数据采集', '99.1%'],
                  ['配置同步', '100%'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-muted">{label}</span>
                    <span className="font-mono font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </DataPanel>
          <DataPanel title="配置与发布" meta="Remote Config applied">
            <div className="grid gap-2 text-xs">
              <InfoLine label="运维配置" value="OpAMP 已连接" tone="green" />
              <InfoLine label="配置版本" value="a7c3f9b2" mono />
              <InfoLine label="最后变更" value="2026-05-18 10:18" />
              <InfoLine label="采样比例" value="10% 动态" />
            </div>
          </DataPanel>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <DataPanel title="服务状态总览" meta="15m window · 同步状态">
          <div className="overflow-auto">
            <table className="console-table min-w-[780px] w-full">
              <thead>
                <tr>
                  <th>服务名称</th>
                  <th>状态</th>
                  <th>日志吞吐 (15m)</th>
                  <th>错误率 (15m)</th>
                  <th>延迟 P95</th>
                  <th>数据源</th>
                  <th>同步状态</th>
                </tr>
              </thead>
              <tbody>
                {serviceRows.map(([name, status, throughput, errorRate, latency, source, sync]) => (
                  <tr key={name} className="bg-white/35 hover:bg-white/60">
                    <td className="font-semibold text-on-surface">{name}</td>
                    <td><StateChip value={status} /></td>
                    <td className="font-mono text-xs">{throughput}</td>
                    <td className="font-mono text-xs">{errorRate}</td>
                    <td className="font-mono text-xs">{latency}</td>
                    <td className="text-xs text-muted">{source}</td>
                    <td className="text-xs"><StateChip value={sync} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>

        <DataPanel title="最近告警" meta="按严重级别排序">
          <div className="space-y-2">
            {recentAlerts.map(([service, message, level, time]) => (
              <div key={`${service}-${message}`} className="rounded-lg bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-on-surface">{service} · {message}</div>
                    <div className="mt-1 text-[11px] text-muted">{time}</div>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${level === 'P2' ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>{level}</span>
                </div>
              </div>
            ))}
          </div>
        </DataPanel>
      </div>

      <DataPanel title="核心组件状态" meta="配置版本：a1b2c3d4 · 更新时间：10:32:15">
        <div className="flex flex-wrap gap-2">
          {integrations.map((item) => (
            <div key={item} className="inline-flex items-center gap-2 rounded-lg bg-white/55 px-3 py-2 text-xs font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {item}
              <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary">正常</span>
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
}

function TopologyNode({ name, meta, status, x, y }: { name: string; meta: string; status: string; x: number; y: number }) {
  const warning = status === 'warning';
  return (
    <div
      className={`absolute flex min-w-40 items-center gap-3 rounded-lg border bg-white/90 px-3 py-2 shadow-[0_18px_42px_-30px_rgba(16,32,55,0.5),inset_0_1px_0_rgba(255,255,255,0.95)] ${warning ? 'border-warning/25' : 'border-primary/15'}`}
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>
        {warning ? <AlertTriangle className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
      </div>
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">{name}<span className={`h-1.5 w-1.5 rounded-full ${warning ? 'bg-warning' : 'bg-primary'}`} /></div>
        <div className="mt-0.5 text-[11px] text-muted">{meta} · {warning ? '警告' : '健康'}</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, source, icon: Icon, path, warning }: {
  label: string;
  value: string;
  detail: string;
  source: string;
  icon: typeof Server;
  path: string;
  warning?: boolean;
}) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {label}
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          </div>
          <div className="mt-3 font-mono text-3xl tracking-tight text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{detail}</div>
        </div>
        <Icon className={`h-4 w-4 ${warning ? 'text-warning' : 'text-primary'}`} />
      </div>
      <MiniTrend path={path} warning={warning} />
      <div className="mt-3 flex items-center justify-between border-t border-outline/60 pt-2 text-[11px] text-muted">
        <span>来源：{source}</span>
        <Copy className="h-3.5 w-3.5" />
      </div>
    </section>
  );
}

function MiniTrend({ path, warning }: { path: string; warning?: boolean }) {
  return (
    <svg className={`mt-3 h-12 w-full ${warning ? 'text-warning' : 'text-primary'}`} viewBox="0 0 82 36" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d={`${path} L78 36 L4 36 Z`} fill="currentColor" opacity="0.08" />
    </svg>
  );
}

function LegendDot({ tone }: { tone: 'healthy' | 'warning' | 'unknown' }) {
  const color = tone === 'healthy' ? 'bg-primary' : tone === 'warning' ? 'bg-warning' : 'bg-muted/40';
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function InfoLine({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: 'green' }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-white/45 px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${tone === 'green' ? 'text-primary' : 'text-on-surface'} font-semibold`}>{value}</span>
    </div>
  );
}

function StateChip({ value, compact }: { value: string; compact?: boolean }) {
  const warning = value.includes('警告') || value.includes('延迟');
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'} ${compact ? 'font-mono' : ''}`}>
      {value}
    </span>
  );
}
