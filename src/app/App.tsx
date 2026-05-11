import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { routeDefinitions } from './routes';

export function App() {
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
