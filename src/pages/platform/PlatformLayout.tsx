import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Check, ChevronDown, Images, Settings, ShieldCheck } from 'lucide-react';

const platformSettingsItems = [
  { to: '/platform/settings', label: '镜像模板', icon: Images },
];

export function PlatformLayout() {
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState('');
  const settingsActive = location.pathname === '/platform/settings' || location.pathname.startsWith('/platform/settings/');

  useEffect(() => {
    setOpenGroup('');
  }, [location.pathname]);

  useEffect(() => {
    if (!openGroup) return undefined;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenGroup('');
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openGroup]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="module-navigation-bar overflow-visible">
        <h1 className="sr-only module-navigation-title">平台管理</h1>
        <nav className="module-navigation-tabs overflow-visible" aria-label="平台管理导航">
          <div className="relative z-20 shrink-0">
            <button
              type="button"
              className={platformGroupTriggerClass(settingsActive || openGroup === 'settings')}
              aria-expanded={openGroup === 'settings'}
              onClick={() => setOpenGroup((value) => value === 'settings' ? '' : 'settings')}
            >
              <Settings className="h-4 w-4" />
              <span>平台设置</span>
              <ChevronDown className={['h-3.5 w-3.5 transition-transform', openGroup === 'settings' ? 'rotate-180' : ''].join(' ')} />
            </button>
            {openGroup === 'settings' ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="关闭平台设置菜单"
                  onClick={() => setOpenGroup('')}
                />
                <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-md border border-outline bg-surface-lowest p-1.5 shadow-[0_16px_36px_-18px_rgba(18,32,51,0.45)]">
                  <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">平台设置</div>
                  {platformSettingsItems.map((item) => {
                    const Icon = item.icon;
                    const selected = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                      <Link
                        key={item.to}
                        className={[
                          'flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors',
                          selected ? 'border-l-[3px] border-primary bg-primary-soft font-semibold text-primary' : 'text-on-surface hover:bg-surface',
                        ].join(' ')}
                        to={item.to}
                        onClick={() => setOpenGroup('')}
                      >
                        <Icon className={['h-4 w-4 shrink-0', selected ? 'text-primary' : 'text-muted'].join(' ')} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
          <NavLink
            to="/platform/access"
            className={({ isActive }) => [
              'module-navigation-link my-1 gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
              isActive ? 'border-transparent bg-primary-soft text-primary' : 'border-transparent text-muted hover:bg-surface hover:text-on-surface',
            ].join(' ')}
          >
            <ShieldCheck className="h-4 w-4" />
            访问控制
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

function platformGroupTriggerClass(active: boolean) {
  return [
    'my-1 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border-b-2 px-3 text-sm font-semibold transition-colors',
    active ? 'border-transparent bg-primary-soft text-primary' : 'border-transparent text-muted hover:bg-surface hover:text-on-surface',
  ].join(' ');
}
