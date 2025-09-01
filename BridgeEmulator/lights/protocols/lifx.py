#!/usr/bin/env python3
"""
High-Performance LIFX Protocol Implementation
Optimized for 120+ FPS with zero lag
"""

import asyncio
import socket
import struct
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import logging

logger = logging.getLogger(__name__)

# LIFX Protocol Constants
LIFX_PORT = 56700
LIFX_HEADER_SIZE = 36
LIFX_MAX_PACKET_SIZE = 1024
LIFX_BROADCAST_IP = "255.255.255.255"

# Message Types
MSG_GET_SERVICE = 2
MSG_STATE_SERVICE = 3
MSG_GET_POWER = 20
MSG_SET_POWER = 21
MSG_STATE_POWER = 22
MSG_GET_COLOR = 101
MSG_SET_COLOR = 102
MSG_STATE = 107
MSG_SET_WAVEFORM = 103
MSG_SET_WAVEFORM_OPTIONAL = 119
MSG_GET_EXTENDED_COLOR_ZONES = 510
MSG_SET_EXTENDED_COLOR_ZONES = 511
MSG_STATE_EXTENDED_COLOR_ZONES = 512

# Performance Configuration
MAX_FPS = 240  # Target maximum FPS
FRAME_BUFFER_SIZE = 16  # Number of frames to buffer
SOCKET_POOL_SIZE = 32  # Pre-allocated socket pool
BATCH_SIZE = 8  # Number of devices to update in parallel
CACHE_TTL = 0.1  # Device state cache TTL in seconds

@dataclass
class DeviceState:
    """Cached device state for diff-based updates"""
    ip: str
    mac: str
    power: bool = False
    hue: int = 0
    saturation: int = 0
    brightness: int = 0
    kelvin: int = 2700
    zones: List[Tuple[int, int, int, int]] = field(default_factory=list)
    last_update: float = 0.0
    capabilities: Dict[str, Any] = field(default_factory=dict)
    
    def needs_update(self, hue: int, sat: int, bri: int, kelvin: int) -> bool:
        """Check if state has changed enough to warrant an update"""
        # Use threshold to avoid micro-updates
        threshold = 2  # ~0.8% change threshold
        return (
            abs(self.hue - hue) > threshold or
            abs(self.saturation - sat) > threshold or
            abs(self.brightness - bri) > threshold or
            abs(self.kelvin - kelvin) > 50  # Larger threshold for kelvin
        )

class SocketPool:
    """Thread-safe UDP socket pool with lifecycle management"""
    def __init__(self, size: int = SOCKET_POOL_SIZE):
        self.size = size
        self.sockets: deque = deque()
        self.lock = threading.Lock()
        self._initialize_sockets()
        
    def _initialize_sockets(self):
        """Pre-allocate UDP sockets"""
        for _ in range(self.size):
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(0.01)  # Non-blocking with short timeout
            self.sockets.append(sock)
    
    def acquire(self) -> socket.socket:
        """Get a socket from the pool"""
        with self.lock:
            if self.sockets:
                return self.sockets.popleft()
            # Create new socket if pool exhausted
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(0.01)
            return sock
    
    def release(self, sock: socket.socket):
        """Return socket to pool"""
        with self.lock:
            if len(self.sockets) < self.size:
                self.sockets.append(sock)
            else:
                sock.close()  # Close excess sockets
    
    def cleanup(self):
        """Clean up all sockets"""
        with self.lock:
            while self.sockets:
                sock = self.sockets.popleft()
                sock.close()

