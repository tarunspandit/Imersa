import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import { 
  Zap, Search, Wifi, Settings, RefreshCw,
  Loader2, CheckCircle, AlertTriangle, Link
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface WLEDDevice {
  id: string;
  name: string;
  ip: string;
  mac: string;
  version?: string;
  connected: boolean;
  effects?: string[];
  palettes?: string[];
}

const WLED: React.FC = () => {
  const [devices, setDevices] = useState<WLEDDevice[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [autoDiscover, setAutoDiscover] = useState(true);
  const [manualIp, setManualIp] = useState('');

  useEffect(() => {
    if (autoDiscover) {
      handleSearchDevices();
    }
  }, []);

  const handleSearchDevices = async () => {
    setIsSearching(true);
    try {
      const response = await discoveryService.discoverWLED();
      if (response && response.devices) {
        setDevices(response.devices);
        toast.success(`Found ${response.devices.length} WLED device(s)`);
      } else {
        toast('No WLED devices found');
      }
    } catch (error) {
      console.error('WLED discovery failed:', error);
      toast.error('Failed to discover WLED devices');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddManualDevice = async () => {
    if (!manualIp) {
      toast.error('Please enter an IP address');
      return;
    }

    try {
      await discoveryService.addManualDevice({
        protocol: 'wled',
        ip: manualIp,
        name: 'Manual WLED'
      });
      toast.success('WLED device added');
      setManualIp('');
      await handleSearchDevices();
    } catch (error) {
      toast.error('Failed to add WLED device');
    }
  };

  const handleTestConnection = async (device: WLEDDevice) => {
    try {
      const response = await discoveryService.testDeviceConnection('wled', {
        ip: device.ip
      });
      if (response && response.success) {
        toast.success('Connection successful');
      } else {
        toast.error('Connection failed');
      }
    } catch (error) {
      toast.error('Failed to test connection');
    }
  };

  return (
    <div className="p-6 space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold">WLED Control</h1>
        <p className="text-muted-foreground mt-1">
          Manage WLED devices for advanced LED strip control
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Discovery Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Auto-Discovery</label>
            <Switch
              checked={autoDiscover}
              onCheckedChange={setAutoDiscover}
            />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter WLED IP address"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
            />
            <Button onClick={handleAddManualDevice} disabled={!manualIp}>
              Add Manual
            </Button>
          </div>

          <Button 
            onClick={handleSearchDevices}
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
                Search for Devices
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Device List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="text-center py-12">
              <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No WLED devices found</p>
              <p className="text-muted-foreground mt-1">
                Click search to discover devices or add manually
              </p>
            </CardContent>
          </Card>
        ) : (
          devices.map((device) => (
            <Card key={device.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{device.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{device.ip}</p>
                  </div>
                  {device.connected ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  {device.version && (
                    <p>Version: {device.version}</p>
                  )}
                  {device.mac && (
                    <p className="font-mono text-xs">MAC: {device.mac}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection(device)}
                    className="flex-1"
                  >
                    <Wifi className="w-3 h-3 mr-1" />
                    Test
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open(`http://${device.ip}`, '_blank')}
                    className="flex-1"
                  >
                    <Link className="w-3 h-3 mr-1" />
                    Open UI
                  </Button>
                </div>

                {device.effects && device.effects.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs font-medium mb-1">
                      {device.effects.length} effects available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>WLED Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-2">🎨 Effects</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 180+ built-in effects</li>
                <li>• Custom effect creation</li>
                <li>• Music reactive modes</li>
                <li>• Smooth transitions</li>
              </ul>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-2">🎭 Segments</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Multiple segments per strip</li>
                <li>• Individual control</li>
                <li>• Grouping support</li>
                <li>• Matrix layouts</li>
              </ul>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-2">🔌 Hardware</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• ESP8266/ESP32</li>
                <li>• WS2812B/SK6812</li>
                <li>• APA102/WS2801</li>
                <li>• Up to 1500 LEDs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WLED;