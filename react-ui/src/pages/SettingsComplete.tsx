import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import bridgeService from '@/services/bridgeApi';
import { 
  Save, Network, Shield, Search, Globe, Wifi, 
  AlertTriangle, CheckCircle, Loader2, Settings as SettingsIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProtocolSettings {
  yeelight: boolean;
  native_multi: boolean;
  tasmota: boolean;
  wled: boolean;
  shelly: boolean;
  esphome: boolean;
  hyperion: boolean;
  tpkasa: boolean;
  elgato: boolean;
}

const SettingsComplete: React.FC = () => {
  // Port settings
  const [portEnabled, setPortEnabled] = useState(false);
  const [ports, setPorts] = useState('80');
  
  // Protocol settings
  const [protocols, setProtocols] = useState<ProtocolSettings>({
    yeelight: true,
    native_multi: true,
    tasmota: true,
    wled: true,
    shelly: true,
    esphome: true,
    hyperion: true,
    tpkasa: true,
    elgato: true
  });
  
  // IP Range settings
  const [ipRange, setIpRange] = useState({
    IP_RANGE_START: 1,
    IP_RANGE_END: 254,
    SUB_IP_RANGE_START: 0,
    SUB_IP_RANGE_END: 255
  });
  
  // Host IP settings
  const [scanOnHostIP, setScanOnHostIP] = useState(false);
  const [bridgeIP, setBridgeIP] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Fetch all settings in parallel
      const [
        portConfig,
        ipRangeConfig,
        scanHostConfig,
        bridgeConfig,
        ...protocolConfigs
      ] = await Promise.all([
        bridgeService.getPortConfig(),
        bridgeService.getIPRangeConfig(),
        bridgeService.getScanOnHostIP(),
        bridgeService.getConfig(),
        bridgeService.getProtocolConfig('yeelight'),
        bridgeService.getProtocolConfig('native_multi'),
        bridgeService.getProtocolConfig('tasmota'),
        bridgeService.getProtocolConfig('wled'),
        bridgeService.getProtocolConfig('shelly'),
        bridgeService.getProtocolConfig('esphome'),
        bridgeService.getProtocolConfig('hyperion'),
        bridgeService.getProtocolConfig('tpkasa'),
        bridgeService.getProtocolConfig('elgato')
      ]);

      // Set port settings
      setPortEnabled(portConfig.enabled);
      setPorts(portConfig.ports.join(','));
      
      // Set IP range
      setIpRange(ipRangeConfig);
      
      // Set scan on host IP
      setScanOnHostIP(scanHostConfig);
      
      // Set bridge IP
      setBridgeIP(bridgeConfig.ipaddress.replace('http://', ''));
      
      // Set protocol settings
      setProtocols({
        yeelight: protocolConfigs[0].enabled,
        native_multi: protocolConfigs[1].enabled,
        tasmota: protocolConfigs[2].enabled,
        wled: protocolConfigs[3].enabled,
        shelly: protocolConfigs[4].enabled,
        esphome: protocolConfigs[5].enabled,
        hyperion: protocolConfigs[6].enabled,
        tpkasa: protocolConfigs[7].enabled,
        elgato: protocolConfigs[8].enabled
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
      setIsLoading(false);
    }
  };

  const handleSavePorts = async () => {
    setIsSaving(true);
    try {
      const portNumbers = ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      await bridgeService.updatePortConfig(portEnabled, portNumbers);
      toast.success('Port settings saved successfully');
    } catch (error) {
      toast.error('Failed to save port settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProtocols = async () => {
    setIsSaving(true);
    try {
      const protocolConfig = Object.entries(protocols).reduce((acc, [key, value]) => {
        acc[key] = { enabled: value };
        return acc;
      }, {} as Record<string, { enabled: boolean }>);
      
      await bridgeService.updateProtocolConfig(protocolConfig);
      toast.success('Protocol settings saved successfully');
    } catch (error) {
      toast.error('Failed to save protocol settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIPRange = async () => {
    setIsSaving(true);
    try {
      await bridgeService.updateIPRangeConfig(ipRange);
      toast.success('IP range settings saved successfully');
    } catch (error) {
      toast.error('Failed to save IP range settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveScanOnHost = async () => {
    setIsSaving(true);
    try {
      await bridgeService.updateScanOnHostIP(scanOnHostIP);
      toast.success('Host IP scan setting saved successfully');
    } catch (error) {
      toast.error('Failed to save host IP scan setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIPRangeChange = (ip: string, type: 'start' | 'end') => {
    const parts = ip.split('.');
    if (parts.length === 4) {
      const subRange = parseInt(parts[2]) || 0;
      const hostRange = parseInt(parts[3]) || 0;
      
      if (type === 'start') {
        setIpRange(prev => ({
          ...prev,
          SUB_IP_RANGE_START: subRange,
          IP_RANGE_START: hostRange
        }));
      } else {
        setIpRange(prev => ({
          ...prev,
          SUB_IP_RANGE_END: subRange,
          IP_RANGE_END: hostRange
        }));
      }
    }
  };

  const getIPFromRange = (type: 'start' | 'end') => {
    const baseParts = bridgeIP.split('.').slice(0, 2);
    if (type === 'start') {
      return `${baseParts[0]}.${baseParts[1]}.${ipRange.SUB_IP_RANGE_START}.${ipRange.IP_RANGE_START}`;
    } else {
      return `${baseParts[0]}.${baseParts[1]}.${ipRange.SUB_IP_RANGE_END}.${ipRange.IP_RANGE_END}`;
    }
  };

  const protocolList = [
    { id: 'yeelight', name: 'Yeelight', description: 'Xiaomi Yeelight WiFi bulbs', icon: '💡' },
    { id: 'native_multi', name: 'Native Multi', description: 'DiyHue native multi-light devices', icon: '🔌' },
    { id: 'tasmota', name: 'Tasmota', description: 'Tasmota firmware devices', icon: '⚡' },
    { id: 'wled', name: 'WLED', description: 'WLED LED strip controllers', icon: '🌈' },
    { id: 'shelly', name: 'Shelly', description: 'Shelly smart switches and dimmers', icon: '🔧' },
    { id: 'esphome', name: 'ESPHome', description: 'ESPHome custom firmware', icon: '🏠' },
    { id: 'hyperion', name: 'Hyperion', description: 'Hyperion ambient TV lighting', icon: '📺' },
    { id: 'tpkasa', name: 'TP-Link Kasa', description: 'TP-Link Kasa smart devices', icon: '🔗' },
    { id: 'elgato', name: 'Elgato', description: 'Elgato Key Light', icon: '🎥' }
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure discovery protocols and network settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Port Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              Port Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure additional ports for device discovery. The bridge will search on these ports when looking for new devices.
            </p>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Enable Additional Ports</div>
                <div className="text-sm text-muted-foreground">
                  Search on ports other than 80
                </div>
              </div>
              <Switch
                checked={portEnabled}
                onCheckedChange={setPortEnabled}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">
                Ports (comma-separated)
              </label>
              <Input
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                placeholder="80,81,82,8080"
                disabled={!portEnabled}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Always include port 80. Example: 80,81,82,8080
              </p>
            </div>
            
            <Button 
              onClick={handleSavePorts}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Port Settings
            </Button>
          </CardContent>
        </Card>

        {/* IP Range Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              IP Range Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set the IP range for device discovery. Narrow ranges speed up discovery.
            </p>
            
            <div>
              <label className="text-sm font-medium">
                Start IP Address
              </label>
              <Input
                value={getIPFromRange('start')}
                onChange={(e) => handleIPRangeChange(e.target.value, 'start')}
                placeholder="192.168.1.1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">
                End IP Address
              </label>
              <Input
                value={getIPFromRange('end')}
                onChange={(e) => handleIPRangeChange(e.target.value, 'end')}
                placeholder="192.168.1.254"
              />
            </div>
            
            <Button 
              onClick={handleSaveIPRange}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save IP Range
            </Button>
          </CardContent>
        </Card>

        {/* Protocol Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Discovery Protocol Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enable or disable specific device discovery protocols. Disabling unused protocols speeds up discovery.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {protocolList.map(protocol => (
                <div 
                  key={protocol.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{protocol.icon}</span>
                    <div>
                      <div className="font-medium">{protocol.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {protocol.description}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={protocols[protocol.id as keyof ProtocolSettings]}
                    onCheckedChange={(checked) => 
                      setProtocols(prev => ({ ...prev, [protocol.id]: checked }))
                    }
                  />
                </div>
              ))}
            </div>
            
            <Button 
              onClick={handleSaveProtocols}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Protocol Settings
            </Button>
          </CardContent>
        </Card>

        {/* Host IP Scanning */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Host IP Scanning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enable scanning on the host machine's IP address. This can help discover devices on the same machine.
            </p>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Scan on Host IP</div>
                <div className="text-sm text-muted-foreground">
                  Include host machine IP ({bridgeIP}) in device discovery
                </div>
              </div>
              <Switch
                checked={scanOnHostIP}
                onCheckedChange={setScanOnHostIP}
              />
            </div>
            
            <Button 
              onClick={handleSaveScanOnHost}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Host IP Setting
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsComplete;