import React, { useState, useEffect } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Switch } from '@/components/ui';
import '@/styles/design-system.css';
import { cn } from '@/utils';
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
    <PageWrapper
      icon={<Zap className="w-8 h-8 text-imersa-dark" />}
      title="WLED Control"
      subtitle="Manage WLED devices for advanced LED strip control"
      actions={
        <button 
          onClick={handleSearchDevices}
          disabled={isSearching}
          className="btn-glow flex items-center gap-2"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search Devices
            </>
          )}
        </button>
      }
    >

      {/* Controls */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white">Discovery Settings</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Auto-Discovery</label>
            <Switch
              checked={autoDiscover}
              onCheckedChange={setAutoDiscover}
            />
          </div>

          <div className="flex gap-2">
            <input
              placeholder="Enter WLED IP address"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <button 
              onClick={handleAddManualDevice} 
              disabled={!manualIp}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all disabled:opacity-50"
            >
              Add Manual
            </button>
          </div>

          <button 
            onClick={handleSearchDevices}
            disabled={isSearching}
            className="w-full btn-glow flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search for Devices
              </>
            )}
          </button>
        </div>
      </div>

      {/* Device List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.length === 0 ? (
          <div className="glass-card md:col-span-2 lg:col-span-3 p-12 text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-white">No WLED devices found</p>
              <p className="text-gray-400 mt-1">
                Click search to discover devices or add manually
              </p>
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="glass-card p-6 holo-card">
              <div className="mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{device.name}</h3>
                    <p className="text-xs text-gray-400">{device.ip}</p>
                  </div>
                  {device.connected ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm space-y-1 text-gray-400">
                  {device.version && (
                    <p>Version: {device.version}</p>
                  )}
                  {device.mac && (
                    <p className="font-mono text-xs">MAC: {device.mac}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTestConnection(device)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-all flex items-center justify-center gap-2"
                  >
                    <Wifi className="w-3 h-3" />
                    Test
                  </button>
                  <button
                    onClick={() => window.open(`http://${device.ip}`, '_blank')}
                    className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Link className="w-3 h-3" />
                    Open UI
                  </button>
                </div>

                {device.effects && device.effects.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs font-medium mb-1">
                      {device.effects.length} effects available
                    </p>
                  </div>
                )}
              </div>
            </div>
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
    </PageWrapper>
  );
};

export default WLED;