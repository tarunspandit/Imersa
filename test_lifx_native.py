#!/usr/bin/env python3
"""
Test script for LIFX Native protocol implementation
"""

import sys
import time
import random
import colorsys
from typing import List, Tuple

# Add the BridgeEmulator path to import the module
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

from lights.protocols.lifx_native import (
    LifxProtocol, LifxDevice, MessageType, 
    discover, set_light, set_light_multizone, set_light_gradient,
    get_light_state, start_entertainment_mode, stop_entertainment_mode,
    send_rgb_rapid, send_rgb_zones_rapid
)

def test_basic_discovery():
    """Test device discovery"""
    print("\n=== Testing Device Discovery ===")
    protocol = LifxProtocol()
    
    # Test broadcast discovery
    print("Trying broadcast discovery...")
    devices = protocol.discover_broadcast(timeout=3)
    
    if devices:
        print(f"Found {len(devices)} device(s) via broadcast:")
        for device in devices:
            print(f"  - {device.label} ({device.mac}) at {device.ip}")
            print(f"    Product ID: {device.product_id}, Multizone: {device.is_multizone}, Matrix: {device.is_matrix}")
    else:
        print("No devices found via broadcast")
    
    # Test subnet scan
    print("\nTrying subnet scan (192.168.1.0/24)...")
    devices = protocol.discover_subnet("192.168.1.0/24")
    
    if devices:
        print(f"Found {len(devices)} device(s) via subnet scan:")
        for device in devices:
            print(f"  - {device.label} ({device.mac}) at {device.ip}")
    
    protocol.close()
    return devices

def test_basic_control(device: LifxDevice):
    """Test basic light control"""
    print(f"\n=== Testing Basic Control for {device.label} ===")
    protocol = LifxProtocol()
    
    # Test power on/off
    print("Testing power control...")
    protocol.set_power(device, True, 1000)  # Turn on with 1s transition
    time.sleep(2)
    protocol.set_power(device, False, 1000)  # Turn off with 1s transition
    time.sleep(2)
    protocol.set_power(device, True, 0)  # Turn on instantly
    time.sleep(1)
    
    # Test color changes
    print("Testing color changes...")
    colors = [
        ("Red", 255, 0, 0),
        ("Green", 0, 255, 0),
        ("Blue", 0, 0, 255),
        ("Yellow", 255, 255, 0),
        ("Cyan", 0, 255, 255),
        ("Magenta", 255, 0, 255),
        ("White", 255, 255, 255),
    ]
    
    for name, r, g, b in colors:
        print(f"  Setting color to {name}")
        protocol.set_color_rgb(device, r, g, b, 500)  # 0.5s transition
        time.sleep(1)
    
    # Test brightness
    print("Testing brightness...")
    for brightness in [255, 128, 64, 128, 255]:
        print(f"  Setting brightness to {brightness}")
        h, s, _, k = device.color
        protocol.set_color(device, h, s, brightness * 257, k, 200)
        time.sleep(0.5)
    
    # Test color temperature
    print("Testing color temperature...")
    for kelvin in [2500, 3500, 4500, 5500, 6500]:
        print(f"  Setting temperature to {kelvin}K")
        protocol.set_color(device, 0, 0, 65535, kelvin, 500)
        time.sleep(1)
    
    protocol.close()

def test_multizone(device: LifxDevice):
    """Test multizone functionality"""
    if not device.is_multizone:
        print(f"{device.label} does not support multizone")
        return
    
    print(f"\n=== Testing MultiZone for {device.label} ===")
    protocol = LifxProtocol()
    
    zone_count = device.zone_count
    print(f"Device has {zone_count} zones")
    
    # Test rainbow gradient
    print("Setting rainbow gradient...")
    colors = []
    for i in range(zone_count):
        hue = i / zone_count
        r, g, b = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
        colors.append((int(r * 255), int(g * 255), int(b * 255)))
    
    protocol.set_zone_colors_rgb(device, colors, 1000)
    time.sleep(2)
    
    # Test moving pattern
    print("Testing moving pattern...")
    for offset in range(zone_count):
        colors = []
        for i in range(zone_count):
            if (i + offset) % 4 < 2:
                colors.append((255, 0, 0))  # Red
            else:
                colors.append((0, 0, 255))  # Blue
        protocol.set_zone_colors_rgb(device, colors, 0)
        time.sleep(0.2)
    
    # Test chase effect
    print("Testing chase effect...")
    for _ in range(zone_count * 2):
        colors = [(0, 0, 0)] * zone_count
        pos = _ % zone_count
        colors[pos] = (255, 255, 255)
        if pos > 0:
            colors[pos - 1] = (128, 128, 128)
        if pos < zone_count - 1:
            colors[pos + 1] = (128, 128, 128)
        protocol.set_zone_colors_rgb(device, colors, 0)
        time.sleep(0.1)
    
    protocol.close()

