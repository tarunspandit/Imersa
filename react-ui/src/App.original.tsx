import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { useAuthStore, useAppStore } from '@/stores';

// Import pages (these will be created next)
import Dashboard from './pages/Dashboard';
import Lights from './pages/Lights';
import Groups from './pages/Groups';
import Scenes from './pages/Scenes';
import Gradients from './pages/Gradients';
import Entertainment from './pages/Entertainment';
import EntertainmentWizard from './pages/EntertainmentWizard';
import WLED from './pages/WLED';
import Scheduler from './pages/Scheduler';
import AutomationPage from './pages/AutomationPage';
import Analytics from './pages/Analytics';
import Devices from './pages/Devices';
import Settings from './pages/Settings';
import Help from './pages/Help';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import SensorsPage from './pages/SensorsPage';

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { theme } = useAppStore();

  // Check authentication status on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  return (
    <Router>
      <div className="App">
        {!isAuthenticated ? (
          // Unauthenticated routes
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          // Authenticated routes with layout
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="lights" element={<Lights />} />
              <Route path="groups" element={<Groups />} />
              <Route path="scenes" element={<Scenes />} />
              <Route path="gradients" element={<Gradients />} />
              <Route path="entertainment" element={<Entertainment />} />
              <Route path="entertainment/wizard" element={<EntertainmentWizard />} />
              <Route path="wled" element={<WLED />} />
              <Route path="scheduler" element={<Scheduler />} />
              <Route path="automation" element={<AutomationPage />} />
              <Route path="sensors" element={<SensorsPage />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="devices" element={<Devices />} />
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
