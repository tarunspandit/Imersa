#!/usr/bin/env python3
"""
Test direct import without going through __init__.py
"""

import sys
import os

# Add path
sys.path.insert(0, '/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

# Set up environment
os.chdir('/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator')

# Import directly without using the __init__.py
import importlib.util

# Load lifx_native module directly
spec = importlib.util.spec_from_file_location(
    "lifx_native", 
    "/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator/lights/protocols/lifx_native.py"
)
lifx_native = importlib.util.module_from_spec(spec)
sys.modules['lifx_native'] = lifx_native
spec.loader.exec_module(lifx_native)

print("LIFX Native module loaded successfully!")

# Test discovery
print("\n=== Testing Discovery ===")
detected_lights = []
lifx_native.discover(detected_lights)

if detected_lights:
    print(f"Found {len(detected_lights)} device(s):")
    for light in detected_lights:
        print(f"  - {light['name']} ({light['protocol_cfg']['mac']}) at {light['protocol_cfg']['ip']}")
else:
    print("No devices found")

print("\nDirect import test complete!")