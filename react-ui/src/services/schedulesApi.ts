import { 
  Schedule, 
  CreateScheduleRequest, 
  UpdateScheduleRequest, 
  ApiResponse,
  ScheduleStats,
  ScheduleTemplate,
  ScheduleConflict,
  SunrisesetState
} from '@/types';

const API_BASE = '/api';

class SchedulesAPI {
  private apiKey: string = '';

  async initialize(): Promise<void> {
    try {
      const response = await fetch('/get-key');
      this.apiKey = (await response.text()).trim();
    } catch (error) {
      console.error('Failed to get API key:', error);
      throw error;
    }
  }

  private getApiKey(): string {
    if (!this.apiKey) {
      throw new Error('API not initialized. Call initialize() first.');
    }
    return this.apiKey;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}/${this.getApiKey()}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Schedule CRUD Operations
  async getSchedules(): Promise<ApiResponse<Record<string, Schedule>>> {
    return this.request<Record<string, Schedule>>('/schedules');
  }

  async getSchedule(id: string): Promise<ApiResponse<Schedule>> {
    return this.request<Schedule>(`/schedules/${id}`);
  }

  async createSchedule(schedule: CreateScheduleRequest): Promise<ApiResponse<Schedule>> {
    return this.request<Schedule>('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  }

  async updateSchedule(id: string, updates: UpdateScheduleRequest): Promise<ApiResponse<Schedule>> {
    return this.request<Schedule>(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSchedule(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  // Schedule Control
  async enableSchedule(id: string): Promise<ApiResponse<Schedule>> {
    return this.updateSchedule(id, { status: 'enabled' });
  }

  async disableSchedule(id: string): Promise<ApiResponse<Schedule>> {
    return this.updateSchedule(id, { status: 'disabled' });
  }

  async triggerSchedule(id: string): Promise<ApiResponse<void>> {
    // Legacy DIYHue API doesn't expose a trigger endpoint. No-op success.
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // Schedule Templates
  async getScheduleTemplates(): Promise<ApiResponse<ScheduleTemplate[]>> {
    // Mock templates for now - could be from API later
    const templates: ScheduleTemplate[] = [
      {
        id: 'morning-routine',
        name: 'Morning Routine',
        description: 'Gradually brighten lights in the morning',
        category: 'lighting',
        template: {
          type: 'daily',
          time: '07:00',
          command: {
            address: `/api/${this.getApiKey()}/groups/1/action`,
            method: 'PUT',
            body: { on: true, bri: 150, ct: 200 }
          }
        },
        icon: '🌅'
      },
      {
        id: 'evening-wind-down',
        name: 'Evening Wind Down',
        description: 'Dim lights for relaxation',
        category: 'comfort',
        template: {
          type: 'daily',
          time: '21:00',
          command: {
            address: `/api/${this.getApiKey()}/groups/1/action`,
            method: 'PUT',
            body: { on: true, bri: 50, ct: 400 }
          }
        },
        icon: '🌙'
      },
      {
        id: 'sunset-activation',
        name: 'Sunset Activation',
        description: 'Turn on lights at sunset',
        category: 'lighting',
        template: {
          type: 'sunset',
          offset: 0,
          command: {
            address: `/api/${this.getApiKey()}/groups/1/action`,
            method: 'PUT',
            body: { on: true, bri: 200 }
          }
        },
        icon: '🌇'
      },
      {
        id: 'security-patrol',
        name: 'Security Patrol',
        description: 'Random light activation for security',
        category: 'security',
        template: {
          type: 'daily',
          time: '20:00',
          randomization: 120,
          command: {
            address: `/api/${this.getApiKey()}/groups/2/action`,
            method: 'PUT',
            body: { on: true, bri: 180 }
          }
        },
        icon: '🔒'
      }
    ];

    return {
      success: true,
      data: templates,
      timestamp: new Date().toISOString(),
    };
  }

  // Schedule Statistics
  async getScheduleStats(): Promise<ApiResponse<ScheduleStats>> {
    const schedulesResponse = await this.getSchedules();
    
    if (!schedulesResponse.success || !schedulesResponse.data) {
      return {
        success: false,
        error: 'Failed to get schedules for stats',
        timestamp: new Date().toISOString(),
      };
    }

    const schedules = Object.values(schedulesResponse.data);
    const active = schedules.filter(s => s.status === 'enabled').length;
    
    const stats: ScheduleStats = {
      total: schedules.length,
      active,
      completed: 0, // Would come from execution history
      failed: 0, // Would come from execution history
      recentExecutions: [] // Would come from execution history API
    };

    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  // Conflict Detection
  async detectConflicts(): Promise<ApiResponse<ScheduleConflict[]>> {
    const schedulesResponse = await this.getSchedules();
    
    if (!schedulesResponse.success || !schedulesResponse.data) {
      return {
        success: false,
        error: 'Failed to get schedules for conflict detection',
        timestamp: new Date().toISOString(),
      };
    }

    const conflicts: ScheduleConflict[] = [];
    const schedules = Object.values(schedulesResponse.data);
    
    // Simple time overlap detection
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const schedule1 = schedules[i];
        const schedule2 = schedules[j];
        
        if (schedule1.time === schedule2.time && 
            schedule1.status === 'enabled' && 
            schedule2.status === 'enabled') {
          conflicts.push({
            scheduleIds: [schedule1.id, schedule2.id],
            conflictType: 'time_overlap',
            description: `Schedules "${schedule1.name}" and "${schedule2.name}" are set for the same time`,
            severity: 'medium',
            suggestions: [
              'Adjust one schedule to a different time',
              'Combine the actions into a single schedule',
              'Add a small delay between executions'
            ]
          });
        }
      }
    }

    return {
      success: true,
      data: conflicts,
      timestamp: new Date().toISOString(),
    };
  }

  // Sunrise/Sunset Times
  async getSunriseSunset(date?: string): Promise<ApiResponse<SunrisesetState>> {
    // Mock implementation - would integrate with sunrise/sunset API
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const mockData: SunrisesetState = {
      sunrise: '06:30',
      sunset: '18:45',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      date: targetDate
    };

    return {
      success: true,
      data: mockData,
      timestamp: new Date().toISOString(),
    };
  }

  // Bulk Operations
  async bulkUpdateSchedules(
    scheduleIds: string[], 
    updates: UpdateScheduleRequest
  ): Promise<ApiResponse<Schedule[]>> {
    try {
      const updatePromises = scheduleIds.map(id => 
        this.updateSchedule(id, updates)
      );
      
      const results = await Promise.all(updatePromises);
      const updatedSchedules = results
        .filter(result => result.success && result.data)
        .map(result => result.data!);

      return {
        success: true,
        data: updatedSchedules,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk update failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async bulkDeleteSchedules(scheduleIds: string[]): Promise<ApiResponse<void>> {
    try {
      const deletePromises = scheduleIds.map(id => 
        this.deleteSchedule(id)
      );
      
      await Promise.all(deletePromises);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk delete failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const schedulesApi = new SchedulesAPI();