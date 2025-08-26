import { useState, useEffect, useCallback, useRef } from 'react';
import { lightsApiService, type HueLight } from '@/services/lightsApi';
import type { Light } from '@/types';

export interface UseLightsReturn {
  lights: Light[];
  lightTypes: Array<{ id: string; name: string; manufacturer: string }>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshLights: () => Promise<void>;
  toggleLight: (lightId: string) => Promise<void>;
  setBrightness: (lightId: string, brightness: number) => void;
  setColorTemperature: (lightId: string, ct: number) => void;
  setHue: (lightId: string, hue: number) => void;
  setSaturation: (lightId: string, sat: number) => void;
  renameLight: (lightId: string, name: string) => Promise<void>;
  deleteLight: (lightId: string) => Promise<void>;
  setLightType: (lightId: string, modelId: string) => Promise<void>;
  allLightsOn: () => Promise<void>;
  allLightsOff: () => Promise<void>;
  clearError: () => void;
}

export function useLights(
  autoRefresh: boolean = true,
  refreshInterval: number = 5000
): UseLightsReturn {
  const [lights, setLights] = useState<Light[]>([]);
  const [lightTypes, setLightTypes] = useState<Array<{ id: string; name: string; manufacturer: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Initialize the API service
  const initialize = useCallback(async () => {
    if (isInitialized) return;
    
    try {
      await lightsApiService.initialize();
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize API service');
    }
  }, [isInitialized]);

  // Refresh lights data
  const refreshLights = useCallback(async () => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [lightsData, lightTypesData] = await Promise.all([
        lightsApiService.fetchLights(),
        lightsApiService.fetchLightTypes(),
      ]);

      if (mountedRef.current) {
        // Convert Hue format to internal Light format
        const convertedLights = Object.entries(lightsData).map(([id, hueLight]) =>
          lightsApiService.convertHueLightToLight(id, hueLight)
        );
        
        setLights(convertedLights);
        setLightTypes(lightTypesData);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lights');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isInitialized]);

  // Individual light actions
  const toggleLight = useCallback(async (lightId: string) => {
    const light = lights.find(l => l.id === lightId);
    if (!light || !isInitialized) return;

    try {
      await lightsApiService.updateLightState(lightId, { on: !light.isOn });
      await refreshLights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle light');
    }
  }, [lights, isInitialized, refreshLights]);

  const setBrightness = useCallback((lightId: string, brightness: number) => {
    if (!isInitialized) return;
    
    // Convert 0-100 range to 1-254 range
    const briValue = Math.max(1, Math.round((brightness / 100) * 254));
    lightsApiService.setBrightnessDebounced(lightId, briValue);
  }, [isInitialized]);

  const setColorTemperature = useCallback((lightId: string, ct: number) => {
    if (!isInitialized) return;
    lightsApiService.setColorTemperatureDebounced(lightId, ct);
  }, [isInitialized]);

  const setHue = useCallback((lightId: string, hue: number) => {
    if (!isInitialized) return;
    lightsApiService.setHueDebounced(lightId, hue);
  }, [isInitialized]);

  const setSaturation = useCallback((lightId: string, sat: number) => {
    if (!isInitialized) return;
    lightsApiService.setSaturationDebounced(lightId, sat);
  }, [isInitialized]);

  const renameLight = useCallback(async (lightId: string, name: string) => {
    if (!isInitialized) return;

    try {
      await lightsApiService.updateLightProperties(lightId, { name });
      await refreshLights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename light');
    }
  }, [isInitialized, refreshLights]);

  const deleteLight = useCallback(async (lightId: string) => {
    if (!isInitialized) return;

    try {
      await lightsApiService.deleteLight(lightId);
      await refreshLights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete light');
    }
  }, [isInitialized, refreshLights]);

  const setLightType = useCallback(async (lightId: string, modelId: string) => {
    if (!isInitialized) return;

    try {
      await lightsApiService.setLightType(lightId, modelId);
      await refreshLights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set light type');
    }
  }, [isInitialized, refreshLights]);

  // Bulk actions
  const allLightsOn = useCallback(async () => {
    if (!isInitialized) return;

    try {
      await lightsApiService.allLightsOn();
      await refreshLights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to turn all lights on');
    }
  }, [isInitialized, refreshLights]);

  const allLightsOff = useCallback(async () => {
    if (!isInitialized) return;

    try {
      await lightsApiService.allLightsOff();
      await refreshLights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to turn all lights off');
    }
  }, [isInitialized, refreshLights]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Initial data fetch
  useEffect(() => {
    if (isInitialized) {
      refreshLights();
    }
  }, [isInitialized, refreshLights]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !isInitialized) return;

    refreshIntervalRef.current = setInterval(() => {
      refreshLights();
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isInitialized, refreshLights]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      lightsApiService.cleanup();
    };
  }, []);

  return {
    lights,
    lightTypes,
    isLoading,
    error,
    refreshLights,
    toggleLight,
    setBrightness,
    setColorTemperature,
    setHue,
    setSaturation,
    renameLight,
    deleteLight,
    setLightType,
    allLightsOn,
    allLightsOff,
    clearError,
  };
}