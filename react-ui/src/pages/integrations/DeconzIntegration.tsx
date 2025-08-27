import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import { 
  Server, Shield, Wifi, AlertTriangle, 
  Loader2, Info, CheckCircle, Link, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DeconzGateway {
  id: string;
  name: string;
  ip: string;
  port: number;
  apikey?: string;
  connected: boolean;
}

const DeconzIntegration: React.FC = () => {
  const [gateways, setGateways] = useState<DeconzGateway[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('80');
  const [apiKey, setApiKey] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleSearchGateways = async () => {
    setIsSearching(true);
    try {
      const response = await discoveryService.discoverDeconz();
      if (response && response.length > 0) {
        setGateways(response);
        toast.success(`Found ${response.length} deCONZ gateway(s)`);
      } else {
        toast('No deCONZ gateways found');
        setShowManual(true);
      }
    } catch (error) {
      console.error('Gateway search failed:', error);
      toast.error('Failed to search for gateways');
      setShowManual(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConnectGateway = async (gateway: DeconzGateway) => {
    try {
      // Request API key from deCONZ
      toast('Requesting access from deCONZ gateway...');
      
      const response = await discoveryService.connectDeconz(
        gateway.ip, 
        gateway.port.toString(), 
        apiKey || undefined
      );
      
      if (response && response.success) {
        toast.success('Successfully connected to deCONZ!');
        await handleSearchGateways();
      } else {
        toast.error('Connection failed. Check your API key or gateway settings.');
      }
    } catch (error) {
      toast.error('Failed to connect to deCONZ gateway');
    }
  };

  const handleManualConnect = async () => {
    if (!manualIp) {
      toast.error('Please enter gateway IP address');
      return;
    }

    const manualGateway: DeconzGateway = {
      id: 'manual',
      name: 'Manual Gateway',
      ip: manualIp,
      port: parseInt(manualPort) || 80,
      connected: false
    };

    await handleConnectGateway(manualGateway);
  };

  const handleGetApiKey = async () => {
    try {
      toast('Unlock your gateway in deCONZ Phoscon app first', { duration: 5000 });
      // This would typically open the Phoscon app or provide instructions
      window.open(`http://${manualIp || 'localhost'}:${manualPort}/pwa/login.html`, '_blank');
    } catch (error) {
      toast.error('Failed to open Phoscon app');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">deCONZ Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your deCONZ/Phoscon gateway to control Zigbee devices
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gateway Discovery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Gateway Discovery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleSearchGateways}
              disabled={isSearching}
              className="w-full"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Search for Gateways
                </>
              )}
            </Button>

            {gateways.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Found Gateways:</p>
                {gateways.map((gateway) => (
                  <div key={gateway.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{gateway.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {gateway.ip}:{gateway.port}
                        </p>
                      </div>
                      {gateway.connected ? (
                        <div className="flex items-center gap-1 text-green-500">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Connected</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnectGateway(gateway)}
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button 
              variant="outline" 
              onClick={() => setShowManual(!showManual)}
              className="w-full"
            >
              Manual Configuration
            </Button>
          </CardContent>
        </Card>

        {/* Manual Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Manual Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Gateway IP Address</label>
              <Input
                placeholder="192.168.1.100"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Port</label>
              <Input
                placeholder="80"
                value={manualPort}
                onChange={(e) => setManualPort(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default: 80 for HTTP, 443 for HTTPS
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">API Key (Optional)</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Enter existing API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Button 
                  variant="outline"
                  onClick={handleGetApiKey}
                  disabled={!manualIp}
                >
                  Get Key
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to request new key
              </p>
            </div>

            <Button 
              onClick={handleManualConnect}
              disabled={!manualIp}
              className="w-full"
            >
              <Link className="w-4 h-4 mr-2" />
              Connect to Gateway
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Setup Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium">Initial Setup</h4>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      1
                    </div>
                    <p className="text-sm">Install deCONZ on your system or use ConBee/RaspBee</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      2
                    </div>
                    <p className="text-sm">Open Phoscon App in your browser</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      3
                    </div>
                    <p className="text-sm">Go to Settings → Gateway</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      4
                    </div>
                    <p className="text-sm">Click "Authenticate app" to unlock</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Connecting to DIYHue</h4>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      1
                    </div>
                    <p className="text-sm">Click "Search for Gateways" or enter IP manually</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      2
                    </div>
                    <p className="text-sm">If using manual setup, get API key from Phoscon</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      3
                    </div>
                    <p className="text-sm">Click Connect to establish connection</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      4
                    </div>
                    <p className="text-sm">All Zigbee devices will be imported automatically</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">🎮 Supported Hardware</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• ConBee I/II/III USB</li>
                  <li>• RaspBee I/II HAT</li>
                  <li>• ConBee Gateway</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">💡 Device Support</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Philips Hue</li>
                  <li>• IKEA Trådfri</li>
                  <li>• Xiaomi/Aqara</li>
                  <li>• OSRAM Lightify</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">✨ Features</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Groups & Scenes</li>
                  <li>• Rules & Schedules</li>
                  <li>• Sensor support</li>
                  <li>• OTA updates</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Important:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Ensure deCONZ service is running</li>
                    <li>Gateway must be unlocked for authentication</li>
                    <li>Both systems must be on the same network</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeconzIntegration;