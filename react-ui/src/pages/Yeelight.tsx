import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Slider, Switch } from '@/components/ui';
import { useYeelight } from '@/hooks/useYeelight';
import { useAppStore } from '@/stores';
import { Lightbulb, RefreshCw, Zap } from 'lucide-react';

const Yeelight: React.FC = () => {
  const {
    devices,
    selectedDevice,
    isLoading,
    error,
    discoverDevices,
    selectDevice,
    refreshDevice,
    setPower,
    setBrightness,
    setColorTemp,
    setHsv,
    enableMusicMode,
    disableMusicMode,
    updateMusicSettings,
    getMusicModeStatus,
    testConnection,
    clearError,
  } = useYeelight();

  const { addNotification } = useAppStore();

  const musicMode = useMemo(() => {
    if (!selectedDevice) return { enabled: false } as any;
    // We don't have a direct map here; fetch current status on selection if needed
    // The hook exposes getMusicModeStatus to refresh state
    return selectedDevice.musicMode;
  }, [selectedDevice]);

  const handleTestConnection = async () => {
    if (!selectedDevice) return;
    const res = await testConnection(selectedDevice.id);
    if (res?.success) {
      addNotification({ type: 'success', title: 'Yeelight', message: `Latency ${res.latency} ms` });
    } else {
      addNotification({ type: 'error', title: 'Yeelight', message: 'Connection failed' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Yeelight</h1>
          <p className="text-muted-foreground mt-1">Manage Yeelight devices and music mode</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={discoverDevices} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Discover
          </Button>
          <Button variant="outline" onClick={() => selectedDevice && refreshDevice(selectedDevice.id)} disabled={!selectedDevice || isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh Device
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={!selectedDevice || isLoading}>
            <Zap className="h-4 w-4 mr-2" /> Test Connection
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError} className="text-red-700">
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-10">
              <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <div className="text-muted-foreground">No Yeelight devices found</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((d) => (
                <button
                  key={d.id}
                  className={`text-left border rounded p-4 hover:bg-accent transition ${selectedDevice?.id === d.id ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => selectDevice(d.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{d.name}</div>
                    <div className={`text-xs px-2 py-0.5 rounded ${d.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{d.status}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{d.ip} • {d.model}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDevice && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Device Control • {selectedDevice.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Power</span>
                <Switch
                  checked={selectedDevice.isOn}
                  onCheckedChange={(on) => setPower(selectedDevice.id, !!on)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Brightness: {selectedDevice.brightness}%</label>
                <Slider value={[selectedDevice.brightness]} min={1} max={100} step={1}
                  onValueChange={([v]) => setBrightness(selectedDevice.id, v)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Hue: {selectedDevice.hue}</label>
                  <Slider value={[selectedDevice.hue]} min={0} max={360} step={1}
                    onValueChange={([v]) => setHsv(selectedDevice.id, v, selectedDevice.saturation)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Saturation: {selectedDevice.saturation}</label>
                  <Slider value={[selectedDevice.saturation]} min={0} max={100} step={1}
                    onValueChange={([v]) => setHsv(selectedDevice.id, selectedDevice.hue, v)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Color Temperature: {selectedDevice.colorTemp}K</label>
                <Slider value={[selectedDevice.colorTemp]} min={1700} max={6500} step={100}
                  onValueChange={([v]) => setColorTemp(selectedDevice.id, v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Music Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Enable Music Mode</span>
                <Switch
                  checked={!!musicMode?.enabled}
                  onCheckedChange={async (on) => {
                    if (on) {
                      await enableMusicMode(selectedDevice.id, {
                        enabled: true,
                        required: false,
                        hostIp: selectedDevice.ip,
                        maxFps: 60,
                        smoothMs: 100,
                        cieTolerance: 0.02,
                        briTolerance: 8,
                        audioVisualization: { enabled: false, sensitivity: 50, mode: 'spectrum', colorMapping: 'frequency', smoothing: 50, peakDetection: false, bassBoost: 0 },
                      });
                    } else {
                      await disableMusicMode(selectedDevice.id);
                    }
                    await getMusicModeStatus(selectedDevice.id);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Host IP</label>
                  <Input
                    value={musicMode?.hostIp || ''}
                    onChange={(e) => updateMusicSettings(selectedDevice.id, { hostIp: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    type="number"
                    value={musicMode?.port || ''}
                    onChange={(e) => updateMusicSettings(selectedDevice.id, { port: parseInt(e.target.value) || undefined })}
                    placeholder="55443"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Yeelight;

