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
from collections import deque, defaultdict

import logManager
from functions.colors import convert_xy, convert_rgb_xy, hsv_to_rgb

logging = logManager.logger.get_logger(__name__)

# Optional lifxlan fallback: use if installed
try:
    import lifxlan as LifxLAN  # type: ignore
except Exception:
    LifxLAN = None

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
MSG_SET_WAVEFORM = 103
MSG_SET_WAVEFORM_OPTIONAL = 119
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
MSG_COPY_FRAMEBUFFER = 716

# Constants
LIFX_PORT = 56700
BROADCAST_IP = '255.255.255.255'
DISCOVERY_TIMEOUT = 3
PACKET_TIMEOUT = 2
MAX_ZONES = 82
DEFAULT_KELVIN = 3500
MAX_MESSAGES_PER_SECOND = 20  # LIFX official rate limit

# Waveform types (for SetWaveform)
WAVEFORM_SAW = 0
WAVEFORM_SINE = 1
WAVEFORM_HALF_SINE = 2
WAVEFORM_TRIANGLE = 3
WAVEFORM_PULSE = 4


class DeviceRateLimiter:
    """Enforce LIFX 20 msg/sec per device limit to prevent protocol violations"""
    
    def __init__(self, max_rate: int = MAX_MESSAGES_PER_SECOND):
        self.max_rate = max_rate
        self.device_timers = defaultdict(deque)  # MAC -> deque of timestamps
        self.lock = Lock()
        self.rate_limit_hits = defaultdict(int)  # Track rate limit violations
    
    def can_send(self, mac: str, now: float = None) -> bool:
        """Check if we can send to device (under rate limit)
        
        Uses sliding window algorithm to enforce rate limit.
        Returns True if under limit, False if we should wait.
        """
        if now is None:
            now = time.time()
        
        with self.lock:
            timestamps = self.device_timers[mac]
            
            # Remove timestamps older than 1 second
            cutoff = now - 1.0
            while timestamps and timestamps[0] < cutoff:
                timestamps.popleft()
            
            # Check if we're under the rate limit
            if len(timestamps) < self.max_rate:
                timestamps.append(now)
                return True
            else:
                self.rate_limit_hits[mac] += 1
                # Log rate limit hit periodically (not every time to avoid spam)
                if self.rate_limit_hits[mac] % 100 == 1:
                    logging.debug(f"LIFX: Rate limit hit for {mac} ({self.rate_limit_hits[mac]} total)")
                return False
    
    def get_wait_time(self, mac: str) -> float:
        """Get time to wait before next send is allowed"""
        with self.lock:
            timestamps = self.device_timers[mac]
            if not timestamps or len(timestamps) < self.max_rate:
                return 0.0
            
            # Calculate when the oldest timestamp will expire
            oldest = timestamps[0]
            wait_time = max(0, (oldest + 1.0) - time.time())
            return wait_time
    
    def reset_device(self, mac: str):
        """Reset rate limit tracking for a device"""
        with self.lock:
            self.device_timers[mac].clear()
            self.rate_limit_hits[mac] = 0