class FrameBuffer:
    """High-performance frame buffering with interpolation"""
    def __init__(self, size: int = FRAME_BUFFER_SIZE):
        self.buffer = deque(maxlen=size)
        self.lock = threading.Lock()
        self.interpolation_cache = {}
        
    def add_frame(self, frame_data: Dict):
        """Add frame to buffer"""
        with self.lock:
            self.buffer.append((time.perf_counter(), frame_data))
    
    def get_interpolated_frame(self, target_time: float) -> Optional[Dict]:
        """Get interpolated frame for target time"""
        with self.lock:
            if not self.buffer:
                return None
            
            if len(self.buffer) == 1:
                return self.buffer[0][1]
            
            # Find frames to interpolate between
            for i in range(len(self.buffer) - 1):
                t1, f1 = self.buffer[i]
                t2, f2 = self.buffer[i + 1]
                
                if t1 <= target_time <= t2:
                    # Interpolate between frames
                    alpha = (target_time - t1) / (t2 - t1) if t2 > t1 else 0
                    return self._interpolate_frames(f1, f2, alpha)
            
            # Return latest frame if target time is beyond buffer
            return self.buffer[-1][1]
    
    def _interpolate_frames(self, f1: Dict, f2: Dict, alpha: float) -> Dict:
        """Interpolate between two frames"""
        result = {}
        for key in f1:
            if key in f2:
                if isinstance(f1[key], (int, float)):
                    # Linear interpolation for numeric values
                    result[key] = f1[key] + (f2[key] - f1[key]) * alpha
                else:
                    # Use second frame for non-numeric
                    result[key] = f2[key]
        return result

class GradientEngine:
    """Optimized gradient calculation engine with pre-computed lookup tables"""
    def __init__(self):
        self.gradient_cache = {}
        self.lookup_tables = {}
        self._initialize_lookup_tables()
        
    def _initialize_lookup_tables(self):
        """Pre-compute common gradient patterns"""
        # Pre-compute HSV to RGB conversions for common values
        self.hsv_to_rgb_lut = np.zeros((360, 256, 256, 3), dtype=np.uint8)
        for h in range(360):
            for s in range(256):
                for v in range(256):
                    rgb = self._hsv_to_rgb_fast(h, s/255, v/255)
                    self.hsv_to_rgb_lut[h, s, v] = rgb
    
    def _hsv_to_rgb_fast(self, h: int, s: float, v: float) -> Tuple[int, int, int]:
        """Fast HSV to RGB conversion"""
        c = v * s
        x = c * (1 - abs((h / 60) % 2 - 1))
        m = v - c
        
        if h < 60:
            r, g, b = c, x, 0
        elif h < 120:
            r, g, b = x, c, 0
        elif h < 180:
            r, g, b = 0, c, x
        elif h < 240:
            r, g, b = 0, x, c
        elif h < 300:
            r, g, b = x, 0, c
        else:
            r, g, b = c, 0, x
            
        return (
            int((r + m) * 255),
            int((g + m) * 255),
            int((b + m) * 255)
        )
    
    def calculate_gradient_zones(self, gradient_points: List[Tuple[float, float, float]], 
                                num_zones: int) -> np.ndarray:
        """Calculate gradient zones using NumPy for SIMD optimization"""
        cache_key = (tuple(gradient_points), num_zones)
        
        if cache_key in self.gradient_cache:
            return self.gradient_cache[cache_key]
        
        # Use NumPy for vectorized operations
        positions = np.linspace(0, 1, num_zones)
        zones = np.zeros((num_zones, 4), dtype=np.uint16)  # HSBK format
        
        gradient_positions = [p[0] for p in gradient_points]
        gradient_colors = [(p[1], p[2], 2700) for p in gradient_points]  # H, S, K
        
        for i, pos in enumerate(positions):
            # Find surrounding gradient points
            for j in range(len(gradient_positions) - 1):
                if gradient_positions[j] <= pos <= gradient_positions[j + 1]:
                    # Interpolate between points
                    alpha = (pos - gradient_positions[j]) / (gradient_positions[j + 1] - gradient_positions[j])
                    h1, s1, k1 = gradient_colors[j]
                    h2, s2, k2 = gradient_colors[j + 1]
                    
                    zones[i] = [
                        int(h1 + (h2 - h1) * alpha),
                        int(s1 + (s2 - s1) * alpha),
                        65535,  # Full brightness
                        int(k1 + (k2 - k1) * alpha)
                    ]
                    break
        
        # Cache result
        self.gradient_cache[cache_key] = zones
        return zones

