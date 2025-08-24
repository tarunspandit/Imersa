# 🚀 Quick Install Guide - ZHA Entertainment Mode

## ⚠️ WARNING: This is EXPERIMENTAL
- **Replaces your existing ZHA integration**
- **Test on a development system first**
- **Make a backup before proceeding**

## Option 1: Simple Test (Temporary - Safest)

This modifies core files but changes are lost on HA update.

### Step 1: Access Home Assistant Container

```bash
# SSH into Home Assistant (you need SSH addon installed)
ssh root@homeassistant.local

# Enter the Home Assistant container
docker exec -it homeassistant bash
```

### Step 2: Apply the Modifications

```bash
# Navigate to ZHA component
cd /usr/src/homeassistant/homeassistant/components/zha

# Download the modified files directly
curl -o entertainment.py https://raw.githubusercontent.com/yourusername/zha-entertainment/main/entertainment.py
curl -o light_new.py https://raw.githubusercontent.com/yourusername/zha-entertainment/main/light.py
curl -o websocket_new.py https://raw.githubusercontent.com/yourusername/zha-entertainment/main/websocket_api.py

# Backup originals
cp light.py light.py.backup
cp websocket_api.py websocket_api.py.backup

# Apply changes
mv light_new.py light.py
mv websocket_new.py websocket_api.py

# Exit container
exit
```

### Step 3: Restart Home Assistant

```bash
# From SSH
ha core restart
```

## Option 2: Custom Component (Permanent)

**⚠️ This DISABLES your existing ZHA!**

### Step 1: Install File Editor Add-on

1. Go to Settings → Add-ons → Add-on Store
2. Search for "File editor"
3. Install and start it

### Step 2: Create Custom Component

Using File Editor, create this structure:
```
/config/custom_components/zha_entertainment/
├── __init__.py (copy from original ZHA)
├── manifest.json (modified - see below)
├── entertainment.py (new file)
├── light.py (modified)
├── websocket_api.py (modified)
└── (copy all other files from original ZHA)
```

### Step 3: Modify manifest.json

Change these lines:
```json
{
  "domain": "zha_entertainment",
  "name": "ZHA with Entertainment Mode",
  "version": "1.0.0"
}
```

### Step 4: Disable Original ZHA

1. Settings → Devices & Services → ZHA → 3 dots → Disable
2. Restart Home Assistant
3. Add new integration "ZHA with Entertainment Mode"

## For diyHue Side

### Step 1: Install WebSocket Library

```bash
# From your system (not in HA)
docker exec -it diyhue pip install websocket-client
```

### Step 2: Update diyHue Files

```bash
# Copy the new entertainment files
docker cp BridgeEmulator/services/zha_entertainment.py diyhue:/opt/hue-emulator/BridgeEmulator/services/
docker cp BridgeEmulator/services/entertainment.py diyhue:/opt/hue-emulator/BridgeEmulator/services/
```

### Step 3: Configure (Optional - It's Default Now!)

The system will automatically try ZHA entertainment if Home Assistant is configured.

To explicitly disable (not recommended):
```json
{
  "config": {
    "homeassistant": {
      "use_zha_entertainment": false
    }
  }
}
```

### Step 4: Restart diyHue

```bash
docker restart diyhue
```

## Testing

Check logs to see if it's working:
```bash
docker logs diyhue | grep -i "ZHA entertainment"
```

You should see:
```
✓ ZHA entertainment mode ACTIVE for group 1 - Expect faster performance!
```

If it fails, you'll see:
```
ZHA entertainment setup failed, falling back to standard mode
```

## The system will AUTOMATICALLY:
- ✅ Try ZHA entertainment first
- ✅ Fall back to standard mode if it fails
- ✅ Log what mode is being used
- ✅ Work with or without the HA modifications

## Quick Troubleshooting

### "Failed to connect to Home Assistant"
- Check your HA token is valid
- Check URL is ws:// not http://

### "No entertainment capable lights found"  
- The modified ZHA isn't installed in HA
- Lights aren't Philips Hue models

### Want to force standard mode?
Add to diyHue config:
```json
"use_zha_entertainment": false
```

## Uninstall

### Remove from Home Assistant:
```bash
docker exec -it homeassistant bash
cd /usr/src/homeassistant/homeassistant/components/zha
mv light.py.backup light.py
mv websocket_api.py.backup websocket_api.py
rm entertainment.py
exit
ha core restart
```

### Remove from diyHue:
Just restart - it'll automatically use standard mode

## Performance Expectations

| Mode | Status in Logs | Expected FPS |
|------|----------------|--------------|
| ZHA Entertainment | "✓ ZHA entertainment mode ACTIVE" | 25-30 FPS |
| Standard (fallback) | "falling back to standard mode" | 2-5 FPS |

The system automatically uses the best available option!