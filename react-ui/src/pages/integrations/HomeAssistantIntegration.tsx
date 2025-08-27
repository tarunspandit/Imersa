import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import { 
  Home, Key, Shield, Link, CheckCircle, 
  AlertTriangle, Loader2, Info, Globe, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const HomeAssistantIntegration: React.FC = () => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [useWebsocket, setUseWebsocket] = useState(true);
  const [syncInterval, setSyncInterval] = useState('5');
  const [entityCount, setEntityCount] = useState(0);

  const handleConnect = async () => {
    if (!url || !token) {
      toast.error('Please enter both URL and access token');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await discoveryService.connectHomeAssistant(url, token, {
        websocket: useWebsocket,
        syncInterval: parseInt(syncInterval)
      });
      
      if (response && response.success) {
        setIsConnected(true);
        setEntityCount(response.entities || 0);
        toast.success(`Connected! Imported ${response.entities || 0} entities from Home Assistant`);
      } else {
        toast.error('Failed to connect to Home Assistant');
      }
    } catch (error) {
      console.error('Home Assistant connection failed:', error);
      toast.error('Connection failed. Check your URL and token.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setUrl('');
    setToken('');
    setIsConnected(false);
    setEntityCount(0);
    toast('Disconnected from Home Assistant');
  };

  const handleTestConnection = async () => {
    if (!url || !token) {
      toast.error('Please enter both URL and access token');
      return;
    }

    try {
      toast('Testing connection...');
      const response = await discoveryService.testHomeAssistant(url, token);
      if (response && response.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error('Connection test failed');
      }
    } catch (error) {
      toast.error('Unable to reach Home Assistant');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Home Assistant Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect to Home Assistant for advanced automation and device control
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Connection Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Connected</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {entityCount} entities
                    </span>
                  </div>
                </div>
                
                <Button 
                  variant="destructive"
                  onClick={handleDisconnect}
                  className="w-full"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">Home Assistant URL</label>
                  <Input
                    placeholder="http://homeassistant.local:8123"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Include http:// or https:// and port number
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Long-Lived Access Token</label>
                  <Input
                    type="password"
                    placeholder="Your Home Assistant access token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Create in HA Profile → Security tab
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Use WebSocket</label>
                    <Switch
                      checked={useWebsocket}
                      onCheckedChange={setUseWebsocket}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enable for real-time updates (recommended)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Sync Interval (seconds)</label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={!url || !token}
                    className="flex-1"
                  >
                    Test
                  </Button>
                  <Button 
                    onClick={handleConnect}
                    disabled={isConnecting || !url || !token}
                    className="flex-1"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4 mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Getting Access Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Getting Access Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Open Home Assistant</p>
                  <p className="text-sm text-muted-foreground">
                    Navigate to your HA instance
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Go to Your Profile</p>
                  <p className="text-sm text-muted-foreground">
                    Click your username in the sidebar
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Security Tab</p>
                  <p className="text-sm text-muted-foreground">
                    Scroll to "Long-Lived Access Tokens"
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium">Create Token</p>
                  <p className="text-sm text-muted-foreground">
                    Name it "DIYHue" and copy the token
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Security Note:</p>
                  <p>Keep your token secure. It provides full access to your HA instance.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features & Capabilities */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Features & Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Entity Import</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Light entities with full control</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Switch entities as on/off lights</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Sensor data synchronization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Climate control integration</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-3">Automation</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Two-way state synchronization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Scene activation from HA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Service call integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Event trigger support</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Pro Tip:</p>
                  <p>Use WebSocket connection for instant updates without polling. This reduces latency and improves responsiveness for automations.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">📱 Supported Domains</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• light</li>
                  <li>• switch</li>
                  <li>• sensor</li>
                  <li>• binary_sensor</li>
                  <li>• climate</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">🔄 Sync Options</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Real-time via WebSocket</li>
                  <li>• Polling (1-60 seconds)</li>
                  <li>• Manual refresh</li>
                  <li>• Selective entity sync</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">⚙️ Advanced</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Custom attributes</li>
                  <li>• Template sensors</li>
                  <li>• Device tracking</li>
                  <li>• Area mapping</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HomeAssistantIntegration;