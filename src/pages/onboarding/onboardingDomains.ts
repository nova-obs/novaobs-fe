export type OnboardingDomainStatus = 'available';

export interface OnboardingDomain {
  id: 'logs';
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
    description: '配置 K8s / VM 日志来源、AgentGroup、VictoriaLogs 端点和日志路由。',
    path: '/logs/onboarding',
    status: 'available',
    statusLabel: '已接入 Logs 接入配置',
    highlights: ['K8s 联动', 'VM 文件采集', 'VL 端点绑定'],
  },
];

export function getOnboardingDomains() {
  return domains.map((domain) => ({
    ...domain,
    highlights: [...domain.highlights],
  }));
}
