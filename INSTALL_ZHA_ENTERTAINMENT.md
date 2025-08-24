# Installing ZHA Entertainment Mode on Home Assistant OS

## ⚠️ IMPORTANT: Current Status

This is a **PROOF OF CONCEPT** implementation. It's NOT fully production-ready yet because:

1. **Missing Integration**: The bridge between diyHue and ZHA needs to be integrated into diyHue's entertainment.py
2. **Testing Required**: Needs testing with actual Hue bulbs on ZHA
3. **Conflicts with existing ZHA**: Will replace your existing ZHA integration

## Installation Options

### Option 1: As Custom Component (Recommended for Testing)

This will **REPLACE** your existing ZHA integration with the entertainment-enabled version.

#### Step 1: Backup Your Current Setup
```bash
# Create a full backup in Home Assistant
Settings -> System -> Backups -> Create Backup
```

#### Step 2: Access Your HAOS System

**Via SSH Add-on:**
1. Install "Terminal & SSH" add-on from the Add-on Store
2. Start the add-on and open Web UI

**Via Samba Share:**
1. Install "Samba share" add-on
2. Access `\\homeassistant.local\config` from your computer

#### Step 3: Install Custom Component

**Via SSH:**
```bash
# Navigate to config directory
cd /config

# Create custom components directory if it doesn't exist
mkdir -p custom_components

# Download the modified ZHA (you'll need to host these files somewhere first)
# For now, manually copy the files
```

**Manual Installation:**
1. Copy the entire `custom_components/zha_entertainment` folder to `/config/custom_components/`
2. The structure should be:
```
/config/custom_components/zha_entertainment/
├── __init__.py
├── manifest.json
├── entertainment.py
├── light.py
├── websocket_api.py
└── ... (all other ZHA files)
```

#### Step 4: Disable Original ZHA
1. Go to Settings -> Devices & Services
2. Find your ZHA integration
3. Click the 3 dots menu -> Disable

#### Step 5: Add Custom ZHA
1. Restart Home Assistant
2. Go to Settings -> Devices & Services
3. Add Integration -> Search for "Zigbee Home Automation with Entertainment Mode"
4. Configure with your Zigbee coordinator

### Option 2: Direct File Modification (Advanced Users)

**⚠️ This modifies core files and will be overwritten on HA updates!**

```bash
# SSH into HAOS with protection mode disabled
# Access the Home Assistant container
docker exec -it homeassistant bash

# Navigate to ZHA component
cd /usr/src/homeassistant/homeassistant/components/zha

# Backup original files
cp light.py light.py.backup
cp websocket_api.py websocket_api.py.backup

# Add entertainment.py (you need to copy the file content)
vi entertainment.py
# Paste the entertainment.py content

# Modify light.py and websocket_api.py
# (Apply the changes manually)

# Restart Home Assistant
```

## Integration with diyHue

### Step 1: Modify diyHue's entertainment.py

Add this to your diyHue's `BridgeEmulator/services/entertainment.py`:

