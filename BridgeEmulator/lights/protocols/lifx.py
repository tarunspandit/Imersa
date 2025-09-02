"""
LIFX LAN Protocol Implementation for Hue Bridge Emulator

Native implementation without external dependencies.
Supports dynamic capability discovery for all LIFX devices.
High-performance entertainment mode with parallel UDP.
"""

import struct
import socket
import time
import random
import logging
from threading import Lock
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Tuple, Optional, Any

import logManager
from functions.colors import convert_xy, convert_rgb_xy, hsv_to_rgb

logging = logManager.logger.get_logger(__name__)

# Message type constants
MSG_GET_SERVICE = 2
MSG_STATE_SERVICE = 3
MSG_GET_POWER = 20
MSG_SET_POWER = 21
MSG_STATE_POWER = 22
MSG_GET_VERSION = 32
MSG_STATE_VERSION = 33
MSG_GET_COLOR = 101
MSG_SET_COLOR = 102
MSG_LIGHT_STATE = 107
MSG_SET_COLOR_ZONES = 501
MSG_GET_COLOR_ZONES = 502
MSG_STATE_ZONE = 503
MSG_STATE_MULTI_ZONE = 506
MSG_SET_EXTENDED_COLOR_ZONES = 510
MSG_STATE_EXTENDED_COLOR_ZONES = 512
MSG_GET_DEVICE_CHAIN = 701
MSG_STATE_DEVICE_CHAIN = 702
MSG_SET_TILE_STATE_64 = 715
MSG_STATE_TILE_STATE_64 = 711

# Constants
LIFX_PORT = 56700
BROADCAST_IP = '255.255.255.255'
DISCOVERY_TIMEOUT = 3
PACKET_TIMEOUT = 2
MAX_ZONES = 82
DEFAULT_KELVIN = 3500


class LifxPacket:
    """LIFX packet builder and parser"""
    
    def __init__(self):
        self.source = random.randint(2, 0xFFFFFFFF)
        self.sequence = 0
        
    def build_header(self, msg_type: int, payload: bytes = b'', 
                    tagged: bool = False, ack_required: bool = False,
                    res_required: bool = True, target: bytes = None) -> bytes:
        """Build a complete LIFX packet with header and payload"""
        
        # Calculate total size
        size = 36 + len(payload)
        
        # Frame (8 bytes)
        frame = struct.pack('<H', size)  # size (16 bits)
        
        # Protocol:1024 (0x400), addressable:1, tagged, origin:0 (16 bits total)
        # According to LIFX docs: protocol uses first 12 bits, addressable is bit 12, tagged is bit 13
        protocol_flags = 0x1400  # Protocol 1024 (0x400 << 0) with addressable bit (1 << 12)
        if tagged:
            protocol_flags |= 0x2000  # Set tagged bit (1 << 13)
        frame += struct.pack('<H', protocol_flags)
        
        # Source (32 bits)
        frame += struct.pack('<I', self.source)
        
        # Frame Address (16 bytes)
        # Target (64 bits)
        if target:
            frame_address = target[:8].ljust(8, b'\x00')
        else:
            frame_address = b'\x00' * 8
            
        # Reserved (48 bits)
        frame_address += b'\x00' * 6
        
        # Flags: res_required, ack_required, reserved (8 bits)
        flags = (int(res_required) << 0) | (int(ack_required) << 1)
        frame_address += struct.pack('B', flags)
        
        # Sequence (8 bits)
        self.sequence = (self.sequence + 1) % 256
        frame_address += struct.pack('B', self.sequence)
        
        # Protocol Header (12 bytes)
        protocol_header = b'\x00' * 8  # Reserved
        protocol_header += struct.pack('<H', msg_type)  # Type
        protocol_header += b'\x00' * 2  # Reserved
        
        return frame + frame_address + protocol_header + payload
    
    def parse_header(self, data: bytes) -> Dict:
        """Parse LIFX packet header"""
        if len(data) < 36:
            return None
            
        # Parse Frame
        size = struct.unpack('<H', data[0:2])[0]
        protocol_flags = struct.unpack('<H', data[2:4])[0]
        source = struct.unpack('<I', data[4:8])[0]
        
        # Parse Frame Address
        target = data[8:16]
        flags = data[22]
        sequence = data[23]
        
        # Parse Protocol Header
        msg_type = struct.unpack('<H', data[32:34])[0]
        
        # Extract payload
        payload = data[36:] if len(data) > 36 else b''
        
        return {
            'size': size,
            'source': source,
            'target': target,
            'sequence': sequence,
            'msg_type': msg_type,
            'payload': payload,
            'res_required': bool(flags & 0x01),
            'ack_required': bool(flags & 0x02)
        }


