#!/bin/bash

# ZHA Entertainment Mode Installer for Home Assistant OS
# This script packages and installs the modified ZHA integration

set -e

echo "🚀 ZHA Entertainment Mode Installer"
echo "===================================="
echo ""
echo "⚠️  WARNING: This is EXPERIMENTAL!"
echo "⚠️  It will modify your ZHA integration"
echo "⚠️  Make sure you have a backup!"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "custom_components/zha_entertainment/manifest.json" ]; then
    echo "❌ Error: Run this script from the Imersa directory"
    exit 1
fi

# Create a package
echo "📦 Creating installation package..."
tar -czf zha_entertainment.tar.gz custom_components/zha_entertainment/

echo ""
echo "📋 Installation Instructions:"
echo "============================="
echo ""
echo "1. Copy zha_entertainment.tar.gz to your Home Assistant config directory:"
echo "   - Via Samba: Copy to \\\\homeassistant.local\\config"
echo "   - Via SCP: scp zha_entertainment.tar.gz root@homeassistant.local:/config/"
echo ""
echo "2. SSH into Home Assistant and extract:"
echo "   ssh root@homeassistant.local"
echo "   cd /config"
echo "   tar -xzf zha_entertainment.tar.gz"
echo ""
echo "3. In Home Assistant UI:"
echo "   - Go to Settings → Devices & Services"
echo "   - Find ZHA → 3 dots → Disable"
echo "   - Restart Home Assistant"
echo "   - Add Integration → Search 'ZHA with Entertainment Mode'"
echo ""
echo "4. For diyHue (on your host system):"
echo "   docker exec -it diyhue pip install websocket-client"
echo "   docker cp BridgeEmulator/services/zha_entertainment.py diyhue:/opt/hue-emulator/BridgeEmulator/services/"
echo "   docker restart diyhue"
echo ""
echo "✅ Package created: zha_entertainment.tar.gz"