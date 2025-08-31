# LIFX Ceiling 13x26 Gradient Test

## Quick Start

Run the simple test:
```bash
cd BridgeEmulator
python tests/simple_ceiling_test.py
```

This will:
1. Find your LIFX Ceiling 13x26 (product ID 201 or 202)
2. Apply a RED → GREEN → BLUE gradient (left to right)
3. Display for 15 seconds
4. Reset to white

## Test Scripts Available

### 1. `simple_ceiling_test.py` (Recommended)
- **Simplest test** - Direct device control
- Uses `project_matrix()` API directly
- No dependencies except lifxlan

### 2. `test_ceiling_gradient.py`
- More comprehensive testing
- Tests solid colors first (optional)
- Includes xy color conversion
- Interactive prompts

### 3. `test_ceiling_via_bridge.py`
- Tests the bridge's gradient implementation
- Uses `set_light_gradient()` function
- Tests both bridge and direct methods

## How the Gradient Works

### Matrix Layout
The Ceiling 13x26 has **120 zones** in a **10×12 grid**:
```
Width:  10 zones (columns)
Height: 12 zones (rows)
Total:  120 zones
```

### Gradient Direction
The gradient flows **left to right** (across columns):
```
Column 0: RED
Column 5: GREEN  
Column 9: BLUE
```

Each row shows the same gradient pattern.

### Color Values (HSBK)
```python
RED:   [0,     65535, 32768, 3500]  # Hue=0°
GREEN: [21845, 65535, 32768, 3500]  # Hue=120°
BLUE:  [43690, 65535, 32768, 3500]  # Hue=240°
```

## Implementation Details

### Using project_matrix()
```python
# Get canvas dimensions
width, height = device.get_canvas_dimensions()  # Returns (10, 12)

# Create 2D matrix of HSBK values
matrix = []
for y in range(height):
    row = []
    for x in range(width):
        # Calculate gradient position
        pos = x / (width - 1)
        
        # Interpolate hue value
        if pos <= 0.5:
            hue = int(pos * 2 * 21845)  # Red to green
        else:
            hue = int(21845 + (pos - 0.5) * 2 * 21845)  # Green to blue
        
        row.append([hue, 65535, 32768, 3500])
    matrix.append(row)

# Apply to device
device.project_matrix(matrix, duration=0, rapid=True)
```

### Bridge Gradient Format
The bridge expects gradient points in Hue v2 format:
```python
gradient_points = [
    {"color": (0.64, 0.33), "position": 0.0},  # Red (xy coordinates)
    {"color": (0.30, 0.60), "position": 0.5},  # Green
    {"color": (0.15, 0.06), "position": 1.0}   # Blue
]
```

## Troubleshooting

### Device Not Found
- Ensure Ceiling is powered on
- Check it's on the same network
- Verify product ID is 201 or 202
- Check firewall isn't blocking UDP port 56700

### Gradient Not Displaying
- Verify device supports `project_matrix()` method
- Check canvas dimensions match expectations (10×12)
- Ensure HSBK values are in correct ranges

### Colors Look Wrong
- Hue: 0-65535 (not 0-360)
- Saturation: 0-65535 (not 0-100)
- Brightness: 0-65535 (not 0-100)
- Kelvin: 2500-9000 (color temperature)

## Expected Result

You should see:
- **Left side**: Deep RED
- **Center**: Bright GREEN
- **Right side**: Deep BLUE

With smooth transitions between colors across the 10 columns.

## Code Structure

The fixed implementation:
1. Uses `get_canvas_dimensions()` to get actual zone layout
2. Applies gradients via `project_matrix()` for Matrix devices
3. Properly handles the 10×12 grid (120 zones)
4. Correctly formats HSBK color values

## Related Files
- `lights/protocols/lifx.py` - Main LIFX implementation
- `lights/protocols/lifx_constants.py` - Device constants
- `lights/protocols/lifx_models.py` - Model mapping