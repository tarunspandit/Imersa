import { useState, useEffect, useCallback, useRef } from 'react';
import { sensorsApiService } from '@/services/sensorsApi';
import type { 
  Sensor, 
  SensorAlert, 
  SensorDashboardStats, 
  SensorWebSocketEvent,
  SensorHistoryQuery,
  SensorHistoryResponse,
  CreateSensorRequest,
  UpdateSensorRequest,
  SensorBulkAction,
  SensorAutomation
} from '@/types/sensors';

export interface UseSensorsReturn {
  sensors: Sensor[];
  alerts: SensorAlert[];
  dashboardStats: SensorDashboardStats | null;
  automations: SensorAutomation[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshSensors: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  refreshDashboardStats: () => Promise<void>;
  refreshAutomations: () => Promise<void>;
  createSensor: (sensorData: CreateSensorRequest) => Promise<string>;
  updateSensor: (sensorId: string, updateData: UpdateSensorRequest) => Promise<void>;
  deleteSensor: (sensorId: string) => Promise<void>;
  updateSensorConfig: (sensorId: string, config: Partial<Sensor['config']>) => Promise<void>;
  getSensorHistory: (query: SensorHistoryQuery) => Promise<SensorHistoryResponse>;
  bulkAction: (action: SensorBulkAction) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  createAutomation: (automation: Omit<SensorAutomation, 'id'>) => Promise<string>;
  updateAutomation: (automationId: string, automation: Partial<SensorAutomation>) => Promise<void>;
  deleteAutomation: (automationId: string) => Promise<void>;
  discoverSensors: () => Promise<void>;
  pairSensor: (uniqueId: string, name: string) => Promise<string>;
  clearError: () => void;
}

export function useSensors(
  autoRefresh: boolean = true,
  refreshInterval: number = 10000
): UseSensorsReturn {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<SensorAlert[]>([]);
  const [dashboardStats, setDashboardStats] = useState<SensorDashboardStats | null>(null);
  const [automations, setAutomations] = useState<SensorAutomation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const wsUnsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize the API service
  const initialize = useCallback(async () => {
    if (isInitialized) return;
    
    try {
      await sensorsApiService.initialize();
      setIsInitialized(true);
      
      // Set up WebSocket connection for real-time updates
      sensorsApiService.connectWebSocket();
      
      // Subscribe to WebSocket events
      wsUnsubscribeRef.current = sensorsApiService.addWebSocketListener((event: SensorWebSocketEvent) => {
        if (!mountedRef.current) return;
        
        switch (event.type) {
          case 'sensor_state':
          case 'sensor_status':
            // Update sensor in the list
            setSensors(prev => prev.map(sensor => 
              sensor.id === event.sensorId 
                ? { 
                    ...sensor, 
                    ...(event.type === 'sensor_state' && { state: event.state }),
                    ...(event.type === 'sensor_status' && { 
                      status: event.status,
                      battery: event.battery,
                      signalStrength: event.signalStrength,
                      lastSeen: event.timestamp
                    })
                  }
                : sensor
            ));
            break;
            
          case 'sensor_alert':
            // Add new alert or update existing one
            setAlerts(prev => {
              const existing = prev.find(alert => alert.id === event.alert.id);
              if (existing) {
                return prev.map(alert => alert.id === event.alert.id ? event.alert : alert);
              } else {
                return [event.alert, ...prev];
              }
            });
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize sensors API service');
    }
  }, [isInitialized]);

  // Refresh sensors data
  const refreshSensors = useCallback(async () => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const sensorsData = await sensorsApiService.fetchSensors();
      
      if (mountedRef.current) {
        // Convert object to array
        const sensorsArray = Object.entries(sensorsData).map(([id, sensor]) => ({
          ...sensor,
          id,
        }));
        setSensors(sensorsArray);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sensors');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isInitialized]);

  // Refresh alerts
  const refreshAlerts = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      const alertsData = await sensorsApiService.getSensorAlerts(false);
      if (mountedRef.current) {
        setAlerts(alertsData);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, [isInitialized]);

  // Refresh dashboard stats
  const refreshDashboardStats = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      const stats = await sensorsApiService.getDashboardStats();
      if (mountedRef.current) {
        setDashboardStats(stats);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  }, [isInitialized]);

  // Refresh automations
  const refreshAutomations = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      const automationsData = await sensorsApiService.getSensorAutomations();
      if (mountedRef.current) {
        setAutomations(automationsData);
      }
    } catch (err) {
      console.error('Failed to fetch automations:', err);
    }
  }, [isInitialized]);

  // Sensor CRUD operations
  const createSensor = useCallback(async (sensorData: CreateSensorRequest): Promise<string> => {
    if (!isInitialized) throw new Error('API not initialized');

    try {
      const response = await sensorsApiService.createSensor(sensorData);
      if (response.success && response.data) {
        await refreshSensors();
        return response.data.id;
      } else {
        throw new Error(response.error || 'Failed to create sensor');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create sensor';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshSensors]);

  const updateSensor = useCallback(async (sensorId: string, updateData: UpdateSensorRequest): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.updateSensor(sensorId, updateData);
      if (response.success) {
        await refreshSensors();
      } else {
        throw new Error(response.error || 'Failed to update sensor');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update sensor';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshSensors]);

  const deleteSensor = useCallback(async (sensorId: string): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.deleteSensor(sensorId);
      if (response.success) {
        await refreshSensors();
      } else {
        throw new Error(response.error || 'Failed to delete sensor');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete sensor';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshSensors]);

  const updateSensorConfig = useCallback(async (sensorId: string, config: Partial<Sensor['config']>): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.updateSensorConfig(sensorId, config);
      if (response.success) {
        await refreshSensors();
      } else {
        throw new Error(response.error || 'Failed to update sensor configuration');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update sensor configuration';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshSensors]);

  // Historical data
  const getSensorHistory = useCallback(async (query: SensorHistoryQuery): Promise<SensorHistoryResponse> => {
    if (!isInitialized) throw new Error('API not initialized');

    try {
      return await sensorsApiService.getSensorHistory(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sensor history';
      setError(message);
      throw err;
    }
  }, [isInitialized]);

  // Bulk operations
  const bulkAction = useCallback(async (action: SensorBulkAction): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.bulkAction(action);
      if (response.success) {
        await refreshSensors();
      } else {
        throw new Error(response.error || 'Failed to perform bulk action');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to perform bulk action';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshSensors]);

  // Alert management
  const acknowledgeAlert = useCallback(async (alertId: string): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.acknowledgeAlert(alertId);
      if (response.success) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true, acknowledgedAt: new Date().toISOString() }
            : alert
        ));
      } else {
        throw new Error(response.error || 'Failed to acknowledge alert');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      setError(message);
      throw err;
    }
  }, [isInitialized]);

  const dismissAlert = useCallback(async (alertId: string): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.dismissAlert(alertId);
      if (response.success) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      } else {
        throw new Error(response.error || 'Failed to dismiss alert');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss alert';
      setError(message);
      throw err;
    }
  }, [isInitialized]);

  // Automation management
  const createAutomation = useCallback(async (automation: Omit<SensorAutomation, 'id'>): Promise<string> => {
    if (!isInitialized) throw new Error('API not initialized');

    try {
      const response = await sensorsApiService.createAutomation(automation);
      if (response.success && response.data) {
        await refreshAutomations();
        return response.data.id;
      } else {
        throw new Error(response.error || 'Failed to create automation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create automation';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshAutomations]);

  const updateAutomation = useCallback(async (automationId: string, automation: Partial<SensorAutomation>): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.updateAutomation(automationId, automation);
      if (response.success) {
        await refreshAutomations();
      } else {
        throw new Error(response.error || 'Failed to update automation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update automation';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshAutomations]);

  const deleteAutomation = useCallback(async (automationId: string): Promise<void> => {
    if (!isInitialized) return;

    try {
      const response = await sensorsApiService.deleteAutomation(automationId);
      if (response.success) {
        await refreshAutomations();
      } else {
        throw new Error(response.error || 'Failed to delete automation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete automation';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshAutomations]);

  // Discovery and pairing
  const discoverSensors = useCallback(async (): Promise<void> => {
    if (!isInitialized) return;

    try {
      await sensorsApiService.discoverSensors();
      // Discovery results would be handled by WebSocket events
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover sensors';
      setError(message);
      throw err;
    }
  }, [isInitialized]);

  const pairSensor = useCallback(async (uniqueId: string, name: string): Promise<string> => {
    if (!isInitialized) throw new Error('API not initialized');

    try {
      const response = await sensorsApiService.pairSensor(uniqueId, name);
      if (response.success && response.data) {
        await refreshSensors();
        return response.data.id;
      } else {
        throw new Error(response.error || 'Failed to pair sensor');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pair sensor';
      setError(message);
      throw err;
    }
  }, [isInitialized, refreshSensors]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Initial data fetch
  useEffect(() => {
    if (isInitialized) {
      Promise.all([
        refreshSensors(),
        refreshAlerts(),
        refreshDashboardStats(),
        refreshAutomations(),
      ]).catch(console.error);
    }
  }, [isInitialized, refreshSensors, refreshAlerts, refreshDashboardStats, refreshAutomations]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !isInitialized) return;

    refreshIntervalRef.current = setInterval(() => {
      Promise.all([
        refreshSensors(),
        refreshAlerts(),
        refreshDashboardStats(),
      ]).catch(console.error);
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isInitialized, refreshSensors, refreshAlerts, refreshDashboardStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current();
      }
      sensorsApiService.cleanup();
    };
  }, []);

  return {
    sensors,
    alerts,
    dashboardStats,
    automations,
    isLoading,
    error,
    refreshSensors,
    refreshAlerts,
    refreshDashboardStats,
    refreshAutomations,
    createSensor,
    updateSensor,
    deleteSensor,
    updateSensorConfig,
    getSensorHistory,
    bulkAction,
    acknowledgeAlert,
    dismissAlert,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    discoverSensors,
    pairSensor,
    clearError,
  };
}