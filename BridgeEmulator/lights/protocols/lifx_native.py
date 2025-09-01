"""
LIFX Native LAN Protocol Implementation
Implements LIFX LAN protocol from scratch without any external LIFX libraries
Supports: Color bulbs, MultiZone strips, Matrix/Tile devices

Protocol Specification: https://lan.developer.lifx.com/docs/
"""

import socket
import struct
import time
import threading
import colorsys
import logManager
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, field

logging = logManager.logger.get_logger(__name__)
from datetime import datetime, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock, RLock
import random
import ipaddress

# ================================================================================
# LIFX Protocol Constants
# ================================================================================

# Default UDP port for LIFX
LIFX_PORT = 56700

# Protocol version (must be 1024)
PROTOCOL_VERSION = 1024

# Message Types
class MessageType:
    # Device messages
    GET_SERVICE = 2
    STATE_SERVICE = 3
    GET_HOST_INFO = 12
    STATE_HOST_INFO = 13
    GET_HOST_FIRMWARE = 14
    STATE_HOST_FIRMWARE = 15
    GET_WIFI_INFO = 16
    STATE_WIFI_INFO = 17
    GET_WIFI_FIRMWARE = 18
    STATE_WIFI_FIRMWARE = 19
    GET_POWER = 20
    SET_POWER = 21
    STATE_POWER = 22
    GET_LABEL = 23
    SET_LABEL = 24
    STATE_LABEL = 25
    GET_VERSION = 32
    STATE_VERSION = 33
    GET_INFO = 34
    STATE_INFO = 35
    ACKNOWLEDGEMENT = 45
    GET_LOCATION = 48
    SET_LOCATION = 49
    STATE_LOCATION = 50
    GET_GROUP = 51
    SET_GROUP = 52
    STATE_GROUP = 53
    ECHO_REQUEST = 58
    ECHO_RESPONSE = 59
    
    # Light messages
    GET_COLOR = 101
    SET_COLOR = 102
    SET_WAVEFORM = 103
    GET_LIGHT_POWER = 116
    SET_LIGHT_POWER = 117
    STATE_LIGHT_POWER = 118
    GET_INFRARED = 120
    STATE_INFRARED = 121
    SET_INFRARED = 122
    LIGHT_STATE = 107
    
    # MultiZone messages
    SET_COLOR_ZONES = 501
    GET_COLOR_ZONES = 502
    STATE_ZONE = 503
    STATE_MULTI_ZONE = 506
    GET_MULTIZONE_EFFECT = 507
    SET_MULTIZONE_EFFECT = 508
    STATE_MULTIZONE_EFFECT = 509
    SET_EXTENDED_COLOR_ZONES = 510
    GET_EXTENDED_COLOR_ZONES = 511
    STATE_EXTENDED_COLOR_ZONES = 512
    
    # Tile/Matrix messages
    GET_DEVICE_CHAIN = 701
    STATE_DEVICE_CHAIN = 702
    SET_USER_POSITION = 703
    GET_TILE_STATE64 = 707
    SET_TILE_STATE64 = 709
    STATE_TILE_STATE64 = 711
    GET_TILE_EFFECT = 718
    SET_TILE_EFFECT = 719
    STATE_TILE_EFFECT = 720

# Product IDs for device identification
class ProductID:
    # Bulbs
    ORIGINAL_1000 = 1
    COLOR_650 = 3
    WHITE_800 = 10
    WHITE_800_LOW_VOLTAGE = 11
    WHITE_900_BR30 = 18
    COLOR_1000_BR30 = 20
    COLOR_1000 = 22
    LIFX_A19 = 27
    LIFX_BR30 = 28
    LIFX_PLUS_A19 = 29
    LIFX_PLUS_BR30 = 30
    LIFX_Z = 31  # MultiZone strip
    LIFX_Z_2 = 32  # MultiZone strip
    LIFX_DOWNLIGHT = 36
    LIFX_DOWNLIGHT_2 = 37
    LIFX_BEAM = 38  # MultiZone
    LIFX_A19_2 = 43
    LIFX_BR30_2 = 44
    LIFX_PLUS_A19_2 = 45
    LIFX_PLUS_BR30_2 = 46
    LIFX_MINI = 49
    LIFX_MINI_DAY_DUSK = 50
    LIFX_MINI_WHITE = 51
    LIFX_GU10 = 52
    LIFX_TILE = 55  # Matrix
    LIFX_CANDLE = 57  # Matrix
    LIFX_MINI_2 = 59
    LIFX_MINI_DAY_DUSK_2 = 60
    LIFX_MINI_WHITE_2 = 61
    LIFX_A19_3 = 62
    LIFX_BR30_3 = 63
    LIFX_A19_PLUS_3 = 64
    LIFX_BR30_PLUS_3 = 65
    LIFX_CANDLE_2 = 68  # Matrix
    LIFX_CEILING = 99  # Matrix
    LIFX_CEILING_2 = 100  # Matrix
    LIFX_NEON = 81  # MultiZone flex
    LIFX_SWITCH = 89
    LIFX_STRING = 145  # Matrix-like
    
# Waveform types for effects
class Waveform:
    SAW = 0
    SINE = 1
    HALF_SINE = 2
    TRIANGLE = 3
    PULSE = 4

# ================================================================================
# Packet Structure Classes
# ================================================================================

