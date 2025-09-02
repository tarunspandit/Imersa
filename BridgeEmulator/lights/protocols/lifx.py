"""
Comprehensive LIFX LAN Protocol Implementation
Supports all LIFX device types with high-performance entertainment mode
Based on LIFX LAN Protocol documentation
"""

import socket
import struct
import time
import threading
import json
import logging as log_module
import math
import ipaddress
import os
from typing import Dict, List, Tuple, Optional, Union, Any
from collections import defaultdict, deque
from dataclasses import dataclass
from time import sleep
import asyncio
import random

import logManager
import configManager
from functions.colors import convert_rgb_xy, convert_xy

logging = logManager.logger.get_logger(__name__)

# LIFX Protocol Constants
LIFX_PORT = 56700
LIFX_BROADCAST_ADDR = "255.255.255.255"
LIFX_HEADER_SIZE = 36

# Message Types
MSG_GET_SERVICE = 2
MSG_STATE_SERVICE = 3
MSG_GET_POWER = 20
MSG_SET_POWER = 21
MSG_STATE_POWER = 22
MSG_GET_LABEL = 23
MSG_SET_LABEL = 24
MSG_STATE_LABEL = 25
MSG_GET_VERSION = 32
MSG_STATE_VERSION = 33
MSG_GET_INFO = 34
MSG_STATE_INFO = 35
MSG_GET_COLOR = 101
MSG_SET_COLOR = 102
MSG_LIGHT_STATE = 107
MSG_GET_LIGHT_POWER = 116
MSG_SET_LIGHT_POWER = 117
MSG_STATE_LIGHT_POWER = 118

# Multizone Messages
MSG_SET_COLOR_ZONES = 501
MSG_GET_COLOR_ZONES = 502
MSG_STATE_ZONE = 503
MSG_STATE_MULTI_ZONE = 506
MSG_SET_EXTENDED_COLOR_ZONES = 510
MSG_GET_EXTENDED_COLOR_ZONES = 511
MSG_STATE_EXTENDED_COLOR_ZONES = 512

# Tile/Matrix Messages
MSG_GET_DEVICE_CHAIN = 701
MSG_STATE_DEVICE_CHAIN = 702
MSG_GET_TILE_STATE64 = 707
MSG_STATE_TILE_STATE64 = 711
MSG_SET_TILE_STATE64 = 715

# Device capabilities storage
DeviceCache = {}
Connections = {}
SocketPool = {}
_discovery_lock = threading.Lock()
_send_lock = threading.Lock()
_rate_limiters = defaultdict(lambda: {"last_send": 0, "count": 0})

# High-performance settings
RAPID_MODE = True
MAX_FPS = 120
FRAME_INTERVAL = 1.0 / MAX_FPS
UDP_BUFFER_SIZE = 65536
SOCKET_TIMEOUT = 0.5
MAX_RETRY = 3


@dataclass
class LIFXDevice:
    """LIFX Device representation"""
    ip: str
    mac: bytes
    port: int = LIFX_PORT
    label: str = ""
    product_id: int = 0
    vendor_id: int = 0
    version: int = 0
    has_color: bool = False
    has_multizone: bool = False
    has_matrix: bool = False
    has_chain: bool = False
    zone_count: int = 0
    tile_count: int = 0
    width: int = 0
    height: int = 0
    kelvin_range: Tuple[int, int] = (2500, 9000)
    supports_extended_multizone: bool = False
    last_seen: float = 0
    sequence: int = 0


