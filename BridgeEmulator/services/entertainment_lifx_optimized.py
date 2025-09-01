#!/usr/bin/env python3
"""
LIFX Entertainment Mode Optimizations
High-performance entertainment mode for 120+ FPS with zero lag
"""

import asyncio
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional, Tuple
import numpy as np
import logging

# Import the optimized LIFX protocol
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'lights', 'protocols'))
from lifx import LIFXProtocol, GradientEngine, FrameBuffer
from lifx_models import device_registry, LIFXDevice

logger = logging.getLogger(__name__)

class LIFXEntertainmentOptimizer:
    """Optimized LIFX entertainment mode handler"""
    
    def __init__(self):
        self.protocol = LIFXProtocol()
        self.gradient_engine = GradientEngine()
        self.frame_buffer = FrameBuffer(size=32)  # Larger buffer for smoother playback
        self.integration_enabled = True
        self.target_fps = 120
        self.frame_time = 1.0 / self.target_fps
        self.last_frame_time = 0
        self.frame_count = 0
        self.performance_stats = {
            'frames_processed': 0,
            'frames_dropped': 0,
            'avg_latency': 0,
            'peak_fps': 0,
            'current_fps': 0
        }
        
        # Pre-allocated buffers
        self.color_buffer = np.zeros((256, 4), dtype=np.uint16)  # HSBK format
        self.zone_buffer = np.zeros((256, 4), dtype=np.uint16)
        
        # Device batch processing
        self.device_batches = []
        self.batch_size = 8
        
        # Performance monitoring
        self.monitor_thread = None
        self.monitoring = False
        
    def start_monitoring(self):
        """Start performance monitoring thread"""
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_performance)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop performance monitoring"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1)
    
    def _monitor_performance(self):
        """Monitor and log performance metrics"""
        fps_samples = []
        last_frame_count = 0
        
        while self.monitoring:
            time.sleep(1)  # Sample every second
            
            # Calculate FPS
            current_frame_count = self.frame_count
            fps = current_frame_count - last_frame_count
            last_frame_count = current_frame_count
            fps_samples.append(fps)
            
            # Keep last 10 samples
            if len(fps_samples) > 10:
                fps_samples.pop(0)
            
            # Update stats
            self.performance_stats['current_fps'] = fps
            if fps > self.performance_stats['peak_fps']:
                self.performance_stats['peak_fps'] = fps
            
            # Log if FPS drops below target
            if fps < self.target_fps * 0.9 and fps > 0:
                logger.warning(f"FPS dropped to {fps} (target: {self.target_fps})")
    
    def process_entertainment_frame(self, lights: List[Dict], 
                                   light_data: bytes,
                                   bridgeConfig: Dict) -> bool:
        """Process a single entertainment frame with optimizations"""
        start_time = time.perf_counter()
        
        # Check if we should process this frame
        if not self._should_process_frame():
            self.performance_stats['frames_dropped'] += 1
            return False
        
        # Parse light data efficiently
        updates = self._parse_light_data(lights, light_data)
        
        # Batch process updates
        if updates:
            # Add to frame buffer for interpolation
            self.frame_buffer.add_frame({
                'timestamp': start_time,
                'updates': updates
            })
            
            # Process in batches
            for i in range(0, len(updates), self.batch_size):
                batch = updates[i:i + self.batch_size]
                self.protocol.batch_update(batch)
        
        # Update performance metrics
        self.frame_count += 1
        self.performance_stats['frames_processed'] += 1
        
        # Calculate latency
        latency = time.perf_counter() - start_time
        self.performance_stats['avg_latency'] = (
            self.performance_stats['avg_latency'] * 0.95 + latency * 0.05
        )
        
        self.last_frame_time = start_time
        return True
    
    def _should_process_frame(self) -> bool:
        """Determine if frame should be processed based on timing"""
        current_time = time.perf_counter()
        time_since_last = current_time - self.last_frame_time
        
        # Allow frame if enough time has passed
        if time_since_last >= self.frame_time * 0.9:  # 90% of target interval
            return True
        
        # Check if we're falling behind and need interpolation
        if time_since_last >= self.frame_time * 2:
            # We're behind, process immediately
            return True
        
        return False
    
    def _parse_light_data(self, lights: List[Dict], 
                         light_data: bytes) -> List[Dict]:
        """Parse light data into update commands"""
        updates = []
        
        for light in lights:
            if light.get('protocol') != 'lifx':
                continue
            
            # Get device from registry
            device = device_registry.get_device_by_ip(light['ip'])
            if not device:
                continue
            
            # Extract color data from entertainment stream
            light_id = int(light['light_id']) - 1
            if light_id * 9 + 9 <= len(light_data):
                # Parse RGB values
                r = int.from_bytes(light_data[light_id * 9 + 1:light_id * 9 + 3], 'big')
                g = int.from_bytes(light_data[light_id * 9 + 3:light_id * 9 + 5], 'big')
                b = int.from_bytes(light_data[light_id * 9 + 5:light_id * 9 + 7], 'big')
                
                # Convert to HSB using optimized conversion
                h, s, v = self._rgb_to_hsb_fast(r, g, b)
                
                # Check if device has zones
                if device.is_matrix or device.is_multizone:
                    # Process gradient if available
                    gradient = light.get('gradient')
                    if gradient and gradient.get('points'):
                        zones = self._process_gradient_optimized(
                            gradient['points'],
                            device.zone_count
                        )
                        updates.append({
                            'ip': light['ip'],
                            'zones': zones,
                            'duration': 0
                        })
                    else:
                        # Single color for all zones
                        zones = [(h, s, v, 2700)] * device.zone_count
                        updates.append({
                            'ip': light['ip'],
                            'zones': zones,
                            'duration': 0
                        })
                else:
                    # Single color device
                    updates.append({
                        'ip': light['ip'],
                        'hue': h,
                        'saturation': s,
                        'brightness': v,
                        'kelvin': light.get('ct', 2700),
                        'duration': 0
                    })
        
        return updates
    
    def _rgb_to_hsb_fast(self, r: int, g: int, b: int) -> Tuple[int, int, int]:
        """Fast RGB to HSB conversion optimized for performance"""
        # Normalize to 0-1
        r, g, b = r / 65535, g / 65535, b / 65535
        
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
    
    def _process_gradient_optimized(self, gradient_points: List[Dict], 
                                   num_zones: int) -> List[Tuple[int, int, int, int]]:
        """Process gradient with pre-computed optimization"""
        # Convert gradient points to numpy array for vectorized ops
        points = []
        for point in gradient_points:
            r = int(point['color']['r'] * 65535)
            g = int(point['color']['g'] * 65535)
            b = int(point['color']['b'] * 65535)
            h, s, v = self._rgb_to_hsb_fast(r, g, b)
            points.append((point['position'], h, s))
        
        # Use gradient engine for optimized calculation
        zones_array = self.gradient_engine.calculate_gradient_zones(points, num_zones)
        
        # Convert to list of tuples
        zones = []
        for i in range(num_zones):
            zones.append((
                int(zones_array[i, 0] * 360 / 65535),  # Hue
                int(zones_array[i, 1] * 100 / 65535),  # Saturation
                int(zones_array[i, 2] * 100 / 65535),  # Brightness
                int(zones_array[i, 3])  # Kelvin
            ))
        
        return zones
    
    def get_performance_stats(self) -> Dict:
        """Get current performance statistics"""
        return self.performance_stats.copy()
    
    def cleanup(self):
        """Clean up resources"""
        self.stop_monitoring()
        self.protocol.cleanup()

