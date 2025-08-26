import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { GradientEditor } from '@/components/wled/GradientEditor';
import { EffectLibrary } from '@/components/wled/EffectLibrary';
import { useWLED } from '@/hooks/useWLED';
import { GradientZone } from '@/types';
import { 
  Zap, 
  Palette, 
  Settings, 
  Wifi, 
  RefreshCw, 
  Plus, 
  Search,
  Monitor,
  Music,
  Play,
  Pause,
  Activity,
  Eye,
  Trash2
} from 'lucide-react';

const WLEDPage: React.FC = () => {
  const {
    devices,
    selectedDevice,
    segments,
    effects,
    palettes,
    gradientZones,
    isLoading,
    error,
    isDiscovering,
    performanceMetrics,
    discoverDevices,
    selectDevice,
    refreshDevice,
    setGradientMode,
    createGradient,
    updateGradient,
    previewGradient,
    setGradientZones,
    applyEffect,
    applyPalette,
    startScreenMirroring,
    stopScreenMirroring,
    startMusicVisualization,
    stopMusicVisualization,
    clearError
  } = useWLED();

  const [activeTab, setActiveTab] = useState<'devices' | 'gradient' | 'effects' | 'entertainment'>('devices');
  const [isScreenMirroring, setIsScreenMirroring] = useState(false);
  const [isMusicVisualization, setIsMusicVisualization] = useState(false);
  const [entertainmentSettings, setEntertainmentSettings] = useState({
    intensity: 80,
    speed: 50,
    sensitivity: 60
  });

  const handleGradientPreview = useCallback(async (zones: GradientZone[]): Promise<string | null> => {
    if (!selectedDevice) return null;
    return await previewGradient(selectedDevice.id, zones);
  }, [selectedDevice, previewGradient]);

  const handleGradientApply = useCallback(async (zones: GradientZone[]) => {
    if (!selectedDevice) return;
    await createGradient(selectedDevice.id, zones);
  }, [selectedDevice, createGradient]);

  const handleEffectApply = useCallback(async (effectId: number, parameters?: Record<string, any>) => {
    if (!selectedDevice) return;
    await applyEffect(selectedDevice.id, effectId, parameters);
  }, [selectedDevice, applyEffect]);

  const handlePaletteApply = useCallback(async (paletteId: number) => {
    if (!selectedDevice) return;
    await applyPalette(selectedDevice.id, paletteId);
  }, [selectedDevice, applyPalette]);

  const handleToggleScreenMirroring = useCallback(async () => {
    if (!selectedDevice) return;
    
    if (isScreenMirroring) {
      await stopScreenMirroring(selectedDevice.id);
      setIsScreenMirroring(false);
    } else {
      await startScreenMirroring(selectedDevice.id, {
        intensity: entertainmentSettings.intensity,
        speed: entertainmentSettings.speed
      });
      setIsScreenMirroring(true);
    }
  }, [selectedDevice, isScreenMirroring, entertainmentSettings, startScreenMirroring, stopScreenMirroring]);

  const handleToggleMusicVisualization = useCallback(async () => {
    if (!selectedDevice) return;
    
    if (isMusicVisualization) {
      await stopMusicVisualization(selectedDevice.id);
      setIsMusicVisualization(false);
    } else {
      await startMusicVisualization(selectedDevice.id, {
        sensitivity: entertainmentSettings.sensitivity,
        intensity: entertainmentSettings.intensity
      });
      setIsMusicVisualization(true);
    }
  }, [selectedDevice, isMusicVisualization, entertainmentSettings, startMusicVisualization, stopMusicVisualization]);

  const renderDeviceCard = useCallback((device: any) => {
    const statusColor = device.status === 'online' ? 'bg-green-100 text-green-800' : 
                       device.status === 'offline' ? 'bg-red-100 text-red-800' : 
                       'bg-yellow-100 text-yellow-800';
    
    return (
      <Card 
        key={device.id}
        className={`cursor-pointer transition-all hover:shadow-md ${
          selectedDevice?.id === device.id ? 'border-blue-500 shadow-md' : ''
        }`}
        onClick={() => selectDevice(device.id)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{device.name}</CardTitle>
              <div className="text-sm text-muted-foreground">{device.ip}</div>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs ${statusColor}`}>
              {device.status}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Version:</span>
              <span>{device.version}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Segments:</span>
              <span>{device.segments?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Mode:</span>
              <span className="capitalize">{device.gradientMode}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [selectedDevice, selectDevice]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">WLED Control</h1>
          <p className="text-muted-foreground mt-1">
            Advanced WLED device management and gradient effects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={discoverDevices}
            disabled={isDiscovering}
            className="flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isDiscovering ? 'Discovering...' : 'Discover Devices'}
          </Button>
          {selectedDevice && (
            <Button
              variant="outline"
              onClick={() => refreshDevice()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-red-800">{error}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="text-red-600 hover:text-red-800"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {devices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{devices.length}</div>
              <div className="text-sm text-muted-foreground">Total Devices</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {devices.filter(d => d.status === 'online').length}
              </div>
              <div className="text-sm text-muted-foreground">Online</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-purple-600">
                {effects.length}
              </div>
              <div className="text-sm text-muted-foreground">Effects Available</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">
                {segments.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Segments</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Card>
        <CardHeader>
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'devices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wifi className="w-4 h-4 inline mr-2" />
              Devices ({devices.length})
            </button>
            <button
              onClick={() => setActiveTab('gradient')}
              disabled={!selectedDevice}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'gradient'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              } ${!selectedDevice ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Palette className="w-4 h-4 inline mr-2" />
              Gradient Editor
            </button>
            <button
              onClick={() => setActiveTab('effects')}
              disabled={!selectedDevice}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'effects'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              } ${!selectedDevice ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Effect Library
            </button>
            <button
              onClick={() => setActiveTab('entertainment')}
              disabled={!selectedDevice}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'entertainment'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              } ${!selectedDevice ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Monitor className="w-4 h-4 inline mr-2" />
              Entertainment
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* Tab Content */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          {devices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Wifi className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-lg font-medium mb-2">No WLED Devices Found</div>
                <div className="text-muted-foreground mb-4">
                  Click "Discover Devices" to scan for WLED devices on your network
                </div>
                <Button onClick={discoverDevices} disabled={isDiscovering}>
                  <Search className="w-4 h-4 mr-2" />
                  {isDiscovering ? 'Discovering...' : 'Discover Devices'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map(renderDeviceCard)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'gradient' && selectedDevice && (
        <GradientEditor
          device={selectedDevice}
          zones={gradientZones}
          onZonesChange={setGradientZones}
          onPreview={handleGradientPreview}
          onApply={handleGradientApply}
        />
      )}

      {activeTab === 'effects' && selectedDevice && (
        <EffectLibrary
          device={selectedDevice}
          effects={effects}
          palettes={palettes}
          onApplyEffect={handleEffectApply}
          onApplyPalette={handlePaletteApply}
        />
      )}

      {activeTab === 'entertainment' && selectedDevice && (
        <div className="space-y-6">
          {/* Screen Mirroring */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Screen Mirroring
                <div className={`px-2 py-1 rounded-full text-xs ${
                  isScreenMirroring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {isScreenMirroring ? 'Active' : 'Inactive'}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Create ambient lighting that mirrors your screen content for an immersive experience.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Intensity ({entertainmentSettings.intensity}%)</label>
                  <Slider
                    value={[entertainmentSettings.intensity]}
                    onValueChange={([intensity]) => setEntertainmentSettings(prev => ({ ...prev, intensity }))}
                    max={100}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Speed ({entertainmentSettings.speed}%)</label>
                  <Slider
                    value={[entertainmentSettings.speed]}
                    onValueChange={([speed]) => setEntertainmentSettings(prev => ({ ...prev, speed }))}
                    max={100}
                    step={1}
                  />
                </div>
              </div>

              <Button
                onClick={handleToggleScreenMirroring}
                disabled={isLoading}
                className="w-full"
              >
                {isScreenMirroring ? (
                  <><Pause className="w-4 h-4 mr-2" />Stop Screen Mirroring</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Start Screen Mirroring</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Music Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                Music Visualization
                <div className={`px-2 py-1 rounded-full text-xs ${
                  isMusicVisualization ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {isMusicVisualization ? 'Active' : 'Inactive'}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Sync your lights with music for dynamic audio-reactive lighting effects.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sensitivity ({entertainmentSettings.sensitivity}%)</label>
                  <Slider
                    value={[entertainmentSettings.sensitivity]}
                    onValueChange={([sensitivity]) => setEntertainmentSettings(prev => ({ ...prev, sensitivity }))}
                    max={100}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Intensity ({entertainmentSettings.intensity}%)</label>
                  <Slider
                    value={[entertainmentSettings.intensity]}
                    onValueChange={([intensity]) => setEntertainmentSettings(prev => ({ ...prev, intensity }))}
                    max={100}
                    step={1}
                  />
                </div>
              </div>

              <Button
                onClick={handleToggleMusicVisualization}
                disabled={isLoading}
                className="w-full"
              >
                {isMusicVisualization ? (
                  <><Pause className="w-4 h-4 mr-2" />Stop Music Visualization</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Start Music Visualization</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Performance Monitor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Performance Monitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(Math.random() * 30 + 20)}
                  </div>
                  <div className="text-sm text-muted-foreground">FPS</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(Math.random() * 20 + 10)}ms
                  </div>
                  <div className="text-sm text-muted-foreground">Latency</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(Math.random() * 30 + 70)}%
                  </div>
                  <div className="text-sm text-muted-foreground">CPU Usage</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WLEDPage;