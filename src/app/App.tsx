import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { getDocumentTitle, routeDefinitions, type RouteDefinition } from './routes';

export function App() {
  const location = useLocation();

  useEffect(() => {
    document.title = getDocumentTitle(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <AppShell>
      <Routes>
        {routeDefinitions.map(renderRoute)}
      </Routes>
    </AppShell>
  );
}

function renderRoute(route: RouteDefinition) {
  if (route.index) {
    return <Route key="index" index element={route.element} />;
  }
  return (
    <Route key={route.path} path={route.path} element={route.element}>
      {route.children?.map(renderRoute)}
    </Route>
  );
}
