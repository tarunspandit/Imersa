import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import authService from '@/services/authApi';
import { toast } from 'react-hot-toast';
import { Lightbulb, Loader2, Save, Plus, RefreshCw, Settings } from 'lucide-react';

type LifxSettings = {
  enabled: boolean;
  max_fps: number;
  smoothing_enabled: boolean;
  smoothing_ms: number;
  static_ips: string[];
};

const defaultSettings: LifxSettings = {
  enabled: true,
  max_fps: 30,
  smoothing_enabled: false,
  smoothing_ms: 50,
  static_ips: []
};

const LifxIntegration: React.FC = () => {
  const [settings, setSettings] = useState<LifxSettings>(defaultSettings);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [manualIp, setManualIp] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [newStaticIp, setNewStaticIp] = useState<string>('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/lifx-settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...defaultSettings, ...(data?.settings || {}) });
      }
    } catch (e) {
      // ignore and keep defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/lifx-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success('LIFX settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscover = async () => {
    try {
      // Trigger a general scan which now includes LIFX when enabled
      const apiKey = await authService.getApiKey();
      await fetch(`/api/${apiKey}/lights`, { method: 'POST', body: '' });
      toast.success('Discovery started');
    } catch (e) {
      toast.error('Failed to start discovery');
    }
  };

  const handleManualAdd = async () => {
    if (!manualIp) {
      toast.error('Enter device IP');
      return;
    }
    setAdding(true);
    try {
      const result = await discoveryService.addDevice({
        name: manualName || `LIFX ${manualIp}`,
        protocol: 'lifx',
        ip: manualIp,
        config: { lightName: manualName || `LIFX ${manualIp}` }
      });
      if (result?.success?.id) {
        toast.success('Device added');
        setManualIp('');
        setManualName('');
      } else {
        toast.error('Add failed');
      }
    } catch (e) {
      toast.error('Add failed');
    } finally {
      setAdding(false);
    }
  };

  const addStaticIp = () => {
    const ip = newStaticIp.trim();
    if (!ip) return;
    if (settings.static_ips.includes(ip)) return;
    setSettings({ ...settings, static_ips: [...settings.static_ips, ip] });
    setNewStaticIp('');
  };

  const removeStaticIp = (ip: string) => {
    setSettings({ ...settings, static_ips: settings.static_ips.filter(s => s !== ip) });
  };

  return (
    <div className="p-6 space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Lightbulb className="w-7 h-7" />
        <div>
          <h1 className="text-2xl font-semibold">LIFX Integration</h1>
          <p className="text-muted-foreground">Realtime LIFX LAN bulbs with high-FPS entertainment</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" /> Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Enabled</div>
                <div className="text-xs text-muted-foreground">Include LIFX in discovery and entertainment</div>
              </div>
              <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: !!v })} />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Entertainment FPS Limit</label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min={10} 
                    max={60} 
                    value={settings.max_fps}
                    onChange={(e) => setSettings({ ...settings, max_fps: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <div className="w-16 text-center font-mono text-sm">
                    {settings.max_fps} FPS
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Lower values reduce network load. LIFX handles ~20 msgs/sec optimally.
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Anti-Flicker Smoothing</div>
                  <div className="text-xs text-muted-foreground">
                    Prevents rapid color oscillations without adding delay
                  </div>
                </div>
                <Switch 
                  checked={settings.smoothing_enabled} 
                  onCheckedChange={(v) => setSettings({ ...settings, smoothing_enabled: !!v })} 
                />
              </div>
              
              {settings.smoothing_enabled && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Smoothing Window</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min={10} 
                        max={200} 
                        step={10}
                        value={settings.smoothing_ms}
                        onChange={(e) => setSettings({ ...settings, smoothing_ms: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <div className="w-16 text-center font-mono text-sm">
                        {settings.smoothing_ms}ms
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Time window for color averaging. Lower = more reactive, Higher = smoother
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Static IPs</label>
              <div className="flex gap-2">
                <Input placeholder="192.168.1.182" value={newStaticIp} onChange={(e) => setNewStaticIp(e.target.value)} />
                <Button onClick={addStaticIp}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
              {settings.static_ips.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {settings.static_ips.map(ip => (
                    <div key={ip} className="px-2 py-1 bg-muted rounded text-sm flex items-center gap-2">
                      <span>{ip}</span>
                      <button className="text-red-500" onClick={() => removeStaticIp(ip)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={saveSettings} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Add</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">IP Address</label>
              <Input placeholder="192.168.1.182" value={manualIp} onChange={(e) => setManualIp(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Name (optional)</label>
              <Input placeholder="LIFX Bulb" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            </div>
            <Button onClick={handleManualAdd} disabled={adding} className="w-full">
              {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Device
            </Button>

            <div className="pt-2">
              <Button variant="outline" onClick={handleDiscover} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" /> Start Discovery
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LifxIntegration;
