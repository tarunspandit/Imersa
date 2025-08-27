import axios, { AxiosInstance } from 'axios';
import authService from './authApi';

export interface BridgeConfig {
  name: string;
  swversion: string;
  apiversion: string;
  bridgeid: string;
  factorynew: boolean;
  replacesbridgeid: string | null;
  modelid: string;
  mac: string;
  ipaddress: string;
  netmask: string;
  gateway: string;
  proxyaddress: string;
  proxyport: number;
  UTC: string;
  localtime: string;
  timezone: string;
  zigbeechannel: number;
  dhcp: boolean;
  portalservices: boolean;
  linkbutton: boolean;
  discovery: boolean;
  'Remote API enabled': boolean;
  LogLevel: 'INFO' | 'DEBUG';
  swupdate2: {
    checkforupdate: boolean;
    lastchange: string;
    bridge: {
      state: string;
      lastinstall: string;
    };
    autoinstall: {
      updatetime: string;
      on: boolean;
    };
  };
}

export interface SystemInfo {
  diyhue: string;
  webui: string;
  machine: string;
  sysname: string;
  os_version: string;
  os_release: string;
}

class BridgeService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = (import.meta as any).env?.VITE_API_URL || '';
    this.client = axios.create({ baseURL });
  }

  private getHeaders() {
    const apiKey = authService.getStoredApiKey();
    return apiKey ? { 'X-API-Key': apiKey } : {};
  }

  // Config management
  async getConfig(): Promise<BridgeConfig> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/config`);
    return response.data;
  }

  async updateConfig(config: Partial<BridgeConfig>): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.put(`/api/${apiKey}/config`, config);
  }

  // System info
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await this.client.get('/info');
    return response.data;
  }

  async getTimezones(): Promise<string[]> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/info/timezones`);
    return response.data;
  }

  // Config backup/restore
  async saveConfig(backup: boolean = false): Promise<void> {
    const params = backup ? { backup: 'True' } : {};
    await this.client.get('/save', { params });
  }

  async downloadConfig(): Promise<Blob> {
    const response = await this.client.get('/download_config', {
      responseType: 'blob'
    });
    return response.data;
  }

  async downloadDebug(): Promise<Blob> {
    const response = await this.client.get('/download_debug', {
      responseType: 'blob'
    });
    return response.data;
  }

  async downloadLog(): Promise<Blob> {
    const response = await this.client.get('/download_log', {
      responseType: 'blob'
    });
    return response.data;
  }

  async restoreConfig(): Promise<void> {
    await this.client.get('/restore_config');
  }

  async resetConfig(): Promise<void> {
    await this.client.get('/reset_config');
  }

  async removeCertificate(): Promise<void> {
    await this.client.get('/remove_cert');
  }

  // System controls
  async restart(): Promise<void> {
    try {
      await this.client.get('/restart');
    } catch (error: any) {
      // Restart causes network error which is expected
      if (error.message !== 'Network Error') {
        throw error;
      }
    }
  }

  // Protocol configuration
  async getProtocolConfig(protocol: string): Promise<{ enabled: boolean }> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/config/${protocol}`);
    return response.data;
  }

  async updateProtocolConfig(protocols: Record<string, { enabled: boolean }>): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.put(`/api/${apiKey}/config`, protocols);
  }

  // Port configuration
  async getPortConfig(): Promise<{ enabled: boolean; ports: number[] }> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/config/port`);
    return response.data;
  }

  async updatePortConfig(enabled: boolean, ports: number[]): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.put(`/api/${apiKey}/config`, {
      port: { enabled, ports }
    });
  }

  // IP Range configuration
  async getIPRangeConfig(): Promise<{
    IP_RANGE_START: number;
    IP_RANGE_END: number;
    SUB_IP_RANGE_START: number;
    SUB_IP_RANGE_END: number;
  }> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/config/IP_RANGE`);
    return response.data;
  }

  async updateIPRangeConfig(config: {
    IP_RANGE_START: number;
    IP_RANGE_END: number;
    SUB_IP_RANGE_START: number;
    SUB_IP_RANGE_END: number;
  }): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.put(`/api/${apiKey}/config`, {
      IP_RANGE: config
    });
  }

  // Scan on host IP
  async getScanOnHostIP(): Promise<boolean> {
    const apiKey = authService.getStoredApiKey();
    const response = await this.client.get(`/api/${apiKey}/config/scanonhostip`);
    return response.data;
  }

  async updateScanOnHostIP(enabled: boolean): Promise<void> {
    const apiKey = authService.getStoredApiKey();
    await this.client.put(`/api/${apiKey}/config`, {
      scanonhostip: enabled
    });
  }
}

export default new BridgeService();