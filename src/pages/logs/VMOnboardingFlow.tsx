import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  logsApi,
  type LogParseRule,
  type LogRouteInput,
  type LogRoutePreview,
  type LogRoutePublishResult,
} from './api';
import { type ParserMode } from './LogsParseRuleDialog';
import { LogsEmptyState, LogsErrorLine } from './LogsPrimitives';
import { RouteEditor } from './LogsOnboardingPage';

const defaultParserRuleName = 'default-parser';
const defaultParserPattern = '^(?P<level>[A-Z]+)\\s+(?P<message>.*)$';

export function validateHostLogPath(path: string, allowedLogRoots: string[]): string {
  const value = path.trim();
  if (!value.startsWith('/')) return '日志路径必须是绝对路径';
  if (value.split('/').includes('..')) return '日志路径不能包含 ..';
  const allowed = allowedLogRoots.some((root) => {
    const normalizedRoot = root.trim().replace(/\/+$/, '');
    return normalizedRoot && (value === normalizedRoot || value.startsWith(`${normalizedRoot}/`));
  });
  return allowed ? '' : '日志路径必须位于部署目标允许的日志根目录内';
}

export { issueHostEnrollmentToken } from './logsRuntimeViewModel';

function buildParserRules(mode: ParserMode, name: string, pattern: string): LogParseRule[] {
  if (mode === 'none') return [];
  return [{ name: name || `${mode}-parser`, ruleType: mode, pattern: mode === 'regex' ? pattern : undefined, enabled: true }];
}

