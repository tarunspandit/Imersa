#!/usr/bin/env python3
"""
Check DTLS bridge status and test connectivity
"""

import socket
import subprocess
import time
import sys

def check_port(port):
    """Check if something is listening on port"""
    try:
        result = subprocess.run(["lsof", "-i", f":{port}"], 
                              capture_output=True, text=True)
        if result.stdout:
            print(f"✓ Port {port} is open:")
            for line in result.stdout.strip().split('\n'):
                if line and not line.startswith('COMMAND'):
                    print(f"  {line}")
            return True
        else:
            print(f"✗ Nothing listening on port {port}")
            return False
    except:
        print(f"? Could not check port {port}")
        return False

def check_openssl_processes():
    """Check for OpenSSL processes"""
    try:
        result = subprocess.run(["ps", "aux"], capture_output=True, text=True)
        openssl_procs = [line for line in result.stdout.split('\n') 
                         if 'openssl' in line and 'grep' not in line]
        
        if openssl_procs:
            print(f"✓ Found {len(openssl_procs)} OpenSSL process(es):")
            for proc in openssl_procs:
                # Extract command
                parts = proc.split()
                if len(parts) > 10:
                    cmd = ' '.join(parts[10:])[:100]
                    print(f"  {cmd}...")
            return True
        else:
            print("✗ No OpenSSL processes found")
            return False
    except:
        print("? Could not check OpenSSL processes")
        return False

def send_test_packet(host='127.0.0.1', port=2100):
    """Send a test UDP packet"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(1)
        
        # Try to send a simple packet
        test_data = b"TEST_PACKET"
        print(f"\nSending test packet to {host}:{port}...")
        sock.sendto(test_data, (host, port))
        
        # Try to receive response (probably won't get one)
        try:
            data, addr = sock.recvfrom(1024)
            print(f"✓ Received response: {data[:50]}")
        except socket.timeout:
            print("  No response (expected for DTLS)")
        
        sock.close()
        return True
    except Exception as e:
        print(f"✗ Failed to send packet: {e}")
        return False

def main():
    print("DTLS Bridge Status Check")
    print("=" * 50)
    
    print("\n1. Checking port 2100 (DTLS server)...")
    port_open = check_port(2100)
    
    print("\n2. Checking OpenSSL processes...")
    openssl_running = check_openssl_processes()
    
    print("\n3. Testing UDP connectivity...")
    can_send = send_test_packet()
    
    print("\n4. Checking bridge connections...")
    # Check if OpenSSL client is connected to real bridge
    try:
        result = subprocess.run(["netstat", "-an"], capture_output=True, text=True)
        connections = [line for line in result.stdout.split('\n') 
                      if '192.168.1.97:2100' in line or '192.168.1.97.2100' in line]
        if connections:
            print("✓ Found connection to real bridge:")
            for conn in connections:
                print(f"  {conn}")
        else:
            print("✗ No connection to real bridge found")
    except:
        print("? Could not check connections")
    
    print("\n" + "=" * 50)
    if port_open and openssl_running:
        print("✓ DTLS Bridge appears to be running")
        print("\nNext steps:")
        print("1. Check DIYHue logs for 'Waiting for client' messages")
        print("2. Ensure Hue Sync app is configured to connect to DIYHue IP")
        print("3. Start entertainment in Hue Sync app")
    else:
        print("✗ DTLS Bridge is NOT running properly")
        print("\nTroubleshooting:")
        print("1. Check DIYHue logs for error messages")
        print("2. Verify entertainment mode was started")
        print("3. Check PSK credentials are correct")

if __name__ == "__main__":
    main()