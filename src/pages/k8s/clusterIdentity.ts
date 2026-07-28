export interface ClusterIdentity {
  id: string;
  name: string;
}

export function resolveObservabilityClusterId(
  activeClusterId: string,
  requestedClusterId: string,
  clusters: ClusterIdentity[],
) {
  return activeClusterId.trim() || requestedClusterId.trim() || clusters[0]?.id || '';
}

export function findSameNameClusterReplacement(
  missingClusterId: string,
  clusters: ClusterIdentity[],
) {
  const missingId = missingClusterId.trim();
  if (!missingId || clusters.some((cluster) => cluster.id === missingId)) return undefined;
  const matches = clusters.filter((cluster) => cluster.name.trim() === missingId);
  return matches.length === 1 ? matches[0] : undefined;
}

export function formatClusterIdentity(cluster: ClusterIdentity) {
  const id = cluster.id.trim();
  const name = cluster.name.trim();
  if (!name || name === id) return id;
  return `${name} · ID: ${id}`;
}

export function resolvePersistedRouteClusterId(
  savedSource: { clusterId?: string } | null | undefined,
  draftClusterId: string,
) {
  return savedSource?.clusterId?.trim() || draftClusterId.trim();
}
