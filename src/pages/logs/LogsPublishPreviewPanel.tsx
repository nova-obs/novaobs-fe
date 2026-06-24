import { AlertTriangle } from 'lucide-react';
import type { LogPublishResult } from './api';

function shortHash(value?: string) {
  if (!value) return '-';
  return value.length > 12 ? value.slice(0, 12) : value;
}

function publishOperationLabel(value: string) {
  switch (value) {
    case 'create':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
      return 'delete';
    default:
      return value || 'apply';
  }
}

function WarnLine({ message }: { message: string }) {
  return (
    <div className="console-notice console-notice-warning mt-3">
      <AlertTriangle className="h-4 w-4" />{message}
    </div>
  );
}

export function LogsPublishPreviewPanel({ preview }: { preview: LogPublishResult }) {
  const rows = preview.diffs.length > 0
    ? preview.diffs.map((item) => ({
      key: `${item.clusterId}/${item.namespace}/${item.apiVersion}/${item.kind}/${item.name}`,
      operation: publishOperationLabel(item.operation),
      clusterId: item.clusterId,
      namespace: item.namespace || 'cluster',
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
      hash: shortHash(item.afterHash),
    }))
    : preview.resources.map((item) => ({
      key: `${item.clusterId}/${item.namespace}/${item.apiVersion}/${item.kind}/${item.name}`,
      operation: 'dry-run',
      clusterId: item.clusterId,
      namespace: item.namespace || 'cluster',
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
      hash: '-',
    }));

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-primary/25 bg-primary-soft/35">
      <div className="flex flex-col gap-3 border-b border-primary/15 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-on-surface">发布预览</div>
          <div className="mt-1 flex flex-wrap gap-2 font-mono text-[11px] text-muted">
            <span>preview {shortHash(preview.previewId)}</span>
            <span>audit {shortHash(preview.auditId)}</span>
            <span>{rows.length} resources</span>
          </div>
        </div>
        <span className="inline-flex w-fit rounded border border-primary/20 bg-white px-2 py-1 font-mono text-[11px] font-semibold text-primary">等待确认</span>
      </div>
      {preview.warnings.map((item) => <WarnLine key={item} message={item} />)}
      <div className="overflow-auto bg-white/70">
        <table className="console-table min-w-[760px] w-full">
          <thead>
            <tr>
              <th>动作</th>
              <th>资源</th>
              <th>Namespace</th>
              <th>Cluster</th>
              <th>API</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td><span className="rounded border border-outline bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">{row.operation}</span></td>
                <td className="font-mono text-xs font-semibold text-on-surface">{row.kind}/{row.name}</td>
                <td className="font-mono text-xs text-muted">{row.namespace}</td>
                <td className="font-mono text-xs text-muted">{row.clusterId || '-'}</td>
                <td className="font-mono text-xs text-muted">{row.apiVersion}</td>
                <td className="font-mono text-xs text-muted">{row.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
