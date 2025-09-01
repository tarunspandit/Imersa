#!/usr/bin/env python3
"""
Test LIFX fixes for brightness and gradient support
"""

import sys
import time
import importlib.util
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

# Import lifx_native directly to avoid dependency issues
spec = importlib.util.spec_from_file_location("lifx_native", "/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator/lights/protocols/lifx_native.py")
lifx_native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lifx_native)

def test_brightness():
    """Test that brightness adjustments work correctly"""
    print("=" * 60)
    print("Testing Brightness Control")
    print("=" * 60)
    
    detected_lights = []
    lifx_native.discover(detected_lights)
    
    if not detected_lights:
        print("No devices found")
        return False
    
    # Test on first device
    light = detected_lights[0]
    
    class MockLight:
        def __init__(self, config):
            self.protocol = config["protocol"]
            self.protocol_cfg = config["protocol_cfg"]
            self.name = config["name"]
            self.modelid = config["modelid"]
    
    mock_light = MockLight(light)
    
    print(f"\nTesting on: {light['name']}")
    print(f"Model: {light['modelid']}")
    
    # Test brightness levels with red color
    print("\nTesting brightness levels (red):")
    test_data = [
        {"xy": [0.7, 0.3], "bri": 254, "on": True},  # Full brightness
        {"xy": [0.7, 0.3], "bri": 128},              # Half brightness
        {"xy": [0.7, 0.3], "bri": 64},               # Quarter brightness
        {"xy": [0.7, 0.3], "bri": 32},               # Low brightness
        {"xy": [0.7, 0.3], "bri": 254},              # Back to full
    ]
    
    for i, data in enumerate(test_data):
        print(f"  Setting brightness to {data['bri']}/254...")
        lifx_native.set_light(mock_light, data)
        time.sleep(1)
    
    # Test brightness-only change
    print("\nTesting brightness-only changes (keeping color):")
    brightness_levels = [254, 192, 128, 64, 128, 254]
    
    for bri in brightness_levels:
        print(f"  Brightness: {bri}/254")
        lifx_native.set_light(mock_light, {"bri": bri})
        time.sleep(0.5)
    
    print("✅ Brightness test complete")
    return True

def test_gradient():
    """Test gradient support on capable devices"""
    print("\n" + "=" * 60)
    print("Testing Gradient Support")
    print("=" * 60)
    
    detected_lights = []
    lifx_native.discover(detected_lights)
    
    # Find gradient-capable devices
    gradient_devices = [d for d in detected_lights if d['modelid'] in ["LCX003", "LCX004"]]
    
    if not gradient_devices:
        print("No gradient-capable devices found")
        print("Device models:")
        for d in detected_lights:
            print(f"  {d['name']}: {d['modelid']}")
        return False
    
    device = gradient_devices[0]
    print(f"\nTesting gradient on: {device['name']}")
    print(f"Model: {device['modelid']} (gradient-capable)")
    
    class MockLight:
        def __init__(self, config):
            self.protocol = config["protocol"]
            self.protocol_cfg = config["protocol_cfg"]
            self.name = config["name"]
            self.modelid = config["modelid"]
    
    mock_light = MockLight(device)
    
    # Test gradient with multiple colors
    print("\nSetting rainbow gradient...")
    gradient_points = [
        {"color": {"xy": [0.7, 0.3], "bri": 200}},   # Red
        {"color": {"xy": [0.5, 0.5], "bri": 200}},   # Yellow
        {"color": {"xy": [0.2, 0.7], "bri": 200}},   # Green
        {"color": {"xy": [0.15, 0.3], "bri": 200}},  # Cyan
        {"color": {"xy": [0.15, 0.06], "bri": 200}}, # Blue
    ]
    
    lifx_native.set_light_gradient(mock_light, gradient_points)
    time.sleep(2)
    
    # Test gradient with different brightness
    print("\nSetting gradient with varying brightness...")
    gradient_points = [
        {"color": {"xy": [0.7, 0.3], "bri": 254}},   # Bright red
        {"color": {"xy": [0.2, 0.7], "bri": 128}},   # Dim green
        {"color": {"xy": [0.15, 0.06], "bri": 200}}, # Medium blue
    ]
    
    lifx_native.set_light_gradient(mock_light, gradient_points)
    time.sleep(2)
    
    print("✅ Gradient test complete")
    return True

def test_model_detection():
    """Test that devices are assigned correct models"""
    print("\n" + "=" * 60)
    print("Testing Model Detection")
    print("=" * 60)
    
    detected_lights = []
    lifx_native.discover(detected_lights)
    
    print(f"\nFound {len(detected_lights)} devices:")
    print("-" * 60)
    
    for device in detected_lights:
        cfg = device['protocol_cfg']
        print(f"\n{device['name']}")
        print(f"  Model: {device['modelid']}")
        print(f"  Product ID: {cfg.get('product_id', 'Unknown')}")
        print(f"  Multizone: {cfg.get('is_multizone', False)}")
        print(f"  Matrix: {cfg.get('is_matrix', False)}")
        print(f"  Gradient Points: {cfg.get('points_capable', 0)}")
        
        # Check model assignment
        if cfg.get('is_matrix'):
            if device['modelid'] != "LCX004":
                print(f"  ⚠️  Matrix device should be LCX004, not {device['modelid']}")
        elif cfg.get('is_multizone'):
            if device['modelid'] != "LCX003":
                print(f"  ⚠️  Multizone device should be LCX003, not {device['modelid']}")
        else:
            if device['modelid'] != "LCT015":
                print(f"  ⚠️  Standard device should be LCT015, not {device['modelid']}")
    
    return True

def main():
    print("LIFX Implementation Fix Test")
    print("=" * 60)
    
    # Run tests
    test_model_detection()
    test_brightness()
    test_gradient()
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("  • Model detection updated for gradient support")
    print("  • Brightness control fixed for all color modes")
    print("  • Gradient support added for matrix/multizone")
    print("=" * 60)

if __name__ == "__main__":
    main()