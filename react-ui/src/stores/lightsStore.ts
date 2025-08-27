import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Light, LightGroup, Scene } from '@/types';
import { lightsApiService } from '@/services/lightsApi';
import groupsApi from '@/services/groupsApi';
import { scenesApiService } from '@/services/scenesApi';
import { rgbToHsv } from '@/utils';

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
        await lightsApiService.initialize();
        const hueLights = await lightsApiService.fetchLights();
        const converted = Object.entries(hueLights).map(([id, hueLight]) =>
          lightsApiService.convertHueLightToLight(id, hueLight)
        );
        set({ lights: converted, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch lights',
          isLoading: false,
        });
      }
    },

    updateLight: async (id: string, updates: Partial<Light>) => {
      try {
        await lightsApiService.initialize();
        // Map UI updates to Hue state/properties
        const state: any = {};
        let didStateChange = false;
        if (updates.isOn !== undefined) { state.on = updates.isOn; didStateChange = true; }
        if (updates.brightness !== undefined) { state.bri = Math.max(1, Math.round((updates.brightness / 100) * 254)); didStateChange = true; }
        if (updates.color) {
          const hsv = rgbToHsv(updates.color.r, updates.color.g, updates.color.b);
          state.hue = Math.round((hsv.h / 360) * 65535);
          state.sat = Math.round((hsv.s / 100) * 254);
          didStateChange = true;
        }
        if (didStateChange) {
          await lightsApiService.updateLightState(id, state);
        }
        if (updates.name) {
          await lightsApiService.updateLightProperties(id, { name: updates.name });
        }
        // Refresh single light via fetchLights for simplicity
        await get().fetchLights();
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

    setEffect: async (id: string, _effectId: string, _params?: Record<string, any>) => {
      // Placeholder: effects not implemented in Hue v1 by diyHue; no-op
      await get().fetchLights();
    },

    // Group actions
    fetchGroups: async () => {
      try {
        await groupsApi.initialize();
        const groups = await groupsApi.getGroups();
        set({ groups });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to fetch groups' });
      }
    },

    createGroup: async (group) => {
      try {
        await groupsApi.initialize();
        const res = await groupsApi.createGroup({
          name: group.name,
          lights: group.lightIds,
          type: group.type,
          class: group.class,
        } as any);
        if (res.success) {
          await get().fetchGroups();
        } else {
          throw new Error(res.error || 'Failed to create group');
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to create group' });
      }
    },

    updateGroup: async (id: string, updates: Partial<LightGroup>) => {
      try {
        await groupsApi.initialize();
        if (updates.brightness !== undefined) {
          await groupsApi.setGroupBrightness(id, updates.brightness);
        }
        if (updates.color) {
          await groupsApi.setGroupColor(id, updates.color as any);
        }
        const coreUpdates: Partial<LightGroup> = {};
        if (updates.name) coreUpdates.name = updates.name;
        if (updates.lightIds) coreUpdates.lightIds = updates.lightIds;
        if (updates.class) coreUpdates.class = updates.class;
        if (Object.keys(coreUpdates).length) {
          await groupsApi.updateGroup(id, coreUpdates as any);
        }
        await get().fetchGroups();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to update group' });
      }
    },

    deleteGroup: async (id: string) => {
      try {
        await groupsApi.initialize();
        const res = await groupsApi.deleteGroup(id);
        if (!res.success) throw new Error(res.error || 'Failed to delete group');
        await get().fetchGroups();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete group' });
      }
    },

    toggleGroup: async (id: string) => {
      try {
        await groupsApi.initialize();
        await groupsApi.toggleGroup(id);
        await get().fetchGroups();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to toggle group' });
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
        await scenesApiService.initialize();
        const scenes = await scenesApiService.getScenes();
        set({ scenes });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to fetch scenes' });
      }
    },

    createScene: async (scene) => {
      try {
        await scenesApiService.initialize();
        const res = await scenesApiService.createScene(scene as any);
        if (!res.success) throw new Error(res.error || 'Failed to create scene');
        await get().fetchScenes();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to create scene' });
      }
    },

    updateScene: async (id: string, updates: Partial<Scene>) => {
      try {
        await scenesApiService.initialize();
        const res = await scenesApiService.updateScene(id, updates as any);
        if (!res.success) throw new Error(res.error || 'Failed to update scene');
        await get().fetchScenes();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to update scene' });
      }
    },

    deleteScene: async (id: string) => {
      try {
        await scenesApiService.initialize();
        const res = await scenesApiService.deleteScene(id);
        if (!res.success) throw new Error(res.error || 'Failed to delete scene');
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
        await scenesApiService.initialize();
        const scene = get().scenes.find(s => s.id === id);
        const groupId = (scene as any)?.group || '0';
        const res = await scenesApiService.recallScene(groupId, id, {});
        if (!res.success) throw new Error(res.error || 'Failed to activate scene');
        set({ activeScene: id });
        await get().fetchLights();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to activate scene' });
      }
    },

    deactivateScene: async () => {
      // No direct API; set activeScene null and refresh
      set({ activeScene: null });
      await get().fetchLights();
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
