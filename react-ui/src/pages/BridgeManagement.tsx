import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import bridgeService, { BridgeConfig, SystemInfo } from '@/services/bridgeApi';
import { 
  Save, Download, Upload, RefreshCw, Shield, Network, 
  Clock, Database, AlertTriangle, CheckCircle, Loader2,
  FileDown, FileUp, Trash2, Settings, Info, Bug
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const BridgeManagement: React.FC = () => {
  const [config, setConfig] = useState<Partial<BridgeConfig>>({});
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [timezones, setTimezones] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const clientTimezone = dayjs.tz.guess();

  useEffect(() => {
    fetchConfig();
    fetchSystemInfo();
    fetchTimezones();
  }, []);

  const fetchConfig = async () => {
    try {
      const fetchedConfig = await bridgeService.getConfig();
      setConfig(fetchedConfig);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch config:', error);
      toast.error('Failed to load bridge configuration');
      setIsLoading(false);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const info = await bridgeService.getSystemInfo();
      setSystemInfo(info);
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  const fetchTimezones = async () => {
    try {
      const tz = await bridgeService.getTimezones();
      setTimezones(tz);
    } catch (error) {
      console.error('Failed to fetch timezones:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await bridgeService.updateConfig(config);
      toast.success('Configuration saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfigChange = (key: keyof BridgeConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveConfig = async () => {
    try {
      await bridgeService.saveConfig(false);
      toast.success('Configuration saved to disk');
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const handleBackupConfig = async () => {
    try {
      await bridgeService.saveConfig(true);
      toast.success('Backup created successfully');
    } catch (error) {
      toast.error('Failed to create backup');
    }
  };

  const handleDownloadConfig = async () => {
    try {
      const blob = await bridgeService.downloadConfig();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diyhue-config-${dayjs().format('YYYY-MM-DD-HHmmss')}.tar`;
      a.click();
      toast.success('Configuration downloaded');
    } catch (error) {
      toast.error('Failed to download configuration');
    }
  };

  const handleDownloadDebug = async () => {
    try {
      const blob = await bridgeService.downloadDebug();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diyhue-debug-${dayjs().format('YYYY-MM-DD-HHmmss')}.tar`;
      a.click();
      toast.success('Debug package downloaded');
    } catch (error) {
      toast.error('Failed to download debug package');
    }
  };

  const handleDownloadLog = async () => {
    try {
      const blob = await bridgeService.downloadLog();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diyhue-log-${dayjs().format('YYYY-MM-DD-HHmmss')}.tar`;
      a.click();
      toast.success('Log file downloaded');
    } catch (error) {
      toast.error('Failed to download log');
    }
  };

  const handleRestart = async () => {
    if (!confirm('Are you sure you want to restart the bridge? This will NOT save the current config.')) return;
    
    try {
      await bridgeService.restart();
      toast.success('Bridge restarting...');
      
      // Wait and refresh
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      toast.error('Failed to restart bridge');
    }
  };

  const handleResetConfig = async () => {
    if (!confirm('Are you sure you want to reset the configuration to defaults? This will create a backup first.')) return;
    
    try {
      await bridgeService.resetConfig();
      toast.success('Configuration reset to defaults');
      await handleRestart();
    } catch (error) {
      toast.error('Failed to reset configuration');
    }
  };

  const handleRestoreConfig = async () => {
    if (!confirm('Are you sure you want to restore from backup? Current configuration will be lost.')) return;
    
    try {
      await bridgeService.restoreConfig();
      toast.success('Configuration restored from backup');
      await handleRestart();
    } catch (error) {
      toast.error('Failed to restore configuration');
    }
  };

  const handleRemoveCertificate = async () => {
    if (!confirm('Are you sure you want to remove the SSL certificate? This will create a backup first.')) return;
    
    try {
      await bridgeService.removeCertificate();
      toast.success('Certificate removed');
      await handleRestart();
    } catch (error) {
      toast.error('Failed to remove certificate');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bridge Management</h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage your DiyHue bridge
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-yellow-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Unsaved changes
            </span>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bridge Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Bridge Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Bridge Name</label>
              <Input
                value={config.name || ''}
                onChange={(e) => handleConfigChange('name', e.target.value)}
                placeholder="DiyHue Bridge"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Software Version (auto-updates at {config.swupdate2?.autoinstall?.updatetime})
              </label>
              <Input
                value={config.swversion || ''}
                onChange={(e) => handleConfigChange('swversion', e.target.value)}
                placeholder="1935144020"
              />
              <a 
                href="https://www.philips-hue.com/en-gb/support/release-notes/bridge" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                Check latest versions
              </a>
            </div>

            <div>
              <label className="text-sm font-medium">API Version</label>
              <Input
                value={config.apiversion || ''}
                onChange={(e) => handleConfigChange('apiversion', e.target.value)}
                placeholder="1.56.0"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Timezone (suggested: {clientTimezone})
              </label>
              <select 
                className="w-full p-2 border rounded-lg"
                value={config.timezone || ''}
                onChange={(e) => handleConfigChange('timezone', e.target.value)}
              >
                <option value="">Select timezone</option>
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Debug Logging</div>
                  <div className="text-sm text-muted-foreground">
                    Enable detailed logging (temporary)
                  </div>
                </div>
                <Switch
                  checked={config.LogLevel === 'DEBUG'}
                  onCheckedChange={(checked) => 
                    handleConfigChange('LogLevel', checked ? 'DEBUG' : 'INFO')
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Remote API</div>
                  <div className="text-sm text-muted-foreground">
                    Enable remote access to the bridge
                  </div>
                </div>
                <Switch
                  checked={config['Remote API enabled'] || false}
                  onCheckedChange={(checked) => 
                    handleConfigChange('Remote API enabled', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Discovery</div>
                  <div className="text-sm text-muted-foreground">
                    Allow bridge to be discovered on network
                  </div>
                </div>
                <Switch
                  checked={config.discovery !== false}
                  onCheckedChange={(checked) => 
                    handleConfigChange('discovery', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Link Button</div>
                  <div className="text-sm text-muted-foreground">
                    Allow new applications to connect
                  </div>
                </div>
                <Switch
                  checked={config.linkbutton || false}
                  onCheckedChange={(checked) => 
                    handleConfigChange('linkbutton', checked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Read-only Information */}
        <Card>
          <CardHeader>
            <CardTitle>Bridge Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Bridge ID</label>
                <p className="font-mono text-sm">{config.bridgeid}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">MAC Address</label>
                <p className="font-mono text-sm">{config.mac}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">IP Address</label>
                <p className="font-mono text-sm">{config.ipaddress}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Gateway</label>
                <p className="font-mono text-sm">{config.gateway}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Netmask</label>
                <p className="font-mono text-sm">{config.netmask}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Zigbee Channel</label>
                <p className="font-mono text-sm">{config.zigbeechannel}</p>
              </div>
            </div>

            {systemInfo && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">System Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DiyHue Version:</span>
                    <span className="font-mono">{systemInfo.diyhue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WebUI Version:</span>
                    <span className="font-mono">{systemInfo.webui}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Architecture:</span>
                    <span className="font-mono">{systemInfo.machine}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS:</span>
                    <span className="font-mono">{systemInfo.sysname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS Version:</span>
                    <span className="font-mono">{systemInfo.os_version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS Release:</span>
                    <span className="font-mono">{systemInfo.os_release}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bridge Control */}
        <Card>
          <CardHeader>
            <CardTitle>Bridge Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleSaveConfig}>
                <Save className="w-4 h-4 mr-2" />
                Save to Disk
              </Button>
              <Button variant="outline" onClick={handleBackupConfig}>
                <Database className="w-4 h-4 mr-2" />
                Create Backup
              </Button>
              <Button variant="outline" onClick={handleDownloadConfig}>
                <FileDown className="w-4 h-4 mr-2" />
                Download Config
              </Button>
              <Button variant="outline" onClick={() => setActiveModal('debug')}>
                <Bug className="w-4 h-4 mr-2" />
                Download Debug
              </Button>
            </div>

            {showAdvanced && (
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-medium text-red-600">Danger Zone</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="destructive" onClick={handleRestart}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Restart Bridge
                  </Button>
                  <Button variant="destructive" onClick={() => setActiveModal('reset')}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Reset Options
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backup & Restore */}
        <Card>
          <CardHeader>
            <CardTitle>Backup & Restore</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border-2 border-dashed rounded-lg text-center">
              <Download className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Export Configuration</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Download a complete backup of all settings
              </p>
              <Button onClick={handleDownloadConfig}>
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
              <p className="text-xs text-yellow-600 mb-3">
                Note: Upload functionality requires backend implementation
              </p>
              <Button disabled>
                <Upload className="w-4 h-4 mr-2" />
                Import Config
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {activeModal === 'debug' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Download Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Choose what debug information to download:</p>
              <div className="space-y-3">
                <Button className="w-full" onClick={() => {
                  handleDownloadDebug();
                  setActiveModal(null);
                }}>
                  <Bug className="w-4 h-4 mr-2" />
                  Full Debug Package
                </Button>
                <Button className="w-full" onClick={() => {
                  handleDownloadLog();
                  setActiveModal(null);
                }}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Log File Only
                </Button>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeModal === 'reset' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Reset Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                ⚠️ These actions cannot be undone. Please be careful!
              </p>
              <div className="space-y-3">
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => {
                    handleRestoreConfig();
                    setActiveModal(null);
                  }}
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Restore from Backup
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => {
                    handleResetConfig();
                    setActiveModal(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset to Defaults
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => {
                    handleRemoveCertificate();
                    setActiveModal(null);
                  }}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Remove SSL Certificate
                </Button>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BridgeManagement;