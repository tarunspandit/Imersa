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
  keepalive_interval: number;
  static_ips: string[];
  use_waveforms: boolean;
  waveform_type: 'sine' | 'triangle' | 'saw' | 'half_sine' | 'pulse';
  waveform_period_ms: number;
  waveform_cycles: number;
  waveform_skew: number; // 0..1
  waveform_transient: boolean;
};

const defaultSettings: LifxSettings = {
  enabled: true,
  max_fps: 30,
  smoothing_enabled: false,
  smoothing_ms: 50,
  keepalive_interval: 45,
  static_ips: [],
  use_waveforms: true,
  waveform_type: 'sine',
  waveform_period_ms: 80,
  waveform_cycles: 1.0,
  waveform_skew: 0.5,
  waveform_transient: false
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
                <div className="font-medium">Use Waveforms</div>
                <div className="text-xs text-muted-foreground">Device-native smooth transitions (less traffic)</div>
              </div>
              <Switch checked={settings.use_waveforms} onCheckedChange={(v) => setSettings({ ...settings, use_waveforms: !!v })} />
            </div>

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

            {settings.use_waveforms && (
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Waveform Type</label>
                  <select
                    value={settings.waveform_type}
                    onChange={(e) => setSettings({ ...settings, waveform_type: e.target.value as LifxSettings['waveform_type'] })}
                    className="w-full border rounded px-2 py-1"
                  >
                    <option value="sine">Sine</option>
                    <option value="triangle">Triangle</option>
                    <option value="half_sine">Half Sine</option>
                    <option value="saw">Saw</option>
                    <option value="pulse">Pulse</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Waveform Period (ms)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={20}
                      max={400}
                      step={10}
                      value={settings.waveform_period_ms}
                      onChange={(e) => setSettings({ ...settings, waveform_period_ms: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <div className="w-16 text-center font-mono text-sm">{settings.waveform_period_ms}ms</div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Waveform Skew</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={settings.waveform_skew}
                      onChange={(e) => setSettings({ ...settings, waveform_skew: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <div className="w-16 text-center font-mono text-sm">{settings.waveform_skew.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Transient</div>
                    <div className="text-xs text-muted-foreground">Return to original color after cycle</div>
                  </div>
                  <Switch checked={settings.waveform_transient} onCheckedChange={(v) => setSettings({ ...settings, waveform_transient: !!v })} />
                </div>
              </div>
            )}

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

            <div className="space-y-3 pt-2 border-t">
              <label className="text-sm font-medium mb-2 block">Keep-Alive Interval</label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min={10} 
                    max={120} 
                    step={5}
                    value={settings.keepalive_interval}
                    onChange={(e) => setSettings({ ...settings, keepalive_interval: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <div className="w-16 text-center font-mono text-sm">
                    {settings.keepalive_interval}s
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Prevents bulbs from timing out. Lower = more network traffic, Higher = may timeout
                </div>
              </div>
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
