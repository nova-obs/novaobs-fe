import type { FormEvent, PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronDown, Clock3, KeyRound, LogIn, LogOut, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, Sparkles, UserCircle2, X } from 'lucide-react';
import { primaryNavigation } from './navigation';
import { fetchPlatformSession, isSignedOutLocation, loginPlatformUser, resetClientSignedOut, sessionDisplayName, type PlatformSession, type SessionStatus, useLogoutAction } from './session';

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const isK8sClusterFocus = /^\/k8s\/clusters\/[^/]+/.test(location.pathname);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('novaobs.sidebar.collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [authStatus, setAuthStatus] = useState<SessionStatus>('checking');
  const logoutAction = useLogoutAction({
    onLoggedOut: () => {
      setSession(null);
      setAuthStatus('anonymous');
    },
  });
  const logoutStatus = logoutAction.status;

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
    try {
      window.localStorage.setItem('novaobs.sidebar.collapsed', isSidebarCollapsed ? '1' : '0');
    } catch {
      // 浏览器禁用 storage 时，不影响主导航交互。
    }
  }, [isSidebarCollapsed]);

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

  const handleLogout = logoutAction.logout;
  const activeSubject = session?.subject ?? null;
  const activeDisplayName = sessionDisplayName(activeSubject);
  const activeK8sClusterName = getK8sFocusClusterName(location.pathname);

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-app-radial text-on-surface">
      <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(115deg,transparent_0%,rgba(13,91,215,0.12)_38%,transparent_64%),linear-gradient(25deg,transparent_12%,rgba(0,164,255,0.1)_46%,transparent_72%)]" />
      <aside className={['relative hidden h-[100dvh] max-h-[100dvh] shrink-0 flex-col transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex', isK8sClusterFocus ? 'w-[72px] p-2' : isSidebarCollapsed ? 'w-[84px] p-2' : 'w-52 p-2.5'].join(' ')}>
        {isK8sClusterFocus ? (
          <K8sFocusRail
            activeDisplayName={activeDisplayName}
            clusterName={activeK8sClusterName}
            logoutStatus={logoutStatus}
            onLogout={handleLogout}
          />
        ) : (
        <div className="atlas-sidebar-panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 opacity-70 [background-image:radial-gradient(ellipse_at_16%_92%,rgba(13,91,215,0.14),transparent_42%),radial-gradient(ellipse_at_78%_96%,rgba(0,164,255,0.1),transparent_38%)]" />
          <div className="pointer-events-none absolute -bottom-16 -left-14 h-72 w-72 rounded-full border border-primary/10 opacity-70" />
          <div className="pointer-events-none absolute bottom-10 left-2 h-40 w-52 rotate-[-12deg] rounded-[55%] bg-primary/[0.055] blur-2xl" />
          <div className={isSidebarCollapsed ? 'relative flex flex-col items-center gap-3 px-2 py-4' : 'relative px-3 py-3'}>
            <div className={isSidebarCollapsed ? 'flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft/80 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]' : 'flex min-w-0 items-center gap-3 pr-10'} title="NovaObs">
              <span className={isSidebarCollapsed ? '' : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft/85 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]'}>
                <Sparkles className={isSidebarCollapsed ? 'h-4 w-4' : 'h-4 w-4'} />
              </span>
              {isSidebarCollapsed ? null : (
                <span className="min-w-0">
                  <span className="block truncate font-display text-base font-semibold tracking-tight text-on-surface">NovaObs</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">OBS Console</span>
                </span>
              )}
            </div>
            <button
              className={['sidebar-collapse-toggle flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-muted shadow-[inset_0_0_0_1px_rgba(13,91,215,0.12)] transition hover:bg-white hover:text-primary active:translate-y-px', isSidebarCollapsed ? '' : 'absolute right-3 top-4'].join(' ')}
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              title={isSidebarCollapsed ? '展开主导航' : '收起主导航'}
              aria-label={isSidebarCollapsed ? '展开主导航' : '收起主导航'}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <nav className={['relative flex-1 space-y-1.5 overflow-y-auto pt-1', isSidebarCollapsed ? 'px-2' : 'px-2.5'].join(' ')}>
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  title={isSidebarCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    [
                      'group flex items-center rounded-lg text-sm transition-all active:translate-y-px',
                      isSidebarCollapsed ? 'h-10 justify-center px-0' : 'h-9 gap-3 px-3',
                      isActive
                        ? 'atlas-nav-active text-primary'
                        : 'text-muted hover:bg-white/45 hover:text-on-surface',
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className={isSidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className={isSidebarCollapsed ? 'relative mb-3 mt-3 flex flex-col items-center gap-2' : 'relative mx-3 mb-3'}>
            <div className={isSidebarCollapsed ? 'platform-account-session sidebar-account-dock flex flex-col items-center gap-2' : 'platform-account-session sidebar-account-dock rounded-lg bg-white/48 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur'}>
              <div className="flex items-center gap-2">
                <div className={isSidebarCollapsed ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]' : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary'} title={activeDisplayName}>
                  <UserCircle2 className="h-4 w-4" />
                </div>
                {isSidebarCollapsed ? null : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-on-surface">{activeDisplayName}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-muted">{activeSubject?.id || '-'} / {activeSubject?.type || 'platform'}</div>
                  </div>
                )}
                {isSidebarCollapsed ? null : (
                  <LogoutConfirmDetails status={logoutStatus} onLogout={handleLogout} variant="sidebar" />
                )}
              </div>
              {isSidebarCollapsed ? <span className="sr-only">收起状态下展开主导航后可退出登录</span> : null}
            </div>
          </div>
        </div>
        )}
      </aside>
      <main className="relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden p-3 md:pl-0">
        <header className="console-panel mb-3 grid min-h-14 shrink-0 grid-cols-[minmax(220px,420px)_1fr] items-center gap-4 px-4 py-2 md:px-6">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="h-9 w-full rounded-lg border border-outline/60 bg-white/55 pl-9 pr-12 text-sm text-on-surface outline-none transition-all placeholder:text-muted/60 focus:border-primary/50 focus:bg-white/85 focus:ring-2 focus:ring-primary/10"
              placeholder="搜索服务、指标、日志、告警"
              aria-label="搜索服务、指标、日志、告警"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-surface-low px-1.5 py-0.5 font-mono text-[11px] text-muted">⌘K</span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2 text-muted">
            <StatusPill><Clock3 className="h-3.5 w-3.5" />最近 15 分钟<ChevronDown className="h-3.5 w-3.5" /></StatusPill>
          </div>
        </header>
        <nav className="mb-2 flex gap-2 overflow-x-auto px-1 md:hidden">
          {isK8sClusterFocus ? (
            <K8sMobileFocusNavigation clusterName={activeK8sClusterName} />
          ) : primaryNavigation.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                [
                  'shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                  isActive ? 'atlas-nav-active text-primary' : 'bg-white/55 text-muted',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mobile-account-session mb-2 flex items-center justify-between rounded-lg bg-white/65 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <UserCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-muted">账户会话</div>
              <div className="truncate text-xs font-semibold text-on-surface">{activeDisplayName}</div>
            </div>
          </div>
          <LogoutConfirmDetails status={logoutStatus} onLogout={handleLogout} variant="mobile" />
        </div>
        <section
          key={location.pathname}
          className="route-transition-page min-h-0 flex-1 overflow-y-auto rounded-lg px-1 py-2 md:px-3 md:py-4"
        >
          {children}
        </section>
      </main>
    </div>
  );
}

function K8sFocusRail({
  activeDisplayName,
  clusterName,
  logoutStatus,
  onLogout,
}: {
  activeDisplayName: string;
  clusterName: string;
  logoutStatus: ReturnType<typeof useLogoutAction>['status'];
  onLogout: () => void;
}) {
  return (
    <div className="k8s-focus-mode atlas-sidebar-panel flex min-h-0 flex-1 flex-col items-center overflow-hidden px-2 py-3">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 opacity-70 [background-image:radial-gradient(ellipse_at_48%_92%,rgba(13,91,215,0.16),transparent_46%),radial-gradient(ellipse_at_72%_14%,rgba(0,164,255,0.1),transparent_36%)]" />
      <Link
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-white/78 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(13,91,215,0.12)] transition hover:bg-white active:translate-y-px"
        title="返回 K8s 集群总览"
        aria-label="返回 K8s 集群总览"
        to="/k8s"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="relative mt-3 flex w-11 shrink-0 justify-center rounded-lg border border-outline/80 bg-white/62 px-1 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <span className="max-h-36 min-h-20 overflow-hidden break-all font-mono text-[10px] font-semibold leading-4 text-on-surface [writing-mode:vertical-rl]" title={clusterName}>
          {clusterName}
        </span>
      </div>
      <div className="relative mt-auto grid gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
          title={activeDisplayName}
          aria-label={`当前用户 ${activeDisplayName}`}
        >
          <UserCircle2 className="h-4 w-4" />
        </div>
        <LogoutConfirmDetails status={logoutStatus} onLogout={onLogout} variant="rail" />
      </div>
    </div>
  );
}

