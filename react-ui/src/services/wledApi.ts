import { WLEDDevice, WLEDSegment, WLEDEffect, WLEDPalette, GradientZone, ApiResponse } from '@/types';

class WLEDApiService {
  private baseUrl: string;
  private apiKey: string = '';

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async initializeApiKey(): Promise<void> {
    try {
      const response = await fetch('/get-key');
      this.apiKey = (await response.text()).trim();
    } catch (error) {
      console.error('Failed to initialize API key:', error);
      throw new Error('Could not initialize WLED API key');
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    if (!this.apiKey) {
      await this.initializeApiKey();
    }

    const url = `${this.baseUrl}/${this.apiKey}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : data.message || 'Request failed',
        message: data.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Device Discovery and Management
  async discoverDevices(): Promise<ApiResponse<WLEDDevice[]>> {
    return this.request<WLEDDevice[]>('/wled/discover');
  }

  async getDevice(deviceId: string): Promise<ApiResponse<WLEDDevice>> {
    return this.request<WLEDDevice>(`/wled/devices/${deviceId}`);
  }

  async getDeviceStatus(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/wled/devices/${deviceId}/status`);
  }

  // Gradient Management
  async setGradientMode(deviceId: string, mode: 'sparse' | 'full'): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/gradient/mode`, {
      method: 'PUT',
      body: JSON.stringify({ mode }),
    });
  }

  async createGradient(deviceId: string, zones: GradientZone[]): Promise<ApiResponse<string>> {
    return this.request<string>(`/wled/devices/${deviceId}/gradient`, {
      method: 'POST',
      body: JSON.stringify({ zones }),
    });
  }

  async updateGradient(deviceId: string, gradientId: string, zones: GradientZone[]): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/gradient/${gradientId}`, {
      method: 'PUT',
      body: JSON.stringify({ zones }),
    });
  }

  async deleteGradient(deviceId: string, gradientId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/gradient/${gradientId}`, {
      method: 'DELETE',
    });
  }

  async previewGradient(deviceId: string, zones: GradientZone[]): Promise<ApiResponse<string>> {
    return this.request<string>(`/wled/devices/${deviceId}/gradient/preview`, {
      method: 'POST',
      body: JSON.stringify({ zones }),
    });
  }

  // Segment Management
  async getSegments(deviceId: string): Promise<ApiResponse<WLEDSegment[]>> {
    return this.request<WLEDSegment[]>(`/wled/devices/${deviceId}/segments`);
  }

  async updateSegment(deviceId: string, segmentId: number, segment: Partial<WLEDSegment>): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/segments/${segmentId}`, {
      method: 'PUT',
      body: JSON.stringify(segment),
    });
  }

  async createSegment(deviceId: string, segment: Partial<WLEDSegment>): Promise<ApiResponse<number>> {
    return this.request<number>(`/wled/devices/${deviceId}/segments`, {
      method: 'POST',
      body: JSON.stringify(segment),
    });
  }

  async deleteSegment(deviceId: string, segmentId: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/segments/${segmentId}`, {
      method: 'DELETE',
    });
  }

  // Effects and Palettes
  async getEffects(deviceId: string): Promise<ApiResponse<WLEDEffect[]>> {
    return this.request<WLEDEffect[]>(`/wled/devices/${deviceId}/effects`);
  }

  async getPalettes(deviceId: string): Promise<ApiResponse<WLEDPalette[]>> {
    return this.request<WLEDPalette[]>(`/wled/devices/${deviceId}/palettes`);
  }

  async applyEffect(deviceId: string, effectId: number, parameters?: Record<string, any>): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/effects/${effectId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ parameters }),
    });
  }

  async applyPalette(deviceId: string, paletteId: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/palettes/${paletteId}/apply`, {
      method: 'POST',
    });
  }

  // Entertainment Integration
  async startScreenMirroring(deviceId: string, settings: any): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/entertainment/screen`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async stopScreenMirroring(deviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/entertainment/screen`, {
      method: 'DELETE',
    });
  }

  async startMusicVisualization(deviceId: string, settings: any): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/entertainment/music`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async stopMusicVisualization(deviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/entertainment/music`, {
      method: 'DELETE',
    });
  }

  // Synchronization
  async syncDevices(deviceIds: string[], settings: any): Promise<ApiResponse<void>> {
    return this.request<void>('/wled/sync', {
      method: 'POST',
      body: JSON.stringify({ deviceIds, settings }),
    });
  }

  async stopSync(deviceIds: string[]): Promise<ApiResponse<void>> {
    return this.request<void>('/wled/sync', {
      method: 'DELETE',
      body: JSON.stringify({ deviceIds }),
    });
  }

  // Performance Monitoring
  async getPerformanceMetrics(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/wled/devices/${deviceId}/metrics`);
  }

  async getSystemStatus(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/wled/devices/${deviceId}/system`);
  }

  // Configuration
  async updateConfiguration(deviceId: string, config: any): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async exportConfiguration(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/wled/devices/${deviceId}/config/export`);
  }

  async importConfiguration(deviceId: string, config: any): Promise<ApiResponse<void>> {
    return this.request<void>(`/wled/devices/${deviceId}/config/import`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}

export const wledApi = new WLEDApiService();
export default wledApi;