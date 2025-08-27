import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import { 
  Key, Shield, Wifi, AlertTriangle, 
  Loader2, Info, CheckCircle, Globe
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const GoveeIntegration: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);

  const handleConnect = async () => {
    if (!apiKey) {
      toast.error('Please enter your Govee API key');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await discoveryService.connectGovee(apiKey);
      if (response && response.devices) {
        setDeviceCount(response.devices.length);
        setIsConnected(true);
        toast.success(`Connected! Found ${response.devices.length} Govee devices`);
      } else {
        toast.success('Connected to Govee API');
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Govee connection failed:', error);
      toast.error('Failed to connect to Govee API. Check your API key.');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setApiKey('');
    setIsConnected(false);
    setDeviceCount(0);
    toast('Disconnected from Govee API');
  };

  return (
    <div className="p-6 space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold">Govee Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Govee smart lights through the Govee API
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Connected to Govee</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {deviceCount} devices
                    </span>
                  </div>
                </div>
                
                <Button 
                  variant="destructive"
                  onClick={handleDisconnect}
                  className="w-full"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">Govee API Key</label>
                  <Input
                    type="password"
                    placeholder="Enter your Govee API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get your API key from the Govee Developer Portal
                  </p>
                </div>

                <Button 
                  onClick={handleConnect}
                  disabled={isConnecting || !apiKey}
                  className="w-full"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4 mr-2" />
                      Connect to Govee
                    </>
                  )}
                </Button>
              </>
            )}

            <div className="p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <p className="text-sm font-medium mb-1">API Limits:</p>
              <ul className="text-xs space-y-0.5">
                <li>• 10,000 requests per day</li>
                <li>• Rate limit: 1 request per second</li>
                <li>• Supports WiFi devices only</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Getting Your API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Open Govee Home App</p>
                  <p className="text-sm text-muted-foreground">
                    Make sure you're logged into your account
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Go to Settings</p>
                  <p className="text-sm text-muted-foreground">
                    Tap your profile icon, then Settings
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Apply for API Key</p>
                  <p className="text-sm text-muted-foreground">
                    Select "Apply for API Key" and fill the form
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium">Check Your Email</p>
                  <p className="text-sm text-muted-foreground">
                    You'll receive your API key via email
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Important:</p>
                  <p>API key approval may take 1-3 business days</p>
                </div>
              </div>
            </div>

            <a 
              href="https://developer.govee.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="w-full">
                <Globe className="w-4 h-4 mr-2" />
                Visit Govee Developer Portal
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Supported Devices */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Supported Govee Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">💡 Light Bulbs</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• H6160 RGB Bulb</li>
                  <li>• H6163 Matter Bulb</li>
                  <li>• H6008 WiFi Bulb</li>
                  <li>• H6009 Music Sync</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">🎨 Light Strips</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• H6159 RGB Strip</li>
                  <li>• H6172 RGBIC Strip</li>
                  <li>• H619Z Outdoor Strip</li>
                  <li>• H70B1 Neon Rope</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">🏮 Specialty Lights</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• H6061 Table Lamp</li>
                  <li>• H6066 Glide Wall Light</li>
                  <li>• H6076 Floor Lamp</li>
                  <li>• H6052 Lyra Lamp</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Features:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Control brightness and color</li>
                    <li>Apply DIY scenes and effects</li>
                    <li>Music sync capabilities (supported models)</li>
                    <li>Group control for multiple devices</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GoveeIntegration;