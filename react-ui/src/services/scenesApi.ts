// Scenes API Service - Complete scene management with Hue API compatibility
import {
  Scene,
  SceneAction,
  CreateSceneRequest,
  UpdateSceneRequest,
  SceneRecallRequest,
  ScenePreview,
  SceneBulkAction,
  ApiResponse,
  HueLightState,
  LightGroup,
} from '@/types';

export interface HueScene {
  name: string;
  type: 'LightScene' | 'GroupScene';
  lights: string[];
  lightstates: Record<string, HueLightState>;
  owner: string;
  recycle: boolean;
  locked: boolean;
  appdata: Record<string, any>;
  picture: string;
  image?: string;
  lastupdated: string;
  group?: string;
}

class ScenesApiService {
  private apiKey: string = '';
  private baseUrl: string = '';

  async initialize(): Promise<void> {
    try {
      const response = await fetch('/get-key');
      this.apiKey = (await response.text()).trim();
      this.baseUrl = `/api/${this.apiKey}`;
    } catch (error) {
      console.error('Failed to initialize Scenes API:', error);
      throw new Error('Failed to get API key');
    }
  }

  /**
   * Get all scenes
   */
  async getScenes(): Promise<Scene[]> {
    const response = await fetch(`${this.baseUrl}/scenes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch scenes: ${response.statusText}`);
    }
    
    const scenes = await response.json();
    
