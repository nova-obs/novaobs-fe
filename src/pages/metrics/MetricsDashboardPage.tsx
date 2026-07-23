import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { metricsApi } from './api';
import { dashboardViewState, grafanaWorkspaceURL, type GrafanaWorkspaceView } from './dashboardViewModel';

export function MetricsDashboardPage() {
	const dashboardQuery = useQuery({
		queryKey: ['metrics-dashboard'],
		queryFn: () => metricsApi.getDashboard(),
		retry: false,
	});
	const [workspace, setWorkspace] = useState<GrafanaWorkspaceView>('dashboard');
	const [loaded, setLoaded] = useState(false);
	const [slow, setSlow] = useState(false);
	const view = dashboardViewState({
		loading: dashboardQuery.isLoading,
		data: dashboardQuery.data,
		error: dashboardQuery.error,
		loaded,
		slow,
	});
	const iframeURL = view.kind === 'ready' ? grafanaWorkspaceURL(view.embedURL, workspace) : '';

	useEffect(() => {
		setLoaded(false);
		setSlow(false);
		if (!iframeURL) return;
		const timer = window.setTimeout(() => setSlow(true), 8_000);
		return () => window.clearTimeout(timer);
	}, [iframeURL]);

	return (
		<div className="console-workbench flex h-full min-h-0 flex-col overflow-hidden p-0">
			{view.kind === 'ready' ? (
				<>
					<div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-outline bg-white px-3">
						<div className="flex min-w-0 items-center gap-2 text-xs text-muted">
							<span className="h-1.5 w-1.5 rounded-full bg-success" />
							<span>已连接</span>
							{view.slow ? <span className="text-warning">加载时间较长，请检查 Grafana 连通性</span> : null}
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<div className="flex items-center gap-1" role="group" aria-label="Grafana 工作区视图">
								<WorkspaceButton active={workspace === 'dashboard'} onClick={() => setWorkspace('dashboard')}>Dashboard</WorkspaceButton>
								<WorkspaceButton active={workspace === 'explore'} onClick={() => setWorkspace('explore')}>Explore</WorkspaceButton>
							</div>
							<a className="console-button h-8 shrink-0 px-2" href={iframeURL} target="_blank" rel="noopener noreferrer">
								<ExternalLink className="h-3.5 w-3.5" />
								新窗口打开
							</a>
						</div>
					</div>
					<iframe
						className="min-h-0 flex-1 border-0 bg-white"
						src={iframeURL}
						title="Grafana 工作区"
						referrerPolicy="strict-origin-when-cross-origin"
						onLoad={() => setLoaded(true)}
					/>
				</>
			) : view.kind === 'loading' ? (
				<DashboardSkeleton />
			) : view.kind === 'forbidden' ? (
				<DashboardState title="无权访问 Dashboard" detail="当前账号缺少 metrics.dashboard:read 权限。" />
			) : view.kind === 'disabled' ? (
				<DashboardState title="Grafana 工作区已停用" detail="请由平台管理员检查 Grafana 工作区配置状态。" />
			) : view.kind === 'error' ? (
				<DashboardState title="Dashboard 加载失败" detail={errorMessage(dashboardQuery.error)} action={<button type="button" className="console-button" onClick={() => dashboardQuery.refetch()}><RefreshCw className="h-3.5 w-3.5" />重试</button>} />
			) : (
				<DashboardState title="尚未配置 Grafana 工作区" detail="请先在平台设置中配置 Grafana 入口地址。" action={<Link className="console-button console-button-primary" to="/platform/settings">前往平台设置</Link>} />
			)}
		</div>
	);
}

function WorkspaceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
	return <button type="button" className={`console-button h-8 px-2 ${active ? 'border-primary bg-primary-soft text-primary' : ''}`} aria-pressed={active} onClick={onClick}>{children}</button>;
}

function DashboardState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
	return <div className="flex min-h-0 flex-1 items-center justify-center bg-white p-6"><div className="max-w-md text-center"><div className="text-sm font-semibold text-on-surface">{title}</div><p className="mt-1 text-xs leading-5 text-muted">{detail}</p>{action ? <div className="mt-3 flex justify-center">{action}</div> : null}</div></div>;
}

function DashboardSkeleton() {
	return <div className="flex min-h-0 flex-1 flex-col bg-white"><div className="h-11 shrink-0 border-b border-outline bg-surface" /><div className="m-3 flex-1 animate-pulse rounded bg-surface" /></div>;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : '请稍后重试。';
}
