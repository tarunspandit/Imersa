import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { Wizard } from '@/components/ui/Wizard';
import discoveryService from '@/services/discoveryApi';
import { 
  Search, Globe, Link, Shield, CheckCircle, 
  AlertTriangle, Loader2, Info, WifiOff, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface HueBridge {
  id: string;
  ip: string;
  name: string;
  connected: boolean;
}

const PhilipsHueIntegration: React.FC = () => {
  const [bridges, setBridges] = useState<HueBridge[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [selectedBridge, setSelectedBridge] = useState<HueBridge | null>(null);
  const [username, setUsername] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleSearchBridges = async () => {
    setIsSearching(true);
    try {
      const response = await discoveryService.discoverPhilipsHue();
      if (response && response.length > 0) {
        setBridges(response);
        toast.success(`Found ${response.length} Hue bridge(s)`);
      } else {
        toast('No Hue bridges found on your network');
        setShowManual(true);
      }
    } catch (error) {
      console.error('Bridge search failed:', error);
      toast.error('Failed to search for bridges');
      setShowManual(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConnectBridge = async (bridge: HueBridge) => {
    try {
      // First, prompt user to press link button
      toast('Press the link button on your Hue bridge, then click OK', {
        duration: 10000
      });

      // Wait a moment for user to press button
      setTimeout(async () => {
        try {
          await discoveryService.connectPhilipsHue(bridge.ip, username || 'diyhue-bridge');
          toast.success('Successfully connected to Hue bridge!');
          // Refresh bridge list
          await handleSearchBridges();
        } catch (error) {
          toast.error('Failed to connect. Make sure you pressed the link button.');
        }
      }, 3000);
    } catch (error) {
      toast.error('Connection failed');
    }
  };

  const handleManualConnect = async () => {
    if (!manualIp) {
      toast.error('Please enter a bridge IP address');
      return;
    }

    const manualBridge: HueBridge = {
      id: 'manual',
      ip: manualIp,
      name: 'Manual Bridge',
      connected: false
    };

    await handleConnectBridge(manualBridge);
  };

  return (
    <div className="p-6 space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold">Philips Hue Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Philips Hue bridges to import and control Hue lights
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bridge Discovery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Bridge Discovery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleSearchBridges}
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
                  <Search className="w-4 h-4 mr-2" />
                  Search for Bridges
                </>
              )}
            </Button>

            {bridges.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Found Bridges:</p>
                {bridges.map((bridge) => (
                  <div key={bridge.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{bridge.name}</p>
                        <p className="text-xs text-muted-foreground">{bridge.ip}</p>
                      </div>
                      {bridge.connected ? (
                        <div className="flex items-center gap-1 text-green-500">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Connected</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedBridge(bridge);
                            handleConnectBridge(bridge);
                          }}
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showManual && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                <p className="text-sm mb-2">Can't find your bridge automatically?</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManual(true)}
                >
                  Connect Manually
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Manual Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Bridge IP Address</label>
              <Input
                placeholder="192.168.1.100"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find this in your router's device list or Hue app
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Username (Optional)</label>
              <Input
                placeholder="diyhue-bridge"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Custom username for the connection
              </p>
            </div>

            <Button 
              onClick={handleManualConnect}
              disabled={!manualIp}
              className="w-full"
            >
              <Link className="w-4 h-4 mr-2" />
              Connect Manually
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Connection Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium">Automatic Discovery</h4>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      1
                    </div>
                    <p className="text-sm">Make sure your Hue bridge is powered on</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      2
                    </div>
                    <p className="text-sm">Ensure you're on the same network as the bridge</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      3
                    </div>
                    <p className="text-sm">Click "Search for Bridges"</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      4
                    </div>
                    <p className="text-sm">Press the link button when prompted</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Manual Connection</h4>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      1
                    </div>
                    <p className="text-sm">Find your bridge IP in the Hue app settings</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      2
                    </div>
                    <p className="text-sm">Enter the IP address in the manual connection form</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      3
                    </div>
                    <p className="text-sm">Press the link button on your bridge</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                      4
                    </div>
                    <p className="text-sm">Click "Connect Manually" within 30 seconds</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Supported Features:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Import all Hue lights and groups</li>
                    <li>Sync scenes and entertainment areas</li>
                    <li>Real-time state synchronization</li>
                    <li>Support for Hue accessories and sensors</li>
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

export default PhilipsHueIntegration;