#!/usr/bin/env python3
"""
Test LIFX subnet-wide unicast discovery
"""

import sys
import time
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

def test_subnet_discovery():
    """Test the improved subnet discovery"""
    print("LIFX Subnet Discovery Test")
    print("=" * 60)
    
    # Setup config
    import configManager
    # Set a proper HOST_IP for testing
    configManager.runtimeConfig.arg = {"HOST_IP": "192.168.1.166"}
    
    from lights.protocols import lifx_native
    
    # Test with explicit logging
    import logManager
    logging = logManager.logger.get_logger(__name__)
    
    print("\n1. Testing subnet calculation from HOST_IP...")
    detected_lights = []
    opts = {}  # No static IPs for now
    
    start_time = time.time()
    lifx_native.discover(detected_lights, opts)
    elapsed = time.time() - start_time
    
    print(f"\nDiscovery completed in {elapsed:.2f} seconds")
    print(f"Found {len(detected_lights)} LIFX devices:")
    
    if detected_lights:
        for light in detected_lights:
            cfg = light['protocol_cfg']
            print(f"\n  Device: {light['name']}")
            print(f"    MAC: {cfg['mac']}")
            print(f"    IP: {cfg['ip']}")
            print(f"    Product ID: {cfg.get('product_id', 'Unknown')}")
            print(f"    Multizone: {cfg.get('is_multizone', False)}")
            print(f"    Matrix: {cfg.get('is_matrix', False)}")
    else:
        print("\n  No devices found!")
        print("\nTroubleshooting:")
        print("  1. Check if LIFX bulbs are powered on")
        print("  2. Check if they're on the same network")
        print("  3. Try with static IPs if you know them")
    
    # Test with static IPs if no devices found
    if not detected_lights:
        print("\n2. Testing with common LIFX IPs...")
        # Try some common IPs where LIFX devices were seen before
        known_ips = [
            "192.168.1.42", "192.168.1.45", "192.168.1.77",
            "192.168.1.186", "192.168.1.191", "192.168.1.231",
            "192.168.1.237", "192.168.1.243"
        ]
        
        opts = {"static_ips": known_ips}
        detected_lights = []
        
        start_time = time.time()
        lifx_native.discover(detected_lights, opts)
        elapsed = time.time() - start_time
        
        print(f"\nStatic IP check completed in {elapsed:.2f} seconds")
        print(f"Found {len(detected_lights)} LIFX devices")
        
        if detected_lights:
            for light in detected_lights:
                print(f"  - {light['name']} at {light['protocol_cfg']['ip']}")
    
    return detected_lights

def test_direct_protocol():
    """Test protocol directly"""
    print("\n" + "=" * 60)
    print("Direct Protocol Test")
    print("=" * 60)
    
    from lights.protocols.lifx_native import LifxProtocol
    
    protocol = LifxProtocol()
    
    # Test subnet discovery directly
    print("\n1. Testing subnet scan (192.168.1.0/24)...")
    start_time = time.time()
    devices = protocol.discover_subnet("192.168.1.0/24")
    elapsed = time.time() - start_time
    
    print(f"   Subnet scan completed in {elapsed:.2f} seconds")
    print(f"   Found {len(devices)} devices")
    
    if devices:
        for device in devices[:5]:  # Show first 5
            print(f"   - {device.mac} at {device.ip}")
    
    # Test broadcast discovery
    print("\n2. Testing broadcast discovery...")
    start_time = time.time()
    devices = protocol.discover_broadcast(timeout=2)
    elapsed = time.time() - start_time
    
    print(f"   Broadcast completed in {elapsed:.2f} seconds")
    print(f"   Found {len(devices)} devices")
    
    if devices:
        for device in devices[:5]:  # Show first 5
            print(f"   - {device.label or device.mac} at {device.ip}")
    
    protocol.close()

def main():
    # Test the discover function
    devices = test_subnet_discovery()
    
    # Test protocol directly for comparison
    test_direct_protocol()
    
    print("\n" + "=" * 60)
    if devices:
        print(f"✅ SUCCESS: Found {len(devices)} LIFX devices")
        print("Subnet-wide unicast discovery is working!")
    else:
        print("⚠️  No devices found")
        print("\nPossible issues:")
        print("1. LIFX bulbs may be on a different subnet")
        print("2. Firewall may be blocking UDP port 56700")
        print("3. LIFX bulbs may need to be power cycled")
        print("\nTry adding static IPs to config.yaml:")
        print("  lifx:")
        print("    static_ips:")
        print("      - 192.168.1.x")
        print("      - 192.168.1.y")
    print("=" * 60)

if __name__ == "__main__":
    main()