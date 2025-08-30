import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import apiService from '@/services/api';
import { toast } from 'react-hot-toast';
import { Lightbulb, Loader2, Save, Plus, RefreshCw, Settings } from 'lucide-react';

type LifxSettings = {
  enabled: boolean;
  max_fps: number;
  static_ips: string[];
};

const defaultSettings: LifxSettings = {
  enabled: true,
  max_fps: 120,
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
      await apiService.getApiKey();
      await fetch(`/api/${apiService.apiKey}/lights`, { method: 'POST', body: '' });
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
        config: {}
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
              <label className="text-sm font-medium">Max FPS (entertainment)</label>
              <Input type="number" min={30} max={240} value={settings.max_fps}
                onChange={(e) => setSettings({ ...settings, max_fps: Number(e.target.value || 0) })} />
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

