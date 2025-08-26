import type { 
  Sensor, 
  SensorHistoryQuery, 
  SensorHistoryResponse,
  CreateSensorRequest,
  UpdateSensorRequest,
  SensorBulkAction,
  SensorAlert,
  SensorDashboardStats,
  SensorDiscoveryResult,
  SensorAutomation
} from '@/types/sensors';

export interface SensorApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

class SensorsApiService {
  private apiKey: string = '';
  private baseUrl: string = '';
  private wsConnection: WebSocket | null = null;
  private wsListeners: Set<(event: any) => void> = new Set();

  async initialize(): Promise<void> {
    try {
      const response = await fetch('/get-key');
      this.apiKey = (await response.text()).trim();
      this.baseUrl = `/api/${this.apiKey}`;
    } catch (error) {
      console.error('Failed to initialize sensors API key:', error);
      throw new Error('Failed to initialize sensors API service');
    }
  }

  // Core sensor operations
  async fetchSensors(): Promise<Record<string, Sensor>> {
    const response = await fetch(`${this.baseUrl}/sensors`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sensors: ${response.statusText}`);
    }
    return response.json();
  }

  async fetchSensor(sensorId: string): Promise<Sensor> {
    const response = await fetch(`${this.baseUrl}/sensors/${sensorId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sensor: ${response.statusText}`);
    }
    return response.json();
  }

  async createSensor(sensorData: CreateSensorRequest): Promise<SensorApiResponse<{ id: string }>> {
    const response = await fetch(`${this.baseUrl}/sensors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sensorData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create sensor: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateSensor(sensorId: string, updateData: UpdateSensorRequest): Promise<SensorApiResponse<Sensor>> {
    const response = await fetch(`${this.baseUrl}/sensors/${sensorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update sensor: ${response.statusText}`);
    }
    
    return response.json();
  }

  async deleteSensor(sensorId: string): Promise<SensorApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/sensors/${sensorId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete sensor: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Sensor configuration
  async updateSensorConfig(sensorId: string, config: Partial<Sensor['config']>): Promise<SensorApiResponse<Sensor>> {
    const response = await fetch(`${this.baseUrl}/sensors/${sensorId}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update sensor configuration: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getSensorConfig(sensorId: string): Promise<Sensor['config']> {
    const response = await fetch(`${this.baseUrl}/sensors/${sensorId}/config`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sensor configuration: ${response.statusText}`);
    }
    return response.json();
  }

  // Historical data
  async getSensorHistory(query: SensorHistoryQuery): Promise<SensorHistoryResponse> {
    const params = new URLSearchParams({
      startTime: query.startTime,
      endTime: query.endTime,
      ...(query.resolution && { resolution: query.resolution }),
      ...(query.fields && { fields: query.fields.join(',') }),
    });

    const response = await fetch(`${this.baseUrl}/sensors/${query.sensorId}/history?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sensor history: ${response.statusText}`);
    }
    return response.json();
  }

  async exportSensorData(sensorId: string, startTime: string, endTime: string, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams({
      startTime,
      endTime,
      format,
    });

    const response = await fetch(`${this.baseUrl}/sensors/${sensorId}/export?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to export sensor data: ${response.statusText}`);
    }
    return response.blob();
  }

  // Bulk operations
  async bulkAction(action: SensorBulkAction): Promise<SensorApiResponse<{ processed: number; errors: string[] }>> {
    const response = await fetch(`${this.baseUrl}/sensors/bulk`, {
      method: 'POST',
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

  // Discovery and pairing
  async discoverSensors(): Promise<SensorDiscoveryResult[]> {
    const response = await fetch(`${this.baseUrl}/sensors/discover`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to discover sensors: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data || [];
  }

  async pairSensor(uniqueId: string, name: string): Promise<SensorApiResponse<{ id: string }>> {
    const response = await fetch(`${this.baseUrl}/sensors/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uniqueId, name }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to pair sensor: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Alerts and notifications
  async getSensorAlerts(acknowledged: boolean = false): Promise<SensorAlert[]> {
    const params = new URLSearchParams({ acknowledged: acknowledged.toString() });
    const response = await fetch(`${this.baseUrl}/sensors/alerts?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sensor alerts: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data || [];
  }

  async acknowledgeAlert(alertId: string): Promise<SensorApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/sensors/alerts/${alertId}/acknowledge`, {
      method: 'PUT',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to acknowledge alert: ${response.statusText}`);
    }
    
    return response.json();
  }

  async dismissAlert(alertId: string): Promise<SensorApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/sensors/alerts/${alertId}/dismiss`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to dismiss alert: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Dashboard statistics
  async getDashboardStats(): Promise<SensorDashboardStats> {
    const response = await fetch(`${this.baseUrl}/sensors/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard stats: ${response.statusText}`);
    }
    return response.json();
  }

  // Automations
  async getSensorAutomations(): Promise<SensorAutomation[]> {
    const response = await fetch(`${this.baseUrl}/sensors/automations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sensor automations: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data || [];
  }

  async createAutomation(automation: Omit<SensorAutomation, 'id'>): Promise<SensorApiResponse<{ id: string }>> {
    const response = await fetch(`${this.baseUrl}/sensors/automations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(automation),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create automation: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateAutomation(automationId: string, automation: Partial<SensorAutomation>): Promise<SensorApiResponse<SensorAutomation>> {
    const response = await fetch(`${this.baseUrl}/sensors/automations/${automationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(automation),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update automation: ${response.statusText}`);
    }
    
    return response.json();
  }

  async deleteAutomation(automationId: string): Promise<SensorApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/sensors/automations/${automationId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete automation: ${response.statusText}`);
    }
    
    return response.json();
  }

  // WebSocket connection for real-time updates
  connectWebSocket(): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/${this.apiKey}/sensors/ws`;
      
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('Sensors WebSocket connected');
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyListeners(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('Sensors WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.wsConnection.onerror = (error) => {
        console.error('Sensors WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to sensors WebSocket:', error);
    }
  }

  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  addWebSocketListener(callback: (event: any) => void): () => void {
    this.wsListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.wsListeners.delete(callback);
    };
  }

  private notifyListeners(data: any): void {
    this.wsListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('WebSocket listener error:', error);
      }
    });
  }

  // Utility methods
  getSensorTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      motion: '🏃‍♂️',
      daylight: '☀️',
      temperature: '🌡️',
      switch: '🔘',
      generic: '📡',
      humidity: '💧',
      pressure: '🌀',
      contact: '🚪',
      vibration: '📳',
    };
    return iconMap[type] || '📡';
  }

  formatSensorValue(value: number | boolean | string, unit?: string): string {
    if (typeof value === 'boolean') {
      return value ? 'Active' : 'Inactive';
    }
    
    if (typeof value === 'number') {
      return `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
    }
    
    return String(value);
  }

  getSensorStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      online: '#10B981', // green
      offline: '#6B7280', // gray
      error: '#EF4444', // red
      low_battery: '#F59E0B', // amber
      unreachable: '#8B5CF6', // purple
    };
    return colorMap[status] || '#6B7280';
  }

  // Cleanup method
  cleanup(): void {
    this.disconnectWebSocket();
    this.wsListeners.clear();
  }
}

export const sensorsApiService = new SensorsApiService();
export default sensorsApiService;