@dataclass
class LifxHeader:
    """LIFX packet header (36 bytes)"""
    # Frame (8 bytes)
    size: int = 0  # Total packet size
    protocol: int = PROTOCOL_VERSION
    addressable: bool = True
    tagged: bool = False
    origin: int = 0
    source: int = 0  # Unique identifier for client
    
    # Frame Address (16 bytes)
    target: bytes = b'\x00' * 8  # MAC address or all zeros for broadcast
    reserved1: bytes = b'\x00' * 6
    res_required: bool = False
    ack_required: bool = False
    reserved2: int = 0
    sequence: int = 0
    
    # Protocol Header (12 bytes)
    reserved3: bytes = b'\x00' * 8
    type: int = 0  # Message type
    reserved4: bytes = b'\x00' * 2
    
    def pack(self) -> bytes:
        """Pack header into 36-byte binary format"""
        # Frame
        frame = 0
        frame |= (self.size & 0xFFFF)
        frame |= ((self.protocol & 0xFFF) << 16)
        frame |= ((1 if self.addressable else 0) << 28)
        frame |= ((1 if self.tagged else 0) << 29)
        frame |= ((self.origin & 0x3) << 30)
        
        # Frame Address flags
        flags = 0
        flags |= (1 if self.res_required else 0)
        flags |= ((1 if self.ack_required else 0) << 1)
        flags |= ((self.reserved2 & 0x3F) << 2)
        
        # Pack header
        header = struct.pack(
            '<I I 8s 6s B B 8s H 2s',
            frame,
            self.source,
            self.target,
            self.reserved1,
            flags,
            self.sequence & 0xFF,
            self.reserved3,
            self.type,
            self.reserved4
        )
        
        return header
    
    @classmethod
    def unpack(cls, data: bytes) -> 'LifxHeader':
        """Unpack header from binary data"""
        if len(data) < 36:
            raise ValueError(f"Header too short: {len(data)} bytes")
        
        # Unpack binary data
        frame, source, target, reserved1, flags, sequence, reserved3, msg_type, reserved4 = struct.unpack(
            '<I I 8s 6s B B 8s H 2s',
            data[:36]
        )
        
        # Extract frame fields
        size = frame & 0xFFFF
        protocol = (frame >> 16) & 0xFFF
        addressable = bool((frame >> 28) & 1)
        tagged = bool((frame >> 29) & 1)
        origin = (frame >> 30) & 0x3
        
        # Extract flags
        res_required = bool(flags & 1)
        ack_required = bool((flags >> 1) & 1)
        reserved2 = (flags >> 2) & 0x3F
        
        return cls(
            size=size,
            protocol=protocol,
            addressable=addressable,
            tagged=tagged,
            origin=origin,
            source=source,
            target=target,
            reserved1=reserved1,
            res_required=res_required,
            ack_required=ack_required,
            reserved2=reserved2,
            sequence=sequence,
            reserved3=reserved3,
            type=msg_type,
            reserved4=reserved4
        )

@dataclass
class LifxPacket:
    """Complete LIFX packet with header and payload"""
    header: LifxHeader
    payload: bytes = b''
    
    def pack(self) -> bytes:
        """Pack complete packet for transmission"""
        # Update header size
        self.header.size = 36 + len(self.payload)
        
        # Pack header and payload
        return self.header.pack() + self.payload
    
    @classmethod
    def unpack(cls, data: bytes) -> 'LifxPacket':
        """Unpack packet from binary data"""
        if len(data) < 36:
            raise ValueError(f"Packet too short: {len(data)} bytes")
        
        # Unpack header
        header = LifxHeader.unpack(data)
        
        # Extract payload
        payload = data[36:header.size] if header.size > 36 else b''
        
        return cls(header=header, payload=payload)

# ================================================================================
# Message Payload Classes
# ================================================================================

class PayloadPacker:
    """Helper class for packing/unpacking message payloads"""
    
    @staticmethod
    def pack_hsbk(hue: int, saturation: int, brightness: int, kelvin: int) -> bytes:
        """Pack HSBK color values (8 bytes)"""
        return struct.pack('<HHHH', 
                          hue & 0xFFFF, 
                          saturation & 0xFFFF, 
                          brightness & 0xFFFF, 
                          kelvin & 0xFFFF)
    
    @staticmethod
    def unpack_hsbk(data: bytes) -> Tuple[int, int, int, int]:
        """Unpack HSBK color values"""
        if len(data) < 8:
            raise ValueError("HSBK data too short")
        return struct.unpack('<HHHH', data[:8])
    
    @staticmethod
    def pack_string(text: str, length: int) -> bytes:
        """Pack string with fixed length padding"""
        encoded = text.encode('utf-8')[:length]
        return encoded + b'\x00' * (length - len(encoded))
    
    @staticmethod
    def unpack_string(data: bytes) -> str:
        """Unpack null-terminated string"""
        null_idx = data.find(b'\x00')
        if null_idx >= 0:
            data = data[:null_idx]
        return data.decode('utf-8', errors='ignore')

# ================================================================================
# Device Management
# ================================================================================