class LIFXProtocol:
    """High-performance LIFX protocol implementation"""
    
    def __init__(self):
        self.socket = None
        self.source_id = random.randint(2, 0xFFFFFFFF)
        self.sequences = defaultdict(int)
        self.devices = {}
        self.discovery_thread = None
        self.running = True
        try:
            self._init_socket()
        except Exception as e:
            logging.error(f"Failed to initialize socket in __init__: {e}")
            # Ensure socket is None if initialization fails
            self.socket = None
        
    def _init_socket(self):
        """Initialize UDP socket with optimizations"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            # Increase buffer sizes for high throughput
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, UDP_BUFFER_SIZE)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, UDP_BUFFER_SIZE)
            self.socket.settimeout(SOCKET_TIMEOUT)
            self.socket.bind(('0.0.0.0', 0))  # Bind to any available port
            logging.info(f"LIFX socket initialized on port {self.socket.getsockname()[1]}")
        except Exception as e:
            logging.error(f"Failed to initialize LIFX socket: {e}")
            
    def _get_socket_for_device(self, device_ip: str) -> socket.socket:
        """Get or create a socket for specific device (socket pooling)"""
        if device_ip not in SocketPool:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(SOCKET_TIMEOUT)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, UDP_BUFFER_SIZE)
            SocketPool[device_ip] = sock
        return SocketPool[device_ip]
    
    def _build_header(self, message_type: int, target: bytes = None, 
                     res_required: bool = False, ack_required: bool = False,
                     tagged: bool = False, sequence: int = None) -> bytes:
        """Build LIFX packet header"""
        # Frame header
        size = LIFX_HEADER_SIZE
        protocol = 1024
        addressable = 1
        origin = 0
        
        # Combine protocol flags
        protocol_flags = protocol | (addressable << 12) | (tagged << 13) | (origin << 14)
        
        # Frame address
        if target is None:
            target = b'\x00' * 8
        elif len(target) == 6:  # MAC address
            target = target + b'\x00\x00'
            
        reserved1 = b'\x00' * 6
        
        # Flags
        flags = 0
        if res_required:
            flags |= 0x01
        if ack_required:
            flags |= 0x02
            
        if sequence is None:
            sequence = self._get_next_sequence(target)
            
        # Protocol header
        reserved2 = b'\x00' * 8
        reserved3 = 0  # 2 bytes reserved as 16-bit integer
        
        # Pack header
        header = struct.pack('<HHI8s6sBB8sHH',
            size, protocol_flags, self.source_id,
            target, reserved1, flags, sequence,
            reserved2, message_type, reserved3
        )
        
        return header
    
    def _get_next_sequence(self, target: bytes) -> int:
        """Get next sequence number for target"""
        key = target[:6] if target else b'broadcast'
        self.sequences[key] = (self.sequences[key] + 1) % 256
        return self.sequences[key]
    
    def _send_packet(self, packet: bytes, ip: str = None, port: int = LIFX_PORT,
                    retry: int = 0) -> Optional[bytes]:
        """Send packet with optional retry and response waiting"""
        try:
            with _send_lock:
                if ip:
                    sock = self._get_socket_for_device(ip)
                    sock.sendto(packet, (ip, port))
                else:
                    # Broadcast
                    if not self.socket:
                        logging.error("Cannot send broadcast: socket not initialized")
                        return None
                    self.socket.sendto(packet, (LIFX_BROADCAST_ADDR, port))
                    
            return None
            
        except Exception as e:
            if retry < MAX_RETRY:
                sleep(0.1 * (retry + 1))
                return self._send_packet(packet, ip, port, retry + 1)
            logging.error(f"Failed to send LIFX packet: {e}")
            return None
    
    def _parse_packet(self, data: bytes) -> Dict:
        """Parse LIFX packet"""
        if len(data) < LIFX_HEADER_SIZE:
            return None
            
        try:
            # Parse header
            size, protocol_flags, source = struct.unpack('<HHI', data[0:8])
            target = data[8:16]
            flags, sequence = struct.unpack('<BB', data[22:24])
            msg_type = struct.unpack('<H', data[32:34])[0]
            
            # Extract flags
            tagged = (protocol_flags >> 13) & 1
            res_required = flags & 0x01
            ack_required = (flags >> 1) & 0x01
            
            return {
                'size': size,
                'source': source,
                'target': target[:6],  # MAC address only
                'sequence': sequence,
                'type': msg_type,
                'tagged': tagged,
                'res_required': res_required,
                'ack_required': ack_required,
                'payload': data[LIFX_HEADER_SIZE:] if len(data) > LIFX_HEADER_SIZE else b''
            }
        except Exception as e:
            logging.debug(f"Failed to parse LIFX packet: {e}")
            return None
    
    def cleanup(self):
        """Cleanup protocol resources"""
        self.running = False
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
            self.socket = None


def _get_network_ips_from_config():
    """Get IP addresses to scan based on bridge configuration"""
    ips = set()
    
    # Get bridge configuration
    bridgeConfig = configManager.bridgeConfig.yaml_config
    rangeConfig = bridgeConfig["config"]["IP_RANGE"]
    HOST_IP = configManager.runtimeConfig.arg["HOST_IP"]
    
    # Extract network range settings
    ip_range_start = rangeConfig["IP_RANGE_START"]
    ip_range_end = rangeConfig["IP_RANGE_END"]
    sub_ip_range_start = rangeConfig["SUB_IP_RANGE_START"]
    sub_ip_range_end = rangeConfig["SUB_IP_RANGE_END"]
    
    # Build IP list based on configured ranges
    host_parts = HOST_IP.split('.')
    
    logging.info(f"LIFX: Scanning subnet {host_parts[0]}.{host_parts[1]}.{sub_ip_range_start}-{sub_ip_range_end}.{ip_range_start}-{ip_range_end}")
    
    # Generate IPs within the configured range
    for sub_addr in range(sub_ip_range_start, sub_ip_range_end + 1):
        for addr in range(ip_range_start, ip_range_end + 1):
            ip = f"{host_parts[0]}.{host_parts[1]}.{sub_addr}.{addr}"
            if ip != HOST_IP:  # Skip our own IP
                ips.add(ip)
    
    return list(ips)


def discover(detectedLights, opts=None):
    """Discover LIFX devices on the network using subnet unicast"""
    logging.info("Starting LIFX discovery...")
    
    # Handle options parameter
    if opts is None:
        opts = {}
    
    static_ips = opts.get("static_ips", [])
    device_ips = opts.get("device_ips", [])
    protocol = None
    discovered = []
    
    try:
        # Create protocol instance with error handling
        try:
            protocol = LIFXProtocol()
            logging.debug(f"LIFXProtocol created, has _build_header: {hasattr(protocol, '_build_header')}")
        except Exception as e:
            logging.error(f"Failed to create LIFXProtocol: {e}")
            return
            
        # Check if socket is available
        if not protocol.socket:
            logging.error("LIFXProtocol socket not initialized")
            return
            
        discovery_packet = protocol._build_header(MSG_GET_SERVICE, tagged=True)
        
        # Get IPs from bridge configuration
        all_ips = set(_get_network_ips_from_config())
        
        # Add static IPs if provided
        if static_ips:
            logging.info(f"Adding {len(static_ips)} static IP(s) to scan")
            for ip in static_ips:
                if ':' in ip:  # Handle IP:port format
                    ip = ip.split(':')[0]
                all_ips.add(ip)
        
        # Add device_ips if provided (from port scanning)
        if device_ips:
            logging.debug(f"Adding {len(device_ips)} device IP(s) from port scan")
            for ip in device_ips:
                if ':' in ip:  # Handle IP:port format
                    ip = ip.split(':')[0]
                all_ips.add(ip)
        
        logging.info(f"Scanning {len(all_ips)} IP addresses for LIFX devices")
        
        # Use threading for parallel scanning
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import queue
        
        def send_discovery_to_ip(ip_str):
            """Send discovery packet to a single IP"""
            try:
                # Create a separate socket for this thread
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.settimeout(0.1)
                sock.sendto(discovery_packet, (ip_str, LIFX_PORT))
                sock.close()
                return ip_str, True
            except Exception as e:
                return ip_str, False
        
        # Send discovery packets in parallel with rate limiting
        max_workers = 20  # Limit concurrent threads
        sent_count = 0
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit tasks in batches to control rate
            batch_size = 100
            ip_list = list(all_ips)
            
            for i in range(0, len(ip_list), batch_size):
                batch = ip_list[i:i+batch_size]
                futures = [executor.submit(send_discovery_to_ip, ip) for ip in batch]
                
                # Wait for batch to complete
                for future in as_completed(futures):
                    ip, success = future.result()
                    if success:
                        sent_count += 1
                
                # Small delay between batches to avoid network flooding
                if i + batch_size < len(ip_list):
                    time.sleep(0.1)
        
        logging.info(f"Successfully sent discovery packets to {sent_count} addresses")
        
        # Also try broadcast as fallback (might work in some environments)
        try:
            protocol._send_packet(discovery_packet)
            logging.debug("Also sent broadcast discovery packet")
        except Exception as e:
            logging.debug(f"Broadcast failed (expected in container): {e}")
        
        # Listen for responses
        discovery_timeout = 3  # 3 seconds should be enough for local network
        start_time = time.time()
        responses = {}
        protocol.socket.settimeout(0.05)  # Very short timeout for non-blocking receive
        
        logging.info(f"Listening for LIFX device responses for {discovery_timeout} seconds...")
        
        while time.time() - start_time < discovery_timeout:
            try:
                data, addr = protocol.socket.recvfrom(1024)
                parsed = protocol._parse_packet(data)
                
                if parsed and parsed['type'] == MSG_STATE_SERVICE:
                    mac = parsed['target']
                    if mac not in responses:
                        logging.debug(f"Got STATE_SERVICE response from {addr[0]}")
                        # Get device details
                        device = _get_device_details(protocol, addr[0], mac)
                        if device:
                            responses[mac] = device
                            discovered.append(device)
                            logging.info(f"Discovered LIFX device: {device.get('name', 'Unknown')} at {addr[0]}")
                        else:
                            logging.debug(f"Failed to get details for device at {addr[0]}")
                            
            except socket.timeout:
                # This is expected, continue listening
                pass
            except Exception as e:
                if "Resource temporarily unavailable" not in str(e):
                    logging.debug(f"Discovery receive error: {e}")
                
        # Also check specific IPs if provided
        if device_ips:
            for ip in device_ips:
                try:
                    device = _probe_device(protocol, ip)
                    if device and device not in discovered:
                        discovered.append(device)
                        logging.info(f"Found LIFX device at {ip}")
                except Exception as e:
                    logging.debug(f"Failed to probe {ip}: {e}")
                    
        # Convert discovered devices to bridge format
        for device in discovered:
            light_config = _convert_to_bridge_format(device)
            if light_config:
                detectedLights.append(light_config)
                
    except Exception as e:
        import traceback
        logging.error(f"LIFX discovery error: {e}")
        logging.debug(f"Discovery traceback: {traceback.format_exc()}")
    finally:
        if protocol is not None:
            try:
                protocol.cleanup()
            except Exception as e:
                logging.debug(f"Error during cleanup: {e}")
        
    logging.info(f"LIFX discovery complete. Found {len(discovered)} devices")


def _get_device_details(protocol: LIFXProtocol, ip: str, mac: bytes) -> Optional[Dict]:
    """Get detailed information about a LIFX device"""
    try:
        device = {
            'ip': ip,
            'mac': mac.hex() if mac else 'unknown',
            'port': LIFX_PORT,
            'name': f'LIFX Device {ip}',  # Default name
            'has_color': True,  # Assume color support by default
            'capabilities': {'has_color': True}
        }
        
        # Get device label
        label_packet = protocol._build_header(MSG_GET_LABEL, target=mac)
        protocol._send_packet(label_packet, ip)
        
        # Get version info
        version_packet = protocol._build_header(MSG_GET_VERSION, target=mac)
        protocol._send_packet(version_packet, ip)
        
        # Get current state
        state_packet = protocol._build_header(MSG_GET_COLOR, target=mac)
        protocol._send_packet(state_packet, ip)
        
        # Collect responses with shorter timeout for faster discovery
        start_time = time.time()
        responses_received = 0
        while time.time() - start_time < 0.5 and responses_received < 3:  # Shorter timeout
            try:
                data, addr = protocol.socket.recvfrom(1024)
                if addr[0] != ip:
                    continue
                    
                parsed = protocol._parse_packet(data)
                if not parsed:
                    continue
                    
                if parsed['type'] == MSG_STATE_LABEL:
                    label = parsed['payload'][:32].decode('utf-8', errors='ignore').rstrip('\x00')
                    if label:  # Only update if we got a valid label
                        device['name'] = label
                    responses_received += 1
                    
                elif parsed['type'] == MSG_STATE_VERSION:
                    if len(parsed['payload']) >= 12:
                        try:
                            vendor, product, version = struct.unpack('<IIL', parsed['payload'][:12])
                            device['vendor_id'] = vendor
                            device['product_id'] = product
                            device['version'] = version
                            device['capabilities'] = _get_product_capabilities(product)
                            responses_received += 1
                        except struct.error as e:
                            logging.debug(f"Failed to parse version info: {e}")
                        
                elif parsed['type'] == MSG_LIGHT_STATE:
                    # Device supports color
                    device['has_color'] = True
                    responses_received += 1
                    
            except socket.timeout:
                continue
            except Exception as e:
                logging.debug(f"Error getting device details: {e}")
                
        # Check for multizone capabilities
        if device.get('capabilities', {}).get('has_multizone'):
            zone_info = _get_multizone_info(protocol, ip, mac)
            if zone_info:
                device.update(zone_info)
                
        # Check for tile/matrix capabilities  
        if device.get('capabilities', {}).get('has_matrix'):
            tile_info = _get_tile_info(protocol, ip, mac)
            if tile_info:
                device.update(tile_info)
        
        # Log device discovery details
        logging.debug(f"Device details for {ip}: {device}")
                
        # Always return device since we have defaults
        return device
        
    except Exception as e:
        logging.error(f"Failed to get device details: {e}")
        return None


def _probe_device(protocol: LIFXProtocol, ip: str) -> Optional[Dict]:
    """Probe a specific IP for LIFX device"""
    try:
        # Send GetService to specific IP
        packet = protocol._build_header(MSG_GET_SERVICE, tagged=True)
        sock = protocol._get_socket_for_device(ip)
        sock.sendto(packet, (ip, LIFX_PORT))
        
        # Wait for response
        sock.settimeout(1.0)
        data, addr = sock.recvfrom(1024)
        parsed = protocol._parse_packet(data)
        
        if parsed and parsed['type'] == MSG_STATE_SERVICE:
            return _get_device_details(protocol, ip, parsed['target'])
            
    except Exception:
        pass
    return None


def _get_product_capabilities(product_id: int) -> Dict:
    """Get device capabilities based on product ID"""
    from .lifx_models import (
        MULTIZONE_PIDS, MATRIX_PIDS, EXTENDED_MZ_PIDS,
        get_product_info
    )
    
    caps = {
        'has_color': True,  # Most LIFX devices have color
        'has_multizone': product_id in MULTIZONE_PIDS,
        'has_matrix': product_id in MATRIX_PIDS,
        'has_chain': product_id in MATRIX_PIDS,
        'supports_extended_multizone': product_id in EXTENDED_MZ_PIDS
    }
    
    # Get specific product info
    info = get_product_info(product_id)
    if info:
        caps.update(info)
        
    return caps


def _get_multizone_info(protocol: LIFXProtocol, ip: str, mac: bytes) -> Dict:
    """Get multizone information from device"""
    try:
        info = {}
        
        # Try extended multizone first
        packet = protocol._build_header(MSG_GET_EXTENDED_COLOR_ZONES, target=mac)
        protocol._send_packet(packet, ip)
        
        # Also try regular multizone
        packet = protocol._build_header(MSG_GET_COLOR_ZONES, target=mac)
        payload = struct.pack('<BB', 0, 255)  # Get all zones
        # Update packet size
        total_size = LIFX_HEADER_SIZE + len(payload)
        full_packet = struct.pack('<H', total_size) + packet[2:] + payload
        protocol._send_packet(full_packet, ip)
        
        start_time = time.time()
        while time.time() - start_time < 1:
            try:
                data, addr = protocol.socket.recvfrom(2048)
                if addr[0] != ip:
                    continue
                    
                parsed = protocol._parse_packet(data)
                if not parsed:
                    continue
                    
                if parsed['type'] == MSG_STATE_EXTENDED_COLOR_ZONES:
                    info['supports_extended_multizone'] = True
                    if len(parsed['payload']) >= 8:
                        try:
                            zone_count = struct.unpack('<H', parsed['payload'][2:4])[0]
                            info['zone_count'] = zone_count
                        except struct.error as e:
                            logging.debug(f"Failed to parse extended zone count: {e}")
                        
                elif parsed['type'] == MSG_STATE_MULTI_ZONE:
                    if len(parsed['payload']) >= 2:
                        try:
                            zone_count = struct.unpack('<B', parsed['payload'][1:2])[0] + 1
                            if 'zone_count' not in info:
                                info['zone_count'] = zone_count
                        except struct.error as e:
                            logging.debug(f"Failed to parse zone count: {e}")
                            
            except socket.timeout:
                continue
            except Exception as e:
                logging.debug(f"Error getting multizone info: {e}")
                
        return info
        
    except Exception as e:
        logging.error(f"Failed to get multizone info: {e}")
        return {}


def _get_tile_info(protocol: LIFXProtocol, ip: str, mac: bytes) -> Dict:
    """Get tile/matrix information from device"""
    try:
        info = {}
        
        # Get device chain info
        packet = protocol._build_header(MSG_GET_DEVICE_CHAIN, target=mac)
        protocol._send_packet(packet, ip)
        
        start_time = time.time()
        while time.time() - start_time < 1:
            try:
                data, addr = protocol.socket.recvfrom(2048)
                if addr[0] != ip:
                    continue
                    
                parsed = protocol._parse_packet(data)
                if not parsed:
                    continue
                    
                if parsed['type'] == MSG_STATE_DEVICE_CHAIN:
                    if len(parsed['payload']) >= 5:
                        try:
                            tile_count = struct.unpack('<B', parsed['payload'][0:1])[0]
                            info['tile_count'] = tile_count
                            
                            # Parse tile dimensions (assuming uniform tiles)
                            if len(parsed['payload']) >= 55:  # Minimum for one tile
                                width = struct.unpack('<B', parsed['payload'][51:52])[0]
                                height = struct.unpack('<B', parsed['payload'][52:53])[0]
                                info['tile_width'] = width
                                info['tile_height'] = height
                                info['total_pixels'] = tile_count * width * height
                        except struct.error as e:
                            logging.debug(f"Failed to parse tile info: {e}")
                            
            except socket.timeout:
                continue
            except Exception as e:
                logging.debug(f"Error getting tile info: {e}")
                
        return info
        
    except Exception as e:
        logging.error(f"Failed to get tile info: {e}")
        return {}


def _convert_to_bridge_format(device: Dict) -> Dict:
    """Convert LIFX device info to bridge light format"""
    try:
        # Determine model ID based on capabilities
        modelid = "LCT015"  # Default color bulb
        
        if device.get('capabilities', {}).get('has_matrix'):
            modelid = "LCX002"  # Matrix/Tile device
        elif device.get('zone_count', 0) > 1:
            modelid = "LCX004"  # Multizone strip
        elif device.get('capabilities', {}).get('has_multizone'):
            modelid = "LST002"  # Light strip
            
        # Generate default name if not provided
        default_name = "LIFX Device"
        if 'mac' in device and device['mac']:
            try:
                default_name = f"LIFX {device['mac'][-6:]}"
            except (TypeError, IndexError):
                pass
        
        config = {
            "protocol": "lifx",
            "name": device.get('name', default_name),
            "modelid": modelid,
            "protocol_cfg": {
                "ip": device['ip'],
                "mac": device['mac'],
                "port": device.get('port', LIFX_PORT),
                "product_id": device.get('product_id', 0),
                "vendor_id": device.get('vendor_id', 1),
                "version": device.get('version', 0),
                "has_color": device.get('has_color', True),
                "has_multizone": device.get('capabilities', {}).get('has_multizone', False),
                "has_matrix": device.get('capabilities', {}).get('has_matrix', False),
                "zone_count": device.get('zone_count', 0),
                "tile_count": device.get('tile_count', 0),
                "tile_width": device.get('tile_width', 8),
                "tile_height": device.get('tile_height', 8),
                "supports_extended_multizone": device.get('supports_extended_multizone', False)
            }
        }
        
        return config
        
    except Exception as e:
        logging.error(f"Failed to convert device format: {e}")
        return None


def set_light(light, data):
    """Set light state for LIFX device"""
    try:
        protocol_cfg = light.protocol_cfg
        ip = protocol_cfg['ip']
        mac = bytes.fromhex(protocol_cfg['mac'])
        
        # Get or create protocol instance
        if ip not in Connections:
            Connections[ip] = LIFXProtocol()
        protocol = Connections[ip]
        
        # Handle different state changes
        if "on" in data:
            _set_power(protocol, ip, mac, data["on"])
            
        if any(k in data for k in ["bri", "xy", "ct", "hue", "sat"]):
            _set_color(protocol, ip, mac, light, data)
            
        if "gradient" in data and protocol_cfg.get('has_multizone'):
            _set_gradient(protocol, ip, mac, data["gradient"], protocol_cfg)
            
        # Store state in cache for optimization
        if ip not in DeviceCache:
            DeviceCache[ip] = {}
        DeviceCache[ip].update(data)
        
    except Exception as e:
        logging.error(f"Failed to set LIFX light: {e}")


def _set_power(protocol: LIFXProtocol, ip: str, mac: bytes, on: bool):
    """Set device power state"""
    try:
        power_level = 65535 if on else 0
        duration = 250  # 250ms transition
        
        packet = protocol._build_header(MSG_SET_LIGHT_POWER, target=mac, ack_required=False)
        payload = struct.pack('<HI', power_level, duration)
        # Update packet size properly
        total_size = LIFX_HEADER_SIZE + len(payload)
        full_packet = struct.pack('<H', total_size) + packet[2:] + payload
        
        protocol._send_packet(full_packet, ip)
        
    except Exception as e:
        logging.error(f"Failed to set power: {e}")


def _set_color(protocol: LIFXProtocol, ip: str, mac: bytes, light, data):
    """Set device color"""
    try:
        # Get current state from cache or defaults
        current = DeviceCache.get(ip, {})
        
        # Calculate HSBK values
        hue = 0
        saturation = 0
        brightness = int(data.get("bri", current.get("bri", 254)) * 257)  # Scale to 0-65535
        kelvin = 3500  # Default
        
        if "xy" in data:
            # Convert xy to HSB
            x, y = data["xy"]
            rgb = convert_xy((x, y), brightness / 257)
            hue, saturation, _ = _rgb_to_hsb(rgb[0], rgb[1], rgb[2])
            
        elif "ct" in data:
            # Color temperature mode
            mireds = data["ct"]
            kelvin = min(9000, max(2500, int(1000000 / mireds)))
            saturation = 0  # No saturation in CT mode
            
        elif "hue" in data or "sat" in data:
            # Direct hue/saturation
            hue = int(data.get("hue", current.get("hue", 0)) * 65535 / 65280)
            saturation = int(data.get("sat", current.get("sat", 0)) * 257)
            
        # Duration for smooth transitions
        duration = 100 if RAPID_MODE else 250
        
        # Build SetColor packet
        packet = protocol._build_header(MSG_SET_COLOR, target=mac, ack_required=False)
        payload = struct.pack('<BHHHHHI',
            0,  # reserved
            hue, saturation, brightness, kelvin,
            duration
        )
        # Update packet size properly
        total_size = LIFX_HEADER_SIZE + len(payload)
        full_packet = struct.pack('<H', total_size) + packet[2:] + payload
        
        protocol._send_packet(full_packet, ip)
        
    except Exception as e:
        logging.error(f"Failed to set color: {e}")


def _set_gradient(protocol: LIFXProtocol, ip: str, mac: bytes, gradient: Dict, cfg: Dict):
    """Set gradient for multizone devices"""
    try:
        points = gradient.get("points", [])
        if not points:
            return
            
        zone_count = cfg.get('zone_count', 16)
        
        # Calculate colors for each zone based on gradient points
        zones = []
        for i in range(zone_count):
            position = i / (zone_count - 1) if zone_count > 1 else 0
            color = _interpolate_gradient(points, position)
            zones.append(color)
            
        # Use extended multizone if supported and beneficial
        if cfg.get('supports_extended_multizone') and zone_count > 8:
            _set_extended_multizone(protocol, ip, mac, zones)
        else:
            _set_multizone(protocol, ip, mac, zones)
            
    except Exception as e:
        logging.error(f"Failed to set gradient: {e}")


def _set_multizone(protocol: LIFXProtocol, ip: str, mac: bytes, zones: List[Tuple[int, int, int, int]]):
    """Set colors for multizone device"""
    try:
        # Send in chunks of 8 zones (standard multizone)
        for start_idx in range(0, len(zones), 8):
            end_idx = min(start_idx + 7, len(zones) - 1)
            
            # Build packet
            packet = protocol._build_header(MSG_SET_COLOR_ZONES, target=mac, ack_required=False)
            
            # Apply flag (0=NO_APPLY, 1=APPLY, 2=APPLY_ONLY) 
            apply = 1 if end_idx == len(zones) - 1 else 0
            
            payload = struct.pack('<BB', start_idx, end_idx)
            payload += struct.pack('<HHHHI', *zones[start_idx], 100)  # Duration 100ms
            payload += struct.pack('<B', apply)
            
            # Update packet size properly
            total_size = LIFX_HEADER_SIZE + len(payload)
            full_packet = struct.pack('<H', total_size) + packet[2:] + payload
            protocol._send_packet(full_packet, ip)
            
    except Exception as e:
        logging.error(f"Failed to set multizone: {e}")


def _set_extended_multizone(protocol: LIFXProtocol, ip: str, mac: bytes, zones: List[Tuple[int, int, int, int]]):
    """Set colors using extended multizone (up to 82 zones per packet)"""
    try:
        MAX_ZONES_PER_PACKET = 82
        
        for start_idx in range(0, len(zones), MAX_ZONES_PER_PACKET):
            chunk = zones[start_idx:start_idx + MAX_ZONES_PER_PACKET]
            
            # Build packet
            packet = protocol._build_header(MSG_SET_EXTENDED_COLOR_ZONES, target=mac, ack_required=False)
            
            # Duration and apply flag
            duration = 100
            apply = 1 if start_idx + len(chunk) >= len(zones) else 0
            
            payload = struct.pack('<I', duration)
            payload += struct.pack('<B', apply)
            payload += struct.pack('<H', start_idx)
            payload += struct.pack('<B', len(chunk))
            
            # Add zone colors
            for hue, sat, bri, kelvin in chunk:
                payload += struct.pack('<HHHH', hue, sat, bri, kelvin)
                
            # Update packet size properly
            total_size = LIFX_HEADER_SIZE + len(payload)
            full_packet = struct.pack('<H', total_size) + packet[2:] + payload
            protocol._send_packet(full_packet, ip)
            
    except Exception as e:
        logging.error(f"Failed to set extended multizone: {e}")


def _interpolate_gradient(points: List[Dict], position: float) -> Tuple[int, int, int, int]:
    """Interpolate color from gradient points"""
    if not points:
        return (0, 0, 65535, 3500)  # White default
        
    # Sort points by position
    sorted_points = sorted(points, key=lambda p: p.get('position', 0))
    
    # Find surrounding points
    prev_point = sorted_points[0]
    next_point = sorted_points[-1]
    
    for point in sorted_points:
        if point['position'] <= position:
            prev_point = point
        if point['position'] >= position:
            next_point = point
            break
            
    # Interpolate between points
    if prev_point == next_point:
        color = prev_point['color']
    else:
        t = (position - prev_point['position']) / (next_point['position'] - prev_point['position'])
        color = {
            'r': prev_point['color']['r'] + t * (next_point['color']['r'] - prev_point['color']['r']),
            'g': prev_point['color']['g'] + t * (next_point['color']['g'] - prev_point['color']['g']),
            'b': prev_point['color']['b'] + t * (next_point['color']['b'] - prev_point['color']['b'])
        }
        
    # Convert RGB to HSBK
    hue, sat, bri = _rgb_to_hsb(
        int(color['r'] * 255),
        int(color['g'] * 255),
        int(color['b'] * 255)
    )
    
    return (hue, sat, bri, 3500)


def _rgb_to_hsb(r: int, g: int, b: int) -> Tuple[int, int, int]:
    """Convert RGB (0-255) to LIFX HSB (0-65535)"""
    r_norm = r / 255.0
    g_norm = g / 255.0
    b_norm = b / 255.0
    
    max_val = max(r_norm, g_norm, b_norm)
    min_val = min(r_norm, g_norm, b_norm)
    diff = max_val - min_val
    
    # Brightness
    brightness = int(max_val * 65535)
    
    # Saturation
    if max_val == 0:
        saturation = 0
    else:
        saturation = int((diff / max_val) * 65535)
        
    # Hue
    if diff == 0:
        hue = 0
    elif max_val == r_norm:
        hue = (60 * ((g_norm - b_norm) / diff) + 360) % 360
    elif max_val == g_norm:
        hue = (60 * ((b_norm - r_norm) / diff) + 120) % 360
    else:
        hue = (60 * ((r_norm - g_norm) / diff) + 240) % 360
        
    hue_uint16 = int((65535 * hue / 360)) % 65536
    
    return (hue_uint16, saturation, brightness)


def entertainmentMode(lights, entertainmentData):
    """High-performance entertainment mode for LIFX devices"""
    try:
        # Group lights by IP for batch processing
        lights_by_ip = defaultdict(list)
        for light in lights:
            if light.protocol == "lifx":
                lights_by_ip[light.protocol_cfg['ip']].append(light)
                
        # Process each device group
        for ip, device_lights in lights_by_ip.items():
            _process_entertainment_batch(ip, device_lights, entertainmentData)
            
    except Exception as e:
        logging.error(f"Entertainment mode error: {e}")


def _process_entertainment_batch(ip: str, lights: List, data: bytes):
    """Process entertainment data for a batch of lights on same device"""
    try:
        if ip not in Connections:
            Connections[ip] = LIFXProtocol()
        protocol = Connections[ip]
        
        # Parse entertainment data
        light_data = _parse_entertainment_data(data)
        
        # Rate limiting for high FPS
        now = time.time()
        limiter = _rate_limiters[ip]
        if now - limiter["last_send"] < FRAME_INTERVAL:
            return  # Skip frame to maintain FPS limit
            
        # Process each light
        for light in lights:
            light_id = int(light.light_id)
            if light_id in light_data:
                color_data = light_data[light_id]
                mac = bytes.fromhex(light.protocol_cfg['mac'])
                
                # Convert and send color update
                _send_rapid_color(protocol, ip, mac, color_data)
                
        # Update rate limiter
        limiter["last_send"] = now
        limiter["count"] += 1
        
    except Exception as e:
        logging.error(f"Failed to process entertainment batch: {e}")


def _parse_entertainment_data(data: bytes) -> Dict:
    """Parse entertainment protocol data"""
    light_data = {}
    
    try:
        # Entertainment format: [light_id(1), r(2), g(2), b(2), padding(2)]...
        offset = 0
        while offset + 9 <= len(data):
            try:
                light_id = data[offset]
                r = struct.unpack('>H', data[offset+1:offset+3])[0]
                g = struct.unpack('>H', data[offset+3:offset+5])[0]
                b = struct.unpack('>H', data[offset+5:offset+7])[0]
                
                light_data[light_id] = (r, g, b)
            except struct.error as e:
                logging.debug(f"Failed to parse entertainment data: {e}")
            offset += 9
            
    except Exception as e:
        logging.debug(f"Failed to parse entertainment data: {e}")
        
    return light_data


def _send_rapid_color(protocol: LIFXProtocol, ip: str, mac: bytes, color: Tuple[int, int, int]):
    """Send rapid color update for entertainment mode"""
    try:
        # Convert RGB to HSB
        r = (color[0] >> 8) if color[0] > 255 else color[0]
        g = (color[1] >> 8) if color[1] > 255 else color[1]
        b = (color[2] >> 8) if color[2] > 255 else color[2]
        
        hue, sat, bri = _rgb_to_hsb(r, g, b)
        
        # Build rapid SetColor packet (no ACK for speed)
        packet = protocol._build_header(MSG_SET_COLOR, target=mac, ack_required=False)
        payload = struct.pack('<BHHHHHI',
            0,  # reserved
            hue, sat, bri, 3500,  # Default kelvin
            0  # 0ms duration for instant change
        )
        
        # Use socket pool for performance
        sock = protocol._get_socket_for_device(ip)
        # Update packet size properly
        total_size = LIFX_HEADER_SIZE + len(payload)
        full_packet = struct.pack('<H', total_size) + packet[2:] + payload
        sock.sendto(full_packet, (ip, LIFX_PORT))
        
    except Exception as e:
        logging.debug(f"Rapid color send error: {e}")


def get_light_state(light):
    """Get current light state"""
    try:
        protocol_cfg = light.protocol_cfg
        ip = protocol_cfg['ip']
        mac = bytes.fromhex(protocol_cfg['mac'])
        
        if ip not in Connections:
            Connections[ip] = LIFXProtocol()
        protocol = Connections[ip]
        
        # Send GetColor request
        packet = protocol._build_header(MSG_GET_COLOR, target=mac, res_required=True)
        protocol._send_packet(packet, ip)
        
        # Wait for response
        start_time = time.time()
        while time.time() - start_time < 1:
            try:
                data, addr = protocol.socket.recvfrom(1024)
                if addr[0] != ip:
                    continue
                    
                parsed = protocol._parse_packet(data)
                if parsed and parsed['type'] == MSG_LIGHT_STATE:
                    return _parse_light_state(parsed['payload'])
                    
            except socket.timeout:
                continue
                
    except Exception as e:
        logging.error(f"Failed to get light state: {e}")
        
    return {}


def _parse_light_state(payload: bytes) -> Dict:
    """Parse LightState message payload"""
    try:
        if len(payload) < 52:
            return {}
            
        try:
            hue, sat, bri, kelvin = struct.unpack('<HHHH', payload[0:8])
            power = struct.unpack('<H', payload[10:12])[0]
        except struct.error as e:
            logging.debug(f"Failed to parse light state: {e}")
            return {}
        label = payload[12:44].decode('utf-8', errors='ignore').rstrip('\x00')
        
        # Convert to bridge format
        state = {
            "on": power > 0,
            "bri": int(bri / 257),  # Scale to 0-254
            "hue": int(hue * 65280 / 65535),  # Scale to Hue range
            "sat": int(sat / 257),  # Scale to 0-254
            "ct": int(1000000 / kelvin) if kelvin > 0 else 153,
            "colormode": "ct" if sat == 0 else "hs",
            "reachable": True
        }
        
        # Convert HSB to xy
        if sat > 0:
            rgb = _hsb_to_rgb(hue, sat, bri)
            xy = convert_rgb_xy(rgb)
            state["xy"] = xy
            
        return state
        
    except Exception as e:
        logging.error(f"Failed to parse light state: {e}")
        return {}


def _hsb_to_rgb(hue: int, sat: int, bri: int) -> Tuple[int, int, int]:
    """Convert LIFX HSB (0-65535) to RGB (0-255)"""
    h = (hue / 65535) * 360
    s = sat / 65535
    v = bri / 65535  # Use 'v' for value/brightness to avoid shadowing
    
    if s == 0:
        r = g = b = int(v * 255)
    else:
        def hue_to_rgb(p, q, t):
            if t < 0: t += 1
            if t > 1: t -= 1
            if t < 1/6: return p + (q - p) * 6 * t
            if t < 1/2: return q
            if t < 2/3: return p + (q - p) * (2/3 - t) * 6
            return p
            
        q = v * (1 + s) if v < 0.5 else v + s - v * s
        p = 2 * v - q
        h_norm = h / 360
        
        r_val = hue_to_rgb(p, q, h_norm + 1/3)
        g_val = hue_to_rgb(p, q, h_norm)
        b_val = hue_to_rgb(p, q, h_norm - 1/3)
        
        r = int(r_val * 255)
        g = int(g_val * 255)
        b = int(b_val * 255)
        
    return (r, g, b)


def cleanup():
    """Cleanup resources"""
    global Connections, SocketPool
    
    for protocol in Connections.values():
        try:
            protocol.cleanup()
        except:
            pass
            
    for sock in SocketPool.values():
        try:
            sock.close()
        except:
            pass
            
    Connections.clear()
    SocketPool.clear()
    DeviceCache.clear()


