#!/usr/bin/env python3
"""
Quick check of group 202 on Hue bridge
"""

import requests
import json

# EDIT THESE
BRIDGE_IP = "192.168.1.97"
API_KEY = "YOUR_HUE_API_KEY_HERE"  # Put your real Hue bridge API key
GROUP_ID = "202"

print(f"Checking group {GROUP_ID} on {BRIDGE_IP}...")

# Get group details
r = requests.get(f"http://{BRIDGE_IP}/api/{API_KEY}/groups/{GROUP_ID}")
group = r.json()

print(f"\nGroup {GROUP_ID}:")
print(f"  Name: {group.get('name')}")
print(f"  Type: {group.get('type')}")
print(f"  Class: {group.get('class')}")
print(f"  Lights: {group.get('lights', [])}")

# Check stream configuration
if 'stream' in group:
    print(f"\n✓ Stream configuration exists:")
    for key, val in group['stream'].items():
        print(f"    {key}: {val}")
else:
    print(f"\n✗ NO stream configuration!")
    print("  This group cannot be used for entertainment")

# Check if stream endpoint exists
print(f"\nTesting /groups/{GROUP_ID}/stream endpoint...")
r = requests.put(
    f"http://{BRIDGE_IP}/api/{API_KEY}/groups/{GROUP_ID}/stream",
    json={"active": True}
)

result = r.json()
print(f"\nResponse: {json.dumps(result, indent=2)}")

if isinstance(result, list) and len(result) > 0:
    if "error" in result[0]:
        err = result[0]["error"]
        print(f"\nError details:")
        print(f"  Type: {err.get('type')}")
        print(f"  Address: {err.get('address')}")
        print(f"  Description: {err.get('description')}")
        
        if err.get('type') == 3:
            print("\n⚠ Type 3 = Resource not available")
            print("  Possible causes:")
            print("  1. Group exists but not configured for streaming")
            print("  2. Bridge firmware doesn't support entertainment on this group")
            print("  3. Group needs to be recreated as Entertainment type")
        elif err.get('type') == 7:
            print("\n⚠ Type 7 = Invalid value")
            print("  The group might not support the 'active' parameter")

# Try to get capabilities
print(f"\n\nChecking bridge capabilities...")
r = requests.get(f"http://{BRIDGE_IP}/api/{API_KEY}/capabilities")
cap = r.json()

if 'streaming' in cap:
    print(f"Streaming capability: {cap['streaming']}")

# List ALL entertainment groups to compare
print(f"\n\nListing ALL groups to find working entertainment groups...")
r = requests.get(f"http://{BRIDGE_IP}/api/{API_KEY}/groups")
groups = r.json()

entertainment_count = 0
for gid, g in groups.items():
    if g.get('type') == 'Entertainment':
        entertainment_count += 1
        has_stream = 'stream' in g
        print(f"  Group {gid}: {g['name']} - Has stream: {has_stream}")
        if has_stream:
            print(f"    Stream: {g['stream']}")

print(f"\nTotal entertainment groups: {entertainment_count}")

print("\n" + "="*50)
print("SOLUTION:")
if 'stream' not in group:
    print("Group 202 needs to be DELETED and RECREATED as Entertainment type")
    print("Even though type='Entertainment', it lacks stream configuration")
else:
    print("Group has stream config but bridge rejects streaming")
    print("Check if entertainment is enabled in bridge settings")