```python
# At the top of the file
import aiohttp
import asyncio

# Add this class
class ZHAEntertainmentConnector:
    def __init__(self, ha_url, ha_token):
        self.ha_url = ha_url
        self.ha_token = ha_token
        self.session = None
        self.ws = None
        self.msg_id = 1
        
    async def connect(self):
        self.session = aiohttp.ClientSession()
        self.ws = await self.session.ws_connect(f"{self.ha_url}/api/websocket")
        
        # Authenticate
        msg = await self.ws.receive_json()
        await self.ws.send_json({
            "type": "auth",
            "access_token": self.ha_token
        })
        result = await self.ws.receive_json()
        return result["type"] == "auth_ok"
        
    async def create_group(self, group_id, light_entities):
        await self.ws.send_json({
            "id": self.msg_id,
            "type": "zha/entertainment/create_group",
            "group_id": group_id,
            "lights": light_entities
        })
        self.msg_id += 1
        return await self.ws.receive_json()
        
    async def start_stream(self, group_id):
        await self.ws.send_json({
            "id": self.msg_id,
            "type": "zha/entertainment/start_stream",
            "group_id": group_id
        })
        self.msg_id += 1
        return await self.ws.receive_json()
        
    async def update_colors(self, group_id, colors):
        await self.ws.send_json({
            "id": self.msg_id,
            "type": "zha/entertainment/update_colors",
            "group_id": group_id,
            "colors": colors
        })
        self.msg_id += 1
        # Don't wait for response for speed
        
    async def stop_stream(self, group_id):
        await self.ws.send_json({
            "id": self.msg_id,
            "type": "zha/entertainment/stop_stream",
            "group_id": group_id
        })
        self.msg_id += 1
        return await self.ws.receive_json()

# In the entertainmentService function, add:
zha_connector = None
if bridgeConfig.get("config", {}).get("homeassistant", {}).get("use_entertainment"):
    zha_connector = ZHAEntertainmentConnector(
        bridgeConfig["config"]["homeassistant"]["url"],
        bridgeConfig["config"]["homeassistant"]["token"]
    )
    await zha_connector.connect()
    
    # Create entertainment group with ZHA lights
    zha_lights = []
    for light in group.lights:
        if light().protocol == "homeassistant_ws":
            # Map to HA entity ID
            zha_lights.append(f"light.{light().name.lower().replace(' ', '_')}")
    
    if zha_lights:
        await zha_connector.create_group(group.id_v1, zha_lights)
        await zha_connector.start_stream(group.id_v1)

# In the color update section:
if zha_connector and haLights:
    # Convert to ZHA format
    zha_colors = {}
    for light_data in haLights:
        entity_id = f"light.{light_data['light'].name.lower().replace(' ', '_')}"
        zha_colors[entity_id] = {
            "x": light_data["data"]["xy"][0],
            "y": light_data["data"]["xy"][1],
            "bri": light_data["data"]["bri"]
        }
    await zha_connector.update_colors(group.id_v1, zha_colors)
```

### Step 2: Configure diyHue

Add to diyHue's config:

```json
{
  "config": {
    "homeassistant": {
      "url": "ws://homeassistant.local:8123",
      "token": "your_long_lived_access_token",
      "use_entertainment": true
    }
  }
}
```

### Step 3: Get a Long-Lived Access Token

1. In Home Assistant, click your profile (bottom left)
2. Scroll to "Long-Lived Access Tokens"
3. Create Token
4. Copy and save it securely

## Testing

### Check if Entertainment Mode is Working

1. **Check WebSocket API:**
```bash
# In Home Assistant Developer Tools -> Services
# Call service: websocket_api.send_message
# Message:
{
  "type": "zha/entertainment/create_group",
  "group_id": "test_group",
  "lights": ["light.hue_bulb_1"]
}
```

2. **Check Logs:**
```bash
# SSH into HAOS
docker logs homeassistant | grep -i entertainment
```

3. **Test with diyHue:**
- Set up entertainment area in Hue app
- Start Hue Sync or similar
- Monitor Home Assistant logs

## Troubleshooting

### "Integration not found"
- Ensure manifest.json has `"version": "1.0.0"`
- Check file permissions
- Restart Home Assistant fully

### "No entertainment capable lights"
- Check light model numbers in Developer Tools -> States
- Verify lights are connected via ZHA, not another integration

### Performance Issues
- Reduce number of lights in entertainment group
- Check Zigbee coordinator capabilities
- Monitor `homeassistant.log` for errors

## Limitations

1. **Not Production Ready**: This needs more testing
2. **Replaces ZHA**: Can't run alongside standard ZHA
3. **No Official Support**: This is a custom modification
4. **Update Risk**: HA updates may break this

## Recommended Approach

**For now, I recommend:**

1. **Test on a development HA instance first**
2. **Wait for more testing** before production use
3. **Consider contributing to upstream ZHA** to get this officially supported

## Alternative: Keep Current Setup

Your current optimizations (socket pooling, rate limiting) already provide significant improvements. This ZHA modification would provide additional benefits but requires more development and testing.

## Next Steps

To make this production-ready:

1. **Test with actual Hue bulbs** on ZHA
2. **Integrate properly with diyHue** entertainment.py
3. **Add error handling** and recovery
4. **Performance profiling** with different coordinators
5. **Submit as PR** to Home Assistant core

Would you like to:
1. Test this on a dev instance first?
2. Help integrate it properly with diyHue?
3. Wait for more development before installing?