# Integration with existing entertainment service
def create_lifx_entertainment_handler():
    """Factory function for entertainment handler"""
    return LIFXEntertainmentOptimizer()

# Patch function for existing entertainment.py
def patch_entertainment_service():
    """Patch the existing entertainment service with optimizations"""
    code = """
# LIFX Entertainment Optimization Patch
# Add this to the entertainment.py file

# Import at the top
from entertainment_lifx_optimized import create_lifx_entertainment_handler

# Create global handler
lifx_handler = create_lifx_entertainment_handler()
lifx_handler.start_monitoring()

# Replace the LIFX processing section in the main loop with:
def process_lifx_optimized(lights, light_data, bridgeConfig):
    '''Process LIFX lights with optimizations'''
    global lifx_handler
    
    # Filter LIFX lights
    lifx_lights = [l for l in lights if l.get('protocol') == 'lifx']
    
    if lifx_lights:
        # Use optimized handler
        lifx_handler.process_entertainment_frame(
            lifx_lights, 
            light_data, 
            bridgeConfig
        )
        
        # Get performance stats periodically
        if random.random() < 0.01:  # 1% chance
            stats = lifx_handler.get_performance_stats()
            if stats['current_fps'] < 100:
                logger.warning(f"LIFX FPS: {stats['current_fps']}, "
                             f"Latency: {stats['avg_latency']*1000:.2f}ms")

# In the cleanup section:
def cleanup_lifx():
    global lifx_handler
    if lifx_handler:
        lifx_handler.cleanup()
"""
    return code

# Performance tuning parameters
PERFORMANCE_CONFIG = {
    'target_fps': 120,
    'max_fps': 240,
    'frame_buffer_size': 32,
    'socket_pool_size': 32,
    'batch_size': 8,
    'cache_ttl': 0.1,
    'interpolation_enabled': True,
    'gradient_cache_size': 100,
    'zone_optimization': True,
    'state_diffing': True,
    'parallel_updates': True,
    'adaptive_fps': True,
    'performance_monitoring': True
}

def apply_performance_config(config: Dict):
    """Apply performance configuration"""
    handler = create_lifx_entertainment_handler()
    
    handler.target_fps = config.get('target_fps', 120)
    handler.frame_buffer = FrameBuffer(size=config.get('frame_buffer_size', 32))
    handler.batch_size = config.get('batch_size', 8)
    
    if config.get('performance_monitoring', True):
        handler.start_monitoring()
    
    return handler