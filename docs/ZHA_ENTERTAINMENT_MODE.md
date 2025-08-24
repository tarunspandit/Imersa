# ZHA Entertainment Mode Implementation

## Overview

This implementation adds Philips Hue Entertainment mode support directly to the Home Assistant ZHA (Zigbee Home Automation) integration, allowing real-time color streaming to Hue bulbs connected via ZHA.

## Problem Solved

- **Original Issue**: ZHA rate limits (10-15 commands/second) cause severe lag with entertainment mode (needs 600+ commands/second)
- **Constraint**: User needs Hue bulbs on ZHA for Zigbee mesh routing (for blinds and other devices)
- **Solution**: Direct Zigbee entertainment streaming that bypasses normal HA entity updates

## Implementation Components

### 1. Core Files Modified/Added

#### `/homeassistant/components/zha/entertainment.py` (NEW)
- `ZHAEntertainmentCluster`: Handles direct Zigbee color streaming
- `ZHAEntertainmentGroup`: Manages groups of entertainment-capable lights
- `ZHAEntertainmentManager`: Coordinates entertainment sessions

#### `/homeassistant/components/zha/light.py` (MODIFIED)
- Added `entertainment_capable` property to detect Hue bulbs
- Added `async_entertainment_update()` for direct color commands
- Bypasses normal entity state management during streaming

#### `/homeassistant/components/zha/websocket_api.py` (MODIFIED)
- Added WebSocket commands for entertainment control:
  - `zha/entertainment/create_group`
  - `zha/entertainment/start_stream`
  - `zha/entertainment/stop_stream`
  - `zha/entertainment/update_colors`

### 2. Bridge Script

#### `/scripts/diyhue_zha_entertainment_bridge.py`
- Connects diyHue to ZHA entertainment API
- Handles RGB to XY color conversion
- Manages WebSocket connection to Home Assistant

## Features

### Supported Hue Models

The following Philips Hue models support entertainment mode:

```python
# Color bulbs
"LCT001", "LCT002", "LCT003"  # Hue bulb A19 (Gen 1)
"LCT010", "LCT011", "LCT012"  # Hue BR30
"LCT014", "LCT015", "LCT016"  # Hue A19 (Gen 3)
"LCT021", "LCT024"             # Hue Go and Play

# White Ambiance
"LTW010", "LTW011", "LTW012"  # White Ambiance (Gen 2)
"LTW015", "LTW016", "LTW017"  # White Ambiance (Gen 3)

# Light strips
"LLC020", "LST002", "LST003"  # Light Strip Plus
"LCX001", "LCX002", "LCX003"  # Gradient Strip
```

### Performance Optimizations

1. **Direct Zigbee Commands**: Bypasses HA entity layer
2. **Bulk Updates**: Sends multiple light updates in parallel
3. **Rate Limiting**: Per-light rate limiting (25 FPS max per bulb)
4. **Minimal Transitions**: Uses 100ms transitions for smooth updates

## Installation

### 1. Add Modified ZHA Integration

```bash
# Copy modified ZHA files to custom_components
cp -r ha_core_zha/homeassistant/components/zha ~/config/custom_components/zha_entertainment

# Add version to manifest.json
echo '"version": "1.0.0"' >> ~/config/custom_components/zha_entertainment/manifest.json
```

### 2. Configure Home Assistant

```yaml
# configuration.yaml
zha:
  zigpy_config:
    # Optimize for entertainment
    ota:
      ikea_provider: false
    network:
      scan_duration: 0
      energy_scan_duration: 0
```

### 3. Set Up Bridge

```python
# In diyHue entertainment.py
from scripts.diyhue_zha_entertainment_bridge import DiyHueZHAConnector

# Initialize connector
connector = DiyHueZHAConnector(
    ha_url="ws://homeassistant.local:8123",
    ha_token="your_long_lived_token"
)

# Map diyHue lights to HA entities
light_mapping = {
    "1": "light.hue_bulb_1",
    "2": "light.hue_bulb_2",
    "3": "light.hue_bulb_3"
}

await connector.setup(light_mapping)
```

## Usage

### Via WebSocket API

```javascript
// Create entertainment group
ws.send(JSON.stringify({
    "id": 1,
    "type": "zha/entertainment/create_group",
    "group_id": "entertainment_1",
    "lights": ["light.hue_bulb_1", "light.hue_bulb_2"]
}));

// Start streaming
ws.send(JSON.stringify({
    "id": 2,
    "type": "zha/entertainment/start_stream",
    "group_id": "entertainment_1"
}));

// Update colors (60 FPS)
ws.send(JSON.stringify({
    "id": 3,
    "type": "zha/entertainment/update_colors",
    "group_id": "entertainment_1",
    "colors": {
        "light.hue_bulb_1": {"x": 0.7, "y": 0.3, "bri": 254},
        "light.hue_bulb_2": {"x": 0.3, "y": 0.6, "bri": 200}
    }
}));
```

### Via Python Script

```python
# See diyhue_zha_entertainment_bridge.py for full example
connector = DiyHueZHAConnector(HA_URL, HA_TOKEN)
await connector.setup(light_mapping)
await connector.create_entertainment_session("group1", ["1", "2", "3"])

# Stream colors
frame_data = {
    "1": {"r": 255, "g": 0, "b": 0},
    "2": {"r": 0, "g": 255, "b": 0},
    "3": {"r": 0, "g": 0, "b": 255}
}
await connector.stream_entertainment_data(frame_data)
```

## Performance Expectations

| Metric | Native Hue Bridge | ZHA Entertainment | Standard ZHA |
|--------|-------------------|-------------------|--------------|
| **Latency** | 15-30ms | 50-100ms | 500-1000ms |
| **Max FPS** | 60+ | 25-30 | 2-5 |
| **Lights @ Smooth** | 10+ | 5-8 | 2-3 |
| **Commands/sec** | 600+ | 150-200 | 10-15 |

## Limitations

1. **Not as fast as native Hue Bridge**: Still limited by Zigbee coordinator capabilities
2. **Coordinator dependent**: Performance varies by Zigbee stick (ConBee II, EZSP, etc.)
3. **Network congestion**: High-speed streaming can impact other Zigbee devices
4. **No DTLS encryption**: Unlike native Hue entertainment protocol

## Troubleshooting

### Lights Not Detected as Entertainment Capable

Check the light's manufacturer and model:
```python
# In Home Assistant Developer Tools > Template
{{ state_attr('light.your_bulb', 'manufacturer') }}
{{ state_attr('light.your_bulb', 'model') }}
```

### Streaming Fails to Start

1. Ensure lights are online and responsive
2. Check ZHA logs for Zigbee errors
3. Verify WebSocket connection is active

### Performance Issues

1. Reduce number of lights in entertainment group
2. Increase coordinator buffer sizes:
```yaml
zha:
  zigpy_config:
    ezsp:
      max_concurrent_requests: 16
```
3. Use wired connection for coordinator (avoid USB extensions)

## Future Improvements

1. **Quirks Integration**: Add ZHA device quirks for better Hue support
2. **Bulk Zigbee Commands**: Implement multi-light updates in single frame
3. **Adaptive Rate Control**: Dynamically adjust FPS based on network conditions
4. **Group Binding**: Use Zigbee group commands for synchronized updates

## Contributing

To contribute to this implementation:

1. Test with your Hue bulbs and report model numbers
2. Measure latency and FPS with different coordinators
3. Submit PRs to improve color conversion algorithms
4. Help with upstream Home Assistant integration

## License

This implementation follows Home Assistant's Apache 2.0 license.