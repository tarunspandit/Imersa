// Groups API Service - Complete group management and room organization
import {
  LightGroup,
  Room,
  GroupAction,
  BulkGroupOperation,
  GroupCreationRequest,
  ApiResponse,
  Light,
} from '@/types';

class GroupsApiService {
  private apiKey: string = '';
  private baseUrl: string = '';

  async initialize(): Promise<void> {
    try {
      const response = await fetch('/get-key');
      this.apiKey = (await response.text()).trim();
      this.baseUrl = `/api/${this.apiKey}`;
    } catch (error) {
      console.error('Failed to initialize Groups API:', error);
      throw new Error('Failed to get API key');
    }
  }

  /**
   * Get all light groups
   */
  async getGroups(): Promise<LightGroup[]> {
    const response = await fetch(`${this.baseUrl}/groups`);
    const groups = await response.json();
    
    return Object.entries(groups).map(([id, group]: [string, any]) => ({
      id,
      name: group.name || `Group ${id}`,
      description: group.class || '',
      lightIds: group.lights || [],
      lights: group.lights || [], // API compatibility
      type: this.mapGroupType(group.type),
      class: group.class,
      color: this.extractColor(group.action),
      brightness: group.action?.bri ? Math.round((group.action.bri / 254) * 100) : 0,
      isOn: group.state?.any_on || false,
      syncMode: 'group' as const,
      state: group.state,
      action: group.action,
      stream: group.stream,
      locations: group.locations,
      room: group.class ? { name: group.name, class: group.class } : undefined,
      recycle: group.recycle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  /**
   * Get specific group by ID
   */
  async getGroup(id: string): Promise<LightGroup | null> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${id}`);
      const group = await response.json();

      return {
        id,
        name: group.name || `Group ${id}`,
        description: group.class || '',
        lightIds: group.lights || [],
        lights: group.lights || [],
        type: this.mapGroupType(group.type),
        class: group.class,
        color: this.extractColor(group.action),
        brightness: group.action?.bri ? Math.round((group.action.bri / 254) * 100) : 0,
        isOn: group.state?.any_on || false,
        syncMode: 'group' as const,
        state: group.state,
        action: group.action,
        stream: group.stream,
        locations: group.locations,
        room: group.class ? { name: group.name, class: group.class } : undefined,
        recycle: group.recycle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to get group ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new group
   */
  async createGroup(request: GroupCreationRequest): Promise<ApiResponse<string>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: request.name,
          lights: request.lights,
          type: request.type === 'room' ? 'Room' : request.type,
          class: request.class || 'Other',
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.description || 'Failed to create group');
      }

      const groupId = result[0]?.success?.id;
      if (!groupId) {
        throw new Error('No group ID returned from API');
      }

      return {
        success: true,
        data: groupId,
        message: 'Group created successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create group: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update group properties
   */
  async updateGroup(
    id: string,
    updates: Partial<Pick<LightGroup, 'name' | 'lightIds' | 'class'>>
  ): Promise<ApiResponse<void>> {
    try {
      const payload: any = {};
      
      if (updates.name) payload.name = updates.name;
      if (updates.lightIds) payload.lights = updates.lightIds;
      if (updates.class) payload.class = updates.class;

      const response = await fetch(`${this.baseUrl}/groups/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Group updated successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update group: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Delete a group
   */
  async deleteGroup(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Group deleted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete group: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Apply action to a group
   */
  async applyGroupAction(id: string, action: GroupAction): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${id}/action`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Group action applied successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply group action: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Toggle group on/off
   */
  async toggleGroup(id: string): Promise<ApiResponse<boolean>> {
    try {
      const group = await this.getGroup(id);
      if (!group) {
        throw new Error('Group not found');
      }

      const newState = !group.isOn;
      const result = await this.applyGroupAction(id, { on: newState });

      if (!result.success) {
        return result as ApiResponse<boolean>;
      }

      return {
        success: true,
        data: newState,
        message: `Group ${newState ? 'turned on' : 'turned off'} successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to toggle group: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Set group brightness
   */
  async setGroupBrightness(id: string, brightness: number): Promise<ApiResponse<void>> {
    if (brightness < 0 || brightness > 100) {
      return {
        success: false,
        error: 'Brightness must be between 0 and 100',
        timestamp: new Date().toISOString(),
      };
    }

    const bri = Math.round((brightness / 100) * 254);
    return this.applyGroupAction(id, { bri, on: brightness > 0 });
  }

  /**
   * Set group color
   */
  async setGroupColor(
    id: string,
    color: { r: number; g: number; b: number } | { hue: number; sat: number } | { ct: number }
  ): Promise<ApiResponse<void>> {
    let action: GroupAction;

    if ('r' in color) {
      // RGB color - convert to XY
      const xy = this.rgbToXy(color.r, color.g, color.b);
      action = { xy, on: true };
    } else if ('hue' in color) {
      // Hue/Saturation
      action = { hue: color.hue, sat: color.sat, on: true };
    } else {
      // Color temperature
      action = { ct: color.ct, on: true };
    }

    return this.applyGroupAction(id, action);
  }

  /**
   * Apply bulk operation to multiple groups
   */
  async applyBulkOperation(operation: BulkGroupOperation): Promise<ApiResponse<void>> {
    try {
      const results = await Promise.allSettled(
        operation.groupIds.map(groupId => this.applyGroupAction(groupId, operation.action))
      );

      const failed = results.filter(result => result.status === 'rejected').length;
      
      if (failed > 0) {
        return {
          success: false,
          error: `${failed} out of ${operation.groupIds.length} operations failed`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        message: `Bulk operation applied to ${operation.groupIds.length} groups`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply bulk operation: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get groups organized by rooms
   */
  async getGroupsByRoom(): Promise<Record<string, LightGroup[]>> {
    const groups = await this.getGroups();
    const roomGroups: Record<string, LightGroup[]> = {};

    groups.forEach(group => {
      const roomName = group.class || 'Other';
      if (!roomGroups[roomName]) {
        roomGroups[roomName] = [];
      }
      roomGroups[roomName].push(group);
    });

    return roomGroups;
  }

  /**
   * Get available lights for group creation
   */
  async getAvailableLights(): Promise<Light[]> {
    try {
      const response = await fetch(`${this.baseUrl}/lights`);
      const lights = await response.json();

      return Object.entries(lights).map(([id, light]: [string, any]) => ({
        id,
        name: light.name || `Light ${id}`,
        type: this.mapLightType(light.type),
        brand: light.manufacturername || 'Unknown',
        model: light.modelid || 'Unknown',
        ip: '',
        status: light.state?.reachable ? 'online' : 'offline',
        brightness: light.state?.bri ? Math.round((light.state.bri / 254) * 100) : 0,
        color: {
          r: 255,
          g: 255,
          b: 255,
        },
        temperature: light.state?.ct,
        isOn: light.state?.on || false,
        effects: [],
        capabilities: {
          hasBrightness: true,
          hasColor: light.capabilities?.control?.colorgamut !== undefined,
          hasTemperature: light.capabilities?.control?.ct !== undefined,
          hasEffects: false,
          hasGradient: false,
          hasSegments: false,
          supportsMusic: false,
          supportsScheduling: false,
        },
        groupIds: [],
        state: light.state,
        uniqueid: light.uniqueid,
        manufacturername: light.manufacturername,
        modelid: light.modelid,
        productname: light.productname,
        swversion: light.swversion,
        lastSeen: new Date().toISOString(),
        metadata: {},
      }));
    } catch (error) {
      console.error('Failed to get available lights:', error);
      return [];
    }
  }

  /**
   * Get room classes/types
   */
  getRoomClasses(): string[] {
    return [
      'Living room',
      'Kitchen',
      'Dining',
      'Bedroom',
      'Kids bedroom',
      'Bathroom',
      'Nursery',
      'Recreation',
      'Office',
      'Gym',
      'Hallway',
      'Toilet',
      'Front door',
      'Garage',
      'Terrace',
      'Garden',
      'Driveway',
      'Carport',
      'Other',
    ];
  }

  // Helper methods
  private mapGroupType(apiType: string): LightGroup['type'] {
    switch (apiType?.toLowerCase()) {
      case 'room':
        return 'room';
      case 'entertainment':
        return 'entertainment';
      case 'zone':
        return 'zone';
      case 'luminaire':
        return 'custom';
      case 'lightsource':
        return 'custom';
      case 'lightgroup':
        return 'custom';
      default:
        return 'custom';
    }
  }

  private mapLightType(apiType: string): Light['type'] {
    const type = apiType?.toLowerCase() || '';
    if (type.includes('hue')) return 'philips_hue';
    if (type.includes('wled')) return 'wled';
    if (type.includes('yeelight')) return 'yeelight';
    if (type.includes('nanoleaf')) return 'nanoleaf';
    return 'generic';
  }

  private extractColor(action: any): { r: number; g: number; b: number; w?: number } {
    if (!action) return { r: 255, g: 255, b: 255 };

    if (action.xy) {
      const [r, g, b] = this.xyToRgb(action.xy[0], action.xy[1]);
      return { r, g, b };
    }

    if (action.hue && action.sat) {
      const [r, g, b] = this.hsvToRgb(action.hue / 65535, action.sat / 254, 1);
      return { r, g, b };
    }

    return { r: 255, g: 255, b: 255 };
  }

  private rgbToXy(r: number, g: number, b: number): [number, number] {
    // Simplified RGB to XY conversion
    const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
    
    const x = X / (X + Y + Z);
    const y = Y / (X + Y + Z);
    
    return [Number(x.toFixed(4)), Number(y.toFixed(4))];
  }

  private xyToRgb(x: number, y: number): [number, number, number] {
    // Simplified XY to RGB conversion
    const z = 1.0 - x - y;
    const Y = 1.0; // Assume max brightness
    const X = (Y / y) * x;
    const Z = (Y / y) * z;

    let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

    // Normalize and clamp
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
}

export const groupsApi = new GroupsApiService();
export default groupsApi;