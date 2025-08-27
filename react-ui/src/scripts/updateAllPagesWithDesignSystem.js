#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of pages that need updating
const pagesToUpdate = [
  { file: 'Scheduler.tsx', icon: 'Clock', title: 'Scheduler', subtitle: 'Create and manage lighting schedules' },
  { file: 'AutomationPage.tsx', icon: 'Settings', title: 'Automation', subtitle: 'Configure automated lighting rules' },
  { file: 'DevicesComplete.tsx', icon: 'Monitor', title: 'Devices', subtitle: 'Manage connected devices and hardware' },
  { file: 'BridgeManagement.tsx', icon: 'Server', title: 'Bridge Management', subtitle: 'Configure and monitor your Imersa bridge' },
  { file: 'AppUsers.tsx', icon: 'Users', title: 'App Users', subtitle: 'Manage user accounts and permissions' },
  { file: 'SensorsPage.tsx', icon: 'Activity', title: 'Sensors', subtitle: 'Monitor and configure sensor devices' },
  { file: 'Help.tsx', icon: 'HelpCircle', title: 'Help & Support', subtitle: 'Get help with Imersa' },
  { file: 'NotFound.tsx', icon: 'AlertTriangle', title: '404 - Page Not Found', subtitle: 'The page you are looking for does not exist' },
];

const integrationPages = [
  { file: 'integrations/IntegrationHub.tsx', icon: 'Plug', title: 'Integration Hub', subtitle: 'Connect third-party services and devices' },
  { file: 'integrations/TradfriIntegration.tsx', icon: 'Home', title: 'IKEA TRÅDFRI', subtitle: 'Connect and control IKEA smart lights' },
  { file: 'integrations/PhilipsHueIntegration.tsx', icon: 'Lightbulb', title: 'Philips Hue', subtitle: 'Sync with Philips Hue bridges' },
  { file: 'integrations/GoveeIntegration.tsx', icon: 'Wifi', title: 'Govee', subtitle: 'Control Govee smart lights' },
  { file: 'integrations/DeconzIntegration.tsx', icon: 'Radio', title: 'deCONZ', subtitle: 'Connect Zigbee devices via deCONZ' },
  { file: 'integrations/HomeAssistantIntegration.tsx', icon: 'Home', title: 'Home Assistant', subtitle: 'Integrate with Home Assistant' },
  { file: 'integrations/MQTTIntegration.tsx', icon: 'Network', title: 'MQTT', subtitle: 'Connect via MQTT protocol' },
];

const transformations = [
  // Import changes
  { 
    pattern: /import\s+{\s*Card[^}]*}\s+from\s+['"]@\/components\/ui['"];?/g,
    replacement: "import { PageWrapper } from '@/components/layout/PageWrapper';\nimport '@/styles/design-system.css';\nimport { cn } from '@/utils';"
  },
  
  // Replace Card with glass-card
  { pattern: /<Card>/g, replacement: '<div className="glass-card p-6">' },
  { pattern: /<\/Card>/g, replacement: '</div>' },
  { pattern: /<Card\s+className="([^"]*)"/g, replacement: '<div className="glass-card p-6 $1"' },
  
  // Replace CardHeader/CardTitle
  { pattern: /<CardHeader>\s*<CardTitle>/g, replacement: '<div className="mb-4"><h3 className="text-xl font-semibold text-white">' },
  { pattern: /<\/CardTitle>\s*<\/CardHeader>/g, replacement: '</h3></div>' },
  
  // Replace CardContent
  { pattern: /<CardContent>/g, replacement: '<div>' },
  { pattern: /<\/CardContent>/g, replacement: '</div>' },
  { pattern: /<CardContent\s+className="([^"]*)"/g, replacement: '<div className="$1"' },
  
  // Replace Button with button
  { pattern: /<Button\s+onClick/g, replacement: '<button onClick' },
  { pattern: /<Button\s+/g, replacement: '<button ' },
  { pattern: /<\/Button>/g, replacement: '</button>' },
  
  // Replace Input with input
  { pattern: /<Input\s+/g, replacement: '<input ' },
  
  // Update button classes
  { pattern: /className="btn-primary"/g, replacement: 'className="btn-glow flex items-center gap-2"' },
  { pattern: /className="btn-secondary"/g, replacement: 'className="px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all"' },
  
  // Update text colors
  { pattern: /text-muted-foreground/g, replacement: 'text-gray-400' },
  { pattern: /text-gray-900/g, replacement: 'text-white' },
  { pattern: /bg-gray-50/g, replacement: 'bg-white/5' },
  { pattern: /border-gray-200/g, replacement: 'border-white/10' },
  { pattern: /border-gray-300/g, replacement: 'border-white/10' },
  
  // Update input styles
  { pattern: /className="([^"]*\s)?Input(\s[^"]*)"/g, replacement: 'className="$1px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500$2"' },
];

function updatePageFile(filePath, pageConfig) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Apply transformations
    transformations.forEach(({ pattern, replacement }) => {
      content = content.replace(pattern, replacement);
    });
    
    // Add PageWrapper if not present
    if (!content.includes('PageWrapper') && !content.includes('404')) {
      // Find the main return statement
      const returnMatch = content.match(/return\s*\(\s*<div\s+className="[^"]*p-6[^"]*"/);
      if (returnMatch) {
        const wrapperCode = `return (
    <PageWrapper
      icon={<${pageConfig.icon} className="w-8 h-8 text-imersa-dark" />}
      title="${pageConfig.title}"
      subtitle="${pageConfig.subtitle}"
    >`;
        content = content.replace(/return\s*\(\s*<div[^>]*>/, wrapperCode);
        
        // Replace closing div with PageWrapper
        const lastDivIndex = content.lastIndexOf('</div>');
        if (lastDivIndex !== -1) {
          content = content.substring(0, lastDivIndex) + '</PageWrapper>' + content.substring(lastDivIndex + 6);
        }
      }
    }
    
    // Ensure imports include necessary icons
    if (!content.includes(`import {`) || !content.includes(pageConfig.icon)) {
      const iconImport = `import { ${pageConfig.icon} } from 'lucide-react';`;
      if (!content.includes(iconImport)) {
        content = iconImport + '\n' + content;
      }
    }
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  Skipped (no changes): ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
async function main() {
  const pagesDir = path.join(__dirname, '../../pages');
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  console.log('🎨 Starting design system update for all pages...\n');
  
  // Update regular pages
  console.log('📄 Updating main pages...');
  for (const page of pagesToUpdate) {
    const filePath = path.join(pagesDir, page.file);
    if (fs.existsSync(filePath)) {
      const result = updatePageFile(filePath, page);
      if (result === true) updatedCount++;
      else if (result === false) skippedCount++;
      else errorCount++;
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
      errorCount++;
    }
  }
  
  // Update integration pages
  console.log('\n🔌 Updating integration pages...');
  for (const page of integrationPages) {
    const filePath = path.join(pagesDir, page.file);
    if (fs.existsSync(filePath)) {
      const result = updatePageFile(filePath, page);
      if (result === true) updatedCount++;
      else if (result === false) skippedCount++;
      else errorCount++;
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
      errorCount++;
    }
  }
  
  console.log(`
========================================
✨ Design System Update Complete!
========================================
✅ Updated: ${updatedCount} files
⏭️  Skipped: ${skippedCount} files
❌ Errors: ${errorCount} files
========================================
  `);
}

// Run the script
main().catch(console.error);