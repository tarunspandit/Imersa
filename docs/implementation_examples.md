# Implementation Examples for Critical Features

## 1. Authentication System Implementation

### Login Component (pages/Login.tsx)
```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { Lock, User, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(credentials.username, credentials.password);
    if (success) {
      navigate('/');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">DiyHue Bridge Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-500">{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="pl-10"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
```

### Auth Store (stores/authStore.ts)
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import authService from '@/services/authApi';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  apiKey: string | null;
  isLoading: boolean;
  error: string | null;
  
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      apiKey: null,
      isLoading: false,
      error: null,
      
      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(username, password);
          set({ 
            isAuthenticated: true,
            user: response.user,
            apiKey: response.apiKey,
            isLoading: false
          });
          return true;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false 
          });
          return false;
        }
      },
      
      logout: async () => {
        try {
          await authService.logout();
        } finally {
          set({ 
            isAuthenticated: false,
            user: null,
            apiKey: null 
          });
        }
      },
      
      checkAuth: async () => {
        const apiKey = localStorage.getItem('bridge-api-key');
        if (apiKey) {
          try {
            const isValid = await authService.validateSession();
            set({ isAuthenticated: isValid, apiKey: isValid ? apiKey : null });
          } catch {
            set({ isAuthenticated: false, apiKey: null });
          }
        }
      },
      
      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated,
        apiKey: state.apiKey 
      })
    }
  )
);
```

## 2. Device Discovery Implementation

### Device Discovery Page (pages/Devices.tsx)
```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { DiscoveryWizard } from '@/components/devices/DiscoveryWizard';
import { DeviceList } from '@/components/devices/DeviceList';
import { useDevices } from '@/hooks/useDevices';
import { Plus, Search, RefreshCw, Wifi, AlertTriangle } from 'lucide-react';