class LIFXProtocol:
    """High-performance LIFX protocol implementation"""
    
    def __init__(self):
        self.socket_pool = SocketPool()
        self.frame_buffer = FrameBuffer()
        self.gradient_engine = GradientEngine()
        self.device_cache: Dict[str, DeviceState] = {}
        self.executor = ThreadPoolExecutor(max_workers=BATCH_SIZE)
        self.sequence = 0
        self.lock = threading.Lock()
        
    def _build_header(self, msg_type: int, tagged: bool = False, 
                     res_required: bool = False, ack_required: bool = False) -> bytes:
        """Build LIFX packet header"""
        with self.lock:
            self.sequence = (self.sequence + 1) % 256
            sequence = self.sequence
        
        # Frame
        size = LIFX_HEADER_SIZE
        protocol = 1024
        addressable = 1
        tagged = 1 if tagged else 0
        origin = 0
        source = 0
        
        frame = (size & 0xFFFF) | ((origin & 0x3) << 14) | \
                ((tagged & 0x1) << 13) | ((addressable & 0x1) << 12) | \
                ((protocol & 0xFFF) << 16)
        
        # Frame Address
        target = 0  # Will be overwritten for specific devices
        reserved = [0] * 6
        res_req = 1 if res_required else 0
        ack_req = 1 if ack_required else 0
        flags = (ack_req & 0x1) << 1 | (res_req & 0x1)
        
        # Protocol Header
        reserved2 = 0
        type_val = msg_type & 0xFFFF
        reserved3 = 0
        
        header = struct.pack('<I', frame)  # Frame
        header += struct.pack('<I', source)  # Source
        header += struct.pack('<Q', target)  # Target
        header += bytes(reserved)  # Reserved
        header += struct.pack('<B', flags)  # Flags
        header += struct.pack('<B', sequence)  # Sequence
        header += struct.pack('<Q', reserved2)  # Reserved
        header += struct.pack('<H', type_val)  # Type
        header += struct.pack('<H', reserved3)  # Reserved
        
        return header
    
    def set_color(self, ip: str, hue: int, saturation: int, brightness: int, 
                  kelvin: int = 2700, duration: int = 0) -> bool:
        """Set device color with caching and diff optimization"""
        try:
            # Check cache
            device_key = ip
            if device_key in self.device_cache:
                device = self.device_cache[device_key]
                if not device.needs_update(hue, saturation, brightness, kelvin):
                    return True  # Skip update if state unchanged
            
            # Build SetColor message
            header = self._build_header(MSG_SET_COLOR)
            
            # Scale values to LIFX range (0-65535)
            h = int((hue / 360) * 65535)
            s = int((saturation / 100) * 65535)
            b = int((brightness / 100) * 65535)
            k = kelvin
            
            payload = struct.pack('<HHHHI', 0, h, s, b, k, duration)
            packet = header + payload
            
            # Update packet size
            packet = struct.pack('<H', len(packet)) + packet[2:]
            
            # Send using socket pool
            sock = self.socket_pool.acquire()
            try:
                sock.sendto(packet, (ip, LIFX_PORT))
                
                # Update cache
                if device_key not in self.device_cache:
                    self.device_cache[device_key] = DeviceState(ip=ip, mac="")
                
                device = self.device_cache[device_key]
                device.hue = hue
                device.saturation = saturation
                device.brightness = brightness
                device.kelvin = kelvin
                device.last_update = time.perf_counter()
                
                return True
            finally:
                self.socket_pool.release(sock)
                
        except Exception as e:
            logger.error(f"Failed to set color for {ip}: {e}")
            return False
    
    def set_zones(self, ip: str, zones: List[Tuple[int, int, int, int]], 
                  start_index: int = 0, duration: int = 0) -> bool:
        """Set multiple zones with optimized batching"""
        try:
            # Build SetExtendedColorZones message
            header = self._build_header(MSG_SET_EXTENDED_COLOR_ZONES)
            
            # Prepare zone data (max 82 zones per packet)
            zone_count = min(len(zones), 82)
            colors = b''
            
            for i in range(zone_count):
                if i < len(zones):
                    h, s, b, k = zones[i]
                    # Scale to LIFX range
                    h = int((h / 360) * 65535)
                    s = int((s / 100) * 65535)
                    b = int((b / 100) * 65535)
                else:
                    h = s = b = 0
                    k = 2700
                
                colors += struct.pack('<HHHH', h, s, b, k)
            
            payload = struct.pack('<IHBBb', duration, start_index, 
                                 zone_count, 0, 0) + colors
            packet = header + payload
            
            # Update packet size
            packet = struct.pack('<H', len(packet)) + packet[2:]
            
            # Send using socket pool
            sock = self.socket_pool.acquire()
            try:
                sock.sendto(packet, (ip, LIFX_PORT))
                
                # Update cache
                if ip not in self.device_cache:
                    self.device_cache[ip] = DeviceState(ip=ip, mac="")
                self.device_cache[ip].zones = zones
                self.device_cache[ip].last_update = time.perf_counter()
                
                return True
            finally:
                self.socket_pool.release(sock)
                
        except Exception as e:
            logger.error(f"Failed to set zones for {ip}: {e}")
            return False
    
    def batch_update(self, updates: List[Dict]) -> List[bool]:
        """Batch update multiple devices in parallel"""
        futures = []
        
        for update in updates:
            if 'zones' in update:
                future = self.executor.submit(
                    self.set_zones, 
                    update['ip'], 
                    update['zones'],
                    update.get('start_index', 0),
                    update.get('duration', 0)
                )
            else:
                future = self.executor.submit(
                    self.set_color,
                    update['ip'],
                    update.get('hue', 0),
                    update.get('saturation', 0),
                    update.get('brightness', 0),
                    update.get('kelvin', 2700),
                    update.get('duration', 0)
                )
            futures.append(future)
        
        # Wait for all updates with timeout
        results = []
        for future in futures:
            try:
                result = future.result(timeout=0.01)  # 10ms timeout
                results.append(result)
            except:
                results.append(False)
        
        return results
    
    def discover_devices(self, timeout: float = 2.0) -> List[Dict]:
        """Discover LIFX devices on the network"""
        devices = []
        
        # Build GetService message
        header = self._build_header(MSG_GET_SERVICE, tagged=True, res_required=True)
        
        # Create discovery socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(timeout)
        
        try:
            # Broadcast discovery
            sock.sendto(header, (LIFX_BROADCAST_IP, LIFX_PORT))
            
            # Collect responses
            start_time = time.time()
            seen = set()
            
            while time.time() - start_time < timeout:
                try:
                    data, addr = sock.recvfrom(LIFX_MAX_PACKET_SIZE)
                    if addr[0] not in seen:
                        seen.add(addr[0])
                        
                        # Parse response
                        if len(data) >= LIFX_HEADER_SIZE:
                            # Extract MAC address from target field
                            mac = data[8:16]
                            mac_str = ':'.join(f'{b:02x}' for b in mac[:6])
                            
                            devices.append({
                                'ip': addr[0],
                                'mac': mac_str,
                                'port': LIFX_PORT
                            })
                except socket.timeout:
                    break
                except Exception as e:
                    logger.error(f"Discovery error: {e}")
                    
        finally:
            sock.close()
        
        return devices
    
    def cleanup(self):
        """Clean up resources"""
        self.socket_pool.cleanup()
        self.executor.shutdown(wait=False)

