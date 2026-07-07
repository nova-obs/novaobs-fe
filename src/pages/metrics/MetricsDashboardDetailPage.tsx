import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export function MetricsDashboardDetailPage() {
  const { uid = '' } = useParams();
  const [searchParams] = useSearchParams();
  const grafanaBaseURL = searchParams.get('grafana') ?? '';

  const embedSrc = grafanaBaseURL
    ? `${grafanaBaseURL.replace(/\/+$/, '')}/d/${encodeURIComponent(uid)}?kiosk=tv`
    : '';

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-outline bg-surface-lowest px-3 py-2">
        <div className="flex items-center gap-3">
          <Link className="console-button gap-1.5 text-xs" to="/metrics/dashboards">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回目录
          </Link>
          <span className="font-mono text-xs text-muted">{uid}</span>
        </div>
        {embedSrc ? (
          <a className="console-button gap-1.5 text-xs" href={embedSrc.replace('?kiosk=tv', '')} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" />
            Grafana 中打开
          </a>
        ) : null}
      </div>

      {embedSrc ? (
        <iframe
          className="min-h-0 flex-1 border-0"
          src={embedSrc}
          title={`Dashboard ${uid}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="console-empty-state min-h-[360px]">
          <div className="text-sm font-semibold text-on-surface">无法嵌入 Dashboard</div>
          <div className="max-w-md text-xs leading-5 text-muted">缺少 Grafana 端点地址，请从 Dashboard 目录进入。</div>
          <Link className="console-button" to="/metrics/dashboards">返回目录</Link>
        </div>
      )}
    </div>
  );
}
