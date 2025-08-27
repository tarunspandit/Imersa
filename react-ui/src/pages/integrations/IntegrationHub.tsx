import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '@/components/layout/PageWrapper';
import '@/styles/design-system.css';
import { cn } from '@/utils';
import { 
  Home, Lightbulb, Wifi, Network, Server, 
  Shield, ChevronRight, CheckCircle, Plug
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  path: string;
  status?: 'connected' | 'available' | 'coming-soon';
}

const integrations: Integration[] = [
  {
    id: 'tradfri',
    name: 'IKEA Trådfri',
    description: 'Connect IKEA smart lighting gateway and devices',
    icon: Lightbulb,
    path: '/integrations/tradfri',
    status: 'available'
  },
  {
    id: 'philips-hue',
    name: 'Philips Hue',
    description: 'Import lights and scenes from Hue bridges',
    icon: Lightbulb,
    path: '/integrations/philips-hue',
    status: 'available'
  },
  {
    id: 'govee',
    name: 'Govee',
    description: 'Control Govee WiFi lights via API',
    icon: Wifi,
    path: '/integrations/govee',
    status: 'available'
  },
  {
    id: 'deconz',
    name: 'deCONZ',
    description: 'Zigbee gateway for ConBee/RaspBee devices',
    icon: Server,
    path: '/integrations/deconz',
    status: 'available'
  },
  {
    id: 'home-assistant',
    name: 'Home Assistant',
    description: 'Integrate with Home Assistant for advanced automation',
    icon: Home,
    path: '/integrations/home-assistant',
    status: 'available'
  },
  {
    id: 'mqtt',
    name: 'MQTT',
    description: 'Connect devices via MQTT messaging protocol',
    icon: Network,
    path: '/integrations/mqtt',
    status: 'available'
  }
];

const IntegrationHub: React.FC = () => {
  const navigate = useNavigate();

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">Connected</span>
          </div>
        );
      case 'coming-soon':
        return (
          <span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded">
            Coming Soon
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <PageWrapper
      icon={<Plug className="w-8 h-8 text-imersa-dark" />}
      title="Integrations"
      subtitle="Connect your smart home devices and platforms to Imersa"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <div 
            key={integration.id}
            className="glass-card p-6 hover:border-imersa-glow-primary/30 transition-all cursor-pointer holo-card"
            onClick={() => {
              if (integration.status !== 'coming-soon') {
                navigate(integration.path);
              }
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg">
                  <integration.icon className="w-6 h-6 text-gray-900" />
                </div>
                <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
              </div>
              {getStatusBadge(integration.status)}
            </div>
            <p className="text-sm text-gray-400 mb-3">
              {integration.description}
            </p>
            {integration.status !== 'coming-soon' && (
              <div className="flex items-center justify-end text-imersa-glow-primary">
                <span className="text-sm">Configure</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="glass-card p-6 mt-6 border-blue-500/20 bg-blue-500/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white">Integration Security</h3>
        </div>
        <p className="text-sm text-gray-400">
          All integrations use secure authentication methods. API keys and tokens are encrypted 
          and stored locally. No credentials are sent to external servers.
        </p>
      </div>
    </PageWrapper>
  );
};

export default IntegrationHub;