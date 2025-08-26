import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Slider } from '../components/ui/Slider';
import { Switch } from '../components/ui/Switch';
import { useYeelight } from '../hooks/useYeelight';
import { Lightbulb, Mic, Music, Settings, RefreshCw, Volume2, BarChart3, Waves, Zap } from 'lucide-react';

const YeelightPage: React.FC = () => {
  const {
    devices,
    selectedDevice,
    musicSettings,
    audioAnalysis,
    isConnected,
    isLoading,
    error,
    connectDevice,
    selectDevice,
    updateMusicSettings,
    toggleMusicMode,
    setColor,
    setBrightness,
    testConnection
  } = useYeelight();

  const [activeTab, setActiveTab] = useState<'devices' | 'music' | 'visualization'>('devices');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Yeelight Control</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage Yeelight devices and music synchronization
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={testConnection} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Test Connection
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Zap className="w-5 h-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {[
          { id: 'devices', label: 'Devices', icon: Lightbulb },
          { id: 'music', label: 'Music Mode', icon: Music },
          { id: 'visualization', label: 'Visualization', icon: BarChart3 }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Devices</CardTitle>
              <CardDescription>
                Yeelight devices on your network
              </CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8">
                  <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No Yeelight devices found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Make sure your devices are on the same network
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {devices.map((device) => (
                    <YeelightDeviceCard
                      key={device.id}
                      device={device}
                      isSelected={selectedDevice?.id === device.id}
                      onSelect={() => selectDevice(device.id)}
                      onConnect={() => connectDevice(device.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedDevice && (
            <Card>
              <CardHeader>
                <CardTitle>Device Control</CardTitle>
                <CardDescription>
                  Control {selectedDevice.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Power</span>
                    <Switch
                      checked={selectedDevice.isOn}
                      onCheckedChange={(checked) => {
                        // Toggle device power
                        setBrightness(checked ? selectedDevice.brightness : 0);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brightness</label>
                    <Slider
                      value={[selectedDevice.brightness]}
                      onValueChange={([value]) => setBrightness(value)}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-sm text-gray-500 text-right">{selectedDevice.brightness}%</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Hue</label>
                      <Slider
                        value={[selectedDevice.color.hue]}
                        onValueChange={([value]) => setColor({ ...selectedDevice.color, hue: value })}
                        max={360}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Saturation</label>
                      <Slider
                        value={[selectedDevice.color.saturation]}
                        onValueChange={([value]) => setColor({ ...selectedDevice.color, saturation: value })}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Color Temperature</label>
                    <Slider
                      value={[selectedDevice.colorTemperature]}
                      onValueChange={([value]) => {
                        // Update color temperature
                      }}
                      min={1700}
                      max={6500}
                      step={100}
                    />
                    <div className="text-sm text-gray-500 text-right">{selectedDevice.colorTemperature}K</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Music Mode Tab */}
      {activeTab === 'music' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Music Mode Settings</CardTitle>
              <CardDescription>
                Configure audio-reactive lighting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Enable Music Mode</h4>
                    <p className="text-sm text-gray-500">Sync lights with audio</p>
                  </div>
                  <Switch
                    checked={musicSettings.enabled}
                    onCheckedChange={() => toggleMusicMode()}
                  />
                </div>

                {musicSettings.enabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Host IP</label>
                        <Input
                          value={musicSettings.hostIp}
                          onChange={(e) => updateMusicSettings({ hostIp: e.target.value })}
                          placeholder="192.168.1.100"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Port</label>
                        <Input
                          type="number"
                          value={musicSettings.port}
                          onChange={(e) => updateMusicSettings({ port: parseInt(e.target.value) })}
                          placeholder="55443"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Performance Tuning</h4>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Max FPS: {musicSettings.maxFps}</label>
                        <Slider
                          value={[musicSettings.maxFps]}
                          onValueChange={([value]) => updateMusicSettings({ maxFps: value })}
                          min={10}
                          max={120}
                          step={5}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Smoothing (ms): {musicSettings.smoothMs}</label>
                        <Slider
                          value={[musicSettings.smoothMs]}
                          onValueChange={([value]) => updateMusicSettings({ smoothMs: value })}
                          min={0}
                          max={500}
                          step={10}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Color Tolerance: {musicSettings.cieTolerance}</label>
                        <Slider
                          value={[musicSettings.cieTolerance]}
                          onValueChange={([value]) => updateMusicSettings({ cieTolerance: value })}
                          min={0.01}
                          max={0.1}
                          step={0.01}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Brightness Tolerance: {musicSettings.briTolerance}</label>
                        <Slider
                          value={[musicSettings.briTolerance]}
                          onValueChange={([value]) => updateMusicSettings({ briTolerance: value })}
                          min={1}
                          max={50}
                          step={1}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visualization Tab */}
      {activeTab === 'visualization' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audio Visualization</CardTitle>
              <CardDescription>
                Real-time audio analysis and visualization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {musicSettings.enabled ? (
                <div className="space-y-4">
                  <AudioSpectrum audioData={audioAnalysis} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Volume</div>
                      <div className="text-2xl font-bold text-green-600">{audioAnalysis.volume}%</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Beat Detected</div>
                      <div className={`text-2xl font-bold ${audioAnalysis.beatDetected ? 'text-red-600' : 'text-gray-400'}`}>
                        {audioAnalysis.beatDetected ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Dominant Freq</div>
                      <div className="text-2xl font-bold text-blue-600">{audioAnalysis.dominantFrequency}Hz</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Volume2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Enable Music Mode to see visualization</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Device Card Component
const YeelightDeviceCard: React.FC<{
  device: any;
  isSelected: boolean;
  onSelect: () => void;
  onConnect: () => void;
}> = ({ device, isSelected, onSelect, onConnect }) => {
  const statusColor = device.status === 'online' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                     device.status === 'offline' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-blue-500 shadow-md' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              {device.name}
            </CardTitle>
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
            <span>Model:</span>
            <span>{device.model}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Firmware:</span>
            <span>{device.firmwareVersion}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Power:</span>
            <span className={device.isOn ? 'text-green-600' : 'text-red-600'}>
              {device.isOn ? 'On' : 'Off'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Brightness:</span>
            <span>{device.brightness}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Music Mode:</span>
            <span className={device.musicMode.enabled ? 'text-green-600' : 'text-gray-600'}>
              {device.musicMode.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant={device.status === 'online' ? 'default' : 'outline'}
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onConnect();
            }}
          >
            {device.status === 'online' ? 'Connected' : 'Connect'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Audio Spectrum Component
const AudioSpectrum: React.FC<{ audioData: any }> = ({ audioData }) => {
  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <div className="flex items-end justify-center space-x-1 h-32">
        {audioData.spectrum?.map((value: number, index: number) => (
          <div
            key={index}
            className="bg-gradient-to-t from-blue-600 to-purple-600 w-2 rounded-t transition-all duration-100"
            style={{ height: `${Math.max(2, value * 100)}%` }}
          />
        )) ?? Array.from({ length: 32 }, (_, i) => (
          <div
            key={i}
            className="bg-gray-700 w-2 h-1 rounded-t"
          />
        ))}
      </div>
      <div className="mt-2 text-center text-sm text-gray-400">
        Audio Spectrum
      </div>
    </div>
  );
};

export default YeelightPage;