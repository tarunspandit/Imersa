"""
LIFX Device Models and Capabilities
Complete product database for all LIFX devices
"""

from enum import IntEnum
from typing import Dict, Optional, Tuple

# LIFX Product IDs from official product list
MULTIZONE_PIDS = {31, 32, 38, 117, 118, 119, 120, 141, 142, 143, 144, 161, 162, 203, 204, 205, 206, 213, 214}
MATRIX_PIDS = {55, 57, 68, 137, 138, 176, 177, 185, 186, 187, 188, 201, 202, 215, 216, 217, 218, 219, 220}
EXTENDED_MZ_PIDS = {38, 119, 120}  # LIFX Beam and newer strips support extended multizone
GRADIENT_MODEL = 'LCX004'

class LIFXProduct(IntEnum):
    """LIFX Product IDs"""
    # Original bulbs
    ORIGINAL_1000 = 1
    WHITE_800 = 10
    COLOR_650 = 11
    WHITE_900_BR30 = 18
    WHITE_900_BR30_V2 = 19
    COLOR_1000_BR30 = 20
    COLOR_1000 = 22
    
    # A19 bulbs
    A19 = 27
    A19_V3 = 28
    BR30 = 29
    PLUS_A19 = 30
    PLUS_BR30 = 36
    A19_V4 = 41
    BR30_V2 = 42
    A19_NIGHT_VISION = 43
    BR30_NIGHT_VISION = 44
    A19_WHITE = 45
    BR30_WHITE = 46
    A19_WHITE_TO_WARM = 49
    A19_WHITE_TO_WARM_V2 = 50
    A19_COLOR = 52
    BR30_COLOR = 53
    MINI_COLOR = 59
    MINI_WHITE_TO_WARM = 60
    MINI_WHITE = 61
    GU10_COLOR = 62
    GU10_COLOR_V2 = 110
    
    # Candles
    CANDLE = 68
    CANDLE_COLOR = 75
    CANDLE_WARM_TO_WHITE = 76
    CANDLE_WHITE = 81
    CANDLE_CA = 82
    CANDLE_CA_V2 = 200
    CANDLE_MATRIX = 137
    CANDLE_MATRIX_V2 = 217
    
    # Filament bulbs
    FILAMENT_CLEAR = 83
    FILAMENT_AMBER = 84
    FILAMENT_VERTICAL = 202
    
    # Downlights
    DOWNLIGHT = 97
    DOWNLIGHT_V2 = 98
    DOWNLIGHT_WHITE_TO_WARM = 111
    
    # Strips and linear
    Z = 31  # LIFX Z strip
    Z_2 = 32  # LIFX Z strip v2
    BEAM = 38  # LIFX Beam (supports extended multizone)
    LIGHTSTRIP = 117  # LIFX Lightstrip
    LIGHTSTRIP_V2 = 118
    LIGHTSTRIP_PRO = 119  # Supports extended multizone
    NEON = 120  # Neon flex (supports extended multizone)
    STRING_A60 = 134
    STRING_A21 = 135
    TUBE = 141
    TUBE_V2 = 142
    FESTIVE = 161
    FESTIVE_V2 = 162
    
    # Tiles and panels
    TILE = 55
    TILE_V2 = 57
    LIFX_TILE = 138
    PANEL = 176
    PANEL_V2 = 177
    SHAPES_TRIANGLE = 185
    SHAPES_MINI_TRIANGLE = 186
    SHAPES_TRIANGLE_V2 = 187
    SHAPES_MINI_TRIANGLE_V2 = 188
    SHAPES_HEXAGON = 201
    POLY_PANEL = 215
    POLY_PANEL_V2 = 216
    
    # Switches and sensors
    SWITCH = 70
    SWITCH_V2 = 71
    SWITCH_V3 = 89
    CLEAN = 90
    NIGHTVISION = 99
    NIGHTVISION_V2 = 100
    
    # Specialty
    COLOR_E12 = 133
    WHITE_E12 = 136
    CEILING = 176
    CEILING_V2 = 177
    OUTDOOR_PATHLIGHT = 91
    OUTDOOR_SPOT = 92
    OUTDOOR_WALL = 94
    SKYLIGHT_PANEL = 203
    SKYLIGHT_PANEL_V2 = 204
    TV_BAR = 205
    TV_BAR_V2 = 206