class LifxDevice:
    """Represents a single LIFX device with cached capabilities"""
    
    def __init__(self, mac: bytes, ip: str, label: str = None):
        self.mac = mac
        self.ip = ip
        self.port = LIFX_PORT
        self.label = label or f"LIFX_{mac.hex()[:8]}"
        self.capabilities = {}
        self.last_state = {}
        self.packet = LifxPacket()
        
    def send_packet(self, msg_type: int, payload: bytes = b'', 
                   ack_required: bool = False, res_required: bool = True) -> Optional[Dict]:
        """Send a packet to this device and optionally wait for response"""
        packet = self.packet.build_header(
            msg_type, payload, tagged=False, 
            ack_required=ack_required, res_required=res_required,
            target=self.mac
        )
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(PACKET_TIMEOUT)
        
        try:
            sock.sendto(packet, (self.ip, self.port))
            
            if res_required:
                data, _ = sock.recvfrom(1024)
                return self.packet.parse_header(data)
        except Exception as e:
            logging.debug(f"LIFX: Error sending packet to {self.ip}: {e}")
        finally:
            sock.close()
            
        return None
    
    def discover_capabilities(self):
        """Query device capabilities dynamically"""
        logging.debug(f"LIFX: Discovering capabilities for {self.label} at {self.ip}")
        
        # Try to get version info first
        try:
            response = self.send_packet(MSG_GET_VERSION)
            if response and response['msg_type'] == MSG_STATE_VERSION:
                payload = response['payload']
                if len(payload) >= 12:
                    vendor = struct.unpack('<I', payload[0:4])[0]
                    product = struct.unpack('<I', payload[4:8])[0]
                    self.capabilities['vendor'] = vendor
                    self.capabilities['product'] = product
                    logging.debug(f"LIFX: Device {self.label} - Vendor: {vendor}, Product: {product}")
        except Exception as e:
            logging.debug(f"LIFX: Error getting version: {e}")
        
        # Try multizone capabilities (strips, beams, neon)
        try:
            # Send GetColorZones with start_index=0, end_index=255
            payload = struct.pack('<BB', 0, 255)
            response = self.send_packet(MSG_GET_COLOR_ZONES, payload)
            
            # Check for StateZone or StateMultiZone response
            if response and response['msg_type'] in [MSG_STATE_ZONE, MSG_STATE_MULTI_ZONE]:
                payload = response['payload']
                
                if response['msg_type'] == MSG_STATE_ZONE and len(payload) >= 14:
                    # StateZone structure:
                    # Byte 0: zones_count (uint8) - total number of zones
                    # Byte 1: zone_index (uint8) - index of this zone
                    # Bytes 2-9: HSBK (4x uint16)
                    # Bytes 10-13: reserved
                    zone_count = payload[0]
                    zone_index = payload[1]
                    
                    if zone_count > 0:
                        self.capabilities['type'] = 'multizone'
                        self.capabilities['zone_count'] = zone_count
                        self.capabilities['supports_extended'] = zone_count > 16
                        logging.info(f"LIFX: {self.label} is multizone with {zone_count} zones")
                        return
                        
                elif response['msg_type'] == MSG_STATE_MULTI_ZONE and len(payload) >= 66:
                    # StateMultiZone structure:
                    # Byte 0: zones_count (uint8)
                    # Byte 1: zone_index (uint8)
                    # Bytes 2-65: 8 HSBK values (8 * 8 bytes)
                    zone_count = payload[0]
                    
                    if zone_count > 0:
                        self.capabilities['type'] = 'multizone'
                        self.capabilities['zone_count'] = zone_count
                        self.capabilities['supports_extended'] = zone_count > 16
                        logging.info(f"LIFX: {self.label} is multizone with {zone_count} zones")
                        return
                        
        except Exception as e:
            logging.debug(f"LIFX: Not multizone: {e}")
        
        # Try matrix capabilities (tiles, ceiling)
        try:
            response = self.send_packet(MSG_GET_DEVICE_CHAIN)
            if response and response['msg_type'] == MSG_STATE_DEVICE_CHAIN:
                payload = response['payload']
                if len(payload) >= 5:
                    start_index = payload[0]
                    total_count = payload[1]
                    
                    # Parse tile devices - StateDeviceChain structure:
                    # Byte 0: start_index (uint8)
                    # Byte 1: tile_devices_count (uint8)
                    # Bytes 2-4: reserved
                    # Bytes 5+: array of tile devices (55 bytes each)
                    tiles = []
                    offset = 5  # Start after header
                    
                    for i in range(min(total_count, 16)):  # Max 16 tiles
                        if offset + 55 <= len(payload):
                            # Tile structure (55 bytes):
                            # Bytes 0-1: accel_meas_x (int16)
                            # Bytes 2-3: accel_meas_y (int16)
                            # Bytes 4-5: accel_meas_z (int16)
                            # Bytes 6-7: reserved (2 bytes)
                            # Bytes 8-11: user_x (float32)
                            # Bytes 12-15: user_y (float32)
                            # Bytes 16: width (uint8)
                            # Bytes 17: height (uint8)
                            # Bytes 18: reserved (1 byte)
                            # Bytes 19-50: device_version_data (32 bytes)
                            # Bytes 51-54: firmware_build/version (4 bytes)
                            
                            # Extract width and height at correct offsets
                            width = payload[offset + 16]
                            height = payload[offset + 17]
                            
                            # Default to 8x8 if dimensions are 0 (common for tiles)
                            if width == 0:
                                width = 8
                            if height == 0:
                                height = 8
                            
                            # Extract user position floats
                            user_x = struct.unpack('<f', payload[offset + 8:offset + 12])[0] if offset + 12 <= len(payload) else 0
                            user_y = struct.unpack('<f', payload[offset + 12:offset + 16])[0] if offset + 16 <= len(payload) else 0
                            
                            tiles.append({
                                'index': i,
                                'width': width,
                                'height': height,
                                'x': user_x,
                                'y': user_y
                            })
                            offset += 55
                            
                            logging.debug(f"LIFX: Tile {i}: {width}x{height} at position ({user_x}, {user_y})")
                    
                    if tiles:
                        self.capabilities['type'] = 'matrix'
                        self.capabilities['tiles'] = tiles
                        self.capabilities['total_pixels'] = sum(t['width'] * t['height'] for t in tiles)
                        logging.info(f"LIFX: {self.label} is matrix with {len(tiles)} tiles, {self.capabilities['total_pixels']} total pixels")
                        return
        except Exception as e:
            logging.debug(f"LIFX: Not matrix: {e}")
        
        # Default to standard bulb
        self.capabilities['type'] = 'standard'
        self.capabilities['color'] = True
        logging.info(f"LIFX: {self.label} is standard color bulb")
        
        # Get temperature range
        try:
            response = self.send_packet(MSG_GET_COLOR)
            if response and response['msg_type'] == MSG_LIGHT_STATE:
                payload = response['payload']
                if len(payload) >= 52:
                    # Extract kelvin range from current state
                    kelvin = struct.unpack('<H', payload[6:8])[0]
                    # Most LIFX devices support 2500-9000K, some 1500-9000K
                    self.capabilities['temp_range'] = [1500, 9000] if kelvin < 2000 else [2500, 9000]
        except Exception:
            self.capabilities['temp_range'] = [2500, 9000]
    
    def get_state(self) -> Dict:
        """Get current device state"""
        response = self.send_packet(MSG_GET_COLOR)
        if response and response['msg_type'] == MSG_LIGHT_STATE:
            payload = response['payload']
            if len(payload) >= 52:
                hue = struct.unpack('<H', payload[0:2])[0]
                saturation = struct.unpack('<H', payload[2:4])[0]
                brightness = struct.unpack('<H', payload[4:6])[0]
                kelvin = struct.unpack('<H', payload[6:8])[0]
                power = struct.unpack('<H', payload[10:12])[0]
                label = payload[12:44].decode('utf-8', errors='ignore').strip('\x00')
                
                # Convert to Hue bridge format
                self.last_state = {
                    'on': power > 0,
                    'bri': int(brightness * 254 / 65535),
                    'hue': int(hue * 65535 / 65535),  # Already in correct range
                    'sat': int(saturation * 254 / 65535),
                    'ct': int(1000000 / kelvin) if kelvin > 0 else 366,
                    'colormode': 'hs' if saturation > 0 else 'ct'
                }
                
                if label:
                    self.label = label
                    
                return self.last_state
        
        return self.last_state or {'on': False, 'bri': 0}


