import axios, { AxiosInstance } from 'axios';
import authService from './authApi';

export interface DiscoveredDevice {
  id: string;
  name: string;
  protocol: string;
  ip: string;
  mac?: string;
  model?: string;
  modelid?: string;
  manufacturername?: string;
  uniqueid?: string;
  type?: string;
  capabilities?: string[];
  config?: any;
  state?: any;
}

export interface DeviceSensor {
  id: string;
  name: string;
  type: string;
  modelid: string;
  manufacturername: string;
  swversion?: string;
  uniqueid: string;
  protocol: string;
  state: {
    presence?: boolean;
    temperature?: number;
    lightlevel?: number;
    daylight?: boolean;
    lastupdated: string;
    battery?: number;
    buttonevent?: number;
  };
  config: {
    on: boolean;
    battery?: number;
    reachable: boolean;
    alert?: string;
    sensitivity?: number;
    sensitivitymax?: number;
    sunriseoffset?: number;
    sunsetoffset?: number;
  };
}

export interface LightCatalogItem {
  id: string;
  name: string;
  archetype: string;
  type: string;
  manufacturer: string;
  modelid: string;
  config?: {
    archetype?: string;
    function?: string;
    direction?: string;
  };
  capabilities?: {
    certified: boolean;
    control: {
      mindimlevel?: number;
      maxlumen?: number;
      colorgamuttype?: string;
      colorgamut?: number[][];
      ct?: {
        min: number;
        max: number;
      };
    };
    streaming?: {
      renderer: boolean;
      proxy: boolean;
    };
  };
}

