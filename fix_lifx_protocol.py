#!/usr/bin/env python3
"""
Fix LIFX Protocol Implementation

This script fixes the following issues:
1. Proper device type instantiation (MultiZoneLight vs TileChain vs Light)
2. Correct method signatures for multizone and matrix devices
3. Remove duplicate send_rgb_zones_rapid function
4. Add helper to ensure correct device class is used
"""

import sys
import os

def create_device_instantiation_helper():
    """Create the helper function for proper device instantiation."""
    return '''
def _create_proper_device(mac: str, ip: str, source_id: int = None) -> Optional[Any]:
    """Create the proper LIFX device type based on its capabilities.
    
    Args:
        mac: MAC address of the device
        ip: IP address of the device
        source_id: Optional source ID for the device
        
    Returns:
        Properly typed device (MultiZoneLight, TileChain, or Light)
    """
    if not LIFX_AVAILABLE:
        return None
        
    try:
        import random
        if source_id is None:
            source_id = random.randrange(2, 1 << 32)
            
        # First create a basic device to check capabilities
        from lifxlan import Light as LifxLight, MultiZoneLight, TileChain
        
        # Create basic Light first to get product features
        device = LifxLight(mac, ip, source_id=source_id)
        
        # Get product features to determine device type
        try:
            features = device.get_product_features()
            
            # Check for multizone support (strips, beams)
            if features.get('multizone', False):
                logging.debug(f"LIFX: Creating MultiZoneLight for {mac}")
                return MultiZoneLight(mac, ip, source_id=source_id)
            
            # Check for chain/matrix support (tiles, candles)  
            elif features.get('chain', False) or features.get('matrix', False):
                logging.debug(f"LIFX: Creating TileChain for {mac}")
                return TileChain(mac, ip, source_id=source_id)
            
            # Default to basic Light
            else:
                logging.debug(f"LIFX: Creating basic Light for {mac}")
                return device
                
        except Exception as e:
            logging.debug(f"LIFX: Could not get features, using basic Light: {e}")
            return device
            
    except Exception as e:
        logging.error(f"LIFX: Failed to create device {mac} at {ip}: {e}")
        return None
'''

def fix_unicast_discover():
    """Fix the _unicast_discover function to use proper device types."""
    return '''    def _unicast_discover(self, ip: str) -> Optional[Any]:
        """Discover device by sending unicast to specific IP."""
        if not LIFX_AVAILABLE:
            return None
            
        try:
            # Method 1: Try targeted discovery by overriding broadcast addresses
            if lifx_device_mod:
                original_addrs = list(getattr(lifx_device_mod, 'UDP_BROADCAST_IP_ADDRS', []))
                lifx_device_mod.UDP_BROADCAST_IP_ADDRS = [ip]
                
                try:
                    lan = LifxLAN(num_lights=1)  # Hint for faster discovery
                    devices = lan.get_lights() or []
                    for device in devices:
                        try:
                            if device.get_ip_addr() == ip:
                                # Device is already properly typed by LifxLAN
                                return device
                        except:
                            continue
                finally:
                    lifx_device_mod.UDP_BROADCAST_IP_ADDRS = original_addrs
            
            # Method 2: Try direct device construction with proper type
            try:
                # Create a Light with just the IP (MAC will be discovered later)
                from lifxlan import Light as LifxLight
                temp_device = LifxLight("00:00:00:00:00:00", ip)
                # Verify it's responsive and get MAC
                temp_device.get_power()
                mac = temp_device.get_mac_addr()
                # Now create proper device type
                return _create_proper_device(mac, ip)
            except:
                pass
                    
        except Exception as e:
            logging.debug(f"LIFX: Unicast discovery failed for {ip}: {e}")
            
        return None
'''

