import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch } from '@/components/ui';
import discoveryService from '@/services/discoveryApi';
import { 
  Network, Shield, Server, AlertTriangle, 
  Loader2, Info, CheckCircle, Settings, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface MQTTConfig {
  broker: string;
  port: number;
  username: string;
  password: string;
  clientId: string;
  baseTopic: string;
  useTLS: boolean;
  discovery: boolean;
  qos: number;
  retain: boolean;
}

const MQTTIntegration: React.FC = () => {
  const [config, setConfig] = useState<MQTTConfig>({
    broker: '',
    port: 1883,
    username: '',
    password: '',
    clientId: 'diyhue-bridge',
    baseTopic: 'diyhue',
    useTLS: false,
    discovery: true,
    qos: 1,
    retain: false
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testTopic, setTestTopic] = useState('');

  const handleConnect = async () => {
    if (!config.broker) {
      toast.error('Please enter broker address');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await discoveryService.configureMQTT(config);
      if (response && response.success) {
        setIsConnected(true);
        toast.success('Successfully connected to MQTT broker!');
        
        if (config.discovery) {
          toast.info('Auto-discovery enabled. Devices will appear automatically.');
        }
      } else {
        toast.error('Failed to connect to MQTT broker');
      }
    } catch (error) {
      console.error('MQTT connection failed:', error);
      toast.error('Connection failed. Check your settings.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    toast.info('Disconnected from MQTT broker');
  };

  const handleTestPublish = async () => {
    if (!testTopic) {
      toast.error('Please enter a test topic');
      return;
    }

    try {
      await discoveryService.mqttPublish(testTopic, { test: true, timestamp: Date.now() });
      toast.success(`Published test message to ${testTopic}`);
    } catch (error) {
      toast.error('Failed to publish test message');
    }
  };

  const updateConfig = (field: keyof MQTTConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">MQTT Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect to MQTT broker for IoT device integration and automation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              Broker Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Connected to MQTT</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {config.broker}:{config.port}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Test Publish</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={`${config.baseTopic}/test`}
                      value={testTopic}
                      onChange={(e) => setTestTopic(e.target.value)}
                    />
                    <Button onClick={handleTestPublish}>
                      Publish
                    </Button>
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
                  <label className="text-sm font-medium">Broker Address</label>
                  <Input
                    placeholder="mqtt.broker.com or 192.168.1.100"
                    value={config.broker}
                    onChange={(e) => updateConfig('broker', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Port</label>
                    <Input
                      type="number"
                      placeholder="1883"
                      value={config.port}
                      onChange={(e) => updateConfig('port', parseInt(e.target.value) || 1883)}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 w-full">
                      <Switch
                        checked={config.useTLS}
                        onCheckedChange={(checked) => {
                          updateConfig('useTLS', checked);
                          updateConfig('port', checked ? 8883 : 1883);
                        }}
                      />
                      <label className="text-sm">Use TLS/SSL</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Username (Optional)</label>
                  <Input
                    placeholder="MQTT username"
                    value={config.username}
                    onChange={(e) => updateConfig('username', e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Password (Optional)</label>
                  <Input
                    type="password"
                    placeholder="MQTT password"
                    value={config.password}
                    onChange={(e) => updateConfig('password', e.target.value)}
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                </Button>

                {showAdvanced && (
                  <div className="space-y-3 pt-3 border-t">
                    <div>
                      <label className="text-sm font-medium">Client ID</label>
                      <Input
                        placeholder="diyhue-bridge"
                        value={config.clientId}
                        onChange={(e) => updateConfig('clientId', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Base Topic</label>
                      <Input
                        placeholder="diyhue"
                        value={config.baseTopic}
                        onChange={(e) => updateConfig('baseTopic', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Topics: {config.baseTopic}/lights, {config.baseTopic}/sensors, etc.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Auto Discovery</label>
                        <Switch
                          checked={config.discovery}
                          onCheckedChange={(checked) => updateConfig('discovery', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Retain Messages</label>
                        <Switch
                          checked={config.retain}
                          onCheckedChange={(checked) => updateConfig('retain', checked)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">QoS Level</label>
                      <select 
                        className="w-full p-2 border rounded"
                        value={config.qos}
                        onChange={(e) => updateConfig('qos', parseInt(e.target.value))}
                      >
                        <option value={0}>0 - At most once</option>
                        <option value={1}>1 - At least once</option>
                        <option value={2}>2 - Exactly once</option>
                      </select>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleConnect}
                  disabled={isConnecting || !config.broker}
                  className="w-full"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Connect to MQTT
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Topic Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Topic Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              DIYHue uses the following MQTT topic structure:
            </p>

            <div className="space-y-2">
              <div className="p-2 bg-muted rounded font-mono text-sm">
                {config.baseTopic || 'diyhue'}/lights/&lt;id&gt;/state
              </div>
              <p className="text-xs">Receive light state updates</p>
            </div>

            <div className="space-y-2">
              <div className="p-2 bg-muted rounded font-mono text-sm">
                {config.baseTopic || 'diyhue'}/lights/&lt;id&gt;/set
              </div>
              <p className="text-xs">Send commands to lights</p>
            </div>

            <div className="space-y-2">
              <div className="p-2 bg-muted rounded font-mono text-sm">
                {config.baseTopic || 'diyhue'}/sensors/&lt;id&gt;/state
              </div>
              <p className="text-xs">Receive sensor data</p>
            </div>

            <div className="space-y-2">
              <div className="p-2 bg-muted rounded font-mono text-sm">
                {config.baseTopic || 'diyhue'}/discovery/&lt;type&gt;/&lt;id&gt;
              </div>
              <p className="text-xs">Auto-discovery announcements</p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Payload Format (JSON):</h4>
              <pre className="text-xs overflow-x-auto">
{`{
  "state": "ON",
  "brightness": 254,
  "color": {
    "r": 255,
    "g": 100,
    "b": 50
  },
  "color_temp": 370,
  "effect": "none"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Features & Examples */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Features & Integration Examples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Supported Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Bidirectional state synchronization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Auto-discovery via Home Assistant protocol</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>RGB, CCT, and dimming control</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Sensor data integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Group and scene control</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-3">Compatible Devices</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Tasmota flashed devices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>ESPHome devices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Zigbee2MQTT devices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Custom IoT devices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Node-RED automations</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">📡 Brokers</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Mosquitto</li>
                  <li>• HiveMQ</li>
                  <li>• EMQX</li>
                  <li>• CloudMQTT</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">🔧 Protocols</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• MQTT 3.1.1</li>
                  <li>• MQTT 5.0</li>
                  <li>• WebSocket</li>
                  <li>• TLS/SSL</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">⚡ Use Cases</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• DIY smart lights</li>
                  <li>• Sensor networks</li>
                  <li>• Home automation</li>
                  <li>• Industrial IoT</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Important Notes:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Ensure your MQTT broker is accessible from DIYHue</li>
                    <li>Use authentication for production environments</li>
                    <li>Consider network latency for real-time control</li>
                    <li>Test with QoS 1 for reliability</li>
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

export default MQTTIntegration;