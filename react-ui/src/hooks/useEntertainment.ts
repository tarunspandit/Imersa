// Entertainment State Management Hook
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  EntertainmentArea,
  LightPosition,
  CreateAreaRequest,
  ApiResponse,
  WebSocketEvent,
} from '@/types';
import { entertainmentApi } from '@/services/entertainmentApi';

interface UseEntertainmentOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableWebSocket?: boolean;
}

interface EntertainmentState {
  areas: EntertainmentArea[];
  selectedArea: EntertainmentArea | null;
  positions: Record<string, LightPosition[]>; // areaId -> positions
  streamingStatuses: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface EntertainmentActions {
  // Area Management
  refreshAreas: () => Promise<void>;
  selectArea: (area: EntertainmentArea | null) => void;
  createArea: (request: CreateAreaRequest) => Promise<ApiResponse<string>>;
  deleteArea: (areaId: string) => Promise<ApiResponse<void>>;
  
  // Streaming Control
  startStreaming: (areaId: string) => Promise<ApiResponse<void>>;
  stopStreaming: (areaId: string) => Promise<ApiResponse<void>>;
  toggleStreaming: (areaId: string) => Promise<ApiResponse<boolean>>;
  refreshStreamingStatuses: () => Promise<void>;
  
  // Position Management
  loadPositions: (areaId: string) => Promise<void>;
  updatePositions: (areaId: string, positions: LightPosition[]) => Promise<ApiResponse<void>>;
  resetPositions: (areaId: string) => void;
  
  // Utility
  clearError: () => void;
  initialize: () => Promise<void>;
}

export function useEntertainment(options: UseEntertainmentOptions = {}): EntertainmentState & EntertainmentActions {
  const {
    autoRefresh = true,
    refreshInterval = 5000,
    enableWebSocket = true,
  } = options;

  const [state, setState] = useState<EntertainmentState>({
    areas: [],
    selectedArea: null,
    positions: {},
    streamingStatuses: {},
    isLoading: false,
    error: null,
    isInitialized: false,
  });

  // Initialize the hook
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await entertainmentApi.initialize();
      await refreshAreas();
      await refreshStreamingStatuses();
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to initialize entertainment system: ${error}`,
        isLoading: false,
      }));
    }
  }, [state.isInitialized]);

  // Refresh entertainment areas
  const refreshAreas = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const areas = await entertainmentApi.getEntertainmentAreas();
      
      setState(prev => ({
        ...prev,
        areas,
        selectedArea: prev.selectedArea 
          ? areas.find(a => a.id === prev.selectedArea!.id) || null
          : null,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to fetch entertainment areas: ${error}`,
        isLoading: false,
      }));
    }
  }, []);

  // Select an area
  const selectArea = useCallback((area: EntertainmentArea | null) => {
    setState(prev => ({ ...prev, selectedArea: area }));
  }, []);

  // Create new entertainment area
  const createArea = useCallback(async (request: CreateAreaRequest): Promise<ApiResponse<string>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await entertainmentApi.createEntertainmentArea(request);
      
      if (result.success) {
        await refreshAreas();
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMsg = `Failed to create entertainment area: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, [refreshAreas]);

  // Delete entertainment area
  const deleteArea = useCallback(async (areaId: string): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await entertainmentApi.deleteEntertainmentArea(areaId);
      
      if (result.success) {
        await refreshAreas();
        setState(prev => ({
          ...prev,
          selectedArea: prev.selectedArea?.id === areaId ? null : prev.selectedArea,
        }));
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMsg = `Failed to delete entertainment area: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, [refreshAreas]);

  // Start streaming
  const startStreaming = useCallback(async (areaId: string): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await entertainmentApi.startStreaming(areaId);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          streamingStatuses: {
            ...prev.streamingStatuses,
            [areaId]: true,
          },
          areas: prev.areas.map(area =>
            area.id === areaId ? { ...area, isStreaming: true } : area
          ),
          selectedArea: prev.selectedArea?.id === areaId
            ? { ...prev.selectedArea, isStreaming: true }
            : prev.selectedArea,
        }));
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Failed to start streaming: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Stop streaming
  const stopStreaming = useCallback(async (areaId: string): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await entertainmentApi.stopStreaming(areaId);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          streamingStatuses: {
            ...prev.streamingStatuses,
            [areaId]: false,
          },
          areas: prev.areas.map(area =>
            area.id === areaId ? { ...area, isStreaming: false } : area
          ),
          selectedArea: prev.selectedArea?.id === areaId
            ? { ...prev.selectedArea, isStreaming: false }
            : prev.selectedArea,
        }));
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Failed to stop streaming: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Toggle streaming
  const toggleStreaming = useCallback(async (areaId: string): Promise<ApiResponse<boolean>> => {
    const area = state.areas.find(a => a.id === areaId);
    if (!area) {
      return {
        success: false,
        error: 'Entertainment area not found',
        timestamp: new Date().toISOString(),
      };
    }

    return area.isStreaming ? stopStreaming(areaId) as any : startStreaming(areaId) as any;
  }, [state.areas, startStreaming, stopStreaming]);

  // Refresh streaming statuses
  const refreshStreamingStatuses = useCallback(async () => {
    try {
      const statuses = await entertainmentApi.getStreamingStatuses();
      setState(prev => ({ ...prev, streamingStatuses: statuses }));
    } catch (error) {
      console.error('Failed to refresh streaming statuses:', error);
    }
  }, []);

  // Load positions for an area
  const loadPositions = useCallback(async (areaId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const positions = await entertainmentApi.getLightPositions(areaId);
      
      setState(prev => ({
        ...prev,
        positions: {
          ...prev.positions,
          [areaId]: positions,
        },
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to load positions: ${error}`,
        isLoading: false,
      }));
    }
  }, []);

  // Update positions for an area
  const updatePositions = useCallback(async (
    areaId: string,
    positions: LightPosition[]
  ): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await entertainmentApi.updateLightPositions(areaId, positions);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          positions: {
            ...prev.positions,
            [areaId]: positions,
          },
        }));
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMsg = `Failed to update positions: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Reset positions for an area
  const resetPositions = useCallback((areaId: string) => {
    setState(prev => ({
      ...prev,
      positions: {
        ...prev.positions,
        [areaId]: [],
      },
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!state.isInitialized || !autoRefresh) return;

    const interval = setInterval(() => {
      refreshStreamingStatuses();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [state.isInitialized, autoRefresh, refreshInterval, refreshStreamingStatuses]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // WebSocket connection (placeholder for future implementation)
  useEffect(() => {
    if (!enableWebSocket || !state.isInitialized) return;

    // TODO: Implement WebSocket connection for real-time updates
    console.log('WebSocket connection would be established here');

    return () => {
      console.log('WebSocket connection would be closed here');
    };
  }, [enableWebSocket, state.isInitialized]);

  // Computed values
  const activeStreamingAreas = useMemo(() => {
    return state.areas.filter(area => area.isStreaming);
  }, [state.areas]);

  const totalLightsInEntertainment = useMemo(() => {
    return state.areas.reduce((total, area) => total + area.lightIds.length, 0);
  }, [state.areas]);

  return {
    // State
    ...state,
    
    // Computed values
    activeStreamingAreas,
    totalLightsInEntertainment,
    
    // Actions
    refreshAreas,
    selectArea,
    createArea,
    deleteArea,
    startStreaming,
    stopStreaming,
    toggleStreaming,
    refreshStreamingStatuses,
    loadPositions,
    updatePositions,
    resetPositions,
    clearError,
    initialize,
  };
}

export default useEntertainment;