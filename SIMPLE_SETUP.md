# Simple Setup - You Were Right!

## For diyHue:

You DON'T need a new Docker image! Just:

```bash
# 1. Install websocket library in your existing container
docker exec -it diyhue pip install websocket-client

# 2. Copy the two new files
docker cp BridgeEmulator/services/zha_entertainment.py diyhue:/opt/hue-emulator/BridgeEmulator/services/
docker cp BridgeEmulator/services/entertainment.py diyhue:/opt/hue-emulator/BridgeEmulator/services/

# 3. Restart
docker restart diyhue
```

That's it! The system will automatically:
- ✅ Try ZHA entertainment if Home Assistant is configured
- ✅ Fall back to standard mode if it fails
- ✅ No configuration needed

## For Home Assistant (HAOS):

```bash
# SSH into HAOS
ssh root@homeassistant.local

# Get into container
docker exec -it homeassistant bash

# Add the 3 files to ZHA
cd /usr/src/homeassistant/homeassistant/components/zha/
# (copy entertainment.py, modified light.py, modified websocket_api.py here)

# Restart
exit
ha core restart
```

## Why This Works:

- The modified `entertainment.py` in diyHue automatically detects and uses ZHA entertainment
- If ZHA mods aren't in HA, it just falls back to standard mode
- No Docker rebuild needed - just add files to existing containers!

## You were right to question the complexity! 

The new Dockerfile was unnecessary - you can just:
1. Add one Python package to existing diyHue
2. Copy 2 files
3. Done!

Sorry for overcomplicating it! 🤦‍♂️