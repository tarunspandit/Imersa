import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { 
  Home, Lightbulb, Wifi, Network, Server, 
  Shield, ChevronRight, CheckCircle
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
    description: 'Advanced home automation platform integration',
    icon: Home,
    path: '/integrations/home-assistant',
    status: 'available'
  },
  {
    id: 'mqtt',
    name: 'MQTT',
    description: 'IoT messaging protocol for custom devices',
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
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">Connected</span>
          </div>
        );
      case 'coming-soon':
        return (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Coming Soon
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect your smart home devices and platforms to DIYHue
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <Card 
            key={integration.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => {
              if (integration.status !== 'coming-soon') {
                navigate(integration.path);
              }
            }}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <integration.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{integration.name}</CardTitle>
                </div>
                {getStatusBadge(integration.status)}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {integration.description}
              </p>
              {integration.status !== 'coming-soon' && (
                <div className="flex items-center justify-end text-primary">
                  <span className="text-sm">Configure</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-blue-500/10 border-blue-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Integration Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            All integrations use secure authentication methods. API keys and tokens are encrypted 
            and stored locally. No credentials are sent to external servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationHub;