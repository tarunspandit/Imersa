import { 
  AutomationRule, 
  CreateRuleRequest, 
  UpdateRuleRequest, 
  ApiResponse,
  RuleStats,
  RuleTemplate,
  RuleCondition,
  RuleAction
} from '@/types';

const API_BASE = '/api';

class RulesAPI {
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

  // Rule CRUD Operations
  async getRules(): Promise<ApiResponse<Record<string, AutomationRule>>> {
    return this.request<Record<string, AutomationRule>>('/rules');
  }

  async getRule(id: string): Promise<ApiResponse<AutomationRule>> {
    return this.request<AutomationRule>(`/rules/${id}`);
  }

  async createRule(rule: CreateRuleRequest): Promise<ApiResponse<AutomationRule>> {
    return this.request<AutomationRule>('/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateRule(id: string, updates: UpdateRuleRequest): Promise<ApiResponse<AutomationRule>> {
    return this.request<AutomationRule>(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteRule(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/rules/${id}`, {
      method: 'DELETE',
    });
  }

  // Rule Control
  async enableRule(id: string): Promise<ApiResponse<AutomationRule>> {
    return this.updateRule(id, { enabled: true });
  }

  async disableRule(id: string): Promise<ApiResponse<AutomationRule>> {
    return this.updateRule(id, { enabled: false });
  }

  async triggerRule(id: string): Promise<ApiResponse<void>> {
    // Legacy DIYHue API doesn't support an explicit trigger; treat as no-op
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // Rule Templates
  async getRuleTemplates(): Promise<ApiResponse<RuleTemplate[]>> {
    const templates: RuleTemplate[] = [
      {
        id: 'motion-lights',
        name: 'Motion Activated Lights',
        description: 'Turn on lights when motion is detected',
        category: 'motion',
        template: {
          conditions: [
            {
              address: `/api/${this.getApiKey()}/sensors/1/state/presence`,
              operator: 'eq',
              value: true,
              type: 'sensor'
            }
          ],
          actions: [
            {
              address: `/api/${this.getApiKey()}/groups/1/action`,
              method: 'PUT',
              body: { on: true, bri: 200 }
            }
          ]
        },
        icon: '🚶'
      },
      {
        id: 'time-based-scene',
        name: 'Time-based Scene',
        description: 'Activate scene at specific time',
        category: 'time',
        template: {
          conditions: [
            {
              address: `/api/${this.getApiKey()}/sensors/1/state/localtime`,
              operator: 'in',
              value: 'T19:00:00/T19:05:00',
              type: 'time'
            }
          ],
          actions: [
            {
              address: `/api/${this.getApiKey()}/groups/1/action`,
              method: 'PUT',
              body: { scene: 'evening-scene' }
            }
          ]
        },
        icon: '⏰'
      },
      {
        id: 'button-scene-cycle',
        name: 'Button Scene Cycle',
        description: 'Cycle through scenes with button press',
        category: 'manual',
        template: {
          conditions: [
            {
              address: `/api/${this.getApiKey()}/sensors/2/state/buttonevent`,
              operator: 'eq',
              value: 1002,
              type: 'sensor'
            }
          ],
          actions: [
            {
              address: `/api/${this.getApiKey()}/groups/1/action`,
              method: 'PUT',
              body: { scene: 'next-scene' }
            }
          ]
        },
        icon: '🔘'
      },
      {
        id: 'temperature-comfort',
        name: 'Temperature Comfort',
        description: 'Adjust lighting based on temperature',
        category: 'sensor',
        template: {
          conditions: [
            {
              address: `/api/${this.getApiKey()}/sensors/3/state/temperature`,
              operator: 'lt',
              value: 2000,
              type: 'sensor'
            }
          ],
          actions: [
            {
              address: `/api/${this.getApiKey()}/groups/1/action`,
              method: 'PUT',
              body: { on: true, ct: 300, bri: 150 }
            }
          ]
        },
        icon: '🌡️'
      }
    ];

    return {
      success: true,
      data: templates,
      timestamp: new Date().toISOString(),
    };
  }

  // Rule Statistics
  async getRuleStats(): Promise<ApiResponse<RuleStats>> {
    const rulesResponse = await this.getRules();
    
    if (!rulesResponse.success || !rulesResponse.data) {
      return {
        success: false,
        error: 'Failed to get rules for stats',
        timestamp: new Date().toISOString(),
      };
    }

    const rules = Object.values(rulesResponse.data);
    const enabled = rules.filter(r => r.enabled).length;
    const triggered24h = rules.reduce((sum, r) => sum + (r.timesTriggered || 0), 0);
    
    const stats: RuleStats = {
      total: rules.length,
      enabled,
      triggered24h,
      avgResponseTime: 150, // Would come from execution metrics
      recentTriggers: [] // Would come from trigger history API
    };

    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  // Rule Validation
  async validateRule(rule: CreateRuleRequest): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> {
    const errors: string[] = [];

    // Basic validation
    if (!rule.name?.trim()) {
      errors.push('Rule name is required');
    }

    if (!rule.conditions?.length) {
      errors.push('At least one condition is required');
    }

    if (!rule.actions?.length) {
      errors.push('At least one action is required');
    }

    // Validate conditions
    rule.conditions?.forEach((condition, index) => {
      if (!condition.address) {
        errors.push(`Condition ${index + 1}: Address is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
    });

    // Validate actions
    rule.actions?.forEach((action, index) => {
      if (!action.address) {
        errors.push(`Action ${index + 1}: Address is required`);
      }
      if (!action.method) {
        errors.push(`Action ${index + 1}: Method is required`);
      }
    });

    return {
      success: true,
      data: {
        valid: errors.length === 0,
        errors
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Condition and Action Builders
  async getAvailableAddresses(): Promise<ApiResponse<{ 
    sensors: Array<{ address: string; name: string; type: string }>;
    groups: Array<{ address: string; name: string }>;
    lights: Array<{ address: string; name: string }>;
    scenes: Array<{ address: string; name: string }>;
  }>> {
    // This would typically come from the API, mock for now
    const mockData = {
      sensors: [
        { address: `/api/${this.getApiKey()}/sensors/1/state/presence`, name: 'Motion Sensor 1', type: 'CLIPPresence' },
        { address: `/api/${this.getApiKey()}/sensors/2/state/buttonevent`, name: 'Dimmer Switch', type: 'ZLLSwitch' },
        { address: `/api/${this.getApiKey()}/sensors/3/state/temperature`, name: 'Temperature Sensor', type: 'CLIPTemperature' }
      ],
      groups: [
        { address: `/api/${this.getApiKey()}/groups/1/action`, name: 'Living Room' },
        { address: `/api/${this.getApiKey()}/groups/2/action`, name: 'Kitchen' }
      ],
      lights: [
        { address: `/api/${this.getApiKey()}/lights/1/state`, name: 'Ceiling Light' },
        { address: `/api/${this.getApiKey()}/lights/2/state`, name: 'Table Lamp' }
      ],
      scenes: [
        { address: `/api/${this.getApiKey()}/groups/1/action`, name: 'Evening Scene' },
        { address: `/api/${this.getApiKey()}/groups/1/action`, name: 'Bright Scene' }
      ]
    };

    return {
      success: true,
      data: mockData,
      timestamp: new Date().toISOString(),
    };
  }

  // Bulk Operations
  async bulkUpdateRules(
    ruleIds: string[], 
    updates: UpdateRuleRequest
  ): Promise<ApiResponse<AutomationRule[]>> {
    try {
      const updatePromises = ruleIds.map(id => 
        this.updateRule(id, updates)
      );
      
      const results = await Promise.all(updatePromises);
      const updatedRules = results
        .filter(result => result.success && result.data)
        .map(result => result.data!);

      return {
        success: true,
        data: updatedRules,
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

  async bulkDeleteRules(ruleIds: string[]): Promise<ApiResponse<void>> {
    try {
      const deletePromises = ruleIds.map(id => 
        this.deleteRule(id)
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

export const rulesApi = new RulesAPI();