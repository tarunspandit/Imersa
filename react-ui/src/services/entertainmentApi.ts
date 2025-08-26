// Entertainment API Service - Real-time streaming and position management
import {
  EntertainmentArea,
  LightPosition,
  EntertainmentControl,
  UpdatePositionsRequest,
  CreateAreaRequest,
  HueApiResponse,
  ApiResponse,
} from '@/types';

class EntertainmentApiService {
  private apiKey: string = '';
  private baseUrl: string = '';

  async initialize(): Promise<void> {
    try {
      const response = await fetch('/get-key');
      this.apiKey = (await response.text()).trim();
      this.baseUrl = `/api/${this.apiKey}`;
    } catch (error) {
      console.error('Failed to initialize Entertainment API:', error);
      throw new Error('Failed to get API key');
    }
  }

  /**
   * Get all entertainment areas
   */
  async getEntertainmentAreas(): Promise<EntertainmentArea[]> {
    const response = await fetch(`${this.baseUrl}/groups`);
    const groups = await response.json();
    
    // Filter for entertainment type groups
    return Object.entries(groups)
      .filter(([_, group]: [string, any]) => group.type === 'Entertainment')
      .map(([id, group]: [string, any]) => ({
        id,
        name: group.name || `Entertainment Area ${id}`,
        description: group.class || '',
        type: 'Entertainment' as const,
        lightIds: group.lights || [],
        isStreaming: group.stream?.active || false,
        stream: group.stream,
        locations: group.locations || {},
        class: group.class,
        state: group.state,
        action: group.action,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
  }

  /**
   * Get specific entertainment area by ID
   */
  async getEntertainmentArea(id: string): Promise<EntertainmentArea | null> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${id}`);
      const group = await response.json();
      
      if (group.type !== 'Entertainment') {
        return null;
      }

      return {
        id,
        name: group.name || `Entertainment Area ${id}`,
        description: group.class || '',
        type: 'Entertainment' as const,
        lightIds: group.lights || [],
        isStreaming: group.stream?.active || false,
        stream: group.stream,
        locations: group.locations || {},
        class: group.class,
        state: group.state,
        action: group.action,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to get entertainment area ${id}:`, error);
      return null;
    }
  }

  /**
   * Start streaming for an entertainment area
   */
  async startStreaming(areaId: string, options?: {
    syncMode?: 'individual' | 'group';
    intensity?: number;
  }): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${areaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stream: { active: true },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Streaming started successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to start streaming: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Stop streaming for an entertainment area
   */
  async stopStreaming(areaId: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${areaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stream: { active: false },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Streaming stopped successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stop streaming: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get light positions for an entertainment area
   */
  async getLightPositions(areaId: string): Promise<LightPosition[]> {
    try {
      const area = await this.getEntertainmentArea(areaId);
      if (!area) {
        throw new Error('Entertainment area not found');
      }

      const lightsResponse = await fetch(`${this.baseUrl}/lights`);
      const lights = await lightsResponse.json();

      return area.lightIds.map(lightId => {
        const position = area.locations?.[lightId] || [0, 0, 0];
        const light = lights[lightId];
        
        return {
          lightId,
          lightName: light?.name || `Light ${lightId}`,
          x: position[0],
          y: position[1],
          z: position[2],
        };
      });
    } catch (error) {
      console.error(`Failed to get light positions for area ${areaId}:`, error);
      return [];
    }
  }

  /**
   * Update light positions for an entertainment area
   */
  async updateLightPositions(
    areaId: string,
    positions: LightPosition[]
  ): Promise<ApiResponse<void>> {
    try {
      const locations: Record<string, [number, number, number]> = {};
      
      positions.forEach(pos => {
        locations[pos.lightId] = [pos.x, pos.y, pos.z];
      });

      const response = await fetch(`${this.baseUrl}/groups/${areaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locations }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Light positions updated successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update light positions: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create new entertainment area
   */
  async createEntertainmentArea(
    request: CreateAreaRequest
  ): Promise<ApiResponse<string>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: request.name,
          lights: request.lights,
          type: 'Entertainment',
          class: request.class || 'Other',
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.description || 'Failed to create area');
      }

      // Extract ID from result (Hue API returns [{success: {id: "groupId"}}])
      const areaId = result[0]?.success?.id;
      if (!areaId) {
        throw new Error('No area ID returned from API');
      }

      return {
        success: true,
        data: areaId,
        message: 'Entertainment area created successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create entertainment area: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Delete an entertainment area
   */
  async deleteEntertainmentArea(areaId: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${areaId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Entertainment area deleted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete entertainment area: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Toggle streaming status
   */
  async toggleStreaming(areaId: string): Promise<ApiResponse<boolean>> {
    try {
      const area = await this.getEntertainmentArea(areaId);
      if (!area) {
        throw new Error('Entertainment area not found');
      }

      const newState = !area.isStreaming;
      const result = newState
        ? await this.startStreaming(areaId)
        : await this.stopStreaming(areaId);

      if (!result.success) {
        return result as ApiResponse<boolean>;
      }

      return {
        success: true,
        data: newState,
        message: `Streaming ${newState ? 'started' : 'stopped'} successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to toggle streaming: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get streaming status for all entertainment areas
   */
  async getStreamingStatuses(): Promise<Record<string, boolean>> {
    try {
      const areas = await this.getEntertainmentAreas();
      const statuses: Record<string, boolean> = {};
      
      areas.forEach(area => {
        statuses[area.id] = area.isStreaming;
      });

      return statuses;
    } catch (error) {
      console.error('Failed to get streaming statuses:', error);
      return {};
    }
  }

  /**
   * Validate positions for an entertainment area
   */
  validatePositions(positions: LightPosition[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    positions.forEach((pos, index) => {
      if (!pos.lightId) {
        errors.push(`Position ${index + 1}: Light ID is required`);
      }
      if (pos.x < -1 || pos.x > 1) {
        errors.push(`Position ${index + 1}: X coordinate must be between -1 and 1`);
      }
      if (pos.y < -1 || pos.y > 1) {
        errors.push(`Position ${index + 1}: Y coordinate must be between -1 and 1`);
      }
      if (pos.z < -1 || pos.z > 1) {
        errors.push(`Position ${index + 1}: Z coordinate must be between -1 and 1`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const entertainmentApi = new EntertainmentApiService();
export default entertainmentApi;