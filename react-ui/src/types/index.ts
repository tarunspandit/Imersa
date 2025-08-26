// Core types for Imersa application

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  preferences: UserPreferences;
  createdAt: string;
  lastLogin?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    system: boolean;
  };
  dashboard: {
    compactMode: boolean;
    showGrid: boolean;
    autoRefresh: boolean;
  };
}

export interface Light {
  id: string;
  name: string;
  type: 'wled' | 'philips_hue' | 'yeelight' | 'nanoleaf' | 'generic';
  brand: string;
  model: string;
  ip: string;
  mac?: string;
  status: 'online' | 'offline' | 'error';
  brightness: number; // 0-100
  color: {
    r: number;
    g: number;
    b: number;
    w?: number; // white channel for RGBW
  };
  temperature?: number; // Color temperature in Kelvin
  isOn: boolean;
  effects: LightEffect[];
  capabilities: LightCapabilities;
  groupIds: string[];
  // Hue API compatibility
  state?: {
    on: boolean;
    bri: number; // 0-254
    hue?: number; // 0-65535
    sat?: number; // 0-254
    xy?: [number, number];
    ct?: number; // 153-500
    alert?: string;
    effect?: string;
    colormode?: 'hs' | 'xy' | 'ct';
    reachable?: boolean;
  };
  uniqueid?: string;
  manufacturername?: string;
  modelid?: string;
  productname?: string;
  swversion?: string;
  location?: {
    room: string;
    zone?: string;
    coordinates?: { x: number; y: number; z?: number };
  };
  lastSeen: string;
  metadata: Record<string, any>;
}

export interface LightCapabilities {
  hasBrightness: boolean;
  hasColor: boolean;
  hasTemperature: boolean;
  hasEffects: boolean;
  hasGradient: boolean;
  hasSegments: boolean;
  maxSegments?: number;
  supportsMusic: boolean;
  supportsScheduling: boolean;
}

export interface LightEffect {
  id: string;
  name: string;
  type: 'color' | 'pattern' | 'animation' | 'gradient' | 'music';
  parameters: Record<string, any>;
  preview?: string; // Base64 encoded preview image
}

