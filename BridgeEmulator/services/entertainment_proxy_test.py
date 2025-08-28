#!/usr/bin/env python3
"""
Test script to verify DTLS proxy is working
"""

import socket
import time
import sys

def test_dtls_proxy():
    """Send test packets to DTLS proxy and check if they're received"""
    
    # Create UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    # DIYHue proxy address
    proxy_addr = ("127.0.0.1", 2100)
    
    print(f"Testing DTLS proxy at {proxy_addr}")
    
    # Send test packets
    for i in range(5):
        # Send a test packet (simulating HueStream)
        test_packet = b"HueStream\x01\x00" + b"\x00" * 50  # Fake HueStream packet
        
        print(f"Sending test packet {i+1}...")
        sock.sendto(test_packet, proxy_addr)
        
        time.sleep(0.5)
    
    # Send a more realistic entertainment packet
    print("\nSending realistic entertainment packet...")
    # HueStream v2 packet structure (simplified)
    packet = b"HueStream"  # Magic
    packet += b"\x02\x00"  # Version 2.0
    packet += b"\x00\x01"  # Sequence
    packet += b"\x00\x00"  # Reserved
    packet += b"\x01"      # Color space RGB
    packet += b"\x00"      # Reserved
    
    # Add some light data (channel 0, RGB)
    packet += b"\x00"      # Channel 0
    packet += b"\xFF\x00\x00"  # Red color
    
    sock.sendto(packet, proxy_addr)
    
    sock.close()
    print("\nTest packets sent. Check DIYHue logs for proxy activity.")

if __name__ == "__main__":
    test_dtls_proxy()