@dataclass
class LifxDevice:
    """Represents a discovered LIFX device"""
    mac: str
    ip: str
    port: int = LIFX_PORT
    label: str = ""
    group: str = ""
    location: str = ""
    product_id: int = 0
    vendor_id: int = 0
    version: int = 0
    firmware: str = ""
    last_seen: datetime = field(default_factory=datetime.now)
    capabilities: Dict[str, Any] = field(default_factory=dict)
    
    # Device state cache
    power: int = 0
    color: Tuple[int, int, int, int] = (0, 0, 0, 3500)  # HSBK
    infrared: int = 0
    zones: List[Tuple[int, int, int, int]] = field(default_factory=list)
    
    @property
    def is_multizone(self) -> bool:
        """Check if device supports multizone"""
        return self.product_id in [
            ProductID.LIFX_Z, ProductID.LIFX_Z_2, 
            ProductID.LIFX_BEAM, ProductID.LIFX_NEON
        ]
    
    @property
    def is_matrix(self) -> bool:
        """Check if device is matrix/tile"""
        return self.product_id in [
            ProductID.LIFX_TILE, ProductID.LIFX_CANDLE, ProductID.LIFX_CANDLE_2,
            ProductID.LIFX_CEILING, ProductID.LIFX_CEILING_2, ProductID.LIFX_STRING
        ]
    
    @property
    def zone_count(self) -> int:
        """Get number of zones for multizone devices"""
        zone_counts = {
            ProductID.LIFX_Z: 16,
            ProductID.LIFX_Z_2: 16,
            ProductID.LIFX_BEAM: 8,
            ProductID.LIFX_NEON: 48,
        }
        return zone_counts.get(self.product_id, 1)
    
    @property
    def matrix_dimensions(self) -> Tuple[int, int]:
        """Get matrix dimensions (width, height)"""
        dimensions = {
            ProductID.LIFX_TILE: (8, 8),
            ProductID.LIFX_CANDLE: (6, 5),  # 26 zones
            ProductID.LIFX_CANDLE_2: (6, 5),
            ProductID.LIFX_CEILING: (8, 8),  # Varies by model
            ProductID.LIFX_CEILING_2: (10, 12),
            ProductID.LIFX_STRING: (16, 1),  # Linear arrangement
        }
        return dimensions.get(self.product_id, (1, 1))

# ================================================================================
# LIFX Protocol Implementation
# ================================================================================

