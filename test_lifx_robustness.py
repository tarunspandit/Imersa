#!/usr/bin/env python3
"""
Test LIFX Native protocol robustness and error handling
"""

import sys
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

from lights.protocols import lifx_native

def test_invalid_device():
    """Test handling of invalid/unreachable devices"""
    print("Testing invalid device handling...")
    
    class MockLight:
        def __init__(self):
            self.protocol = "lifx_native"
            self.protocol_cfg = {
                "mac": "aa:bb:cc:dd:ee:ff",
                "ip": "192.168.99.99"  # Non-existent IP
            }
            self.name = "Invalid Device"
    
    light = MockLight()
    
    # Test get_light_state with unreachable device
    state = lifx_native.get_light_state(light)
    print(f"  State for unreachable device: {state}")
    assert state.get("reachable") == False, "Should be unreachable"
    print("  ✅ Handled unreachable device correctly")
    
    # Test set_light with unreachable device
    try:
        lifx_native.set_light(light, {"on": True, "bri": 200})
        print("  ✅ Handled set_light for unreachable device without crash")
    except Exception as e:
        print(f"  ❌ Unexpected error: {e}")
        return False
    
    return True

def test_discovery_timeout():
    """Test discovery with very short timeout"""
    print("Testing discovery timeout handling...")
    
    protocol = lifx_native.get_protocol()
    devices = protocol.discover_broadcast(timeout=0.1)  # Very short timeout
    print(f"  Found {len(devices)} devices with 0.1s timeout")
    print("  ✅ Handled short timeout gracefully")
    return True

def test_multizone_on_standard():
    """Test multizone commands on non-multizone device"""
    print("Testing multizone on standard bulb...")
    
    detected = []
    lifx_native.discover(detected)
    
    if detected:
        # Find a non-multizone device
        standard = None
        for d in detected:
            if not d['protocol_cfg'].get('is_multizone'):
                standard = d
                break
        
        if standard:
            class MockLight:
                def __init__(self, config):
                    self.protocol = config["protocol"]
                    self.protocol_cfg = config["protocol_cfg"]
                    self.name = config["name"]
            
            light = MockLight(standard)
            
            # Try to send multizone colors to standard bulb
            try:
                zone_colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
                lifx_native.set_light_multizone(light, zone_colors)
                print(f"  ✅ Handled multizone on {light.name} gracefully")
            except Exception as e:
                print(f"  ❌ Error: {e}")
                return False
    
    return True

def test_concurrent_access():
    """Test concurrent device access"""
    print("Testing concurrent access...")
    
    import threading
    
    detected = []
    lifx_native.discover(detected)
    
    if detected:
        class MockLight:
            def __init__(self, config):
                self.protocol = config["protocol"]
                self.protocol_cfg = config["protocol_cfg"]
                self.name = config["name"]
        
        light = MockLight(detected[0])
        errors = []
        
        def worker(color):
            try:
                lifx_native.set_light(light, {"xy": color, "bri": 200})
            except Exception as e:
                errors.append(e)
        
        # Launch multiple threads
        threads = []
        colors = [[0.7, 0.3], [0.2, 0.7], [0.15, 0.06], [0.5, 0.5]]
        
        for color in colors:
            t = threading.Thread(target=worker, args=(color,))
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        if errors:
            print(f"  ❌ Concurrent access errors: {errors}")
            return False
        else:
            print("  ✅ Handled concurrent access successfully")
    
    return True

def test_memory_cleanup():
    """Test resource cleanup"""
    print("Testing memory cleanup...")
    
    # Create and destroy multiple protocol instances
    for i in range(3):
        protocol = lifx_native.LifxProtocol()
        devices = protocol.discover_broadcast(timeout=0.5)
        protocol.close()
    
    print("  ✅ Created and cleaned up multiple protocol instances")
    return True

def main():
    print("LIFX Native Protocol Robustness Test")
    print("=====================================\n")
    
    tests = [
        ("Invalid Device Handling", test_invalid_device),
        ("Discovery Timeout", test_discovery_timeout),
        ("MultiZone on Standard", test_multizone_on_standard),
        ("Concurrent Access", test_concurrent_access),
        ("Memory Cleanup", test_memory_cleanup)
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        print(f"\n{name}:")
        print("-" * 40)
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ❌ Test failed with exception: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"Results: {passed} passed, {failed} failed")
    if failed == 0:
        print("✅ All robustness tests passed!")
    else:
        print(f"⚠️  {failed} test(s) failed")
    print("=" * 50)

if __name__ == "__main__":
    main()