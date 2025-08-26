import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Light, LightGroup, Scene } from '@/types';

interface LightsState {
  lights: Light[];
  groups: LightGroup[];
  scenes: Scene[];
  selectedLights: string[];
  activeScene: string | null;
  isLoading: boolean;
  error: string | null;

  // Light actions
  fetchLights: () => Promise<void>;
  updateLight: (id: string, updates: Partial<Light>) => Promise<void>;
  toggleLight: (id: string) => Promise<void>;
  setBrightness: (id: string, brightness: number) => Promise<void>;
  setColor: (id: string, color: { r: number; g: number; b: number; w?: number }) => Promise<void>;
  setEffect: (id: string, effectId: string, params?: Record<string, any>) => Promise<void>;

  // Group actions
  fetchGroups: () => Promise<void>;
  createGroup: (group: Omit<LightGroup, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateGroup: (id: string, updates: Partial<LightGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  toggleGroup: (id: string) => Promise<void>;
  setGroupBrightness: (id: string, brightness: number) => Promise<void>;
  setGroupColor: (id: string, color: { r: number; g: number; b: number; w?: number }) => Promise<void>;

  // Scene actions
  fetchScenes: () => Promise<void>;
  createScene: (scene: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateScene: (id: string, updates: Partial<Scene>) => Promise<void>;
  deleteScene: (id: string) => Promise<void>;
  activateScene: (id: string) => Promise<void>;
  deactivateScene: () => Promise<void>;

  // Selection actions
  selectLight: (id: string) => void;
  deselectLight: (id: string) => void;
  toggleLightSelection: (id: string) => void;
  selectAllLights: () => void;
  clearSelection: () => void;

  // Utility actions
  clearError: () => void;
  refreshAll: () => Promise<void>;
}

const useLightsStore = create<LightsState>()(
  subscribeWithSelector((set, get) => ({
    lights: [],
    groups: [],
    scenes: [],
    selectedLights: [],
    activeScene: null,
    isLoading: false,
    error: null,

    // Light actions
    fetchLights: async () => {
      set({ isLoading: true, error: null });
      
      try {
        const response = await fetch('/api/lights');
        if (!response.ok) throw new Error('Failed to fetch lights');
        
        const lights = await response.json();
        set({ lights, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch lights',
          isLoading: false,
        });
      }
    },

    updateLight: async (id: string, updates: Partial<Light>) => {
      try {
        const response = await fetch(`/api/lights/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error('Failed to update light');
        
        const updatedLight = await response.json();
        
        set((state) => ({
          lights: state.lights.map((light) =>
            light.id === id ? { ...light, ...updatedLight } : light
          ),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to update light' });
      }
    },

    toggleLight: async (id: string) => {
      const light = get().lights.find((l) => l.id === id);
      if (light) {
        await get().updateLight(id, { isOn: !light.isOn });
      }
    },

    setBrightness: async (id: string, brightness: number) => {
      await get().updateLight(id, { brightness });
    },

    setColor: async (id: string, color: { r: number; g: number; b: number; w?: number }) => {
      await get().updateLight(id, { color });
    },

    setEffect: async (id: string, effectId: string, params?: Record<string, any>) => {
      try {
        const response = await fetch(`/api/lights/${id}/effect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ effectId, params }),
        });
        
        if (!response.ok) throw new Error('Failed to set effect');
        
        await get().fetchLights(); // Refresh to get updated state
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to set effect' });
      }
    },

    // Group actions
    fetchGroups: async () => {
      try {
        const response = await fetch('/api/groups');
        if (!response.ok) throw new Error('Failed to fetch groups');
        
        const groups = await response.json();
        set({ groups });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to fetch groups' });
      }
    },

    createGroup: async (group) => {
      try {
        const response = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(group),
        });
        
        if (!response.ok) throw new Error('Failed to create group');
        
        const newGroup = await response.json();
        set((state) => ({ groups: [...state.groups, newGroup] }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to create group' });
      }
    },

    updateGroup: async (id: string, updates: Partial<LightGroup>) => {
      try {
        const response = await fetch(`/api/groups/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error('Failed to update group');
        
        const updatedGroup = await response.json();
        
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === id ? { ...group, ...updatedGroup } : group
          ),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to update group' });
      }
    },

    deleteGroup: async (id: string) => {
      try {
        const response = await fetch(`/api/groups/${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) throw new Error('Failed to delete group');
        
        set((state) => ({
          groups: state.groups.filter((group) => group.id !== id),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete group' });
      }
    },

    toggleGroup: async (id: string) => {
      const group = get().groups.find((g) => g.id === id);
      if (group) {
        await get().updateGroup(id, { isOn: !group.isOn });
      }
    },

    setGroupBrightness: async (id: string, brightness: number) => {
      await get().updateGroup(id, { brightness });
    },

    setGroupColor: async (id: string, color: { r: number; g: number; b: number; w?: number }) => {
      await get().updateGroup(id, { color });
    },

    // Scene actions
    fetchScenes: async () => {
      try {
        const response = await fetch('/api/scenes');
        if (!response.ok) throw new Error('Failed to fetch scenes');
        
        const scenes = await response.json();
        set({ scenes });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to fetch scenes' });
      }
    },

    createScene: async (scene) => {
      try {
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scene),
        });
        
        if (!response.ok) throw new Error('Failed to create scene');
        
        const newScene = await response.json();
        set((state) => ({ scenes: [...state.scenes, newScene] }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to create scene' });
      }
    },

    updateScene: async (id: string, updates: Partial<Scene>) => {
      try {
        const response = await fetch(`/api/scenes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error('Failed to update scene');
        
        const updatedScene = await response.json();
        
        set((state) => ({
          scenes: state.scenes.map((scene) =>
            scene.id === id ? { ...scene, ...updatedScene } : scene
          ),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to update scene' });
      }
    },

    deleteScene: async (id: string) => {
      try {
        const response = await fetch(`/api/scenes/${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) throw new Error('Failed to delete scene');
        
        set((state) => ({
          scenes: state.scenes.filter((scene) => scene.id !== id),
          activeScene: state.activeScene === id ? null : state.activeScene,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete scene' });
      }
    },

    activateScene: async (id: string) => {
      try {
        const response = await fetch(`/api/scenes/${id}/activate`, {
          method: 'POST',
        });
        
        if (!response.ok) throw new Error('Failed to activate scene');
        
        set({ activeScene: id });
        await get().fetchLights(); // Refresh lights to show scene state
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to activate scene' });
      }
    },

    deactivateScene: async () => {
      try {
        const response = await fetch('/api/scenes/deactivate', {
          method: 'POST',
        });
        
        if (!response.ok) throw new Error('Failed to deactivate scene');
        
        set({ activeScene: null });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to deactivate scene' });
      }
    },

    // Selection actions
    selectLight: (id: string) => {
      set((state) => ({
        selectedLights: state.selectedLights.includes(id)
          ? state.selectedLights
          : [...state.selectedLights, id],
      }));
    },

    deselectLight: (id: string) => {
      set((state) => ({
        selectedLights: state.selectedLights.filter((lightId) => lightId !== id),
      }));
    },

    toggleLightSelection: (id: string) => {
      set((state) => ({
        selectedLights: state.selectedLights.includes(id)
          ? state.selectedLights.filter((lightId) => lightId !== id)
          : [...state.selectedLights, id],
      }));
    },

    selectAllLights: () => {
      set((state) => ({
        selectedLights: state.lights.map((light) => light.id),
      }));
    },

    clearSelection: () => {
      set({ selectedLights: [] });
    },

    // Utility actions
    clearError: () => {
      set({ error: null });
    },

    refreshAll: async () => {
      await Promise.all([
        get().fetchLights(),
        get().fetchGroups(),
        get().fetchScenes(),
      ]);
    },
  }))
);

export { useLightsStore };