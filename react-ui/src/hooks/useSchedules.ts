import { useState, useEffect, useCallback } from 'react';
import { 
  Schedule, 
  CreateScheduleRequest, 
  UpdateScheduleRequest,
  ScheduleStats,
  ScheduleTemplate,
  ScheduleConflict
} from '@/types';
import { schedulesApi } from '@/services/schedulesApi';
import { useAppStore } from '@/stores';

interface UseSchedulesState {
  schedules: Record<string, Schedule>;
  loading: boolean;
  error: string | null;
  stats: ScheduleStats | null;
  templates: ScheduleTemplate[];
  conflicts: ScheduleConflict[];
}

interface UseSchedulesActions {
  fetchSchedules: () => Promise<void>;
  createSchedule: (schedule: CreateScheduleRequest) => Promise<boolean>;
  updateSchedule: (id: string, updates: UpdateScheduleRequest) => Promise<boolean>;
  deleteSchedule: (id: string) => Promise<boolean>;
  enableSchedule: (id: string) => Promise<boolean>;
  disableSchedule: (id: string) => Promise<boolean>;
  triggerSchedule: (id: string) => Promise<boolean>;
  fetchStats: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  detectConflicts: () => Promise<void>;
  bulkUpdateSchedules: (ids: string[], updates: UpdateScheduleRequest) => Promise<boolean>;
  bulkDeleteSchedules: (ids: string[]) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export interface UseSchedulesReturn extends UseSchedulesState, UseSchedulesActions {}

export const useSchedules = (): UseSchedulesReturn => {
  const { addNotification } = useAppStore();
  const [state, setState] = useState<UseSchedulesState>({
    schedules: {},
    loading: true,
    error: null,
    stats: null,
    templates: [],
    conflicts: []
  });

  // Initialize API and fetch initial data
  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        await schedulesApi.initialize();
        await fetchSchedules();
        await fetchTemplates();
        await fetchStats();
        await detectConflicts();
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

  const fetchSchedules = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await schedulesApi.getSchedules();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          schedules: response.data!,
          loading: false
        }));
        addNotification({ type: 'success', title: 'Schedules Refreshed', message: `${Object.keys(response.data!).length} schedules` });
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to fetch schedules',
          loading: false
        }));
        addNotification({ type: 'error', title: 'Schedules', message: response.error || 'Failed to fetch schedules' });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch schedules',
        loading: false
      }));
    }
  }, []);

  const createSchedule = useCallback(async (schedule: CreateScheduleRequest): Promise<boolean> => {
    try {
      const response = await schedulesApi.createSchedule(schedule);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          schedules: {
            ...prev.schedules,
            [response.data!.id]: response.data!
          }
        }));
        await fetchStats(); // Update stats after creation
        await detectConflicts(); // Check for conflicts
        addNotification({ type: 'success', title: 'Schedule Created', message: response.data!.name || response.data!.id });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to create schedule'
        }));
        addNotification({ type: 'error', title: 'Create Schedule', message: response.error || '' });
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create schedule'
      }));
      return false;
    }
  }, []);

  const updateSchedule = useCallback(async (id: string, updates: UpdateScheduleRequest): Promise<boolean> => {
    try {
      const response = await schedulesApi.updateSchedule(id, updates);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          schedules: {
            ...prev.schedules,
            [id]: response.data!
          }
        }));
        await detectConflicts(); // Check for conflicts after update
        addNotification({ type: 'success', title: 'Schedule Updated', message: id });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to update schedule'
        }));
        addNotification({ type: 'error', title: 'Update Schedule', message: response.error || '' });
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update schedule'
      }));
      return false;
    }
  }, []);

  const deleteSchedule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await schedulesApi.deleteSchedule(id);
      
      if (response.success) {
        setState(prev => {
          const newSchedules = { ...prev.schedules };
          delete newSchedules[id];
          return {
            ...prev,
            schedules: newSchedules
          };
        });
        await fetchStats(); // Update stats after deletion
        addNotification({ type: 'success', title: 'Schedule Deleted', message: id });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to delete schedule'
        }));
        addNotification({ type: 'error', title: 'Delete Schedule', message: response.error || '' });
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete schedule'
      }));
      return false;
    }
  }, []);

  const enableSchedule = useCallback(async (id: string): Promise<boolean> => {
    return updateSchedule(id, { status: 'enabled' });
  }, [updateSchedule]);

  const disableSchedule = useCallback(async (id: string): Promise<boolean> => {
    return updateSchedule(id, { status: 'disabled' });
  }, [updateSchedule]);

  const triggerSchedule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await schedulesApi.triggerSchedule(id);
      
      if (response.success) {
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to trigger schedule'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to trigger schedule'
      }));
      return false;
    }
  }, []);

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const response = await schedulesApi.getScheduleStats();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          stats: response.data!
        }));
      }
    } catch (error) {
      console.error('Failed to fetch schedule stats:', error);
    }
  }, []);

  const fetchTemplates = useCallback(async (): Promise<void> => {
    try {
      const response = await schedulesApi.getScheduleTemplates();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          templates: response.data!
        }));
      }
    } catch (error) {
      console.error('Failed to fetch schedule templates:', error);
    }
  }, []);

  const detectConflicts = useCallback(async (): Promise<void> => {
    try {
      const response = await schedulesApi.detectConflicts();
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          conflicts: response.data!
        }));
      }
    } catch (error) {
      console.error('Failed to detect conflicts:', error);
    }
  }, []);

  const bulkUpdateSchedules = useCallback(async (ids: string[], updates: UpdateScheduleRequest): Promise<boolean> => {
    try {
      const response = await schedulesApi.bulkUpdateSchedules(ids, updates);
      
      if (response.success && response.data) {
        setState(prev => {
          const updatedSchedules = { ...prev.schedules };
          response.data!.forEach(schedule => {
            updatedSchedules[schedule.id] = schedule;
          });
          return {
            ...prev,
            schedules: updatedSchedules
          };
        });
        await detectConflicts();
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to bulk update schedules'
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to bulk update schedules'
      }));
      return false;
    }
  }, []);

  const bulkDeleteSchedules = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      const response = await schedulesApi.bulkDeleteSchedules(ids);
      
      if (response.success) {
        setState(prev => {
          const newSchedules = { ...prev.schedules };
          ids.forEach(id => delete newSchedules[id]);
          return {
            ...prev,
            schedules: newSchedules
          };
        });
        await fetchStats();
        addNotification({ type: 'success', title: 'Schedules Deleted', message: `${ids.length} schedules` });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to bulk delete schedules'
        }));
        addNotification({ type: 'error', title: 'Bulk Delete Schedules', message: response.error || '' });
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to bulk delete schedules'
      }));
      return false;
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchSchedules();
    await fetchStats();
    await detectConflicts();
  }, [fetchSchedules, fetchStats, detectConflicts]);

  return {
    ...state,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    enableSchedule,
    disableSchedule,
    triggerSchedule,
    fetchStats,
    fetchTemplates,
    detectConflicts,
    bulkUpdateSchedules,
    bulkDeleteSchedules,
    refresh
  };
};