class LifxProtocol:
    """Core LIFX LAN protocol implementation"""
    
    def __init__(self):
        self.sock: Optional[socket.socket] = None
        self.source_id = random.randint(2, 2**32 - 1)
        self.sequence = 0
        self.sequence_lock = Lock()
        self.devices: Dict[str, LifxDevice] = {}
        self.device_lock = RLock()
        self.executor = ThreadPoolExecutor(max_workers=20)
        
        # Entertainment mode state
        self.entertainment_mode = False
        self.frame_limit = 30  # FPS
        self.last_update: Dict[str, float] = {}
        
        # Keep-alive state
        self.keepalive_thread: Optional[threading.Thread] = None
        self.keepalive_running = False
        self.keepalive_interval = 45  # seconds
        
        # Initialize socket
        self._init_socket()
    
    def _init_socket(self):
        """Initialize UDP socket for LIFX communication"""
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self.sock.settimeout(0.5)
        
        # Bind to any available port
        self.sock.bind(('', 0))
    
    def _get_sequence(self) -> int:
        """Get next sequence number"""
        with self.sequence_lock:
            self.sequence = (self.sequence + 1) & 0xFF
            return self.sequence
    
    def _create_header(self, msg_type: int, target: Optional[str] = None, 
                      tagged: bool = False, res_required: bool = False,
                      ack_required: bool = False) -> LifxHeader:
        """Create a LIFX packet header"""
        header = LifxHeader()
        header.source = self.source_id
        header.sequence = self._get_sequence()
        header.type = msg_type
        header.tagged = tagged
        header.res_required = res_required
        header.ack_required = ack_required
        
        if target:
            # Convert MAC address to bytes
            if ':' in target:
                mac_bytes = bytes.fromhex(target.replace(':', ''))
                header.target = mac_bytes + b'\x00' * (8 - len(mac_bytes))
            else:
                header.target = bytes.fromhex(target)
        else:
            # Broadcast
            header.target = b'\x00' * 8
            header.tagged = True
        
        return header
    
    def _send_packet(self, packet: LifxPacket, ip: str, port: int = LIFX_PORT) -> None:
        """Send packet to device"""
        data = packet.pack()
        self.sock.sendto(data, (ip, port))
    
    def _receive_packet(self, timeout: float = 1.0) -> Optional[Tuple[LifxPacket, Tuple[str, int]]]:
        """Receive packet with timeout"""
        self.sock.settimeout(timeout)
        try:
            data, addr = self.sock.recvfrom(1024)
            packet = LifxPacket.unpack(data)
            return packet, addr
        except (socket.timeout, Exception):
            return None
    
    # ================================================================================
    # Discovery
    # ================================================================================
    
    def discover_broadcast(self, timeout: float = 3.0) -> List[LifxDevice]:
        """Discover devices using broadcast"""
        # Create GetService packet
        header = self._create_header(
            MessageType.GET_SERVICE,
            tagged=True,
            res_required=True
        )
        packet = LifxPacket(header=header)
        
        # Send broadcast
        self._send_packet(packet, '255.255.255.255')
        
        # Collect responses
        devices = []
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            result = self._receive_packet(0.5)
            if result:
                packet, (ip, port) = result
                if packet.header.type == MessageType.STATE_SERVICE:
                    # Parse StateService
                    service, port_num = struct.unpack('<BI', packet.payload[:5])
                    
                    # Extract MAC from target
                    mac = ':'.join(f'{b:02x}' for b in packet.header.target[:6])
                    
                    device = LifxDevice(
                        mac=mac,
                        ip=ip,
                        port=port_num
                    )
                    
                    # Get additional device info
                    self._get_device_info(device)
                    
                    devices.append(device)
                    
                    with self.device_lock:
                        self.devices[mac] = device
        
        return devices
    
    def discover_unicast(self, ip: str) -> Optional[LifxDevice]:
        """Discover specific device by IP"""
        # Create GetService packet
        header = self._create_header(
            MessageType.GET_SERVICE,
            tagged=True,
            res_required=True
        )
        packet = LifxPacket(header=header)
        
        # Send to specific IP
        self._send_packet(packet, ip)
        
        # Wait for response
        result = self._receive_packet(1.0)
        if result:
            packet, addr = result
            if packet.header.type == MessageType.STATE_SERVICE:
                # Parse StateService
                service, port_num = struct.unpack('<BI', packet.payload[:5])
                
                # Extract MAC
                mac = ':'.join(f'{b:02x}' for b in packet.header.target[:6])
                
                device = LifxDevice(
                    mac=mac,
                    ip=ip,
                    port=port_num
                )
                
                # Get additional device info
                self._get_device_info(device)
                
                with self.device_lock:
                    self.devices[mac] = device
                
                return device
        
        return None
    
    def discover_subnet(self, subnet: str = "192.168.1.0/24") -> List[LifxDevice]:
        """Scan subnet for LIFX devices with optimized unicast discovery"""
        devices = []
        network = ipaddress.ip_network(subnet, strict=False)
        
        # Use a smaller socket timeout for faster scanning
        original_timeout = self.sock.gettimeout()
        self.sock.settimeout(0.2)  # 200ms timeout for subnet scanning
        
        try:
            # Parallel scanning with optimized batch size
            batch_size = 30  # Smaller batches for better timeout handling
            hosts = list(network.hosts())
            total_hosts = len(hosts)
            
            logging.debug(f"LIFX Native: Scanning {total_hosts} hosts in subnet {subnet}")
            
            # Process in batches to avoid overwhelming the network
            for i in range(0, total_hosts, batch_size):
                batch = hosts[i:i+batch_size]
                batch_futures = []
                
                # Submit batch of discovery tasks
                for ip in batch:
                    future = self.executor.submit(self._discover_unicast_quick, str(ip))
                    batch_futures.append((str(ip), future))
                
                # Collect results from batch with short timeout
                for ip, future in batch_futures:
                    try:
                        device = future.result(timeout=0.3)
                        if device:
                            devices.append(device)
                            logging.debug(f"LIFX Native: Found device at {ip}")
                    except Exception:
                        # Silently skip non-LIFX IPs
                        pass
                
                # Small delay between batches to avoid network flooding
                if i + batch_size < total_hosts:
                    time.sleep(0.05)
        
        finally:
            # Restore original timeout
            self.sock.settimeout(original_timeout)
        
        return devices
    
    def _discover_unicast_quick(self, ip: str) -> Optional[LifxDevice]:
        """Quick unicast discovery for subnet scanning"""
        # Create a temporary socket for this specific IP
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.2)  # Very short timeout for quick scanning
        
        try:
            # Create GetService packet
            header = self._create_header(
                MessageType.GET_SERVICE,
                tagged=True,
                res_required=True
            )
            packet = LifxPacket(header=header)
            data = packet.pack()
            
            # Send to specific IP
            sock.sendto(data, (ip, LIFX_PORT))
            
            # Wait for response
            response_data, addr = sock.recvfrom(1024)
            response_packet = LifxPacket.unpack(response_data)
            
            if response_packet.header.type == MessageType.STATE_SERVICE:
                # Parse StateService
                service, port_num = struct.unpack('<BI', response_packet.payload[:5])
                
                # Extract MAC
                mac = ':'.join(f'{b:02x}' for b in response_packet.header.target[:6])
                
                device = LifxDevice(
                    mac=mac,
                    ip=ip,
                    port=port_num
                )
                
                # Don't get additional info during subnet scan (too slow)
                # That will be done later if needed
                
                return device
        
        except (socket.timeout, socket.error):
            return None
        finally:
            sock.close()
        
        return None
    
    def _get_device_info(self, device: LifxDevice) -> None:
        """Get detailed device information"""
        # Get label
        header = self._create_header(
            MessageType.GET_LABEL,
            target=device.mac,
            res_required=True
        )
        packet = LifxPacket(header=header)
        self._send_packet(packet, device.ip)
        
        result = self._receive_packet(0.5)
        if result and result[0].header.type == MessageType.STATE_LABEL:
            device.label = PayloadPacker.unpack_string(result[0].payload[:32])
        
        # Get version
        header = self._create_header(
            MessageType.GET_VERSION,
            target=device.mac,
            res_required=True
        )
        packet = LifxPacket(header=header)
        self._send_packet(packet, device.ip)
        
        result = self._receive_packet(0.5)
        if result and result[0].header.type == MessageType.STATE_VERSION:
            vendor, product, version = struct.unpack('<III', result[0].payload[:12])
            device.vendor_id = vendor
            device.product_id = product
            device.version = version
        
        # Get current color
        header = self._create_header(
            MessageType.GET_COLOR,
            target=device.mac,
            res_required=True
        )
        packet = LifxPacket(header=header)
        self._send_packet(packet, device.ip)
        
        result = self._receive_packet(0.5)
        if result and result[0].header.type == MessageType.LIGHT_STATE:
            device.color = PayloadPacker.unpack_hsbk(result[0].payload[:8])
            device.power = struct.unpack('<H', result[0].payload[10:12])[0]
    
    # ================================================================================
    # Device Control - Basic
    # ================================================================================
    
    def set_power(self, device: LifxDevice, power: bool, duration: int = 0) -> bool:
        """Set device power state"""
        level = 65535 if power else 0
        payload = struct.pack('<HI', level, duration)
        
        header = self._create_header(
            MessageType.SET_POWER,
            target=device.mac,
            ack_required=True
        )
        packet = LifxPacket(header=header, payload=payload)
        
        self._send_packet(packet, device.ip)
        
        # Update cache
        device.power = level
        
        # Wait for ACK if not in entertainment mode
        if not self.entertainment_mode:
            result = self._receive_packet(0.5)
            return result is not None and result[0].header.type == MessageType.ACKNOWLEDGEMENT
        
        return True
    
    def set_color(self, device: LifxDevice, hue: int, saturation: int, 
                  brightness: int, kelvin: int, duration: int = 0) -> bool:
        """Set device color (HSBK)"""
        # Pack HSBK and duration
        payload = PayloadPacker.pack_hsbk(hue, saturation, brightness, kelvin)
        payload += struct.pack('<I', duration)
        
        header = self._create_header(
            MessageType.SET_COLOR,
            target=device.mac,
            ack_required=not self.entertainment_mode
        )
        packet = LifxPacket(header=header, payload=payload)
        
        self._send_packet(packet, device.ip)
        
        # Update cache
        device.color = (hue, saturation, brightness, kelvin)
        
        # Wait for ACK if not in entertainment mode
        if not self.entertainment_mode:
            result = self._receive_packet(0.5)
            return result is not None and result[0].header.type == MessageType.ACKNOWLEDGEMENT
        
        return True
    
    def set_color_rgb(self, device: LifxDevice, r: int, g: int, b: int, 
                      duration: int = 0) -> bool:
        """Set device color from RGB values"""
        # Convert RGB to HSV
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        
        # Convert to LIFX scale
        hue = int(h * 65535)
        saturation = int(s * 65535)
        brightness = int(v * 65535)
        
        return self.set_color(device, hue, saturation, brightness, 3500, duration)
    
    def get_color(self, device: LifxDevice) -> Optional[Tuple[int, int, int, int]]:
        """Get current device color"""
        header = self._create_header(
            MessageType.GET_COLOR,
            target=device.mac,
            res_required=True
        )
        packet = LifxPacket(header=header)
        
        self._send_packet(packet, device.ip)
        
        result = self._receive_packet(1.0)
        if result and result[0].header.type == MessageType.LIGHT_STATE:
            color = PayloadPacker.unpack_hsbk(result[0].payload[:8])
            device.color = color  # Update cache
            return color
        
        return None
    
    # ================================================================================
    # MultiZone Control
    # ================================================================================
    
    def set_zone_colors(self, device: LifxDevice, colors: List[Tuple[int, int, int, int]],
                       start_index: int = 0, duration: int = 0, apply: bool = True) -> bool:
        """Set colors for multiple zones"""
        if not device.is_multizone:
            return False
        
        # Use SetExtendedColorZones for efficiency
        # Can set up to 82 zones in one message
        zone_count = min(82, len(colors))
        
        # Pack payload
        payload = struct.pack('<IB', duration, 0)  # duration, reserved
        payload += struct.pack('<BB', zone_count, start_index)  # zones_count, zone_index
        
        # Add colors (up to 82 HSBK values)
        for i in range(zone_count):
            if i < len(colors):
                h, s, b, k = colors[i]
            else:
                h, s, b, k = 0, 0, 0, 3500  # Default
            payload += PayloadPacker.pack_hsbk(h, s, b, k)
        
        header = self._create_header(
            MessageType.SET_EXTENDED_COLOR_ZONES,
            target=device.mac,
            ack_required=not self.entertainment_mode
        )
        packet = LifxPacket(header=header, payload=payload)
        
        self._send_packet(packet, device.ip)
        
        # Update cache
        device.zones = list(colors)
        
        return True
    
    def set_zone_colors_rgb(self, device: LifxDevice, rgb_colors: List[Tuple[int, int, int]],
                            duration: int = 0) -> bool:
        """Set zone colors from RGB values"""
        # Convert RGB to HSBK
        hsbk_colors = []
        for r, g, b in rgb_colors:
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            hue = int(h * 65535)
            saturation = int(s * 65535)
            brightness = int(v * 65535)
            hsbk_colors.append((hue, saturation, brightness, 3500))
        
        return self.set_zone_colors(device, hsbk_colors, duration=duration)
    
    # ================================================================================
    # Matrix/Tile Control
    # ================================================================================
    
    def set_tile_colors(self, device: LifxDevice, tile_index: int, colors: List[Tuple[int, int, int, int]],
                       x: int = 0, y: int = 0, width: int = 8, duration: int = 0) -> bool:
        """Set colors for a tile/matrix device using SetTileState64"""
        if not device.is_matrix:
            return False
        
        # SetTileState64 handles exactly 64 colors
        if len(colors) != 64:
            # Pad or truncate
            if len(colors) < 64:
                colors = list(colors) + [(0, 0, 0, 3500)] * (64 - len(colors))
            else:
                colors = colors[:64]
        
        # Pack payload
        payload = struct.pack('<B', tile_index)  # tile_index
        payload += struct.pack('<B', 1)  # length (reserved)
        payload += b'\x00'  # reserved
        payload += struct.pack('<B', x)  # x
        payload += struct.pack('<B', y)  # y
        payload += struct.pack('<B', width)  # width
        payload += struct.pack('<I', duration)  # duration
        
        # Add 64 HSBK colors
        for h, s, b, k in colors:
            payload += PayloadPacker.pack_hsbk(h, s, b, k)
        
        header = self._create_header(
            MessageType.SET_TILE_STATE64,
            target=device.mac,
            ack_required=not self.entertainment_mode
        )
        packet = LifxPacket(header=header, payload=payload)
        
        self._send_packet(packet, device.ip)
        
        return True
    
    def set_matrix_colors(self, device: LifxDevice, matrix: List[List[Tuple[int, int, int, int]]]) -> bool:
        """Set colors for entire matrix using multiple SetTileState64 messages"""
        if not device.is_matrix:
            return False
        
        width, height = device.matrix_dimensions
        
        # Send in 8x8 chunks using SetTileState64
        for y_chunk in range(0, height, 8):
            for x_chunk in range(0, width, 8):
                # Extract 8x8 block
                colors = []
                for y in range(8):
                    for x in range(8):
                        actual_y = y_chunk + y
                        actual_x = x_chunk + x
                        
                        if actual_y < len(matrix) and actual_x < len(matrix[actual_y]):
                            colors.append(matrix[actual_y][actual_x])
                        else:
                            colors.append((0, 0, 0, 3500))  # Black padding
                
                # Send this 8x8 block
                self.set_tile_colors(device, 0, colors, x_chunk, y_chunk, 8)
        
        return True
    
    # ================================================================================
    # Entertainment Mode
    # ================================================================================
    
    def enable_entertainment_mode(self, fps: int = 30):
        """Enable high-performance entertainment mode"""
        self.entertainment_mode = True
        self.frame_limit = fps
        self.last_update.clear()
    
    def disable_entertainment_mode(self):
        """Disable entertainment mode"""
        self.entertainment_mode = False
    
    def send_rgb_rapid(self, device: LifxDevice, r: int, g: int, b: int) -> bool:
        """Send RGB color rapidly for entertainment mode"""
        # Frame rate limiting
        now = time.time()
        last = self.last_update.get(device.mac, 0)
        min_interval = 1.0 / self.frame_limit
        
        if now - last < min_interval:
            return False  # Skip frame
        
        self.last_update[device.mac] = now
        
        # Power management
        is_black = (r == 0 and g == 0 and b == 0)
        if is_black and device.power > 0:
            self.set_power(device, False, 0)
            device.power = 0
        elif not is_black and device.power == 0:
            self.set_power(device, True, 0)
            device.power = 65535
        
        # Send color
        if not is_black:
            return self.set_color_rgb(device, r, g, b, 0)
        
        return True
    
    # ================================================================================
    # Keep-Alive
    # ================================================================================
    
    def start_keepalive(self):
        """Start keep-alive thread"""
        if self.keepalive_running:
            return
        
        self.keepalive_running = True
        self.keepalive_thread = threading.Thread(target=self._keepalive_worker, daemon=True)
        self.keepalive_thread.start()
    
    def stop_keepalive(self):
        """Stop keep-alive thread"""
        self.keepalive_running = False
        if self.keepalive_thread:
            self.keepalive_thread.join(timeout=2)
            self.keepalive_thread = None
    
    def _keepalive_worker(self):
        """Background thread for keep-alive"""
        while self.keepalive_running:
            with self.device_lock:
                devices = list(self.devices.values())
            
            for device in devices:
                # Send GetService as keep-alive
                header = self._create_header(
                    MessageType.GET_SERVICE,
                    target=device.mac
                )
                packet = LifxPacket(header=header)
                
                try:
                    self._send_packet(packet, device.ip)
                except:
                    pass
            
            time.sleep(self.keepalive_interval)
    
    # ================================================================================
    # Cleanup
    # ================================================================================
    
    def close(self):
        """Clean up resources"""
        self.stop_keepalive()
        
        if self.sock:
            self.sock.close()
            self.sock = None
        
        self.executor.shutdown(wait=False)

