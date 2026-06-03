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
    description: 'K8s / VM · AgentGroup · VL endpoint',
    path: '/logs/onboarding',
    status: 'available',
    statusLabel: 'available',
    highlights: ['K8s workload', 'VM file', 'VL endpoint'],
  },
];

export function getOnboardingDomains() {
  return domains.map((domain) => ({
    ...domain,
    highlights: [...domain.highlights],
  }));
}
