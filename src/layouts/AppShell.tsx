import type { FormEvent, PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Copy,
  Grid2X2,
  LockKeyhole,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  UserCircle2,
  X,
} from 'lucide-react';
import {
  getNavigationByPath,
  getNavigationDomainByPath,
  getNavigationDomains,
  type NavigationDomain,
  type NavigationItem,
} from './navigation';
import { k8sApi, type K8sCluster } from '../pages/k8s/api';
import { getK8sNavigationGroupItems, k8sClusterPath, k8sNavigationGroups, type K8sNavigationItem } from '../pages/k8s/navigation';
import {
  fetchPlatformSession,
  isSignedOutLocation,
  loginPlatformUser,
  resetClientSignedOut,
  sessionDisplayName,
  type PlatformSession,
  type SessionStatus,
  useLogoutAction,
} from './session';

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationDomains = useMemo(() => getNavigationDomains(), []);
  const activeDomain = getNavigationDomainByPath(location.pathname) ?? navigationDomains[0];
  const activeItem = getNavigationByPath(location.pathname);
  const workspaceLabel = getWorkspaceLabel(location.pathname, activeItem, activeDomain);
  const backTarget = getBackTarget(location.pathname);
  const [openDomainId, setOpenDomainId] = useState<string | null>(null);
  const [linkCopyStatus, setLinkCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [authStatus, setAuthStatus] = useState<SessionStatus>('checking');
  const logoutAction = useLogoutAction({
    onLoggedOut: () => {
      setSession(null);
      setAuthStatus('anonymous');
    },
  });

  useEffect(() => {
    let cancelled = false;
    if (isSignedOutLocation(location.search)) {
      setSession(null);
      setAuthStatus('anonymous');
      return () => {
        cancelled = true;
      };
    }
    setAuthStatus('checking');
    fetchPlatformSession()
      .then((value) => {
        if (cancelled) return;
        setSession(value);
        setAuthStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setAuthStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  useEffect(() => {
    setOpenDomainId(null);
    setLinkCopyStatus('idle');
  }, [location.pathname]);

  useEffect(() => {
    if (!openDomainId) return undefined;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenDomainId(null);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openDomainId]);

  function handleLoginSuccess(value: PlatformSession) {
    resetClientSignedOut();
    setSession(value);
    setAuthStatus('authenticated');
    navigate(location.pathname === '/' ? '/' : location.pathname, { replace: true });
  }

  if (authStatus === 'checking') {
    return <SessionLoadingView />;
  }

  if (authStatus === 'anonymous') {
    return <LoginView onSuccess={handleLoginSuccess} />;
  }

  const openDomain = navigationDomains.find((domain) => domain.id === openDomainId);
  const activeSubject = session?.subject ?? null;
  const activeDisplayName = sessionDisplayName(activeSubject);

  function toggleDomain(domainId: string) {
    setOpenDomainId((current) => current === domainId ? null : domainId);
  }

  async function copyCurrentLink() {
    const currentLink = window.location.href;

    try {
      await navigator.clipboard.writeText(currentLink);
      setLinkCopyStatus('copied');
    } catch {
      const fallbackInput = document.createElement('textarea');
      fallbackInput.value = currentLink;
      fallbackInput.setAttribute('readonly', '');
      fallbackInput.style.position = 'fixed';
      fallbackInput.style.opacity = '0';
      document.body.appendChild(fallbackInput);
      fallbackInput.select();

      const copied = document.execCommand('copy');
      fallbackInput.remove();
      setLinkCopyStatus(copied ? 'copied' : 'failed');
    }
  }

  function refreshCurrentPage() {
    window.location.reload();
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background text-on-surface">
      <header className="relative z-40 shrink-0 border-b border-outline bg-surface-lowest">
        <div className="flex min-h-14 items-center gap-2 px-3 md:gap-4 md:px-5">
          <Link className="flex shrink-0 items-center gap-2.5" to="/" aria-label="返回 NovaObs 平台总览">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Activity className="h-4 w-4" />
            </span>
            <span className="hidden font-display text-base font-semibold tracking-tight text-on-surface sm:block">NovaObs</span>
          </Link>

          <nav className="hidden h-14 items-stretch lg:flex" aria-label="NovaObs 业务域">
            {navigationDomains.map((domain) => {
              const expanded = openDomainId === domain.id;
              const selected = (openDomainId ?? activeDomain.id) === domain.id;
              return (
                <button
                  key={domain.id}
                  type="button"
                  className={[
                    'relative flex min-w-24 items-center justify-center gap-1.5 px-3 text-[13px] font-semibold transition-colors',
                    selected || expanded ? 'text-primary' : 'text-muted hover:text-on-surface',
                  ].join(' ')}
                  aria-expanded={expanded}
                  aria-controls="novaobs-mega-menu"
                  onClick={() => toggleDomain(domain.id)}
                >
                  {domain.label}
                  <ChevronDown className={['h-3.5 w-3.5 transition-transform', expanded ? 'rotate-180' : ''].join(' ')} />
                  {selected ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-primary" /> : null}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            className="console-button ml-1 h-9 px-2.5 lg:hidden"
            aria-expanded={Boolean(openDomain)}
            aria-controls="novaobs-mega-menu"
            onClick={() => toggleDomain(openDomain?.id ?? activeDomain.id)}
          >
            <Grid2X2 className="h-4 w-4" />
            全部模块
          </button>

          <div className="min-w-0 flex-1" />

          <div className="relative hidden w-full max-w-[360px] md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="console-input w-full pl-9 pr-12"
              placeholder="搜索服务、指标、日志、告警"
              aria-label="搜索服务、指标、日志、告警"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-surface-low px-1.5 py-0.5 font-mono text-[10px] text-muted">⌘K</span>
          </div>

          <div className="platform-account-session flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary" title={activeDisplayName}>
              <UserCircle2 className="h-4 w-4" />
            </div>
            <div className="hidden min-w-0 xl:block">
              <span className="sr-only">账户会话</span>
              <div className="max-w-28 truncate text-xs font-semibold text-on-surface">{activeDisplayName}</div>
              <div className="max-w-28 truncate font-mono text-[10px] text-muted">{activeSubject?.type || 'platform'}</div>
            </div>
            <LogoutConfirmDetails status={logoutAction.status} onLogout={logoutAction.logout} />
          </div>
        </div>

        {openDomain ? (
          <MegaMenu
            activeItem={activeItem}
            domain={openDomain}
            domains={navigationDomains}
            onChangeDomain={setOpenDomainId}
            onClose={() => setOpenDomainId(null)}
          />
        ) : null}
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <section className="app-workspace h-full min-h-0 px-3 py-3 md:px-5 md:py-4">
          <div className="content-workbench-frame">
            <header className="content-workbench-header">
              <div className="content-workbench-primary">
                {backTarget ? (
                  <Link className="content-workbench-back" to={backTarget.to} aria-label={backTarget.ariaLabel}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{backTarget.label}</span>
                  </Link>
                ) : null}
                <div className="content-workbench-location">
                  <span>{activeDomain.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted/60" />
                  <strong>{workspaceLabel}</strong>
                </div>
              </div>
              <div className="content-workbench-tools">
                <button
                  type="button"
                  className="console-button h-8 px-2.5 text-xs"
                  aria-label="刷新当前页面"
                  title="刷新当前页面"
                  onClick={refreshCurrentPage}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">刷新</span>
                </button>
                <button
                  type="button"
                  className="console-button h-8 px-2.5 text-xs"
                  aria-label="复制当前页面链接"
                  title="复制当前页面链接"
                  onClick={copyCurrentLink}
                >
                  {linkCopyStatus === 'copied' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">
                    {linkCopyStatus === 'copied' ? '已复制' : linkCopyStatus === 'failed' ? '复制失败' : '复制链接'}
                  </span>
                </button>
              </div>
            </header>
            <div
              key={location.pathname}
              className="content-workbench-body route-transition-page"
            >
              {children}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MegaMenu({
  activeItem,
  domain,
  domains,
  onChangeDomain,
  onClose,
}: {
  activeItem: NavigationItem | undefined;
  domain: NavigationDomain;
  domains: NavigationDomain[];
  onChangeDomain: (domainId: string) => void;
  onClose: () => void;
}) {
  const DomainIcon = domain.icon;
  const quickItems = domains
    .flatMap((item) => item.groups.flatMap((group) => flattenNavigationItems(group.items)))
    .filter((item) => ['logs-explore', 'k8s-fleet', 'platform-access'].includes(item.id));

  return (
    <div id="novaobs-mega-menu" className="absolute inset-x-0 top-full px-3 pt-2 md:px-5">
      <button
        type="button"
        className="mega-menu-backdrop fixed inset-x-0 bottom-0 top-14 z-0 cursor-default bg-slate-950/20"
        aria-label="关闭超级菜单"
        onClick={onClose}
      />
      <section
        className="mega-menu-panel relative z-10 mx-auto max-h-[calc(100dvh-4rem)] max-w-[1440px] overflow-y-auto rounded-lg border border-outline bg-surface-lowest shadow-[0_22px_48px_-20px_rgba(18,32,51,0.42)]"
        aria-label="NovaObs 超级菜单"
      >
        <div className="border-b border-outline px-3 py-2 lg:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {domains.map((item) => (
              <button
                key={item.id}
                type="button"
                className={[
                  'shrink-0 rounded-md px-3 py-2 text-xs font-semibold',
                  item.id === domain.id ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface',
                ].join(' ')}
                onClick={() => onChangeDomain(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[220px_minmax(0,1fr)_200px]">
          <div className="mega-menu-domain border-b border-outline bg-primary-soft/70 px-5 py-5 lg:min-h-64 lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70">当前模块</div>
            <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white shadow-[0_8px_18px_-12px_rgba(13,91,215,0.9)]">
              <DomainIcon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-on-surface">{domain.label}</h2>
            <p className="mt-1 max-w-40 text-xs leading-5 text-muted">{domain.description}</p>
            <div className="mt-5 hidden h-px bg-primary/15 lg:block" />
            <p className="mt-3 hidden text-[11px] leading-5 text-muted lg:block">从右侧选择功能，进入对应工作区。</p>
          </div>

          <div className="mega-menu-navigation min-w-0 px-4 py-5 lg:px-7 lg:py-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="text-xs font-semibold text-on-surface">模块功能</div>
              <div className="h-px flex-1 bg-outline" />
            </div>

            <div className={['grid gap-x-6 gap-y-5', domain.groups.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'].join(' ')}>
              {domain.groups.map((group) => (
                <div key={group.id}>
                  <div className="mb-2.5 text-[11px] font-semibold text-muted">{group.label}</div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {group.items.map((item) => (
                      <MegaMenuNavigationItem key={item.id} activeItem={activeItem} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {domain.id === 'k8s' ? <K8sMegaMenuClusterWork /> : null}
          </div>

          <div className="mega-menu-utility border-t border-outline bg-surface/60 px-4 py-5 lg:border-l lg:border-t-0 lg:px-5 lg:py-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">快速访问</div>
            <div className="mt-3 grid gap-0.5">
              {quickItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-md px-2 py-2 text-[11px] font-semibold text-muted transition-colors hover:bg-surface-lowest hover:text-primary"
                    to={item.path}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function K8sMegaMenuClusterWork() {
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const { data: clusters = [], error, isLoading } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const selectedCluster = clusters.find((cluster) => cluster.id === selectedClusterId);
  const groupedItems = useMemo(() => (
    k8sNavigationGroups
      .map((group) => ({
        ...group,
        items: getK8sNavigationGroupItems(group.id).filter((item) => item.requiresCluster),
      }))
      .filter((group) => group.items.length)
  ), []);

  useEffect(() => {
    if (!clusters.length) {
      if (selectedClusterId) setSelectedClusterId('');
      return;
    }
    const exists = clusters.some((cluster) => cluster.id === selectedClusterId);
    if (!exists) {
      setSelectedClusterId(clusters.length === 1 ? clusters[0].id : '');
    }
  }, [clusters, selectedClusterId]);

  return (
    <section className="mt-5 rounded-md border border-outline/80 bg-surface-lowest px-3 py-3" aria-label="K8s 工作台入口">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-on-surface">工作台</div>
          <p className="mt-1 text-[11px] leading-5 text-muted">先选择集群，再进入 Dashboard、资源、访问控制、交付运维和安全模块。</p>
        </div>
        <label className="block w-full max-w-sm shrink-0">
          <span className="text-[11px] font-semibold text-muted">K8s 工作台上下文</span>
          <select
            className="console-input mt-1.5 h-8 w-full text-xs font-semibold"
            disabled={isLoading || Boolean(error) || !clusters.length}
            value={selectedClusterId}
            onChange={(event) => setSelectedClusterId(event.target.value)}
          >
            <option value="">请选择集群</option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">
          集群列表读取失败，请检查 NovaObs 后端连接。
        </div>
      ) : null}

      {!isLoading && !error && !clusters.length ? (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-outline/70 bg-surface px-3 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>当前还没有可选择的集群。</span>
          <Link className="font-semibold text-primary hover:underline" to="/k8s/access">去集群接入</Link>
        </div>
      ) : null}

      {selectedCluster ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={['status-badge', k8sClusterStatusClass(selectedCluster)].join(' ')}>
            <span className="status-dot" aria-hidden />
            {k8sClusterStatusText(selectedCluster)}
          </span>
          <span className="rounded bg-surface px-2 py-1 font-mono text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{selectedCluster.version || '-'}</span>
          <span className="rounded bg-surface px-2 py-1 font-mono text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{selectedCluster.region || '-'}</span>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {groupedItems.map((group) => (
          <div key={group.id} className="min-w-0">
            <div className="mb-1.5 text-[11px] font-semibold text-muted">{group.label}</div>
            <div className="grid gap-1.5">
              {group.items.map((item) => (
                <K8sMegaMenuClusterWorkItem key={item.id} clusterId={selectedClusterId} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function K8sMegaMenuClusterWorkItem({ clusterId, item }: { clusterId: string; item: K8sNavigationItem }) {
  const Icon = item.icon;
  const className = [
    'group flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
    clusterId ? 'text-on-surface hover:bg-surface-lowest hover:text-primary' : 'cursor-not-allowed text-muted/70',
  ].join(' ');
  const content = (
    <>
      {clusterId ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted group-hover:text-primary" /> : <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-muted/70" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {clusterId ? <ArrowRight className="h-3 w-3 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /> : <span className="shrink-0 text-[10px] font-medium text-muted/70">先选集群</span>}
    </>
  );

  if (!clusterId) {
    return (
      <div className={className} title="请先选择集群">
        {content}
      </div>
    );
  }

  return (
    <Link className={className} to={k8sClusterPath(clusterId, item)}>
      {content}
    </Link>
  );
}

function k8sClusterStatusText(cluster: K8sCluster) {
  if (['active', 'healthy', 'ready'].includes(cluster.status)) return '正常';
  if (['failed', 'error'].includes(cluster.status)) return '异常';
  if (['degraded', 'warning'].includes(cluster.status)) return '退化';
  return cluster.status || (cluster.readOnly ? '只读接入' : '已登记');
}

function k8sClusterStatusClass(cluster: K8sCluster) {
  if (['active', 'healthy', 'ready'].includes(cluster.status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error'].includes(cluster.status)) return 'border-danger/20 bg-rose-50 text-danger';
  if (['degraded', 'warning'].includes(cluster.status) || cluster.readOnly) return 'border-warning/20 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

function MegaMenuNavigationItem({
  activeItem,
  item,
}: {
  activeItem: NavigationItem | undefined;
  item: NavigationItem;
}) {
  const Icon = item.icon;
  const selected = navigationItemContains(item, activeItem?.id);
  const hasChildren = Boolean(item.children?.length);

  return (
    <div
      className={[
        'mega-menu-primary-item rounded-md border border-outline/80 bg-surface-lowest px-3 py-2.5 transition-colors',
        selected
          ? 'border-l-[3px] border-primary bg-primary-soft'
          : 'hover:border-primary/30 hover:bg-surface',
      ].join(' ')}
    >
      <Link
        className={['group flex items-center gap-3', hasChildren ? 'min-h-12' : 'min-h-16'].join(' ')}
        to={item.path}
      >
        <span className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-md', selected ? 'bg-primary text-white' : 'bg-surface text-muted group-hover:bg-primary-soft group-hover:text-primary'].join(' ')}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={['block text-sm font-semibold', selected ? 'text-primary' : 'text-on-surface'].join(' ')}>{item.label}</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-muted">{item.description}</span>
        </span>
        <ArrowRight className={['h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5', selected ? 'text-primary' : 'text-muted/60'].join(' ')} />
      </Link>

      {hasChildren ? (
        <div className="mega-menu-child-list mt-2 border-t border-outline/70 pt-2" aria-label={`${item.label} 子功能`}>
          {item.children?.map((child) => {
            const ChildIcon = child.icon;
            const childSelected = activeItem?.id === child.id;
            return (
              <Link
                key={child.id}
                className={[
                  'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                  childSelected ? 'bg-surface-lowest text-primary' : 'text-muted hover:bg-surface-lowest hover:text-primary',
                ].join(' ')}
                to={child.path}
              >
                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{child.label}</span>
                <ArrowRight className={['h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5', childSelected ? 'text-primary' : 'text-muted/50'].join(' ')} />
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function flattenNavigationItems(items: NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => [item, ...flattenNavigationItems(item.children ?? [])]);
}

function navigationItemContains(item: NavigationItem, itemId: string | undefined): boolean {
  if (!itemId) return false;
  return item.id === itemId || Boolean(item.children?.some((child) => navigationItemContains(child, itemId)));
}

function SessionLoadingView() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-surface px-4 text-on-surface">
      <section className="console-panel w-full max-w-md px-6 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-lg font-semibold tracking-tight">正在校验平台会话</h1>
        <p className="mt-2 text-sm leading-6 text-muted">/api/v1/auth/session</p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/70" />
        </div>
      </section>
    </main>
  );
}

function LoginView({ onSuccess }: { onSuccess: (session: PlatformSession) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const session = await loginPlatformUser({ username, password });
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 text-on-surface">
      <form className="console-panel relative w-full max-w-sm p-8" onSubmit={submit}>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <UserCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 font-display text-lg font-semibold tracking-tight">登录</h2>
        <p className="mt-2 text-sm leading-6 text-muted">平台 IAM 账号</p>
        <div className="mt-6 grid gap-3">
          <label className="grid gap-1.5 text-[13px] font-semibold text-muted">
            用户名
            <input className="console-input h-11 w-full" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" autoComplete="username" />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold text-muted">
            密码
            <input className="console-input h-11 w-full" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" type="password" autoComplete="current-password" />
          </label>
        </div>
        {error ? <div className="console-notice console-notice-warning mt-4">{error}</div> : null}
        <button type="submit" className="console-button console-button-primary mt-5 h-10 w-full text-sm" disabled={!username.trim() || pending}>
          <LogIn className="h-4 w-4" />
          {pending ? '登录中' : '登录'}
        </button>
      </form>
    </main>
  );
}

function getWorkspaceLabel(
  pathname: string,
  activeItem: NavigationItem | undefined,
  activeDomain: NavigationDomain,
) {
  if (/^\/k8s\/clusters\/[^/]+/.test(pathname)) return '集群工作台';
  if (pathname.startsWith('/agents/')) return 'Agent 详情';
  return activeItem?.label ?? activeDomain.label;
}

function getBackTarget(pathname: string) {
  if (/^\/k8s\/clusters\/[^/]+/.test(pathname)) {
    return { to: '/k8s', label: '返回集群列表', ariaLabel: '返回 K8s 集群列表' };
  }
  if (pathname === '/logs/agents/new' || /^\/logs\/agents\/[^/]+\/edit$/.test(pathname)) {
    return { to: '/logs/agents', label: '返回采集路由', ariaLabel: '返回采集路由列表' };
  }
  if (pathname === '/logs/alerts/new' || /^\/logs\/alerts\/[^/]+$/.test(pathname)) {
    return { to: '/logs/alerts', label: '返回日志告警', ariaLabel: '返回日志告警列表' };
  }
  if (/^\/agents\/[^/]+$/.test(pathname)) {
    return { to: '/logs/agents', label: '返回采集路由', ariaLabel: '返回采集路由列表' };
  }
  return null;
}

function LogoutConfirmDetails({
  status,
  onLogout,
}: {
  status: ReturnType<typeof useLogoutAction>['status'];
  onLogout: () => void;
}) {
  const pending = status === 'pending';

  function cancel(event: { currentTarget: HTMLButtonElement }) {
    const details = event.currentTarget.closest('details');
    if (details) details.open = false;
  }

  return (
    <details className="relative shrink-0">
      <summary
        className="platform-logout-action flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-danger/20 bg-surface-lowest text-danger transition hover:bg-red-50 [&::-webkit-details-marker]:hidden"
        title="退出登录需要确认"
        aria-label="退出登录需要确认"
      >
        <LogOut className="h-3.5 w-3.5" />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border border-danger/20 bg-surface-lowest p-3 shadow-[0_16px_36px_rgba(24,52,96,0.18)]">
        <div className="text-xs font-semibold text-on-surface">退出登录</div>
        <div className="mt-1 text-[11px] leading-4 text-muted">退出后需要重新登录才能继续访问控制台</div>
        <div className="mt-3 flex justify-end gap-2">
          <button className="console-button h-8 px-3 text-xs" onClick={cancel}>
            <X className="h-3.5 w-3.5" />
            取消退出
          </button>
          <button className="h-8 rounded-md bg-danger px-3 text-xs font-semibold text-white disabled:opacity-60" disabled={pending} onClick={onLogout}>
            {pending ? '退出中' : '确认退出'}
          </button>
        </div>
      </div>
    </details>
  );
}