# ================================================================================
# Bridge Integration Functions
# ================================================================================

# Global protocol instance
_protocol: Optional[LifxProtocol] = None
_protocol_lock = Lock()

def get_protocol() -> LifxProtocol:
    """Get or create global protocol instance"""
    global _protocol
    if _protocol is None:
        with _protocol_lock:
            if _protocol is None:
                _protocol = LifxProtocol()
                _protocol.start_keepalive()
    return _protocol

def discover(detectedLights: List[Dict], opts: Optional[Dict] = None) -> None:
    """Discover LIFX devices for bridge integration"""
    protocol = get_protocol()
    
    # Get host IP from config to determine subnet
    try:
        import configManager
        host_ip = configManager.runtimeConfig.arg.get("HOST_IP", "192.168.1.1")
    except:
        host_ip = "192.168.1.1"
    
    # Calculate subnet from host IP (assuming /24)
    ip_parts = host_ip.split('.')
    if len(ip_parts) == 4:
        subnet = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.0/24"
    else:
        subnet = "192.168.1.0/24"
    
    # Override with options if provided
    if opts and "subnet" in opts:
        subnet = opts["subnet"]
    
    logging.info(f"LIFX Native: Discovering devices on subnet {subnet} (host IP: {host_ip})")
    
    # Collect all devices found
    devices = []
    seen_macs = set()
    
    # Always do subnet-wide unicast discovery for LIFX (most reliable)
    try:
        logging.info("LIFX Native: Starting subnet-wide unicast discovery...")
        subnet_devices = protocol.discover_subnet(subnet)
        for device in subnet_devices:
            if device.mac not in seen_macs:
                devices.append(device)
                seen_macs.add(device.mac)
        logging.info(f"LIFX Native: Found {len(subnet_devices)} devices via subnet scan")
    except Exception as e:
        logging.error(f"LIFX Native: Subnet discovery failed: {e}")
    
    # Also try broadcast as backup (some networks block unicast scanning)
    try:
        logging.info("LIFX Native: Trying broadcast discovery as backup...")
        broadcast_devices = protocol.discover_broadcast(timeout=2)
        for device in broadcast_devices:
            if device.mac not in seen_macs:
                devices.append(device)
                seen_macs.add(device.mac)
        logging.info(f"LIFX Native: Found {len(broadcast_devices)} additional devices via broadcast")
    except Exception as e:
        logging.debug(f"LIFX Native: Broadcast discovery failed: {e}")
    
    # Try static IPs if provided
    if opts and "static_ips" in opts:
        logging.info(f"LIFX Native: Checking static IPs: {opts['static_ips']}")
        for ip in opts["static_ips"]:
            try:
                device = protocol.discover_unicast(ip)
                if device and device.mac not in seen_macs:
                    devices.append(device)
                    seen_macs.add(device.mac)
                    logging.info(f"LIFX Native: Found device at static IP {ip}")
            except Exception as e:
                logging.debug(f"LIFX Native: No device at {ip}: {e}")
    
    logging.info(f"LIFX Native: Total devices discovered: {len(devices)}")
    
    # Get device details for all discovered devices
    logging.info("LIFX Native: Getting device details...")
    for device in devices:
        try:
            protocol._get_device_info(device)
            with protocol.device_lock:
                protocol.devices[device.mac] = device
        except Exception as e:
            logging.debug(f"LIFX Native: Failed to get details for {device.mac}: {e}")
    
    # Add discovered devices to list
    for device in devices:
        # Map to Hue model based on capabilities
        if device.is_matrix:
            modelid = "LST004"  # Hue Lightstrip Plus (gradient capable)
            points_capable = 64
        elif device.is_multizone:
            modelid = "LST002"  # Hue Lightstrip
            points_capable = device.zone_count
        else:
            modelid = "LCT015"  # Hue Go
            points_capable = 0
        
        light_config = {
            "protocol": "lifx_native",
            "name": device.label or f"LIFX {device.mac[-8:]}",
            "modelid": modelid,
            "protocol_cfg": {
                "mac": device.mac,
                "ip": device.ip,
                "product_id": device.product_id,
                "points_capable": points_capable,
                "is_multizone": device.is_multizone,
                "is_matrix": device.is_matrix,
                "zone_count": device.zone_count if device.is_multizone else 0,
                "matrix_width": device.matrix_dimensions[0] if device.is_matrix else 0,
                "matrix_height": device.matrix_dimensions[1] if device.is_matrix else 0,
            }
        }
        
        # Check if already exists
        if not any(d.get("protocol_cfg", {}).get("mac") == device.mac for d in detectedLights):
            detectedLights.append(light_config)