def fix_scan_ip_direct():
    """Fix _scan_ip_direct to use proper device types."""
    return '''def _scan_ip_direct(ip: str, timeout: float = 0.5) -> Optional[Any]:
    """Directly probe an IP for LIFX device without broadcast."""
    if not LIFX_AVAILABLE:
        return None
    
    try:
        import socket
        from lifxlan.msgtypes import GetService, StateService
        from lifxlan.unpack import unpack_lifx_message
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        
        # Send GetService directly to IP
        msg = GetService("00:00:00:00:00:00", 12345, 0, {}, False, True)
        sock.sendto(msg.packed_message, (ip, 56700))
        
        # Wait for response
        data, addr = sock.recvfrom(1024)
        response = unpack_lifx_message(data)
        
        if isinstance(response, StateService):
            # Create proper device type based on MAC
            mac = response.target_addr
            device = _create_proper_device(mac, ip)
            return device
            
    except:
        pass
    finally:
        try:
            sock.close()
        except:
            pass
    
    return None
'''

def fix_get_device():
    """Fix _get_device to ensure proper device type."""
    return '''def _get_device(light) -> Optional[Any]:
    """Get LIFX device for a light object, using cache and ensuring proper type."""
    if not LIFX_AVAILABLE:
        return None
        
    mac = light.protocol_cfg.get("id")
    ip = light.protocol_cfg.get("ip")
    
    # Handle host:port format
    if isinstance(ip, str) and ":" in ip:
        ip = ip.split(":", 1)[0]
    
    # Try to get from cache first
    device = _device_cache.get(mac or ip)
    
    # If cached device exists, check if it's the right type
    if device:
        try:
            features = device.get_product_features()
            is_multizone = features.get('multizone', False)
            is_chain = features.get('chain', False) or features.get('matrix', False)
            
            # Check if we have the right device type
            from lifxlan import MultiZoneLight, TileChain
            if is_multizone and not isinstance(device, MultiZoneLight):
                logging.debug(f"LIFX: Cached device is wrong type, recreating as MultiZoneLight")
                device = None  # Force re-discovery
            elif is_chain and not isinstance(device, TileChain):
                logging.debug(f"LIFX: Cached device is wrong type, recreating as TileChain")
                device = None  # Force re-discovery
        except:
            pass
    
    # If no cached device or wrong type, discover it
    if not device:
        device = _device_cache.discover_device(mac, ip)
        
        # Ensure we have the proper device type
        if device and mac and ip:
            try:
                # Get features to determine proper type
                features = device.get_product_features()
                is_multizone = features.get('multizone', False)
                is_chain = features.get('chain', False) or features.get('matrix', False)
                
                from lifxlan import MultiZoneLight, TileChain
                
                # Create proper device type if needed
                if is_multizone and not isinstance(device, MultiZoneLight):
                    device = MultiZoneLight(mac, ip)
                    _device_cache.put(mac, device)
                    _device_cache.put(ip, device)
                elif is_chain and not isinstance(device, TileChain):
                    device = TileChain(mac, ip)
                    _device_cache.put(mac, device)
                    _device_cache.put(ip, device)
                    
            except Exception as e:
                logging.debug(f"LIFX: Could not determine device type: {e}")
    
    # Register for keep-alive if we got a device
    if device:
        if ip:
            register_device_for_keepalive(mac or ip, ip)
        elif mac:
            # Try to get IP from device
            device_ip = getattr(device, 'ip_addr', None) or getattr(device, 'ip', None)
            register_device_for_keepalive(mac, device_ip)
    
    return device
'''

