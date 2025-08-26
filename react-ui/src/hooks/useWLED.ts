import { useState, useEffect, useCallback } from 'react';
import { WLEDDevice, WLEDSegment, WLEDEffect, WLEDPalette, GradientZone } from '@/types';
import { wledApi } from '@/services/wledApi';

export interface WLEDState {
  devices: WLEDDevice[];
  selectedDevice: WLEDDevice | null;
  segments: WLEDSegment[];
  effects: WLEDEffect[];
  palettes: WLEDPalette[];
  gradientZones: GradientZone[];
  isLoading: boolean;
  error: string | null;
  isDiscovering: boolean;
  performanceMetrics: any;
}

export interface WLEDActions {
  // Device Management
  discoverDevices: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  refreshDevice: (deviceId?: string) => Promise<void>;
  
  // Gradient Management
  setGradientMode: (deviceId: string, mode: 'sparse' | 'full') => Promise<void>;
  createGradient: (deviceId: string, zones: GradientZone[]) => Promise<void>;
  updateGradient: (deviceId: string, gradientId: string, zones: GradientZone[]) => Promise<void>;
  deleteGradient: (deviceId: string, gradientId: string) => Promise<void>;
  previewGradient: (deviceId: string, zones: GradientZone[]) => Promise<string | null>;
  setGradientZones: (zones: GradientZone[]) => void;
  
  // Segment Management
  createSegment: (deviceId: string, segment: Partial<WLEDSegment>) => Promise<void>;
  updateSegment: (deviceId: string, segmentId: number, segment: Partial<WLEDSegment>) => Promise<void>;
  deleteSegment: (deviceId: string, segmentId: number) => Promise<void>;
  
  // Effects and Palettes
  applyEffect: (deviceId: string, effectId: number, parameters?: Record<string, any>) => Promise<void>;
  applyPalette: (deviceId: string, paletteId: number) => Promise<void>;
  
  // Entertainment
  startScreenMirroring: (deviceId: string, settings: any) => Promise<void>;
  stopScreenMirroring: (deviceId: string) => Promise<void>;
  startMusicVisualization: (deviceId: string, settings: any) => Promise<void>;
  stopMusicVisualization: (deviceId: string) => Promise<void>;
  
  // Synchronization
  syncDevices: (deviceIds: string[], settings: any) => Promise<void>;
  stopSync: (deviceIds: string[]) => Promise<void>;
  
  // Configuration
  updateConfiguration: (deviceId: string, config: any) => Promise<void>;
  exportConfiguration: (deviceId: string) => Promise<any>;
  importConfiguration: (deviceId: string, config: any) => Promise<void>;
  
  // Utility
  clearError: () => void;
}

const initialState: WLEDState = {
  devices: [],
  selectedDevice: null,
  segments: [],
  effects: [],
  palettes: [],
  gradientZones: [],
  isLoading: false,
  error: null,
  isDiscovering: false,
  performanceMetrics: null,
};

