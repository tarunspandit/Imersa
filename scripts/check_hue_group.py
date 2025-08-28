#!/usr/bin/env python3
"""
Check Hue bridge group configuration
"""

import requests
import json
import sys

def check_group(bridge_ip, api_key, group_id):
    """Check group details on real bridge"""
    
    print(f"Checking group {group_id} on {bridge_ip}...")
    
    # Get group info
    r = requests.get(f"http://{bridge_ip}/api/{api_key}/groups/{group_id}")
    
    if r.status_code == 200:
        group = r.json()
        
        print(f"\nGroup {group_id} Details:")
        print(f"  Name: {group.get('name', 'N/A')}")
        print(f"  Type: {group.get('type', 'N/A')}")
        print(f"  Class: {group.get('class', 'N/A')}")
        print(f"  Lights: {group.get('lights', [])}")
        
        # Check if it's entertainment capable
        if group.get('type') == 'Entertainment':
            print(f"\n✓ This IS an Entertainment group")
            
            # Check stream property
            if 'stream' in group:
                print(f"\nStream configuration:")
                for key, value in group['stream'].items():
                    print(f"  {key}: {value}")
            else:
                print("\n⚠ No stream configuration found")
        else:
            print(f"\n✗ This is NOT an Entertainment group (type: {group.get('type')})")
            print("  Entertainment requires type='Entertainment'")
        
        return group
    else:
        print(f"✗ Failed to get group: {r.text}")
        return None

def list_entertainment_groups(bridge_ip, api_key):
    """List all entertainment groups"""
    
    print(f"\nListing all groups on {bridge_ip}...")
    
    r = requests.get(f"http://{bridge_ip}/api/{api_key}/groups")
    
    if r.status_code == 200:
        groups = r.json()
        
        entertainment_groups = []
        regular_groups = []
        
        for gid, group in groups.items():
            if group.get('type') == 'Entertainment':
                entertainment_groups.append((gid, group))
            else:
                regular_groups.append((gid, group))
        
        print(f"\nEntertainment Groups ({len(entertainment_groups)}):")
        for gid, group in entertainment_groups:
            print(f"  {gid}: {group['name']} - Lights: {group.get('lights', [])}")
            if 'stream' in group:
                print(f"      Stream: active={group['stream'].get('active', False)}, owner={group['stream'].get('owner')}")
        
        print(f"\nRegular Groups ({len(regular_groups)}):")
        for gid, group in regular_groups[:5]:  # Show first 5
            print(f"  {gid}: {group['name']} ({group['type']})")
        
        return entertainment_groups
    else:
        print(f"✗ Failed to list groups: {r.text}")
        return []

def test_streaming(bridge_ip, api_key, group_id):
    """Try to start streaming on a group"""
    
    print(f"\nTesting streaming on group {group_id}...")
    
    # Try to start streaming
    r = requests.put(
        f"http://{bridge_ip}/api/{api_key}/groups/{group_id}/stream",
        json={"active": True}
    )
    
    result = r.json()
    
    if isinstance(result, list) and len(result) > 0:
        if "success" in result[0]:
            print(f"✓ Streaming started successfully!")
            
            # Stop it
            r = requests.put(
                f"http://{bridge_ip}/api/{api_key}/groups/{group_id}/stream",
                json={"active": False}
            )
            print(f"  Stopped streaming: {r.json()}")
            
            return True
        elif "error" in result[0]:
            err = result[0]["error"]
            print(f"✗ Failed to start streaming:")
            print(f"  Type: {err.get('type')}")
            print(f"  Address: {err.get('address')}")
            print(f"  Description: {err.get('description')}")
            return False
    else:
        print(f"Unexpected response: {result}")
        return False

def main():
    if len(sys.argv) < 3:
        print("Usage: check_hue_group.py <bridge_ip> <api_key> [group_id]")
        print("Example: check_hue_group.py 192.168.1.97 your_api_key 202")
        sys.exit(1)
    
    bridge_ip = sys.argv[1]
    api_key = sys.argv[2]
    group_id = sys.argv[3] if len(sys.argv) > 3 else None
    
    if group_id:
        # Check specific group
        group = check_group(bridge_ip, api_key, group_id)
        
        if group and group.get('type') == 'Entertainment':
            # Test streaming
            test_streaming(bridge_ip, api_key, group_id)
    else:
        # List all groups
        entertainment_groups = list_entertainment_groups(bridge_ip, api_key)
        
        if entertainment_groups:
            print("\n" + "=" * 50)
            print("To test a specific group, run:")
            print(f"  {sys.argv[0]} {bridge_ip} {api_key} <group_id>")

if __name__ == "__main__":
    main()