import type { FormEvent, PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, ChevronDown, CircleHelp, Clock3, KeyRound, LogIn, LogOut, RadioTower, Search, Settings, ShieldCheck, Sparkles, UserCircle2 } from 'lucide-react';
import { primaryNavigation } from './navigation';
import { fetchPlatformSession, isSignedOutLocation, loginPlatformUser, resetClientSignedOut, sessionDisplayName, type PlatformSession, type SessionStatus, useLogoutAction } from './session';

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
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
  const logoutStatus = logoutAction.status;
  const activeSubject = session?.subject ?? null;
  const activeDisplayName = sessionDisplayName(activeSubject);

  function logoutFailedMessage() {
    if (logoutStatus !== 'server_failed') {
      return null;
    }
    return <div className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-warning">已清理本地会话，后端退出接口未连通。</div>;
  }

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden bg-app-radial text-on-surface">
      <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(115deg,transparent_0%,rgba(13,91,215,0.12)_38%,transparent_64%),linear-gradient(25deg,transparent_12%,rgba(0,164,255,0.1)_46%,transparent_72%)]" />
      <aside className="relative hidden w-64 shrink-0 flex-col p-4 md:flex">
        <div className="atlas-sidebar-panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 opacity-70 [background-image:radial-gradient(ellipse_at_16%_92%,rgba(13,91,215,0.14),transparent_42%),radial-gradient(ellipse_at_78%_96%,rgba(0,164,255,0.1),transparent_38%)]" />
          <div className="pointer-events-none absolute -bottom-16 -left-14 h-72 w-72 rounded-full border border-primary/10 opacity-70" />
          <div className="pointer-events-none absolute bottom-10 left-2 h-40 w-52 rotate-[-12deg] rounded-[55%] bg-primary/[0.055] blur-2xl" />
          <div className="relative px-5 py-6">
            <div className="inline-flex items-center gap-2 rounded-lg bg-primary-soft/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Telemetry Atlas
            </div>
            <div className="mt-4 font-display text-xl font-semibold tracking-tight text-on-surface">NovaObs</div>
            <div className="mt-1 text-xs font-medium text-muted">统一可观测性控制面</div>
          </div>
          <div className="relative mx-4 mb-4 rounded-lg border border-outline/70 bg-white/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary/70" />
              生产观测域
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted">Prod / CN-SHANGHAI-A</div>
          </div>
          <nav className="relative flex-1 space-y-1 overflow-y-auto px-3">
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    [
                      'group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-all active:translate-y-px',
                      isActive
                        ? 'atlas-nav-active text-primary'
                        : 'text-muted hover:bg-white/45 hover:text-on-surface',
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="relative mx-4 mb-4">
            <div className="rounded-lg bg-white/40 px-4 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <div className="font-semibold text-on-surface">System Health</div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
                <span>API 42ms</span>
                <span>1.2k/s</span>
              </div>
            </div>
            <div className="platform-account-session sidebar-account-dock mt-2 rounded-lg bg-white/48 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <UserCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-on-surface">{activeDisplayName}</div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-muted">{activeSubject?.id || '-'} / {activeSubject?.type || 'platform'}</div>
                </div>
                <button
                  className="platform-logout-action flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-danger shadow-[inset_0_0_0_1px_rgba(185,28,28,0.14)] transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={logoutStatus === 'pending'}
                  onClick={handleLogout}
                  title="退出登录"
                  aria-label="退出登录"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
              {logoutFailedMessage()}
              {logoutStatus === 'done' ? (
                <div className="mt-2 rounded-lg bg-primary-soft px-2 py-1.5 text-[11px] font-semibold text-primary">已清理本地会话。</div>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col p-3 md:pl-0">
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
            <StatusPill tone="green"><span className="h-1.5 w-1.5 rounded-full bg-primary" />平台运行正常</StatusPill>
            <StatusPill><CheckCircle2 className="h-3.5 w-3.5 text-primary" />配置已同步</StatusPill>
            <StatusPill><Clock3 className="h-3.5 w-3.5" />最近 15 分钟<ChevronDown className="h-3.5 w-3.5" /></StatusPill>
            <IconButton label="采集状态"><RadioTower className="h-4 w-4 text-primary" /></IconButton>
            <IconButton label="帮助"><CircleHelp className="h-4 w-4" /></IconButton>
            <IconButton label="通知"><Bell className="h-4 w-4" /></IconButton>
            <IconButton label="设置"><Settings className="h-4 w-4" /></IconButton>
          </div>
        </header>
        <nav className="mb-2 flex gap-2 overflow-x-auto px-1 md:hidden">
          {primaryNavigation.map((item) => (
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
          <button
            className="ml-3 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white/75 px-3 text-xs font-semibold text-danger shadow-[inset_0_0_0_1px_rgba(185,28,28,0.14)] disabled:opacity-60"
            disabled={logoutStatus === 'pending'}
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            {logoutStatus === 'pending' ? '退出中' : '退出登录'}
          </button>
        </div>
        <section className="min-h-0 flex-1 overflow-y-auto rounded-lg px-1 py-2 md:px-3 md:py-4">{children}</section>
      </main>
    </div>
  );
}

function SessionLoadingView() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-app-radial px-4 text-on-surface">
      <section className="console-panel w-full max-w-md px-6 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">正在校验平台会话</h1>
        <p className="mt-2 text-sm leading-6 text-muted">连接统一认证入口，完成后会进入 NovaObs 控制面。</p>
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
              Telemetry Atlas
            </div>
            <h1 className="mt-6 max-w-sm font-display text-4xl font-semibold tracking-tight text-on-surface">NovaObs 平台统一登录</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted">登录态由平台 IAM 统一签发，K8s 运维、服务目录、监控、告警和日志模块共享同一会话主体与 RBAC 权限。</p>
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
          <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">登录控制面</h2>
          <p className="mt-2 text-sm leading-6 text-muted">使用平台用户模块中录入的用户名和初始密码登录。</p>
          <div className="mt-6 grid gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              用户名
              <input className="console-input h-11 w-full" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="dev-admin" autoComplete="username" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              密码
              <input className="console-input h-11 w-full" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="开发态 dev-admin 可留空" type="password" autoComplete="current-password" />
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

function StatusPill({ children, tone }: PropsWithChildren<{ tone?: 'green' }>) {
  return (
    <span className={`hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] xl:inline-flex ${
      tone === 'green'
        ? 'border-primary/20 bg-primary-soft/60 text-primary'
        : 'border-outline/60 bg-white/55 text-on-surface'
    }`}
    >
      {children}
    </span>
  );
}

function IconButton({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <button className="quiet-button h-9 w-9 p-0 text-muted hover:bg-white/70 hover:text-primary" title={label} aria-label={label}>
      {children}
    </button>
  );
}
