import type { FormEvent, PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Grid2X2,
  LogIn,
  LogOut,
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
  const [openDomainId, setOpenDomainId] = useState<string | null>(null);
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

          <StatusPill>
            <Clock3 className="h-3.5 w-3.5" />
            最近 15 分钟
            <ChevronDown className="h-3.5 w-3.5" />
          </StatusPill>

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
        <section
          key={location.pathname}
          className="app-workspace route-transition-page h-full min-h-0 overflow-y-auto px-3 py-3 md:px-5 md:py-4"
        >
          {children}
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
    .flatMap((item) => item.groups.flatMap((group) => group.items))
    .filter((item) => ['logs-explore', 'k8s-fleet', 'platform-access'].includes(item.id));

  return (
    <div id="novaobs-mega-menu" className="absolute inset-x-0 top-full">
      <button
        type="button"
        className="mega-menu-backdrop fixed inset-x-0 bottom-0 top-14 z-0 cursor-default bg-slate-950/20"
        aria-label="关闭超级菜单"
        onClick={onClose}
      />
      <section
        className="mega-menu-panel relative z-10 border-b border-outline bg-surface-lowest shadow-[0_18px_40px_-24px_rgba(18,32,51,0.42)]"
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

        <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:px-8 lg:py-6">
          <div className="min-w-0">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                <DomainIcon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-on-surface">{domain.label}</h2>
                <p className="mt-0.5 text-xs text-muted">{domain.description}</p>
              </div>
            </div>

            <div className={['grid gap-x-8 gap-y-5', domain.groups.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'].join(' ')}>
              {domain.groups.map((group) => (
                <div key={group.id}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{group.label}</div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const selected = activeItem?.id === item.id;
                      return (
                        <Link
                          key={item.id}
                          className={[
                            'group flex min-h-14 items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
                            selected ? 'bg-primary-soft' : 'hover:bg-surface',
                          ].join(' ')}
                          to={item.path}
                        >
                          <Icon className={['mt-0.5 h-4 w-4 shrink-0', selected ? 'text-primary' : 'text-muted group-hover:text-primary'].join(' ')} />
                          <span className="min-w-0">
                            <span className={['block text-[13px] font-semibold', selected ? 'text-primary' : 'text-on-surface'].join(' ')}>{item.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-muted">{item.description}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-outline pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">快速访问</div>
            <div className="mt-2 grid gap-1">
              {quickItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface hover:text-primary"
                    to={item.path}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted" />
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

function StatusPill({ children }: PropsWithChildren) {
  return (
    <span className="hidden h-9 items-center gap-2 rounded-md border border-outline bg-surface-lowest px-3 text-xs font-semibold text-on-surface 2xl:inline-flex">
      {children}
    </span>
  );
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
