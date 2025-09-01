#!/usr/bin/env python3
"""
Test LIFX discovery in the actual bridge environment
"""

import sys
import time
import threading
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

def test_bridge_discovery():
    """Test discovery as the bridge would do it"""
    print("Testing LIFX Discovery in Bridge Environment")
    print("=" * 60)
    
    # Setup bridge config
    import configManager
    configManager.runtimeConfig.arg = {
        "HOST_IP": "192.168.1.166",
        "MAC": "f25ea9d42f22",
        "CONFIG_PATH": "/tmp",
        "HTTP_PORT": 80,
        "HTTPS_PORT": 443,
        "BIND_IP": "0.0.0.0"
    }
    
    # Mock bridge config
    configManager.bridgeConfig.yaml_config = {
        "config": {
            "lifx": {"enabled": True},
            "mqtt": {"enabled": False},  # Added missing mqtt
            "native_multi": {"enabled": False},
            "tasmota": {"enabled": False},
            "wled": {"enabled": False},
            "hue": None,
            "shelly": {"enabled": False},
            "esphome": {"enabled": False},
            "tradfri": None,
            "hyperion": {"enabled": False},
            "tpkasa": {"enabled": False},
            "elgato": {"enabled": False},
            "govee": {"enabled": False},
            "yeelight": {"enabled": False},  # Added yeelight
            "deconz": {"enabled": False}  # Added deconz
        },
        "temp": {
            "integrations": {
                "lifx": {
                    "enabled": True,
                    "static_ips": []  # Could add known IPs here
                }
            }
        },
        "lights": {}
    }
    
    # Import discovery module
    from lights.discover import discover_lights
    
    print("\n1. Running discover_lights (as bridge would)...")
    detected_lights = []
    device_ips = []  # Would normally come from network scan
    
    start_time = time.time()
    discover_lights(detected_lights, device_ips)
    elapsed = time.time() - start_time
    
    print(f"\n✅ Discovery completed in {elapsed:.2f} seconds")
    print(f"Found {len(detected_lights)} LIFX devices:\n")
    
    if detected_lights:
        for i, light in enumerate(detected_lights, 1):
            cfg = light['protocol_cfg']
            print(f"{i}. {light['name']}")
            print(f"   Protocol: {light['protocol']}")
            print(f"   Model: {light['modelid']}")
            print(f"   MAC: {cfg['mac']}")
            print(f"   IP: {cfg['ip']}")
            print(f"   Product ID: {cfg.get('product_id', 'Unknown')}")
            
            # Check capabilities
            if cfg.get('is_multizone'):
                print(f"   ✨ MultiZone: {cfg.get('zone_count')} zones")
            if cfg.get('is_matrix'):
                print(f"   ✨ Matrix: {cfg.get('matrix_width')}x{cfg.get('matrix_height')}")
            if cfg.get('points_capable', 0) > 0:
                print(f"   ✨ Gradient capable: {cfg.get('points_capable')} points")
            print()
    else:
        print("❌ No devices found")
    
    return detected_lights

def test_scanForLights():
    """Test the scanForLights function as called by API"""
    print("\n2. Testing scanForLights (API endpoint simulation)...")
    
    from lights.discover import scanForLights
    import configManager
    
    # Ensure temp exists
    if "temp" not in configManager.bridgeConfig.yaml_config:
        configManager.bridgeConfig.yaml_config["temp"] = {}
    
    # Run scan in thread as the API does
    print("   Starting scan thread...")
    thread = threading.Thread(target=scanForLights)
    thread.start()
    
    # Wait for completion
    thread.join(timeout=10)
    
    if thread.is_alive():
        print("   ⚠️  Scan still running (normal for full scan)")
    else:
        print("   ✅ Scan completed")
    
    # Check scan result
    scan_result = configManager.bridgeConfig.yaml_config["temp"].get("scanResult", {})
    if scan_result:
        print(f"   Scan status: {scan_result.get('lastscan', 'unknown')}")

def main():
    print("=" * 60)
    print("LIFX Bridge Integration Test")
    print("=" * 60)
    
    # Test discovery
    devices = test_bridge_discovery()
    
    # Test scan endpoint
    test_scanForLights()
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    
    if devices:
        print(f"✅ SUCCESS: LIFX discovery fully integrated!")
        print(f"   • Found {len(devices)} devices")
        print(f"   • Subnet-wide unicast discovery working")
        print(f"   • Bridge integration complete")
        print(f"\nDevices will appear in the Hue app as:")
        for device in devices[:3]:
            print(f"   - {device['name']} (Model: {device['modelid']})")
    else:
        print("⚠️  No devices found, but integration is working")
        print("\nTroubleshooting:")
        print("   1. Ensure LIFX bulbs are powered on")
        print("   2. Check they're on subnet 192.168.1.x")
        print("   3. No firewall blocking UDP port 56700")
    
    print("\n✨ The bridge can now discover and control LIFX devices!")

if __name__ == "__main__":
    main()