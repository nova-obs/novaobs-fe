import { NavLink, Outlet } from 'react-router-dom';
import { RadioTower, ShieldCheck } from 'lucide-react';

const platformNav = [
  { to: '/platform/access', label: '访问控制', icon: ShieldCheck },
  { to: '/platform/observability', label: '观测接入配置', icon: RadioTower },
];

export function PlatformLayout() {
  return (
    <div className="min-w-0 space-y-3">
      <div className="module-navigation-bar">
        <h1 className="page-title module-navigation-title">平台管理</h1>
        <nav className="module-navigation-tabs" aria-label="平台管理导航">
          {platformNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => [
                  'module-navigation-link gap-2 px-3 text-sm font-semibold transition-colors',
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