    return Object.entries(scenes).map(([id, scene]: [string, any]) => ({
      id,
      name: scene.name || `Scene ${id}`,
      description: scene.name || '',
      type: scene.type || 'LightScene',
      group: scene.group,
      lights: scene.lights || [],
      lightstates: scene.lightstates || {},
      owner: scene.owner,
      appdata: scene.appdata || {},
      picture: scene.picture || '',
      image: scene.image,
      recycle: scene.recycle || false,
      locked: scene.locked || false,
      palette: scene.palette,
      speed: scene.speed,
      status: 'inactive',
      isActive: false,
      isFavorite: false,
      category: this.extractCategory(scene.name || ''),
      createdAt: scene.lastupdated || new Date().toISOString(),
      updatedAt: scene.lastupdated || new Date().toISOString(),
      lastUpdated: scene.lastupdated || new Date().toISOString(),
      createdBy: scene.owner,
    }));
  }

  /**
   * Get specific scene by ID
   */
  async getScene(id: string): Promise<Scene | null> {
    try {
      const response = await fetch(`${this.baseUrl}/scenes/${id}`);
      if (!response.ok) return null;
      
      const scene = await response.json();

      return {
        id,
        name: scene.name || `Scene ${id}`,
        description: scene.name || '',
        type: scene.type || 'LightScene',
        group: scene.group,
        lights: scene.lights || [],
        lightstates: scene.lightstates || {},
        owner: scene.owner,
        appdata: scene.appdata || {},
        picture: scene.picture || '',
        image: scene.image,
        recycle: scene.recycle || false,
        locked: scene.locked || false,
        palette: scene.palette,
        speed: scene.speed,
        status: 'inactive',
        isActive: false,
        isFavorite: false,
        category: this.extractCategory(scene.name || ''),
        createdAt: scene.lastupdated || new Date().toISOString(),
        updatedAt: scene.lastupdated || new Date().toISOString(),
        lastUpdated: scene.lastupdated || new Date().toISOString(),
        createdBy: scene.owner,
      };
    } catch (error) {
      console.error(`Failed to get scene ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new scene from current light state
   */
  async createScene(request: CreateSceneRequest): Promise<ApiResponse<string>> {
    try {
      const payload: any = {
        name: request.name,
        storelightstate: request.storelightstate ?? true,
        recycle: request.recycle ?? false,
        type: request.type || (request.group ? 'GroupScene' : 'LightScene'),
      };

      if (request.group) {
        payload.group = request.group;
      }

      if (request.lights && request.lights.length > 0) {
        payload.lights = request.lights;
      }

      const response = await fetch(`${this.baseUrl}/scenes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || (result.error && result.error.length > 0)) {
        const error = Array.isArray(result.error) ? result.error[0] : result.error;
        throw new Error(error?.description || 'Failed to create scene');
      }

      const sceneId = Array.isArray(result) && result[0]?.success?.id;
      if (!sceneId) {
        throw new Error('No scene ID returned from API');
      }

      return {
        success: true,
        data: sceneId,
        message: 'Scene created successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create scene: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update scene properties
   */
  async updateScene(
    id: string,
    updates: UpdateSceneRequest
  ): Promise<ApiResponse<void>> {
    try {
      const payload: any = {};
      
      if (updates.name) payload.name = updates.name;
      if (updates.lights) payload.lights = updates.lights;
      if (updates.storelightstate !== undefined) payload.storelightstate = updates.storelightstate;
      if (updates.recycle !== undefined) payload.recycle = updates.recycle;

      const response = await fetch(`${this.baseUrl}/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || (result.error && result.error.length > 0)) {
        const error = Array.isArray(result.error) ? result.error[0] : result.error;
        throw new Error(error?.description || 'Failed to update scene');
      }

      return {
        success: true,
        message: 'Scene updated successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update scene: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Delete a scene
   */
  async deleteScene(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/scenes/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok || (result.error && result.error.length > 0)) {
        const error = Array.isArray(result.error) ? result.error[0] : result.error;
        throw new Error(error?.description || 'Failed to delete scene');
      }

      return {
        success: true,
        message: 'Scene deleted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete scene: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Recall (activate) a scene
   */
  async recallScene(
    groupId: string,
    sceneId: string,
    options?: Omit<SceneRecallRequest, 'action'>
  ): Promise<ApiResponse<void>> {
    try {
      const payload: SceneAction = {
        scene: sceneId,
      };

      if (options?.transitiontime) {
        payload.transitiontime = options.transitiontime;
      }

      const response = await fetch(`${this.baseUrl}/groups/${groupId}/action`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || (result.error && result.error.length > 0)) {
        const error = Array.isArray(result.error) ? result.error[0] : result.error;
        throw new Error(error?.description || 'Failed to recall scene');
      }

      return {
        success: true,
        message: 'Scene activated successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to recall scene: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Store current light state in scene
   */
  async storeLightState(sceneId: string): Promise<ApiResponse<void>> {
    return this.updateScene(sceneId, { storelightstate: true });
  }

  /**
   * Get available groups for scene assignment
   */
  async getAvailableGroups(): Promise<LightGroup[]> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`);
      const groups = await response.json();
      
      return Object.entries(groups)
        .filter(([id]) => id !== '0') // Filter out "All lights" group
        .map(([id, group]: [string, any]) => ({
          id,
          name: group.name || `Group ${id}`,
          description: group.class || '',
          lightIds: group.lights || [],
          lights: group.lights || [],
          type: this.mapGroupType(group.type),
          class: group.class,
          color: { r: 255, g: 255, b: 255 },
          brightness: 0,
          isOn: false,
          syncMode: 'group' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
    } catch (error) {
      console.error('Failed to get available groups:', error);
      return [];
    }
  }

  /**
   * Generate scene preview/thumbnail
   */
  async generateScenePreview(sceneId: string): Promise<ScenePreview | null> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) return null;

      const colors: string[] = [];
      let totalBrightness = 0;
      let lightCount = 0;

      // Extract colors from light states
      Object.values(scene.lightstates).forEach((state) => {
        lightCount++;
        if (state.bri) totalBrightness += state.bri;

        if (state.xy) {
          const [r, g, b] = this.xyToRgb(state.xy[0], state.xy[1]);
          colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        } else if (state.hue !== undefined && state.sat !== undefined) {
          const [r, g, b] = this.hsvToRgb(state.hue / 65535, state.sat / 254, (state.bri || 254) / 254);
          colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        } else if (state.ct) {
          const [r, g, b] = this.ctToRgb(state.ct);
          colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        } else {
          colors.push('#ffffff');
        }
      });

      const avgBrightness = lightCount > 0 ? (totalBrightness / lightCount / 254) * 100 : 0;

      return {
        sceneId,
        thumbnail: this.generateThumbnail(colors, avgBrightness),
        colors: colors.slice(0, 5), // Limit to 5 colors
        brightness: avgBrightness,
        lightsCount: lightCount,
      };
    } catch (error) {
      console.error(`Failed to generate preview for scene ${sceneId}:`, error);
      return null;
    }
  }

  /**
   * Bulk scene operations
   */
  async bulkSceneAction(action: SceneBulkAction): Promise<ApiResponse<void>> {
    try {
      const results = await Promise.allSettled(
        action.sceneIds.map(sceneId => {
          switch (action.action) {
            case 'delete':
              return this.deleteScene(sceneId);
            case 'activate':
              if (!action.groupId) throw new Error('Group ID required for activate action');
              return this.recallScene(action.groupId, sceneId);
            default:
              return Promise.resolve({ success: true } as ApiResponse<void>);
          }
        })
      );

      const failed = results.filter(result => result.status === 'rejected').length;
      
      if (failed > 0) {
        return {
          success: false,
          error: `${failed} out of ${action.sceneIds.length} operations failed`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        message: `Bulk ${action.action} applied to ${action.sceneIds.length} scenes`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply bulk action: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get scenes filtered by category
   */
  async getScenesByCategory(category?: Scene['category']): Promise<Scene[]> {
    const scenes = await this.getScenes();
    
    if (!category) return scenes;
    
    return scenes.filter(scene => scene.category === category);
  }

  /**
   * Get scenes by group
   */
  async getScenesByGroup(groupId: string): Promise<Scene[]> {
    const scenes = await this.getScenes();
    return scenes.filter(scene => scene.group === groupId || scene.lights.length === 0);
  }

  // Helper methods
  private extractCategory(name: string): Scene['category'] {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('evening') || nameLower.includes('night')) return 'Evening';
    if (nameLower.includes('party') || nameLower.includes('celebration')) return 'Party';
    if (nameLower.includes('work') || nameLower.includes('focus')) return 'Work';
    if (nameLower.includes('relax') || nameLower.includes('calm')) return 'Relax';
    return 'Custom';
  }

  private mapGroupType(apiType: string): LightGroup['type'] {
    switch (apiType?.toLowerCase()) {
      case 'room': return 'room';
      case 'entertainment': return 'entertainment';
      case 'zone': return 'zone';
      default: return 'custom';
    }
  }

  private generateThumbnail(colors: string[], brightness: number): string {
    // Generate a simple gradient thumbnail as base64 SVG
    const width = 120;
    const height = 80;
    const stops = colors.length > 0 ? colors : ['#ffffff'];
    
    const gradientStops = stops.map((color, index) => {
      const offset = (index / (stops.length - 1)) * 100;
      return `<stop offset="${offset}%" stop-color="${color}" stop-opacity="${brightness / 100}" />`;
    }).join('');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sceneGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            ${gradientStops}
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#sceneGradient)" rx="8"/>
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  // Color conversion utilities
  private xyToRgb(x: number, y: number): [number, number, number] {
    const z = 1.0 - x - y;
    const Y = 1.0;
    const X = (Y / y) * x;
    const Z = (Y / y) * z;

    let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

    const max = Math.max(r, g, b);
    if (max > 1) {
      r /= max;
      g /= max;
      b /= max;
    }

    return [
      Math.max(0, Math.min(255, Math.round(r * 255))),
      Math.max(0, Math.min(255, Math.round(g * 255))),
      Math.max(0, Math.min(255, Math.round(b * 255))),
    ];
  }

  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = v - c;
    
    let r = 0, g = 0, b = 0;
    
    if (0 <= h && h < 1/6) {
      r = c; g = x; b = 0;
    } else if (1/6 <= h && h < 2/6) {
      r = x; g = c; b = 0;
    } else if (2/6 <= h && h < 3/6) {
      r = 0; g = c; b = x;
    } else if (3/6 <= h && h < 4/6) {
      r = 0; g = x; b = c;
    } else if (4/6 <= h && h < 5/6) {
      r = x; g = 0; b = c;
    } else if (5/6 <= h && h < 1) {
      r = c; g = 0; b = x;
    }
    
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  private ctToRgb(ct: number): [number, number, number] {
    // Convert color temperature to RGB
    const temp = 1000000 / ct;
    let r, g, b;

    if (temp <= 6600) {
      r = 255;
      g = temp <= 1000 ? 0 : 329.698727446 * Math.pow(temp - 60, -0.1332047592);
      b = temp >= 6600 ? 255 : temp <= 1900 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    } else {
      r = 351.97690566805693 * Math.pow(temp - 60, -0.1332047592);
      g = 325.4494125711974 * Math.pow(temp - 60, -0.0755148492);
      b = 255;
    }

    return [
      Math.max(0, Math.min(255, Math.round(r))),
      Math.max(0, Math.min(255, Math.round(g))),
      Math.max(0, Math.min(255, Math.round(b))),
    ];
  }
}

export const scenesApiService = new ScenesApiService();
export default scenesApiService;