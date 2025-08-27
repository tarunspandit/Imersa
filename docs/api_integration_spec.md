# API Integration Specification

## Missing API Endpoints & Features

### 1. Authentication API
```typescript
// Required endpoints
POST   /login              - User authentication
POST   /logout             - Session termination  
GET    /get-key            - Retrieve API key (already exists)
GET    /api/auth/validate  - Validate session

// Implementation needed in services/authApi.ts
interface AuthService {
  login(username: string, password: string): Promise<AuthResponse>
  logout(): Promise<void>
  validateSession(): Promise<boolean>
  getStoredToken(): string | null
  setToken(token: string): void
  clearToken(): void
}
```

### 2. Device Discovery API
```typescript
// Required endpoints  
GET    /api/discovery/search        - Scan for devices
POST   /api/discovery/add           - Add discovered device
GET    /api/discovery/protocols     - List supported protocols
POST   /api/discovery/test          - Test device connection
DELETE /api/devices/{id}            - Remove device

// Implementation needed in services/discoveryApi.ts
interface DiscoveryService {
  scanForDevices(protocol?: string): Promise<DiscoveredDevice[]>
  addDevice(device: DeviceConfig): Promise<Device>
  testConnection(device: DeviceConfig): Promise<TestResult>
  getSupportedProtocols(): Promise<Protocol[]>
  removeDevice(deviceId: string): Promise<void>
}

interface DiscoveredDevice {
  id: string
  name: string
  protocol: string
  ip: string
  mac?: string
  model?: string
  manufacturer?: string
  capabilities: string[]
}
```

### 3. Rules Engine API
```typescript
// Required endpoints
GET    /api/{user}/rules           - List all rules
POST   /api/{user}/rules           - Create rule
PUT    /api/{user}/rules/{id}      - Update rule
DELETE /api/{user}/rules/{id}      - Delete rule
POST   /api/{user}/rules/{id}/test - Test rule execution

// Implementation needed in services/rulesApi.ts
interface RulesService {
  getRules(): Promise<Rule[]>
  getRule(ruleId: string): Promise<Rule>
  createRule(rule: RuleConfig): Promise<Rule>
  updateRule(ruleId: string, rule: Partial<RuleConfig>): Promise<Rule>
  deleteRule(ruleId: string): Promise<void>
  testRule(ruleId: string): Promise<TestResult>
}

interface Rule {
  id: string
  name: string
  conditions: Condition[]
  actions: Action[]
  enabled: boolean
  lastTriggered?: Date
}

interface Condition {
  type: 'time' | 'state' | 'sensor' | 'daylight'
  operator: 'equals' | 'greater' | 'less' | 'between'
  value: any
  target?: string
}

interface Action {
  type: 'light' | 'group' | 'scene' | 'sensor'
  target: string
  command: any
  delay?: number
}
```

### 4. System Configuration API
```typescript
// Required endpoints
GET    /api/config                  - Get bridge configuration
PUT    /api/config                  - Update configuration
POST   /api/config/backup           - Export configuration
POST   /api/config/restore          - Import configuration
POST   /api/config/reset            - Reset to defaults
GET    /api/config/certificates     - List certificates
POST   /api/config/certificates     - Upload certificate
DELETE /api/config/certificates/{id} - Remove certificate

// Implementation needed in services/configApi.ts
interface ConfigService {
  getConfig(): Promise<BridgeConfig>
  updateConfig(config: Partial<BridgeConfig>): Promise<BridgeConfig>
  exportConfig(): Promise<Blob>
  importConfig(file: File): Promise<ImportResult>
  resetConfig(): Promise<void>
  getCertificates(): Promise<Certificate[]>
  uploadCertificate(cert: File): Promise<Certificate>
  deleteCertificate(certId: string): Promise<void>
}

interface BridgeConfig {
  name: string
  ipaddress: string
  netmask: string
  gateway: string
  proxyaddress: string
  proxyport: number
  timezone: string
  whitelist: User[]
  portalservices: boolean
  linkbutton: boolean
  factorynew: boolean
  replacesbridgeid?: string
  backup: BackupConfig
  swversion: string
  apiversion: string
}
```