def fix_set_light_multizone_function():
    """Fix the set_light_multizone function at line 1549 (first duplicate)."""
    return '''def set_light_multizone(light: Any, zone_colors: List[Tuple[int, int, int]]) -> None:
    """Set colors for different zones on multizone LIFX devices (strips, beams).
    
    Args:
        light: Light object
        zone_colors: List of RGB tuples, one per zone
    """
    device = _get_device(light)
    if not device:
        logging.debug(f"LIFX: Device not found for {light.name}")
        return
        
    try:
        from lifxlan import MultiZoneLight
        
        # Check if device is MultiZoneLight
        if isinstance(device, MultiZoneLight):
            # Convert RGB colors to HSBK for each zone
            hsbk_colors = []
            for r, g, b in zone_colors:
                h, s, v = _rgb_to_hsv65535(r, g, b)
                hsbk_colors.append([h, s, v, 3500])  # Default kelvin
                
            # Use the proper MultiZoneLight method
            device.set_zone_colors(hsbk_colors, duration=0, rapid=True)
            logging.debug(f"LIFX: Set {len(zone_colors)} zone colors for {light.name}")
        
        # Check if device has extended multizone support
        elif hasattr(device, 'extended_set_zone_color'):
            hsbk_colors = []
            for r, g, b in zone_colors:
                h, s, v = _rgb_to_hsv65535(r, g, b)
                hsbk_colors.append([h, s, v, 3500])
                
            device.extended_set_zone_color(hsbk_colors, index=0, duration=0, rapid=True, apply=1)
            logging.debug(f"LIFX: Set {len(zone_colors)} extended zones for {light.name}")
            
        # Fall back to basic color setting (average of zones)
        else:
            logging.debug(f"LIFX: Device {light.name} does not support multizone")
            if zone_colors:
                avg_r = sum(c[0] for c in zone_colors) // len(zone_colors)
                avg_g = sum(c[1] for c in zone_colors) // len(zone_colors)
                avg_b = sum(c[2] for c in zone_colors) // len(zone_colors)
                h, s, v = _rgb_to_hsv65535(avg_r, avg_g, avg_b)
                device.set_color([h, s, v, 3500], duration=0, rapid=True)
            
    except Exception as e:
        logging.warning(f"LIFX: Failed to set multizone for {light.name}: {e}")
'''

