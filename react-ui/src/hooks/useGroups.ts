// Groups State Management Hook
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LightGroup,
  Light,
  GroupAction,
  BulkGroupOperation,
  GroupCreationRequest,
  ApiResponse,
} from '@/types';
import { groupsApi } from '@/services/groupsApi';

interface UseGroupsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  includeEntertainment?: boolean;
}

interface GroupsState {
  groups: LightGroup[];
  availableLights: Light[];
  selectedGroup: LightGroup | null;
  groupsByRoom: Record<string, LightGroup[]>;
  roomClasses: string[];
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface GroupsActions {
  // Group Management
  refreshGroups: () => Promise<void>;
  selectGroup: (group: LightGroup | null) => void;
  createGroup: (request: GroupCreationRequest) => Promise<ApiResponse<string>>;
  updateGroup: (id: string, updates: Partial<Pick<LightGroup, 'name' | 'lightIds' | 'class'>>) => Promise<ApiResponse<void>>;
  deleteGroup: (id: string) => Promise<ApiResponse<void>>;
  
  // Group Control
  toggleGroup: (id: string) => Promise<ApiResponse<boolean>>;
  setGroupBrightness: (id: string, brightness: number) => Promise<ApiResponse<void>>;
  setGroupColor: (id: string, color: { r: number; g: number; b: number } | { hue: number; sat: number } | { ct: number }) => Promise<ApiResponse<void>>;
  applyGroupAction: (id: string, action: GroupAction) => Promise<ApiResponse<void>>;
  applyBulkOperation: (operation: BulkGroupOperation) => Promise<ApiResponse<void>>;
  
  // Light Management
  refreshAvailableLights: () => Promise<void>;
  addLightsToGroup: (groupId: string, lightIds: string[]) => Promise<ApiResponse<void>>;
  removeLightsFromGroup: (groupId: string, lightIds: string[]) => Promise<ApiResponse<void>>;
  
  // Room Management
  refreshGroupsByRoom: () => Promise<void>;
  createRoomGroup: (roomName: string, roomClass: string, lightIds: string[]) => Promise<ApiResponse<string>>;
  
  // Utility
  clearError: () => void;
  initialize: () => Promise<void>;
}

interface GroupsComputed {
  roomGroupsCount: number;
  entertainmentGroupsCount: number;
  totalLightsInGroups: number;
  activeGroups: LightGroup[];
  availableRooms: string[];
  ungroupedLights: Light[];
}

export function useGroups(
  options: UseGroupsOptions = {}
): GroupsState & GroupsActions & GroupsComputed {
  const {
    autoRefresh = true,
    refreshInterval = 10000,
    includeEntertainment = true,
  } = options;

  const [state, setState] = useState<GroupsState>({
    groups: [],
    availableLights: [],
    selectedGroup: null,
    groupsByRoom: {},
    roomClasses: [],
    isLoading: false,
    error: null,
    isInitialized: false,
  });

  // Initialize the hook
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await groupsApi.initialize();
      await refreshGroups();
      await refreshAvailableLights();
      
      const roomClasses = groupsApi.getRoomClasses();
      
      setState(prev => ({ 
        ...prev, 
        roomClasses,
        isInitialized: true, 
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to initialize groups system: ${error}`,
        isLoading: false,
      }));
    }
  }, [state.isInitialized]);

  // Refresh groups
  const refreshGroups = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      let groups = await groupsApi.getGroups();
      
      // Filter out entertainment groups if not included
      if (!includeEntertainment) {
        groups = groups.filter(group => group.type !== 'entertainment');
      }
      
      const groupsByRoom = await groupsApi.getGroupsByRoom();
      
      setState(prev => ({
        ...prev,
        groups,
        groupsByRoom,
        selectedGroup: prev.selectedGroup 
          ? groups.find(g => g.id === prev.selectedGroup!.id) || null
          : null,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to fetch groups: ${error}`,
        isLoading: false,
      }));
    }
  }, [includeEntertainment]);

  // Select a group
  const selectGroup = useCallback((group: LightGroup | null) => {
    setState(prev => ({ ...prev, selectedGroup: group }));
  }, []);

  // Create new group
  const createGroup = useCallback(async (request: GroupCreationRequest): Promise<ApiResponse<string>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await groupsApi.createGroup(request);
      
      if (result.success) {
        await refreshGroups();
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMsg = `Failed to create group: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, [refreshGroups]);

  // Update group
  const updateGroup = useCallback(async (
    id: string,
    updates: Partial<Pick<LightGroup, 'name' | 'lightIds' | 'class'>>
  ): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await groupsApi.updateGroup(id, updates);
      
      if (result.success) {
        await refreshGroups();
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMsg = `Failed to update group: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, [refreshGroups]);

  // Delete group
  const deleteGroup = useCallback(async (id: string): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await groupsApi.deleteGroup(id);
      
      if (result.success) {
        await refreshGroups();
        setState(prev => ({
          ...prev,
          selectedGroup: prev.selectedGroup?.id === id ? null : prev.selectedGroup,
        }));
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMsg = `Failed to delete group: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, [refreshGroups]);

  // Toggle group on/off
  const toggleGroup = useCallback(async (id: string): Promise<ApiResponse<boolean>> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await groupsApi.toggleGroup(id);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          groups: prev.groups.map(group =>
            group.id === id ? { ...group, isOn: result.data! } : group
          ),
          selectedGroup: prev.selectedGroup?.id === id
            ? { ...prev.selectedGroup, isOn: result.data! }
            : prev.selectedGroup,
        }));
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Failed to toggle group: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Set group brightness
  const setGroupBrightness = useCallback(async (id: string, brightness: number): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await groupsApi.setGroupBrightness(id, brightness);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          groups: prev.groups.map(group =>
            group.id === id ? { ...group, brightness, isOn: brightness > 0 } : group
          ),
          selectedGroup: prev.selectedGroup?.id === id
            ? { ...prev.selectedGroup, brightness, isOn: brightness > 0 }
            : prev.selectedGroup,
        }));
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Failed to set group brightness: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Set group color
  const setGroupColor = useCallback(async (
    id: string,
    color: { r: number; g: number; b: number } | { hue: number; sat: number } | { ct: number }
  ): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await groupsApi.setGroupColor(id, color);
      
      if (result.success && 'r' in color) {
        setState(prev => ({
          ...prev,
          groups: prev.groups.map(group =>
            group.id === id ? { ...group, color, isOn: true } : group
          ),
          selectedGroup: prev.selectedGroup?.id === id
            ? { ...prev.selectedGroup, color, isOn: true }
            : prev.selectedGroup,
        }));
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Failed to set group color: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Apply group action
  const applyGroupAction = useCallback(async (id: string, action: GroupAction): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await groupsApi.applyGroupAction(id, action);
      
      if (result.success) {
        // Refresh the specific group to get updated state
        const updatedGroup = await groupsApi.getGroup(id);
        if (updatedGroup) {
          setState(prev => ({
            ...prev,
            groups: prev.groups.map(group =>
              group.id === id ? updatedGroup : group
            ),
            selectedGroup: prev.selectedGroup?.id === id ? updatedGroup : prev.selectedGroup,
          }));
        }
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Failed to apply group action: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Apply bulk operation
  const applyBulkOperation = useCallback(async (operation: BulkGroupOperation): Promise<ApiResponse<void>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await groupsApi.applyBulkOperation(operation);
      
      if (result.success) {
        await refreshGroups();
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMsg = `Failed to apply bulk operation: ${error}`;
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }, [refreshGroups]);

  // Refresh available lights
  const refreshAvailableLights = useCallback(async () => {
    try {
      const lights = await groupsApi.getAvailableLights();
      setState(prev => ({ ...prev, availableLights: lights }));
    } catch (error) {
      console.error('Failed to refresh available lights:', error);
    }
  }, []);

  // Add lights to group
  const addLightsToGroup = useCallback(async (groupId: string, lightIds: string[]): Promise<ApiResponse<void>> => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) {
      return {
        success: false,
        error: 'Group not found',
        timestamp: new Date().toISOString(),
      };
    }

    const updatedLightIds = [...new Set([...group.lightIds, ...lightIds])];
    return updateGroup(groupId, { lightIds: updatedLightIds });
  }, [state.groups, updateGroup]);

  // Remove lights from group
  const removeLightsFromGroup = useCallback(async (groupId: string, lightIds: string[]): Promise<ApiResponse<void>> => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) {
      return {
        success: false,
        error: 'Group not found',
        timestamp: new Date().toISOString(),
      };
    }

    const updatedLightIds = group.lightIds.filter(id => !lightIds.includes(id));
    return updateGroup(groupId, { lightIds: updatedLightIds });
  }, [state.groups, updateGroup]);

  // Refresh groups by room
  const refreshGroupsByRoom = useCallback(async () => {
    try {
      const groupsByRoom = await groupsApi.getGroupsByRoom();
      setState(prev => ({ ...prev, groupsByRoom }));
    } catch (error) {
      console.error('Failed to refresh groups by room:', error);
    }
  }, []);

  // Create room group
  const createRoomGroup = useCallback(async (
    roomName: string,
    roomClass: string,
    lightIds: string[]
  ): Promise<ApiResponse<string>> => {
    return createGroup({
      name: roomName,
      type: 'room',
      lights: lightIds,
      class: roomClass,
    });
  }, [createGroup]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!state.isInitialized || !autoRefresh) return;

    const interval = setInterval(() => {
      refreshGroups();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [state.isInitialized, autoRefresh, refreshInterval, refreshGroups]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Computed values
  const roomGroupsCount = useMemo(() => {
    return state.groups.filter(group => group.type === 'room').length;
  }, [state.groups]);

  const entertainmentGroupsCount = useMemo(() => {
    return state.groups.filter(group => group.type === 'entertainment').length;
  }, [state.groups]);

  const totalLightsInGroups = useMemo(() => {
    return state.groups.reduce((total, group) => total + group.lightIds.length, 0);
  }, [state.groups]);

  const activeGroups = useMemo(() => {
    return state.groups.filter(group => group.isOn);
  }, [state.groups]);

  const availableRooms = useMemo(() => {
    return Object.keys(state.groupsByRoom);
  }, [state.groupsByRoom]);

  const ungroupedLights = useMemo(() => {
    const groupedLightIds = new Set(state.groups.flatMap(group => group.lightIds));
    return state.availableLights.filter(light => !groupedLightIds.has(light.id));
  }, [state.groups, state.availableLights]);

  return {
    // State
    ...state,
    
    // Computed values
    roomGroupsCount,
    entertainmentGroupsCount,
    totalLightsInGroups,
    activeGroups,
    availableRooms,
    ungroupedLights,
    
    // Actions
    refreshGroups,
    selectGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    toggleGroup,
    setGroupBrightness,
    setGroupColor,
    applyGroupAction,
    applyBulkOperation,
    refreshAvailableLights,
    addLightsToGroup,
    removeLightsFromGroup,
    refreshGroupsByRoom,
    createRoomGroup,
    clearError,
    initialize,
  };
}

export default useGroups;