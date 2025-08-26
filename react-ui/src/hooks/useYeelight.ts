import { useState, useEffect, useCallback } from 'react';
import { YeelightDevice, YeelightMusicMode, AudioVisualizationSettings } from '@/types';
import { yeelightApi } from '@/services/yeelightApi';

export interface YeelightState {
  devices: YeelightDevice[];
  selectedDevice: YeelightDevice | null;
  musicModeStatus: { [deviceId: string]: { enabled: boolean; settings?: YeelightMusicMode } };
  audioVisualizationStatus: { [deviceId: string]: { active: boolean; settings?: AudioVisualizationSettings } };
  performanceMetrics: { [deviceId: string]: any };
  presets: { [deviceId: string]: any[] };
  isLoading: boolean;
  error: string | null;
  isDiscovering: boolean;
}

export interface YeelightActions {
  // Device Management
  discoverDevices: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  refreshDevice: (deviceId?: string) => Promise<void>;
  
  // Basic Control
  setPower: (deviceId: string, on: boolean, duration?: number) => Promise<void>;
  setBrightness: (deviceId: string, brightness: number, duration?: number) => Promise<void>;
  setColor: (deviceId: string, rgb: [number, number, number], duration?: number) => Promise<void>;
  setColorTemp: (deviceId: string, colorTemp: number, duration?: number) => Promise<void>;
  setHsv: (deviceId: string, hue: number, saturation: number, duration?: number) => Promise<void>;
  
  // Music Mode
  enableMusicMode: (deviceId: string, settings: YeelightMusicMode) => Promise<void>;
  disableMusicMode: (deviceId: string) => Promise<void>;
  updateMusicSettings: (deviceId: string, settings: Partial<YeelightMusicMode>) => Promise<void>;
  getMusicModeStatus: (deviceId: string) => Promise<void>;
  
  // Audio Visualization
  startAudioVisualization: (deviceId: string, settings: AudioVisualizationSettings) => Promise<void>;
  stopAudioVisualization: (deviceId: string) => Promise<void>;
  updateAudioSettings: (deviceId: string, settings: Partial<AudioVisualizationSettings>) => Promise<void>;
  getAudioVisualizationStatus: (deviceId: string) => Promise<void>;
  
  // Flow Effects
  startFlow: (deviceId: string, flow: any[]) => Promise<void>;
  stopFlow: (deviceId: string) => Promise<void>;
  
  // Presets
  savePreset: (deviceId: string, name: string) => Promise<void>;
  loadPreset: (deviceId: string, presetId: string) => Promise<void>;
  deletePreset: (deviceId: string, presetId: string) => Promise<void>;
  loadPresets: (deviceId: string) => Promise<void>;
  
  // Network
  testConnection: (deviceId: string) => Promise<{ latency: number; success: boolean } | null>;
  
  // Performance
  getPerformanceMetrics: (deviceId: string) => Promise<void>;
  
  // Bulk Operations
  bulkOperation: (deviceIds: string[], operation: string, parameters: any) => Promise<void>;
  syncDevices: (deviceIds: string[], masterDeviceId: string) => Promise<void>;
  stopSync: (deviceIds: string[]) => Promise<void>;
  
  // Configuration
  updateConfiguration: (deviceId: string, config: any) => Promise<void>;
  exportConfiguration: (deviceId: string) => Promise<any>;
  importConfiguration: (deviceId: string, config: any) => Promise<void>;
  
  // Utility
  clearError: () => void;
}

const initialState: YeelightState = {
  devices: [],
  selectedDevice: null,
  musicModeStatus: {},
  audioVisualizationStatus: {},
  performanceMetrics: {},
  presets: {},
  isLoading: false,
  error: null,
  isDiscovering: false,
};

