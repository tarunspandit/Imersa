import { useState, useEffect, useCallback, useRef } from 'react';
import { scenesApiService } from '@/services/scenesApi';
import {
  Scene,
  CreateSceneRequest,
  UpdateSceneRequest,
  SceneBulkAction,
  ScenePreview,
  LightGroup,
} from '@/types';

export interface UseScenesReturn {
  scenes: Scene[];
  groups: LightGroup[];
  selectedScenes: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshScenes: () => Promise<void>;
  createScene: (request: CreateSceneRequest) => Promise<string | null>;
  updateScene: (id: string, updates: UpdateSceneRequest) => Promise<void>;
  deleteScene: (id: string) => Promise<void>;
  recallScene: (groupId: string, sceneId: string, transitionTime?: number) => Promise<void>;
  storeLightState: (sceneId: string) => Promise<void>;
  bulkAction: (action: SceneBulkAction) => Promise<void>;
  generatePreview: (sceneId: string) => Promise<ScenePreview | null>;
  
  // Scene management
  getScenesByGroup: (groupId: string) => Scene[];
  getScenesByCategory: (category?: Scene['category']) => Scene[];
  toggleSceneSelection: (sceneId: string) => void;
  selectAllScenes: () => void;
  clearSelection: () => void;
  
  // Utilities
  clearError: () => void;
}

export function useScenes(
  autoRefresh: boolean = true,
  refreshInterval: number = 10000
): UseScenesReturn {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [groups, setGroups] = useState<LightGroup[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Initialize the API service
  const initialize = useCallback(async () => {
    if (isInitialized) return;
    
    try {
      await scenesApiService.initialize();
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize API service');
    }
  }, [isInitialized]);

  // Refresh scenes and groups data
  const refreshScenes = useCallback(async () => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [scenesData, groupsData] = await Promise.all([
        scenesApiService.getScenes(),
        scenesApiService.getAvailableGroups(),
      ]);

      if (mountedRef.current) {
        setScenes(scenesData);
        setGroups(groupsData);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch scenes');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isInitialized]);

  // Scene CRUD operations
  const createScene = useCallback(async (request: CreateSceneRequest): Promise<string | null> => {
    if (!isInitialized) return null;

    try {
      const result = await scenesApiService.createScene(request);
      
      if (!result.success) {
        setError(result.error || 'Failed to create scene');
        return null;
      }

      await refreshScenes();
      return result.data || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scene');
      return null;
    }
  }, [isInitialized, refreshScenes]);

  const updateScene = useCallback(async (id: string, updates: UpdateSceneRequest) => {
    if (!isInitialized) return;

    try {
      const result = await scenesApiService.updateScene(id, updates);
      
      if (!result.success) {
        setError(result.error || 'Failed to update scene');
        return;
      }

      await refreshScenes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scene');
    }
  }, [isInitialized, refreshScenes]);

  const deleteScene = useCallback(async (id: string) => {
    if (!isInitialized) return;

    try {
      const result = await scenesApiService.deleteScene(id);
      
      if (!result.success) {
        setError(result.error || 'Failed to delete scene');
        return;
      }

      // Remove from selection if it was selected
      setSelectedScenes(prev => prev.filter(sceneId => sceneId !== id));
      await refreshScenes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scene');
    }
  }, [isInitialized, refreshScenes]);

  const recallScene = useCallback(async (groupId: string, sceneId: string, transitionTime?: number) => {
    if (!isInitialized) return;

    try {
      const result = await scenesApiService.recallScene(groupId, sceneId, {
        transitiontime: transitionTime,
      });
      
      if (!result.success) {
        setError(result.error || 'Failed to recall scene');
        return;
      }

      // Update scene active status locally for immediate feedback
      setScenes(prev => prev.map(scene => ({
        ...scene,
        isActive: scene.id === sceneId && scene.group === groupId,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recall scene');
    }
  }, [isInitialized]);

  const storeLightState = useCallback(async (sceneId: string) => {
    if (!isInitialized) return;

    try {
      const result = await scenesApiService.storeLightState(sceneId);
      
      if (!result.success) {
        setError(result.error || 'Failed to store light state');
        return;
      }

      await refreshScenes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store light state');
    }
  }, [isInitialized, refreshScenes]);

  const bulkAction = useCallback(async (action: SceneBulkAction) => {
    if (!isInitialized) return;

    try {
      const result = await scenesApiService.bulkSceneAction(action);
      
      if (!result.success) {
        setError(result.error || 'Failed to perform bulk action');
        return;
      }

      // Clear selection after bulk action
      setSelectedScenes([]);
      await refreshScenes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform bulk action');
    }
  }, [isInitialized, refreshScenes]);

  const generatePreview = useCallback(async (sceneId: string): Promise<ScenePreview | null> => {
    if (!isInitialized) return null;

    try {
      return await scenesApiService.generateScenePreview(sceneId);
    } catch (err) {
      console.error(`Failed to generate preview for scene ${sceneId}:`, err);
      return null;
    }
  }, [isInitialized]);

  // Scene management utilities
  const getScenesByGroup = useCallback((groupId: string): Scene[] => {
    return scenes.filter(scene => scene.group === groupId || (!scene.group && groupId === ''));
  }, [scenes]);

  const getScenesByCategory = useCallback((category?: Scene['category']): Scene[] => {
    if (!category) return scenes;
    return scenes.filter(scene => scene.category === category);
  }, [scenes]);

  const toggleSceneSelection = useCallback((sceneId: string) => {
    setSelectedScenes(prev => {
      if (prev.includes(sceneId)) {
        return prev.filter(id => id !== sceneId);
      } else {
        return [...prev, sceneId];
      }
    });
  }, []);

  const selectAllScenes = useCallback(() => {
    setSelectedScenes(scenes.map(scene => scene.id));
  }, [scenes]);

  const clearSelection = useCallback(() => {
    setSelectedScenes([]);
  }, []);

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
      refreshScenes();
    }
  }, [isInitialized, refreshScenes]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !isInitialized) return;

    refreshIntervalRef.current = setInterval(() => {
      refreshScenes();
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isInitialized, refreshScenes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    scenes,
    groups,
    selectedScenes,
    isLoading,
    error,
    refreshScenes,
    createScene,
    updateScene,
    deleteScene,
    recallScene,
    storeLightState,
    bulkAction,
    generatePreview,
    getScenesByGroup,
    getScenesByCategory,
    toggleSceneSelection,
    selectAllScenes,
    clearSelection,
    clearError,
  };
}