class LifxMetrics:
    """Track performance metrics per documentation warnings"""
    
    def __init__(self):
        self.messages_sent = defaultdict(int)
        self.messages_dropped = defaultdict(int)
        self.rate_limit_hits = defaultdict(int)
        self.packet_errors = defaultdict(int)
        self.last_reset = time.time()
        self.lock = Lock()
    
    def record_send(self, mac: str):
        """Record successful message send"""
        with self.lock:
            self.messages_sent[mac] += 1
    
    def record_drop(self, mac: str):
        """Record dropped message due to rate limit"""
        with self.lock:
            self.messages_dropped[mac] += 1
            self.rate_limit_hits[mac] += 1
    
    def record_error(self, mac: str):
        """Record packet send error"""
        with self.lock:
            self.packet_errors[mac] += 1
    
    def get_stats(self, mac: str = None) -> Dict:
        """Get performance statistics"""
        with self.lock:
            elapsed = time.time() - self.last_reset
            if mac:
                return {
                    'messages_sent': self.messages_sent[mac],
                    'messages_dropped': self.messages_dropped[mac],
                    'rate_limit_hits': self.rate_limit_hits[mac],
                    'packet_errors': self.packet_errors[mac],
                    'elapsed_seconds': elapsed,
                    'avg_rate': self.messages_sent[mac] / elapsed if elapsed > 0 else 0
                }
            else:
                # Aggregate stats
                return {
                    'total_messages': sum(self.messages_sent.values()),
                    'total_dropped': sum(self.messages_dropped.values()),
                    'total_rate_limits': sum(self.rate_limit_hits.values()),
                    'total_errors': sum(self.packet_errors.values()),
                    'device_count': len(self.messages_sent),
                    'elapsed_seconds': elapsed
                }
    
    def reset(self):
        """Reset all metrics"""
        with self.lock:
            self.messages_sent.clear()
            self.messages_dropped.clear()
            self.rate_limit_hits.clear()
            self.packet_errors.clear()
            self.last_reset = time.time()


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
                   ack_required: bool = False, res_required: bool = True,
                   reuse_socket: Optional[socket.socket] = None) -> Optional[Dict]:
        """Send a packet to this device and optionally wait for response"""
        packet = self.packet.build_header(
            msg_type, payload, tagged=False, 
            ack_required=ack_required, res_required=res_required,
            target=self.mac
        )
        
        # Use provided socket or create new one
        if reuse_socket:
            sock = reuse_socket
            should_close = False
        else:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(PACKET_TIMEOUT)
            should_close = True
        
        try:
            sock.sendto(packet, (self.ip, self.port))
            
            if res_required:
                data, _ = sock.recvfrom(1024)
                return self.packet.parse_header(data)
        except Exception as e:
            logging.debug(f"LIFX: Error sending packet to {self.ip}: {e}")
        finally:
            if should_close:
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
                logging.debug(f"LIFX: Got StateDeviceChain response, payload length: {len(payload)}")
                # StateDeviceChain structure (per documentation):
                # Byte 0: start_index (uint8)
                # Bytes 1-880: tile_devices array (16 tiles × 55 bytes each)
                # Byte 881: tile_devices_count (uint8) - actual number of tiles
                if len(payload) >= 882:
                    start_index = payload[0]
                    tile_count = payload[881]  # Actual tile count is at byte 881, NOT byte 1
                    
                    logging.info(f"LIFX: {self.label} StateDeviceChain - start_index: {start_index}, tile_count: {tile_count} tile(s)")
                    
                    tiles = []
                    offset = 1  # Tiles start at byte 1 (after start_index)
                    
                    for i in range(min(tile_count, 16)):  # Process actual tiles
                        if offset + 55 <= 881:  # Stay within tile array bounds
                            # Tile structure (55 bytes per documentation):
                            # Bytes 0-5: Accelerometer (3 × int16)
                            # Bytes 6-7: Reserved
                            # Bytes 8-11: user_x (float32)
                            # Bytes 12-15: user_y (float32)
                            # Bytes 16: width (uint8) - number of zones per row
                            # Bytes 17: height (uint8) - number of zones per column
                            # Bytes 18-54: Device info and reserved
                            
                            # Extract accelerometer data for orientation
                            accel_x = struct.unpack('<h', payload[offset:offset + 2])[0] if offset + 2 <= len(payload) else 0
                            accel_y = struct.unpack('<h', payload[offset + 2:offset + 4])[0] if offset + 4 <= len(payload) else 0
                            accel_z = struct.unpack('<h', payload[offset + 4:offset + 6])[0] if offset + 6 <= len(payload) else 0
                            
                            # Extract width and height at correct offsets within tile
                            width = payload[offset + 16]
                            height = payload[offset + 17]
                            
                            
                            # Skip invalid tiles (0x0 dimensions mean no tile present)
                            if width == 0 or height == 0:
                                logging.debug(f"LIFX: Tile {i} - skipping empty tile slot")
                                break
                            
                            # Extract user position floats
                            user_x = struct.unpack('<f', payload[offset + 8:offset + 12])[0] if offset + 12 <= len(payload) else 0
                            user_y = struct.unpack('<f', payload[offset + 12:offset + 16])[0] if offset + 16 <= len(payload) else 0
                            
                            # Determine orientation from accelerometer
                            orientation = self._get_tile_orientation(accel_x, accel_y, accel_z)
                            
                            tiles.append({
                                'index': i,
                                'width': width,
                                'height': height,
                                'x': user_x,
                                'y': user_y,
                                'orientation': orientation
                            })
                            offset += 55
                            
                            # Store device type based on actual dimensions
                            self.capabilities['device_type'] = f'matrix_{width}x{height}'
                            
                            # Log known device types for reference
                            pixels = width * height
                            if width == 8 and height == 8:
                                logging.info(f"LIFX: Detected standard Tile (8x8)")
                            elif width == 5 and height == 5:
                                logging.info(f"LIFX: Detected Candle (5x5)")
                            elif width == 10 and height == 12:
                                logging.info(f"LIFX: Detected Ceiling 26\" (10x12)")
                            elif width == 8 and height == 7:
                                logging.info(f"LIFX: Detected Ceiling 15\" (8x7)")
                            elif pixels == 55:
                                logging.info(f"LIFX: Detected Tube ({width}x{height})")
                            elif pixels == 30:
                                logging.info(f"LIFX: Detected Tube Mini ({width}x{height})")
                            else:
                                logging.info(f"LIFX: Detected matrix device with dimensions {width}x{height}")
                            
                            logging.info(f"LIFX:   Tile {i}: {width}x{height} pixels, position ({user_x:.2f}, {user_y:.2f}), orientation: {orientation}")
                    
                    if tiles:
                        self.capabilities['type'] = 'matrix'
                        self.capabilities['tiles'] = tiles
                        self.capabilities['tile_count'] = len(tiles)
                        self.capabilities['total_pixels'] = sum(t['width'] * t['height'] for t in tiles)
                        logging.info(f"LIFX: {self.label} is matrix with {len(tiles)} tiles, {self.capabilities['total_pixels']} total pixels")
                        return
                else:
                    logging.warning(f"LIFX: StateDeviceChain payload too short: {len(payload)} bytes (expected 882)")
        except Exception as e:
            logging.warning(f"LIFX: Matrix detection failed: {e}")
        
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
    
    def send_waveform(self, waveform_type: int, color: Tuple[int, int, int, int], 
                     period_ms: int = 1000, cycles: float = 1.0, 
                     skew_ratio: float = 0.5, transient: bool = False) -> bool:
        """Send native LIFX waveform effect (compliant with packet 103)
        
        Args:
            waveform_type: WAVEFORM_SAW, WAVEFORM_SINE, WAVEFORM_HALF_SINE, WAVEFORM_TRIANGLE, or WAVEFORM_PULSE
            color: HSBK tuple (hue, saturation, brightness, kelvin)
            period_ms: Period of one cycle in milliseconds
            cycles: Number of cycles (0 = infinite)
            skew_ratio: 0.0-1.0, affects waveform shape (0.5 = symmetric)
            transient: If True, returns to original color after effect
        
        Returns:
            True if successful, False otherwise
        """
        # Build SetWaveform payload
        # Byte 0: Reserved
        # Byte 1: Transient flag
        # Bytes 2-9: HSBK
        # Bytes 10-13: Period
        # Bytes 14-17: Cycles (float32)
        # Bytes 18-19: Skew ratio (int16, -32768 to 32767)
        # Byte 20: Waveform type
        
        payload = struct.pack('<BB', 0, int(transient))  # Reserved + Transient
        payload += struct.pack('<HHHH', *color)  # HSBK
        payload += struct.pack('<I', period_ms)  # Period
        payload += struct.pack('<f', cycles)  # Cycles as float
        
        # Convert skew_ratio (0.0-1.0) to int16 range
        skew_int = int((skew_ratio - 0.5) * 65535)
        skew_int = max(-32768, min(32767, skew_int))
        payload += struct.pack('<h', skew_int)  # Skew ratio
        
        payload += struct.pack('B', waveform_type)  # Waveform type
        
        try:
            response = self.send_packet(MSG_SET_WAVEFORM, payload, ack_required=False, res_required=False)
            logging.debug(f"LIFX: Sent waveform {waveform_type} to {self.label}")
            return True
        except Exception as e:
            logging.error(f"LIFX: Failed to send waveform to {self.label}: {e}")
            return False
    
    def _get_tile_orientation(self, accel_x: int, accel_y: int, accel_z: int) -> str:
        """Determine tile orientation from accelerometer data"""
        # If accelerometer returns (-1, -1, -1), assume right side up
        if accel_x == -1 and accel_y == -1 and accel_z == -1:
            return "RightSideUp"
        
        # Find axis with largest magnitude
        abs_x = abs(accel_x)
        abs_y = abs(accel_y)
        abs_z = abs(accel_z)
        
        if abs_x >= abs_y and abs_x >= abs_z:
            # X-axis has largest magnitude
            return "RotatedRight" if accel_x > 0 else "RotatedLeft"
        elif abs_z >= abs_x and abs_z >= abs_y:
            # Z-axis has largest magnitude
            return "FaceDown" if accel_z > 0 else "FaceUp"
        else:
            # Y-axis has largest magnitude
            return "UpsideDown" if accel_y > 0 else "RightSideUp"


