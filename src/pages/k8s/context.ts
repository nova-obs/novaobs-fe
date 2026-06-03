import { useOutletContext } from 'react-router-dom';
import type { K8sCluster } from './api';

export interface K8sOpsContext {
  activeClusterId: string;
  activeCluster?: K8sCluster;
  clusters: K8sCluster[];
  isLoadingClusters: boolean;
  clusterError: Error | null;
}

export function useK8sOpsContext() {
  return useOutletContext<K8sOpsContext>();
}