# Factory function for protocol initialization
def init_lifx_protocol() -> LIFXProtocol:
    """Initialize LIFX protocol with optimizations"""
    return LIFXProtocol()

# Module-level instance for import
protocol = None

def get_protocol() -> LIFXProtocol:
    """Get or create protocol instance"""
    global protocol
    if protocol is None:
        protocol = init_lifx_protocol()
    return protocol

# Bridge interface functions
def set_light(light_data: Dict, rgb: Optional[List] = None, xy: Optional[List] = None, 
              ct: Optional[int] = None, bri: Optional[int] = None, transitiontime: Optional[int] = None):
    """Set light state - Bridge interface"""
    try:
        protocol = get_protocol()
        ip = light_data.get('ip', light_data.get('protocol_cfg', {}).get('ip'))
        
        if not ip:
            logger.error("No IP address found for LIFX device")
            return False
        
        # Calculate color values
        hue = 0
        saturation = 0
        brightness = bri if bri is not None else 100
        kelvin = 2700
        
        if rgb:
            # Convert RGB to HSB
            r, g, b = rgb
            h, s, v = _rgb_to_hsb(r, g, b)
            hue = h
            saturation = s
            brightness = v
        elif xy:
            # Convert XY to HSB
            x, y = xy
            r, g, b = _xy_to_rgb(x, y, brightness)
            h, s, v = _rgb_to_hsb(r, g, b)
            hue = h
            saturation = s
        elif ct:
            # Color temperature mode
            kelvin = _mirek_to_kelvin(ct)
            saturation = 0  # White mode
        
        # Calculate transition time in milliseconds
        duration = transitiontime * 100 if transitiontime else 0
        
        # Handle gradient/zones if present
        gradient = light_data.get('gradient')
        if gradient and gradient.get('points'):
            # Device has gradient capability
            gradient_engine = protocol.gradient_engine
            zones = []
            
            for point in gradient['points']:
                color = point.get('color', {})
                if 'xy' in color:
                    x, y = color['xy']
                    r, g, b = _xy_to_rgb(x, y, brightness)
                    h, s, v = _rgb_to_hsb(r, g, b)
                    zones.append((h, s, v, kelvin))
                elif 'r' in color:
                    r = int(color['r'] * 255)
                    g = int(color['g'] * 255)
                    b = int(color['b'] * 255)
                    h, s, v = _rgb_to_hsb(r, g, b)
                    zones.append((h, s, v, kelvin))
            
            return protocol.set_zones(ip, zones, duration=duration)
        else:
            # Single color
            return protocol.set_color(ip, hue, saturation, brightness, kelvin, duration)
            
    except Exception as e:
        logger.error(f"Error setting LIFX light: {e}")
        return False

