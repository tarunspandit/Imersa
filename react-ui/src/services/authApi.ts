import axios from 'axios';

export interface AuthResponse {
  success: boolean;
  apiKey?: string;
  user?: {
    id: string;
    name: string;
    permissions: string[];
  };
  error?: string;
}

class AuthService {
  private baseUrl: string = '';
  private apiKey: string | null = null;

  constructor() {
    // Get base URL from environment or use current host
    this.baseUrl = import.meta.env.VITE_API_URL || '';
  }

  async getApiKey(): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/get-key`);
      this.apiKey = response.data;
      localStorage.setItem('bridge-api-key', this.apiKey);
      return this.apiKey;
    } catch (error) {
      console.error('Failed to get API key:', error);
      throw new Error('Unable to fetch API key');
    }
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/login`, {
        username,
        password
      });
      
      if (response.data.success) {
        this.apiKey = response.data.apiKey;
        localStorage.setItem('bridge-api-key', this.apiKey);
        localStorage.setItem('bridge-user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed'
      };
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.apiKey) {
        await axios.post(`${this.baseUrl}/api/logout`, {}, {
          headers: { 'X-API-Key': this.apiKey }
        });
      }
    } finally {
      this.apiKey = null;
      localStorage.removeItem('bridge-api-key');
      localStorage.removeItem('bridge-user');
    }
  }

  async validateSession(): Promise<boolean> {
    const storedKey = localStorage.getItem('bridge-api-key');
    if (!storedKey) return false;

    try {
      const response = await axios.get(`${this.baseUrl}/api/validate`, {
        headers: { 'X-API-Key': storedKey }
      });
      this.apiKey = storedKey;
      return response.data.valid === true;
    } catch {
      return false;
    }
  }

  getStoredApiKey(): string | null {
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('bridge-api-key');
    }
    return this.apiKey;
  }

  isAuthenticated(): boolean {
    return !!this.getStoredApiKey();
  }
}

export default new AuthService();