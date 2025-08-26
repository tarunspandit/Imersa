# 🐳 Docker Integration Guide

## Steps to Replace Flask UI with React UI in Docker

### 1. Build React UI
```bash
cd /Users/tarunpandit/Documents/DEV/Imersa/react-ui
npx vite build --mode production
```

### 2. Copy React Build Files to Docker Container
```bash
# After Docker container is running
docker cp react-ui/dist/. diyhue-development:/opt/hue-emulator/react-ui/

# Or add to Dockerfile:
COPY react-ui/dist /opt/hue-emulator/react-ui
```

### 3. Modified Flask Routes
The `views.py` file has been updated to:
- Serve React `index.html` for all UI routes (`/`, `/ui/*`)
- Serve React static files (JS, CSS, assets)
- Convert template routes to JSON APIs for React
- Maintain all existing API endpoints

### 4. React UI Features in Docker
✅ **All Features Available:**
- Modern React UI with all migrated features
- Real-time light controls with debouncing  
- Entertainment streaming with 3D positioning
- WLED gradient editor with drag-drop
- Yeelight music visualization
- Advanced scheduling and automation
- IoT sensors monitoring with charts
- Scene management with categories
- Mobile-responsive design
- Dark mode support

### 5. API Compatibility
✅ **Full Hue API Compatibility Maintained:**
- `/api/{key}/lights` - Light control
- `/api/{key}/groups` - Groups and entertainment
- `/api/{key}/scenes` - Scene management  
- `/api/{key}/schedules` - Automation
- `/api/{key}/sensors` - Sensor monitoring
- `/api/{key}/rules` - Automation rules
- All existing endpoints preserved

### 6. Deployment Steps
```bash
# 1. Build React UI
npm run build  # Creates dist/ folder

# 2. Copy to Docker context
cp -r react-ui/dist/* /path/to/docker/build/react-ui/

# 3. Rebuild Docker image
docker build -t diyhue:react-ui .

# 4. Run with same command
docker run --hostname=409377c94cf8 --mac-address=3e:66:4f:c4:42:06 \
  --env=MAC=5c:1b:f4:99:32:8c --env=IP=192.168.1.187 \
  --volume=/Users/tarunspandit/Documents/diyhue:/opt/hue-emulator/config \
  --network=bridge --workdir=/opt/hue-emulator \
  -p 1900:1900/udp -p 1982:1982/udp -p 2100:2100/udp \
  -p 443:443 -p 80:80 -p 59000:59000/tcp \
  --name "diyhue-react-ui" --restart=always -d diyhue:react-ui
```

### 7. Result
🎉 **Same Docker container now serves:**
- ✅ Modern React UI (frontend)
- ✅ Hue Bridge API (backend) 
- ✅ Entertainment streaming
- ✅ Device discovery and pairing
- ✅ All original functionality + enhancements

The container will serve the React UI on port 80/443 while maintaining full Hue API compatibility.