class LifxProtocol:
    """Main LIFX protocol handler"""
    
    def __init__(self):
        self.devices: Dict[str, LifxDevice] = {}  # MAC -> LifxDevice
        self.socket_pool: List[socket.socket] = []
        self.lock = Lock()
        self.executor = ThreadPoolExecutor(max_workers=10)
        self._entertainment_mode = False
        self._entertainment_sockets = {}  # Device MAC -> dedicated socket for entertainment
        self._rapid_socket_pool = {}  # IP -> socket for rapid updates (WLED pattern)
        self.rate_limiter = DeviceRateLimiter()  # Enforce 20 msg/sec limit
        self.metrics = LifxMetrics()  # Track performance
        # Runtime settings updated via /lifx-settings
        self._settings = {
            'enabled': True,
            'max_fps': 30,
            'smoothing_enabled': False,
            'smoothing_ms': 50,
            'keepalive_interval': 45,
            'static_ips': []
        }
        self._init_socket_pool()

    def update_entertainment_settings(self, settings: Dict[str, Any]) -> None:
        """Update runtime settings used by the integration UI.

        Currently used for:
        - max_fps: caps frame generation rate upstream; we also use it to cap
                   our internal per-device send rate below the LIFX 20 msg/sec limit.
        - smoothing_* and keepalive/static_ips are stored for external use.
        """
        try:
            if not isinstance(settings, dict):
                return
            self._settings.update({k: v for k, v in settings.items() if k in self._settings})

            # Use slider-defined max_fps as per-device message budget (no hard 20 cap)
            try:
                max_fps = int(self._settings.get('max_fps', MAX_MESSAGES_PER_SECOND))
            except Exception:
                max_fps = MAX_MESSAGES_PER_SECOND
            new_rate = max(1, max_fps)
            if new_rate > MAX_MESSAGES_PER_SECOND:
                logging.warning(f"LIFX: max_fps set to {new_rate} (> {MAX_MESSAGES_PER_SECOND}). Devices may drop packets.")
            self.rate_limiter.max_rate = new_rate
            logging.info(f"LIFX: Updated settings; rate limiter set to {new_rate} msg/sec")
        except Exception as e:
            logging.debug(f"LIFX: update_entertainment_settings error: {e}")
        
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

    def _ensure_mac_for_light(self, light) -> Optional[str]:
        """Ensure the light has a MAC stored in protocol_cfg; resolve if missing.

        Returns the MAC hex string if available or resolved, else None.
        """
        try:
            mac_hex = light.protocol_cfg.get('mac')
            if mac_hex:
                return mac_hex
            ip = light.protocol_cfg.get('ip')
            if not ip:
                return None
            resolved = self._unicast_discover_by_ip(ip)
            if resolved:
                mac_hex = resolved.get_mac_addr()
                # persist to light for future frames
                try:
                    light.protocol_cfg['mac'] = mac_hex
                except Exception:
                    pass
                # create device record if not exists
                if mac_hex not in self.devices:
                    try:
                        mac_bytes = bytes.fromhex(mac_hex)
                        device = LifxDevice(mac_bytes, ip, resolved.get_label())
                        # Minimal capabilities; can be filled later on demand
                        self.devices[mac_hex] = device
                    except Exception:
                        pass
                return mac_hex
        except Exception:
            pass
        return None
    
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
                                # Fetch friendly label from device state
                                try:
                                    device.get_state()
                                except Exception:
                                    pass
                                self.devices[serial_hex] = device
                                
                                # Map to appropriate Hue model and add gradient capabilities
                                protocol_cfg = {
                                    'mac': serial_hex,
                                    'ip': ip,
                                    'port': device_port,
                                    'capabilities': device.capabilities,
                                    'label': device.label
                                }
                                
                                if device.capabilities['type'] in ['multizone', 'matrix']:
                                    modelid = 'LCX004'  # Gradient capable
                                    # Set points_capable to 5 (Hue API limit)
                                    # Device capabilities are preserved for proper interpolation
                                    protocol_cfg['points_capable'] = 5
                                elif device.capabilities.get('color', True):
                                    modelid = 'LCT015'  # Color bulb
                                else:
                                    modelid = 'LTW001'  # White only
                                
                                detectedLights.append({
                                    'protocol': 'lifx',
                                    'name': device.label or f"LIFX {ip}",
                                    'modelid': modelid,
                                    'protocol_cfg': protocol_cfg
                                })
                                
                    except Exception as e:
                        logging.debug(f"LIFX: Error processing broadcast response: {e}")
                        continue
                        
            broadcast_sock.close()
                    
        except Exception as e:
            logging.debug(f"LIFX: Broadcast discovery error: {e}")
        
        # 2. Parallel IP scanning for specific IPs (always run as fallback)
        # This helps when broadcast doesn't work (Docker, VLANs, etc)
        if len(discovered_this_run) == 0:
            # Broadcast found nothing, scan the full subnet for LIFX devices
            import configManager
            HOST_IP = configManager.runtimeConfig.arg.get("HOST_IP", "192.168.1.1")
            subnet = '.'.join(HOST_IP.split('.')[0:3])
            scan_ips = [f"{subnet}.{i}" for i in range(1, 255)]
            logging.info(f"LIFX: Broadcast found 0 devices, scanning full subnet {subnet}.1-254")
            
            logging.info(f"LIFX: Scanning {len(scan_ips)} IPs via unicast")
            
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
            with ThreadPoolExecutor(max_workers=min(20, len(scan_ips))) as executor:
                futures = [executor.submit(scan_single_ip, ip) for ip in scan_ips]
                
                completed = 0
                for future in futures:
                    completed += 1
                    if completed % 50 == 0:
                        logging.debug(f"LIFX: Scanned {completed}/{len(scan_ips)} IPs...")
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
                            # Fetch friendly label from device state
                            try:
                                device.get_state()
                            except Exception:
                                pass
                            self.devices[serial_hex] = device
                            
                            # Map to appropriate Hue model and add gradient capabilities
                            protocol_cfg = {
                                'mac': serial_hex,
                                'ip': ip,
                                'port': device_port,
                                'capabilities': device.capabilities,
                                'label': device.label
                            }
                            
                            if device.capabilities['type'] in ['multizone', 'matrix']:
                                modelid = 'LCX004'
                                # Set points_capable to 5 (Hue API limit)
                                # Device capabilities are preserved for proper interpolation
                                protocol_cfg['points_capable'] = 5
                            elif device.capabilities.get('color', True):
                                modelid = 'LCT015'
                            else:
                                modelid = 'LTW001'
                            
                            detectedLights.append({
                                'protocol': 'lifx',
                                'name': device.label or f"LIFX {ip}",
                                'modelid': modelid,
                                'protocol_cfg': protocol_cfg
                            })
        
        logging.info(f"LIFX: Discovery complete, found {len(discovered_this_run)} new devices, {len(self.devices)} total")

    def _unicast_discover_by_ip(self, ip: str):
        """Lightweight unicast resolver for manual add flows.

        Returns a minimal object with get_label() and get_mac_addr() methods,
        or None if the target did not respond.
        """
        try:
            # Send GetService to target IP
            builder = LifxPacket()
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(0.5)
            pkt = builder.build_header(MSG_GET_SERVICE, tagged=False)
            sock.sendto(pkt, (ip, LIFX_PORT))
            data, _ = sock.recvfrom(1024)
            resp = builder.parse_header(data)
            sock.close()
            if not resp or resp.get('msg_type') != MSG_STATE_SERVICE:
                return None

            target = resp.get('target') or b''
            mac_hex = target.hex()
            # Build a temporary device to query label via LightState
            dev = LifxDevice(target, ip)
            state = dev.get_state() or {}
            label = dev.label

            class _MiniDev:
                def __init__(self, mac_hex: str, label: str):
                    self._mac = mac_hex
                    self._label = label
                def get_mac_addr(self):
                    return self._mac
                def get_label(self):
                    return self._label

            return _MiniDev(mac_hex, label)
        except Exception:
            return None
    
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
                # Initialize cached state from Light object to avoid network queries
                device.last_state = {
                    'on': light.state.get('on', False),
                    'bri': light.state.get('bri', 254),
                    'hue': light.state.get('hue', 0),
                    'sat': light.state.get('sat', 0),
                    'xy': light.state.get('xy', [0.5, 0.5]),
                    'ct': light.state.get('ct', 366),
                    'colormode': light.state.get('colormode', 'hs')
                }
                self.devices[mac_hex] = device
            else:
                return
        
        # Initialize last_state if needed
        if not device.last_state:
            device.last_state = {}
        
        # Handle power state
        if 'on' in data:
            power = 65535 if data['on'] else 0
            payload = struct.pack('<H', power)
            device.send_packet(MSG_SET_POWER, payload, ack_required=False, res_required=False)
            
            # Update cached state
            device.last_state['on'] = data['on']
            
            if not data['on']:
                return  # Don't send color commands when turning off
        
        # Handle gradient for capable devices
        if 'gradient' in data:
            device_type = device.capabilities.get('type')
            logging.debug(f"LIFX: Gradient data received for {device.label}, device type: {device_type}")
            if device_type in ['multizone', 'matrix']:
                transition_time = data.get('transitiontime', 0)
                # Use Light's cached brightness instead of querying device
                device_brightness = light.state.get('bri', 254)
                self._set_gradient(device, data['gradient'], transition_time, device_brightness)
                
                # Update cached state
                device.last_state['gradient'] = data['gradient']
                device.last_state['bri'] = device_brightness
                return
            else:
                logging.debug(f"LIFX: Device {device.label} type {device_type} doesn't support gradients")
        
        # Handle standard color/brightness
        if any(k in data for k in ['bri', 'xy', 'ct', 'hue', 'sat']):
            # Get current state as baseline
            current = device.last_state or device.get_state()
            
            # Build HSBK values - IMPORTANT: Brightness is independent of color
            # We preserve hue and saturation when only brightness changes
            # When color changes, we extract pure color at full brightness
            # to get accurate hue/saturation, then apply brightness separately
            hue = current.get('hue', 0)
            sat = current.get('sat', 254)
            bri = current.get('bri', 254)
            kelvin = DEFAULT_KELVIN
            
            if 'xy' in data:
                # Convert XY to HSV - extract pure color at full brightness
                x, y = data['xy']
                # Get pure color without brightness scaling to preserve saturation
                rgb_pure = convert_xy(x, y, 255)
                h, s, v = self._rgb_to_hsv(rgb_pure[0], rgb_pure[1], rgb_pure[2])
                hue = int(h * 65535)
                sat = int(s * 254)
                # Brightness is handled independently - never derive from V
                # This ensures color remains constant regardless of brightness level
                    
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
            
            # Update cached state
            if 'bri' in data:
                device.last_state['bri'] = data['bri']
            if 'xy' in data:
                device.last_state['xy'] = data['xy']
                device.last_state['colormode'] = 'xy'
            if 'ct' in data:
                device.last_state['ct'] = data['ct']
                device.last_state['colormode'] = 'ct'
            if 'hue' in data:
                device.last_state['hue'] = data['hue']
                device.last_state['colormode'] = 'hs'
            if 'sat' in data:
                device.last_state['sat'] = data['sat']
                device.last_state['colormode'] = 'hs'
    
    def _set_gradient(self, device: LifxDevice, gradient: Dict, transition_time: int = 0, device_brightness: int = 254) -> None:
        """Set gradient on multizone or matrix device"""
        points = gradient.get('points', [])
        if not points:
            logging.debug(f"LIFX: No gradient points provided for {device.label}")
            return
        
        logging.debug(f"LIFX: Setting gradient on {device.label} with {len(points)} points, type: {device.capabilities.get('type')}, brightness: {device_brightness}")
        
        # Convert transition time from deciseconds to milliseconds
        duration_ms = transition_time * 100 if transition_time else 0
        
        # Brightness is now passed in from Light's cached state - no network query needed!
            
        if device.capabilities['type'] == 'multizone':
            # Map gradient to zones
            zone_count = device.capabilities.get('zone_count', 16)
            colors = self._interpolate_gradient(points, zone_count, device_brightness)
            
            if device.capabilities.get('supports_extended', False):
                # Use SetExtendedColorZones for efficiency
                self._send_extended_zones(device, colors)
            else:
                # Use multiple SetColorZones
                for i, color in enumerate(colors):
                    self._send_color_zone(device, i, i, color)
                    
        elif device.capabilities['type'] == 'matrix':
            # Map gradient to tiles considering their spatial arrangement
            tiles = device.capabilities.get('tiles', [])
            
            # Calculate overall bounds for gradient mapping
            min_x = min_y = max_x = max_y = 0
            if tiles:
                min_x = min(t.get('x', 0) for t in tiles)
                max_x = max(t.get('x', 0) for t in tiles)
                min_y = min(t.get('y', 0) for t in tiles)
                max_y = max(t.get('y', 0) for t in tiles)
            
            # Prepare all tiles data first
            tile_tasks = []
            for tile in tiles:
                width = tile.get('width', 8)
                height = tile.get('height', 8)
                tile_x = tile.get('x', 0)
                tile_y = tile.get('y', 0)
                
                # Normalize tile position to 0-1 range
                if max_x > min_x:
                    tile_x_normalized = (tile_x - min_x) / (max_x - min_x)
                else:
                    tile_x_normalized = 0.5
                    
                if max_y > min_y:
                    tile_y_normalized = (tile_y - min_y) / (max_y - min_y)
                else:
                    tile_y_normalized = 0.5
                
                # Map gradient to this tile based on its normalized position
                tile_colors = self._map_gradient_to_tile(points, width, height, 
                                                         tile_x_normalized, tile_y_normalized, 
                                                         len(tiles),  # Use tile count instead of width/height
                                                         device_brightness)
                
                # Reorient colors based on tile orientation
                orientation = tile.get('orientation', 'RightSideUp')
                if orientation != 'RightSideUp':
                    tile_colors = self._reorient_tile_colors(tile_colors, width, height, orientation)
                
                tile_tasks.append((tile['index'], tile_colors))
            
            # Send to all tiles - sequentially to avoid thread churn and resource spikes
            for tile_index, colors in tile_tasks:
                try:
                    self._send_tile_state(device, tile_index, colors, duration_ms)
                except Exception as e:
                    logging.warning(f"LIFX: Failed to send gradient to tile {tile_index}: {e}")
    
    def _interpolate_gradient(self, points: List[Dict], count: int, brightness: int = 254) -> List[Tuple[int, int, int, int]]:
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
            
            # Interpolate between the two surrounding points
            if prev_point == next_point:
                xy = prev_xy
            else:
                # Calculate interpolation factor between prev and next points
                prev_pos = points.index(prev_point) / max(1, len(points) - 1)
                next_pos = points.index(next_point) / max(1, len(points) - 1)
                
                if next_pos - prev_pos > 0:
                    t = (position - prev_pos) / (next_pos - prev_pos)
                else:
                    t = 0
                
                xy = {
                    'x': prev_xy['x'] + (next_xy['x'] - prev_xy['x']) * t,
                    'y': prev_xy['y'] + (next_xy['y'] - prev_xy['y']) * t
                }
            
            # Convert to HSBK - extract pure color for accurate saturation
            rgb_pure = convert_xy(xy['x'], xy['y'], 255)  # Full brightness for pure color
            h, s, _ = self._rgb_to_hsv(rgb_pure[0], rgb_pure[1], rgb_pure[2])
            
            colors.append((
                int(h * 65535),         # Hue (unaffected by brightness)
                int(s * 65535),         # Saturation (from pure color)
                int((brightness / 254) * 65535),  # Brightness applied separately
                DEFAULT_KELVIN          # Kelvin
            ))
            
        return colors
    
    def _map_gradient_to_tile(self, points: List[Dict], tile_width: int, tile_height: int,
                              tile_x_normalized: float, tile_y_normalized: float, 
                              tile_count: int,
                              brightness: int = 254) -> List[Tuple[int, int, int, int]]:
        """Map gradient points to a tile based on its normalized position (0-1)"""
        if not points:
            return [(0, 0, 0, DEFAULT_KELVIN)] * (tile_width * tile_height)
        
        colors = []
        
        # For each pixel in the tile (row-major order as LIFX expects)
        for y in range(tile_height):
            for x in range(tile_width):
                # Calculate position in overall gradient space (0.0 to 1.0)
                # Hue gradients are 1D - we map them horizontally across tiles
                
                if tile_count > 1:
                    # Multiple tiles - gradient spans across all tiles
                    # Tile position is already normalized (0-1), pixel adds detail within tile
                    pixel_fraction = x / max(1, tile_width - 1) if tile_width > 1 else 0.5
                    # Each tile gets 1/tile_count of the gradient space
                    tile_gradient_width = 1.0 / tile_count
                    # Position = tile's starting position + pixel position within tile's portion
                    gradient_position = tile_x_normalized + (pixel_fraction * tile_gradient_width)
                else:
                    # Single tile - gradient spans across the tile horizontally
                    gradient_position = x / max(1, tile_width - 1) if tile_width > 1 else 0.5
                
                # Clamp to valid range
                position = max(0.0, min(1.0, gradient_position))
                
                # Find surrounding gradient points
                prev_point = points[0]
                next_point = points[-1]
                
                for j, point in enumerate(points):
                    point_pos = j / max(1, len(points) - 1)
                    if point_pos <= position:
                        prev_point = point
                    if point_pos >= position:
                        next_point = point
                        break
                
                # Interpolate color
                if prev_point == next_point:
                    xy = prev_point.get('color', {}).get('xy', {'x': 0.5, 'y': 0.5})
                else:
                    prev_xy = prev_point.get('color', {}).get('xy', {'x': 0.5, 'y': 0.5})
                    next_xy = next_point.get('color', {}).get('xy', {'x': 0.5, 'y': 0.5})
                    
                    # Calculate interpolation factor
                    prev_pos = points.index(prev_point) / max(1, len(points) - 1)
                    next_pos = points.index(next_point) / max(1, len(points) - 1)
                    
                    if next_pos - prev_pos > 0:
                        t = (position - prev_pos) / (next_pos - prev_pos)
                    else:
                        t = 0
                    
                    xy = {
                        'x': prev_xy['x'] + (next_xy['x'] - prev_xy['x']) * t,
                        'y': prev_xy['y'] + (next_xy['y'] - prev_xy['y']) * t
                    }
                
                # Convert to HSBK - extract pure color for accurate saturation
                rgb_pure = convert_xy(xy['x'], xy['y'], 255)  # Full brightness for pure color
                h, s, _ = self._rgb_to_hsv(rgb_pure[0], rgb_pure[1], rgb_pure[2])
                
                colors.append((
                    int(h * 65535),         # Hue (unaffected by brightness)
                    int(s * 65535),         # Saturation (from pure color)
                    int((brightness / 254) * 65535),  # Brightness applied separately
                    DEFAULT_KELVIN          # Kelvin
                ))
        
        return colors
    
    def _reorient_tile_colors(self, colors: List[Tuple[int, int, int, int]], 
                             width: int, height: int, orientation: str) -> List[Tuple[int, int, int, int]]:
        """Reorient color array based on tile orientation"""
        if orientation == "RightSideUp":
            # No change needed
            return colors
        
        # Convert to 2D array for easier manipulation
        grid = []
        for y in range(height):
            row = []
            for x in range(width):
                row.append(colors[y * width + x])
            grid.append(row)
        
        # Apply rotation based on orientation
        if orientation == "UpsideDown":
            # Rotate 180 degrees
            grid = [row[::-1] for row in grid[::-1]]
        elif orientation == "RotatedLeft":
            # Rotate 90 degrees counter-clockwise
            grid = [[grid[y][x] for y in range(height)] for x in range(width-1, -1, -1)]
        elif orientation == "RotatedRight":
            # Rotate 90 degrees clockwise
            grid = [[grid[y][x] for y in range(height-1, -1, -1)] for x in range(width)]
        elif orientation == "FaceUp":
            # Mirror horizontally
            grid = [row[::-1] for row in grid]
        elif orientation == "FaceDown":
            # Mirror vertically
            grid = grid[::-1]
        
        # Flatten back to list
        reoriented = []
        for row in grid:
            reoriented.extend(row)
        
        return reoriented
    
    def _send_extended_zones(self, device: LifxDevice, colors: List[Tuple[int, int, int, int]]) -> None:
        """Send SetExtendedColorZones message for efficient multizone updates"""
        # SetExtendedColorZones can update up to 82 zones in a single message
        duration = 0  # Immediate transition
        total = len(colors)
        # Process colors in chunks of 82 (max zones per message)
        for chunk_start in range(0, total, 82):
            chunk = colors[chunk_start:chunk_start + 82]
            colors_count = len(chunk)
            apply_flag = 1 if (chunk_start + colors_count >= total) else 0
            # Build SetExtendedColorZones payload
            payload = struct.pack('<IBHB', 
                                duration,      # Duration in ms
                                apply_flag,    # Apply only on last chunk
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
    
    def _send_color_zone_rapid(self, device: LifxDevice, start: int, end: int, 
                               color: Tuple[int, int, int, int], sock: Optional[socket.socket] = None) -> None:
        """Send SetColorZones message with entertainment socket"""
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
        
        if sock:
            packet = device.packet.build_header(
                MSG_SET_COLOR_ZONES, payload, tagged=False,
                ack_required=False, res_required=False,
                target=device.mac
            )
            try:
                sock.sendto(packet, (device.ip, device.port))
            except:
                device.send_packet(MSG_SET_COLOR_ZONES, payload, ack_required=False, res_required=False)
        else:
            device.send_packet(MSG_SET_COLOR_ZONES, payload, ack_required=False, res_required=False)
    
    def _send_extended_zones_rapid(self, device: LifxDevice, colors: List[Tuple[int, int, int, int]], 
                                   sock: Optional[socket.socket] = None) -> None:
        """Send SetExtendedColorZones with entertainment socket"""
        # Process colors in chunks of 82 (max zones per message)
        total = len(colors)
        for chunk_start in range(0, total, 82):
            chunk = colors[chunk_start:chunk_start + 82]
            colors_count = len(chunk)
            
            # Build SetExtendedColorZones payload
            apply_flag = 1 if (chunk_start + colors_count >= total) else 0
            payload = struct.pack('<IBHB', 
                                0,             # Duration (0 for instant)
                                apply_flag,    # Apply only on last chunk
                                chunk_start,   # Starting zone index
                                colors_count)  # Number of colors
            
            # Add HSBK values for each zone
            for color in chunk:
                payload += struct.pack('<HHHH',
                                     color[0],  # Hue
                                     color[1],  # Saturation
                                     color[2],  # Brightness
                                     color[3])  # Kelvin
            
            # Pad with zeros if less than 82 zones
            while len(chunk) < 82:
                payload += struct.pack('<HHHH', 0, 0, 0, DEFAULT_KELVIN)
                chunk.append((0, 0, 0, DEFAULT_KELVIN))
            
            if sock:
                packet = device.packet.build_header(
                    MSG_SET_EXTENDED_COLOR_ZONES, payload, tagged=False,
                    ack_required=False, res_required=False,
                    target=device.mac
                )
                try:
                    # If sock is connected, send() is fine; otherwise sendto()
                    try:
                        sock.send(packet)
                    except Exception:
                        sock.sendto(packet, (device.ip, device.port))
                except:
                    device.send_packet(MSG_SET_EXTENDED_COLOR_ZONES, payload, ack_required=False, res_required=False)
            else:
                device.send_packet(MSG_SET_EXTENDED_COLOR_ZONES, payload, ack_required=False, res_required=False)
    
    def _set_gradient_rapid(self, device: LifxDevice, gradient: Dict, device_brightness: int = 254, 
                           sock: Optional[socket.socket] = None) -> None:
        """Set gradient with entertainment socket for fast updates"""
        points = gradient.get('points', [])
        if not points:
            return
        
        if device.capabilities['type'] == 'multizone':
            zone_count = device.capabilities.get('zone_count', 16)
            colors = self._interpolate_gradient(points, zone_count, device_brightness)
            
            if device.capabilities.get('supports_extended', False):
                self._send_extended_zones_rapid(device, colors, sock)
            else:
                for i, color in enumerate(colors):
                    self._send_color_zone_rapid(device, i, i, color, sock)
                    
        elif device.capabilities['type'] == 'matrix':
            # For matrix devices, use regular _set_gradient but with entertainment socket
            # This is complex enough that we'll reuse the existing logic
            self._set_gradient(device, gradient, transition_time=0, device_brightness=device_brightness)
    
    def _send_tile_state(self, device: LifxDevice, tile_index: int, colors: List[Tuple[int, int, int, int]], duration_ms: int = 0) -> None:
        """Send SetTileState64 message(s) covering the entire tile area.

        Uses an off-screen frame (1) for staging and then copies it to the
        visible frame with CopyFrameBuffer (type 716), as per LIFX docs.

        Correctly iterates 8x8 blocks across both width and height, so wide/tall
        matrices (e.g., 13x26 Ceiling) are fully updated without partial draws.
        """
        # Resolve tile info
        tiles = device.capabilities.get('tiles', [])
        tile_info = next((t for t in tiles if t.get('index') == tile_index), None)
        if not tile_info:
            logging.warning(f"LIFX: Tile index {tile_index} not found in device capabilities")
            return

        tile_width = int(tile_info.get('width', 8))
        tile_height = int(tile_info.get('height', 8))
        total_pixels = tile_width * tile_height

        # Width parameter is the rectangle width within the tile (max 8 for standard tiles).
        # Use 8 for 8x8 tiles and larger matrices; use 5 for Candle (5x5) if encountered.
        width_param = 8 if tile_width >= 8 else tile_width

        # Stage updates into non-visible frame 1 to avoid on-screen tearing/partials
        stage_frame = 1

        # Build all 8x8 packets by scanning y in steps of 8, then x in steps of 8
        packets: List[Tuple[int, bytes, int, int, int, int, int]] = []

        for y_offset in range(0, tile_height, 8):
            for x_offset in range(0, tile_width, 8):
                # Gather up to 8x8 colors for this block
                block: List[Tuple[int, int, int, int]] = []
                for ry in range(8):
                    src_y = y_offset + ry
                    for rx in range(8):
                        src_x = x_offset + rx
                        if src_x < tile_width and src_y < tile_height:
                            idx = src_y * tile_width + src_x
                            if idx < len(colors):
                                block.append(colors[idx])
                            else:
                                block.append((0, 0, 0, DEFAULT_KELVIN))
                        else:
                            block.append((0, 0, 0, DEFAULT_KELVIN))

                # Build payload for this 8x8
                payload = struct.pack('<BBBBBBI',
                                      tile_index,   # Tile index in chain
                                      1,            # Length (tiles to update)
                                      stage_frame,  # Frame (1 = off-screen staging)
                                      x_offset,     # X within tile
                                      y_offset,     # Y within tile
                                      width_param,  # 8 for Tile, 5 for Candle
                                      duration_ms)  # Duration

                for color in block:
                    payload += struct.pack('<HHHH', color[0], color[1], color[2], color[3])

                packets.append((MSG_SET_TILE_STATE_64, payload, x_offset, y_offset, 0, 0, tile_index))

        # Send packets sequentially to preserve order on device
        if not packets:
            return

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.1)
        try:
            for i, packet in enumerate(packets):
                msg_type, payload, x, y, _, _, t_idx = packet
                device.send_packet(msg_type, payload, ack_required=False, res_required=False, reuse_socket=sock)
                logging.debug(f"LIFX: Sent SetTileState64 {i+1}/{len(packets)} to {device.label}, tile_index={t_idx}, x={x}, y={y}")
                # Minimal inter-packet delay to maintain order; reduce to improve throughput
                # Adjust or remove if devices reorder packets reliably
                # if i + 1 < len(packets):
                #     time.sleep(0.001)

            # After staging all blocks, copy staged frame (1) to visible (0)
            try:
                # Copy the whole tile from staged frame (1) to visible (0)
                # Fields per docs: tile_index, length, src_fb_index, dst_fb_index,
                # src_x, src_y, dst_x, dst_y, width, height, duration (uint32), reserved1
                copy_payload = struct.pack(
                    '<BBBBBBBBBBIB',
                    tile_index,      # tile_index
                    1,               # length (tiles)
                    stage_frame,     # src_fb_index (staged)
                    0,               # dst_fb_index (visible)
                    0,               # src_x
                    0,               # src_y
                    0,               # dst_x
                    0,               # dst_y
                    tile_width,      # width (copy entire tile width)
                    tile_height,     # height (copy entire tile height)
                    int(duration_ms),# duration ms (applies only when copying to visible)
                    0                # reserved1
                )
                device.send_packet(
                    MSG_COPY_FRAMEBUFFER,
                    copy_payload,
                    ack_required=False,
                    res_required=False,
                    reuse_socket=sock
                )
                logging.debug(
                    f"LIFX: CopyFrameBuffer staged->visible tile={tile_index} size={tile_width}x{tile_height} duration={duration_ms}ms"
                )
            except Exception as e:
                logging.warning(f"LIFX: CopyFrameBuffer failed: {e}")
        except Exception as e:
            logging.warning(f"LIFX: Failed to send Set64 packets: {e}")
        finally:
            try:
                sock.close()
            except Exception:
                pass
    
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
    
    def start_entertainment_mode(self) -> None:
        """Start entertainment mode for optimized rapid updates"""
        logging.info("LIFX: Starting entertainment mode")
        self._entertainment_mode = True
        
        # Reset metrics for this session
        self.metrics.reset()
        
        # Create dedicated sockets for each device for zero-latency updates
        for mac_hex, device in self.devices.items():
            if mac_hex not in self._entertainment_sockets:
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    # Increase send buffer for high-frequency updates
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
                    sock.setblocking(False)  # Non-blocking for entertainment
                    self._entertainment_sockets[mac_hex] = sock
                    logging.debug(f"LIFX: Created entertainment socket for {device.label}")
                except Exception as e:
                    logging.warning(f"LIFX: Failed to create entertainment socket for {device.label}: {e}")
        
        logging.info(f"LIFX: Entertainment mode started with {len(self._entertainment_sockets)} device sockets")
    
    def stop_entertainment_mode(self) -> None:
        """Stop entertainment mode and clean up resources"""
        logging.info("LIFX: Stopping entertainment mode")
        self._entertainment_mode = False
        
        # Log performance metrics
        stats = self.metrics.get_stats()
        if stats['total_messages'] > 0:
            logging.info(f"LIFX Entertainment Performance:")
            logging.info(f"  Total messages sent: {stats['total_messages']}")
            logging.info(f"  Messages dropped (rate limit): {stats['total_dropped']}")
            logging.info(f"  Packet errors: {stats['total_errors']}")
            logging.info(f"  Device count: {stats['device_count']}")
            logging.info(f"  Duration: {stats['elapsed_seconds']:.1f} seconds")
            avg_rate = stats['total_messages'] / stats['elapsed_seconds'] if stats['elapsed_seconds'] > 0 else 0
            logging.info(f"  Average rate: {avg_rate:.1f} msg/sec")
            
            if stats['total_dropped'] > 0:
                drop_rate = (stats['total_dropped'] / (stats['total_messages'] + stats['total_dropped'])) * 100
                logging.warning(f"  Drop rate: {drop_rate:.1f}% - Consider reducing update frequency")
        
        # Close and clean up entertainment sockets
        for mac_hex, sock in self._entertainment_sockets.items():
            try:
                sock.close()
            except:
                pass
        self._entertainment_sockets.clear()
        
        # Close and clean up rapid socket pool (WLED pattern)
        for ip, sock in self._rapid_socket_pool.items():
            try:
                sock.close()
                logging.debug(f"LIFX: Closed rapid socket for {ip}")
            except:
                pass
        self._rapid_socket_pool.clear()
    
    def send_rgb_rapid(self, light, r: int, g: int, b: int) -> None:
        """Send rapid RGB update for entertainment mode (WLED pattern - no device dict needed)"""
        # Get essentials from light object
        ip = light.protocol_cfg.get('ip')
        mac_hex = light.protocol_cfg.get('mac') or self._ensure_mac_for_light(light)
        
        if not ip or not mac_hex:
            logging.debug(f"LIFX: Missing IP or MAC for rapid update")
            return
        
        # Check rate limit (20 msg/sec per device)
        if not self.rate_limiter.can_send(mac_hex):
            self.metrics.record_drop(mac_hex)
            return  # Drop packet to respect LIFX rate limit
        
        # Get or create socket for this IP (WLED pattern)
        if ip not in self._rapid_socket_pool:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
                sock.setblocking(False)
                try:
                    sock.connect((ip, LIFX_PORT))
                except Exception:
                    pass
                self._rapid_socket_pool[ip] = sock
                logging.debug(f"LIFX: Created rapid socket for {ip}")
            except Exception as e:
                logging.debug(f"LIFX: Failed to create socket for {ip}: {e}")
                return
        
        # Convert RGB to HSBK
        h, s, v = self._rgb_to_hsv(r, g, b)
        
        # Build SetColor payload
        payload = struct.pack('<BHHHHI',
                            0,                          # Reserved
                            int(h * 65535),            # Hue
                            int(s * 65535),            # Saturation
                            int(v * 65535),            # Brightness
                            DEFAULT_KELVIN,            # Kelvin
                            0)                         # Duration (instant)
        
        # Build packet using standalone builder
        packet_builder = LifxPacket()
        try:
            mac_bytes = bytes.fromhex(mac_hex)
        except Exception as e:
            logging.debug(f"LIFX: Invalid MAC hex {mac_hex}: {e}")
            return
            
        packet = packet_builder.build_header(
            MSG_SET_COLOR, payload, 
            tagged=False, ack_required=False, res_required=False,
            target=mac_bytes
        )
        
        # Send directly using socket pool; on error, optionally fallback to lifxlan
        try:
            # Prefer connected send for lower overhead
            self._rapid_socket_pool[ip].send(packet)
            self.metrics.record_send(mac_hex)  # Track successful send
            return
        except Exception as e:
            self.metrics.record_error(mac_hex)  # Track error
            # Try to recreate socket on error
            logging.debug(f"LIFX: Send failed to {ip}, recreating socket: {e}")
            try:
                self._rapid_socket_pool[ip].close()
            except Exception:
                pass
            self._rapid_socket_pool.pop(ip, None)
            # Try once more with new socket
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
                sock.setblocking(False)
                try:
                    sock.connect((ip, LIFX_PORT))
                except Exception:
                    pass
                self._rapid_socket_pool[ip] = sock
                self._rapid_socket_pool[ip].send(packet)
                self.metrics.record_send(mac_hex)  # Track retry success
                return
            except Exception:
                self.metrics.record_error(mac_hex)  # Track retry error
        
        # Fallback: use lifxlan if available
        try:
            if LifxLAN is not None:
                mac = mac_hex
                if len(mac) == 12:
                    mac = ":".join(mac[i:i+2] for i in range(0, 12, 2))
                light_obj = LifxLAN.Light(mac, ip, port=LIFX_PORT)
                h, s, v = self._rgb_to_hsv(r, g, b)
                color = (int(h * 65535), int(s * 65535), int(v * 65535), DEFAULT_KELVIN)
                light_obj.set_color(color, duration=0, rapid=True)
                logging.debug(f"LIFX: lifxlan fallback set_color sent to {ip}")
        except Exception as e3:
            logging.debug(f"LIFX: lifxlan fallback failed for {ip}: {e3}")
    
    def send_rgb_zones_rapid(self, light, zone_colors: List[Tuple[int, int, int]]) -> None:
        """Send rapid RGB zone updates (WLED pattern - simplified)"""
        # Get essentials from light object
        ip = light.protocol_cfg.get('ip')
        mac_hex = light.protocol_cfg.get('mac') or self._ensure_mac_for_light(light)
        capabilities = light.protocol_cfg.get('capabilities', {})
        
        if not ip or not mac_hex:
            logging.debug(f"LIFX: Missing IP or MAC for zones rapid update")
            return
        
        # Check rate limit (20 msg/sec per device)
        if not self.rate_limiter.can_send(mac_hex):
            self.metrics.record_drop(mac_hex)
            return  # Drop packet to respect LIFX rate limit
        
        # Get or create socket for this IP
        if ip not in self._rapid_socket_pool:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
                sock.setblocking(False)
                try:
                    sock.connect((ip, LIFX_PORT))
                except Exception:
                    pass
                self._rapid_socket_pool[ip] = sock
                logging.debug(f"LIFX: Created rapid socket for {ip}")
            except Exception as e:
                logging.debug(f"LIFX: Failed to create socket for {ip}: {e}")
                return
        
        # Get MAC bytes
        try:
            mac_bytes = bytes.fromhex(mac_hex)
        except Exception as e:
            logging.debug(f"LIFX: Invalid MAC hex {mac_hex}: {e}")
            return
        
        device_type = capabilities.get('type', 'basic')
        
        # For basic devices without zones, just send first color
        if device_type == 'basic' or not zone_colors:
            if zone_colors:
                self.send_rgb_rapid(light, *zone_colors[0])
            return
        
        if device_type == 'multizone':
            # Convert RGB colors to HSBK
            hsbk_colors = []
            for r, g, b in zone_colors:
                h, s, v = self._rgb_to_hsv(r, g, b)
                hsbk_colors.append((
                    int(h * 65535),
                    int(s * 65535),
                    int(v * 65535),
                    DEFAULT_KELVIN
                ))
            
            # Send zones using SetExtendedColorZones if supported
            if capabilities.get('supports_extended', False):
                # Process in chunks of 82 zones
                total = len(hsbk_colors)
                for chunk_start in range(0, total, 82):
                    chunk = hsbk_colors[chunk_start:chunk_start + 82]
                    
                    # Build SetExtendedColorZones payload
                    apply_flag = 1 if (chunk_start + len(chunk) >= total) else 0
                    payload = struct.pack('<IBHB', 
                                        0,             # Duration (instant)
                                        apply_flag,    # Apply on last chunk only
                                        chunk_start,   # Starting zone index
                                        len(chunk))    # Number of colors
                    
                    # Add HSBK values
                    for color in chunk:
                        payload += struct.pack('<HHHH', *color)
                    
                    # Pad to 82 zones
                    while len(chunk) < 82:
                        payload += struct.pack('<HHHH', 0, 0, 0, DEFAULT_KELVIN)
                        chunk.append((0, 0, 0, DEFAULT_KELVIN))
                    
                    # Build and send packet
                    packet_builder = LifxPacket()
                    packet = packet_builder.build_header(
                        MSG_SET_EXTENDED_COLOR_ZONES, payload,
                        tagged=False, ack_required=False, res_required=False,
                        target=mac_bytes
                    )
                    
                    try:
                        self._rapid_socket_pool[ip].send(packet)
                    except Exception as e:
                        logging.debug(f"LIFX: Failed to send extended zones: {e}")
            else:
                # Send individual zones
                for i, color in enumerate(hsbk_colors):
                    payload = struct.pack('<BBHHHHIB',
                                        i,          # Start index
                                        i,          # End index
                                        color[0],   # Hue
                                        color[1],   # Saturation
                                        color[2],   # Brightness
                                        color[3],   # Kelvin
                                        0,          # Duration
                                        1)          # Apply
                    
                    packet_builder = LifxPacket()
                    packet = packet_builder.build_header(
                        MSG_SET_COLOR_ZONES, payload,
                        tagged=False, ack_required=False, res_required=False,
                        target=mac_bytes
                    )
                    
                    try:
                        self._rapid_socket_pool[ip].send(packet)
                    except Exception as e:
                        logging.debug(f"LIFX: Failed to send zone {i}: {e}")
                        
        elif device_type == 'matrix':
            # For matrix devices, use first color for now (simplified)
            # Full gradient support would require more complex tile mapping
            if zone_colors:
                self.send_rgb_rapid(light, *zone_colors[0])
        else:
            # Fallback to lifxlan single-color if available
            try:
                if LifxLAN is not None and zone_colors:
                    mac = mac_hex
                    if len(mac) == 12:
                        mac = ":".join(mac[i:i+2] for i in range(0, 12, 2))
                    light_obj = LifxLAN.Light(mac, ip, port=LIFX_PORT)
                    r, g, b = zone_colors[0]
                    h, s, v = self._rgb_to_hsv(r, g, b)
                    color = (int(h * 65535), int(s * 65535), int(v * 65535), DEFAULT_KELVIN)
                    light_obj.set_color(color, duration=0, rapid=True)
            except Exception:
                pass
    
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
                # Initialize cached state from Light object
                device.last_state = {
                    'on': light.state.get('on', False),
                    'bri': light.state.get('bri', 254),
                    'hue': light.state.get('hue', 0),
                    'sat': light.state.get('sat', 0),
                    'xy': light.state.get('xy', [0.5, 0.5]),
                    'ct': light.state.get('ct', 366),
                    'colormode': light.state.get('colormode', 'hs')
                }
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

def start_entertainment_mode():
    """Start entertainment mode for optimized rapid updates"""
    return _protocol.start_entertainment_mode()

def stop_entertainment_mode():
    """Stop entertainment mode and clean up resources"""
    return _protocol.stop_entertainment_mode()

def send_rgb_rapid(light, r, g, b):
    """Send rapid RGB update for entertainment mode"""
    return _protocol.send_rgb_rapid(light, r, g, b)

def send_rgb_zones_rapid(light, zone_colors):
    """Send rapid RGB zone updates for entertainment mode"""
    return _protocol.send_rgb_zones_rapid(light, zone_colors)

def update_entertainment_settings(settings: Dict[str, Any]):
    """Update runtime LIFX settings from the UI (used by /lifx-settings)."""
    return _protocol.update_entertainment_settings(settings)

def _unicast_discover_by_ip(ip: str):
    """Expose unicast helper for legacy manual-add code paths."""
    return _protocol._unicast_discover_by_ip(ip)