export interface Scene {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  type: 'LightScene' | 'GroupScene';
  group?: string; // Group ID for GroupScene type
  lights: string[]; // Light IDs
  lightstates: Record<string, HueLightState>; // Light ID -> state
  owner?: string;
  appdata?: Record<string, any>;
  picture?: string;
  image?: string;
  recycle: boolean;
  locked: boolean;
  palette?: Record<string, any>;
  speed?: number;
  status: 'active' | 'inactive' | 'dynamic_palette';
  lightSettings?: LightSetting[]; // Enhanced light settings
  groupSettings?: GroupSetting[];
  transitions?: {
    duration: number; // milliseconds
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  schedule?: SceneSchedule;
  tags?: string[];
  isActive: boolean;
  isFavorite: boolean;
  category?: 'Evening' | 'Party' | 'Work' | 'Relax' | 'Custom';
  createdAt: string;
  updatedAt: string;
  lastUpdated: string;
  createdBy?: string;
}

export interface LightSetting {
  lightId: string;
  brightness: number;
  color: {
    r: number;
    g: number;
    b: number;
    w?: number;
  };
  temperature?: number;
  effectId?: string;
  effectParams?: Record<string, any>;
  isOn: boolean;
}

export interface GroupSetting {
  groupId: string;
  brightness: number;
  color: {
    r: number;
    g: number;
    b: number;
    w?: number;
  };
  effectId?: string;
  effectParams?: Record<string, any>;
  isOn: boolean;
}

export interface SceneSchedule {
  enabled: boolean;
  triggers: ScheduleTrigger[];
  timezone: string;
}

export interface ScheduleTrigger {
  id: string;
  type: 'time' | 'sunrise' | 'sunset' | 'event';
  time?: string; // HH:mm format
  offset?: number; // minutes offset for sunrise/sunset
  days: number[]; // 0-6, 0 = Sunday
  event?: string;
  enabled: boolean;
}

export interface LightGroup {
  id: string;
  name: string;
  description?: string;
  lightIds: string[];
  lights: string[]; // API compatibility
  type: 'room' | 'zone' | 'entertainment' | 'custom' | 'Luminaire' | 'Lightsource' | 'LightGroup';
  class?: string; // Room class like 'Living room', 'Kitchen', etc.
  color: {
    r: number;
    g: number;
    b: number;
    w?: number;
  };
  brightness: number;
  isOn: boolean;
  syncMode: 'individual' | 'group' | 'master';
  state?: GroupState;
  action?: GroupAction;
  entertainmentSettings?: EntertainmentSettings;
  // Entertainment-specific fields
  stream?: {
    active: boolean;
    owner?: string;
    proxymode?: boolean;
    proxynode?: string;
  };
  locations?: Record<string, [number, number, number]>;
  // Room management
  room?: {
    name: string;
    class: string;
  };
  // Metadata
  recycle?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Room Types for Group Management
export interface Room {
  id: string;
  name: string;
  class: string;
  groupIds: string[];
  lightIds: string[];
  metadata: {
    area?: number; // square meters
    height?: number; // meters
    tags?: string[];
  };
}

// Bulk Operations
export interface BulkGroupOperation {
  groupIds: string[];
  action: GroupAction;
  applyToLights?: boolean;
}

export interface GroupCreationRequest {
  name: string;
  type: LightGroup['type'];
  lights: string[];
  class?: string;
  room?: string;
}

export interface EntertainmentSettings {
  enabled: boolean;
  mode: 'screen' | 'audio' | 'manual' | 'ambilight';
  intensity: number; // 0-100
  speed: number; // 0-100
  sensitivity: number; // 0-100 for audio mode
  screenRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  audioSource?: string;
  colorPalette?: string[];
}

// Entertainment Areas Types
export interface EntertainmentArea {
  id: string;
  name: string;
  description?: string;
  type: 'Entertainment';
  lightIds: string[];
  isStreaming: boolean;
  stream?: {
    active: boolean;
    owner?: string;
    proxymode?: boolean;
    proxynode?: string;
  };
  locations?: Record<string, [number, number, number]>; // lightId -> [x, y, z]
  class?: string;
  state?: {
    all_on?: boolean;
    any_on?: boolean;
  };
  action?: {
    on?: boolean;
    bri?: number;
    hue?: number;
    sat?: number;
    xy?: [number, number];
    ct?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LightPosition {
  lightId: string;
  lightName: string;
  x: number;
  y: number;
  z: number;
}

export interface EntertainmentControl {
  areaId: string;
  action: 'start' | 'stop';
  parameters?: {
    syncMode?: 'individual' | 'group';
    intensity?: number;
    colorMode?: 'rgb' | 'xy';
  };
}

// Extended Group Types
export interface GroupAction {
  on?: boolean;
  bri?: number; // 0-254
  hue?: number; // 0-65535
  sat?: number; // 0-254
  xy?: [number, number];
  ct?: number; // 153-500
  alert?: 'none' | 'select' | 'lselect';
  effect?: 'none' | 'colorloop';
  colormode?: 'hs' | 'xy' | 'ct';
  scene?: string;
}

export interface GroupState {
  all_on: boolean;
  any_on: boolean;
}

export interface GradientConfig {
  id: string;
  name: string;
  colors: GradientStop[];
  direction: number; // 0-360 degrees
  type: 'linear' | 'radial' | 'conic';
  speed: number; // animation speed, 0 = static
  segments: number; // number of segments for segmented lights
  blendMode: 'smooth' | 'hard' | 'fade';
  isActive: boolean;
}

export interface GradientStop {
  color: {
    r: number;
    g: number;
    b: number;
    w?: number;
  };
  position: number; // 0-1
}

export interface Device {
  id: string;
  name: string;
  type: 'bridge' | 'controller' | 'sensor' | 'switch';
  brand: string;
  model: string;
  version: string;
  ip: string;
  mac: string;
  status: 'online' | 'offline' | 'error';
  capabilities: string[];
  connectedLights: string[];
  settings: Record<string, any>;
  lastSeen: string;
}

export interface SystemStatus {
  uptime: number;
  version: string;
  connectedDevices: number;
  activeLights: number;
  runningScenes: number;
  systemLoad: {
    cpu: number;
    memory: number;
    storage: number;
  };
  network: {
    connected: boolean;
    latency: number;
  };
  lastUpdate: string;
}

export interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  variant: 'primary' | 'secondary' | 'destructive';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko';

// Export sensor types
export * from './sensors';

// WLED specific types
export interface WLEDDevice {
  id: string;
  name: string;
  ip: string;
  mac?: string;
  version: string;
  segments: WLEDSegment[];
  status: 'online' | 'offline' | 'error';
  gradientMode: 'sparse' | 'full';
  effects: WLEDEffect[];
  palettes: WLEDPalette[];
  sync: WLEDSyncSettings;
  performance: WLEDPerformanceSettings;
  lastSeen: string;
}

export interface WLEDSegment {
  id: number;
  start: number;
  stop: number;
  len: number;
  grouping: number;
  spacing: number;
  offset: number;
  col: [number, number, number][];
  fx: number;
  sx: number;
  ix: number;
  pal: number;
  c1: number;
  c2: number;
  c3: number;
  sel: boolean;
  rev: boolean;
  mi: boolean;
  on: boolean;
  bri: number;
  cct: number;
  n: string;
}

export interface WLEDEffect {
  id: number;
  name: string;
  category: string;
  description?: string;
  parameters: WLEDEffectParameter[];
  preview?: string;
  isGradient: boolean;
}

export interface WLEDEffectParameter {
  name: string;
  type: 'slider' | 'color' | 'toggle' | 'select';
  min?: number;
  max?: number;
  default: any;
  options?: string[];
}

export interface WLEDPalette {
  id: number;
  name: string;
  colors: string[];
  category: string;
}

export interface WLEDSyncSettings {
  enabled: boolean;
  mode: 'udp' | 'e131' | 'artnet' | 'dali';
  universe: number;
  offset: number;
  multicast: boolean;
}

export interface WLEDPerformanceSettings {
  maxFps: number;
  smoothing: number;
  powerLimit: number;
  ledType: string;
  colorOrder: string;
}

// Yeelight specific types
export interface YeelightDevice {
  id: string;
  name: string;
  ip: string;
  mac?: string;
  model: string;
  firmwareVersion: string;
  status: 'online' | 'offline' | 'error';
  capabilities: YeelightCapabilities;
  musicMode: YeelightMusicMode;
  colorMode: 'hsv' | 'rgb' | 'ct';
  brightness: number;
  colorTemp: number;
  hue: number;
  saturation: number;
  rgb: [number, number, number];
  isOn: boolean;
  lastSeen: string;
}

export interface YeelightCapabilities {
  hasColorTemp: boolean;
  hasRgb: boolean;
  hasMusic: boolean;
  hasFlow: boolean;
  hasBrightness: boolean;
  minColorTemp: number;
  maxColorTemp: number;
}

export interface YeelightMusicMode {
  enabled: boolean;
  required: boolean;
  hostIp: string;
  port?: number;
  portRange?: {
    start: number;
    end: number;
  };
  maxFps: number;
  smoothMs: number;
  cieTolerance: number;
  briTolerance: number;
  audioSource?: string;
  audioVisualization: AudioVisualizationSettings;
}

export interface AudioVisualizationSettings {
  enabled: boolean;
  sensitivity: number;
  mode: 'spectrum' | 'volume' | 'beat' | 'ambient';
  colorMapping: 'frequency' | 'amplitude' | 'rainbow';
  smoothing: number;
  peakDetection: boolean;
  bassBoost: number;
}

// Gradient specific types
export interface GradientZone {
  id: string;
  name: string;
  startPosition: number; // 0-1
  endPosition: number; // 0-1
  color: {
    r: number;
    g: number;
    b: number;
    w?: number;
  };
  brightness: number;
  effect?: string;
  transition: {
    type: 'linear' | 'smooth' | 'sharp';
    duration: number;
  };
}

export interface GradientTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sunset' | 'ocean' | 'fire' | 'rainbow' | 'custom';
  zones: GradientZone[];
  preview: string;
  isPublic: boolean;
  rating: number;
  downloads: number;
  createdAt: string;
  createdBy: string;
}

export interface EffectPreview {
  effectId: string;
  deviceId: string;
  preview: string; // Base64 encoded GIF/video
  duration: number;
  colors: string[];
  description: string;
}

// Entertainment integration types
export interface ScreenMirrorSettings {
  enabled: boolean;
  screenRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  samplingRate: number;
  colorAccuracy: 'fast' | 'balanced' | 'accurate';
  edgeDetection: boolean;
  brightnessAdjustment: number;
}

export interface GameIntegration {
  enabled: boolean;
  supportedGames: string[];
  apiEndpoint?: string;
  gameStates: GameState[];
  responseTime: number;
}

export interface GameState {
  state: string;
  color: [number, number, number];
  effect?: string;
  brightness: number;
  priority: number;
}

export interface AppSettings {
  theme: Theme;
  language: Language;
  autoDiscovery: boolean;
  pollingInterval: number;
  maxRetries: number;
  timeout: number;
  debug: boolean;
  features: {
    entertainment: boolean;
    scheduling: boolean;
    gradients: boolean;
    musicSync: boolean;
    voiceControl: boolean;
    geofencing: boolean;
  };
  wled: {
    discoveryTimeout: number;
    maxDevices: number;
    defaultGradientMode: 'sparse' | 'full';
    syncEnabled: boolean;
  };
  yeelight: {
    discoveryEnabled: boolean;
    musicModeDefault: boolean;
    maxFpsDefault: number;
    smoothMsDefault: number;
  };
}

// WebSocket Event Types for Real-time Updates
export interface StreamingStatusUpdate {
  type: 'streaming_status';
  areaId: string;
  isActive: boolean;
  timestamp: string;
}

export interface LightStateUpdate {
  type: 'light_state';
  lightId: string;
  state: Partial<Light>;
  timestamp: string;
}

export interface GroupStateUpdate {
  type: 'group_state';
  groupId: string;
  state: Partial<LightGroup>;
  timestamp: string;
}

export type WebSocketEvent = StreamingStatusUpdate | LightStateUpdate | GroupStateUpdate;

// API Error Types
export interface ApiError {
  type: string;
  address: string;
  description: string;
}

export interface HueApiResponse<T> {
  success?: boolean;
  error?: ApiError;
  data?: T;
}

// Scene-related types
export interface HueLightState {
  on: boolean;
  bri: number; // 1-254
  hue?: number; // 0-65535
  sat?: number; // 0-254
  ct?: number; // 153-500
  xy?: [number, number];
  colormode?: 'hs' | 'ct' | 'xy';
  effect?: string;
  alert?: string;
  transitiontime?: number;
  reachable?: boolean;
}

export interface SceneAction {
  on?: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  xy?: [number, number];
  ct?: number;
  effect?: string;
  alert?: string;
  transitiontime?: number;
  scene?: string;
}

export interface CreateSceneRequest {
  name: string;
  group?: string;
  lights?: string[];
  storelightstate?: boolean;
  recycle?: boolean;
  type?: 'LightScene' | 'GroupScene';
  category?: Scene['category'];
}

export interface UpdateSceneRequest {
  name?: string;
  lights?: string[];
  storelightstate?: boolean;
  recycle?: boolean;
  category?: Scene['category'];
}

export interface SceneRecallRequest {
  action: 'activate' | 'deactivate' | 'dynamic_palette';
  duration?: number; // milliseconds
  transitiontime?: number; // 100ms increments
  seconds?: number;
  minutes?: number;
}

export interface ScenePreview {
  sceneId: string;
  thumbnail: string; // Base64 image
  colors: string[]; // Hex color palette
  brightness: number;
  lightsCount: number;
}

export interface SceneBulkAction {
  sceneIds: string[];
  action: 'delete' | 'favorite' | 'unfavorite' | 'activate';
  groupId?: string; // Required for activate
}

// Entertainment Area Creation
export interface CreateAreaRequest {
  name: string;
  lights: string[];
  type: 'Entertainment';
  class?: string;
}

// Position Update Request
export interface UpdatePositionsRequest {
  locations: Record<string, [number, number, number]>;
}

// Schedule Management Types
export interface Schedule {
  id: string;
  name: string;
  description?: string;
  command: ScheduleCommand;
  localtime?: string; // ISO 8601 time format
  time?: string; // HH:MM format for display
  created: string;
  status: 'enabled' | 'disabled';
  autodelete: boolean;
  starttime?: string;
  recycle: boolean;
  type?: 'one-time' | 'daily' | 'weekly' | 'sunrise' | 'sunset';
  days?: number[]; // 0-6, 0 = Sunday for recurring schedules
  offset?: number; // minutes offset for sunrise/sunset
  randomization?: number; // minutes of randomization
  timezone?: string;
  lastTriggered?: string;
  nextRun?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ScheduleCommand {
  address: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body: Record<string, any>;
}

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  command: ScheduleCommand;
  localtime?: string;
  time?: string;
  status?: 'enabled' | 'disabled';
  autodelete?: boolean;
  recycle?: boolean;
  type?: Schedule['type'];
  days?: number[];
  offset?: number;
  randomization?: number;
}

export interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  command?: ScheduleCommand;
  localtime?: string;
  time?: string;
  status?: 'enabled' | 'disabled';
  autodelete?: boolean;
  recycle?: boolean;
}

// Automation Rules Types
export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  owner?: string;
  status: 'enabled' | 'disabled';
  created: string;
  lastTriggered?: string;
  timesTriggered: number;
  recycle: boolean;
  priority?: number;
  cooldown?: number; // seconds
  maxTriggers?: number;
  validFrom?: string; // ISO time
  validTo?: string; // ISO time
  metadata?: Record<string, any>;
}

export interface RuleCondition {
  address: string;
  operator: 'eq' | 'gt' | 'lt' | 'dx' | 'ddx' | 'stable' | 'not stable' | 'in' | 'not in';
  value?: any;
  type?: 'sensor' | 'group' | 'light' | 'schedule' | 'time';
}

export interface RuleAction {
  address: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body: Record<string, any>;
  delay?: number; // milliseconds
}

export interface CreateRuleRequest {
  name: string;
  description?: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled?: boolean;
  priority?: number;
  cooldown?: number;
  maxTriggers?: number;
}

export interface UpdateRuleRequest {
  name?: string;
  description?: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  enabled?: boolean;
  priority?: number;
  cooldown?: number;
  maxTriggers?: number;
}

// Schedule Templates
export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'lighting' | 'security' | 'comfort' | 'entertainment';
  template: Partial<CreateScheduleRequest>;
  icon?: string;
  preview?: string;
}

