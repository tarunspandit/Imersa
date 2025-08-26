// Sensor types and interfaces for Imersa IoT system

export type SensorType = 'motion' | 'daylight' | 'temperature' | 'switch' | 'generic' | 'humidity' | 'pressure' | 'contact' | 'vibration';

export type SensorStatus = 'online' | 'offline' | 'error' | 'low_battery' | 'unreachable';

export interface SensorReading {
  value: number | boolean | string;
  unit?: string;
  timestamp: string;
  quality?: 'good' | 'poor' | 'uncertain';
}

export interface SensorThreshold {
  id: string;
  type: 'min' | 'max' | 'range' | 'change';
  value: number | [number, number];
  action: 'alert' | 'trigger_scene' | 'notification';
  actionParams?: Record<string, any>;
  enabled: boolean;
}

export interface SensorAutomation {
  id: string;
  name: string;
  triggerType: 'presence' | 'absence' | 'threshold' | 'time_based';
  conditions: {
    sensorId: string;
    operator: '>' | '<' | '=' | '!=' | 'between' | 'changed';
    value: number | boolean | string;
    duration?: number; // seconds
  }[];
  actions: {
    type: 'scene' | 'light_control' | 'notification' | 'webhook';
    params: Record<string, any>;
  }[];
  enabled: boolean;
  schedule?: {
    days: number[]; // 0-6, 0 = Sunday
    timeStart: string; // HH:mm
    timeEnd: string; // HH:mm
  };
}

export interface Sensor {
  id: string;
  name: string;
  type: SensorType;
  manufacturer: string;
  model: string;
  uniqueId?: string;
  softwareVersion?: string;
  
  // Status and connectivity
  status: SensorStatus;
  battery?: number; // 0-100 percentage
  lastSeen: string;
  signalStrength?: number; // 0-100 percentage
  
  // Current readings
  state: Record<string, SensorReading>;
  
  // Configuration
  config: {
    enabled: boolean;
    sensitivity?: number; // 0-100
    timeout?: number; // seconds
    calibrationOffset?: number;
    units?: string;
    reportingInterval?: number; // seconds
    changeThreshold?: number; // minimum change to report
  };
  
  // Automation and thresholds
  thresholds: SensorThreshold[];
  automations: string[]; // automation IDs
  
  // Location and grouping
  room?: string;
  zone?: string;
  coordinates?: { x: number; y: number; z?: number };
  tags?: string[];
  
  // Capabilities
  capabilities: {
    hasMotion?: boolean;
    hasLightLevel?: boolean;
    hasTemperature?: boolean;
    hasHumidity?: boolean;
    hasPressure?: boolean;
    hasContact?: boolean;
    hasVibration?: boolean;
    hasButton?: boolean;
    hasBattery?: boolean;
    isConfigurable?: boolean;
    supportsScheduling?: boolean;
  };
  
  // Historical data reference
  historicalDataRetention: number; // days
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// Motion sensor specific types
export interface MotionSensorState {
  presence: boolean;
  lastMotion?: string;
  occupancyTimeout?: number;
}

// Daylight sensor specific types
export interface DaylightSensorState {
  lightLevel: number; // lux
  daylight: boolean;
  sunrise?: string;
  sunset?: string;
}

// Temperature sensor specific types
export interface TemperatureSensorState {
  temperature: number;
  humidity?: number;
  pressure?: number;
  comfort?: 'too_cold' | 'cold' | 'comfortable' | 'warm' | 'too_warm';
}

// Switch sensor specific types
export interface SwitchSensorState {
  buttonEvent: number;
  lastButtonEvent?: string;
  battery?: number;
}

// Contact sensor specific types
export interface ContactSensorState {
  contact: boolean; // true = closed, false = open
  lastChanged?: string;
}

// Historical data types
export interface SensorHistoryEntry {
  timestamp: string;
  values: Record<string, number | boolean | string>;
  quality?: 'good' | 'poor' | 'uncertain';
}

export interface SensorHistoryQuery {
  sensorId: string;
  startTime: string;
  endTime: string;
  resolution?: 'raw' | 'minute' | 'hour' | 'day';
  fields?: string[];
}

export interface SensorHistoryResponse {
  sensorId: string;
  query: SensorHistoryQuery;
  data: SensorHistoryEntry[];
  summary?: {
    min: Record<string, number>;
    max: Record<string, number>;
    avg: Record<string, number>;
    count: number;
  };
}

// Sensor discovery and management
export interface SensorDiscoveryResult {
  id: string;
  name: string;
  type: SensorType;
  manufacturer: string;
  model: string;
  uniqueId: string;
  signalStrength: number;
  capabilities: Sensor['capabilities'];
  isNew: boolean;
}

export interface SensorBulkAction {
  sensorIds: string[];
  action: 'enable' | 'disable' | 'delete' | 'update_config';
  params?: Record<string, any>;
}

// API request/response types
export interface CreateSensorRequest {
  name: string;
  type: SensorType;
  config: Sensor['config'];
  room?: string;
  zone?: string;
  thresholds?: Omit<SensorThreshold, 'id'>[];
}

export interface UpdateSensorRequest {
  name?: string;
  config?: Partial<Sensor['config']>;
  room?: string;
  zone?: string;
  thresholds?: SensorThreshold[];
  tags?: string[];
}

export interface SensorAlert {
  id: string;
  sensorId: string;
  sensorName: string;
  type: 'threshold' | 'offline' | 'low_battery' | 'error';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value?: number | boolean | string;
  threshold?: SensorThreshold;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Real-time update types
export interface SensorStateUpdate {
  type: 'sensor_state';
  sensorId: string;
  state: Record<string, SensorReading>;
  timestamp: string;
}

export interface SensorStatusUpdate {
  type: 'sensor_status';
  sensorId: string;
  status: SensorStatus;
  battery?: number;
  signalStrength?: number;
  timestamp: string;
}

export interface SensorAlertUpdate {
  type: 'sensor_alert';
  alert: SensorAlert;
  timestamp: string;
}

export type SensorWebSocketEvent = SensorStateUpdate | SensorStatusUpdate | SensorAlertUpdate;

// Dashboard aggregation types
export interface SensorDashboardStats {
  totalSensors: number;
  onlineSensors: number;
  offlineSensors: number;
  alertsCount: number;
  lowBatteryCount: number;
  recentActivity: {
    motionDetections: number;
    temperatureChanges: number;
    alertsTriggered: number;
  };
}

// Export all types for use in components
export type {
  SensorType,
  SensorStatus,
  SensorReading,
  SensorThreshold,
  SensorAutomation,
  Sensor,
  MotionSensorState,
  DaylightSensorState,
  TemperatureSensorState,
  SwitchSensorState,
  ContactSensorState,
  SensorHistoryEntry,
  SensorHistoryQuery,
  SensorHistoryResponse,
  SensorDiscoveryResult,
  SensorBulkAction,
  CreateSensorRequest,
  UpdateSensorRequest,
  SensorAlert,
  SensorStateUpdate,
  SensorStatusUpdate,
  SensorAlertUpdate,
  SensorWebSocketEvent,
  SensorDashboardStats,
};