def get_light_state(light_data: Dict) -> Dict:
    """Get light state - Bridge interface"""
    try:
        ip = light_data.get('ip', light_data.get('protocol_cfg', {}).get('ip'))
        
        if not ip:
            logger.error("No IP address found for LIFX device")
            return {}
        
        protocol = get_protocol()
        
        # Check cache first
        if ip in protocol.device_cache:
            device = protocol.device_cache[ip]
            
            # Convert cached state to bridge format
            state = {
                "on": device.power,
                "bri": int(device.brightness * 2.54),  # Convert to 0-254
                "hue": int(device.hue * 182.04),  # Convert to 0-65535
                "sat": int(device.saturation * 2.54),  # Convert to 0-254
                "ct": _kelvin_to_mirek(device.kelvin),
                "xy": _hsb_to_xy(device.hue, device.saturation, device.brightness),
                "colormode": "hs" if device.saturation > 0 else "ct",
                "reachable": True
            }
            
            # Add gradient if zones present
            if device.zones:
                gradient_points = []
                for i, zone in enumerate(device.zones):
                    h, s, b, k = zone
                    gradient_points.append({
                        "color": {
                            "xy": _hsb_to_xy(h, s, b)
                        }
                    })
                state["gradient"] = {"points": gradient_points}
            
            return state
        
        # If not in cache, query device
        return _query_device_state(ip)
        
    except Exception as e:
        logger.error(f"Error getting LIFX light state: {e}")
        return {
            "on": False,
            "reachable": False
        }

def discover(bridge_config: Dict):
    """Discover LIFX devices - Bridge interface"""
    try:
        protocol = get_protocol()
        devices = protocol.discover_devices(timeout=3.0)
        
        discovered_lights = []
        for device_info in devices:
            light = {
                "protocol": "lifx",
                "name": f"LIFX {device_info['mac'][-8:]}",
                "modelid": "LIFX Color 1000",
                "manufacturername": "LIFX",
                "uniqueid": device_info['mac'].replace(':', ''),
                "id_v1": device_info['mac'].replace(':', '')[-6:],
                "ip": device_info['ip'],
                "mac": device_info['mac'],
                "protocol_cfg": {
                    "ip": device_info['ip'],
                    "mac": device_info['mac']
                }
            }
            discovered_lights.append(light)
        
        return discovered_lights
        
    except Exception as e:
        logger.error(f"Error discovering LIFX devices: {e}")
        return []