export function VMOnboardingFlow({ preferredDeploymentId = '' }: { preferredDeploymentId?: string }) {
  const queryClient = useQueryClient();
  const { productId = '', serviceId = '', id: editRouteId = '' } = useParams();
  const [deploymentId, setDeploymentId] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [logPath, setLogPath] = useState('');
  const [parserMode, setParserMode] = useState<ParserMode>('none');
  const [parserRuleName, setParserRuleName] = useState(defaultParserRuleName);
  const [parserPattern, setParserPattern] = useState(defaultParserPattern);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [preview, setPreview] = useState<LogRoutePreview | null>(null);
  const [savedRouteId, setSavedRouteId] = useState(editRouteId);
  const [publishConfirmation, setPublishConfirmation] = useState<LogRoutePublishResult | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['logs-onboarding-workspace', productId, serviceId],
    queryFn: () => logsApi.getWorkspace(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const deploymentsQuery = useQuery({
    queryKey: ['service-deployments', productId, serviceId],
    queryFn: () => api.getServiceDeployments(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const serviceQuery = useQuery({
    queryKey: ['service', productId, serviceId],
    queryFn: () => api.getService(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const deployments = useMemo(
    () => (deploymentsQuery.data ?? []).filter((deployment) => deployment.kind === 'host_set' && deployment.status === 'active'),
    [deploymentsQuery.data],
  );
  const selectedDeployment = deployments.find((deployment) => deployment.id === deploymentId) ?? null;
  const endpoints = useMemo(
    () => (workspaceQuery.data?.endpoints ?? []).filter((endpoint) => endpoint.scopeType !== 'k8s_cluster'),
    [workspaceQuery.data?.endpoints],
  );
  const editRoute = workspaceQuery.data?.routes.find((item) => item.route.id === editRouteId) ?? null;

  useEffect(() => {
    if (editRoute?.route.serviceDeploymentId && deployments.some((deployment) => deployment.id === editRoute.route.serviceDeploymentId)) {
      setDeploymentId(editRoute.route.serviceDeploymentId);
      setEndpointId(editRoute.route.endpointId);
      setLogPath(editRoute.source?.pathPattern ?? '');
      const parser = editRoute.source?.parseRules.find((rule) => rule.enabled !== false);
      setParserMode(parser?.ruleType ?? 'none');
      setParserRuleName(parser?.name || defaultParserRuleName);
      setParserPattern(parser?.pattern || defaultParserPattern);
      return;
    }
    setDeploymentId((current) => deployments.some((deployment) => deployment.id === current)
      ? current
      : deployments.find((deployment) => deployment.id === preferredDeploymentId)?.id ?? deployments[0]?.id ?? '');
  }, [deployments, editRoute, preferredDeploymentId]);

  useEffect(() => {
    setEndpointId((current) => endpoints.some((endpoint) => endpoint.id === current) ? current : endpoints[0]?.id ?? '');
  }, [deploymentId, endpoints]);

  useEffect(() => {
    setPreview(null);
    setPublishConfirmation(null);
  }, [deploymentId, endpointId, logPath, parserMode, parserRuleName, parserPattern]);

  const pathError = selectedDeployment ? validateHostLogPath(logPath, selectedDeployment.allowedLogRoots) : '';
  const parseValid = parserMode !== 'regex' || parserPattern.includes('?P<');
  const buildInput = (): LogRouteInput => ({
    routeId: savedRouteId || undefined,
    name: serviceQuery.data?.name,
    serviceId,
    serviceDeploymentId: deploymentId,
    sourceType: 'vm_file',
    endpointId,
    vm: {
      pathPattern: logPath.trim(),
      parseRules: buildParserRules(parserMode, parserRuleName, parserPattern),
    },
  });
  const canPreview = Boolean(selectedDeployment && endpointId && logPath.trim() && !pathError && parseValid);

  const previewMutation = useMutation({
    mutationFn: () => logsApi.previewRoute(buildInput()),
    onSuccess: setPreview,
  });
  const saveMutation = useMutation({
    mutationFn: () => savedRouteId
      ? logsApi.updateRoute(savedRouteId, buildInput())
      : logsApi.createRoute(buildInput()),
    onSuccess: async (result) => {
      setSavedRouteId(result.route.id);
      setPublishConfirmation(null);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });
  const publishMutation = useMutation({
    mutationFn: () => logsApi.publishRoute(savedRouteId, publishConfirmation?.requiresConfirmation ? {
      previewId: publishConfirmation.previewId,
      confirmationToken: publishConfirmation.confirmationToken,
    } : undefined),
    onSuccess: (result) => {
      setPublishConfirmation(result.requiresConfirmation ? result : null);
      void queryClient.invalidateQueries({ queryKey: ['logs-route-runtime', savedRouteId] });
      void queryClient.invalidateQueries({ queryKey: ['logs-route-rollouts', savedRouteId] });
    },
  });

  const error = workspaceQuery.error ?? deploymentsQuery.error ?? serviceQuery.error;
  if (error) return <div className="p-3"><LogsErrorLine message={(error as Error).message} /></div>;

  return (
    <div className="space-y-3">
      <RouteEditor
        kind="host_set"
        deployments={deployments}
        selectedDeployment={selectedDeployment}
        deploymentId={deploymentId}
        onDeploymentChange={setDeploymentId}
        endpointId={endpointId}
        onEndpointChange={setEndpointId}
        endpoints={endpoints}
        parserMode={parserMode}
        parserRuleName={parserRuleName}
        parserPattern={parserPattern}
        onParserModeChange={setParserMode}
        onParserRuleNameChange={setParserRuleName}
        onParserPatternChange={setParserPattern}
        parseDialogOpen={parseDialogOpen}
        onParseDialogOpenChange={setParseDialogOpen}
        preview={preview}
        canPreview={canPreview}
        previewMutation={previewMutation}
        saveMutation={saveMutation}
        savedRouteId={savedRouteId}
        publishMutation={publishMutation}
        publishConfirmation={publishConfirmation}
        extraConfig={(
          <label className="block text-xs font-semibold">
            日志路径 *
            <input
              className={`console-input mt-1.5 w-full font-mono ${pathError && logPath ? 'border-danger' : ''}`}
              value={logPath}
              onChange={(event) => setLogPath(event.target.value)}
              placeholder={selectedDeployment?.allowedLogRoots[0] ? `${selectedDeployment.allowedLogRoots[0]}/*.log` : '/data/logs/*.log'}
            />
            {pathError && logPath ? <span className="mt-1 block font-normal text-danger">{pathError}</span> : null}
          </label>
        )}
      />
    </div>
  );
}
