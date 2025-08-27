import type { Light } from '@/types';

// Types for Philips Hue API compatibility
export interface HueLightState {
  on: boolean;
  bri: number; // 1-254
  hue?: number; // 0-65535
  sat?: number; // 0-254
  ct?: number; // 153-500
  xy?: [number, number];
  colormode?: 'hs' | 'ct' | 'xy';
  effect?: string;
  alert?: string;
  transitiontime?: number;
  reachable: boolean;
}

export interface HueLight {
  name: string;
  modelid: string;
  type: string;
  uniqueid?: string;
  swversion?: string;
  manufacturername?: string;
  state: HueLightState;
  capabilities?: {
    certified: boolean;
    control: {
      mindimlevel?: number;
      maxlumen?: number;
      colorgamuttype?: string;
      colorgamut?: [[number, number], [number, number], [number, number]];
      ct?: {
        min: number;
        max: number;
      };
    };
    streaming?: {
      renderer: boolean;
      proxy: boolean;
    };
  };
}

export interface LightType {
  id: string;
  name: string;
  manufacturer: string;
  capabilities: string[];
}

export interface BulkActionRequest {
  on?: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  ct?: number;
  effect?: string;
  transitiontime?: number;
}

class LightsApiService {
  private apiKey: string = '';
  private baseUrl: string = '';

  async initialize(): Promise<void> {
    try {
      const response = await fetch('/get-key');
      this.apiKey = (await response.text()).trim();
      this.baseUrl = `/api/${this.apiKey}`;
    } catch (error) {
      console.error('Failed to initialize API key:', error);
      throw new Error('Failed to initialize lights API service');
    }
  }

  // Core light operations
  async fetchLights(): Promise<Record<string, HueLight>> {
    const response = await fetch(`${this.baseUrl}/lights`);
    if (!response.ok) {
      throw new Error(`Failed to fetch lights: ${response.statusText}`);
    }
    return response.json();
  }