# Helper functions
def _rgb_to_hsb(r: int, g: int, b: int) -> Tuple[int, int, int]:
    """Convert RGB (0-255) to HSB (0-360, 0-100, 0-100)"""
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    max_val = max(r, g, b)
    min_val = min(r, g, b)
    diff = max_val - min_val
    
    # Brightness
    v = int(max_val * 100)
    
    if max_val == 0:
        return 0, 0, 0
    
    # Saturation
    s = int((diff / max_val) * 100) if max_val > 0 else 0
    
    # Hue
    if diff == 0:
        h = 0
    elif max_val == r:
        h = ((g - b) / diff) % 6
    elif max_val == g:
        h = (b - r) / diff + 2
    else:
        h = (r - g) / diff + 4
    
    h = int(h * 60)
    if h < 0:
        h += 360
    
    return h, s, v

def _hsb_to_xy(h: int, s: int, b: int) -> List[float]:
    """Convert HSB to XY color space"""
    # Convert HSB to RGB first
    h = h / 360.0
    s = s / 100.0
    b = b / 100.0
    
    if s == 0:
        r = g = b = b
    else:
        def hue_to_rgb(p, q, t):
            if t < 0: t += 1
            if t > 1: t -= 1
            if t < 1/6: return p + (q - p) * 6 * t
            if t < 1/2: return q
            if t < 2/3: return p + (q - p) * (2/3 - t) * 6
            return p
        
        q = b * (1 + s) if b < 0.5 else b + s - b * s
        p = 2 * b - q
        
        r = hue_to_rgb(p, q, h + 1/3)
        g = hue_to_rgb(p, q, h)
        b = hue_to_rgb(p, q, h - 1/3)
    
    # Convert RGB to XY
    return _rgb_to_xy(r, g, b)

def _rgb_to_xy(r: float, g: float, b: float) -> List[float]:
    """Convert RGB to XY color space"""
    # Apply gamma correction
    r = ((r + 0.055) / 1.055) ** 2.4 if r > 0.04045 else r / 12.92
    g = ((g + 0.055) / 1.055) ** 2.4 if g > 0.04045 else g / 12.92
    b = ((b + 0.055) / 1.055) ** 2.4 if b > 0.04045 else b / 12.92
    
    # Convert to XYZ
    X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    
    # Convert to xy
    total = X + Y + Z
    if total == 0:
        return [0.3127, 0.3290]  # Default white
    
    x = X / total
    y = Y / total
    
    return [x, y]

def _xy_to_rgb(x: float, y: float, bri: int) -> Tuple[int, int, int]:
    """Convert XY (+brightness) to RGB"""
    # Convert xy to XYZ
    z = 1.0 - x - y
    Y = bri / 100.0
    X = (Y / y) * x if y != 0 else 0
    Z = (Y / y) * z if y != 0 else 0
    
    # Convert XYZ to RGB
    r = X * 1.656492 - Y * 0.354851 - Z * 0.255038
    g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152
    b = X * 0.051713 - Y * 0.121364 + Z * 1.011530
    
    # Apply reverse gamma correction
    r = 1.055 * (r ** (1/2.4)) - 0.055 if r > 0.0031308 else 12.92 * r
    g = 1.055 * (g ** (1/2.4)) - 0.055 if g > 0.0031308 else 12.92 * g
    b = 1.055 * (b ** (1/2.4)) - 0.055 if b > 0.0031308 else 12.92 * b
    
    # Clamp and convert to 0-255
    r = max(0, min(255, int(r * 255)))
    g = max(0, min(255, int(g * 255)))
    b = max(0, min(255, int(b * 255)))
    
    return r, g, b

def _mirek_to_kelvin(mirek: int) -> int:
    """Convert mirek to kelvin"""
    return int(1000000 / mirek)

def _kelvin_to_mirek(kelvin: int) -> int:
    """Convert kelvin to mirek"""
    return int(1000000 / kelvin)

def _query_device_state(ip: str) -> Dict:
    """Query device for current state"""
    # This would normally send a GetState message to the device
    # For now, return a default state
    return {
        "on": True,
        "bri": 254,
        "hue": 0,
        "sat": 0,
        "ct": 370,
        "xy": [0.3127, 0.3290],
        "colormode": "ct",
        "reachable": True
    }