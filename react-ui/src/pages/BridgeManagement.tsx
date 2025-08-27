import React, { useState, useEffect } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import '@/styles/design-system.css';
import bridgeService, { BridgeConfig, SystemInfo } from '@/services/bridgeApi';
import { 
  Save, Download, Upload, RefreshCw, Shield, Network, 
  Clock, Database, AlertTriangle, CheckCircle, Loader2,
  FileDown, FileUp, Trash2, Settings, Info, Bug, Link
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
  const [linkButtonTimer, setLinkButtonTimer] = useState(0);
  
  const clientTimezone = dayjs.tz.guess();

  useEffect(() => {
    fetchConfig();
    fetchSystemInfo();
    fetchTimezones();
  }, []);

  useEffect(() => {
    if (linkButtonTimer > 0) {
      const timer = setTimeout(() => {
        setLinkButtonTimer(linkButtonTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (linkButtonTimer === 0 && config.linkbutton) {
      // Auto-disable link button after timer expires
      handleConfigChange('linkbutton', false);
    }
  }, [linkButtonTimer, config.linkbutton]);

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

  const handleLinkButton = async () => {
    try {
      handleConfigChange('linkbutton', true);
      setLinkButtonTimer(30); // 30 second timer
      toast.success('Link button activated for 30 seconds');
      // Save the config immediately
      await bridgeService.updateConfig({ ...config, linkbutton: true });
    } catch (error) {
      toast.error('Failed to activate link button');
    }
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
      setTimeout(() => window.location.reload(), 5000);
    } catch (error) {
      toast.error('Failed to restart bridge');
    }
  };

  const handleReset = async () => {
    if (!confirm('WARNING: This will reset ALL settings and lights. Are you sure?')) return;
    if (!confirm('This action cannot be undone. Continue?')) return;
    
    try {
      await bridgeService.resetConfig();
      toast.success('Bridge reset successfully');
      setTimeout(() => window.location.reload(), 3000);
    } catch (error) {
      toast.error('Failed to reset bridge');
    }
  };

  if (isLoading) {
    return (
      <PageWrapper
        icon={<Settings className="w-8 h-8 text-imersa-dark" />}
        title="Bridge Management"
        subtitle="Loading bridge configuration..."
      >
        <div className="glass-card p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-imersa-accent" />
          <p className="text-gray-400 mt-2">Loading configuration...</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      icon={<Settings className="w-8 h-8 text-imersa-dark" />}
      title="Bridge Management"
      subtitle="Configure and manage your Imersa bridge"
      actions={
        hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-glow flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        )
      }
    >
      {/* Link Button Alert */}
      {linkButtonTimer > 0 && (
        <div className="glass-card p-4 border-green-500/20 bg-green-500/10 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Link className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-green-400">Link Button Active</h3>
                <p className="text-green-300 text-sm">
                  Press the sync button on your app now
                </p>
              </div>
            </div>
            <div className="text-center">
              <span className="text-3xl font-mono text-green-400">{linkButtonTimer}s</span>
              <p className="text-xs text-gray-400">remaining</p>
            </div>
          </div>
        </div>
      )}

      {/* System Info */}
      {systemInfo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Version</p>
                <p className="font-semibold text-white">{systemInfo.version}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Lights</p>
                <p className="font-semibold text-white">{systemInfo.lights_count || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Users</p>
                <p className="font-semibold text-white">{systemInfo.whitelist_count || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Uptime</p>
                <p className="font-semibold text-white">
                  {systemInfo.uptime ? `${Math.floor(systemInfo.uptime / 3600)}h` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Basic Settings */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Basic Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1 block">Bridge Name</label>
            <input
              className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
              value={config.name || ''}
              onChange={(e) => handleConfigChange('name', e.target.value)}
              placeholder="My Imersa Bridge"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Timezone</label>
              <select
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                value={config.timezone || clientTimezone}
                onChange={(e) => handleConfigChange('timezone', e.target.value)}
              >
                <option value={clientTimezone} className="bg-imersa-midnight">
                  {clientTimezone} (Current)
                </option>
                {timezones.map(tz => (
                  <option key={tz} value={tz} className="bg-imersa-midnight">{tz}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Port</label>
              <input
                type="number"
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                value={config.port || 80}
                onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                min="1"
                max="65535"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Security & Discovery</h2>
        <div className="space-y-4">
          {/* Link Button */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <div className="font-medium text-white">Link Button</div>
              <div className="text-sm text-gray-400">
                Allow new applications to connect for 30 seconds
              </div>
            </div>
            <button
              onClick={handleLinkButton}
              disabled={linkButtonTimer > 0}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                linkButtonTimer > 0
                  ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                  : 'bg-imersa-accent text-white hover:bg-imersa-accent/80'
              }`}
            >
              <Link className="w-4 h-4" />
              {linkButtonTimer > 0 ? `Active (${linkButtonTimer}s)` : 'Activate'}
            </button>
          </div>

          {/* Discovery Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <div className="font-medium text-white">Bridge Discovery</div>
              <div className="text-sm text-gray-400">
                Allow devices to discover this bridge
              </div>
            </div>
            <button
              onClick={() => handleConfigChange('discovery', !config.discovery)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.discovery !== false ? 'bg-imersa-accent' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.discovery !== false ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* UPnP Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <div className="font-medium text-white">UPnP</div>
              <div className="text-sm text-gray-400">
                Universal Plug and Play for automatic discovery
              </div>
            </div>
            <button
              onClick={() => handleConfigChange('upnp', !config.upnp)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.upnp ? 'bg-imersa-accent' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.upnp ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Bridge Information */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Bridge Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Bridge ID</label>
            <p className="font-mono text-sm text-white">{config.bridgeid || 'Not configured'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">MAC Address</label>
            <p className="font-mono text-sm text-white">{config.mac || 'Not configured'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">IP Address</label>
            <p className="font-mono text-sm text-white">{config.ipaddress || 'Not configured'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Gateway</label>
            <p className="font-mono text-sm text-white">{config.gateway || 'Not configured'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Netmask</label>
            <p className="font-mono text-sm text-white">{config.netmask || 'Not configured'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">API Version</label>
            <p className="font-mono text-sm text-white">{config.apiversion || '1.24.0'}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={handleSaveConfig}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-3 text-white"
          >
            <Save className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Save Config</div>
              <div className="text-xs text-gray-400">Write to disk</div>
            </div>
          </button>
          
          <button
            onClick={handleBackupConfig}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-3 text-white"
          >
            <Database className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Backup</div>
              <div className="text-xs text-gray-400">Create backup</div>
            </div>
          </button>
          
          <button
            onClick={handleDownloadConfig}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-3 text-white"
          >
            <Download className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Download Config</div>
              <div className="text-xs text-gray-400">Export as file</div>
            </div>
          </button>
          
          <button
            onClick={handleDownloadDebug}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-3 text-white"
          >
            <Bug className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Debug Package</div>
              <div className="text-xs text-gray-400">Download debug info</div>
            </div>
          </button>
          
          <button
            onClick={handleDownloadLog}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-3 text-white"
          >
            <FileDown className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Download Log</div>
              <div className="text-xs text-gray-400">Get log file</div>
            </div>
          </button>
          
          <button
            onClick={handleRestart}
            className="px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-lg transition-all flex items-center gap-3 text-yellow-400"
          >
            <RefreshCw className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Restart Bridge</div>
              <div className="text-xs text-yellow-300">Restart service</div>
            </div>
          </button>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 pt-8 border-t border-red-500/20">
          <h3 className="text-red-400 font-semibold mb-4">Danger Zone</h3>
          <button
            onClick={handleReset}
            className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all flex items-center gap-3 text-red-400"
          >
            <AlertTriangle className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Factory Reset</div>
              <div className="text-xs text-red-300">Reset all settings and lights</div>
            </div>
          </button>
        </div>
      </div>
    </PageWrapper>
  );
};

export default BridgeManagement;