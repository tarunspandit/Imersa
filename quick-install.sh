#!/bin/bash

# Quick installer for ZHA Entertainment Mode
# Run this from your computer (not in HAOS)

echo "🚀 ZHA Entertainment Quick Installer"
echo "===================================="
echo ""

# Check for required files
if [ ! -d "ha_core_zha/homeassistant/components/zha" ]; then
    echo "❌ Error: Modified ZHA files not found"
    echo "   Make sure you're in the Imersa directory"
    exit 1
fi

# Get HA address
read -p "Enter your Home Assistant address [homeassistant.local]: " HA_HOST
HA_HOST=${HA_HOST:-homeassistant.local}

echo ""
echo "📦 Creating installation package..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
mkdir -p $TEMP_DIR/zha

# Copy only the needed files
cp ha_core_zha/homeassistant/components/zha/entertainment.py $TEMP_DIR/zha/
cp ha_core_zha/homeassistant/components/zha/light.py $TEMP_DIR/zha/
cp ha_core_zha/homeassistant/components/zha/websocket_api.py $TEMP_DIR/zha/

# Create install script
cat > $TEMP_DIR/install.sh << 'EOF'
#!/bin/bash
echo "Installing ZHA Entertainment Mode..."

# Enter HA container
docker exec -i homeassistant bash << 'INNER'
cd /tmp
# Backup originals
cp /usr/src/homeassistant/homeassistant/components/zha/light.py /tmp/light.py.backup 2>/dev/null
cp /usr/src/homeassistant/homeassistant/components/zha/websocket_api.py /tmp/websocket_api.py.backup 2>/dev/null

# Copy new files
cp /tmp/zha/* /usr/src/homeassistant/homeassistant/components/zha/
echo "✅ Files installed"
INNER

echo "Restarting Home Assistant..."
ha core restart
echo "✅ Installation complete!"
EOF

chmod +x $TEMP_DIR/install.sh

# Package it
cd $TEMP_DIR
tar -czf zha_entertainment.tar.gz zha/ install.sh

echo "📤 Uploading to Home Assistant..."
scp zha_entertainment.tar.gz root@${HA_HOST}:/tmp/

echo ""
echo "📝 Now SSH into your Home Assistant and run:"
echo ""
echo "   ssh root@${HA_HOST}"
echo "   cd /tmp && tar -xzf zha_entertainment.tar.gz && ./install.sh"
echo ""
echo "Or for manual installation:"
echo "   The files are in /tmp/zha/ on your HA system"
echo ""

# Cleanup
rm -rf $TEMP_DIR

echo "✅ Package uploaded to Home Assistant!"
echo ""
echo "🐳 Don't forget to build your enhanced diyHue:"
echo "   ./build-diyhue.sh"