### 5. Sensor Management API
```typescript
// Required endpoints
GET    /api/{user}/sensors                - List sensors
POST   /api/{user}/sensors                - Create sensor
PUT    /api/{user}/sensors/{id}           - Update sensor
DELETE /api/{user}/sensors/{id}           - Delete sensor
GET    /api/{user}/sensors/{id}/history   - Get sensor history
POST   /api/{user}/sensors/{id}/calibrate - Calibrate sensor

// Implementation needed in services/sensorsApi.ts
interface SensorService {
  getSensors(): Promise<Sensor[]>
  getSensor(sensorId: string): Promise<Sensor>
  createSensor(sensor: SensorConfig): Promise<Sensor>
  updateSensor(sensorId: string, sensor: Partial<SensorConfig>): Promise<Sensor>
  deleteSensor(sensorId: string): Promise<void>
  getSensorHistory(sensorId: string, range: TimeRange): Promise<SensorData[]>
  calibrateSensor(sensorId: string, calibration: CalibrationData): Promise<void>
}

interface Sensor {
  id: string
  name: string
  type: 'ZLLSwitch' | 'ZLLPresence' | 'ZLLTemperature' | 'ZLLLightLevel' | 'CLIPGenericStatus'
  modelid: string
  manufacturername: string
  swversion: string
  uniqueid: string
  state: SensorState
  config: SensorConfig
  capabilities: SensorCapabilities
}

interface SensorState {
  presence?: boolean
  temperature?: number
  lightlevel?: number
  daylight?: boolean
  lastupdated: string
  battery?: number
}
```

### 6. Entertainment API
```typescript
// Required endpoints
GET    /api/{user}/entertainment           - List entertainment areas
POST   /api/{user}/entertainment           - Create entertainment area
PUT    /api/{user}/entertainment/{id}      - Update area
DELETE /api/{user}/entertainment/{id}      - Delete area
POST   /api/{user}/entertainment/{id}/stream - Start streaming
DELETE /api/{user}/entertainment/{id}/stream - Stop streaming

// Implementation needed in services/entertainmentApi.ts
interface EntertainmentService {
  getAreas(): Promise<EntertainmentArea[]>
  getArea(areaId: string): Promise<EntertainmentArea>
  createArea(area: AreaConfig): Promise<EntertainmentArea>
  updateArea(areaId: string, area: Partial<AreaConfig>): Promise<EntertainmentArea>
  deleteArea(areaId: string): Promise<void>
  startStreaming(areaId: string, mode: StreamMode): Promise<StreamSession>
  stopStreaming(areaId: string): Promise<void>
}

interface EntertainmentArea {
  id: string
  name: string
  type: 'TV' | 'Music' | 'Gaming' | '3D'
  lights: LightPosition[]
  stream: StreamConfig
  active: boolean
}

interface LightPosition {
  lightId: string
  position: [number, number, number] // x, y, z coordinates
}
```

### 7. Integration APIs

#### WLED Integration
```typescript
// Required endpoints
GET    /api/wled/devices            - List WLED devices
POST   /api/wled/discover           - Discover WLED devices
PUT    /api/wled/{id}/effect        - Set effect
PUT    /api/wled/{id}/preset        - Apply preset
GET    /api/wled/{id}/presets       - List presets
POST   /api/wled/{id}/segment       - Configure segment

interface WLEDService {
  getDevices(): Promise<WLEDDevice[]>
  discoverDevices(): Promise<WLEDDevice[]>
  setEffect(deviceId: string, effectId: number): Promise<void>
  applyPreset(deviceId: string, presetId: number): Promise<void>
  getPresets(deviceId: string): Promise<WLEDPreset[]>
  configureSegment(deviceId: string, segment: SegmentConfig): Promise<void>
}
```

#### Yeelight Integration
```typescript
// Required endpoints
GET    /api/yeelight/devices        - List Yeelight devices
POST   /api/yeelight/discover       - Discover devices
PUT    /api/yeelight/{id}/music     - Toggle music mode
PUT    /api/yeelight/{id}/flow      - Set color flow

interface YeelightService {
  getDevices(): Promise<YeelightDevice[]>
  discoverDevices(): Promise<YeelightDevice[]>
  toggleMusicMode(deviceId: string, enabled: boolean): Promise<void>
  setColorFlow(deviceId: string, flow: ColorFlow): Promise<void>
}
```

#### Tradfri Integration
```typescript
// Required endpoints
POST   /api/tradfri/pair            - Pair with gateway
GET    /api/tradfri/devices         - List Tradfri devices
PUT    /api/tradfri/sync            - Sync devices

interface TradfriService {
  pairGateway(ip: string, securityCode: string): Promise<PairResult>
  getDevices(): Promise<TradfriDevice[]>
  syncDevices(): Promise<SyncResult>
}
```