def set_light(light: Any, data: Dict) -> None:
    """Set light state for bridge integration"""
    protocol = get_protocol()
    
    # Get device
    mac = light.protocol_cfg.get("mac")
    device = protocol.devices.get(mac)
    
    if not device:
        # Try to rediscover
        ip = light.protocol_cfg.get("ip")
        if ip:
            device = protocol.discover_unicast(ip)
        
        if not device:
            return
    
    # Handle power state
    if "on" in data:
        protocol.set_power(device, data["on"], data.get("transitiontime", 0) * 100)
    
    # Handle color
    if "xy" in data:
        # Convert XY to RGB
        from functions.colors import convert_xy
        x, y = data["xy"]
        r, g, b = convert_xy(x, y, 255)
        protocol.set_color_rgb(device, r, g, b, data.get("transitiontime", 0) * 100)
    elif "ct" in data:
        # Color temperature mode
        kelvin = int(1000000 / data["ct"])
        kelvin = max(1500, min(9000, kelvin))
        
        # Get current brightness
        bri = data.get("bri", device.color[2] >> 8) if device.color else 128
        brightness = int(bri * 257)
        
        protocol.set_color(device, 0, 0, brightness, kelvin, data.get("transitiontime", 0) * 100)
    elif "hue" in data or "sat" in data or "bri" in data:
        # Get current color
        h, s, b, k = device.color if device.color else (0, 0, 32768, 3500)
        
        if "hue" in data:
            h = data["hue"]
        if "sat" in data:
            s = int(data["sat"] * 257)
        if "bri" in data:
            b = int(data["bri"] * 257)
        
        protocol.set_color(device, h, s, b, k, data.get("transitiontime", 0) * 100)

