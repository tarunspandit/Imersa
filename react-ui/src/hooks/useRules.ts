import { useState, useEffect, useCallback } from 'react';
import { 
  AutomationRule, 
  CreateRuleRequest, 
  UpdateRuleRequest,
  RuleStats,
  RuleTemplate
} from '@/types';
import { rulesApi } from '@/services/rulesApi';

interface UseRulesState {
  rules: Record<string, AutomationRule>;
  loading: boolean;
  error: string | null;
  stats: RuleStats | null;
  templates: RuleTemplate[];
  availableAddresses: {
    sensors: Array<{ address: string; name: string; type: string }>;
    groups: Array<{ address: string; name: string }>;
    lights: Array<{ address: string; name: string }>;
    scenes: Array<{ address: string; name: string }>;
  } | null;
}

interface UseRulesActions {
  fetchRules: () => Promise<void>;
  createRule: (rule: CreateRuleRequest) => Promise<boolean>;
  updateRule: (id: string, updates: UpdateRuleRequest) => Promise<boolean>;
  deleteRule: (id: string) => Promise<boolean>;
  enableRule: (id: string) => Promise<boolean>;
  disableRule: (id: string) => Promise<boolean>;
  triggerRule: (id: string) => Promise<boolean>;
  validateRule: (rule: CreateRuleRequest) => Promise<{ valid: boolean; errors: string[] } | null>;
  fetchStats: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchAvailableAddresses: () => Promise<void>;
  bulkUpdateRules: (ids: string[], updates: UpdateRuleRequest) => Promise<boolean>;
  bulkDeleteRules: (ids: string[]) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export interface UseRulesReturn extends UseRulesState, UseRulesActions {}

export const useRules = (): UseRulesReturn => {
  const [state, setState] = useState<UseRulesState>({
    rules: {},
    loading: true,
    error: null,
    stats: null,
    templates: [],
    availableAddresses: null
  });

  // Initialize API and fetch initial data
  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        await rulesApi.initialize();
        await fetchRules();
        await fetchTemplates();
        await fetchStats();
        await fetchAvailableAddresses();
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Initialization failed',
          loading: false 
        }));
      }
    };

    initializeAndFetch();
  }, []);

  const fetchRules = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await rulesApi.getRules();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          rules: response.data!,
          loading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to fetch rules',
          loading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch rules',
        loading: false
      }));
    }
  }, []);

  const createRule = useCallback(async (rule: CreateRuleRequest): Promise<boolean> => {
    try {
      // Validate rule first
      const validation = await validateRule(rule);
      if (validation && !validation.valid) {
        setState(prev => ({
          ...prev,
          error: `Validation failed: ${validation.errors.join(', ')}`
        }));
        return false;
      }

      const response = await rulesApi.createRule(rule);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          rules: {
            ...prev.rules,
            [response.data!.id]: response.data!
          }
        }));
        await fetchStats(); // Update stats after creation
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to create rule'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create rule'
      }));
      return false;
    }
  }, []);

  const updateRule = useCallback(async (id: string, updates: UpdateRuleRequest): Promise<boolean> => {
    try {
      const response = await rulesApi.updateRule(id, updates);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          rules: {
            ...prev.rules,
            [id]: response.data!
          }
        }));
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to update rule'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update rule'
      }));
      return false;
    }
  }, []);

  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await rulesApi.deleteRule(id);
      
      if (response.success) {
        setState(prev => {
          const newRules = { ...prev.rules };
          delete newRules[id];
          return {
            ...prev,
            rules: newRules
          };
        });
        await fetchStats(); // Update stats after deletion
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to delete rule'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete rule'
      }));
      return false;
    }
  }, []);

  const enableRule = useCallback(async (id: string): Promise<boolean> => {
    return updateRule(id, { enabled: true });
  }, [updateRule]);

  const disableRule = useCallback(async (id: string): Promise<boolean> => {
    return updateRule(id, { enabled: false });
  }, [updateRule]);

  const triggerRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await rulesApi.triggerRule(id);
      
      if (response.success) {
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to trigger rule'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to trigger rule'
      }));
      return false;
    }
  }, []);

  const validateRule = useCallback(async (rule: CreateRuleRequest): Promise<{ valid: boolean; errors: string[] } | null> => {
    try {
      const response = await rulesApi.validateRule(rule);
      
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to validate rule:', error);
      return null;
    }
  }, []);

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const response = await rulesApi.getRuleStats();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          stats: response.data!
        }));
      }
    } catch (error) {
      console.error('Failed to fetch rule stats:', error);
    }
  }, []);

  const fetchTemplates = useCallback(async (): Promise<void> => {
    try {
      const response = await rulesApi.getRuleTemplates();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          templates: response.data!
        }));
      }
    } catch (error) {
      console.error('Failed to fetch rule templates:', error);
    }
  }, []);

  const fetchAvailableAddresses = useCallback(async (): Promise<void> => {
    try {
      const response = await rulesApi.getAvailableAddresses();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          availableAddresses: response.data!
        }));
      }
    } catch (error) {
      console.error('Failed to fetch available addresses:', error);
    }
  }, []);

  const bulkUpdateRules = useCallback(async (ids: string[], updates: UpdateRuleRequest): Promise<boolean> => {
    try {
      const response = await rulesApi.bulkUpdateRules(ids, updates);
      
      if (response.success && response.data) {
        setState(prev => {
          const updatedRules = { ...prev.rules };
          response.data!.forEach(rule => {
            updatedRules[rule.id] = rule;
          });
          return {
            ...prev,
            rules: updatedRules
          };
        });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to bulk update rules'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to bulk update rules'
      }));
      return false;
    }
  }, []);

  const bulkDeleteRules = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      const response = await rulesApi.bulkDeleteRules(ids);
      
      if (response.success) {
        setState(prev => {
          const newRules = { ...prev.rules };
          ids.forEach(id => delete newRules[id]);
          return {
            ...prev,
            rules: newRules
          };
        });
        await fetchStats();
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to bulk delete rules'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to bulk delete rules'
      }));
      return false;
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchRules();
    await fetchStats();
  }, [fetchRules, fetchStats]);

  return {
    ...state,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    enableRule,
    disableRule,
    triggerRule,
    validateRule,
    fetchStats,
    fetchTemplates,
    fetchAvailableAddresses,
    bulkUpdateRules,
    bulkDeleteRules,
    refresh
  };
};