function K8sMobileFocusNavigation({ clusterName }: { clusterName: string }) {
  return (
    <span className="shrink-0 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">K8s 工作台 · {clusterName}</span>
  );
}

function getK8sFocusClusterName(pathname: string) {
  const match = /^\/k8s\/clusters\/([^/]+)/.exec(pathname);
  if (!match?.[1]) {
    return 'cluster';
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function SessionLoadingView() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-app-radial px-4 text-on-surface">
      <section className="console-panel w-full max-w-md px-6 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">正在校验平台会话</h1>
        <p className="mt-2 text-sm leading-6 text-muted">/api/v1/auth/session</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/60">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/70" />
        </div>
      </section>
    </main>
  );
}

function LoginView({ onSuccess }: { onSuccess: (session: PlatformSession) => void }) {
  const [username, setUsername] = useState('dev-admin');
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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-app-radial px-4 text-on-surface">
      <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(115deg,transparent_0%,rgba(13,91,215,0.14)_38%,transparent_64%),linear-gradient(25deg,transparent_12%,rgba(0,164,255,0.12)_46%,transparent_72%)]" />
      <section className="console-panel relative grid w-full max-w-5xl gap-0 overflow-hidden p-0 md:grid-cols-[1fr_440px]">
        <div className="hidden min-h-[520px] flex-col justify-between bg-primary/[0.035] px-8 py-8 md:flex">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-primary-soft/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              OBS Console
            </div>
            <h1 className="mt-6 max-w-sm font-display text-4xl font-semibold tracking-tight text-on-surface">NovaObs</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted">Platform IAM · RBAC · Audit</p>
          </div>
          <div className="grid gap-3">
            <LoginSignal icon={ShieldCheck} label="权限主体" value="IAM User / Group / ServiceAccount" />
            <LoginSignal icon={KeyRound} label="会话凭据" value="HttpOnly Cookie / SameSite=Lax" />
            <LoginSignal icon={CheckCircle2} label="接入范围" value="所有 /api/v1 业务模块" />
          </div>
        </div>
        <form className="px-6 py-7 md:px-8 md:py-10" onSubmit={submit}>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <UserCircle2 className="h-6 w-6" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">登录</h2>
          <p className="mt-2 text-sm leading-6 text-muted">平台 IAM 账号</p>
          <div className="mt-6 grid gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              用户名
              <input className="console-input h-11 w-full" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" autoComplete="username" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              密码
              <input className="console-input h-11 w-full" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" type="password" autoComplete="current-password" />
            </label>
          </div>
          {error ? <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">{error}</div> : null}
          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={!username.trim() || pending}>
            <LogIn className="h-4 w-4" />
            {pending ? '登录中' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}

function LoginSignal({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <div className="text-xs font-semibold text-on-surface">{label}</div>
        <div className="mt-0.5 font-mono text-[11px] text-muted">{value}</div>
      </div>
    </div>
  );
}

function StatusPill({ children }: PropsWithChildren) {
  return (
    <span
      className="hidden h-9 items-center gap-2 rounded-lg border border-outline/60 bg-white/55 px-3 text-xs font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] xl:inline-flex"
    >
      {children}
    </span>
  );
}

function LogoutConfirmDetails({ status, onLogout, variant }: { status: ReturnType<typeof useLogoutAction>['status']; onLogout: () => void; variant: 'sidebar' | 'rail' | 'mobile' }) {
  const pending = status === 'pending';
  const confirmLabel = pending ? '退出中' : '确认退出';

  function cancel(event: { currentTarget: HTMLButtonElement }) {
    const details = event.currentTarget.closest('details');
    if (details) details.open = false;
  }

  if (variant === 'rail') {
    return (
      <details className="platform-account-session sidebar-account-dock flex flex-col-reverse gap-1">
        <summary
          className="platform-logout-action flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg bg-white/70 text-danger shadow-[inset_0_0_0_1px_rgba(185,28,28,0.14)] transition hover:bg-rose-50 [&::-webkit-details-marker]:hidden"
          title="退出登录需要确认"
          aria-label="退出登录需要确认"
        >
          <LogOut className="h-4 w-4" />
        </summary>
        <div className="grid gap-1 rounded-lg border border-danger/20 bg-white/78 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={onLogout}
            title="确认退出登录"
            aria-label="确认退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 text-muted transition hover:text-on-surface"
            onClick={cancel}
            title="取消退出"
            aria-label="取消退出"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </details>
    );
  }

  if (variant === 'mobile') {
    return (
      <details className="relative ml-3 shrink-0">
        <summary className="platform-logout-action inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg bg-white/75 px-3 text-xs font-semibold text-danger shadow-[inset_0_0_0_1px_rgba(185,28,28,0.14)] [&::-webkit-details-marker]:hidden">
          <LogOut className="h-3.5 w-3.5" />
          {pending ? '退出中' : '退出登录'}
        </summary>
        <div className="absolute bottom-full right-0 z-[3] mb-2 flex items-center gap-2 rounded-lg border border-danger/20 bg-white/95 p-2 shadow-[0_12px_30px_rgba(24,52,96,0.16)]">
          <button className="h-8 whitespace-nowrap rounded-lg bg-danger px-3 text-xs font-semibold text-white disabled:opacity-60" disabled={pending} onClick={onLogout}>{confirmLabel}</button>
          <button className="h-8 whitespace-nowrap rounded-lg border border-outline bg-white px-3 text-xs font-semibold text-muted" onClick={cancel} title="取消退出">取消</button>
        </div>
      </details>
    );
  }

  return (
    <details className="relative shrink-0">
      <summary
        className="platform-logout-action flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg bg-white/70 text-danger shadow-[inset_0_0_0_1px_rgba(185,28,28,0.14)] transition hover:bg-rose-50 [&::-webkit-details-marker]:hidden"
        title="退出登录需要确认"
        aria-label="退出登录需要确认"
      >
        <LogOut className="h-3.5 w-3.5" />
      </summary>
      <div className="absolute bottom-full right-0 z-[3] mb-2 grid w-36 grid-cols-[1fr_auto] gap-2 rounded-lg border border-danger/20 bg-white/95 p-2 shadow-[0_12px_30px_rgba(24,52,96,0.16)]">
        <button className="h-8 rounded-lg bg-danger px-3 text-xs font-semibold text-white transition hover:bg-danger/90 disabled:opacity-60" disabled={pending} onClick={onLogout}>{confirmLabel}</button>
        <button className="h-8 rounded-lg border border-outline bg-white px-3 text-xs font-semibold text-muted transition hover:text-on-surface" onClick={cancel} title="取消退出">取消</button>
      </div>
    </details>
  );
}
