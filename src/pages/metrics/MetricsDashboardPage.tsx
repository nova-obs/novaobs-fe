import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { metricsApi } from './api';
import { dashboardViewState, grafanaWorkspaceURL, type GrafanaWorkspaceView } from './dashboardViewModel';

export function MetricsDashboardPage() {
	const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts, retry: false });
	const products = productsQuery.data ?? [];
	const [productId, setProductId] = useState('');
	const activeProductId = products.some((product) => product.id === productId) ? productId : (products[0]?.id ?? '');
	const dashboardQuery = useQuery({
		queryKey: ['metrics-dashboard', activeProductId],
		queryFn: () => metricsApi.getDashboard(activeProductId),
		enabled: Boolean(activeProductId),
		retry: false,
	});
	const [workspace, setWorkspace] = useState<GrafanaWorkspaceView>('dashboard');
	const [loaded, setLoaded] = useState(false);
	const [slow, setSlow] = useState(false);
	const view = dashboardViewState({
		loading: productsQuery.isLoading || (Boolean(activeProductId) && dashboardQuery.isLoading),
		data: dashboardQuery.data,
		error: productsQuery.error || dashboardQuery.error,
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
			{products.length > 0 ? (
				<div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-outline bg-white px-3">
					<div className="text-xs font-semibold text-on-surface">产品 Dashboard</div>
					<label className="flex items-center gap-2 text-xs text-muted">
						<span>Product</span>
						<select
							className="console-select h-8 min-w-48"
							value={activeProductId}
							onChange={(event) => setProductId(event.target.value)}
							aria-label="选择 Dashboard 产品"
						>
							{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
						</select>
					</label>
				</div>
			) : null}
			{view.kind === 'ready' ? (
				<>
					<div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-outline bg-white px-3">
						<div className="flex min-w-0 items-center gap-2 text-xs text-muted">
							<span className="h-1.5 w-1.5 rounded-full bg-success" />
							<span>已连接</span>
							{view.slow ? <span className="text-warning">加载时间较长，请检查 Grafana 连通性</span> : null}
						</div>
						<div className="flex items-center gap-1" role="group" aria-label="Grafana 工作区视图">
							<WorkspaceButton active={workspace === 'dashboard'} onClick={() => setWorkspace('dashboard')}>Dashboard</WorkspaceButton>
							<WorkspaceButton active={workspace === 'explore'} onClick={() => setWorkspace('explore')}>Explore</WorkspaceButton>
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
				<DashboardState title="无权访问 Dashboard" detail="当前账号没有所选 Product 的查看权限。" />
			) : view.kind === 'isolation_unavailable' ? (
				<DashboardState
					title="Dashboard 已安全停用"
					detail={view.unavailableReason || '当前 Grafana 架构无法可靠隔离 Product，NovaAPM 已阻止嵌入访问。'}
				/>
			) : view.kind === 'disabled' ? (
				<DashboardState title="Grafana 工作区已停用" detail="请由平台管理员检查 Grafana 工作区配置状态。" />
			) : view.kind === 'error' ? (
				<DashboardState title="Dashboard 加载失败" detail={errorMessage(dashboardQuery.error)} action={<button type="button" className="console-button" onClick={() => dashboardQuery.refetch()}><RefreshCw className="h-3.5 w-3.5" />重试</button>} />
			) : productsQuery.isSuccess && products.length === 0 ? (
				<DashboardState title="暂无可访问的产品" detail="获得产品查看者或产品维护者授权后，才能查看对应仪表盘。" />
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
