#!/usr/bin/env python3
"""Fix script for lifx_models.py"""

import sys
import os

# Fix the lifx_models.py file
def fix_lifx_models():
    file_path = "/Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator/lights/protocols/lifx_models.py"
    
    # Read the current file
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    # Fix line 1-4: Add the correct MULTIZONE_PIDS and MATRIX_PIDS
    new_lines = []
    new_lines.append("# LIFX Product capabilities from lifxlan library\n")
    new_lines.append("MULTIZONE_PIDS = {31, 32, 38, 117, 118, 119, 120, 141, 142, 143, 144, 161, 162, 203, 204, 205, 206, 213, 214}\n")
    new_lines.append("MATRIX_PIDS = {55, 57, 68, 137, 138, 176, 177, 185, 186, 187, 188, 201, 202, 215, 216, 217, 218, 219, 220}\n")
    new_lines.append("EXTENDED_MZ_PIDS = {38, 119, 120}  # LIFX Beam supports extended multizone\n")
    new_lines.append("GRADIENT_MODEL = 'LCX004'\n")
    
    # Keep the rest but fix line 552 error
    for i, line in enumerate(lines[5:], start=5):
        # Fix the error on line 552 (now at different line number due to our changes)
        if "hue_model = get_hue_model_from_lifx(pid, name, features)" in line:
            new_lines.append("    hue_model = get_hue_model_from_lifx(pid, name)\n")
        else:
            new_lines.append(line)
    
    # Write the fixed file
    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    
    print("Fixed lifx_models.py:")
    print("✓ Added MULTIZONE_PIDS with correct product IDs")
    print("✓ Added MATRIX_PIDS with correct product IDs")
    print("✓ Fixed get_hue_model_from_lifx() call to use 2 arguments instead of 3")

if __name__ == "__main__":
    fix_lifx_models()