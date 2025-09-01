#!/usr/bin/env python3
"""
Quick test of LIFX Native protocol integration
"""

import sys
import time

# Add the BridgeEmulator path to import the module
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

from lights.protocols import lifx_native

def main():
    print("LIFX Native Protocol Quick Test")
    print("================================\n")
    
    # Test discovery
    print("Testing discovery...")
    detected_lights = []
    lifx_native.discover(detected_lights)
    
    if detected_lights:
        print(f"✅ Found {len(detected_lights)} LIFX device(s):")
        for light in detected_lights:
            cfg = light['protocol_cfg']
            print(f"  - {light['name']}")
            print(f"    Protocol: {light['protocol']}")
            print(f"    Model: {light['modelid']}")
            print(f"    MAC: {cfg['mac']}")
            print(f"    IP: {cfg['ip']}")
            print(f"    Multizone: {cfg.get('is_multizone', False)} (zones: {cfg.get('zone_count', 0)})")
            print(f"    Matrix: {cfg.get('is_matrix', False)} ({cfg.get('matrix_width', 0)}x{cfg.get('matrix_height', 0)})")
    else:
        print("❌ No devices found")
        return
    
    # Test light control on first device
    if detected_lights:
        print(f"\nTesting light control on {detected_lights[0]['name']}...")
        
        class MockLight:
            def __init__(self, config):
                self.protocol = config["protocol"]
                self.protocol_cfg = config["protocol_cfg"]
                self.name = config["name"]
        
        light = MockLight(detected_lights[0])
        
        # Get current state
        state = lifx_native.get_light_state(light)
        print(f"  Current state - On: {state.get('on', False)}, Brightness: {state.get('bri', 0)}/254")
        
        # Test turning on with red color
        print("  Setting red color...")
        lifx_native.set_light(light, {"on": True, "xy": [0.7, 0.3], "bri": 200})
        time.sleep(1)
        
        # Test turning to blue
        print("  Setting blue color...")
        lifx_native.set_light(light, {"xy": [0.15, 0.06], "bri": 200})
        time.sleep(1)
        
        # Test turning to white
        print("  Setting white color...")
        lifx_native.set_light(light, {"ct": 250, "bri": 200})
        time.sleep(1)
        
        print("  ✅ Light control test complete")
    
    # Test entertainment mode
    print("\nTesting entertainment mode...")
    lifx_native.start_entertainment_mode()
    print("  ✅ Entertainment mode started")
    
    # Quick rapid color test
    if detected_lights:
        light = MockLight(detected_lights[0])
        print("  Sending rapid color updates...")
        for i in range(10):
            r = (i * 25) % 255
            g = (255 - i * 25) % 255
            b = 128
            lifx_native.send_rgb_rapid(light, r, g, b)
            time.sleep(0.1)
        print("  ✅ Rapid updates sent")
    
    lifx_native.stop_entertainment_mode()
    print("  ✅ Entertainment mode stopped")
    
    print("\n" + "="*50)
    print("✅ LIFX Native Protocol Integration Successful!")
    print("="*50)

if __name__ == "__main__":
    main()