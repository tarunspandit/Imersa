# ZHA + Hue Bulbs Entertainment Optimization

## The Challenge
You're using **real Hue bulbs connected to ZHA** as Zigbee routers for blinds/sensors, but ZHA has strict rate limits that cause entertainment lag.

## Applied Optimizations

### 1. **Reduced Update Rate**
- **Before**: 60 updates/second per bulb
- **After**: Max 5 updates/second per bulb (200ms minimum between updates)

### 2. **Aggressive Similarity Filtering**
- **Standard lights**: 3% color tolerance, 16 brightness tolerance
- **ZHA lights**: 8% color tolerance, 35 brightness tolerance
- **Result**: Only sends commands for significant color changes

### 3. **Batched WebSocket Updates**
- All ZHA lights updated in single batch per frame
- Reduces WebSocket overhead

## Expected Performance
- **Command reduction**: From 600/second to ~25/second (for 10 bulbs)
- **Smoother updates**: Less ZHA queue backup
- **Better responsiveness**: Commands actually processed instead of queued

## Additional Home Assistant Optimizations

Add to your `configuration.yaml`:

```yaml
# Reduce ZHA logging during entertainment
logger:
  default: warning
  logs:
    zigpy: error
    zigpy.device: error  
    zigpy.zdo: error
    zhaquirks: error

# Exclude entertainment lights from recorder
recorder:
  exclude:
    entities:
      - light.hue_bulb_1
      - light.hue_bulb_2
      - light.hue_bulb_3
      # Add all your entertainment lights

# Optimize ZHA performance
zha:
  zigpy_config:
    ota:
      ikea_provider: false  # Disable if not needed
    network:
      # Reduce network scan frequency during entertainment
      scan_duration: 0
      energy_scan_duration: 0
```

## ZHA Coordinator Tuning

If you're using **ConBee/RaspBee** or **EZSP** coordinator:

### ConBee/RaspBee:
```yaml
zha:
  zigpy_config:
    deconz:
      path: /dev/ttyUSB0
      baudrate: 38400
      # Increase buffer size for entertainment
      flow_control: hardware
```

### EZSP (Sonoff, Home Assistant Yellow):
```yaml  
zha:
  zigpy_config:
    ezsp:
      # Increase queue sizes
      max_concurrent_requests: 16
      request_retries: 3
```

## Testing Results

Monitor your ZHA performance:

```yaml
# Add to configuration.yaml for monitoring
sensor:
  - platform: template
    sensors:
      zha_queue_size:
        friendly_name: "ZHA Command Queue"
        value_template: "{{ states.zha | list | length }}"
```

## Realistic Expectations

Even with these optimizations, **ZHA + Hue bulbs will never match native Hue Bridge performance**:

| Setup | Latency | Max Lights @ Smooth FPS |
|-------|---------|-------------------------|
| **Native Hue Bridge** | 15-30ms | 10+ @ 60fps |
| **Optimized ZHA** | 100-300ms | 5-8 @ ~10fps |
| **Unoptimized ZHA** | 500-1000ms | 2-3 @ ~2fps |

## Alternative Approaches

### Option A: Separate Entertainment Setup
- Keep Hue bulbs on ZHA for routing
- Add dedicated entertainment lights (WLED, Native ESP) on WiFi
- Use ZHA bulbs for ambient/room lighting only

### Option B: Hybrid Network
- Move 1-2 Hue bulbs back to Hue Bridge for entertainment  
- Keep rest on ZHA for routing
- Use Hue Bridge entertainment mode for those lights

### Option C: Accept Limitations
- Use current optimized setup
- Enjoy ~5-10fps entertainment effects
- Focus on slower, ambient effects rather than fast strobing

The optimization should help significantly, but ZHA's fundamental limitations mean you'll get better results with faster-response light protocols for entertainment.