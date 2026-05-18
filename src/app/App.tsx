import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { getDocumentTitle, routeDefinitions } from './routes';

export function App() {
  const location = useLocation();

  useEffect(() => {
    document.title = getDocumentTitle(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <AppShell>
      <Routes>
        {routeDefinitions.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </AppShell>
  );
}
