# Adding ZHA Entertainment Toggle to diyHue Web UI

Since diyHue's web interface doesn't currently have a direct config editor for this setting, here are the options:

## Current Method: Direct Config Edit

### Via Docker:
```bash
# Edit config inside container
docker exec -it diyhue bash
cd /opt/hue-emulator
vi config.json

# Or edit from outside
docker exec -it diyhue cat /opt/hue-emulator/config.json > config_backup.json
# Edit config_backup.json
docker cp config_backup.json diyhue:/opt/hue-emulator/config.json
docker restart diyhue
```

### Config Structure:
```json
{
  "config": {
    "homeassistant": {
      "url": "ws://homeassistant.local:8123",
      "token": "your_token_here",
      "use_zha_entertainment": true
    }
  }
}
```

## DEFAULT BEHAVIOR (No Config Needed!)

**🎉 ZHA Entertainment is now ENABLED BY DEFAULT!**

The system will:
1. ✅ Automatically try ZHA entertainment if Home Assistant is configured
2. ✅ Fall back to standard mode if it fails
3. ✅ Log which mode is active

You only need to add config to:
- **Disable it**: Set `"use_zha_entertainment": false`
- **Change settings**: Modify URL or token

## Adding to Web UI (For Developers)

To add a toggle to the diyHue web interface, modify:

### In `BridgeEmulator/flaskUI/templates/devices.html` or similar:

```html
<!-- Add to Home Assistant section -->
<div class="form-group">
    <label>Home Assistant Settings</label>
    <input type="text" id="ha_url" placeholder="ws://homeassistant.local:8123" class="form-control">
    <input type="password" id="ha_token" placeholder="Long-lived access token" class="form-control mt-2">
    <div class="form-check mt-2">
        <input type="checkbox" class="form-check-input" id="use_zha_entertainment" checked>
        <label class="form-check-label" for="use_zha_entertainment">
            Use ZHA Entertainment Mode (Faster updates for Hue bulbs)
            <small class="text-muted d-block">Automatically falls back if not available</small>
        </label>
    </div>
</div>
```

### In the JavaScript handler:

```javascript
// Save config
function saveHAConfig() {
    const config = {
        homeassistant: {
            url: document.getElementById('ha_url').value,
            token: document.getElementById('ha_token').value,
            use_zha_entertainment: document.getElementById('use_zha_entertainment').checked
        }
    };
    
    fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config)
    });
}

// Load config
fetch('/api/config')
    .then(r => r.json())
    .then(config => {
        if (config.homeassistant) {
            document.getElementById('ha_url').value = config.homeassistant.url || '';
            document.getElementById('ha_token').value = config.homeassistant.token || '';
            // Default to true if not set
            document.getElementById('use_zha_entertainment').checked = 
                config.homeassistant.use_zha_entertainment !== false;
        }
    });
```

## Checking Status

### View Current Mode:
```bash
docker logs diyhue --tail 50 | grep -E "ZHA entertainment|entertainment mode|falling back"
```

### Success Messages:
```
✓ ZHA entertainment mode ACTIVE for group 1 - Expect faster performance!
```

### Fallback Messages:
```
ZHA entertainment setup failed, falling back to standard mode: [reason]
ZHA entertainment client not available, using standard mode
Failed to create ZHA entertainment group, falling back to standard mode
```

## Performance Indicators

You'll know ZHA entertainment is working when:
- 🚀 Colors change with minimal delay (50-100ms)
- 🎯 Smooth transitions during music sync
- 📊 Higher FPS reported in logs
- ✅ "ZHA entertainment mode ACTIVE" in logs

You'll know it's using standard mode when:
- 🐌 Noticeable lag (500-1000ms)
- 🔄 "falling back to standard mode" in logs
- ⚠️ Choppy color transitions

## Troubleshooting via UI

Future web UI could show:
- 🟢 Green dot: ZHA Entertainment Active
- 🟡 Yellow dot: Standard Mode (Fallback)
- 🔴 Red dot: No Home Assistant Connection

For now, check logs to see which mode is active!