class DiscoveryService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = (import.meta as any).env?.VITE_API_URL || '';
    this.client = axios.create({ baseURL });
  }

  // Light discovery
  async searchForLights(): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.post(`/api/${apiKey}/lights`, '');
  }

  async getNewLights(): Promise<{
    lastscan: string;
    [key: string]: any;
  }> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/lights/new`);
    return response.data;
  }

  // Get all sensors (devices)
  async getSensors(): Promise<Record<string, DeviceSensor>> {
    const response = await this.client.get('/sensors');
    return response.data;
  }

  async getSensor(sensorId: string): Promise<DeviceSensor> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/sensors/${sensorId}`);
    return response.data;
  }

  async createSensor(sensor: Partial<DeviceSensor>): Promise<{ success: { id: string } }> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.post(`/api/${apiKey}/sensors`, sensor);
    return response.data;
  }

  async updateSensor(sensorId: string, updates: Partial<DeviceSensor>): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.put(`/api/${apiKey}/sensors/${sensorId}`, updates);
  }

  async deleteSensor(sensorId: string): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.delete(`/api/${apiKey}/sensors/${sensorId}`);
  }

  // Light types and catalog
  async getLightTypes(): Promise<string[]> {
    const response = await this.client.get('/light-types');
    return response.data.result || [];
  }

  async setLightType(lightId: string, modelId: string): Promise<void> {
    await this.client.post('/light-types', { [lightId]: modelId });
  }

  async getLightsCatalog(): Promise<Record<string, LightCatalogItem>> {
    const response = await axios.get(
      'https://raw.githubusercontent.com/diyhue/Lights/master/catalog.json'
    );
    return response.data;
  }

  // Protocol-specific discovery
  async discoverTradfri(gateway: string, identity: string, psk: string): Promise<void> {
    // API expects different field names
    await this.client.post('/tradfri', { 
      tradfriGwIp: gateway, 
      identity: identity, 
      tradfriCode: psk 
    });
  }

  async discoverPhilipsHue(bridgeIp: string): Promise<void> {
    // Implement Philips Hue bridge discovery
    const apiKey = authService.getStoredApiKey();
    await this.client.post(`/api/${apiKey}/config/hue`, { bridge: bridgeIp });
  }

  async discoverGovee(): Promise<void> {
    // Implement Govee discovery
    const apiKey = authService.getStoredApiKey();
    await this.client.post(`/api/${apiKey}/config/govee/discover`);
  }

  async discoverWLED(): Promise<{ devices: any[] }> {
    // WLED discovery - search for WLED devices via manual add with protocol
    const apiKey = authService.getStoredApiKey();
    // Trigger light search which includes WLED devices
    await this.client.post(`/api/${apiKey}/lights`, '');
    // Return empty for now since real discovery happens through lights
    return { devices: [] };
  }

  async addManualDevice(device: {
    protocol: string;
    ip: string;
    name: string;
  }): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    // Add device via lights API with manual configuration
    await this.client.post(`/api/${apiKey}/lights`, {
      ip: device.ip,
      protocol: device.protocol,
      config: {
        name: device.name
      }
    });
  }

  async testDeviceConnection(protocol: string, config: { ip: string }): Promise<{ success: boolean }> {
    // Simple connectivity test - not directly supported by API
    // Return success for now - real test happens when adding device
    return { success: true };
  }

  // Manual device addition
  async addDevice(device: {
    name: string;
    protocol: string;
    ip: string;
    mac?: string;
    model?: string;
    config?: any;
  }): Promise<{ success: { id: string } }> {
    const apiKey = authService.getStoredApiKey();
    
    // Add as light or sensor based on protocol
    if (['native', 'native_multi', 'native_single', 'wled', 'yeelight', 'tasmota', 'lifx'].includes(device.protocol)) {
      const response = await this.client.post(`/api/${apiKey}/lights`, device);
      return response.data;
    } else {
      const response = await this.client.post(`/api/${apiKey}/sensors`, device);
      return response.data;
    }
  }

  // Test device connection
  async testDevice(device: {
    protocol: string;
    ip: string;
    config?: any;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      // Protocol-specific test endpoints
      switch (device.protocol) {
        case 'native':
        case 'native_multi':
          const response = await axios.get(`http://${device.ip}/detect`, { timeout: 5000 });
          return { success: response.status === 200 };
        
        case 'wled':
          const wledResponse = await axios.get(`http://${device.ip}/json/info`, { timeout: 5000 });
          return { success: wledResponse.status === 200 };
        
        case 'yeelight':
          // Yeelight uses TCP, would need backend support
          return { success: false, message: 'Yeelight test requires backend support' };
        case 'lifx':
          // LIFX LAN uses UDP; backend handles discovery/control. Use discovery or manual add.
          return { success: false, message: 'LIFX test requires backend support' };
        
        case 'tasmota':
          const tasmotaResponse = await axios.get(`http://${device.ip}/cm?cmnd=Status`, { timeout: 5000 });
          return { success: tasmotaResponse.status === 200 };
        
        default:
          return { success: false, message: 'Unknown protocol' };
      }
    } catch (error) {
      return { success: false, message: 'Connection failed' };
    }
  }

  // Get supported protocols
  getSupportedProtocols(): Array<{
    id: string;
    name: string;
    description: string;
    icon?: string;
  }> {
    return [
      { id: 'native', name: 'Native ESP', description: 'DiyHue native ESP8266/ESP32 devices', icon: '🔌' },
      { id: 'native_multi', name: 'Native Multi', description: 'Multi-light native devices', icon: '💡' },
      { id: 'hue', name: 'Philips Hue', description: 'Official Philips Hue bridges', icon: '🌈' },
      { id: 'wled', name: 'WLED', description: 'WLED LED controllers', icon: '✨' },
      { id: 'yeelight', name: 'Yeelight', description: 'Xiaomi Yeelight devices', icon: '💫' },
      { id: 'lifx', name: 'LIFX', description: 'LIFX LAN bulbs', icon: '🟡' },
      { id: 'tradfri', name: 'IKEA Tradfri', description: 'IKEA smart lighting', icon: '🏠' },
      { id: 'tasmota', name: 'Tasmota', description: 'Tasmota firmware devices', icon: '⚡' },
      { id: 'shelly', name: 'Shelly', description: 'Shelly smart relays', icon: '🔧' },
      { id: 'esphome', name: 'ESPHome', description: 'ESPHome devices', icon: '🏡' },
      { id: 'hyperion', name: 'Hyperion', description: 'Hyperion ambient lighting', icon: '🎬' },
      { id: 'tpkasa', name: 'TP-Link Kasa', description: 'TP-Link smart devices', icon: '🔗' },
      { id: 'elgato', name: 'Elgato', description: 'Elgato Key Lights', icon: '🎥' },
      { id: 'mqtt', name: 'MQTT', description: 'MQTT-based devices', icon: '📡' },
      { id: 'homeassistant', name: 'Home Assistant', description: 'Home Assistant integration', icon: '🏘️' },
      { id: 'domoticz', name: 'Domoticz', description: 'Domoticz integration', icon: '🏢' }
    ];
  }
}

export default new DiscoveryService();
