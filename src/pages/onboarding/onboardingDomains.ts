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
    description: '配置服务日志进入统一采集链路，管理属性补齐、业务解析规则、配置校验和 Remote Config 发布。',
    path: '/logs?tab=pipelines&section=config',
    status: 'available',
    statusLabel: '已接入 Pipeline Config',
    highlights: ['服务属性补齐', '业务解析规则', '服务级发布'],
  },
];

export function getOnboardingDomains() {
  return domains.map((domain) => ({
    ...domain,
    highlights: [...domain.highlights],
  }));
}
