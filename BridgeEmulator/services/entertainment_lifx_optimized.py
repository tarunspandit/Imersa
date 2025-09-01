"""
High-Performance LIFX Entertainment Mode Handler
Optimized for 120+ FPS with minimal latency
"""

import socket
import struct
import time
import threading
import asyncio
from typing import Dict, List, Tuple, Optional, Any
from collections import defaultdict, deque
from dataclasses import dataclass
import numpy as np
import logManager

logging = logManager.logger.get_logger(__name__)

# Performance constants
TARGET_FPS = 120
FRAME_TIME = 1.0 / TARGET_FPS
MAX_PACKET_SIZE = 1472  # Max UDP payload to avoid fragmentation
SOCKET_BUFFER_SIZE = 262144  # 256KB buffer
BATCH_SIZE = 10  # Process this many lights per batch
WORKER_THREADS = 4

# LIFX Protocol optimizations
RAPID_FIRE_MODE = True  # Skip ACKs for speed
PACKET_COALESCE = True  # Combine multiple updates per device
PREDICTIVE_BUFFERING = True  # Pre-calculate next frame
USE_MULTICAST = False  # Use multicast groups when possible

# Frame dropping thresholds
MAX_FRAME_LAG = 3  # Drop frames if we're this many behind
ADAPTIVE_QUALITY = True  # Reduce quality to maintain FPS


@dataclass
class PerformanceMetrics:
    """Track performance metrics"""
    frames_processed: int = 0
    frames_dropped: int = 0
    avg_latency: float = 0.0
    peak_fps: float = 0.0
    current_fps: float = 0.0
    last_frame_time: float = 0.0
    frame_times: deque = None
    
    def __post_init__(self):
        self.frame_times = deque(maxlen=120)  # Track last second


