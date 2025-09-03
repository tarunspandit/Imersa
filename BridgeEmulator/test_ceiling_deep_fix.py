#!/usr/bin/env python3
"""
Deep test script to verify LIFX Ceiling gradient and full-panel update fixes
Tests the tile_index=0 fix for single-tile wide devices
"""

import time
import logging
import struct
from lights.protocols import lifx

# Set up detailed logging to see all debug messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def analyze_ceiling_configuration():
    """Analyze how the Ceiling device reports itself"""
    print("\n" + "="*60)
    print("LIFX CEILING DEEP ANALYSIS")
    print("="*60)
    
    # Discover devices
    print("\n1. Discovering LIFX devices...")
    devices = lifx.discover_lifx_devices()
    
    # Find Ceiling device
    ceiling = None
    ceiling_mac = None
    for mac, device_info in devices.items():
        product_id = device_info.get('product_id', 0)
        label = device_info.get('label', 'Unknown')
        
        # Ceiling 26" (201, 202) or Ceiling 15" (176, 177)
        if product_id in [176, 177, 201, 202]:
            ceiling = device_info
            ceiling_mac = mac
            print(f"\n2. Found Ceiling device: {label}")
            print(f"   Product ID: {product_id}")
            print(f"   MAC: {mac}")
            print(f"   IP: {device_info.get('ip')}")
            break
    
    if not ceiling:
        print("\n❌ No Ceiling device found!")
        return None, None
    
    # Get detailed device info from protocol
    protocol = lifx._protocol
    if ceiling_mac in protocol.devices:
        device = protocol.devices[ceiling_mac]
        caps = device.capabilities
        
        print("\n3. Device Configuration Analysis:")
        print(f"   Type: {caps.get('type')}")
        print(f"   Device Type: {caps.get('device_type')}")
        
        tiles = caps.get('tiles', [])
        print(f"   Tile Count: {len(tiles)}")
        
        if tiles:
            for tile in tiles:
                print(f"\n   Tile #{tile['index']}:")
                print(f"     Dimensions: {tile['width']}x{tile['height']} = {tile['width'] * tile['height']} pixels")
                print(f"     Position: ({tile.get('x', 0):.2f}, {tile.get('y', 0):.2f})")
                print(f"     Orientation: {tile.get('orientation', 'unknown')}")
                
                # Analyze chunking requirements
                width = tile['width']
                height = tile['height']
                total_pixels = width * height
                chunks_needed = (total_pixels + 63) // 64
                
                print(f"\n     Protocol Analysis:")
                print(f"     - Total pixels: {total_pixels}")
                print(f"     - Set64 messages needed: {chunks_needed}")
                
                if width > 8:
                    print(f"     - WIDTH WARNING: {width} > 8 pixels")
                    print(f"       This device is WIDER than Set64 normally handles!")
                    print(f"       Testing x_offset={width-8} with tile_index=0...")
                
                if height > 8:
                    print(f"     - Height spans multiple 8-row chunks")
    
    return ceiling, ceiling_mac

def test_gradient_with_logging(ceiling, ceiling_mac):
    """Test gradient with detailed logging of what's sent"""
    if not ceiling:
        return
    
    print("\n" + "="*60)
    print("GRADIENT TEST WITH DEEP LOGGING")
    print("="*60)
    
    # Create a mock Light object
    class MockLight:
        def __init__(self, protocol_cfg):
            self.protocol_cfg = protocol_cfg
            self.name = protocol_cfg['label']
            self.state = {
                'on': True,
                'bri': 254,
                'xy': [0.5, 0.5],
                'colormode': 'xy'
            }
    
    mock_light = MockLight({
        'mac': ceiling['mac'],
        'ip': ceiling['ip'],
        'label': ceiling['label'],
        'capabilities': ceiling.get('capabilities', {})
    })
    
    print("\n1. Testing RED → GREEN → BLUE gradient")
    print("   Watch the logs to see tile_index and x_offset values!")
    
    gradient_data = {
        'gradient': {
            'points': [
                {'color': {'xy': {'x': 0.64, 'y': 0.33}}},  # Red
                {'color': {'xy': {'x': 0.30, 'y': 0.60}}},  # Green  
                {'color': {'xy': {'x': 0.15, 'y': 0.06}}}   # Blue
            ]
        }
    }
    
    print("\n2. Sending gradient...")
    lifx.set_light(mock_light, gradient_data)
    
    print("\n3. Check the device:")
    print("   - ENTIRE panel should show gradient (not just left half)")
    print("   - LEFT: Red")
    print("   - CENTER: Green")
    print("   - RIGHT: Blue")
    
    time.sleep(5)
    
    return True

