import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { YeelightDevice, YeelightMusicMode, AudioVisualizationSettings } from '@/types';
import { 
  Music, 
  Volume2, 
  Settings, 
  Play, 
  Pause, 
  Mic, 
  Wifi, 
  Activity,
  Sliders,
  Eye,
  Save,
  RotateCcw,
  TestTube
} from 'lucide-react';

interface MusicSettingsProps {
  device: YeelightDevice;
  musicModeStatus: { enabled: boolean; settings?: YeelightMusicMode };
  audioVisualizationStatus: { active: boolean; settings?: AudioVisualizationSettings };
  onEnableMusicMode?: (settings: YeelightMusicMode) => Promise<void>;
  onDisableMusicMode?: () => Promise<void>;
  onUpdateMusicSettings?: (settings: Partial<YeelightMusicMode>) => Promise<void>;
  onStartAudioVisualization?: (settings: AudioVisualizationSettings) => Promise<void>;
  onStopAudioVisualization?: () => Promise<void>;
  onUpdateAudioSettings?: (settings: Partial<AudioVisualizationSettings>) => Promise<void>;
  onTestConnection?: () => Promise<{ latency: number; success: boolean } | null>;
  className?: string;
}

export const MusicSettings: React.FC<MusicSettingsProps> = ({
  device,
  musicModeStatus,
  audioVisualizationStatus,
  onEnableMusicMode,
  onDisableMusicMode,
  onUpdateMusicSettings,
  onStartAudioVisualization,
  onStopAudioVisualization,
  onUpdateAudioSettings,
  onTestConnection,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'network' | 'performance' | 'visualization'>('network');
  const [localMusicSettings, setLocalMusicSettings] = useState<YeelightMusicMode>({
    enabled: false,
    required: false,
    hostIp: '192.168.1.187',
    maxFps: 40,
    smoothMs: 60,
    cieTolerance: 0.01,
    briTolerance: 8,
    audioVisualization: {
      enabled: false,
      sensitivity: 50,
      mode: 'spectrum',
      colorMapping: 'frequency',
      smoothing: 30,
      peakDetection: true,
      bassBoost: 0,
    },
  });
  const [localAudioSettings, setLocalAudioSettings] = useState<AudioVisualizationSettings>({
    enabled: false,
    sensitivity: 50,
    mode: 'spectrum',
    colorMapping: 'frequency',
    smoothing: 30,
    peakDetection: true,
    bassBoost: 0,
  });
  const [connectionTest, setConnectionTest] = useState<{ latency: number; success: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [audioSpectrum, setAudioSpectrum] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize settings from props
  useEffect(() => {
    if (musicModeStatus.settings) {
      setLocalMusicSettings(prev => ({ ...prev, ...musicModeStatus.settings }));
    }
  }, [musicModeStatus.settings]);

  useEffect(() => {
    if (audioVisualizationStatus.settings) {
      setLocalAudioSettings(prev => ({ ...prev, ...audioVisualizationStatus.settings }));
    }
  }, [audioVisualizationStatus.settings]);

  // Mock audio spectrum for visualization
  useEffect(() => {
    if (audioVisualizationStatus.active && localAudioSettings.enabled) {
      const interval = setInterval(() => {
        const spectrum = Array.from({ length: 32 }, () => Math.random() * 100);
        setAudioSpectrum(spectrum);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [audioVisualizationStatus.active, localAudioSettings.enabled]);

  // Draw audio spectrum
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || audioSpectrum.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / audioSpectrum.length;
    
    audioSpectrum.forEach((value, index) => {
      const barHeight = (value / 100) * height;
      const x = index * barWidth;
      const y = height - barHeight;

      // Color based on frequency
      const hue = (index / audioSpectrum.length) * 360;
      ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }, [audioSpectrum]);

  const updateMusicSetting = useCallback(<K extends keyof YeelightMusicMode>(
    key: K,
    value: YeelightMusicMode[K]
  ) => {
    setLocalMusicSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const updateAudioSetting = useCallback(<K extends keyof AudioVisualizationSettings>(
    key: K,
    value: AudioVisualizationSettings[K]
  ) => {
    setLocalAudioSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSaveSettings = useCallback(async () => {
    if (!hasChanges) return;

    setIsLoading(true);
    try {
      if (onUpdateMusicSettings) {
        await onUpdateMusicSettings(localMusicSettings);
      }
      if (onUpdateAudioSettings) {
        await onUpdateAudioSettings(localAudioSettings);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasChanges, localMusicSettings, localAudioSettings, onUpdateMusicSettings, onUpdateAudioSettings]);

  const handleTestConnection = useCallback(async () => {
    if (!onTestConnection) return;

    setIsLoading(true);
    try {
      const result = await onTestConnection();
      setConnectionTest(result);
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionTest(null);
    } finally {
      setIsLoading(false);
    }
  }, [onTestConnection]);

  const handleToggleMusicMode = useCallback(async () => {
    setIsLoading(true);
    try {
      if (musicModeStatus.enabled) {
        if (onDisableMusicMode) {
          await onDisableMusicMode();
        }
      } else {
        if (onEnableMusicMode) {
          await onEnableMusicMode(localMusicSettings);
        }
      }
    } catch (error) {
      console.error('Failed to toggle music mode:', error);
    } finally {
      setIsLoading(false);
    }
  }, [musicModeStatus.enabled, localMusicSettings, onEnableMusicMode, onDisableMusicMode]);

  const handleToggleVisualization = useCallback(async () => {
    setIsLoading(true);
    try {
      if (audioVisualizationStatus.active) {
        if (onStopAudioVisualization) {
          await onStopAudioVisualization();
        }
      } else {
        if (onStartAudioVisualization) {
          await onStartAudioVisualization(localAudioSettings);
        }
      }
    } catch (error) {
      console.error('Failed to toggle visualization:', error);
    } finally {
      setIsLoading(false);
    }
  }, [audioVisualizationStatus.active, localAudioSettings, onStartAudioVisualization, onStopAudioVisualization]);

  const resetSettings = useCallback(() => {
    setLocalMusicSettings({
      enabled: false,
      required: false,
      hostIp: '192.168.1.187',
      maxFps: 40,
      smoothMs: 60,
      cieTolerance: 0.01,
      briTolerance: 8,
      audioVisualization: {
        enabled: false,
        sensitivity: 50,
        mode: 'spectrum',
        colorMapping: 'frequency',
        smoothing: 30,
        peakDetection: true,
        bassBoost: 0,
      },
    });
    setLocalAudioSettings({
      enabled: false,
      sensitivity: 50,
      mode: 'spectrum',
      colorMapping: 'frequency',
      smoothing: 30,
      peakDetection: true,
      bassBoost: 0,
    });
    setHasChanges(true);
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Music Mode Settings
              <div className={`px-2 py-1 rounded-full text-xs ${
                musicModeStatus.enabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {musicModeStatus.enabled ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={isLoading}
                  className="flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={resetSettings}
                className="flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <Button
                onClick={handleToggleMusicMode}
                disabled={isLoading}
                className="flex items-center gap-1"
              >
                {musicModeStatus.enabled ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Disable
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Enable
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Device: {device.name} • {device.model} • {device.ip}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('network')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'network'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wifi className="w-4 h-4 inline mr-2" />
              Network
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'performance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Performance
            </button>
            <button
              onClick={() => setActiveTab('visualization')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'visualization'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Visualization
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeTab === 'network' && (
            <div className="space-y-6">
              {/* Basic Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Network Configuration</h3>
                
                <div className="flex items-center gap-4">
                  <Switch
                    checked={localMusicSettings.required}
                    onCheckedChange={(checked) => updateMusicSetting('required', checked)}
                  />
                  <div>
                    <div className="font-medium">Require Music Mode</div>
                    <div className="text-sm text-muted-foreground">
                      Abort if music mode is unavailable
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Host IP (LAN)</label>
                  <Input
                    value={localMusicSettings.hostIp}
                    onChange={(e) => updateMusicSetting('hostIp', e.target.value)}
                    placeholder="192.168.1.187"
                  />
                  <div className="text-sm text-muted-foreground">
                    Advertised to bulbs in set_music. Must be reachable by bulbs.
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Port (single)</label>
                    <Input
                      type="number"
                      min="1024"
                      max="65535"
                      value={localMusicSettings.port || ''}
                      onChange={(e) => updateMusicSetting('port', parseInt(e.target.value) || undefined)}
                      placeholder="Optional"
                    />
                    <div className="text-sm text-muted-foreground">
                      Optional. If set, use this one port for the shared server.
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Port range start</label>
                    <Input
                      type="number"
                      min="1024"
                      max="65535"
                      value={localMusicSettings.portRange?.start || ''}
                      onChange={(e) => updateMusicSetting('portRange', {
                        ...localMusicSettings.portRange,
                        start: parseInt(e.target.value) || 1024
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Port range end</label>
                    <Input
                      type="number"
                      min="1024"
                      max="65535"
                      value={localMusicSettings.portRange?.end || ''}
                      onChange={(e) => updateMusicSetting('portRange', {
                        ...localMusicSettings.portRange,
                        end: parseInt(e.target.value) || 65535
                      })}
                    />
                  </div>
                </div>

                {/* Connection Test */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Connection Test</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={isLoading}
                      className="flex items-center gap-1"
                    >
                      <TestTube className="w-4 h-4" />
                      Test Connection
                    </Button>
                  </div>
                  
                  {connectionTest && (
                    <div className={`p-3 rounded-lg border ${
                      connectionTest.success
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                      <div className="font-medium">
                        {connectionTest.success ? 'Connection Successful' : 'Connection Failed'}
                      </div>
                      {connectionTest.success && (
                        <div className="text-sm">
                          Latency: {connectionTest.latency}ms
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Performance Tuning</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Max FPS (per-bulb): {localMusicSettings.maxFps}
                    </label>
                    <Slider
                      value={[localMusicSettings.maxFps]}
                      onValueChange={([fps]) => updateMusicSetting('maxFps', fps)}
                      min={10}
                      max={60}
                      step={1}
                    />
                    <div className="text-sm text-muted-foreground">
                      Higher FPS = more responsive, but higher CPU usage
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Smooth duration: {localMusicSettings.smoothMs}ms
                    </label>
                    <Slider
                      value={[localMusicSettings.smoothMs]}
                      onValueChange={([smooth]) => updateMusicSetting('smoothMs', smooth)}
                      min={0}
                      max={300}
                      step={10}
                    />
                    <div className="text-sm text-muted-foreground">
                      Transition smoothing time
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CIE tolerance</label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      max="1"
                      value={localMusicSettings.cieTolerance}
                      onChange={(e) => updateMusicSetting('cieTolerance', parseFloat(e.target.value) || 0.01)}
                    />
                    <div className="text-sm text-muted-foreground">
                      Color accuracy threshold
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brightness tolerance</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={localMusicSettings.briTolerance}
                      onChange={(e) => updateMusicSetting('briTolerance', parseInt(e.target.value) || 8)}
                    />
                    <div className="text-sm text-muted-foreground">
                      Brightness change threshold
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="space-y-4">
                <h4 className="font-medium">Current Performance</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(Math.random() * 30 + 20)}
                    </div>
                    <div className="text-sm text-muted-foreground">Current FPS</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(Math.random() * 10 + 15)}ms
                    </div>
                    <div className="text-sm text-muted-foreground">Latency</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(Math.random() * 20 + 80)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Efficiency</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visualization' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Audio Visualization</h3>
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded-full text-xs ${
                    audioVisualizationStatus.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {audioVisualizationStatus.active ? 'Active' : 'Inactive'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleVisualization}
                    disabled={isLoading}
                  >
                    {audioVisualizationStatus.active ? 'Stop' : 'Start'}
                  </Button>
                </div>
              </div>

              {/* Audio Spectrum Visualizer */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Live Audio Spectrum</label>
                <div className="bg-black rounded-lg p-4">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={100}
                    className="w-full h-24"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Sensitivity: {localAudioSettings.sensitivity}%
                    </label>
                    <Slider
                      value={[localAudioSettings.sensitivity]}
                      onValueChange={([sensitivity]) => updateAudioSetting('sensitivity', sensitivity)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visualization Mode</label>
                    <select
                      value={localAudioSettings.mode}
                      onChange={(e) => updateAudioSetting('mode', e.target.value as any)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md"
                    >
                      <option value="spectrum">Spectrum</option>
                      <option value="volume">Volume</option>
                      <option value="beat">Beat Detection</option>
                      <option value="ambient">Ambient</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Color Mapping</label>
                    <select
                      value={localAudioSettings.colorMapping}
                      onChange={(e) => updateAudioSetting('colorMapping', e.target.value as any)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md"
                    >
                      <option value="frequency">Frequency</option>
                      <option value="amplitude">Amplitude</option>
                      <option value="rainbow">Rainbow</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Smoothing: {localAudioSettings.smoothing}%
                    </label>
                    <Slider
                      value={[localAudioSettings.smoothing]}
                      onValueChange={([smoothing]) => updateAudioSetting('smoothing', smoothing)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Bass Boost: {localAudioSettings.bassBoost}%
                    </label>
                    <Slider
                      value={[localAudioSettings.bassBoost]}
                      onValueChange={([bassBoost]) => updateAudioSetting('bassBoost', bassBoost)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <Switch
                      checked={localAudioSettings.peakDetection}
                      onCheckedChange={(checked) => updateAudioSetting('peakDetection', checked)}
                    />
                    <div>
                      <div className="font-medium">Peak Detection</div>
                      <div className="text-sm text-muted-foreground">
                        Enhanced beat detection
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MusicSettings;