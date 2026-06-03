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
    description: 'K8s / VM · 服务范围 · 日志下游',
    path: '/logs/onboarding',
    status: 'available',
    statusLabel: 'available',
    highlights: ['K8s 服务', 'VM 日志路径', '日志下游'],
  },
];

export function getOnboardingDomains() {
  return domains.map((domain) => ({
    ...domain,
    highlights: [...domain.highlights],
  }));
}