def test_direct_set64_messages(ceiling_mac):
    """Test sending Set64 messages directly with different x_offset values"""
    if not ceiling_mac:
        return
    
    print("\n" + "="*60)
    print("DIRECT SET64 MESSAGE TEST")
    print("="*60)
    
    protocol = lifx._protocol
    if ceiling_mac not in protocol.devices:
        print("Device not in protocol cache")
        return
    
    device = protocol.devices[ceiling_mac]
    tiles = device.capabilities.get('tiles', [])
    
    if not tiles:
        print("No tile information available")
        return
    
    tile = tiles[0]
    width = tile['width']
    height = tile['height']
    
    print(f"\n1. Testing Set64 with different x_offset values for {width}x{height} device")
    
    # Test colors: Red for left half, Blue for right half
    red = (0, 65535, 32768, 3500)  # Red in HSBK
    blue = (43690, 65535, 32768, 3500)  # Blue in HSBK
    
    # Test 1: Standard approach (x_offset=0)
    print("\n2. Test A: x_offset=0, tile_index=0 (left section)")
    colors_left = [red] * 64
    device._send_tile_state(device, 0, colors_left, 0)
    time.sleep(1)
    
    # Test 2: Try x_offset=8 with tile_index=0 (NEW FIX)
    print("\n3. Test B: x_offset=8, tile_index=0 (right section - NEW FIX)")
    colors_right = [blue] * 64
    
    # Build custom Set64 packet with x_offset=8
    payload = struct.pack('<BBBBBBI',
                        0,     # tile_index = 0 (ALWAYS 0 for single tile!)
                        1,     # length = 1
                        0,     # frame buffer = 0
                        8,     # x_offset = 8 (testing if device accepts this)
                        0,     # y_offset = 0
                        8,     # width = 8
                        0)     # duration = 0
    
    for color in colors_right[:64]:
        payload += struct.pack('<HHHH', color[0], color[1], color[2], color[3])
    
    device.send_packet(715, payload, ack_required=False, res_required=False)  # 715 = SET_TILE_STATE_64
    print("   Sent Set64 with tile_index=0, x_offset=8")
    
    time.sleep(2)
    
    print("\n4. Results:")
    print("   If BOTH halves updated: x_offset > 7 works with tile_index=0! ✅")
    print("   If only LEFT half updated: Device doesn't accept x_offset > 7 ❌")
    
    return True

def test_solid_colors(ceiling, ceiling_mac):
    """Test solid colors to verify both halves update"""
    if not ceiling:
        return
    
    print("\n" + "="*60)
    print("SOLID COLOR TEST")
    print("="*60)
    
    class MockLight:
        def __init__(self, protocol_cfg):
            self.protocol_cfg = protocol_cfg
            self.name = protocol_cfg['label']
            self.state = {
                'on': True,
                'bri': 254,
                'xy': [0.5, 0.5],
                'colormode': 'xy'
            }
    
    mock_light = MockLight({
        'mac': ceiling['mac'],
        'ip': ceiling['ip'],
        'label': ceiling['label'],
        'capabilities': ceiling.get('capabilities', {})
    })
    
    colors = [
        ("FULL RED", {'xy': [0.64, 0.33]}),
        ("FULL GREEN", {'xy': [0.30, 0.60]}),
        ("FULL BLUE", {'xy': [0.15, 0.06]}),
        ("FULL WHITE", {'ct': 366})
    ]
    
    for color_name, color_data in colors:
        print(f"\nSetting {color_name}...")
        lifx.set_light(mock_light, color_data)
        time.sleep(2)
        print(f"   ✓ ENTIRE panel should be {color_name}")
    
    return True

if __name__ == "__main__":
    try:
        # Run analysis
        ceiling, ceiling_mac = analyze_ceiling_configuration()
        
        if ceiling:
            # Run tests
            input("\nPress Enter to start gradient test...")
            test_gradient_with_logging(ceiling, ceiling_mac)
            
            input("\nPress Enter to test direct Set64 messages...")
            test_direct_set64_messages(ceiling_mac)
            
            input("\nPress Enter to test solid colors...")
            test_solid_colors(ceiling, ceiling_mac)
            
            print("\n" + "="*60)
            print("TEST COMPLETE")
            print("="*60)
            print("\nSummary:")
            print("- Check if the ENTIRE Ceiling panel updated (not just left half)")
            print("- Review the logs above to see tile_index and x_offset values")
            print("- The fix keeps tile_index=0 for all packets to single-tile devices")
            
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()