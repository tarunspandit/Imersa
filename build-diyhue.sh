#!/bin/bash

# Build enhanced diyHue Docker image with ZHA Entertainment support

echo "🚀 Building Enhanced diyHue with ZHA Entertainment"
echo "=================================================="

# Build the Docker image
docker build -f Dockerfile.diyhue-zha -t diyhue-zha:latest .

echo ""
echo "✅ Build complete!"
echo ""
echo "To use the new image:"
echo "====================="
echo ""
echo "1. Stop current diyHue:"
echo "   docker stop diyhue"
echo ""
echo "2. Backup your config:"
echo "   docker cp diyhue:/opt/hue-emulator/config.json ./config-backup.json"
echo ""
echo "3. Run new version:"
echo "   docker run -d --name diyhue-zha \\"
echo "     --network=host \\"
echo "     --restart=unless-stopped \\"
echo "     -v /opt/hue-emulator/config:/opt/hue-emulator/config \\"
echo "     -e MAC=00:11:22:33:44:55 \\"
echo "     -e IP=YOUR_IP \\"
echo "     diyhue-zha:latest"
echo ""
echo "Or replace existing container:"
echo "   docker rm diyhue"
echo "   docker run -d --name diyhue [same options as above]"