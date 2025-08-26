import { YeelightDevice, YeelightMusicMode, AudioVisualizationSettings, ApiResponse } from '@/types';

class YeelightApiService {
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
      throw new Error('Could not initialize Yeelight API key');
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
  async discoverDevices(): Promise<ApiResponse<YeelightDevice[]>> {
    return this.request<YeelightDevice[]>('/yeelight/discover');
  }

  async getDevice(deviceId: string): Promise<ApiResponse<YeelightDevice>> {
    return this.request<YeelightDevice>(`/yeelight/devices/${deviceId}`);
  }

  async getDeviceStatus(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/yeelight/devices/${deviceId}/status`);
  }

  // Basic Light Control
  async setPower(deviceId: string, on: boolean, duration?: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/power`, {
      method: 'PUT',
      body: JSON.stringify({ on, duration }),
    });
  }

  async setBrightness(deviceId: string, brightness: number, duration?: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/brightness`, {
      method: 'PUT',
      body: JSON.stringify({ brightness, duration }),
    });
  }

  async setColor(deviceId: string, rgb: [number, number, number], duration?: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/color`, {
      method: 'PUT',
      body: JSON.stringify({ rgb, duration }),
    });
  }

  async setColorTemp(deviceId: string, colorTemp: number, duration?: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/colortemp`, {
      method: 'PUT',
      body: JSON.stringify({ colorTemp, duration }),
    });
  }

  async setHsv(deviceId: string, hue: number, saturation: number, duration?: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/hsv`, {
      method: 'PUT',
      body: JSON.stringify({ hue, saturation, duration }),
    });
  }

  // Music Mode Management
  async enableMusicMode(deviceId: string, settings: YeelightMusicMode): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/music/enable`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async disableMusicMode(deviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/music/disable`, {
      method: 'POST',
    });
  }

  async getMusicModeStatus(deviceId: string): Promise<ApiResponse<{ enabled: boolean; settings?: YeelightMusicMode }>> {
    return this.request<{ enabled: boolean; settings?: YeelightMusicMode }>(`/yeelight/devices/${deviceId}/music/status`);
  }

  async updateMusicSettings(deviceId: string, settings: Partial<YeelightMusicMode>): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/music/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Audio Visualization
  async startAudioVisualization(deviceId: string, settings: AudioVisualizationSettings): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/audio/start`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async stopAudioVisualization(deviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/audio/stop`, {
      method: 'POST',
    });
  }

  async getAudioVisualizationStatus(deviceId: string): Promise<ApiResponse<{ active: boolean; settings?: AudioVisualizationSettings }>> {
    return this.request<{ active: boolean; settings?: AudioVisualizationSettings }>(`/yeelight/devices/${deviceId}/audio/status`);
  }

  async updateAudioSettings(deviceId: string, settings: Partial<AudioVisualizationSettings>): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/audio/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Flow Effects
  async startFlow(deviceId: string, flow: any[]): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/flow/start`, {
      method: 'POST',
      body: JSON.stringify({ flow }),
    });
  }

  async stopFlow(deviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/flow/stop`, {
      method: 'POST',
    });
  }

  // Presets and Scenes
  async savePreset(deviceId: string, name: string): Promise<ApiResponse<string>> {
    return this.request<string>(`/yeelight/devices/${deviceId}/presets`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async loadPreset(deviceId: string, presetId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/presets/${presetId}/load`, {
      method: 'POST',
    });
  }

  async getPresets(deviceId: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/yeelight/devices/${deviceId}/presets`);
  }

  async deletePreset(deviceId: string, presetId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/presets/${presetId}`, {
      method: 'DELETE',
    });
  }

  // Network and Connection
  async testConnection(deviceId: string): Promise<ApiResponse<{ latency: number; success: boolean }>> {
    return this.request<{ latency: number; success: boolean }>(`/yeelight/devices/${deviceId}/test`);
  }

  async getNetworkInfo(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/yeelight/devices/${deviceId}/network`);
  }

  // Performance Monitoring
  async getPerformanceMetrics(deviceId: string): Promise<ApiResponse<{
    fps: number;
    latency: number;
    packetsPerSecond: number;
    errorRate: number;
    uptime: number;
  }>> {
    return this.request<{
      fps: number;
      latency: number;
      packetsPerSecond: number;
      errorRate: number;
      uptime: number;
    }>(`/yeelight/devices/${deviceId}/metrics`);
  }

  // Bulk Operations
  async bulkOperation(deviceIds: string[], operation: string, parameters: any): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/yeelight/bulk', {
      method: 'POST',
      body: JSON.stringify({ deviceIds, operation, parameters }),
    });
  }

  async syncDevices(deviceIds: string[], masterDeviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>('/yeelight/sync', {
      method: 'POST',
      body: JSON.stringify({ deviceIds, masterDeviceId }),
    });
  }

  async stopSync(deviceIds: string[]): Promise<ApiResponse<void>> {
    return this.request<void>('/yeelight/sync', {
      method: 'DELETE',
      body: JSON.stringify({ deviceIds }),
    });
  }

  // Configuration
  async updateConfiguration(deviceId: string, config: any): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async getConfiguration(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/yeelight/devices/${deviceId}/config`);
  }

  async exportConfiguration(deviceId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/yeelight/devices/${deviceId}/config/export`);
  }

  async importConfiguration(deviceId: string, config: any): Promise<ApiResponse<void>> {
    return this.request<void>(`/yeelight/devices/${deviceId}/config/import`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}

export const yeelightApi = new YeelightApiService();
export default yeelightApi;