def test_matrix(device: LifxDevice):
    """Test matrix/tile functionality"""
    if not device.is_matrix:
        print(f"{device.label} does not support matrix")
        return
    
    print(f"\n=== Testing Matrix for {device.label} ===")
    protocol = LifxProtocol()
    
    width, height = device.matrix_dimensions
    print(f"Matrix dimensions: {width}x{height}")
    
    # Test solid color
    print("Setting solid color...")
    matrix = []
    for y in range(height):
        row = []
        for x in range(width):
            row.append((65535, 65535, 65535, 3500))  # White
        matrix.append(row)
    protocol.set_matrix_colors(device, matrix)
    time.sleep(1)
    
    # Test gradient
    print("Setting gradient...")
    matrix = []
    for y in range(height):
        row = []
        for x in range(width):
            hue = int((x / width) * 65535)
            row.append((hue, 65535, 65535, 3500))
        matrix.append(row)
    protocol.set_matrix_colors(device, matrix)
    time.sleep(2)
    
    # Test checkerboard
    print("Setting checkerboard...")
    matrix = []
    for y in range(height):
        row = []
        for x in range(width):
            if (x + y) % 2 == 0:
                row.append((0, 65535, 65535, 3500))  # Red
            else:
                row.append((43690, 65535, 65535, 3500))  # Blue
        matrix.append(row)
    protocol.set_matrix_colors(device, matrix)
    time.sleep(2)
    
    protocol.close()

def test_entertainment_mode(device: LifxDevice):
    """Test entertainment mode rapid updates"""
    print(f"\n=== Testing Entertainment Mode for {device.label} ===")
    protocol = LifxProtocol()
    
    # Enable entertainment mode
    protocol.enable_entertainment_mode(fps=30)
    print("Entertainment mode enabled (30 FPS)")
    
    # Test rapid color changes
    print("Testing rapid color changes...")
    start_time = time.time()
    updates = 0
    
    while time.time() - start_time < 5:  # Run for 5 seconds
        # Generate random color
        r = random.randint(0, 255)
        g = random.randint(0, 255)
        b = random.randint(0, 255)
        
        protocol.send_rgb_rapid(device, r, g, b)
        updates += 1
        time.sleep(0.03)  # ~30 FPS
    
    actual_fps = updates / 5
    print(f"Sent {updates} updates in 5 seconds ({actual_fps:.1f} FPS)")
    
    # Test smooth transitions
    print("Testing smooth color transitions...")
    for i in range(100):
        t = i / 100
        r = int(255 * (0.5 + 0.5 * math.sin(t * math.pi * 2)))
        g = int(255 * (0.5 + 0.5 * math.sin(t * math.pi * 2 + math.pi * 2/3)))
        b = int(255 * (0.5 + 0.5 * math.sin(t * math.pi * 2 + math.pi * 4/3)))
        
        protocol.send_rgb_rapid(device, r, g, b)
        time.sleep(0.03)
    
    protocol.disable_entertainment_mode()
    print("Entertainment mode disabled")
    
    protocol.close()

def test_bridge_integration():
    """Test bridge integration functions"""
    print("\n=== Testing Bridge Integration ===")
    
    # Test discovery
    detected_lights = []
    discover(detected_lights)
    
    if detected_lights:
        print(f"Bridge discovered {len(detected_lights)} light(s):")
        for light in detected_lights:
            cfg = light["protocol_cfg"]
            print(f"  - {light['name']} (Model: {light['modelid']})")
            print(f"    MAC: {cfg['mac']}, IP: {cfg['ip']}")
            print(f"    Multizone: {cfg.get('is_multizone', False)}, Matrix: {cfg.get('is_matrix', False)}")
    else:
        print("No lights discovered")
    
    # Test state retrieval
    if detected_lights:
        # Create a mock light object
        class MockLight:
            def __init__(self, config):
                self.protocol_cfg = config["protocol_cfg"]
                self.name = config["name"]
        
        light = MockLight(detected_lights[0])
        state = get_light_state(light)
        print(f"\nCurrent state of {light.name}:")
        print(f"  On: {state.get('on', False)}")
        print(f"  Brightness: {state.get('bri', 0)}")
        print(f"  Reachable: {state.get('reachable', False)}")

def main():
    """Main test function"""
    import math
    
    print("LIFX Native Protocol Test Suite")
    print("================================")
    
    # Run discovery
    devices = test_basic_discovery()
    
    if not devices:
        print("\nNo devices found. Please ensure LIFX devices are on the network.")
        return
    
    # Select first device for testing
    device = devices[0]
    print(f"\nUsing device: {device.label} for testing")
    
    # Run tests based on device capabilities
    test_basic_control(device)
    
    if device.is_multizone:
        test_multizone(device)
    
    if device.is_matrix:
        test_matrix(device)
    
    test_entertainment_mode(device)
    
    # Test bridge integration
    test_bridge_integration()
    
    print("\n=== All Tests Complete ===")

if __name__ == "__main__":
    main()