### 8. System Management API
```typescript
// Required endpoints
POST   /api/system/restart          - Restart bridge
GET    /api/system/info             - System information
GET    /api/system/logs             - Get logs
POST   /api/system/logs/clear       - Clear logs
GET    /api/system/logs/download    - Download logs
GET    /api/system/updates          - Check for updates
POST   /api/system/updates/install  - Install update

// Implementation needed in services/systemApi.ts
interface SystemService {
  restart(): Promise<void>
  getInfo(): Promise<SystemInfo>
  getLogs(filter?: LogFilter): Promise<LogEntry[]>
  clearLogs(): Promise<void>
  downloadLogs(): Promise<Blob>
  checkUpdates(): Promise<UpdateInfo>
  installUpdate(version: string): Promise<InstallResult>
}

interface SystemInfo {
  version: string
  uptime: number
  memory: MemoryInfo
  cpu: CPUInfo
  network: NetworkInfo
  storage: StorageInfo
}

interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warning' | 'error'
  module: string
  message: string
  details?: any
}
```

## WebSocket/EventSource for Real-time Updates

```typescript
// Required real-time endpoints
WS    /api/events                   - WebSocket for state changes
SSE   /api/events/stream            - Server-sent events alternative

// Implementation needed in services/realtimeApi.ts
interface RealtimeService {
  connect(): Promise<void>
  disconnect(): void
  subscribe(event: string, callback: EventCallback): Unsubscribe
  on(event: 'light' | 'group' | 'sensor' | 'rule', callback: StateCallback): Unsubscribe
  emit(event: string, data: any): void
}

type EventCallback = (data: any) => void
type StateCallback = (state: StateChange) => void
type Unsubscribe = () => void

interface StateChange {
  type: 'light' | 'group' | 'sensor' | 'rule'
  id: string
  state: any
  timestamp: Date
}
```

## API Client Configuration

```typescript
// services/apiClient.ts
import axios, { AxiosInstance } from 'axios';

class APIClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;
  
  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:80',
      timeout: 10000,
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.url = config.url?.replace('{user}', this.apiKey);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle authentication error
          this.apiKey = null;
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }
  
  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('bridge-api-key', key);
  }
  
  getApiKey(): string | null {
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('bridge-api-key');
    }
    return this.apiKey;
  }
  
  get<T>(url: string, config?: any): Promise<T> {
    return this.client.get<T>(url, config).then(r => r.data);
  }
  
  post<T>(url: string, data?: any, config?: any): Promise<T> {
    return this.client.post<T>(url, data, config).then(r => r.data);
  }
  
  put<T>(url: string, data?: any, config?: any): Promise<T> {
    return this.client.put<T>(url, data, config).then(r => r.data);
  }
  
  delete<T>(url: string, config?: any): Promise<T> {
    return this.client.delete<T>(url, config).then(r => r.data);
  }
}

export default new APIClient();
```

## Priority Implementation Order

1. **Authentication** - Required for all protected endpoints
2. **System Configuration** - Core bridge management
3. **Device Discovery** - Essential for adding devices
4. **Rules Engine** - Key automation feature
5. **Sensor Management** - IoT functionality
6. **Entertainment** - Advanced feature
7. **Third-party Integrations** - Extended functionality
8. **Real-time Updates** - Enhanced UX

## Testing Strategy

### Unit Tests for Each Service
```typescript
// Example: services/__tests__/authApi.test.ts
describe('AuthService', () => {
  it('should login with valid credentials', async () => {
    const result = await authService.login('user', 'pass');
    expect(result.token).toBeDefined();
  });
  
  it('should handle login failure', async () => {
    await expect(authService.login('bad', 'creds')).rejects.toThrow();
  });
});
```

### Integration Tests
```typescript
// Example: integration/__tests__/deviceFlow.test.ts
describe('Device Discovery Flow', () => {
  it('should discover and add a device', async () => {
    const devices = await discoveryService.scanForDevices();
    expect(devices.length).toBeGreaterThan(0);
    
    const added = await discoveryService.addDevice(devices[0]);
    expect(added.id).toBeDefined();
  });
});
```

### E2E Tests
```typescript
// Example: e2e/authentication.cy.ts
describe('Authentication', () => {
  it('should require login for protected pages', () => {
    cy.visit('/lights');
    cy.url().should('include', '/login');
    
    cy.get('[data-testid="username"]').type('admin');
    cy.get('[data-testid="password"]').type('password');
    cy.get('[data-testid="login-button"]').click();
    
    cy.url().should('include', '/lights');
  });
});
```

## Next Steps

1. Set up API client infrastructure
2. Implement authentication service first
3. Create service layer for each API category
4. Add error handling and retry logic
5. Implement caching where appropriate
6. Add real-time updates via WebSocket
7. Write comprehensive tests
8. Document API usage examples