# Product information database
PRODUCTS = {
    # Classic bulbs
    1: {"name": "LIFX Original 1000", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    10: {"name": "LIFX White 800", "color": False, "infrared": False, "multizone": False, "temperature_range": (2700, 6500)},
    11: {"name": "LIFX Color 650", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    22: {"name": "LIFX Color 1000", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    
    # A19 series
    27: {"name": "LIFX A19", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    43: {"name": "LIFX A19 Night Vision", "color": True, "infrared": True, "multizone": False, "temperature_range": (2500, 9000)},
    45: {"name": "LIFX A19 White", "color": False, "infrared": False, "multizone": False, "temperature_range": (2700, 2700)},
    49: {"name": "LIFX A19 White to Warm", "color": False, "infrared": False, "multizone": False, "temperature_range": (2200, 6500)},
    52: {"name": "LIFX A19 Color", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    
    # Mini series
    59: {"name": "LIFX Mini Color", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    60: {"name": "LIFX Mini White to Warm", "color": False, "infrared": False, "multizone": False, "temperature_range": (2200, 6500)},
    61: {"name": "LIFX Mini White", "color": False, "infrared": False, "multizone": False, "temperature_range": (2700, 2700)},
    
    # Strips
    31: {"name": "LIFX Z", "color": True, "infrared": False, "multizone": True, "zones": 16, "temperature_range": (2500, 9000)},
    32: {"name": "LIFX Z", "color": True, "infrared": False, "multizone": True, "zones": 16, "temperature_range": (2500, 9000)},
    38: {"name": "LIFX Beam", "color": True, "infrared": False, "multizone": True, "zones": 10, "extended": True, "temperature_range": (2500, 9000)},
    117: {"name": "LIFX Lightstrip", "color": True, "infrared": False, "multizone": True, "zones": 82, "temperature_range": (2500, 9000)},
    119: {"name": "LIFX Lightstrip Pro", "color": True, "infrared": False, "multizone": True, "zones": 82, "extended": True, "temperature_range": (2500, 9000)},
    120: {"name": "LIFX Neon", "color": True, "infrared": False, "multizone": True, "zones": 32, "extended": True, "temperature_range": (2500, 9000)},
    
    # Tiles and panels
    55: {"name": "LIFX Tile", "color": True, "infrared": False, "matrix": True, "chain": True, "width": 8, "height": 8, "temperature_range": (2500, 9000)},
    57: {"name": "LIFX Tile", "color": True, "infrared": False, "matrix": True, "chain": True, "width": 8, "height": 8, "temperature_range": (2500, 9000)},
    138: {"name": "LIFX Tile Kit", "color": True, "infrared": False, "matrix": True, "chain": True, "width": 8, "height": 8, "temperature_range": (2500, 9000)},
    
    # Candles
    68: {"name": "LIFX Candle", "color": True, "infrared": False, "matrix": True, "width": 1, "height": 56, "temperature_range": (2500, 9000)},
    137: {"name": "LIFX Candle Matrix", "color": True, "infrared": False, "matrix": True, "width": 1, "height": 56, "temperature_range": (2500, 9000)},
    
    # Shapes
    185: {"name": "LIFX Shapes Triangle", "color": True, "infrared": False, "matrix": True, "chain": True, "pixels": 45, "temperature_range": (2500, 9000)},
    186: {"name": "LIFX Shapes Mini Triangle", "color": True, "infrared": False, "matrix": True, "chain": True, "pixels": 18, "temperature_range": (2500, 9000)},
    201: {"name": "LIFX Shapes Hexagon", "color": True, "infrared": False, "matrix": True, "chain": True, "pixels": 45, "temperature_range": (2500, 9000)},
    
    # Ceiling
    176: {"name": "LIFX Ceiling", "color": True, "infrared": False, "matrix": True, "width": 16, "height": 16, "temperature_range": (2500, 9000)},
    177: {"name": "LIFX Ceiling", "color": True, "infrared": False, "matrix": True, "width": 16, "height": 16, "temperature_range": (2500, 9000)},
    
    # Outdoor
    91: {"name": "LIFX Outdoor Pathlight", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    92: {"name": "LIFX Outdoor Spot", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
    94: {"name": "LIFX Outdoor Wall", "color": True, "infrared": False, "multizone": False, "temperature_range": (2500, 9000)},
}


def get_product_info(product_id: int) -> Optional[Dict]:
    """Get product information by ID"""
    return PRODUCTS.get(product_id)


def is_multizone(product_id: int) -> bool:
    """Check if product supports multizone"""
    return product_id in MULTIZONE_PIDS


def is_matrix(product_id: int) -> bool:
    """Check if product is a matrix/tile device"""
    return product_id in MATRIX_PIDS


def supports_extended_multizone(product_id: int) -> bool:
    """Check if product supports extended multizone protocol"""
    return product_id in EXTENDED_MZ_PIDS


def get_zone_count(product_id: int) -> int:
    """Get default zone count for multizone products"""
    info = get_product_info(product_id)
    if info and "zones" in info:
        return info["zones"]
    
    # Default zone counts
    if product_id in [31, 32]:  # LIFX Z
        return 16
    elif product_id == 38:  # LIFX Beam
        return 10
    elif product_id in [117, 118, 119]:  # Lightstrips
        return 82
    elif product_id == 120:  # Neon
        return 32
    elif product_id in [141, 142]:  # Tube
        return 16
    
    return 0


def get_matrix_dimensions(product_id: int) -> Tuple[int, int]:
    """Get matrix dimensions (width, height) for matrix products"""
    info = get_product_info(product_id)
    if info:
        width = info.get("width", 0)
        height = info.get("height", 0)
        if width and height:
            return (width, height)
            
    # Default dimensions
    if product_id in [55, 57, 138]:  # Tiles
        return (8, 8)
    elif product_id in [68, 137]:  # Candle
        return (1, 56)
    elif product_id in [176, 177]:  # Ceiling
        return (16, 16)
        
    return (0, 0)


def get_hue_model_from_lifx(product_id: int, name: str = None) -> str:
    """Convert LIFX product to equivalent Hue model for compatibility"""
    # Map LIFX products to Hue models
    
    # Color bulbs
    if product_id in [1, 11, 22, 27, 43, 52]:
        return "LCT015"  # Hue color bulb
    
    # Mini color bulbs
    if product_id == 59:
        return "LCT015"
        
    # White bulbs
    if product_id in [10, 45, 61]:
        return "LWB010"  # Dimmable white
        
    # White to warm bulbs
    if product_id in [49, 50, 60]:
        return "LTW001"  # Color temperature
        
    # Strips (multizone)
    if product_id in MULTIZONE_PIDS:
        # Check for gradient support
        if supports_extended_multizone(product_id):
            return "LCX004"  # Gradient lightstrip
        else:
            return "LST002"  # Regular lightstrip
            
    # Tiles and panels (matrix)
    if product_id in MATRIX_PIDS:
        if product_id in [176, 177]:  # Ceiling
            return "LCX002"  # Play gradient strip (closest match)
        else:
            return "LCX002"  # Matrix devices map to gradient
            
    # Candles
    if product_id in [68, 75, 76, 81, 82, 137, 200, 217]:
        return "LCA005"  # E14 candle
        
    # Downlights
    if product_id in [97, 98, 111]:
        return "LCT015"
        
    # GU10
    if product_id in [62, 110]:
        return "LCT015"
        
    # Default to color bulb
    return "LCT015"


class DeviceCapabilities:
    """Device capability tracker"""
    
    def __init__(self, product_id: int):
        self.product_id = product_id
        self.info = get_product_info(product_id) or {}
        
    @property
    def has_color(self) -> bool:
        return self.info.get("color", False)
        
    @property
    def has_infrared(self) -> bool:
        return self.info.get("infrared", False)
        
    @property
    def has_multizone(self) -> bool:
        return is_multizone(self.product_id)
        
    @property
    def has_matrix(self) -> bool:
        return is_matrix(self.product_id)
        
    @property  
    def has_chain(self) -> bool:
        return self.info.get("chain", False)
        
    @property
    def supports_extended(self) -> bool:
        return supports_extended_multizone(self.product_id)
        
    @property
    def zone_count(self) -> int:
        return get_zone_count(self.product_id)
        
    @property
    def matrix_size(self) -> Tuple[int, int]:
        return get_matrix_dimensions(self.product_id)
        
    @property
    def temperature_range(self) -> Tuple[int, int]:
        return self.info.get("temperature_range", (2500, 9000))
        
    @property
    def name(self) -> str:
        return self.info.get("name", f"LIFX Device {self.product_id}")
        
    def to_dict(self) -> Dict:
        """Export capabilities as dictionary"""
        return {
            "product_id": self.product_id,
            "name": self.name,
            "has_color": self.has_color,
            "has_infrared": self.has_infrared,
            "has_multizone": self.has_multizone,
            "has_matrix": self.has_matrix,
            "has_chain": self.has_chain,
            "supports_extended": self.supports_extended,
            "zone_count": self.zone_count,
            "matrix_width": self.matrix_size[0],
            "matrix_height": self.matrix_size[1],
            "kelvin_min": self.temperature_range[0],
            "kelvin_max": self.temperature_range[1]
        }


# Tile chain orientation mappings
TILE_ORIENTATIONS = {
    0: "RightSideUp",
    1: "RotatedRight",
    2: "UpsideDown", 
    3: "RotatedLeft",
    4: "FaceUp",
    5: "FaceDown"
}


def get_tile_pixel_index(x: int, y: int, orientation: int = 0) -> int:
    """Get linear pixel index for tile coordinates with orientation"""
    # Base mapping for right-side up
    if orientation == 0:  # RightSideUp
        return x + (y * 8)
    elif orientation == 1:  # RotatedRight
        return y + ((7 - x) * 8)
    elif orientation == 2:  # UpsideDown
        return (7 - x) + ((7 - y) * 8)
    elif orientation == 3:  # RotatedLeft
        return (7 - y) + (x * 8)
    else:
        # Face up/down - same as right side up
        return x + (y * 8)


def interpolate_zones(colors: list, target_count: int) -> list:
    """Interpolate zone colors to match target zone count"""
    if not colors:
        return [(0, 0, 65535, 3500)] * target_count
        
    if len(colors) == target_count:
        return colors
        
    if len(colors) > target_count:
        # Downsample
        step = len(colors) / target_count
        result = []
        for i in range(target_count):
            idx = int(i * step)
            result.append(colors[idx])
        return result
    else:
        # Upsample with interpolation
        result = []
        step = (len(colors) - 1) / (target_count - 1) if target_count > 1 else 0
        
        for i in range(target_count):
            pos = i * step
            idx = int(pos)
            
            if idx >= len(colors) - 1:
                result.append(colors[-1])
            else:
                # Interpolate between colors
                t = pos - idx
                c1 = colors[idx]
                c2 = colors[idx + 1]
                
                h = int(c1[0] + t * (c2[0] - c1[0]))
                s = int(c1[1] + t * (c2[1] - c1[1]))
                b = int(c1[2] + t * (c2[2] - c1[2]))
                k = int(c1[3] + t * (c2[3] - c1[3]))
                
                result.append((h, s, b, k))
                
        return result


# Effect definitions for LIFX devices
LIFX_EFFECTS = {
    "none": {"id": 0, "name": "None"},
    "move": {"id": 1, "name": "Move", "params": ["speed", "direction"]},
    "morph": {"id": 2, "name": "Morph", "params": ["speed", "palette"]},
    "flame": {"id": 3, "name": "Flame", "params": ["speed"]},
}


def validate_lifx_color(hue: int, saturation: int, brightness: int, kelvin: int) -> Tuple[int, int, int, int]:
    """Validate and clamp LIFX color values to valid ranges"""
    hue = max(0, min(65535, hue))
    saturation = max(0, min(65535, saturation))
    brightness = max(0, min(65535, brightness))
    kelvin = max(1500, min(9000, kelvin))
    return (hue, saturation, brightness, kelvin)