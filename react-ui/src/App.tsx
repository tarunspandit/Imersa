import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { useAppStore } from '@/stores';
import authService from '@/services/authApi';
import { Toaster } from 'react-hot-toast';

// Import pages - using complete implementations
import Dashboard from './pages/DashboardNew';
import LightsComplete from './pages/LightsComplete';
import Groups from './pages/Groups';
import Scenes from './pages/Scenes';
import Entertainment from './pages/Entertainment';
import EntertainmentWizard from './pages/EntertainmentWizardNew';
import WLED from './pages/WLED';
import Scheduler from './pages/Scheduler';
import AutomationPage from './pages/AutomationPage';
import DevicesComplete from './pages/DevicesComplete';
import SettingsComplete from './pages/SettingsComplete';
import BridgeManagement from './pages/BridgeManagement';
import AppUsers from './pages/AppUsers';
import IntegrationHub from './pages/integrations/IntegrationHub';
import TradfriIntegration from './pages/integrations/TradfriIntegration';
import PhilipsHueIntegration from './pages/integrations/PhilipsHueIntegration';
import GoveeIntegration from './pages/integrations/GoveeIntegration';
import DeconzIntegration from './pages/integrations/DeconzIntegration';
import HomeAssistantIntegration from './pages/integrations/HomeAssistantIntegration';
import MQTTIntegration from './pages/integrations/MQTTIntegration';
import Help from './pages/Help';
import NotFound from './pages/NotFound';
import SensorsPage from './pages/SensorsPage';

function App() {
  const { theme } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Initialize authentication
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Try to get API key directly (for backwards compatibility)
      const key = await authService.getApiKey();
      if (key) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // For now, allow access without auth for backwards compatibility
      setIsAuthenticated(true);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: theme === 'dark' ? '#1f2937' : '#fff',
            color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
          },
        }}
      />
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="lights" element={<LightsComplete />} />
              <Route path="groups" element={<Groups />} />
              <Route path="scenes" element={<Scenes />} />
              <Route path="entertainment" element={<Entertainment />} />
              <Route path="entertainment/wizard" element={<EntertainmentWizard />} />
              <Route path="wled" element={<WLED />} />
              <Route path="scheduler" element={<Scheduler />} />
              <Route path="automation" element={<AutomationPage />} />
              <Route path="sensors" element={<SensorsPage />} />
              <Route path="devices" element={<DevicesComplete />} />
              <Route path="settings" element={<SettingsComplete />} />
              <Route path="bridge" element={<BridgeManagement />} />
              <Route path="users" element={<AppUsers />} />
              <Route path="integrations" element={<IntegrationHub />} />
              <Route path="integrations/tradfri" element={<TradfriIntegration />} />
              <Route path="integrations/philips-hue" element={<PhilipsHueIntegration />} />
              <Route path="integrations/govee" element={<GoveeIntegration />} />
              <Route path="integrations/deconz" element={<DeconzIntegration />} />
              <Route path="integrations/home-assistant" element={<HomeAssistantIntegration />} />
              <Route path="integrations/mqtt" element={<MQTTIntegration />} />
              <Route path="help" element={<Help />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </>
  );
}

export default App;