export function useWLED(): WLEDState & WLEDActions {
  const [state, setState] = useState<WLEDState>(initialState);

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
      const response = await wledApi.discoverDevices();
      
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
      const [deviceResponse, segmentsResponse, effectsResponse, palettesResponse] = await Promise.all([
        wledApi.getDevice(deviceId),
        wledApi.getSegments(deviceId),
        wledApi.getEffects(deviceId),
        wledApi.getPalettes(deviceId),
      ]);

      if (deviceResponse.success && deviceResponse.data) {
        setState(prev => ({
          ...prev,
          selectedDevice: deviceResponse.data!,
          segments: segmentsResponse.success ? segmentsResponse.data! : [],
          effects: effectsResponse.success ? effectsResponse.data! : [],
          palettes: palettesResponse.success ? palettesResponse.data! : [],
          isLoading: false,
        }));
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

  // Gradient Management
  const setGradientMode = useCallback(async (deviceId: string, mode: 'sparse' | 'full') => {
    try {
      const response = await wledApi.setGradientMode(deviceId, mode);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(device =>
            device.id === deviceId ? { ...device, gradientMode: mode } : device
          ),
          selectedDevice: prev.selectedDevice?.id === deviceId
            ? { ...prev.selectedDevice, gradientMode: mode }
            : prev.selectedDevice,
        }));
      } else {
        setError(response.error || 'Failed to set gradient mode');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set gradient mode');
    }
  }, [setError]);

  const createGradient = useCallback(async (deviceId: string, zones: GradientZone[]) => {
    try {
      const response = await wledApi.createGradient(deviceId, zones);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to create gradient');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create gradient');
    }
  }, [refreshDevice, setError]);

  const updateGradient = useCallback(async (deviceId: string, gradientId: string, zones: GradientZone[]) => {
    try {
      const response = await wledApi.updateGradient(deviceId, gradientId, zones);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to update gradient');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update gradient');
    }
  }, [refreshDevice, setError]);

  const deleteGradient = useCallback(async (deviceId: string, gradientId: string) => {
    try {
      const response = await wledApi.deleteGradient(deviceId, gradientId);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to delete gradient');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete gradient');
    }
  }, [refreshDevice, setError]);

  const previewGradient = useCallback(async (deviceId: string, zones: GradientZone[]): Promise<string | null> => {
    try {
      const response = await wledApi.previewGradient(deviceId, zones);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to generate preview');
        return null;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate preview');
      return null;
    }
  }, [setError]);

  const setGradientZones = useCallback((zones: GradientZone[]) => {
    setState(prev => ({ ...prev, gradientZones: zones }));
  }, []);

  // Segment Management
  const createSegment = useCallback(async (deviceId: string, segment: Partial<WLEDSegment>) => {
    try {
      const response = await wledApi.createSegment(deviceId, segment);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to create segment');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create segment');
    }
  }, [refreshDevice, setError]);

  const updateSegment = useCallback(async (deviceId: string, segmentId: number, segment: Partial<WLEDSegment>) => {
    try {
      const response = await wledApi.updateSegment(deviceId, segmentId, segment);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to update segment');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update segment');
    }
  }, [refreshDevice, setError]);

  const deleteSegment = useCallback(async (deviceId: string, segmentId: number) => {
    try {
      const response = await wledApi.deleteSegment(deviceId, segmentId);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to delete segment');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete segment');
    }
  }, [refreshDevice, setError]);

  // Effects and Palettes
  const applyEffect = useCallback(async (deviceId: string, effectId: number, parameters?: Record<string, any>) => {
    try {
      const response = await wledApi.applyEffect(deviceId, effectId, parameters);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to apply effect');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to apply effect');
    }
  }, [refreshDevice, setError]);

  const applyPalette = useCallback(async (deviceId: string, paletteId: number) => {
    try {
      const response = await wledApi.applyPalette(deviceId, paletteId);
      
      if (response.success) {
        await refreshDevice(deviceId);
      } else {
        setError(response.error || 'Failed to apply palette');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to apply palette');
    }
  }, [refreshDevice, setError]);

  // Entertainment
  const startScreenMirroring = useCallback(async (deviceId: string, settings: any) => {
    try {
      const response = await wledApi.startScreenMirroring(deviceId, settings);
      
      if (!response.success) {
        setError(response.error || 'Failed to start screen mirroring');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start screen mirroring');
    }
  }, [setError]);

  const stopScreenMirroring = useCallback(async (deviceId: string) => {
    try {
      const response = await wledApi.stopScreenMirroring(deviceId);
      
      if (!response.success) {
        setError(response.error || 'Failed to stop screen mirroring');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop screen mirroring');
    }
  }, [setError]);

  const startMusicVisualization = useCallback(async (deviceId: string, settings: any) => {
    try {
      const response = await wledApi.startMusicVisualization(deviceId, settings);
      
      if (!response.success) {
        setError(response.error || 'Failed to start music visualization');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start music visualization');
    }
  }, [setError]);

  const stopMusicVisualization = useCallback(async (deviceId: string) => {
    try {
      const response = await wledApi.stopMusicVisualization(deviceId);
      
      if (!response.success) {
        setError(response.error || 'Failed to stop music visualization');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop music visualization');
    }
  }, [setError]);

  // Synchronization
  const syncDevices = useCallback(async (deviceIds: string[], settings: any) => {
    try {
      const response = await wledApi.syncDevices(deviceIds, settings);
      
      if (!response.success) {
        setError(response.error || 'Failed to sync devices');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sync devices');
    }
  }, [setError]);

  const stopSync = useCallback(async (deviceIds: string[]) => {
    try {
      const response = await wledApi.stopSync(deviceIds);
      
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
      const response = await wledApi.updateConfiguration(deviceId, config);
      
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
      const response = await wledApi.exportConfiguration(deviceId);
      
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
      const response = await wledApi.importConfiguration(deviceId, config);
      
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
    setGradientMode,
    createGradient,
    updateGradient,
    deleteGradient,
    previewGradient,
    setGradientZones,
    createSegment,
    updateSegment,
    deleteSegment,
    applyEffect,
    applyPalette,
    startScreenMirroring,
    stopScreenMirroring,
    startMusicVisualization,
    stopMusicVisualization,
    syncDevices,
    stopSync,
    updateConfiguration,
    exportConfiguration,
    importConfiguration,
    clearError,
  };
}

export default useWLED;