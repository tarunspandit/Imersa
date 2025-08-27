import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Calendar, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { SensorHistoryResponse, SensorHistoryEntry } from '@/types/sensors';
import { cn } from '@/utils';

interface SensorChartProps {
  data: SensorHistoryResponse;
  height?: number;
  chartType?: 'line' | 'area' | 'bar';
  showLegend?: boolean;
  showGrid?: boolean;
  className?: string;
  onExport?: (format: 'png' | 'csv' | 'json') => void;
}

interface ChartDataPoint {
  timestamp: string;
  formattedTime: string;
  [key: string]: any;
}

const formatTimestamp = (timestamp: string, resolution: string = 'raw'): string => {
  const date = new Date(timestamp);
  
  switch (resolution) {
    case 'minute':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'hour':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'day':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
};

const getValueColor = (key: string): string => {
  const colorMap: Record<string, string> = {
    temperature: '#EF4444', // red
    humidity: '#3B82F6', // blue
    lightLevel: '#F59E0B', // amber
    pressure: '#10B981', // emerald
    motion: '#8B5CF6', // purple
    contact: '#F97316', // orange
    battery: '#84CC16', // lime
    presence: '#EC4899', // pink
    vibration: '#6366F1', // indigo
  };
  
  return colorMap[key] || '#6B7280'; // gray as default
};

const formatValue = (value: any, key: string): string => {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  
  if (typeof value === 'number') {
    switch (key) {
      case 'temperature':
        return `${value.toFixed(1)}°C`;
      case 'humidity':
        return `${value.toFixed(0)}%`;
      case 'lightLevel':
        return `${value.toFixed(0)} lux`;
      case 'pressure':
        return `${value.toFixed(1)} hPa`;
      case 'battery':
        return `${value.toFixed(0)}%`;
      default:
        return value.toFixed(2);
    }
  }
  
  return String(value);
};

const calculateTrend = (data: ChartDataPoint[], field: string): { direction: 'up' | 'down' | 'stable'; percentage: number } => {
  if (data.length < 2) return { direction: 'stable', percentage: 0 };
  
  const firstValue = data[0][field];
  const lastValue = data[data.length - 1][field];
  
  if (typeof firstValue !== 'number' || typeof lastValue !== 'number') {
    return { direction: 'stable', percentage: 0 };
  }
  
  if (firstValue === 0) return { direction: 'stable', percentage: 0 };
  
  const change = ((lastValue - firstValue) / firstValue) * 100;
  
  if (Math.abs(change) < 1) return { direction: 'stable', percentage: 0 };
  
  return {
    direction: change > 0 ? 'up' : 'down',
    percentage: Math.abs(change)
  };
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          <span className="font-medium">{entry.dataKey}:</span> {formatValue(entry.value, entry.dataKey)}
        </p>
      ))}
    </div>
  );
};

