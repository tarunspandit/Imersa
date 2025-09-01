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