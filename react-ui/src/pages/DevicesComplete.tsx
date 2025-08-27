import React, { useState, useEffect } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import '@/styles/design-system.css';
import { cn } from '@/utils';
import { Modal } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import authService from '@/services/authApi';
import { 
  Search, RefreshCw, Plus, Wifi, Power, Battery, 
  Thermometer, Sun, Activity, AlertTriangle, CheckCircle,
  Trash2, Settings, TestTube, Loader2, Monitor
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DeviceSensor {
  id: string;
  name: string;
  type: string;
  protocol?: string;
  ip?: string;
  mac?: string;
  state?: any;
  battery?: number;
  reachable?: boolean;
  lastupdated?: string;
  config?: any;
}

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
    <div className="glass-card p-4 hover:bg-white/10 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
            {getDeviceIcon()}
          </div>
          <div>
            <h3 className="text-base font-medium text-white">{device.name}</h3>
            <p className="text-xs text-gray-400">
              {device.protocol || 'Unknown'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {device.config?.battery && getBatteryIcon(device.config.battery)}
          <span className={`w-2 h-2 rounded-full ${
            device.config?.reachable ? 'bg-green-500' : 'bg-red-500'
          }`} />
        </div>
      </div>
      <div className="space-y-3">
        {/* Device State */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {device.state?.presence !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-400">Presence:</span>
              <span className="text-white">{device.state.presence ? 'Detected' : 'Clear'}</span>
            </div>
          )}
          {device.state?.temperature !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-400">Temperature:</span>
              <span className="text-white">{(device.state.temperature / 100).toFixed(1)}°C</span>
            </div>
          )}
          {device.state?.lightlevel !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-400">Light Level:</span>
              <span className="text-white">{device.state.lightlevel} lux</span>
            </div>
          )}
          {device.state?.buttonevent !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-400">Button:</span>
              <span className="text-white">{device.state.buttonevent}</span>
            </div>
          )}
        </div>
        
        {/* Last Update */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Last update:</span>
          <span className="text-gray-300">{formatLastUpdate(device.state?.lastupdated)}</span>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <button 
            onClick={() => onUpdate(device.id, { name: prompt('New name:', device.name) })}
            className="flex-1 px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all flex items-center justify-center gap-1 text-sm"
          >
            <Settings className="w-3 h-3" />
            Configure
          </button>
          <button 
            onClick={() => onDelete(device.id)}
            className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center gap-1 text-sm"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
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

  const protocols = [
    'wled', 'yeelight', 'tasmota', 'shelly', 'esphome', 
    'hyperion', 'tuyaapi', 'magichome', 'elgato'
  ];

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
          toast('No new devices found');
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
    <PageWrapper
      icon={<Monitor className="w-8 h-8 text-imersa-dark" />}
      title="Device Management"
      subtitle="Manage sensors and smart devices"
      actions={
        <>
          <button 
            onClick={handleScan}
            disabled={isScanning}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Scan for Devices
              </>
            )}
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-glow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Manually
          </button>
        </>
      }
    >

      {/* Protocol Filter */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-medium text-white mb-4">Filter by Protocol</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1 rounded-lg transition-all text-sm ${
              selectedProtocol === 'all' 
                ? 'bg-imersa-accent text-white' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            onClick={() => setSelectedProtocol('all')}
          >
            All Protocols
          </button>
          {protocols.map(protocol => (
            <button
              key={protocol}
              className={`px-3 py-1 rounded-lg transition-all text-sm ${
                selectedProtocol === protocol 
                  ? 'bg-imersa-accent text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
              onClick={() => setSelectedProtocol(protocol)}
            >
              {protocol}
            </button>
          ))}
        </div>
      </div>

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
        <div className="glass-card p-12 text-center">
          <Wifi className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium text-white">No devices found</p>
          <p className="text-gray-400 mt-1">
            Click "Scan for Devices" to discover new devices
          </p>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Add Device Manually</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Device Name</label>
                <input
                  className="w-full mt-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                  value={manualDevice.name}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Living Room Sensor"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Protocol</label>
                <select 
                  className="w-full mt-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  value={manualDevice.protocol}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, protocol: e.target.value }))}
                >
                  {protocols.map(protocol => (
                    <option key={protocol} value={protocol} className="bg-imersa-midnight">
                      {protocol}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">IP Address</label>
                <input
                  className="w-full mt-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                  value={manualDevice.ip}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, ip: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">MAC Address (optional)</label>
                <input
                  className="w-full mt-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                  value={manualDevice.mac}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, mac: e.target.value }))}
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Model (optional)</label>
                <input
                  className="w-full mt-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                  value={manualDevice.model}
                  onChange={(e) => setManualDevice(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="Device model"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setManualDevice({ name: '', protocol: 'native', ip: '', mac: '', model: '' });
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
                <button onClick={handleAddDevice} className="btn-glow">
                  Add Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
};

export default DevicesComplete;