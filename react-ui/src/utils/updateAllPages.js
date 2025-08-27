// Script to update all pages with new design system
const fs = require('fs');
const path = require('path');

// List of pages to update with their specific configs
const pagesToUpdate = [
  {
    file: 'WLED.tsx',
    icon: 'Zap',
    title: 'WLED Integration',
    subtitle: 'Manage and control WLED devices'
  },
  {
    file: 'Scheduler.tsx', 
    icon: 'Clock',
    title: 'Scheduler',
    subtitle: 'Create and manage lighting schedules'
  },
  {
    file: 'AutomationPage.tsx',
    icon: 'Settings',
    title: 'Automation',
    subtitle: 'Configure automated lighting rules'
  },
  {
    file: 'DevicesComplete.tsx',
    icon: 'Monitor',
    title: 'Devices',
    subtitle: 'Manage connected devices and hardware'
  },
  {
    file: 'BridgeManagement.tsx',
    icon: 'Server',
    title: 'Bridge Management',
    subtitle: 'Configure and monitor your Imersa bridge'
  },
  {
    file: 'AppUsers.tsx',
    icon: 'Users',
    title: 'App Users',
    subtitle: 'Manage user accounts and permissions'
  },
  {
    file: 'SensorsPage.tsx',
    icon: 'Activity',
    title: 'Sensors',
    subtitle: 'Monitor and configure sensor devices'
  },
  {
    file: 'Help.tsx',
    icon: 'HelpCircle',
    title: 'Help & Support',
    subtitle: 'Get help with Imersa'
  },
  {
    file: 'NotFound.tsx',
    icon: 'AlertTriangle',
    title: '404 - Page Not Found',
    subtitle: 'The page you are looking for does not exist'
  }
];

// Integration pages
const integrationPages = [
  {
    file: 'integrations/IntegrationHub.tsx',
    icon: 'Plug',
    title: 'Integration Hub',
    subtitle: 'Connect third-party services and devices'
  },
  {
    file: 'integrations/TradfriIntegration.tsx',
    icon: 'Home',
    title: 'IKEA TRÅDFRI',
    subtitle: 'Connect and control IKEA smart lights'
  },
  {
    file: 'integrations/PhilipsHueIntegration.tsx',
    icon: 'Lightbulb',
    title: 'Philips Hue',
    subtitle: 'Sync with Philips Hue bridges'
  },
  {
    file: 'integrations/GoveeIntegration.tsx',
    icon: 'Wifi',
    title: 'Govee',
    subtitle: 'Control Govee smart lights'
  },
  {
    file: 'integrations/DeconzIntegration.tsx',
    icon: 'Radio',
    title: 'deCONZ',
    subtitle: 'Connect Zigbee devices via deCONZ'
  },
  {
    file: 'integrations/HomeAssistantIntegration.tsx',
    icon: 'Home',
    title: 'Home Assistant',
    subtitle: 'Integrate with Home Assistant'
  },
  {
    file: 'integrations/MQTTIntegration.tsx',
    icon: 'Network',
    title: 'MQTT',
    subtitle: 'Connect via MQTT protocol'
  }
];

const designSystemImports = `import { PageWrapper } from '@/components/layout/PageWrapper';
import { cn } from '@/utils';
import '@/styles/design-system.css';`;

const transformations = {
  // Convert old page structure to PageWrapper
  'className="p-6 space-y-6 pb-20"': 'PageWrapper structure',
  '<Card>': '<div className="glass-card p-6">',
  '</Card>': '</div>',
  '<CardHeader>': '<div className="flex items-center gap-3 mb-4">',
  '</CardHeader>': '</div>',
  '<CardContent': '<div',
  '</CardContent>': '</div>',
  'Button onClick': 'button onClick',
  'className="btn-primary"': 'className="btn-glow flex items-center gap-2"',
  'className="btn-secondary"': 'className="px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all"',
  'text-muted-foreground': 'text-gray-400',
  'text-gray-900': 'text-white',
  '<Input': '<input className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"',
  'Loader2 className="w-8 h-8 animate-spin"': 'div className="loading-pulse"><Sparkles className="w-8 h-8 text-imersa-dark" /></div>'
};

console.log('Design system update script ready. This will:');
console.log('1. Add PageWrapper to all pages');
console.log('2. Convert Card components to glass-card');
console.log('3. Update button styles to btn-glow');
console.log('4. Apply dark theme colors');
console.log('5. Maintain all API connections');

module.exports = { pagesToUpdate, integrationPages, designSystemImports, transformations };