export function useYeelight(): YeelightState & YeelightActions {
  const [state, setState] = useState<YeelightState>(initialState);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false, isDiscovering: false }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  // Device Management
  const discoverDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isDiscovering: true, error: null }));
    
    try {
      const response = await yeelightApi.discoverDevices();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          devices: response.data!,
          isDiscovering: false,
        }));
      } else {
        setError(response.error || 'Failed to discover devices');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Discovery failed');
    }
  }, [setError]);

  const selectDevice = useCallback(async (deviceId: string) => {
    setLoading(true);
    
    try {
      const deviceResponse = await yeelightApi.getDevice(deviceId);

      if (deviceResponse.success && deviceResponse.data) {
        setState(prev => ({
          ...prev,
          selectedDevice: deviceResponse.data!,
          isLoading: false,
        }));

        // Load additional data for selected device
        await Promise.all([
          getMusicModeStatus(deviceId),
          getAudioVisualizationStatus(deviceId),
          getPerformanceMetrics(deviceId),
          loadPresets(deviceId),
        ]);
      } else {
        setError(deviceResponse.error || 'Failed to select device');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to select device');
    }
  }, [setError, setLoading]);

  const refreshDevice = useCallback(async (deviceId?: string) => {
    const targetDeviceId = deviceId || state.selectedDevice?.id;
    if (!targetDeviceId) return;
    
    await selectDevice(targetDeviceId);
  }, [state.selectedDevice?.id, selectDevice]);

  // Basic Control
  const setPower = useCallback(async (deviceId: string, on: boolean, duration?: number) => {
    try {
      const response = await yeelightApi.setPower(deviceId, on, duration);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId ? { ...device, isOn: on } : device
          ),
          selectedDevice: prev.selectedDevice?.id === deviceId
            ? { ...prev.selectedDevice, isOn: on }
            : prev.selectedDevice,
        }));
      } else {
        setError(response.error || 'Failed to set power');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set power');
    }
  }, [setError]);

  const setBrightness = useCallback(async (deviceId: string, brightness: number, duration?: number) => {
    try {
      const response = await yeelightApi.setBrightness(deviceId, brightness, duration);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId ? { ...device, brightness } : device
          ),
          selectedDevice: prev.selectedDevice?.id === deviceId
            ? { ...prev.selectedDevice, brightness }
            : prev.selectedDevice,
        }));
      } else {
        setError(response.error || 'Failed to set brightness');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set brightness');
    }
  }, [setError]);

  const setColor = useCallback(async (deviceId: string, rgb: [number, number, number], duration?: number) => {
    try {
      const response = await yeelightApi.setColor(deviceId, rgb, duration);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId ? { ...device, rgb, colorMode: 'rgb' } : device
          ),
          selectedDevice: prev.selectedDevice?.id === deviceId
            ? { ...prev.selectedDevice, rgb, colorMode: 'rgb' }
            : prev.selectedDevice,
        }));
      } else {
        setError(response.error || 'Failed to set color');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set color');
    }
  }, [setError]);

  const setColorTemp = useCallback(async (deviceId: string, colorTemp: number, duration?: number) => {
    try {
      const response = await yeelightApi.setColorTemp(deviceId, colorTemp, duration);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId ? { ...device, colorTemp, colorMode: 'ct' } : device
          ),
          selectedDevice: prev.selectedDevice?.id === deviceId
            ? { ...prev.selectedDevice, colorTemp, colorMode: 'ct' }
            : prev.selectedDevice,
        }));
      } else {
        setError(response.error || 'Failed to set color temperature');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set color temperature');
    }
  }, [setError]);

  const setHsv = useCallback(async (deviceId: string, hue: number, saturation: number, duration?: number) => {
    try {
      const response = await yeelightApi.setHsv(deviceId, hue, saturation, duration);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId ? { ...device, hue, saturation, colorMode: 'hsv' } : device
          ),
          selectedDevice: prev.selectedDevice?.id === deviceId
            ? { ...prev.selectedDevice, hue, saturation, colorMode: 'hsv' }
            : prev.selectedDevice,
        }));
      } else {
        setError(response.error || 'Failed to set HSV');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set HSV');
    }
  }, [setError]);

  // Music Mode
  const enableMusicMode = useCallback(async (deviceId: string, settings: YeelightMusicMode) => {
    try {
      const response = await yeelightApi.enableMusicMode(deviceId, settings);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          musicModeStatus: {
            ...prev.musicModeStatus,
            [deviceId]: { enabled: true, settings },
          },
        }));
      } else {
        setError(response.error || 'Failed to enable music mode');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to enable music mode');
    }
  }, [setError]);

  const disableMusicMode = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.disableMusicMode(deviceId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          musicModeStatus: {
            ...prev.musicModeStatus,
            [deviceId]: { enabled: false },
          },
        }));
      } else {
        setError(response.error || 'Failed to disable music mode');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to disable music mode');
    }
  }, [setError]);

  const updateMusicSettings = useCallback(async (deviceId: string, settings: Partial<YeelightMusicMode>) => {
    try {
      const response = await yeelightApi.updateMusicSettings(deviceId, settings);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          musicModeStatus: {
            ...prev.musicModeStatus,
            [deviceId]: {
              ...prev.musicModeStatus[deviceId],
              settings: { ...prev.musicModeStatus[deviceId]?.settings, ...settings } as YeelightMusicMode,
            },
          },
        }));
      } else {
        setError(response.error || 'Failed to update music settings');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update music settings');
    }
  }, [setError]);

  const getMusicModeStatus = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.getMusicModeStatus(deviceId);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          musicModeStatus: {
            ...prev.musicModeStatus,
            [deviceId]: response.data!,
          },
        }));
      }
    } catch (error) {
      // Silent fail for status checks
      console.warn('Failed to get music mode status:', error);
    }
  }, []);

  // Audio Visualization
  const startAudioVisualization = useCallback(async (deviceId: string, settings: AudioVisualizationSettings) => {
    try {
      const response = await yeelightApi.startAudioVisualization(deviceId, settings);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          audioVisualizationStatus: {
            ...prev.audioVisualizationStatus,
            [deviceId]: { active: true, settings },
          },
        }));
      } else {
        setError(response.error || 'Failed to start audio visualization');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start audio visualization');
    }
  }, [setError]);

  const stopAudioVisualization = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.stopAudioVisualization(deviceId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          audioVisualizationStatus: {
            ...prev.audioVisualizationStatus,
            [deviceId]: { active: false },
          },
        }));
      } else {
        setError(response.error || 'Failed to stop audio visualization');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop audio visualization');
    }
  }, [setError]);

  const updateAudioSettings = useCallback(async (deviceId: string, settings: Partial<AudioVisualizationSettings>) => {
    try {
      const response = await yeelightApi.updateAudioSettings(deviceId, settings);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          audioVisualizationStatus: {
            ...prev.audioVisualizationStatus,
            [deviceId]: {
              ...prev.audioVisualizationStatus[deviceId],
              settings: { ...prev.audioVisualizationStatus[deviceId]?.settings, ...settings } as AudioVisualizationSettings,
            },
          },
        }));
      } else {
        setError(response.error || 'Failed to update audio settings');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update audio settings');
    }
  }, [setError]);

  const getAudioVisualizationStatus = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.getAudioVisualizationStatus(deviceId);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          audioVisualizationStatus: {
            ...prev.audioVisualizationStatus,
            [deviceId]: response.data!,
          },
        }));
      }
    } catch (error) {
      // Silent fail for status checks
      console.warn('Failed to get audio visualization status:', error);
    }
  }, []);

  // Flow Effects
  const startFlow = useCallback(async (deviceId: string, flow: any[]) => {
    try {
      const response = await yeelightApi.startFlow(deviceId, flow);
      
      if (!response.success) {
        setError(response.error || 'Failed to start flow');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start flow');
    }
  }, [setError]);

  const stopFlow = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.stopFlow(deviceId);
      
      if (!response.success) {
        setError(response.error || 'Failed to stop flow');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop flow');
    }
  }, [setError]);

  // Presets
  const savePreset = useCallback(async (deviceId: string, name: string) => {
    try {
      const response = await yeelightApi.savePreset(deviceId, name);
      
      if (response.success) {
        await loadPresets(deviceId);
      } else {
        setError(response.error || 'Failed to save preset');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save preset');
    }
  }, [setError]);

  const loadPreset = useCallback(async (deviceId: string, presetId: string) => {
    try {
      const response = await yeelightApi.loadPreset(deviceId, presetId);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to load preset');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load preset');
    }
  }, [refreshDevice, setError]);

  const deletePreset = useCallback(async (deviceId: string, presetId: string) => {
    try {
      const response = await yeelightApi.deletePreset(deviceId, presetId);
      
      if (response.success) {
        await loadPresets(deviceId);
      } else {
        setError(response.error || 'Failed to delete preset');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete preset');
    }
  }, [setError]);

  const loadPresets = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.getPresets(deviceId);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          presets: {
            ...prev.presets,
            [deviceId]: response.data!,
          },
        }));
      }
    } catch (error) {
      // Silent fail for presets loading
      console.warn('Failed to load presets:', error);
    }
  }, []);

  // Network
  const testConnection = useCallback(async (deviceId: string): Promise<{ latency: number; success: boolean } | null> => {
    try {
      const response = await yeelightApi.testConnection(deviceId);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Connection test failed');
        return null;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connection test failed');
      return null;
    }
  }, [setError]);

  // Performance
  const getPerformanceMetrics = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.getPerformanceMetrics(deviceId);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          performanceMetrics: {
            ...prev.performanceMetrics,
            [deviceId]: response.data!,
          },
        }));
      }
    } catch (error) {
      // Silent fail for metrics
      console.warn('Failed to get performance metrics:', error);
    }
  }, []);

  // Bulk Operations
  const bulkOperation = useCallback(async (deviceIds: string[], operation: string, parameters: any) => {
    try {
      const response = await yeelightApi.bulkOperation(deviceIds, operation, parameters);
      
      if (!response.success) {
        setError(response.error || 'Bulk operation failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Bulk operation failed');
    }
  }, [setError]);

  const syncDevices = useCallback(async (deviceIds: string[], masterDeviceId: string) => {
    try {
      const response = await yeelightApi.syncDevices(deviceIds, masterDeviceId);
      
      if (!response.success) {
        setError(response.error || 'Failed to sync devices');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sync devices');
    }
  }, [setError]);

  const stopSync = useCallback(async (deviceIds: string[]) => {
    try {
      const response = await yeelightApi.stopSync(deviceIds);
      
      if (!response.success) {
        setError(response.error || 'Failed to stop sync');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop sync');
    }
  }, [setError]);

  // Configuration
  const updateConfiguration = useCallback(async (deviceId: string, config: any) => {
    try {
      const response = await yeelightApi.updateConfiguration(deviceId, config);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to update configuration');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update configuration');
    }
  }, [refreshDevice, setError]);

  const exportConfiguration = useCallback(async (deviceId: string) => {
    try {
      const response = await yeelightApi.exportConfiguration(deviceId);
      
      if (response.success) {
        return response.data;
      } else {
        setError(response.error || 'Failed to export configuration');
        return null;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to export configuration');
      return null;
    }
  }, [setError]);

  const importConfiguration = useCallback(async (deviceId: string, config: any) => {
    try {
      const response = await yeelightApi.importConfiguration(deviceId, config);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to import configuration');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to import configuration');
    }
  }, [refreshDevice, setError]);

  // Auto-discover devices on mount
  useEffect(() => {
    discoverDevices();
  }, [discoverDevices]);

  return {
    ...state,
    discoverDevices,
    selectDevice,
    refreshDevice,
    setPower,
    setBrightness,
    setColor,
    setColorTemp,
    setHsv,
    enableMusicMode,
    disableMusicMode,
    updateMusicSettings,
    getMusicModeStatus,
    startAudioVisualization,
    stopAudioVisualization,
    updateAudioSettings,
    getAudioVisualizationStatus,
    startFlow,
    stopFlow,
    savePreset,
    loadPreset,
    deletePreset,
    loadPresets,
    testConnection,
    getPerformanceMetrics,
    bulkOperation,
    syncDevices,
    stopSync,
    updateConfiguration,
    exportConfiguration,
    importConfiguration,
    clearError,
  };
}

export default useYeelight;