export const Devices: React.FC = () => {
  const { 
    devices, 
    isScanning, 
    discoveredDevices,
    scanForDevices,
    addDevice,
    removeDevice,
    testConnection 
  } = useDevices();
  
  const [showWizard, setShowWizard] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<string>('all');
  
  const protocols = [
    { id: 'all', name: 'All Protocols', icon: Wifi },
    { id: 'native', name: 'Native ESP', icon: '🔌' },
    { id: 'hue', name: 'Philips Hue', icon: '💡' },
    { id: 'wled', name: 'WLED', icon: '🌈' },
    { id: 'yeelight', name: 'Yeelight', icon: '💫' },
    { id: 'tradfri', name: 'IKEA Tradfri', icon: '🏠' },
    { id: 'tasmota', name: 'Tasmota', icon: '⚡' },
    { id: 'shelly', name: 'Shelly', icon: '🔧' },
    { id: 'mqtt', name: 'MQTT', icon: '📡' }
  ];
  
  const handleScan = async () => {
    await scanForDevices(selectedProtocol === 'all' ? undefined : selectedProtocol);
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Device Management</h1>
          <p className="text-muted-foreground mt-1">
            Discover and manage all your smart devices
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
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Scan Network
              </>
            )}
          </Button>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manually
          </Button>
        </div>
      </div>
      
      {/* Protocol Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Protocols</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {protocols.map(protocol => (
              <button
                key={protocol.id}
                onClick={() => setSelectedProtocol(protocol.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedProtocol === protocol.id 
                    ? 'border-primary bg-primary/10' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{protocol.icon}</div>
                <div className="text-sm font-medium">{protocol.name}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Discovered Devices */}
      {discoveredDevices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Discovered Devices ({discoveredDevices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {discoveredDevices.map(device => (
                <div 
                  key={device.id}
                  className="p-4 border rounded-lg flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {device.model} · {device.ip} · {device.protocol}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnection(device)}
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => addDevice(device)}
                    >
                      Add Device
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Connected Devices */}
      <DeviceList 
        devices={devices}
        onRemove={removeDevice}
        onTest={testConnection}
      />
      
      {/* Discovery Wizard */}
      {showWizard && (
        <DiscoveryWizard
          onClose={() => setShowWizard(false)}
          onAdd={addDevice}
        />
      )}
    </div>
  );
};
```

## 3. Rules Engine Implementation

### Rules Builder Component
```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Plus, Trash2, Clock, Sun, Thermometer, Motion } from 'lucide-react';

interface RuleBuilderProps {
  onSave: (rule: RuleConfig) => void;
  onCancel: () => void;
  initialRule?: Rule;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({ 
  onSave, 
  onCancel, 
  initialRule 
}) => {
  const [rule, setRule] = useState<RuleConfig>({
    name: initialRule?.name || '',
    conditions: initialRule?.conditions || [],
    actions: initialRule?.actions || [],
    enabled: initialRule?.enabled ?? true
  });
  
  const conditionTypes = [
    { id: 'time', label: 'Time', icon: Clock },
    { id: 'daylight', label: 'Daylight', icon: Sun },
    { id: 'temperature', label: 'Temperature', icon: Thermometer },
    { id: 'motion', label: 'Motion', icon: Motion }
  ];
  
  const addCondition = (type: string) => {
    const newCondition: Condition = {
      type,
      operator: 'equals',
      value: getDefaultValue(type),
      id: Date.now().toString()
    };
    setRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }));
  };
  
  const addAction = () => {
    const newAction: Action = {
      type: 'light',
      target: '',
      command: { on: true },
      id: Date.now().toString()
    };
    setRule(prev => ({
      ...prev,
      actions: [...prev.actions, newAction]
    }));
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rule Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Rule Name</label>
            <Input
              value={rule.name}
              onChange={(e) => setRule(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Turn on lights at sunset"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              onCheckedChange={(enabled) => setRule(prev => ({ ...prev, enabled }))}
            />
            <label className="text-sm">Enable rule</label>
          </div>
        </CardContent>
      </Card>
      
      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Conditions (IF)</span>
            <div className="flex gap-2">
              {conditionTypes.map(type => (
                <Button
                  key={type.id}
                  size="sm"
                  variant="outline"
                  onClick={() => addCondition(type.id)}
                >
                  <type.icon className="w-4 h-4 mr-1" />
                  {type.label}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rule.conditions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Add conditions to trigger this rule
            </p>
          ) : (
            <div className="space-y-3">
              {rule.conditions.map((condition, index) => (
                <ConditionRow
                  key={condition.id}
                  condition={condition}
                  onChange={(updated) => updateCondition(index, updated)}
                  onRemove={() => removeCondition(index)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Actions (THEN)</span>
            <Button size="sm" onClick={addAction}>
              <Plus className="w-4 h-4 mr-1" />
              Add Action
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rule.actions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Add actions to execute when conditions are met
            </p>
          ) : (
            <div className="space-y-3">
              {rule.actions.map((action, index) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  onChange={(updated) => updateAction(index, updated)}
                  onRemove={() => removeAction(index)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={() => onSave(rule)}
          disabled={!rule.name || rule.conditions.length === 0 || rule.actions.length === 0}
        >
          Save Rule
        </Button>
      </div>
    </div>
  );
};
```

## 4. Settings Page Implementation

### Complete Settings Page
```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { 
  Save, Download, Upload, RefreshCw, Shield, Network, 
  Clock, Database, AlertTriangle, CheckCircle 
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { 
    config, 
    isLoading, 
    saveConfig, 
    exportConfig, 
    importConfig, 
    resetConfig,
    restartBridge 
  } = useConfig();
  
  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);
  
  useEffect(() => {
    setHasChanges(JSON.stringify(localConfig) !== JSON.stringify(config));
  }, [localConfig, config]);
  
  const handleSave = async () => {
    await saveConfig(localConfig);
    setHasChanges(false);
  };
  
  const handleExport = async () => {
    const blob = await exportConfig();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diyhue-config-${new Date().toISOString()}.json`;
    a.click();
  };
  
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await importConfig(file);
    }
  };
  
  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'network', label: 'Network', icon: Network },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'system', label: 'System', icon: Database },
    { id: 'backup', label: 'Backup', icon: Download }
  ];
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your DiyHue bridge
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-yellow-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Unsaved changes
            </span>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4 inline mr-2" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* General Settings */}
      {activeTab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Bridge Name</label>
              <Input
                value={localConfig.name}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="DiyHue Bridge"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <select 
                className="w-full p-2 border rounded-lg"
                value={localConfig.timezone}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, timezone: e.target.value }))}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                {/* Add more timezones */}
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Portal Services</div>
                <div className="text-sm text-muted-foreground">
                  Enable remote access via Philips Hue portal
                </div>
              </div>
              <Switch
                checked={localConfig.portalservices}
                onCheckedChange={(checked) => 
                  setLocalConfig(prev => ({ ...prev, portalservices: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Link Button</div>
                <div className="text-sm text-muted-foreground">
                  Allow new apps to connect
                </div>
              </div>
              <Switch
                checked={localConfig.linkbutton}
                onCheckedChange={(checked) => 
                  setLocalConfig(prev => ({ ...prev, linkbutton: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Network Settings */}
      {activeTab === 'network' && (
        <Card>
          <CardHeader>
            <CardTitle>Network Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">IP Address</label>
                <Input
                  value={localConfig.ipaddress}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, ipaddress: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Netmask</label>
                <Input
                  value={localConfig.netmask}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, netmask: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Gateway</label>
                <Input
                  value={localConfig.gateway}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, gateway: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Proxy Port</label>
                <Input
                  type="number"
                  value={localConfig.proxyport}
                  onChange={(e) => setLocalConfig(prev => ({ 
                    ...prev, 
                    proxyport: parseInt(e.target.value) 
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Security Settings */}
      {activeTab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-3">SSL Certificates</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Certificate
                </Button>
                <Button variant="outline" className="w-full text-red-600">
                  Remove Certificate
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3">API Access</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium">Home Assistant</div>
                    <div className="text-muted-foreground">Last access: 2 minutes ago</div>
                  </div>
                  <Button size="sm" variant="destructive">Revoke</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* System Settings */}
      {activeTab === 'system' && (
        <Card>
          <CardHeader>
            <CardTitle>System Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Version</div>
                <div className="text-xl font-semibold">{localConfig.swversion}</div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">API Version</div>
                <div className="text-xl font-semibold">{localConfig.apiversion}</div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={restartBridge}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart Bridge
              </Button>
              
              <Button 
                variant="destructive" 
                onClick={resetConfig}
                className="flex-1"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Backup Settings */}
      {activeTab === 'backup' && (
        <Card>
          <CardHeader>
            <CardTitle>Backup & Restore</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border-2 border-dashed rounded-lg text-center">
              <Download className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Export Configuration</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Download a backup of all settings and devices
              </p>
              <Button onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export Config
              </Button>
            </div>
            
            <div className="p-4 border-2 border-dashed rounded-lg text-center">
              <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Import Configuration</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Restore from a previous backup
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file">
                <Button as="span">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Config
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

## 5. Real-time Updates Implementation

### WebSocket Service
```typescript
// services/realtimeApi.ts
class RealtimeService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const apiKey = localStorage.getItem('bridge-api-key');
      if (!apiKey) {
        reject(new Error('No API key found'));
        return;
      }
      
      const wsUrl = `ws://${window.location.hostname}/api/events?key=${apiKey}`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.handleReconnect();
      };
    });
  }
  
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('connection:failed', {});
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }
  
  private handleMessage(data: any) {
    const { type, id, state } = data;
    
    // Emit specific event
    this.emit(`${type}:${id}`, state);
    
    // Emit general event for type
    this.emit(type, { id, state });
    
    // Emit global event
    this.emit('state:changed', data);
  }
  
  subscribe(event: string, callback: EventCallback): Unsubscribe {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(callback);
    
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }
  
  emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
  
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.eventListeners.clear();
    this.reconnectAttempts = 0;
  }
}

export default new RealtimeService();
```

### Hook for Real-time Updates
```typescript
// hooks/useRealtime.ts
import { useEffect, useRef } from 'react';
import realtimeService from '@/services/realtimeApi';

export function useRealtime(
  event: string,
  callback: (data: any) => void,
  deps: any[] = []
) {
  const callbackRef = useRef(callback);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe(event, (data) => {
      callbackRef.current(data);
    });
    
    return unsubscribe;
  }, [event, ...deps]);
}

// Usage example in a component
export function LightCard({ light }) {
  const [localLight, setLocalLight] = useState(light);
  
  // Subscribe to real-time updates for this specific light
  useRealtime(`light:${light.id}`, (state) => {
    setLocalLight(prev => ({ ...prev, state }));
  }, [light.id]);
  
  return (
    <div className={`light-card ${localLight.state.on ? 'on' : 'off'}`}>
      {/* Light UI */}
    </div>
  );
}
```

## Next Steps

1. **Phase 1 - Core Infrastructure**
   - Implement authentication system
   - Set up protected routes
   - Create API client with interceptors

2. **Phase 2 - Device Management**  
   - Build device discovery UI
   - Implement protocol handlers
   - Add device configuration forms

3. **Phase 3 - Rules & Automation**
   - Create visual rule builder
   - Implement condition/action components
   - Add rule testing capabilities

4. **Phase 4 - System Settings**
   - Complete settings page
   - Add backup/restore functionality
   - Implement system controls

5. **Phase 5 - Real-time Updates**
   - Set up WebSocket connection
   - Implement state synchronization
   - Add optimistic updates

6. **Phase 6 - Testing**
   - Write unit tests for services
   - Add integration tests
   - Implement E2E test suite