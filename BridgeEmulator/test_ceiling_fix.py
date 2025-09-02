#!/usr/bin/env python3
"""
Test script to verify LIFX Ceiling gradient and update fixes
"""

import time
import logging
from lights.protocols import lifx

# Set up logging to see our debug messages
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_ceiling_gradient():
    """Test gradient on Ceiling device"""
    print("\n" + "="*60)
    print("LIFX CEILING GRADIENT TEST")
    print("="*60)
    
    # Discover devices
    print("\n1. Discovering LIFX devices...")
    devices = lifx.discover_lifx_devices()
    
    # Find Ceiling device
    ceiling = None
    for mac, device_info in devices.items():
        product_id = device_info.get('product_id', 0)
        label = device_info.get('label', 'Unknown')
        
        # Ceiling 26" (201, 202) or Ceiling 15" (176, 177)
        if product_id in [176, 177, 201, 202]:
            ceiling = device_info
            print(f"\n2. Found Ceiling device: {label}")
            print(f"   Product ID: {product_id}")
            print(f"   MAC: {mac}")
            print(f"   IP: {device_info.get('ip')}")
            
            # Check if it's stored in protocol
            protocol = lifx._protocol
            if mac in protocol.devices:
                device = protocol.devices[mac]
                caps = device.capabilities
                print(f"   Type: {caps.get('type')}")
                print(f"   Device Type: {caps.get('device_type')}")
                
                tiles = caps.get('tiles', [])
                if tiles:
                    print(f"   Tiles: {len(tiles)}")
                    for tile in tiles:
                        print(f"     Tile {tile['index']}: {tile['width']}x{tile['height']} "
                              f"at ({tile.get('x', 0):.2f}, {tile.get('y', 0):.2f})")
            break
    
    if not ceiling:
        print("\n❌ No Ceiling device found!")
        print("   Make sure your Ceiling is powered on and on the same network")
        return False
    
    # Create a mock Light object for testing
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
    
    # Create mock light with ceiling info
    mock_light = MockLight({
        'mac': ceiling['mac'],
        'ip': ceiling['ip'],
        'label': ceiling['label'],
        'capabilities': ceiling.get('capabilities', {})
    })
    
    print("\n3. Testing gradient display...")
    print("   Applying RED → GREEN → BLUE gradient (left to right)")
    
    # Create gradient data
    gradient_data = {
        'gradient': {
            'points': [
                {'color': {'xy': {'x': 0.64, 'y': 0.33}}},  # Red
                {'color': {'xy': {'x': 0.30, 'y': 0.60}}},  # Green  
                {'color': {'xy': {'x': 0.15, 'y': 0.06}}}   # Blue
            ]
        }
    }
    
    # Apply gradient
    lifx.set_light(mock_light, gradient_data)
    
    print("\n4. Gradient applied!")
    print("   You should see:")
    print("   - LEFT side: RED")
    print("   - CENTER: GREEN")
    print("   - RIGHT side: BLUE")
    print("\n   Check if the ENTIRE panel shows the gradient")
    print("   (Previously only the left half would update)")
    
    # Hold for 10 seconds
    print("\n5. Displaying for 10 seconds...")
    time.sleep(10)
    
    # Test solid colors to verify both halves update
    print("\n6. Testing solid colors...")
    
    colors = [
        ("RED", {'xy': [0.64, 0.33]}),
        ("GREEN", {'xy': [0.30, 0.60]}),
        ("BLUE", {'xy': [0.15, 0.06]}),
        ("WHITE", {'ct': 366})
    ]
    
    for color_name, color_data in colors:
        print(f"   Setting {color_name}...")
        lifx.set_light(mock_light, color_data)
        time.sleep(2)
        print(f"   ✓ Both halves should be {color_name}")
    
    print("\n✅ Test complete!")
    print("\nIf the entire panel updated correctly:")
    print("  The fix is working!")
    print("\nIf only the left half updated:")
    print("  Check the log output above for tile configuration")
    print("  and any error messages")
    
    return True

if __name__ == "__main__":
    try:
        test_ceiling_gradient()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()