def set_light_multizone(light: Any, zone_colors: List[Tuple[int, int, int]]) -> None:
    """Set multizone colors for bridge integration"""
    protocol = get_protocol()
    
    # Get device
    mac = light.protocol_cfg.get("mac")
    device = protocol.devices.get(mac)
    
    if device and device.is_multizone:
        protocol.set_zone_colors_rgb(device, zone_colors)

def set_light_gradient(light: Any, gradient_points: List[Dict]) -> None:
    """Set gradient for bridge integration"""
    protocol = get_protocol()
    
    # Get device
    mac = light.protocol_cfg.get("mac")
    device = protocol.devices.get(mac)
    
    if not device:
        return
    
    # Parse gradient points
    from functions.colors import convert_xy
    colors = []
    
    for point in gradient_points:
        if "color" in point and "xy" in point["color"]:
            x, y = point["color"]["xy"]
            r, g, b = convert_xy(x, y, 255)
            colors.append((r, g, b))
    
    if device.is_multizone:
        # Resample to match zone count
        zone_count = device.zone_count
        resampled = []
        for i in range(zone_count):
            pos = i / (zone_count - 1) if zone_count > 1 else 0
            # Find surrounding colors
            idx = int(pos * (len(colors) - 1))
            if idx < len(colors) - 1:
                frac = (pos * (len(colors) - 1)) - idx
                r1, g1, b1 = colors[idx]
                r2, g2, b2 = colors[idx + 1]
                r = int(r1 + (r2 - r1) * frac)
                g = int(g1 + (g2 - g1) * frac)
                b = int(b1 + (b2 - b1) * frac)
                resampled.append((r, g, b))
            else:
                resampled.append(colors[-1])
        
        protocol.set_zone_colors_rgb(device, resampled)
    elif device.is_matrix:
        # Create gradient across matrix
        width, height = device.matrix_dimensions
        matrix = []
        
        for y in range(height):
            row = []
            for x in range(width):
                # Use horizontal gradient
                pos = x / (width - 1) if width > 1 else 0
                idx = int(pos * (len(colors) - 1))
                
                if idx < len(colors) - 1:
                    frac = (pos * (len(colors) - 1)) - idx
                    r1, g1, b1 = colors[idx]
                    r2, g2, b2 = colors[idx + 1]
                    r = int(r1 + (r2 - r1) * frac)
                    g = int(g1 + (g2 - g1) * frac)  
                    b = int(b1 + (b2 - b1) * frac)
                else:
                    r, g, b = colors[-1]
                
                # Convert to HSBK
                h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
                row.append((int(h * 65535), int(s * 65535), int(v * 65535), 3500))
            
            matrix.append(row)
        
        protocol.set_matrix_colors(device, matrix)
    else:
        # Single color - use average
        if colors:
            avg_r = sum(c[0] for c in colors) // len(colors)
            avg_g = sum(c[1] for c in colors) // len(colors)
            avg_b = sum(c[2] for c in colors) // len(colors)
            protocol.set_color_rgb(device, avg_r, avg_g, avg_b)

