#!/usr/bin/env python3
"""
Test script for WLED segment-based lights with gradient support
"""

import socket
import time
import colorsys

def send_wled_udp(ip, port, segment_id, colors, led_count):
    """Send colors to a specific WLED segment via UDP"""
    
    if segment_id == 0:
        # Use WARLS protocol for first segment
        # Protocol: 0x01 (WARLS) + 0x02 (wait frames) + RGB data
        buffer = bytearray(2 + led_count * 3)
        buffer[0] = 0x01  # WARLS
        buffer[1] = 0x02  # Wait 2 frames
        
        # Fill RGB values
        for i, color in enumerate(colors[:led_count]):
            buffer[2 + i*3] = color[0]     # R
            buffer[2 + i*3 + 1] = color[1] # G
            buffer[2 + i*3 + 2] = color[2] # B
    else:
        # Use DRGB protocol for other segments
        # Protocol: 0x04 (DRGB) + offset (2 bytes) + RGB data
        segment_start = segment_id * led_count
        buffer = bytearray(3 + led_count * 3)
        buffer[0] = 0x04  # DRGB
        buffer[1] = (segment_start >> 8) & 0xFF  # Offset high byte
        buffer[2] = segment_start & 0xFF  # Offset low byte
        
        # Fill RGB values
        for i, color in enumerate(colors[:led_count]):
            buffer[3 + i*3] = color[0]     # R
            buffer[3 + i*3 + 1] = color[1] # G
            buffer[3 + i*3 + 2] = color[2] # B
    
    # Send UDP packet
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.sendto(buffer, (ip, port))
    sock.close()
    print(f"Sent {len(colors)} colors to segment {segment_id} at {ip}:{port}")

def create_gradient(color1, color2, steps):
    """Create a linear gradient between two colors"""
    gradient = []
    for i in range(steps):
        t = i / max(1, steps - 1)
        r = int(color1[0] + (color2[0] - color1[0]) * t)
        g = int(color1[1] + (color2[1] - color1[1]) * t)
        b = int(color1[2] + (color2[2] - color1[2]) * t)
        gradient.append([r, g, b])
    return gradient

def test_single_color(ip, port, segment_id, led_count):
    """Test single color on a segment"""
    print(f"\n=== Testing single color on segment {segment_id} ===")
    
    # Red
    colors = [[255, 0, 0]] * led_count
    send_wled_udp(ip, port, segment_id, colors, led_count)
    time.sleep(2)
    
    # Green
    colors = [[0, 255, 0]] * led_count
    send_wled_udp(ip, port, segment_id, colors, led_count)
    time.sleep(2)
    
    # Blue
    colors = [[0, 0, 255]] * led_count
    send_wled_udp(ip, port, segment_id, colors, led_count)
    time.sleep(2)

def test_gradient(ip, port, segment_id, led_count):
    """Test gradient on a segment"""
    print(f"\n=== Testing gradient on segment {segment_id} ===")
    
    # Red to Blue gradient
    gradient = create_gradient([255, 0, 0], [0, 0, 255], led_count)
    send_wled_udp(ip, port, segment_id, gradient, led_count)
    time.sleep(3)
    
    # Rainbow gradient
    rainbow = []
    for i in range(led_count):
        hue = i / led_count
        rgb = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
        rainbow.append([int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255)])
    send_wled_udp(ip, port, segment_id, rainbow, led_count)
    time.sleep(3)

def test_multiple_segments(ip, port, segments):
    """Test multiple segments with different patterns"""
    print(f"\n=== Testing multiple segments ===")
    
    # Send different colors to each segment
    colors_per_segment = [
        [255, 0, 0],    # Red for segment 0
        [0, 255, 0],    # Green for segment 1
        [0, 0, 255],    # Blue for segment 2
        [255, 255, 0],  # Yellow for segment 3
    ]
    
    for seg_id, seg_info in enumerate(segments):
        led_count = seg_info.get("len", 30)
        if seg_id < len(colors_per_segment):
            color = colors_per_segment[seg_id]
            colors = [color] * led_count
            send_wled_udp(ip, port, seg_id, colors, led_count)
    
    time.sleep(3)
    
    # Now send gradients to gradient-capable segments
    print("\nApplying gradients to gradient-capable segments...")
    gradient_models = ["LCX001", "LCX002", "LCX003", "LCX004", "915005987201"]
    
    for seg_id, seg_info in enumerate(segments):
        led_count = seg_info.get("len", 30)
        # Simulate gradient model assignment (segments 0 and 2 are gradient-capable)
        if seg_id in [0, 2]:
            gradient = create_gradient(
                colors_per_segment[seg_id % len(colors_per_segment)],
                [255, 255, 255],  # Fade to white
                led_count
            )
            send_wled_udp(ip, port, seg_id, gradient, led_count)

def main():
    # WLED device configuration
    WLED_IP = "192.168.1.100"  # Change to your WLED IP
    WLED_PORT = 21324  # Default WLED UDP port
    
    # Segment configuration (example with 4 segments of 30 LEDs each)
    segments = [
        {"len": 30, "start": 0, "stop": 30},
        {"len": 30, "start": 30, "stop": 60},
        {"len": 30, "start": 60, "stop": 90},
        {"len": 30, "start": 90, "stop": 120}
    ]
    
    print("WLED Segment Test Script")
    print(f"Target: {WLED_IP}:{WLED_PORT}")
    print(f"Segments: {len(segments)}")
    
    # Test individual segments
    for seg_id, seg_info in enumerate(segments):
        led_count = seg_info.get("len", 30)
        
        # Test single color
        test_single_color(WLED_IP, WLED_PORT, seg_id, led_count)
        
        # Test gradient (only for even segments to simulate gradient model assignment)
        if seg_id % 2 == 0:
            test_gradient(WLED_IP, WLED_PORT, seg_id, led_count)
    
    # Test all segments together
    test_multiple_segments(WLED_IP, WLED_PORT, segments)
    
    print("\n=== Test complete ===")
    
    # Turn off all segments
    print("\nTurning off all segments...")
    for seg_id, seg_info in enumerate(segments):
        led_count = seg_info.get("len", 30)
        colors = [[0, 0, 0]] * led_count
        send_wled_udp(WLED_IP, WLED_PORT, seg_id, colors, led_count)

if __name__ == "__main__":
    main()