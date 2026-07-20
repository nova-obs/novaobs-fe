import { AlertTriangle, Copy, FileCode2 } from 'lucide-react';
import type { LogsCollectorRuntimePublishResult } from './api';

function publishOperationLabel(value: string) {
  switch (value) {
    case 'create':
      return '新增';
    case 'update':
      return '更新';
    case 'delete':
      return '删除';
    default:
      return value || '应用';
  }
}

function WarnLine({ message }: { message: string }) {
  return (
    <div className="console-notice console-notice-warning mt-3">
      <AlertTriangle className="h-4 w-4" />{message}
    </div>
  );
}

function publishTaskLabel(value: string) {
  return value === 'base' ? '基础组件发布' : value === 'incremental' ? '服务配置增量发布' : '发布预览';
}

export function LogsPublishPreviewPanel({ preview }: { preview: LogsCollectorRuntimePublishResult }) {
  const hasManifestYAML = Boolean(preview.manifestYAML.trim());
  const rows = preview.diffs.length > 0
    ? preview.diffs.map((item) => ({
      key: `${item.clusterId}/${item.namespace}/${item.apiVersion}/${item.kind}/${item.name}`,
      operation: publishOperationLabel(item.operation),
      clusterId: item.clusterId,
      namespace: item.namespace || 'cluster',
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
    }))
    : preview.resources.map((item) => ({
      key: `${item.clusterId}/${item.namespace}/${item.apiVersion}/${item.kind}/${item.name}`,
      operation: 'dry-run',
      clusterId: item.clusterId,
      namespace: item.namespace || 'cluster',
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
    }));

  return (
    <div className="logs-publish-preview-panel mt-3 overflow-hidden rounded-lg border border-outline bg-surface-lowest">
      <div className="flex flex-col gap-3 border-b border-outline bg-white px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-on-surface">{publishTaskLabel(preview.taskType)}</div>
          <div className="mt-1 text-[11px] text-muted">{rows.length} 个资源待确认</div>
        </div>
        <span className="inline-flex w-fit rounded border border-primary/20 bg-white px-2 py-1 text-[11px] font-semibold text-primary">等待确认</span>
      </div>
      {preview.warnings.map((item) => <WarnLine key={item} message={item} />)}
      {preview.taskType === 'incremental' ? (
        <div className="border-b border-outline bg-surface-lowest px-3 py-2 text-xs text-muted">
          <span className="font-semibold text-on-surface">变更 ConfigMap：</span>
          {preview.changedConfigMaps.length ? preview.changedConfigMaps.join('、') : '无 ConfigMap 内容变化，仅检查 DaemonSet 配置状态'}
        </div>
      ) : null}
      <div className="overflow-auto bg-white">
        <table className="console-table min-w-[760px] w-full">
          <thead>
            <tr>
              <th>动作</th>
              <th>资源</th>
              <th>Namespace</th>
              <th>Cluster</th>
              <th>API</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td><span className="rounded border border-outline bg-white px-2 py-0.5 text-[11px] font-semibold text-primary">{row.operation}</span></td>
                <td className="font-mono text-xs font-semibold text-on-surface">{row.kind}/{row.name}</td>
                <td className="font-mono text-xs text-muted">{row.namespace}</td>
                <td className="font-mono text-xs text-muted">{row.clusterId || '-'}</td>
                <td className="font-mono text-xs text-muted">{row.apiVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-outline bg-surface-lowest">
        <div className="flex items-center justify-between gap-3 border-b border-outline bg-white px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-on-surface">
            <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
            <span>完整资源部署 YAML</span>
          </div>
          <button
            className="rounded border border-outline bg-white p-1.5 text-muted hover:bg-surface-low hover:text-primary disabled:opacity-50"
            disabled={!hasManifestYAML}
            onClick={() => navigator.clipboard?.writeText(preview.manifestYAML)}
            title="复制 YAML"
            aria-label="复制完整资源部署 YAML"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <pre className="max-h-[460px] overflow-auto px-3 py-3 font-mono text-[11px] leading-5 text-on-surface whitespace-pre-wrap">{hasManifestYAML ? preview.manifestYAML : '资源部署 YAML 为空'}</pre>
      </div>
    </div>
  );
}
