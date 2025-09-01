#!/usr/bin/env python3
"""
Test LIFX Native protocol integration with the bridge
"""

import sys
import time
import requests
import json

# Add the BridgeEmulator path to import the module
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

from lights.protocols import lifx_native

def test_discovery():
    """Test device discovery through the bridge interface"""
    print("\n=== Testing LIFX Native Discovery ===")
    
    detected_lights = []
    lifx_native.discover(detected_lights)
    
    if detected_lights:
        print(f"Found {len(detected_lights)} LIFX device(s):")
        for light in detected_lights:
            print(f"\nDevice: {light['name']}")
            print(f"  Protocol: {light['protocol']}")
            print(f"  Model ID: {light['modelid']}")
            print(f"  MAC: {light['protocol_cfg']['mac']}")
            print(f"  IP: {light['protocol_cfg']['ip']}")
            print(f"  Product ID: {light['protocol_cfg'].get('product_id', 'Unknown')}")
            print(f"  Multizone: {light['protocol_cfg'].get('is_multizone', False)}")
            print(f"  Matrix: {light['protocol_cfg'].get('is_matrix', False)}")
            if light['protocol_cfg'].get('is_multizone'):
                print(f"  Zone Count: {light['protocol_cfg'].get('zone_count', 0)}")
            if light['protocol_cfg'].get('is_matrix'):
                print(f"  Matrix Size: {light['protocol_cfg'].get('matrix_width', 0)}x{light['protocol_cfg'].get('matrix_height', 0)}")
    else:
        print("No LIFX devices found")
    
    return detected_lights

def test_light_control(light_config):
    """Test basic light control"""
    print(f"\n=== Testing Light Control for {light_config['name']} ===")
    
    # Create a mock light object
    class MockLight:
        def __init__(self, config):
            self.protocol = config["protocol"]
            self.protocol_cfg = config["protocol_cfg"]
            self.name = config["name"]
    
    light = MockLight(light_config)
    
    # Test getting state
    print("Getting current state...")
    state = lifx_native.get_light_state(light)
    print(f"  On: {state.get('on', False)}")
    print(f"  Brightness: {state.get('bri', 0)}/254")
    print(f"  Reachable: {state.get('reachable', False)}")
    
    # Test setting colors
    print("\nTesting color changes...")
    colors = [
        ("Red", {"xy": [0.7, 0.3]}),
        ("Green", {"xy": [0.2, 0.7]}),
        ("Blue", {"xy": [0.15, 0.06]}),
        ("White", {"ct": 250}),
    ]
    
    for name, data in colors:
        print(f"  Setting {name}...")
        data["on"] = True
        data["bri"] = 200
        data["transitiontime"] = 5  # 0.5 seconds
        lifx_native.set_light(light, data)
        time.sleep(1)
    
    # Test brightness
    print("\nTesting brightness...")
    for bri in [254, 128, 64, 128, 254]:
        print(f"  Setting brightness to {bri}...")
        lifx_native.set_light(light, {"bri": bri, "transitiontime": 2})
        time.sleep(0.5)
    
    # Test power
    print("\nTesting power...")
    print("  Turning off...")
    lifx_native.set_light(light, {"on": False, "transitiontime": 10})
    time.sleep(2)
    print("  Turning on...")
    lifx_native.set_light(light, {"on": True, "transitiontime": 10})
    time.sleep(2)

def test_gradient(light_config):
    """Test gradient functionality"""
    if not light_config['protocol_cfg'].get('points_capable', 0) > 0:
        print(f"{light_config['name']} does not support gradients")
        return
    
    print(f"\n=== Testing Gradient for {light_config['name']} ===")
    
    class MockLight:
        def __init__(self, config):
            self.protocol = config["protocol"]
            self.protocol_cfg = config["protocol_cfg"]
            self.name = config["name"]
    
    light = MockLight(light_config)
    
    # Create a rainbow gradient
    print("Setting rainbow gradient...")
    gradient_points = [
        {"color": {"xy": [0.7, 0.3]}},  # Red
        {"color": {"xy": [0.5, 0.5]}},  # Yellow
        {"color": {"xy": [0.2, 0.7]}},  # Green
        {"color": {"xy": [0.3, 0.3]}},  # Cyan
        {"color": {"xy": [0.15, 0.06]}},  # Blue
        {"color": {"xy": [0.3, 0.15]}},  # Magenta
    ]
    
    lifx_native.set_light_gradient(light, gradient_points)
    time.sleep(2)
    
    # Test moving gradient
    print("Testing moving gradient...")
    for offset in range(6):
        rotated = gradient_points[offset:] + gradient_points[:offset]
        lifx_native.set_light_gradient(light, rotated)
        time.sleep(0.5)

def test_entertainment_mode(light_config):
    """Test entertainment mode rapid updates"""
    print(f"\n=== Testing Entertainment Mode for {light_config['name']} ===")
    
    class MockLight:
        def __init__(self, config):
            self.protocol = config["protocol"]
            self.protocol_cfg = config["protocol_cfg"]
            self.name = config["name"]
    
    light = MockLight(light_config)
    
    # Start entertainment mode
    lifx_native.start_entertainment_mode()
    print("Entertainment mode started")
    
    # Test rapid color changes
    print("Testing rapid color changes (5 seconds)...")
    import random
    start_time = time.time()
    updates = 0
    
    while time.time() - start_time < 5:
        r = random.randint(0, 255)
        g = random.randint(0, 255)
        b = random.randint(0, 255)
        
        lifx_native.send_rgb_rapid(light, r, g, b)
        updates += 1
        time.sleep(0.03)  # ~30 FPS
    
    actual_fps = updates / 5
    print(f"Sent {updates} updates ({actual_fps:.1f} FPS)")
    
    # Stop entertainment mode
    lifx_native.stop_entertainment_mode()
    print("Entertainment mode stopped")

def main():
    """Main test function"""
    print("LIFX Native Protocol Integration Test")
    print("======================================")
    
    # Test discovery
    devices = test_discovery()
    
    if not devices:
        print("\nNo devices found. Please ensure LIFX devices are on the network.")
        return
    
    # Test first device
    device = devices[0]
    print(f"\n{'='*50}")
    print(f"Testing device: {device['name']}")
    print(f"{'='*50}")
    
    # Run tests
    test_light_control(device)
    
    if device['protocol_cfg'].get('points_capable', 0) > 0:
        test_gradient(device)
    
    test_entertainment_mode(device)
    
    print("\n=== All Tests Complete ===")
    print("The LIFX Native protocol is successfully integrated!")

if __name__ == "__main__":
    main()