def get_light_state(light: Any) -> Dict:
    """Get light state for bridge integration"""
    protocol = get_protocol()
    
    # Get device
    mac = light.protocol_cfg.get("mac")
    device = protocol.devices.get(mac)
    
    if not device:
        return {"on": False, "reachable": False}
    
    # Get current state
    color = protocol.get_color(device)
    
    if color:
        h, s, b, k = color
        
        # Convert to Hue scale
        state = {
            "on": device.power > 0,
            "bri": min(254, b >> 8),
            "hue": h,
            "sat": min(254, s >> 8),
            "reachable": True
        }
        
        # Add color temperature if in white mode
        if s < 512:  # Low saturation
            state["ct"] = int(1000000 / k)
            state["colormode"] = "ct"
        else:
            state["colormode"] = "hs"
        
        return state
    
    return {"on": False, "reachable": False}

# Entertainment mode functions
def start_entertainment_mode():
    """Start entertainment mode"""
    protocol = get_protocol()
    protocol.enable_entertainment_mode(fps=30)

def stop_entertainment_mode():
    """Stop entertainment mode"""
    protocol = get_protocol()
    protocol.disable_entertainment_mode()

def send_rgb_rapid(light: Any, r: int, g: int, b: int, zone_index: int = None):
    """Send rapid RGB update for entertainment"""
    protocol = get_protocol()
    
    mac = light.protocol_cfg.get("mac")
    device = protocol.devices.get(mac)
    
    if device:
        protocol.send_rgb_rapid(device, r, g, b)

def send_rgb_zones_rapid(light: Any, zone_colors: List[Tuple[int, int, int]]):
    """Send rapid zone updates for entertainment"""
    protocol = get_protocol()
    
    mac = light.protocol_cfg.get("mac")
    device = protocol.devices.get(mac)
    
    if device and device.is_multizone:
        # Convert to HSBK
        hsbk_colors = []
        for r, g, b in zone_colors:
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            hsbk_colors.append((int(h * 65535), int(s * 65535), int(v * 65535), 3500))
        
        protocol.set_zone_colors(device, hsbk_colors, duration=0)

# Initialize on module load
def initialize_lifx():
    """Initialize LIFX module"""
    protocol = get_protocol()
    protocol.start_keepalive()
    logging.info("LIFX Native: Protocol initialized")