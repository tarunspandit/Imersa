#!/usr/bin/env python3
import sys
import time
from typing import List

sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/lifxlan-master')

try:
    from lifxlan import LifxLAN
    print("✓ lifxlan imported successfully")
except ImportError as e:
    print(f"✗ Failed to import lifxlan: {e}")
    sys.exit(1)

def test_discovery():
    print("\n=== Testing LIFX Discovery ===")
    
    # Test with auto-discovery
    print("\n1. Testing auto-discovery (may take 5-10 seconds)...")
    lifx = LifxLAN()
    
    try:
        devices = lifx.get_lights()
        print(f"   Found {len(devices)} LIFX device(s)")
        
        for i, device in enumerate(devices):
            try:
                print(f"\n   Device {i+1}:")
                print(f"   - Label: {device.get_label()}")
                print(f"   - IP: {device.get_ip_addr()}")
                print(f"   - MAC: {device.get_mac_addr()}")
                print(f"   - Power: {device.get_power()}")
                
                # Get color info
                color = device.get_color()
                print(f"   - Color (HSBK): {color}")
                
                # Check capabilities
                print(f"   - Supports color: {device.supports_color()}")
                print(f"   - Supports multizone: {device.supports_multizone()}")
                print(f"   - Supports infrared: {device.supports_infrared()}")
                
            except Exception as e:
                print(f"   Error getting device info: {e}")
                
    except Exception as e:
        print(f"   Discovery error: {e}")
    
    # Test rapid discovery with known count
    print("\n2. Testing fast discovery with device count hint...")
    lifx_fast = LifxLAN(num_lights=len(devices) if devices else 1)
    
    try:
        fast_devices = lifx_fast.get_lights()
        print(f"   Found {len(fast_devices)} device(s) with fast discovery")
    except Exception as e:
        print(f"   Fast discovery error: {e}")
    
    return devices

def test_control(devices: List):
    if not devices:
        print("\n=== No devices to test control ===")
        return
    
    print("\n=== Testing LIFX Control ===")
    device = devices[0]
    
    print(f"\nTesting device: {device.get_label()}")
    
    # Save original state
    original_power = device.get_power()
    original_color = device.get_color()
    print(f"Original state - Power: {original_power}, Color: {original_color}")
    
    try:
        # Test power toggle
        print("\n1. Testing power control...")
        device.set_power("on", duration=0, rapid=True)
        time.sleep(0.5)
        print(f"   Power after ON: {device.get_power()}")
        
        device.set_power("off", duration=0, rapid=True)
        time.sleep(0.5)
        print(f"   Power after OFF: {device.get_power()}")
        
        device.set_power("on", duration=0, rapid=True)
        time.sleep(0.5)
        
        # Test color changes
        print("\n2. Testing color control...")
        
        # Red
        print("   Setting to RED...")
        device.set_color([0, 65535, 65535, 3500], duration=0, rapid=True)
        time.sleep(1)
        
        # Green
        print("   Setting to GREEN...")
        device.set_color([21845, 65535, 65535, 3500], duration=0, rapid=True)
        time.sleep(1)
        
        # Blue
        print("   Setting to BLUE...")
        device.set_color([43690, 65535, 65535, 3500], duration=0, rapid=True)
        time.sleep(1)
        
        # White
        print("   Setting to WHITE...")
        device.set_color([0, 0, 65535, 5500], duration=0, rapid=True)
        time.sleep(1)
        
        # Restore original
        print("\n3. Restoring original state...")
        device.set_color(original_color, duration=1000)
        device.set_power(original_power, duration=1000)
        
        print("✓ Control tests completed successfully")
        
    except Exception as e:
        print(f"✗ Control test error: {e}")
        # Try to restore
        try:
            device.set_color(original_color, duration=0)
            device.set_power(original_power, duration=0)
        except:
            pass

if __name__ == "__main__":
    devices = test_discovery()
    
    if devices:
        response = input("\nDo you want to test light control? (y/n): ")
        if response.lower() == 'y':
            test_control(devices)
    else:
        print("\nNo LIFX devices found. Please check:")
        print("1. LIFX bulbs are powered on")
        print("2. You're on the same network as the bulbs")
        print("3. Firewall isn't blocking UDP port 56700")