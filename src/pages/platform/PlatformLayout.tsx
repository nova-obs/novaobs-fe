import { NavLink, Outlet } from 'react-router-dom';
import { RadioTower, ShieldCheck } from 'lucide-react';

const platformNav = [
  { to: '/platform/access', label: '访问控制', icon: ShieldCheck },
  { to: '/platform/observability', label: '观测接入配置', icon: RadioTower },
];

export function PlatformLayout() {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col gap-2 border-b border-outline bg-surface-lowest px-1 pb-2 md:flex-row md:items-center">
        <h1 className="page-title shrink-0">平台管理</h1>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto md:ml-5" aria-label="平台管理导航">
          {platformNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => [
                  'inline-flex h-8 min-w-max items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors',
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
