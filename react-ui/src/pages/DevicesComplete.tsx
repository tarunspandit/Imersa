import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import discoveryService, { DeviceSensor, getSupportedProtocols } from '@/services/discoveryApi';
import authService from '@/services/authApi';
import { 
  Search, RefreshCw, Plus, Wifi, Power, Battery, 
  Thermometer, Sun, Activity, AlertTriangle, CheckCircle,
  Trash2, Settings, TestTube, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DeviceCardProps {
  device: DeviceSensor;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: any) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onDelete, onUpdate }) => {
  const getDeviceIcon = () => {
    switch (device.type) {
      case 'ZLLSwitch':
      case 'ZGPSwitch':
        return <Power className="w-5 h-5" />;
      case 'ZLLPresence':
      case 'CLIPPresence':
        return <Activity className="w-5 h-5" />;
      case 'ZLLTemperature':
      case 'CLIPTemperature':
        return <Thermometer className="w-5 h-5" />;
      case 'ZLLLightLevel':
      case 'CLIPLightLevel':
      case 'Daylight':
        return <Sun className="w-5 h-5" />;
      default:
        return <Wifi className="w-5 h-5" />;
    }
  };

  const getBatteryIcon = (level: number | undefined) => {
    if (!level) return null;
    const color = level > 50 ? 'text-green-500' : level > 20 ? 'text-yellow-500' : 'text-red-500';
    return <Battery className={`w-4 h-4 ${color}`} />;
  };

  const formatLastUpdate = (timestamp: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {getDeviceIcon()}
            <div>
              <CardTitle className="text-base">{device.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {device.modelid} · {device.manufacturername}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {device.config.battery && getBatteryIcon(device.config.battery)}
            <span className={`w-2 h-2 rounded-full ${
              device.config.reachable ? 'bg-green-500' : 'bg-red-500'
            }`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Device State */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {device.state.presence !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Presence:</span>
              <span>{device.state.presence ? 'Detected' : 'Clear'}</span>
            </div>
          )}
          {device.state.temperature !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Temperature:</span>
              <span>{(device.state.temperature / 100).toFixed(1)}°C</span>
            </div>
          )}
          {device.state.lightlevel !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Light Level:</span>
              <span>{device.state.lightlevel} lux</span>
            </div>
          )}
          {device.state.buttonevent !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Button:</span>
              <span>{device.state.buttonevent}</span>
            </div>
          )}
        </div>
        
        {/* Last Update */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Last update:</span>
          <span>{formatLastUpdate(device.state.lastupdated)}</span>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onUpdate(device.id, { name: prompt('New name:', device.name) })}
          >
            <Settings className="w-3 h-3 mr-1" />
            Configure
          </Button>
          <Button 
            size="sm" 
            variant="destructive"
            onClick={() => onDelete(device.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const DevicesComplete: React.FC = () => {
  const [devices, setDevices] = useState<Record<string, DeviceSensor>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Manual device addition state
  const [manualDevice, setManualDevice] = useState({
    name: '',
    protocol: 'native',
    ip: '',
    mac: '',
    model: ''
  });

  const protocols = discoveryService.getSupportedProtocols();

  useEffect(() => {
    fetchDevices();
    // Auto-refresh every 2 seconds like legacy UI
    const interval = setInterval(fetchDevices, 2000);
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const fetchDevices = async () => {
    try {
      const fetchedDevices = await discoveryService.getSensors();
      setDevices(fetchedDevices);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast.error('Failed to fetch devices');
      setIsLoading(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await discoveryService.searchForLights();
      toast.success('Searching for new devices...');
      
      // Check for new devices after 10 seconds
      setTimeout(async () => {
        const newLights = await discoveryService.getNewLights();
        const foundCount = Object.keys(newLights).filter(k => k !== 'lastscan').length;
        if (foundCount > 0) {
          toast.success(`Found ${foundCount} new device(s)`);
          await fetchDevices();
        } else {
          toast.info('No new devices found');
        }
        setIsScanning(false);
      }, 10000);
    } catch (error) {
      console.error('Scan failed:', error);
      toast.error('Device scan failed');
      setIsScanning(false);
    }
  };

  const handleAddDevice = async () => {
    try {
      // Test connection first
      const testResult = await discoveryService.testDevice({
        protocol: manualDevice.protocol,
        ip: manualDevice.ip
      });
      
      if (!testResult.success) {
        toast.error(testResult.message || 'Connection test failed');
        return;
      }
      
      const result = await discoveryService.addDevice(manualDevice);
      if (result.success) {
        toast.success(`Device added with ID: ${result.success.id}`);
        setShowAddModal(false);
        setManualDevice({ name: '', protocol: 'native', ip: '', mac: '', model: '' });
        await fetchDevices();
      }
    } catch (error) {
      console.error('Failed to add device:', error);
      toast.error('Failed to add device');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    
    try {
      await discoveryService.deleteSensor(deviceId);
      toast.success('Device deleted');
      await fetchDevices();
    } catch (error) {
      console.error('Failed to delete device:', error);
      toast.error('Failed to delete device');
    }
  };

  const handleUpdateDevice = async (deviceId: string, updates: any) => {
    if (!updates.name) return;
    
    try {
      await discoveryService.updateSensor(deviceId, updates);
      toast.success('Device updated');
      await fetchDevices();
    } catch (error) {
      console.error('Failed to update device:', error);
      toast.error('Failed to update device');
    }
  };

  const filteredDevices = Object.entries(devices).filter(([id, device]) => 
    device.protocol !== 'none' && 
    (selectedProtocol === 'all' || device.protocol === selectedProtocol)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Device Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage sensors and smart devices
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleScan}
            disabled={isScanning}
            variant="outline"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Scan for Devices
              </>
            )}
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manually
          </Button>
        </div>
      </div>

      {/* Protocol Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Protocol</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedProtocol === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedProtocol('all')}
            >
              All Protocols
            </Button>
            {protocols.map(protocol => (
              <Button
                key={protocol.id}
                size="sm"
                variant={selectedProtocol === protocol.id ? 'default' : 'outline'}
                onClick={() => setSelectedProtocol(protocol.id)}
              >
                <span className="mr-1">{protocol.icon}</span>
                {protocol.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Devices Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDevices.map(([id, device]) => (
            <DeviceCard
              key={id}
              device={{ ...device, id }}
              onDelete={handleDeleteDevice}
              onUpdate={handleUpdateDevice}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Wifi className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No devices found</p>
            <p className="text-muted-foreground mt-1">
              Click "Scan for Devices" to discover new devices
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Device Manually</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Device Name</label>
                <Input
                  value={manualDevice.name}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Living Room Sensor"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Protocol</label>
                <select 
                  className="w-full p-2 border rounded-lg"
                  value={manualDevice.protocol}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, protocol: e.target.value }))}
                >
                  {protocols.map(protocol => (
                    <option key={protocol.id} value={protocol.id}>
                      {protocol.name} - {protocol.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium">IP Address</label>
                <Input
                  value={manualDevice.ip}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, ip: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">MAC Address (optional)</label>
                <Input
                  value={manualDevice.mac}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, mac: e.target.value }))}
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Model (optional)</label>
                <Input
                  value={manualDevice.model}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="Device model"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowAddModal(false);
                    setManualDevice({ name: '', protocol: 'native', ip: '', mac: '', model: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddDevice}>
                  Add Device
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DevicesComplete;