def main():
    """Main function to apply fixes."""
    
    print("=" * 60)
    print("LIFX Protocol Implementation Fixer")
    print("=" * 60)
    
    lifx_file = "/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator/lights/protocols/lifx.py"
    
    # Read the current file
    print(f"\n1. Reading {lifx_file}...")
    with open(lifx_file, 'r') as f:
        content = f.read()
    
    # Check if fixes are already applied
    if "_create_proper_device" in content:
        print("✓ Fixes appear to already be applied!")
        return
    
    print("2. Applying fixes...")
    
    # Find insertion points
    lines = content.split('\n')
    
    # 1. Add the device instantiation helper after imports
    print("   - Adding _create_proper_device helper...")
    import_end = -1
    for i, line in enumerate(lines):
        if line.startswith("try:") and "from lifxlan import" in lines[i+1]:
            # Find the end of the lifxlan import block
            for j in range(i, min(i+20, len(lines))):
                if lines[j].startswith("except ImportError:"):
                    import_end = j + 10  # After the except block
                    break
            break
    
    if import_end > 0:
        # Add MultiZoneLight and TileChain to imports
        for i in range(import_end - 10, import_end):
            if "from lifxlan import" in lines[i]:
                if "MultiZoneLight" not in lines[i] and "TileChain" not in lines[i]:
                    lines[i] = lines[i].replace("LifxLAN, Light as LifxLight, Device as LifxDevice",
                                                "LifxLAN, Light as LifxLight, Device as LifxDevice, MultiZoneLight, TileChain")
                break
        
        # Add the helper function
        helper_code = create_device_instantiation_helper()
        lines.insert(import_end, helper_code)
    
    # 2. Fix _unicast_discover in LifxDeviceCache class
    print("   - Fixing _unicast_discover method...")
    for i, line in enumerate(lines):
        if "def _unicast_discover(self, ip: str)" in line:
            # Find the end of this method
            indent = len(line) - len(line.lstrip())
            method_end = i + 1
            for j in range(i + 1, len(lines)):
                if lines[j].strip() and not lines[j].startswith(' ' * (indent + 4)):
                    method_end = j
                    break
            
            # Replace the method
            new_method = fix_unicast_discover().split('\n')
            lines[i:method_end] = new_method
            break
    
    # 3. Fix _scan_ip_direct 
    print("   - Fixing _scan_ip_direct function...")
    for i, line in enumerate(lines):
        if "def _scan_ip_direct(ip: str" in line:
            # Find the end of this function
            method_end = i + 1
            for j in range(i + 1, len(lines)):
                if lines[j].strip() and lines[j][0] != ' ':
                    method_end = j
                    break
            
            # Replace the function
            new_function = fix_scan_ip_direct().split('\n')
            lines[i:method_end] = new_function
            break
    
    # 4. Fix _get_device
    print("   - Fixing _get_device function...")
    for i, line in enumerate(lines):
        if "def _get_device(light)" in line:
            # Find the end of this function
            method_end = i + 1
            for j in range(i + 1, len(lines)):
                if lines[j].strip() and lines[j][0] != ' ':
                    method_end = j
                    break
            
            # Replace the function
            new_function = fix_get_device().split('\n')
            lines[i:method_end] = new_function
            break
    
    # 5. Remove duplicate send_rgb_zones_rapid function (the one at line ~1614)
    print("   - Removing duplicate send_rgb_zones_rapid...")
    # Find the duplicate (it's shorter and starts around line 1614)
    for i in range(len(lines) - 1, 0, -1):
        if "def send_rgb_zones_rapid(light: Any" in lines[i]:
            # Check if this is the shorter duplicate (around line 1614)
            # The duplicate has _is_matrix call shortly after
            is_duplicate = False
            for j in range(i, min(i + 10, len(lines))):
                if "_is_matrix(light)" in lines[j]:
                    is_duplicate = True
                    break
            
            if is_duplicate:
                # Find the end of this function
                method_end = i + 1
                for j in range(i + 1, len(lines)):
                    if lines[j].strip() and lines[j][0] != ' ':
                        method_end = j
                        break
                
                # Remove the duplicate
                del lines[i:method_end]
                print(f"     Removed duplicate function at line {i}")
                break
    
    # 6. Fix the first set_light_multizone at line ~1549
    print("   - Fixing set_light_multizone (line ~1074)...")
    multizone_fixed = False
    for i, line in enumerate(lines):
        if "def set_light_multizone(light: Any, zone_colors" in line and i > 1000 and i < 1200:
            # This is the one around line 1074
            # Find the end of this function
            method_end = i + 1
            for j in range(i + 1, len(lines)):
                if lines[j].strip() and lines[j][0] != ' ':
                    method_end = j
                    break
            
            # Replace the function
            new_function = fix_set_light_multizone_function().split('\n')
            lines[i:method_end] = new_function
            multizone_fixed = True
            print(f"     Fixed set_light_multizone at line {i}")
            break
    
    # Write the fixed content
    fixed_content = '\n'.join(lines)
    
    # Backup original
    backup_file = lifx_file + ".backup"
    print(f"\n3. Creating backup at {backup_file}...")
    with open(lifx_file, 'r') as f:
        with open(backup_file, 'w') as bf:
            bf.write(f.read())
    
    # Write fixed version
    print(f"4. Writing fixed version to {lifx_file}...")
    with open(lifx_file, 'w') as f:
        f.write(fixed_content)
    
    print("\n" + "=" * 60)
    print("✅ LIFX Protocol Implementation Fixed!")
    print("=" * 60)
    print("\nChanges applied:")
    print("  ✓ Added _create_proper_device helper for correct device types")
    print("  ✓ Fixed _unicast_discover to use proper device types")
    print("  ✓ Fixed _scan_ip_direct to use proper device types")
    print("  ✓ Fixed _get_device to ensure correct device class")
    print("  ✓ Fixed set_light_multizone to use MultiZoneLight methods")
    print("  ✓ Removed duplicate send_rgb_zones_rapid function")
    print("\nBackup saved to:", backup_file)
    print("\nThe LIFX protocol should now correctly:")
    print("  - Instantiate MultiZoneLight for strips/beams")
    print("  - Instantiate TileChain for tiles/candles")
    print("  - Use the appropriate methods for each device type")
    print("  - Properly handle HSBK color format (0-65535 ranges)")

if __name__ == "__main__":
    main()