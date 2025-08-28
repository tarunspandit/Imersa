#!/usr/bin/env python3
"""
Test Hue bridge entertainment capabilities
"""

import requests
import json
import sys
import time

def test_v1_api(bridge_ip, api_key):
    """Test V1 API entertainment"""
    print("\n=== Testing V1 API ===")
    
    # List all groups
    r = requests.get(f"http://{bridge_ip}/api/{api_key}/groups")
    groups = r.json()
    
    # Find entertainment groups
    entertainment_groups = []
    for gid, group in groups.items():
        if group.get("type") == "Entertainment":
            entertainment_groups.append((gid, group))
            print(f"\nFound Entertainment group {gid}: {group['name']}")
            print(f"  Lights: {group.get('lights', [])}")
            
            # Check if it has stream capability
            if 'stream' in group:
                print(f"  Stream config: {group['stream']}")
            else:
                print("  No stream config")
    
    if not entertainment_groups:
        print("\n✗ No entertainment groups found!")
        print("\nCreating test entertainment group...")
        
        # Get first 2 lights
        r = requests.get(f"http://{bridge_ip}/api/{api_key}/lights")
        lights = r.json()
        light_ids = list(lights.keys())[:2]
        
        # Create entertainment group
        group_data = {
            "name": "DIYHue_Test_Entertainment",
            "type": "Entertainment",
            "class": "TV",
            "lights": light_ids
        }
        
        r = requests.post(
            f"http://{bridge_ip}/api/{api_key}/groups",
            json=group_data
        )
        
        result = r.json()
        if isinstance(result, list) and "success" in result[0]:
            group_id = result[0]["success"]["id"]
            print(f"✓ Created entertainment group {group_id}")
            entertainment_groups.append((group_id, None))
        else:
            print(f"✗ Failed to create group: {result}")
            return
    
    # Test streaming on first group
    if entertainment_groups:
        group_id = entertainment_groups[0][0]
        print(f"\n=== Testing streaming on group {group_id} ===")
        
        # Try to activate streaming
        print("\n1. Activating stream...")
        r = requests.put(
            f"http://{bridge_ip}/api/{api_key}/groups/{group_id}/stream",
            json={"active": True}
        )
        
        result = r.json()
        print(f"Response: {result}")
        
        if isinstance(result, list) and len(result) > 0:
            if "success" in result[0]:
                print("✓ Stream activated!")
                
                # Wait a bit
                time.sleep(2)
                
                # Deactivate
                print("\n2. Deactivating stream...")
                r = requests.put(
                    f"http://{bridge_ip}/api/{api_key}/groups/{group_id}/stream",
                    json={"active": False}
                )
                print(f"Response: {r.json()}")
            elif "error" in result[0]:
                err = result[0]["error"]
                print(f"✗ Failed to activate stream:")
                print(f"  Error type: {err.get('type')}")
                print(f"  Address: {err.get('address')}")
                print(f"  Description: {err.get('description')}")

def test_v2_api(bridge_ip, api_key):
    """Test V2 API entertainment"""
    print("\n=== Testing V2 API ===")
    
    # Get V2 entertainment configurations
    headers = {"hue-application-key": api_key}
    
    try:
        r = requests.get(
            f"https://{bridge_ip}/clip/v2/resource/entertainment_configuration",
            headers=headers,
            verify=False,
            timeout=3
        )
        
        if r.status_code == 200:
            data = r.json()
            
            if "data" in data and len(data["data"]) > 0:
                print("\nFound V2 Entertainment Configurations:")
                for config in data["data"]:
                    print(f"\n  ID: {config['id']}")
                    print(f"  Name: {config.get('metadata', {}).get('name', 'N/A')}")
                    print(f"  Status: {config.get('status', 'N/A')}")
                    
                # Try to start first one
                config_id = data["data"][0]["id"]
                print(f"\nTrying to start entertainment {config_id}...")
                
                r = requests.put(
                    f"https://{bridge_ip}/clip/v2/resource/entertainment_configuration/{config_id}",
                    headers=headers,
                    json={"action": "start"},
                    verify=False
                )
                
                print(f"Response ({r.status_code}): {r.text[:200]}")
            else:
                print("No V2 entertainment configurations found")
        else:
            print(f"V2 API returned {r.status_code}: {r.text[:200]}")
            
    except Exception as e:
        print(f"V2 API error: {e}")

def main():
    if len(sys.argv) < 3:
        print("Usage: test_hue_entertainment.py <bridge_ip> <api_key>")
        sys.exit(1)
    
    bridge_ip = sys.argv[1]
    api_key = sys.argv[2]
    
    # Test V1 API
    test_v1_api(bridge_ip, api_key)
    
    # Test V2 API  
    test_v2_api(bridge_ip, api_key)
    
    print("\n" + "=" * 50)
    print("Test complete!")

if __name__ == "__main__":
    main()