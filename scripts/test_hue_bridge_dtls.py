#!/usr/bin/env python3
"""
Test DTLS connectivity to real Hue bridge
Helps debug PSK authentication issues
"""

import subprocess
import json
import sys
import time

def get_entertainment_user(bridge_ip):
    """Register for entertainment access on bridge"""
    print(f"\n1. Press the button on your Hue bridge at {bridge_ip}")
    input("   Press Enter when ready...")
    
    print("\n2. Creating entertainment user...")
    cmd = [
        "curl", "-X", "POST",
        f"http://{bridge_ip}/api",
        "-d", '{"devicetype":"DIYHue#entertainment","generateclientkey":true}'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    try:
        response = json.loads(result.stdout)
        if isinstance(response, list) and len(response) > 0:
            if "success" in response[0]:
                username = response[0]["success"]["username"]
                clientkey = response[0]["success"].get("clientkey", username)
                print(f"\n✓ Got entertainment credentials:")
                print(f"  Username: {username}")
                print(f"  ClientKey: {clientkey}")
                return username, clientkey
            elif "error" in response[0]:
                err = response[0]["error"]
                print(f"\n✗ Error: {err.get('description', err)}")
                return None, None
    except:
        print(f"\n✗ Failed to parse response: {result.stdout}")
        return None, None

def test_dtls_connection(bridge_ip, username, clientkey):
    """Test DTLS connection to bridge"""
    print(f"\n3. Testing DTLS connection to {bridge_ip}:2100...")
    
    # Create test command
    cmd = [
        "openssl", "s_client",
        "-dtls",
        "-psk", clientkey,
        "-psk_identity", username,
        "-connect", f"{bridge_ip}:2100",
        "-quiet"
    ]
    
    print(f"   Command: {' '.join(cmd[:6])}...")
    
    # Start OpenSSL client
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, 
                           stderr=subprocess.PIPE)
    
    # Give it time to connect
    time.sleep(2)
    
    # Check if connected
    if proc.poll() is None:
        print("\n✓ DTLS connection successful!")
        print("  The bridge accepted our PSK credentials")
        
        # Try sending a test packet
        print("\n4. Sending test HueStream packet...")
        test_packet = b"HueStream\x02\x00\x00\x01\x00\x00\x01\x00"
        proc.stdin.write(test_packet)
        proc.stdin.flush()
        
        time.sleep(1)
        
        # Check for response
        proc.terminate()
        stdout = proc.stdout.read()
        stderr = proc.stderr.read()
        
        if stdout:
            print(f"  Response: {stdout[:100]}")
        if stderr:
            print(f"  Errors: {stderr.decode('utf-8')[:200]}")
            
        return True
    else:
        print("\n✗ DTLS connection failed!")
        stderr = proc.stderr.read().decode('utf-8')
        print(f"  Error: {stderr}")
        return False

def test_existing_credentials(bridge_ip, username, clientkey):
    """Test with existing credentials"""
    print(f"\nTesting existing credentials:")
    print(f"  Bridge: {bridge_ip}")
    print(f"  Username: {username[:16]}...")
    print(f"  ClientKey: {clientkey[:16]}... (length: {len(clientkey)})")
    
    return test_dtls_connection(bridge_ip, username, clientkey)

def main():
    print("Hue Bridge DTLS Test")
    print("=" * 50)
    
    # Get bridge IP
    if len(sys.argv) > 1:
        bridge_ip = sys.argv[1]
    else:
        bridge_ip = input("Enter Hue bridge IP [192.168.1.97]: ").strip() or "192.168.1.97"
    
    # Check what to do
    print("\nOptions:")
    print("1. Register new entertainment user")
    print("2. Test with existing credentials")
    
    choice = input("\nChoice [1]: ").strip() or "1"
    
    if choice == "1":
        username, clientkey = get_entertainment_user(bridge_ip)
        if username and clientkey:
            # Save to config suggestion
            print("\n" + "=" * 50)
            print("Add to DIYHue config:")
            print(json.dumps({
                "hue": {
                    "ip": bridge_ip,
                    "hueUser": username,
                    "hueClientKey": clientkey
                }
            }, indent=2))
            
            # Test connection
            test_dtls_connection(bridge_ip, username, clientkey)
    else:
        username = input("Enter username/API key: ").strip()
        clientkey = input("Enter client key (PSK): ").strip()
        
        if not clientkey:
            clientkey = username  # Some bridges use same for both
            print(f"Using username as client key")
        
        test_existing_credentials(bridge_ip, username, clientkey)
    
    print("\n" + "=" * 50)
    print("Test complete!")

if __name__ == "__main__":
    main()