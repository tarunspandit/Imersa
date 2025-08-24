# 📦 Installing ZHA Entertainment on Home Assistant OS

## Prerequisites
- Home Assistant OS with SSH access
- File Editor or Studio Code Server addon
- Your diyHue already connected to Home Assistant

## 🚀 Method 1: Quick Test (Easiest & Safest)

This method temporarily modifies ZHA. Changes are lost on HA update, but it's safe to test.

### Step 1: Enable SSH Access

1. Install "Terminal & SSH" addon from Add-on Store
2. Configure it with a password or SSH key
3. Start the addon

### Step 2: Upload the Modified Files

From your computer:

```bash
# Create the package
cd /path/to/Imersa
tar -czf zha_entertainment.tar.gz \
  ha_core_zha/homeassistant/components/zha/entertainment.py \
  ha_core_zha/homeassistant/components/zha/light.py \
  ha_core_zha/homeassistant/components/zha/websocket_api.py

# Upload to Home Assistant
scp zha_entertainment.tar.gz root@homeassistant.local:/tmp/
```

### Step 3: Apply the Modifications

SSH into Home Assistant:

```bash
ssh root@homeassistant.local

# Enter the HA container
docker exec -it homeassistant bash

# Extract and apply the files
cd /tmp
tar -xzf zha_entertainment.tar.gz
cd ha_core_zha/homeassistant/components/zha/

# Backup originals
cp /usr/src/homeassistant/homeassistant/components/zha/light.py /tmp/light.py.backup
cp /usr/src/homeassistant/homeassistant/components/zha/websocket_api.py /tmp/websocket_api.py.backup

# Copy modified files
cp entertainment.py /usr/src/homeassistant/homeassistant/components/zha/
cp light.py /usr/src/homeassistant/homeassistant/components/zha/
cp websocket_api.py /usr/src/homeassistant/homeassistant/components/zha/

exit
```

### Step 4: Restart Home Assistant

```bash
# From SSH
ha core restart
```

### Step 5: Verify Installation

Check if it's working:

```bash
# Check HA logs
ha core logs | grep -i entertainment

# Or from UI: Settings → System → Logs
```

## 🎯 Method 2: Using File Editor (Visual Method)

### Step 1: Install File Editor Addon

1. Settings → Add-ons → Add-on Store
2. Search "File editor" 
3. Install and Start

### Step 2: Navigate to ZHA

In File Editor, navigate to:
```
/usr/src/homeassistant/homeassistant/components/zha/
```

### Step 3: Add/Modify Files

1. Create new file `entertainment.py` - Copy content from the modified version
2. Edit `light.py` - Add the entertainment methods
3. Edit `websocket_api.py` - Add the entertainment commands

### Step 4: Restart

Developer Tools → YAML → Restart → Quick Reload

## 🐳 For Your New diyHue Docker:

### Build Your Image:

```bash
# On your computer
cd /path/to/Imersa
./build-diyhue.sh
```

### Deploy on Your Network:

```bash
# Stop old diyHue
docker stop diyhue
docker rm diyhue

# Run new enhanced version
docker run -d --name diyhue \
  --network=host \
  --restart=unless-stopped \
  -v /opt/hue-emulator/config:/opt/hue-emulator/config \
  -e MAC=00:11:22:33:44:55 \
  -e IP=192.168.1.100 \
  diyhue-zha:latest
```

## ✅ Test It's Working

### In diyHue Logs:
```bash
docker logs diyhue | grep -i "ZHA entertainment"
```

**Success:**
```
✓ ZHA entertainment mode ACTIVE for group 1 - Expect faster performance!
```

**Fallback (still works, just slower):**
```
ZHA entertainment setup failed, falling back to standard mode
```

### In Home Assistant:

Test WebSocket command in Developer Tools → Services:

```yaml
service: websocket_api.send_message
data:
  message:
    type: zha/entertainment/create_group
    group_id: test
    lights:
      - light.your_hue_bulb_1
```

## 🔄 Automatic Behavior

The system will:
1. **Try ZHA entertainment first** (if HA is configured)
2. **Fall back to standard mode** if it fails
3. **Log which mode is active**
4. **No configuration needed!**

## 🛠️ Troubleshooting

### "No such file or directory"
- Make sure you're in the HA container: `docker exec -it homeassistant bash`

### "Permission denied"
- Use `chmod 644` on the files after copying

### "Import error" 
- Make sure all 3 files are copied (entertainment.py, light.py, websocket_api.py)

### Test without Full Restart:

```bash
# Just reload ZHA integration
ha core logs --follow &
curl -X POST http://localhost:8123/api/services/homeassistant/reload_config_entry \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "your_zha_entity"}'
```

## 📝 Uninstall/Revert

```bash
# SSH into HA
docker exec -it homeassistant bash

# Restore originals
cp /tmp/light.py.backup /usr/src/homeassistant/homeassistant/components/zha/light.py
cp /tmp/websocket_api.py.backup /usr/src/homeassistant/homeassistant/components/zha/websocket_api.py
rm /usr/src/homeassistant/homeassistant/components/zha/entertainment.py

exit
ha core restart
```

## 🎉 That's It!

Your diyHue will automatically use the faster ZHA entertainment mode when available, and gracefully fall back to standard mode if not. No configuration needed!