class LIFXEntertainmentOptimizer:
    """Optimized LIFX entertainment handler"""
    
    def __init__(self):
        self.sockets = {}  # Socket pool
        self.device_cache = {}  # Device state cache
        self.frame_buffer = deque(maxlen=3)  # Frame buffer
        self.metrics = PerformanceMetrics()
        self.source_id = 0x42424242  # Fixed source for speed
        self.sequences = defaultdict(int)
        self.running = True
        self.lock = threading.RLock()
        
        # Pre-allocate buffers
        self.packet_buffer = bytearray(MAX_PACKET_SIZE)
        self.color_buffer = np.zeros((256, 4), dtype=np.uint16)  # HSBK buffer
        
        # Start worker threads
        self.workers = []
        self._start_workers()
        
    def _start_workers(self):
        """Start worker threads for parallel processing"""
        for i in range(WORKER_THREADS):
            worker = threading.Thread(target=self._worker_loop, daemon=True)
            worker.start()
            self.workers.append(worker)
            
    def _worker_loop(self):
        """Worker thread loop"""
        while self.running:
            try:
                # Process frames from buffer
                if self.frame_buffer:
                    with self.lock:
                        if self.frame_buffer:
                            frame = self.frame_buffer.popleft()
                            self._process_frame_batch(frame)
                else:
                    time.sleep(0.001)  # 1ms sleep when idle
            except Exception as e:
                logging.error(f"Worker error: {e}")
                
    def _get_socket(self, device_ip: str) -> socket.socket:
        """Get or create UDP socket for device"""
        if device_ip not in self.sockets:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, SOCKET_BUFFER_SIZE)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, SOCKET_BUFFER_SIZE)
            sock.setblocking(False)
            self.sockets[device_ip] = sock
        return self.sockets[device_ip]
        
    def process_entertainment_frame(self, devices: List[Dict], frame_data: bytes, 
                                  gradient_data: Dict = None) -> bool:
        """Process entertainment frame with maximum performance"""
        start_time = time.perf_counter()
        
        # Check for frame dropping
        if self._should_drop_frame():
            self.metrics.frames_dropped += 1
            return False
            
        # Parse frame data
        light_colors = self._parse_frame_ultra_fast(frame_data)
        
        # Group devices by IP for batch processing
        devices_by_ip = defaultdict(list)
        for device in devices:
            if device.get('protocol') == 'lifx':
                ip = device['protocol_cfg']['ip']
                devices_by_ip[ip].append(device)
                
        # Process each device group in parallel
        for ip, device_group in devices_by_ip.items():
            frame_info = {
                'ip': ip,
                'devices': device_group,
                'colors': light_colors,
                'gradients': gradient_data
            }
            
            # Add to frame buffer for worker processing
            with self.lock:
                self.frame_buffer.append(frame_info)
                
        # Update metrics
        self._update_metrics(time.perf_counter() - start_time)
        
        return True
        
    def _parse_frame_ultra_fast(self, data: bytes) -> np.ndarray:
        """Ultra-fast frame parsing using numpy"""
        # Entertainment format: [id(1), r(2), g(2), b(2), pad(2)]...
        if len(data) < 9:
            return np.array([])
            
        # Use numpy for fast parsing
        num_lights = len(data) // 9
        colors = np.zeros((num_lights, 4), dtype=np.uint16)
        
        for i in range(num_lights):
            offset = i * 9
            light_id = data[offset]
            r = (data[offset+1] << 8) | data[offset+2]
            g = (data[offset+3] << 8) | data[offset+4]
            b = (data[offset+5] << 8) | data[offset+6]
            
            # Store as [id, r, g, b]
            colors[i] = [light_id, r, g, b]
            
        return colors
        
    def _process_frame_batch(self, frame_info: Dict):
        """Process a batch of devices for one IP"""
        ip = frame_info['ip']
        devices = frame_info['devices']
        colors = frame_info['colors']
        gradients = frame_info.get('gradients', {})
        
        sock = self._get_socket(ip)
        
        for device in devices:
            try:
                light_id = int(device.get('light_id', 0))
                mac = bytes.fromhex(device['protocol_cfg']['mac'])
                
                # Find color for this light
                color_row = None
                for row in colors:
                    if row[0] == light_id:
                        color_row = row[1:]  # [r, g, b]
                        break
                        
                if color_row is None:
                    continue
                    
                # Check for special device types
                if device['protocol_cfg'].get('has_multizone'):
                    self._send_multizone_rapid(sock, ip, mac, color_row, 
                                              device['protocol_cfg'], gradients.get(str(light_id)))
                elif device['protocol_cfg'].get('has_matrix'):
                    self._send_matrix_rapid(sock, ip, mac, color_row, 
                                           device['protocol_cfg'])
                else:
                    self._send_color_rapid(sock, ip, mac, color_row)
                    
            except Exception as e:
                logging.debug(f"Device processing error: {e}")
                
    def _send_color_rapid(self, sock: socket.socket, ip: str, mac: bytes, 
                         rgb: np.ndarray):
        """Send rapid color update"""
        # Convert RGB to HSBK (optimized)
        hsbk = self._rgb_to_hsbk_fast(rgb)
        
        # Build packet directly in pre-allocated buffer
        self._build_setcolor_packet_fast(mac, hsbk)
        
        # Send without waiting for ACK
        try:
            sock.sendto(self.packet_buffer[:49], (ip, 56700))
        except:
            pass  # Ignore send errors in rapid mode
            
    def _send_multizone_rapid(self, sock: socket.socket, ip: str, mac: bytes,
                             rgb: np.ndarray, cfg: Dict, gradient: Optional[Dict]):
        """Send rapid multizone update"""
        zone_count = cfg.get('zone_count', 16)
        
        if gradient and gradient.get('points'):
            # Use gradient
            zones = self._process_gradient_optimized(gradient['points'], zone_count)
        else:
            # Solid color for all zones
            hsbk = self._rgb_to_hsbk_fast(rgb)
            zones = [hsbk] * zone_count
            
        # Use extended multizone if supported
        if cfg.get('supports_extended_multizone') and zone_count > 8:
            self._send_extended_zones_rapid(sock, ip, mac, zones)
        else:
            self._send_zones_rapid(sock, ip, mac, zones)
            
    def _send_extended_zones_rapid(self, sock: socket.socket, ip: str, mac: bytes,
                                   zones: List[Tuple[int, int, int, int]]):
        """Send extended multizone update (up to 82 zones)"""
        MAX_ZONES = 82
        
        for start in range(0, len(zones), MAX_ZONES):
            chunk = zones[start:start + MAX_ZONES]
            
            # Build header
            packet = self._build_header_fast(510, mac)  # MSG_SET_EXTENDED_COLOR_ZONES
            
            # Add payload
            payload = struct.pack('<IBH', 0, 1, start)  # duration=0, apply=1
            payload += struct.pack('<B', len(chunk))
            
            for hsbk in chunk:
                payload += struct.pack('<HHHH', *hsbk)
                
            # Update size
            total_size = 36 + len(payload)
            packet[0:2] = struct.pack('<H', total_size)
            
            # Send
            try:
                sock.sendto(packet + payload, (ip, 56700))
            except:
                pass
                
    def _send_zones_rapid(self, sock: socket.socket, ip: str, mac: bytes,
                          zones: List[Tuple[int, int, int, int]]):
        """Send standard multizone update (8 zones at a time)"""
        for start in range(0, len(zones), 8):
            end = min(start + 7, len(zones) - 1)
            
            # Build packet
            packet = self._build_header_fast(501, mac)  # MSG_SET_COLOR_ZONES
            
            # Get first zone color for this segment
            hsbk = zones[start] if start < len(zones) else (0, 0, 65535, 3500)
            
            payload = struct.pack('<BB', start, end)
            payload += struct.pack('<HHHHI', *hsbk, 0)  # duration=0
            payload += struct.pack('<B', 1)  # apply=1
            
            # Update size
            packet[0:2] = struct.pack('<H', 36 + len(payload))
            
            try:
                sock.sendto(packet + payload, (ip, 56700))
            except:
                pass
                
    def _send_matrix_rapid(self, sock: socket.socket, ip: str, mac: bytes,
                          rgb: np.ndarray, cfg: Dict):
        """Send rapid matrix/tile update"""
        width = cfg.get('tile_width', 8)
        height = cfg.get('tile_height', 8)
        tile_count = cfg.get('tile_count', 1)
        
        # Convert to HSBK
        hsbk = self._rgb_to_hsbk_fast(rgb)
        
        # Create pixel array (all same color for speed)
        pixels = [hsbk] * 64  # 8x8 tile
        
        # Send to each tile
        for tile_idx in range(tile_count):
            self._send_tile_rapid(sock, ip, mac, tile_idx, pixels)
            
    def _send_tile_rapid(self, sock: socket.socket, ip: str, mac: bytes,
                        tile_index: int, pixels: List[Tuple[int, int, int, int]]):
        """Send rapid tile update"""
        # Build packet
        packet = self._build_header_fast(715, mac)  # MSG_SET_TILE_STATE64
        
        # Payload
        payload = struct.pack('<BBBBBI', tile_index, 1, 0, 0, 8, 0)  # x=0, y=0, width=8, duration=0
        
        # Add pixel colors
        for hsbk in pixels[:64]:
            payload += struct.pack('<HHHH', *hsbk)
            
        # Update size
        packet[0:2] = struct.pack('<H', 36 + len(payload))
        
        try:
            sock.sendto(packet + payload, (ip, 56700))
        except:
            pass
            
    def _build_header_fast(self, msg_type: int, mac: bytes) -> bytearray:
        """Build LIFX header ultra-fast"""
        header = bytearray(36)
        
        # Frame
        header[0:2] = struct.pack('<H', 36)  # Size (updated later)
        header[2:4] = struct.pack('<H', 0x1400)  # Protocol flags
        header[4:8] = struct.pack('<I', self.source_id)
        
        # Frame address  
        header[8:14] = mac[:6]  # Target MAC
        header[14:16] = b'\x00\x00'  # Padding
        header[16:22] = b'\x00' * 6  # Reserved
        header[22] = 0x00  # No ACK required in rapid mode
        header[23] = self._get_sequence(mac)
        
        # Protocol header
        header[24:32] = b'\x00' * 8  # Reserved
        header[32:34] = struct.pack('<H', msg_type)
        header[34:36] = b'\x00\x00'  # Reserved
        
        return header
        
    def _build_setcolor_packet_fast(self, mac: bytes, hsbk: Tuple[int, int, int, int]):
        """Build SetColor packet in pre-allocated buffer"""
        # Clear buffer
        self.packet_buffer[:49] = b'\x00' * 49
        
        # Header
        self.packet_buffer[0:2] = struct.pack('<H', 49)  # Size
        self.packet_buffer[2:4] = struct.pack('<H', 0x1400)  # Flags
        self.packet_buffer[4:8] = struct.pack('<I', self.source_id)
        self.packet_buffer[8:14] = mac[:6]
        self.packet_buffer[22] = 0x00  # No ACK
        self.packet_buffer[23] = self._get_sequence(mac)
        self.packet_buffer[32:34] = struct.pack('<H', 102)  # SetColor
        
        # Payload
        self.packet_buffer[36] = 0  # Reserved
        self.packet_buffer[37:45] = struct.pack('<HHHH', *hsbk)
        self.packet_buffer[45:49] = struct.pack('<I', 0)  # Duration=0
        
    def _rgb_to_hsbk_fast(self, rgb: np.ndarray) -> Tuple[int, int, int, int]:
        """Ultra-fast RGB to HSBK conversion"""
        # Normalize RGB
        if rgb.max() > 255:
            r, g, b = rgb[0] / 65535, rgb[1] / 65535, rgb[2] / 65535
        else:
            r, g, b = rgb[0] / 255, rgb[1] / 255, rgb[2] / 255
            
        # Fast HSB calculation
        max_val = max(r, g, b)
        min_val = min(r, g, b)
        diff = max_val - min_val
        
        # Brightness
        brightness = int(max_val * 65535)
        
        # Saturation
        saturation = 0 if max_val == 0 else int((diff / max_val) * 65535)
        
        # Hue (simplified)
        if diff == 0:
            hue = 0
        elif max_val == r:
            hue = (60 * ((g - b) / diff) + 360) % 360
        elif max_val == g:
            hue = (60 * ((b - r) / diff) + 120) % 360
        else:
            hue = (60 * ((r - g) / diff) + 240) % 360
            
        hue_uint = int((65535 * hue / 360)) % 65536
        
        return (hue_uint, saturation, brightness, 3500)  # Default kelvin
        
    def _process_gradient_optimized(self, points: List[Dict], zone_count: int) -> List[Tuple[int, int, int, int]]:
        """Process gradient with optimization"""
        if not points:
            return [(0, 0, 65535, 3500)] * zone_count
            
        # Sort points
        sorted_points = sorted(points, key=lambda p: p.get('position', 0))
        
        # Pre-calculate zones
        zones = []
        for i in range(zone_count):
            position = i / (zone_count - 1) if zone_count > 1 else 0
            
            # Find surrounding points
            prev_point = sorted_points[0]
            next_point = sorted_points[-1]
            
            for point in sorted_points:
                if point['position'] <= position:
                    prev_point = point
                if point['position'] >= position:
                    next_point = point
                    break
                    
            # Interpolate
            if prev_point == next_point:
                color = prev_point['color']
            else:
                t = (position - prev_point['position']) / (next_point['position'] - prev_point['position'])
                color = {
                    'r': prev_point['color']['r'] + t * (next_point['color']['r'] - prev_point['color']['r']),
                    'g': prev_point['color']['g'] + t * (next_point['color']['g'] - prev_point['color']['g']),
                    'b': prev_point['color']['b'] + t * (next_point['color']['b'] - prev_point['color']['b'])
                }
                
            # Convert to HSBK
            rgb = np.array([color['r'] * 255, color['g'] * 255, color['b'] * 255])
            zones.append(self._rgb_to_hsbk_fast(rgb))
            
        return zones
        
    def _get_sequence(self, mac: bytes) -> int:
        """Get next sequence number"""
        self.sequences[mac] = (self.sequences[mac] + 1) % 256
        return self.sequences[mac]
        
    def _should_drop_frame(self) -> bool:
        """Check if frame should be dropped"""
        if not ADAPTIVE_QUALITY:
            return False
            
        # Check frame lag
        if len(self.frame_buffer) > MAX_FRAME_LAG:
            return True
            
        # Check FPS
        if self.metrics.current_fps < TARGET_FPS * 0.8:
            # Drop every other frame to catch up
            return self.metrics.frames_processed % 2 == 0
            
        return False
        
    def _update_metrics(self, frame_time: float):
        """Update performance metrics"""
        self.metrics.frames_processed += 1
        self.metrics.frame_times.append(frame_time)
        
        # Calculate FPS
        if len(self.metrics.frame_times) > 0:
            avg_time = sum(self.metrics.frame_times) / len(self.metrics.frame_times)
            self.metrics.current_fps = 1.0 / avg_time if avg_time > 0 else 0
            self.metrics.avg_latency = avg_time
            
        # Track peak FPS
        if self.metrics.current_fps > self.metrics.peak_fps:
            self.metrics.peak_fps = self.metrics.current_fps
            
        self.metrics.last_frame_time = time.perf_counter()
        
    def get_performance_stats(self) -> Dict:
        """Get performance statistics"""
        return {
            'frames_processed': self.metrics.frames_processed,
            'frames_dropped': self.metrics.frames_dropped,
            'current_fps': self.metrics.current_fps,
            'peak_fps': self.metrics.peak_fps,
            'avg_latency': self.metrics.avg_latency,
            'buffer_size': len(self.frame_buffer),
            'drop_rate': (self.metrics.frames_dropped / max(1, self.metrics.frames_processed)) * 100
        }
        
    def cleanup(self):
        """Cleanup resources"""
        self.running = False
        
        # Close sockets
        for sock in self.sockets.values():
            try:
                sock.close()
            except:
                pass
                
        self.sockets.clear()
        
        # Clear buffers
        self.frame_buffer.clear()
        self.device_cache.clear()
        
        logging.info(f"LIFX Entertainment cleaned up. Peak FPS: {self.metrics.peak_fps:.1f}")


# Global optimizer instance
_optimizer = None

def get_optimizer() -> LIFXEntertainmentOptimizer:
    """Get or create global optimizer instance"""
    global _optimizer
    if _optimizer is None:
        _optimizer = LIFXEntertainmentOptimizer()
    return _optimizer