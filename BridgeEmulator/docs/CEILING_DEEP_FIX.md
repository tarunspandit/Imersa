# LIFX Ceiling Half-Panel Issue: Deep Analysis & Fix

## Executive Summary
LIFX Ceiling devices only update half the panel due to incorrect tile indexing when sending SetTileState64 messages. The fix ensures tile_index=0 is always used for single-tile devices.

## The Problem: Only Half Updates

### Symptoms
- Ceiling devices (10x12 or 8x7) only update the left half
- Right half remains unchanged or shows previous colors
- Gradients only display on left portion
- Issue occurs with both solid colors and gradients

### Root Cause
The code was incrementing `tile_index` when `x_offset >= 8`, creating `tile_index=1` for the right half. However, Ceiling devices report `tile_count=1`, meaning they only recognize `tile_index=0`. Messages sent to non-existent `tile_index=1` were silently dropped.

## Deep Protocol Analysis

### SetTileState64 Message (Type 715)
```
Structure:
- tile_index: uint8 (which tile in chain)
- length: uint8 (number of tiles to update)
- fb_index: uint8 (frame buffer, usually 0)
- x: uint8 (x coordinate start)
- y: uint8 (y coordinate start)  
- width: uint8 (width of update region)
- duration: uint32 (transition time)
- colors: 64 × HSBK (64 color values)
```

### Key Findings
1. **Single Tile Reporting**: Ceiling devices report as 1 tile with dimensions 10x12 or 8x7
2. **64-Pixel Limit**: SetTileState64 can only send 64 pixels per message
3. **Tile Index Constraint**: Single-tile devices only accept `tile_index=0`
4. **X-Offset Question**: Protocol allows `x` as uint8 (0-255), but docs recommend 0

## The Fix

### Core Change (lines 1183-1198)
```python
if tile_count == 1:
    # CRITICAL: Never change tile_index for single-tile devices!
    effective_tile_index = 0  # Always use tile 0
    effective_x_offset = x_offset  # Let device handle positioning
```

### Three Approaches Implemented

#### 1. Direct X-Offset (Primary)
- Keep `tile_index=0` for all packets
- Use `x_offset=8` for right half
- Let device handle internal positioning

#### 2. Width Parameter (Experimental)
- Try `width=10` or `width=12` for Ceiling
- May allow single packet for full width
- Device-dependent support

#### 3. Overlapping Regions (Fallback)
- If x_offset > 7 fails
- Send overlapping 8x8 regions
- Adjust y_offset for coverage

## Testing the Fix

### Run Deep Test Script
```bash
cd BridgeEmulator
python test_ceiling_deep_fix.py
```

### What It Tests
1. **Configuration Analysis**: How device reports itself
2. **Gradient Test**: Full panel gradient with logging
3. **Direct Set64**: Raw message testing with x_offset values
4. **Solid Colors**: Verify both halves update

### Expected Results
- ENTIRE panel updates (not just left half)
- Logs show `tile_index=0` for all packets
- Gradients display across full width
- No more half-panel issues

## Technical Details

### Before Fix (WRONG)
```
Packet 1: tile_index=0, x_offset=0 → Left half ✓
Packet 2: tile_index=1, x_offset=0 → Ignored (no tile 1!) ✗
```

### After Fix (CORRECT)  
```
Packet 1: tile_index=0, x_offset=0 → Left half ✓
Packet 2: tile_index=0, x_offset=8 → Right half ✓
```

### Device Examples
| Device | Dimensions | Tiles | Packets Needed |
|--------|------------|-------|----------------|
| Ceiling 26" | 10×12 (120) | 1 | 2-3 |
| Ceiling 15" | 8×7 (56) | 1 | 1 |
| Tile Chain | 8×8 each | 1-5 | 1 per tile |
| Candle | 5×5 (25) | 1 | 1 |

## Debugging

### Enhanced Logging
The fix adds detailed logging:
```
LIFX: Single wide tile (10x12) - tile_index=0, x_offset=8
LIFX: Sent SetTileState64 packet 2/2 to Ceiling (10x12): tile_index=0, x=8, y=0
```

### Verification Steps
1. Check logs for tile configuration
2. Verify tile_index stays at 0
3. Monitor x_offset values
4. Confirm both halves update

## Alternative Solutions

If the primary fix doesn't work:

1. **Vertical Strips**: Send as 8×12 columns instead of rows
2. **Multiple Y-Offsets**: Use y_offset to address regions
3. **Reduced Width**: Send narrower strips with overlap
4. **Custom Protocol**: Implement matrix-specific messages

## References
- [LIFX LAN Protocol](https://lan.developer.lifx.com/)
- [SetTileState64 Specification](https://lan.developer.lifx.com/docs/changing-a-device#settilestate64-715)
- [lifxlan Python Library](https://github.com/mclarkk/lifxlan)

## Result
The fix ensures LIFX Ceiling devices update their entire panel by correctly handling tile indexing for single-tile wide devices. The key insight: never increment tile_index for devices with tile_count=1.