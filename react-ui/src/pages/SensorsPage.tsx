import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search,
  Filter,
  Plus,
  MoreVertical,
  Download,
  RefreshCw,
  Grid,
  List,
  AlertCircle,
  Activity,
  Battery,
  Wifi,
  Eye,
  Settings2,
  Bell,
  Clock,
  X
} from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { useAppStore } from '@/stores';
import { SensorCard, SensorChart, SensorConfig } from '@/components/sensors';
import { useSensors } from '@/hooks/useSensors';
import type { Sensor, SensorAlert, SensorHistoryQuery } from '@/types/sensors';
import { cn } from '@/utils';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'online' | 'offline' | 'error' | 'low_battery';
type SensorType = 'all' | 'motion' | 'daylight' | 'temperature' | 'switch' | 'generic' | 'humidity' | 'pressure';

const SensorsPage: React.FC = () => {
  const { addNotification } = useAppStore();
  const {
    sensors,
    alerts,
    dashboardStats,
    isLoading,
    error,
    refreshSensors,
    refreshAlerts,
    updateSensor,
    updateSensorConfig,
    acknowledgeAlert,
    dismissAlert,
    getSensorHistory,
    clearError
  } = useSensors();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sensorTypeFilter, setSensorTypeFilter] = useState<SensorType>('all');
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedSensorForChart, setSelectedSensorForChart] = useState<Sensor | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [showAlerts, setShowAlerts] = useState(false);

  // Filter and search sensors
  const filteredSensors = useMemo(() => {
    let filtered = sensors;

    // Apply status filter
    if (filterType !== 'all') {
      filtered = filtered.filter(sensor => sensor.status === filterType);
    }

    // Apply sensor type filter
    if (sensorTypeFilter !== 'all') {
      filtered = filtered.filter(sensor => sensor.type === sensorTypeFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      filtered = filtered.filter(sensor =>
        sensor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sensor.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sensor.zone?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [sensors, filterType, sensorTypeFilter, searchQuery]);

  // Get unique sensor types for filter
  const sensorTypes = useMemo(() => {
    const types = sensors.map(s => s.type);
    return Array.from(new Set(types));
  }, [sensors]);

  // Handle sensor configuration save
  const handleSensorConfigSave = async (
    sensorId: string,
    config: Partial<Sensor['config']>,
    thresholds?: any[]
  ) => {
    try {
      await updateSensorConfig(sensorId, config);
      // If thresholds are provided, update sensor with thresholds
      if (thresholds) {
        await updateSensor(sensorId, { thresholds });
      }
    } catch (err) {
      console.error('Failed to save sensor configuration:', err);
    }
  };

  // Handle show sensor history chart
  const handleShowChart = async (sensor: Sensor) => {
    setSelectedSensorForChart(sensor);
    
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const query: SensorHistoryQuery = {
        sensorId: sensor.id,
        startTime: yesterday.toISOString(),
        endTime: now.toISOString(),
        resolution: 'hour',
        fields: Object.keys(sensor.state)
      };
      
      const data = await getSensorHistory(query);
      setChartData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sensor history';
      addNotification({ type: 'error', title: 'Sensor History', message });
    }
  };

  // Handle alert actions
  const handleAlertAction = async (alertId: string, action: 'acknowledge' | 'dismiss') => {
    try {
      if (action === 'acknowledge') {
        await acknowledgeAlert(alertId);
      } else {
        await dismissAlert(alertId);
      }
    } catch (err) {
      console.error(`Failed to ${action} alert:`, err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sensors</h1>
          <p className="text-muted-foreground">
            Monitor and manage your IoT sensors
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAlerts(!showAlerts)}
            className={cn(alerts.length > 0 && "text-red-500")}
          >
            <Bell className="h-4 w-4 mr-2" />
            Alerts ({alerts.length})
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSensors}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Sensor
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearError}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardStats.totalSensors}</p>
                <p className="text-sm text-muted-foreground">Total Sensors</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Wifi className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardStats.onlineSensors}</p>
                <p className="text-sm text-muted-foreground">Online</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardStats.alertsCount}</p>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Battery className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardStats.lowBatteryCount}</p>
                <p className="text-sm text-muted-foreground">Low Battery</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Alerts Panel */}
      {showAlerts && alerts.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Active Alerts
          </h3>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  alert.severity === 'critical' && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
                  alert.severity === 'warning' && "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20",
                  alert.severity === 'info' && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                )}
              >
                <div>
                  <p className="font-medium">{alert.sensorName}</p>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                    <Clock className="h-3 w-3 mr-1" />
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAlertAction(alert.id, 'dismiss')}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sensors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Error</option>
            <option value="low_battery">Low Battery</option>
          </select>

          <select
            value={sensorTypeFilter}
            onChange={(e) => setSensorTypeFilter(e.target.value as SensorType)}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="all">All Types</option>
            {sensorTypes.map(type => (
              <option key={type} value={type} className="capitalize">
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* View Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredSensors.length} of {sensors.length} sensors
        </span>
        {(searchQuery || filterType !== 'all' || sensorTypeFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
              setSensorTypeFilter('all');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Sensors Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredSensors.length === 0 ? (
        <Card className="p-8 text-center">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No sensors found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || filterType !== 'all' || sensorTypeFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first sensor'
            }
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Sensor
          </Button>
        </Card>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        )}>
          {filteredSensors.map((sensor) => (
            <SensorCard
              key={sensor.id}
              sensor={sensor}
              compact={viewMode === 'list'}
              onSettingsClick={(sensor) => {
                setSelectedSensor(sensor);
                setConfigModalOpen(true);
              }}
              onMoreClick={(sensor) => {
                // Show dropdown menu with options
                const menu = document.createElement('div');
                menu.className = 'absolute z-50 bg-background border border-border rounded-lg shadow-lg py-2 min-w-[150px]';
                menu.innerHTML = `
                  <button class="w-full px-4 py-2 text-left hover:bg-muted text-sm flex items-center">
                    <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    View History
                  </button>
                  <button class="w-full px-4 py-2 text-left hover:bg-muted text-sm flex items-center">
                    <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    Settings
                  </button>
                `;
                
                // Position and show menu (simplified for demo)
                document.body.appendChild(menu);
                
                // Clean up after click
                setTimeout(() => {
                  document.body.removeChild(menu);
                }, 3000);
                
                // Handle menu clicks
                menu.addEventListener('click', (e) => {
                  const target = e.target as HTMLElement;
                  if (target.textContent?.includes('View History')) {
                    handleShowChart(sensor);
                  } else if (target.textContent?.includes('Settings')) {
                    setSelectedSensor(sensor);
                    setConfigModalOpen(true);
                  }
                  document.body.removeChild(menu);
                });
              }}
            />
          ))}
        </div>
      )}

      {/* Sensor Configuration Modal */}
      {selectedSensor && (
        <SensorConfig
          sensor={selectedSensor}
          isOpen={configModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedSensor(null);
          }}
          onSave={handleSensorConfigSave}
        />
      )}

      {/* Sensor Chart Modal */}
      {selectedSensorForChart && chartData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold">{selectedSensorForChart.name} - Historical Data</h2>
                <p className="text-sm text-muted-foreground">Last 24 hours</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedSensorForChart(null);
                  setChartData(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6">
              <SensorChart
                data={chartData}
                height={400}
                onExport={(format) => {
                  // Handle export
                  console.log('Export data in format:', format);
                }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SensorsPage;