// Rule Templates
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'motion' | 'time' | 'sensor' | 'manual' | 'advanced';
  template: Partial<CreateRuleRequest>;
  icon?: string;
  preview?: string;
}

// Schedule Statistics
export interface ScheduleStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  nextScheduled?: string;
  recentExecutions: ScheduleExecution[];
}

export interface ScheduleExecution {
  scheduleId: string;
  scheduleName: string;
  executedAt: string;
  success: boolean;
  duration: number;
  error?: string;
}

// Rule Statistics
export interface RuleStats {
  total: number;
  enabled: number;
  triggered24h: number;
  avgResponseTime: number;
  recentTriggers: RuleTrigger[];
}

export interface RuleTrigger {
  ruleId: string;
  ruleName: string;
  triggeredAt: string;
  success: boolean;
  duration: number;
  conditionsMet: string[];
  actionsExecuted: number;
  error?: string;
}

// Time Management
export interface TimeSlot {
  start: string; // HH:MM
  end: string; // HH:MM
  days: number[];
}

export interface SunrisesetState {
  sunrise: string;
  sunset: string;
  timezone: string;
  date: string;
}

// Conflict Detection
export interface ScheduleConflict {
  scheduleIds: string[];
  conflictType: 'time_overlap' | 'resource_conflict' | 'dependency_loop';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}