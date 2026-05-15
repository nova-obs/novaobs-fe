export type OnboardingDomainStatus = 'available' | 'planned';

export interface OnboardingDomain {
  id: 'logs' | 'alerts' | 'metrics';
  title: string;
  description: string;
  path: string;
  status: OnboardingDomainStatus;
  statusLabel: string;
  highlights: string[];
}

const domains: OnboardingDomain[] = [
  {
    id: 'logs',
    title: '日志接入',
    description: '配置服务日志进入统一采集链路，管理属性补齐、业务解析规则、配置校验和 Remote Config 发布。',
    path: '/logs?tab=pipelines&section=config',
    status: 'available',
    statusLabel: '已接入 Pipeline Config',
    highlights: ['服务属性补齐', '业务解析规则', '服务级发布'],
  },
  {
    id: 'alerts',
    title: '告警接入',
    description: '承接服务级告警规则、路由、通知和告警验证，后续对接 vmalert 与 AlertManager。',
    path: '/alerts',
    status: 'planned',
    statusLabel: '规划中',
    highlights: ['规则模板', '告警路由', '通知验证'],
  },
  {
    id: 'metrics',
    title: '监控接入',
    description: '承接服务指标、SLO、仪表盘模板和指标告警，后续对接 VMS 查询与指标写入校验。',
    path: '/metrics',
    status: 'planned',
    statusLabel: '规划中',
    highlights: ['指标资源模型', '服务 SLO', '仪表盘模板'],
  },
];

export function getOnboardingDomains() {
  return domains.map((domain) => ({
    ...domain,
    highlights: [...domain.highlights],
  }));
}
