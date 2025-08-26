import React from 'react';
import { 
  Activity,
  Sun,
  Thermometer,
  ToggleLeft,
  Zap,
  Battery,
  BatteryLow,
  Wifi,
  WifiOff,
  AlertTriangle,
  Settings,
  MoreHorizontal,
  Droplets,
  Gauge
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import type { Sensor } from '@/types/sensors';
import { cn } from '@/utils';

interface SensorCardProps {
  sensor: Sensor;
  onSettingsClick?: (sensor: Sensor) => void;
  onMoreClick?: (sensor: Sensor) => void;
  compact?: boolean;
}

const getSensorIcon = (type: string, status: string) => {
  const icons = {
    motion: Activity,
    daylight: Sun,
    temperature: Thermometer,
    switch: ToggleLeft,
    humidity: Droplets,
    pressure: Gauge,
    contact: Zap,
    vibration: Activity,
    generic: Zap,
  };
  
  const IconComponent = icons[type as keyof typeof icons] || Zap;
  return <IconComponent className={cn("h-6 w-6", getStatusColor(status))} />;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online':
      return 'text-green-500';
    case 'offline':
      return 'text-gray-400';
    case 'error':
      return 'text-red-500';
    case 'low_battery':
      return 'text-yellow-500';
    case 'unreachable':
      return 'text-purple-500';
    default:
      return 'text-gray-400';
  }
};

const getStatusBadge = (status: string) => {
  const variants = {
    online: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    offline: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    low_battery: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    unreachable: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  };
  
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
      variants[status as keyof typeof variants] || variants.offline
    )}>
      {status.replace('_', ' ')}
    </span>
  );
};

const formatLastSeen = (lastSeen: string): string => {
  const date = new Date(lastSeen);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const formatSensorValue = (key: string, reading: any, type: string): string => {
  if (typeof reading.value === 'boolean') {
    return reading.value ? 'Active' : 'Inactive';
  }
  
  if (typeof reading.value === 'number') {
    switch (key) {
      case 'temperature':
        return `${reading.value.toFixed(1)}°C`;
      case 'humidity':
        return `${reading.value.toFixed(0)}%`;
      case 'lightLevel':
        return `${reading.value.toFixed(0)} lux`;
      case 'pressure':
        return `${reading.value.toFixed(1)} hPa`;
      case 'battery':
        return `${reading.value.toFixed(0)}%`;
      default:
        return `${reading.value.toFixed(2)}${reading.unit ? ` ${reading.unit}` : ''}`;
    }
  }
  
  return String(reading.value);
};

const SensorCard: React.FC<SensorCardProps> = ({ 
  sensor, 
  onSettingsClick, 
  onMoreClick, 
  compact = false 
}) => {
  const hasAlerts = sensor.status === 'error' || sensor.status === 'low_battery';
  const isOffline = sensor.status === 'offline' || sensor.status === 'unreachable';
  
  // Get primary sensor reading
  const primaryReading = Object.entries(sensor.state)[0];
  const primaryValue = primaryReading ? formatSensorValue(primaryReading[0], primaryReading[1], sensor.type) : 'No data';
  
  // Get additional readings for expanded view
  const additionalReadings = Object.entries(sensor.state).slice(1, 3);

  return (
    <Card className={cn(
      "sensor-card transition-all duration-200 hover:shadow-md",
      hasAlerts && "border-l-4 border-l-red-500",
      isOffline && "opacity-75",
      compact && "p-3"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            {getSensorIcon(sensor.type, sensor.status)}
            {hasAlerts && (
              <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-red-500 fill-current" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{sensor.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusBadge(sensor.status)}
              {sensor.room && (
                <span className="text-xs text-muted-foreground">
                  {sensor.room}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {/* Connectivity indicator */}
          {sensor.signalStrength !== undefined && (
            <div className="flex items-center">
              {sensor.status === 'online' ? (
                <Wifi className={cn(
                  "h-4 w-4",
                  sensor.signalStrength > 70 ? "text-green-500" :
                  sensor.signalStrength > 30 ? "text-yellow-500" : "text-red-500"
                )} />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" />
              )}
            </div>
          )}
          
          {/* Battery indicator */}
          {sensor.battery !== undefined && (
            <div className="flex items-center">
              {sensor.battery <= 20 ? (
                <BatteryLow className="h-4 w-4 text-red-500" />
              ) : (
                <Battery className={cn(
                  "h-4 w-4",
                  sensor.battery > 50 ? "text-green-500" : "text-yellow-500"
                )} />
              )}
              <span className="text-xs text-muted-foreground ml-1">
                {sensor.battery}%
              </span>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex space-x-1">
            {onSettingsClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSettingsClick(sensor)}
                className="h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {onMoreClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onMoreClick(sensor)}
                className="h-8 w-8"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Sensor readings */}
      <div className="mt-4">
        {/* Primary reading */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-foreground">
              {primaryValue}
            </p>
            <p className="text-sm text-muted-foreground">
              {primaryReading ? primaryReading[0].replace(/([A-Z])/g, ' $1').toLowerCase() : 'No data'}
            </p>
          </div>
          
          {/* Trend indicator */}
          {primaryReading && typeof primaryReading[1].value === 'number' && (
            <div className="text-right">
              <div className="flex items-center text-sm">
                {/* This would show trend based on historical data */}
                <span className="text-muted-foreground">
                  {formatLastSeen(primaryReading[1].timestamp)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Additional readings in compact mode */}
        {!compact && additionalReadings.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            {additionalReadings.map(([key, reading]) => (
              <div key={key} className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {formatSensorValue(key, reading, sensor.type)}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with last seen and alerts */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>Last seen {formatLastSeen(sensor.lastSeen)}</span>
        
        {sensor.thresholds.length > 0 && (
          <span className="flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {sensor.thresholds.filter(t => t.enabled).length} alert{sensor.thresholds.filter(t => t.enabled).length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Card>
  );
};

export { SensorCard };