  async updateLightState(lightId: string, state: Partial<HueLightState>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/lights/${lightId}/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update light state: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateLightProperties(lightId: string, properties: { name?: string }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/lights/${lightId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(properties),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update light properties: ${response.statusText}`);
    }
    
    return response.json();
  }

  async deleteLight(lightId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/lights/${lightId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete light: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Discovery and manual add
  async scanForLights(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/lights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error(`Failed to start light discovery: ${response.statusText}`);
    }
    return response.json();
  }

  async manualAddLight(ip: string, protocol: string, config: any): Promise<any> {
    const payload = { ip, protocol, config };
    const response = await fetch(`${this.baseUrl}/lights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to add light manually: ${response.statusText}`);
    }
    return response.json();
  }

  async fetchNewLights(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/lights/new`);
    if (!response.ok) {
      throw new Error(`Failed to fetch new lights: ${response.statusText}`);
    }
    return response.json();
  }

  // Bulk operations
  async allLightsOn(): Promise<any> {
    return this.bulkAction({ on: true });
  }

  async allLightsOff(): Promise<any> {
    return this.bulkAction({ on: false });
  }

  async bulkAction(action: BulkActionRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/groups/0/action`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(action),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to perform bulk action: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Light types management
  async fetchLightTypes(): Promise<LightType[]> {
    try {
      const response = await fetch('/light-types');
      if (!response.ok) return [];
      const result = await response.json();
      return Array.isArray(result.result) ? result.result.map((type: string) => ({
        id: type,
        name: type,
        manufacturer: 'Generic',
        capabilities: []
      })) : [];
    } catch (error) {
      console.warn('Failed to fetch light types:', error);
      return [];
    }
  }

  async setLightType(lightId: string, modelId: string): Promise<any> {
    const response = await fetch('/light-types', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [lightId]: modelId }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to set light type: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Convenience methods with debouncing
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  async setBrightnessDebounced(lightId: string, brightness: number, delay: number = 120): Promise<void> {
    const key = `brightness-${lightId}`;
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await this.updateLightState(lightId, { bri: Math.max(1, Math.min(254, brightness)) });
        this.debounceTimers.delete(key);
      } catch (error) {
        console.error(`Failed to set brightness for light ${lightId}:`, error);
      }
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  async setColorTemperatureDebounced(lightId: string, ct: number, delay: number = 150): Promise<void> {
    const key = `ct-${lightId}`;
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await this.updateLightState(lightId, { ct: Math.max(153, Math.min(500, ct)) });
        this.debounceTimers.delete(key);
      } catch (error) {
        console.error(`Failed to set color temperature for light ${lightId}:`, error);
      }
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  async setHueDebounced(lightId: string, hue: number, delay: number = 150): Promise<void> {
    const key = `hue-${lightId}`;
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await this.updateLightState(lightId, { hue: Math.max(0, Math.min(65535, hue)) });
        this.debounceTimers.delete(key);
      } catch (error) {
        console.error(`Failed to set hue for light ${lightId}:`, error);
      }
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  async setSaturationDebounced(lightId: string, sat: number, delay: number = 150): Promise<void> {
    const key = `sat-${lightId}`;
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await this.updateLightState(lightId, { sat: Math.max(0, Math.min(254, sat)) });
        this.debounceTimers.delete(key);
      } catch (error) {
        console.error(`Failed to set saturation for light ${lightId}:`, error);
      }
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  // Cleanup method
  cleanup(): void {
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  // Convert Hue format to internal Light format
  convertHueLightToLight(id: string, hueLight: HueLight): Light {
    const { state } = hueLight;
    
    // Convert hue/sat to RGB (simplified conversion)
    let r = 255, g = 255, b = 255;
    if (state.hue !== undefined && state.sat !== undefined) {
      const h = (state.hue / 65535) * 360;
      const s = state.sat / 254;
      const v = (state.bri || 254) / 254;
      
      const c = v * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = v - c;
      
      let r1 = 0, g1 = 0, b1 = 0;
      if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
      else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
      else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
      else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
      else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
      else if (h >= 300 && h < 360) { r1 = c; g1 = 0; b1 = x; }
      
      r = Math.round((r1 + m) * 255);
      g = Math.round((g1 + m) * 255);
      b = Math.round((b1 + m) * 255);
    }

    return {
      id,
      name: hueLight.name,
      type: 'philips_hue',
      brand: hueLight.manufacturername || 'Philips',
      model: hueLight.modelid || 'Unknown',
      ip: '', // Not available in Hue API
      status: state.reachable ? 'online' : 'offline',
      brightness: Math.round(((state.bri || 1) / 254) * 100),
      color: { r, g, b },
      temperature: state.ct,
      isOn: state.on,
      effects: [],
      capabilities: {
        hasBrightness: true,
        hasColor: state.hue !== undefined,
        hasTemperature: state.ct !== undefined,
        hasEffects: false,
        hasGradient: false,
        hasSegments: false,
        supportsMusic: false,
        supportsScheduling: false,
      },
      groupIds: [],
      lastSeen: new Date().toISOString(),
      metadata: {
        uniqueid: hueLight.uniqueid,
        swversion: hueLight.swversion,
        state: state,
      },
    };
  }
}

// Create and initialize service instance
const lightsApiService = new LightsApiService();

// Export individual functions for better compatibility
export const getLights = () => lightsApiService.fetchLights();
export const updateLightState = (lightId: string, state: Partial<HueLightState>) => 
  lightsApiService.updateLightState(lightId, state);
export const updateLightProperties = (lightId: string, properties: { name?: string }) => 
  lightsApiService.updateLightProperties(lightId, properties);
export const deleteLight = (lightId: string) => 
  lightsApiService.deleteLight(lightId);
export const allLightsOn = () => lightsApiService.allLightsOn();
export const allLightsOff = () => lightsApiService.allLightsOff();
export const bulkAction = (action: BulkActionRequest) => 
  lightsApiService.bulkAction(action);
export const fetchLightTypes = () => lightsApiService.fetchLightTypes();
export const setLightType = (lightId: string, modelId: string) => 
  lightsApiService.setLightType(lightId, modelId);

// Export service instance for advanced usage
export { lightsApiService };
export default lightsApiService;
