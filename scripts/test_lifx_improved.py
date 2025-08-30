#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa')
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

from BridgeEmulator.lights.protocols import lifx

# Test with known IPs for Docker environment
def test_discovery_with_static_ips():
    print("Testing LIFX discovery with static IPs (Docker-friendly)...")
    
    detected_lights = []
    
    # Configuration for Docker environment
    opts = {
        "static_ips": [
            "192.168.1.98",   # 800
            "192.168.1.182",  # 1100
            "192.168.1.237"   # Candle
        ],
        "num_lights": 3,
        "discovery_timeout": 5
    }
    
    lifx.discover(detected_lights, opts)
    
    print(f"\nFound {len(detected_lights)} devices:")
    for light in detected_lights:
        print(f"  - {light['name']} ({light['protocol_cfg']['ip']})")
    
    return detected_lights

def test_control(lights):
    if not lights:
        print("No lights to test")
        return
    
    # Create a mock light object for testing
    class MockLight:
        def __init__(self, cfg):
            self.protocol_cfg = cfg
            self.name = cfg.get("label", "Test Light")
    
    light = MockLight(lights[0]["protocol_cfg"])
    
    print(f"\nTesting control for {light.name}...")
    
    # Test getting state
    state = lifx.get_light_state(light)
    print(f"Current state: {state}")
    
    # Test setting state
    print("Setting to red...")
    lifx.set_light(light, {
        "on": True,
        "hue": 0,
        "sat": 254,
        "bri": 254
    })
    
    print("Test completed!")

if __name__ == "__main__":
    lights = test_discovery_with_static_ips()
    
    if lights:
        print("\nFor Docker deployment, add these static IPs to your config:")
        print("LIFX_STATIC_IPS=" + ",".join([l["protocol_cfg"]["ip"] for l in lights]))
        
        response = input("\nTest control? (y/n): ")
        if response.lower() == 'y':
            test_control(lights)