const SensorChart: React.FC<SensorChartProps> = ({
  data,
  height = 300,
  chartType = 'line',
  showLegend = true,
  showGrid = true,
  className,
  onExport
}) => {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  
  // Process data for chart
  const chartData = useMemo(() => {
    return data.data.map((entry: SensorHistoryEntry) => {
      const point: ChartDataPoint = {
        timestamp: entry.timestamp,
        formattedTime: formatTimestamp(entry.timestamp, data.query.resolution),
      };
      
      // Convert values to numbers for boolean fields
      Object.entries(entry.values).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          point[key] = value ? 1 : 0;
        } else if (typeof value === 'number') {
          point[key] = value;
        }
      });
      
      return point;
    });
  }, [data]);
  
  // Get available fields from data
  const availableFields = useMemo(() => {
    if (chartData.length === 0) return [];
    
    return Object.keys(chartData[0]).filter(key => 
      key !== 'timestamp' && key !== 'formattedTime' && 
      typeof chartData[0][key] === 'number'
    );
  }, [chartData]);
  
  // Initialize selected fields
  useEffect(() => {
    if (selectedFields.length === 0 && availableFields.length > 0) {
      setSelectedFields(availableFields.slice(0, 3)); // Show first 3 fields by default
    }
  }, [availableFields, selectedFields.length]);
  
  // Calculate trends for selected fields
  const trends = useMemo(() => {
    const trendsMap: Record<string, ReturnType<typeof calculateTrend>> = {};
    selectedFields.forEach(field => {
      trendsMap[field] = calculateTrend(chartData, field);
    });
    return trendsMap;
  }, [chartData, selectedFields]);
  
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    } as const;
    
    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-30" />}
            <XAxis 
              dataKey="formattedTime" 
              className="text-xs text-muted-foreground"
            />
            <YAxis className="text-xs text-muted-foreground" />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {selectedFields.map((field, index) => (
              <Area
                key={field}
                type="monotone"
                dataKey={field}
                stroke={getValueColor(field)}
                fill={getValueColor(field)}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );
        
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-30" />}
            <XAxis 
              dataKey="formattedTime" 
              className="text-xs text-muted-foreground"
            />
            <YAxis className="text-xs text-muted-foreground" />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {selectedFields.map((field, index) => (
              <Bar
                key={field}
                dataKey={field}
                fill={getValueColor(field)}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        );
        
      default: // line
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-30" />}
            <XAxis 
              dataKey="formattedTime" 
              className="text-xs text-muted-foreground"
            />
            <YAxis className="text-xs text-muted-foreground" />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {selectedFields.map((field, index) => (
              <Line
                key={field}
                type="monotone"
                dataKey={field}
                stroke={getValueColor(field)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: getValueColor(field) }}
              />
            ))}
          </LineChart>
        );
    }
  };
  
  if (chartData.length === 0) {
    return (
      <Card className={cn("p-6 text-center", className)}>
        <p className="text-muted-foreground">No data available for the selected time range</p>
      </Card>
    );
  }
  
  return (
    <Card className={cn("p-4", className)}>
      {/* Header with field selection and controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="font-semibold text-foreground">Sensor Data</h3>
          
          {/* Field selection */}
          <div className="flex flex-wrap gap-2">
            {availableFields.map(field => (
              <button
                key={field}
                onClick={() => {
                  setSelectedFields(prev => 
                    prev.includes(field) 
                      ? prev.filter(f => f !== field)
                      : [...prev, field]
                  );
                }}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  selectedFields.includes(field)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {field}
              </button>
            ))}
          </div>
        </div>
        
        {/* Export button */}
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport('csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>
      
      {/* Trend indicators */}
      {selectedFields.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
          {selectedFields.map(field => {
            const trend = trends[field];
            const lastValue = chartData[chartData.length - 1]?.[field];
            
            return (
              <div key={field} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getValueColor(field) }}
                />
                <span className="text-sm font-medium capitalize">{field}:</span>
                <span className="text-sm font-bold">
                  {lastValue !== undefined ? formatValue(lastValue, field) : 'N/A'}
                </span>
                {trend.direction !== 'stable' && (
                  <div className="flex items-center">
                    {trend.direction === 'up' ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={cn(
                      "text-xs ml-1",
                      trend.direction === 'up' ? "text-green-500" : "text-red-500"
                    )}>
                      {trend.percentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Chart */}
      <div className="w-full">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
      
      {/* Summary statistics */}
      {data.summary && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(data.summary.min).map(([key, value]) => (
              <div key={key} className="text-center">
                <p className="text-muted-foreground capitalize">{key} Range</p>
                <p className="font-medium">
                  {formatValue(value, key)} - {formatValue(data.summary!.max[key], key)}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-2 text-muted-foreground">
            <Calendar className="h-4 w-4 inline mr-1" />
            {data.summary.count} data points from {new Date(data.query.startTime).toLocaleDateString()} to {new Date(data.query.endTime).toLocaleDateString()}
          </div>
        </div>
      )}
    </Card>
  );
};

export { SensorChart };
