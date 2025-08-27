import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import { 
  Home, Wifi, Key, Shield, CheckCircle, 
  AlertTriangle, Loader2, Info, Link
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const TradfriIntegration: React.FC = () => {
  const [gateway, setGateway] = useState('');
  const [identity, setIdentity] = useState('');
  const [psk, setPsk] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handlePair = async () => {
    if (!gateway || !identity || !psk) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsPairing(true);
    try {
      await discoveryService.discoverTradfri(gateway, identity, psk);
      toast.success('Successfully paired with IKEA Tradfri gateway!');
      // Clear fields after success
      setGateway('');
      setIdentity('');
      setPsk('');
    } catch (error) {
      console.error('Tradfri pairing failed:', error);
      toast.error('Failed to pair with Tradfri gateway');
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <div className="p-6 space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold">IKEA Trådfri Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your IKEA Trådfri gateway to control IKEA smart lights
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Gateway Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Gateway IP Address</label>
              <Input
                placeholder="192.168.1.100"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                IP address of your Trådfri gateway
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Identity</label>
              <Input
                placeholder="tradfri_identity"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Identity name for the connection
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Security Code (PSK)</label>
              <Input
                type="password"
                placeholder="Security code from gateway label"
                value={psk}
                onChange={(e) => setPsk(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Found on the bottom of your gateway
              </p>
            </div>

            <Button 
              onClick={handlePair}
              disabled={isPairing || !gateway || !identity || !psk}
              className="w-full"
            >
              {isPairing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Pairing...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4 mr-2" />
                  Pair with Gateway
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Setup Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Find your gateway IP</p>
                  <p className="text-sm text-muted-foreground">
                    Check your router's device list or use a network scanner
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Locate the security code</p>
                  <p className="text-sm text-muted-foreground">
                    Find the 16-character code on the bottom of your gateway
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Choose an identity</p>
                  <p className="text-sm text-muted-foreground">
                    Any unique name like "diyhue" or "homebridge"
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium">Click pair</p>
                  <p className="text-sm text-muted-foreground">
                    The bridge will connect and import all your IKEA devices
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Important:</p>
                  <p>Make sure your Trådfri gateway firmware is up to date through the IKEA Home smart app.</p>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowHelp(!showHelp)}
            >
              {showHelp ? 'Hide' : 'Show'} Troubleshooting
            </Button>

            {showHelp && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Common Issues:</p>
                <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Gateway not found: Check it's on the same network</li>
                  <li>Authentication failed: Verify the security code</li>
                  <li>Connection timeout: Restart the gateway</li>
                  <li>Devices not showing: Wait 30 seconds after pairing</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Supported IKEA Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">💡 Lights</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• TRÅDFRI bulbs (all types)</li>
                  <li>• LED panels</li>
                  <li>• Light strips</li>
                  <li>• Driver for wireless control</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">🎛️ Controls</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Remote controls</li>
                  <li>• Motion sensors</li>
                  <li>• Wireless dimmers</li>
                  <li>• On/off switches</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">🏠 Other</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Smart plugs</li>
                  <li>• Blinds (FYRTUR/KADRILJ)</li>
                  <li>• Signal repeaters</li>
                  <li>• Sound controllers</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TradfriIntegration;