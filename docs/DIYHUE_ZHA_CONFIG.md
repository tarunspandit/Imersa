# diyHue ZHA Entertainment Configuration

## Overview

This guide explains how to configure diyHue to use ZHA entertainment mode for faster light updates with Philips Hue bulbs connected via ZHA.

## Prerequisites

1. **Modified ZHA Integration** installed in Home Assistant (see INSTALL_ZHA_ENTERTAINMENT.md)
2. **Home Assistant Long-Lived Access Token**
3. **Philips Hue bulbs connected via ZHA**

## Configuration Steps

### 1. Get Home Assistant Access Token

1. In Home Assistant, click your profile (bottom left)
2. Scroll to "Long-Lived Access Tokens"
3. Click "Create Token"
4. Name it "diyHue Entertainment"
5. Copy the token and save it securely

### 2. Configure diyHue

Edit your diyHue configuration file (`config.json` or via web interface):

```json
{
  "config": {
    "homeassistant": {
      "url": "ws://homeassistant.local:8123",
      "token": "YOUR_LONG_LIVED_ACCESS_TOKEN_HERE",
      "use_zha_entertainment": true
    },
    "ipaddress": "YOUR_DIYHUE_IP",
    "gateway": "YOUR_GATEWAY_IP",
    "mqtt": {
      "enabled": false
    }
  }
}
```

**Configuration Options:**

- `url`: Your Home Assistant URL (use `ws://` for WebSocket)
  - Local: `ws://homeassistant.local:8123` or `ws://192.168.1.100:8123`
  - HTTPS: `wss://your-domain.duckdns.org:8123`
- `token`: The long-lived access token from step 1
- `use_zha_entertainment`: Set to `true` to enable ZHA entertainment mode

### 3. Add Home Assistant Lights to diyHue

1. In diyHue web interface, go to "Lights"
2. Click "Add Light"
3. Choose "Home Assistant" as protocol
4. Configure each light with:
   - **Name**: Match the Home Assistant entity name (e.g., "Hue Bulb 1")
   - **Entity ID**: The Home Assistant entity ID (e.g., "light.hue_bulb_1")
   - **Model ID**: Use appropriate Hue model (e.g., "LCT015" for color bulb)

### 4. Verify Light Mapping

The system will automatically map diyHue lights to Home Assistant entities based on:
1. Entity ID in protocol configuration (preferred)
2. Name matching (fallback)

Check logs to verify mapping:
```bash
docker logs diyhue | grep "Mapped diyHue light"
```

### 5. Create Entertainment Area

1. Open the official Hue app
2. Go to Settings -> Entertainment areas
3. Create a new entertainment area
4. Add your Home Assistant-connected lights
5. Position them in the room layout

### 6. Test Entertainment Mode

1. Use Hue Sync app or similar
2. Start entertainment
3. Monitor diyHue logs:

```bash
docker logs -f diyhue | grep -E "ZHA|entertainment"
```

You should see:
```
ZHA entertainment mode enabled for group
Started ZHA entertainment streaming for group 1
```

## Performance Tuning

### Optimize Update Rate

In `zha_entertainment.py`, adjust:

```python
self.min_update_interval = 0.033  # Default: ~30 FPS

# For better performance with fewer lights:
self.min_update_interval = 0.016  # ~60 FPS

# For more lights or weaker coordinator:
self.min_update_interval = 0.050  # ~20 FPS
```

### Disable Regular HA Updates

When ZHA entertainment is active, regular Home Assistant updates are automatically disabled to prevent conflicts.

### Monitor Performance

Check actual frame rate in logs:
```bash
docker logs diyhue | grep "Entertainment FPS"
```

## Troubleshooting

### "Failed to connect to Home Assistant"

**Check:**
- URL is correct (ws:// not http://)
- Token is valid and not expired
- Home Assistant is accessible from diyHue container

**Test connection:**
```bash
# From diyHue container
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://homeassistant.local:8123/api/
```

### "No Home Assistant lights found"

**Check:**
- Lights are added to diyHue with protocol "homeassistant_ws"
- Entity IDs match exactly with Home Assistant
- Lights are actually connected via ZHA in Home Assistant

### "Failed to create entertainment group"

**Check:**
- Modified ZHA integration is installed and active
- WebSocket API commands are registered
- No errors in Home Assistant logs

**Test WebSocket manually:**
```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://homeassistant.local:8123/api/websocket")

# Auth flow
result = json.loads(ws.recv())
ws.send(json.dumps({
    "type": "auth",
    "access_token": "YOUR_TOKEN"
}))
auth_result = json.loads(ws.recv())
print(auth_result)

# Test command
ws.send(json.dumps({
    "id": 1,
    "type": "zha/entertainment/create_group",
    "group_id": "test",
    "lights": ["light.hue_bulb_1"]
}))
response = json.loads(ws.recv())
print(response)
```

### Performance Not Improved

**Check:**
1. ZHA entertainment is actually active (check logs)
2. Lights support entertainment mode (check model numbers)
3. Zigbee coordinator can handle the load
4. No other Zigbee traffic during entertainment

## Expected Performance

With ZHA entertainment mode enabled:

| Metric | Standard HA | ZHA Entertainment |
|--------|-------------|-------------------|
| Latency | 500-1000ms | 50-100ms |
| Max FPS | 2-5 | 25-30 |
| Smooth Lights | 2-3 | 5-8 |

## Security Considerations

1. **Token Security**: Never commit the access token to version control
2. **Network Security**: Use local network or VPN, avoid exposing HA to internet
3. **Permission Scope**: Token has full Home Assistant access, protect it carefully

## Rollback

To disable ZHA entertainment and return to standard mode:

1. Set `use_zha_entertainment` to `false` in config
2. Restart diyHue
3. Entertainment will use regular Home Assistant WebSocket updates

## Advanced: Custom Light Mapping

For complex setups, you can manually specify entity mappings in `zha_entertainment.py`:

```python
# In map_lights() function
custom_mapping = {
    "1": "light.living_room_hue_1",
    "2": "light.living_room_hue_2",
    "3": "light.bedroom_hue_1"
}
mapping.update(custom_mapping)
```

## Contributing

If this works well for you:
1. Report your Zigbee coordinator model and performance metrics
2. Share any improvements to the code
3. Help test with different Hue bulb models
4. Support getting this into official Home Assistant