class LifxProtocol:
    """Main LIFX protocol handler"""
    
    def __init__(self):
        self.devices: Dict[str, LifxDevice] = {}  # MAC -> LifxDevice
        self.socket_pool: List[socket.socket] = []
        self.lock = Lock()
        self.executor = ThreadPoolExecutor(max_workers=10)
        self._init_socket_pool()
        
    def _init_socket_pool(self):
        """Initialize UDP socket pool for performance"""
        for _ in range(10):
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(PACKET_TIMEOUT)
            self.socket_pool.append(sock)
    
    def _get_socket(self) -> socket.socket:
        """Get a socket from the pool"""
        return self.socket_pool[random.randint(0, len(self.socket_pool) - 1)]
    
    def discover(self, detectedLights: List, device_ips: List[str]) -> None:
        """Discover LIFX devices on the network"""
        logging.info("LIFX: Discovery started")
        discovered_this_run = set()
        packet_builder = LifxPacket()
        
        # If no device_ips provided, generate subnet IPs for scanning
        if not device_ips:
            import configManager
            HOST_IP = configManager.runtimeConfig.arg.get("HOST_IP", "192.168.1.1")
            subnet = '.'.join(HOST_IP.split('.')[0:3])
            device_ips = [f"{subnet}.{i}" for i in range(1, 255)]
            logging.info(f"LIFX: No device IPs provided, scanning subnet {subnet}.1-254")
        
        # 1. Try broadcast discovery with dedicated socket
        try:
            # Create dedicated broadcast socket
            broadcast_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            broadcast_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            broadcast_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            # Bind to any available port on all interfaces - critical for receiving responses
            broadcast_sock.bind(('', 0))
            bound_port = broadcast_sock.getsockname()[1]
            logging.info(f"LIFX: Discovery socket bound to port {bound_port}")
            broadcast_sock.settimeout(0.5)  # Increased timeout for better reliability
            
            # Send multiple GetService broadcasts for reliability
            packet = packet_builder.build_header(MSG_GET_SERVICE, tagged=True)
            logging.info(f"LIFX: Sending GetService broadcast packet ({len(packet)} bytes): {packet.hex()}")
            for retry in range(3):
                broadcast_sock.sendto(packet, (BROADCAST_IP, LIFX_PORT))
                logging.info(f"LIFX: Sent broadcast discovery {retry+1}/3 to {BROADCAST_IP}:{LIFX_PORT}")
                time.sleep(0.1)  # Small delay between broadcasts
            
            # Collect responses with non-blocking receives
            import select
            end_time = time.time() + DISCOVERY_TIMEOUT
            
            while time.time() < end_time:
                # Use select to check for data without blocking
                readable, _, _ = select.select([broadcast_sock], [], [], 0.5)
                
                if readable:
                    try:
                        data, addr = broadcast_sock.recvfrom(1024)
                        logging.info(f"LIFX: Received response from {addr[0]}:{addr[1]} - {len(data)} bytes")
                        response = packet_builder.parse_header(data)
                        
                        if response and response['msg_type'] == MSG_STATE_SERVICE:
                            # Parse StateService payload for port info
                            payload = response['payload']
                            device_port = LIFX_PORT
                            if len(payload) >= 5:
                                service_type = payload[0]
                                device_port = struct.unpack('<I', payload[1:5])[0]
                                logging.debug(f"LIFX: Device at {addr[0]} reports service {service_type} on port {device_port}")
                            
                            serial = response['target']
                            serial_hex = serial.hex()
                            ip = addr[0]
                            
                            # Check if already discovered (avoid duplicates)
                            if serial_hex not in self.devices and serial not in discovered_this_run:
                                discovered_this_run.add(serial)
                                logging.info(f"LIFX: Found device via broadcast at {ip}:{device_port}")
                                
                                # Create device and discover capabilities
                                device = LifxDevice(serial, ip)
                                device.port = device_port  # Use discovered port
                                device.discover_capabilities()
                                self.devices[serial_hex] = device
                                
                                # Map to appropriate Hue model
                                if device.capabilities['type'] in ['multizone', 'matrix']:
                                    modelid = 'LCX004'  # Gradient capable
                                elif device.capabilities.get('color', True):
                                    modelid = 'LCT015'  # Color bulb
                                else:
                                    modelid = 'LTW001'  # White only
                                
                                detectedLights.append({
                                    'protocol': 'lifx',
                                    'name': device.label,
                                    'modelid': modelid,
                                    'protocol_cfg': {
                                        'mac': serial_hex,
                                        'ip': ip,
                                        'port': device_port,
                                        'capabilities': device.capabilities
                                    }
                                })
                                
                    except Exception as e:
                        logging.debug(f"LIFX: Error processing broadcast response: {e}")
                        continue
                        
            broadcast_sock.close()
                    
        except Exception as e:
            logging.debug(f"LIFX: Broadcast discovery error: {e}")
        
        # 2. Parallel IP scanning for specific IPs (always run as fallback)
        # This helps when broadcast doesn't work (Docker, VLANs, etc)
        if device_ips or len(discovered_this_run) == 0:
            # If broadcast found nothing, ensure we have IPs to scan
            if not device_ips and len(discovered_this_run) == 0:
                import configManager
                HOST_IP = configManager.runtimeConfig.arg.get("HOST_IP", "192.168.1.1")
                subnet = '.'.join(HOST_IP.split('.')[0:3])
                device_ips = [f"{subnet}.{i}" for i in range(1, 255)]
                logging.info(f"LIFX: Broadcast found 0 devices, scanning subnet {subnet}.1-254")
            
            if device_ips:
                logging.info(f"LIFX: Scanning {len(device_ips)} IPs via unicast")
            
            def scan_single_ip(ip: str) -> Optional[Tuple[str, Dict]]:
                """Scan a single IP for LIFX device"""
                try:
                    scan_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    scan_sock.settimeout(0.5)  # Short timeout for faster scanning
                    
                    packet = packet_builder.build_header(MSG_GET_SERVICE, tagged=False)
                    logging.debug(f"LIFX: Scanning IP {ip}:{LIFX_PORT}")
                    scan_sock.sendto(packet, (ip, LIFX_PORT))
                    
                    data, _ = scan_sock.recvfrom(1024)
                    response = packet_builder.parse_header(data)
                    scan_sock.close()
                    
                    if response and response['msg_type'] == MSG_STATE_SERVICE:
                        return (ip, response)
                except Exception:
                    pass
                return None
            
            # Use ThreadPoolExecutor for parallel scanning
            with ThreadPoolExecutor(max_workers=min(20, len(device_ips))) as executor:
                futures = [executor.submit(scan_single_ip, ip) for ip in device_ips]
                
                completed = 0
                for future in futures:
                    completed += 1
                    if completed % 50 == 0:
                        logging.debug(f"LIFX: Scanned {completed}/{len(device_ips)} IPs...")
                    result = future.result()
                    if result:
                        ip, response = result
                        
                        # Parse StateService payload
                        payload = response['payload']
                        device_port = LIFX_PORT
                        if len(payload) >= 5:
                            service_type = payload[0]
                            device_port = struct.unpack('<I', payload[1:5])[0]
                        
                        serial = response['target']
                        serial_hex = serial.hex()
                        
                        # Check if already discovered
                        if serial_hex not in self.devices and serial not in discovered_this_run:
                            discovered_this_run.add(serial)
                            logging.info(f"LIFX: Found device via IP scan at {ip}:{device_port}")
                            
                            # Create device and discover capabilities
                            device = LifxDevice(serial, ip)
                            device.port = device_port
                            device.discover_capabilities()
                            self.devices[serial_hex] = device
                            
                            # Map to appropriate Hue model
                            if device.capabilities['type'] in ['multizone', 'matrix']:
                                modelid = 'LCX004'
                            elif device.capabilities.get('color', True):
                                modelid = 'LCT015'
                            else:
                                modelid = 'LTW001'
                            
                            detectedLights.append({
                                'protocol': 'lifx',
                                'name': device.label,
                                'modelid': modelid,
                                'protocol_cfg': {
                                    'mac': serial_hex,
                                    'ip': ip,
                                    'port': device_port,
                                    'capabilities': device.capabilities
                                }
                            })
        
        logging.info(f"LIFX: Discovery complete, found {len(discovered_this_run)} new devices, {len(self.devices)} total")
    
    def set_light(self, light, data: Dict) -> None:
        """Set light state based on Hue bridge commands"""
        mac_hex = light.protocol_cfg.get('mac')
        if not mac_hex:
            return
            
        device = self.devices.get(mac_hex)
        if not device:
            # Try to recreate device
            ip = light.protocol_cfg.get('ip')
            if ip:
                mac = bytes.fromhex(mac_hex)
                device = LifxDevice(mac, ip, light.name)
                device.capabilities = light.protocol_cfg.get('capabilities', {})
                self.devices[mac_hex] = device
            else:
                return
        
        # Handle power state
        if 'on' in data:
            power = 65535 if data['on'] else 0
            payload = struct.pack('<H', power)
            device.send_packet(MSG_SET_POWER, payload, ack_required=False, res_required=False)
            
            if not data['on']:
                return  # Don't send color commands when turning off
        
        # Handle gradient for capable devices
        if 'gradient' in data and device.capabilities.get('type') in ['multizone', 'matrix']:
            self._set_gradient(device, data['gradient'])
            return
        
        # Handle standard color/brightness
        if any(k in data for k in ['bri', 'xy', 'ct', 'hue', 'sat']):
            # Get current state as baseline
            current = device.last_state or device.get_state()
            
            # Build HSBK values
            hue = current.get('hue', 0)
            sat = current.get('sat', 254)
            bri = current.get('bri', 254)
            kelvin = DEFAULT_KELVIN
            
            if 'xy' in data:
                # Convert XY to HSV
                x, y = data['xy']
                rgb = convert_xy(x, y, 255)
                h, s, v = self._rgb_to_hsv(rgb[0], rgb[1], rgb[2])
                hue = int(h * 65535)
                sat = int(s * 254)
                if 'bri' not in data:
                    bri = int(v * 254)
                    
            if 'ct' in data:
                # Convert mired to kelvin
                mired = data['ct']
                kelvin = int(1000000 / mired) if mired > 0 else DEFAULT_KELVIN
                kelvin = max(1500, min(9000, kelvin))
                sat = 0  # No saturation for white mode
                
            if 'hue' in data:
                hue = data['hue']
                
            if 'sat' in data:
                sat = data['sat']
                
            if 'bri' in data:
                bri = data['bri']
            
            # Convert to LIFX ranges
            hue_lifx = int(hue * 65535 / 65535) if hue <= 65535 else hue
            sat_lifx = int(sat * 65535 / 254)
            bri_lifx = int(bri * 65535 / 254)
            
            # Duration in milliseconds
            duration = int(data.get('transitiontime', 4) * 100) if 'transitiontime' in data else 0
            
            # Build SetColor payload (reserved byte + HSBK + duration)
            payload = struct.pack('<BHHHHI',
                                0,             # Reserved
                                hue_lifx,      # Hue
                                sat_lifx,      # Saturation
                                bri_lifx,      # Brightness
                                kelvin,        # Kelvin
                                duration)      # Duration
            
            device.send_packet(MSG_SET_COLOR, payload, ack_required=False, res_required=False)
    
    def _set_gradient(self, device: LifxDevice, gradient: Dict) -> None:
        """Set gradient on multizone or matrix device"""
        points = gradient.get('points', [])
        if not points:
            return
            
        if device.capabilities['type'] == 'multizone':
            # Map gradient to zones
            zone_count = device.capabilities.get('zone_count', 16)
            colors = self._interpolate_gradient(points, zone_count)
            
            if device.capabilities.get('supports_extended', False):
                # Use SetExtendedColorZones for efficiency
                self._send_extended_zones(device, colors)
            else:
                # Use multiple SetColorZones
                for i, color in enumerate(colors):
                    self._send_color_zone(device, i, i, color)
                    
        elif device.capabilities['type'] == 'matrix':
            # Map gradient to tiles
            tiles = device.capabilities.get('tiles', [])
            for tile in tiles:
                width = tile.get('width', 8)
                height = tile.get('height', 8)
                tile_colors = self._map_gradient_to_grid(points, width, height)
                self._send_tile_state(device, tile['index'], tile_colors)
    
    def _interpolate_gradient(self, points: List[Dict], count: int) -> List[Tuple[int, int, int, int]]:
        """Interpolate gradient points to specific number of colors"""
        if not points:
            return [(0, 0, 65535, DEFAULT_KELVIN)] * count
            
        colors = []
        for i in range(count):
            position = i / max(1, count - 1)
            
            # Find surrounding points
            prev_point = points[0]
            next_point = points[-1]
            
            for j, point in enumerate(points):
                point_pos = j / max(1, len(points) - 1)
                if point_pos <= position:
                    prev_point = point
                if point_pos >= position:
                    next_point = point
                    break
            
            # Extract colors
            prev_xy = prev_point.get('color', {}).get('xy', {'x': 0.5, 'y': 0.5})
            next_xy = next_point.get('color', {}).get('xy', {'x': 0.5, 'y': 0.5})
            
            # Interpolate (simplified - could be improved)
            if prev_point == next_point:
                xy = prev_xy
            else:
                # Linear interpolation
                t = position
                xy = {
                    'x': prev_xy['x'] + (next_xy['x'] - prev_xy['x']) * t,
                    'y': prev_xy['y'] + (next_xy['y'] - prev_xy['y']) * t
                }
            
            # Convert to HSBK
            rgb = convert_xy(xy['x'], xy['y'], 255)
            h, s, v = self._rgb_to_hsv(rgb[0], rgb[1], rgb[2])
            
            colors.append((
                int(h * 65535),         # Hue
                int(s * 65535),         # Saturation
                int(v * 65535),         # Brightness
                DEFAULT_KELVIN          # Kelvin
            ))
            
        return colors
    
    def _map_gradient_to_grid(self, points: List[Dict], width: int, height: int) -> List[Tuple[int, int, int, int]]:
        """Map gradient points to 2D grid"""
        # For now, simple horizontal gradient
        # Could be enhanced to support 2D gradients
        total_pixels = width * height
        return self._interpolate_gradient(points, total_pixels)
    
    def _send_extended_zones(self, device: LifxDevice, colors: List[Tuple[int, int, int, int]]) -> None:
        """Send SetExtendedColorZones message for efficient multizone updates"""
        # SetExtendedColorZones can update up to 82 zones in a single message
        duration = 0  # Immediate transition
        apply = 1  # Apply immediately (APPLY_APPLY)
        zone_index = 0  # Starting zone
        
        # Process colors in chunks of 82 (max zones per message)
        for chunk_start in range(0, len(colors), 82):
            chunk = colors[chunk_start:chunk_start + 82]
            colors_count = len(chunk)
            
            # Build SetExtendedColorZones payload
            # Duration (uint32) + Apply (uint8) + Zone Index (uint16) + Colors Count (uint8)
            payload = struct.pack('<IBHB', 
                                duration,      # Duration in ms
                                apply,         # Apply flag
                                chunk_start,   # Starting zone index
                                colors_count)  # Number of colors
            
            # Add HSBK values for each zone
            for color in chunk:
                payload += struct.pack('<HHHH',
                                     color[0],  # Hue
                                     color[1],  # Saturation
                                     color[2],  # Brightness
                                     color[3])  # Kelvin
            
            # Pad with zeros if less than 82 zones (optional, but keeps packet size consistent)
            while len(chunk) < 82:
                payload += struct.pack('<HHHH', 0, 0, 0, DEFAULT_KELVIN)
                chunk.append((0, 0, 0, DEFAULT_KELVIN))
            
            # Send the extended zones message
            device.send_packet(MSG_SET_EXTENDED_COLOR_ZONES, payload, ack_required=False, res_required=False)
            
            logging.debug(f"LIFX: Sent extended zones update for zones {chunk_start}-{chunk_start + colors_count - 1}")
    
    def _send_color_zone(self, device: LifxDevice, start: int, end: int, color: Tuple[int, int, int, int]) -> None:
        """Send SetColorZones message"""
        duration = 0
        apply = 1  # Apply immediately
        
        payload = struct.pack('<BBHHHHIB',
                            start,      # Start index
                            end,        # End index
                            color[0],   # Hue
                            color[1],   # Saturation
                            color[2],   # Brightness
                            color[3],   # Kelvin
                            duration,   # Duration
                            apply)      # Apply
        
        device.send_packet(MSG_SET_COLOR_ZONES, payload, ack_required=False, res_required=False)
    
    def _send_tile_state(self, device: LifxDevice, tile_index: int, colors: List[Tuple[int, int, int, int]]) -> None:
        """Send SetTileState64 message"""
        # Ensure we have exactly 64 colors
        while len(colors) < 64:
            colors.append((0, 0, 0, DEFAULT_KELVIN))
        colors = colors[:64]
        
        # Build payload
        payload = struct.pack('<BBBxI',
                            tile_index,  # Tile index
                            1,          # Length (1 tile)
                            0,          # Reserved
                            0)          # Duration
        
        # Add 64 colors (HSBK each)
        for color in colors:
            payload += struct.pack('<HHHH',
                                 color[0],   # Hue
                                 color[1],   # Saturation
                                 color[2],   # Brightness
                                 color[3])   # Kelvin
        
        device.send_packet(MSG_SET_TILE_STATE_64, payload, ack_required=False, res_required=False)
    
    def _rgb_to_hsv(self, r: int, g: int, b: int) -> Tuple[float, float, float]:
        """Convert RGB to HSV"""
        r, g, b = r / 255.0, g / 255.0, b / 255.0
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        diff = max_c - min_c
        
        if max_c == min_c:
            h = 0
        elif max_c == r:
            h = (60 * ((g - b) / diff) + 360) % 360
        elif max_c == g:
            h = (60 * ((b - r) / diff) + 120) % 360
        else:
            h = (60 * ((r - g) / diff) + 240) % 360
            
        s = 0 if max_c == 0 else diff / max_c
        v = max_c
        
        return h / 360.0, s, v
    
    def get_light_state(self, light) -> Dict:
        """Get current light state"""
        mac_hex = light.protocol_cfg.get('mac')
        if not mac_hex:
            return {}
            
        device = self.devices.get(mac_hex)
        if not device:
            # Try to recreate device
            ip = light.protocol_cfg.get('ip')
            if ip:
                mac = bytes.fromhex(mac_hex)
                device = LifxDevice(mac, ip, light.name)
                device.capabilities = light.protocol_cfg.get('capabilities', {})
                self.devices[mac_hex] = device
            else:
                return {}
        
        return device.get_state()


# Module interface - singleton instance
_protocol = LifxProtocol()

def discover(detectedLights, device_ips):
    """Discover LIFX devices on the network"""
    return _protocol.discover(detectedLights, device_ips)

def set_light(light, data):
    """Set light state"""
    return _protocol.set_light(light, data)

def get_light_state(light):
    """Get light state"""
    return _protocol.get_light_state(light)