"""
LIFX Model Identification and Mapping
Maps LIFX product IDs to appropriate Philips Hue model IDs and capabilities
"""

# Mapping from LIFX product IDs to Hue model IDs
# Based on product capabilities and form factors
LIFX_TO_HUE_MODEL = {
    # LIFX Original & Color 1000 bulbs (A19/E26)
    1: "LCT015",    # LIFX Original 1000 - Maps to Hue A19 color
    3: "LCT015",    # LIFX Color 650
    15: "LCT015",   # LIFX Color 1000
    22: "LCT015",   # LIFX Color 1000
    27: "LCT015",   # LIFX A19
    43: "LCT015",   # LIFX A19
    62: "LCT015",   # LIFX A19
    91: "LCT015",   # LIFX Color
    92: "LCT024",   # LIFX Color - Latest gen
    93: "LCT024",   # LIFX Color
    97: "LCT024",   # LIFX A19
    99: "LCT024",   # LIFX Color
    100: "LCT024",  # LIFX A19
    109: "LCT024",  # LIFX Color
    111: "LCT024",  # LIFX A19
    123: "LCT024",  # LIFX A19
    124: "LCT024",  # LIFX A19
    135: "LCT024",  # LIFX A19
    136: "LCT024",  # LIFX A19
    137: "LCT024",  # LIFX Color
    141: "LCT024",  # LIFX A19
    142: "LCT024",  # LIFX A19
    
    # LIFX White bulbs
    10: "LWB010",   # LIFX White 800 (Low Voltage)
    11: "LWB010",   # LIFX White 800 (High Voltage)
    51: "LWB010",   # LIFX Mini White
    61: "LWB010",   # LIFX Mini White
    66: "LWB010",   # LIFX Mini White
    87: "LWB010",   # LIFX Mini White
    88: "LWB010",   # LIFX Mini White
    96: "LWB010",   # LIFX White
    110: "LWB010",  # LIFX White
    
    # LIFX White to Warm (tunable white)
    50: "LTW012",   # LIFX Mini White to Warm
    60: "LTW012",   # LIFX Mini White to Warm
    39: "LTW012",   # LIFX Downlight White to Warm
    81: "LTW012",   # LIFX Candle White to Warm
    
    # LIFX BR30 bulbs
    18: "LCT011",   # LIFX White 900 BR30 (Low Voltage)
    19: "LCT011",   # LIFX White 900 BR30 (High Voltage)
    20: "LCT011",   # LIFX Color 1000 BR30
    28: "LCT011",   # LIFX BR30
    44: "LCT011",   # LIFX BR30
    63: "LCT011",   # LIFX BR30
    94: "LCT011",   # LIFX BR30
    101: "LCT011",  # LIFX BR30
    112: "LCT011",  # LIFX BR30
    125: "LCT011",  # LIFX BR30
    143: "LCT011",  # LIFX BR30
    
    # LIFX Night Vision (infrared capable)
    29: "LCT015",   # LIFX A19 Night Vision
    30: "LCT011",   # LIFX BR30 Night Vision
    45: "LCT015",   # LIFX A19 Night Vision
    46: "LCT011",   # LIFX BR30 Night Vision
    64: "LCT015",   # LIFX A19 Night Vision
    65: "LCT011",   # LIFX BR30 Night Vision
    
    # LIFX Mini Color
    49: "LCT015",   # LIFX Mini Color
    59: "LCT015",   # LIFX Mini Color
    
    # LIFX GU10 spots
    52: "LCT003",   # LIFX GU10
    53: "LCT003",   # LIFX GU10
    
    # LIFX Downlights
    36: "LCG002",   # LIFX Downlight
    37: "LCG002",   # LIFX Downlight
    40: "LCG002",   # LIFX Downlight
    114: "LCG002",  # LIFX Downlight v3
    
    # LIFX Candle
    57: "LCT012",   # LIFX Candle
    68: "LCT012",   # LIFX Candle
    
    # LIFX Filament bulbs (Edison style)
    82: "LWV001",   # LIFX Filament Clear
    85: "LWV001",   # LIFX Filament Amber
    
    # LIFX Clean (HEV antibacterial)
    90: "LCT015",   # LIFX Clean
    
    # LIFX Color outdoor/specialty
    98: "LCT014",   # LIFX Solarlights
    102: "LCT014",  # LIFX Color Light
    
    # LIFX Neon Flex & Rope
    117: "LCX002",  # LIFX Neon Flex
    118: "LCX002",  # LIFX Neon Rope Light
    
    # LIFX String lights
    119: "LST002",  # LIFX String Light
    
    # LIFX Holiday lights
    139: "LST002",  # LIFX Holiday Lights
    
    # LIFX Z (multizone light strip) - Maps to Hue Lightstrip Plus
    31: "LCL001",   # LIFX Z
    32: "LCL001",   # LIFX Z 
    38: "915005987201",  # LIFX Beam - Maps to Hue Play gradient strip
    
    # LIFX Tile (matrix lights) - Maps to Hue Tile/Panel
    55: "440400982841",  # LIFX Tile
    
    # Non-light products (switches, etc) - Map to generic
    70: "ROM001",   # LIFX Switch
    71: "ROM001",   # LIFX Switch
    89: "ROM001",   # LIFX Switch
}

# Default model for unknown LIFX products
DEFAULT_HUE_MODEL = "LCT015"  # Generic color bulb

# Product capabilities that affect Hue configuration
LIFX_CAPABILITIES = {
    "multizone": [31, 32, 38],  # Light strips with zones
    "matrix": [55],  # Tile products with 2D control
    "infrared": [29, 30, 45, 46, 64, 65],  # Night vision products
    "hev": [90],  # Clean antibacterial light
    "chain": [55],  # Products that can chain together
    "extended_multizone": [38],  # Beam with extended multizone
}

def get_hue_model_from_lifx(lifx_product_id: int, product_name: str = None) -> str:
    """
    Get appropriate Hue model ID from LIFX product ID.
    
    Args:
        lifx_product_id: LIFX product ID number
        product_name: Optional LIFX product name for better matching
        
    Returns:
        Hue model ID string
    """
    # Direct mapping
    if lifx_product_id in LIFX_TO_HUE_MODEL:
        return LIFX_TO_HUE_MODEL[lifx_product_id]
    
    # Try to guess based on product name if available
    if product_name:
        name_lower = product_name.lower()
        
        # Check for specific product types
        if "br30" in name_lower:
            return "LCT011"  # BR30 bulb
        elif "gu10" in name_lower:
            return "LCT003"  # GU10 spot
        elif "downlight" in name_lower:
            return "LCG002"  # Downlight
        elif "candle" in name_lower:
            return "LCT012"  # Candle bulb
        elif "filament" in name_lower:
            return "LWV001"  # Filament bulb
        elif "strip" in name_lower or " z " in name_lower:
            return "LCL001"  # Light strip
        elif "beam" in name_lower:
            return "915005987201"  # Play gradient strip
        elif "tile" in name_lower:
            return "440400982841"  # Tile/Panel
        elif "mini" in name_lower:
            if "white to warm" in name_lower:
                return "LTW012"  # Tunable white
            elif "white" in name_lower:
                return "LWB010"  # White only
            else:
                return "LCT015"  # Color
        elif "white to warm" in name_lower:
            return "LTW012"  # Tunable white
        elif "white" in name_lower:
            return "LWB010"  # White only
        elif "neon" in name_lower:
            return "LCX002"  # Neon/gradient strip
        elif "string" in name_lower or "holiday" in name_lower:
            return "LST002"  # String lights
    
    # Default to color bulb
    return DEFAULT_HUE_MODEL

def get_lifx_capabilities(lifx_product_id: int, features: dict = None) -> dict:
    """
    Get LIFX device capabilities for Hue bridge configuration.
    
    Args:
        lifx_product_id: LIFX product ID number
        features: Optional features dict from LIFX device
        
    Returns:
        Dictionary of capabilities
    """
    capabilities = {
        "certified": True,
        "streaming": {
            "renderer": lifx_product_id in LIFX_CAPABILITIES.get("multizone", []) or 
                       lifx_product_id in LIFX_CAPABILITIES.get("matrix", []),
            "proxy": False
        },
        "control": {
            "mindimlevel": 1000,
            "maxlumen": 1100,  # Default, varies by product
            "colorgamuttype": "C",  # Gamut C for LIFX products
            "colorgamut": [
                [0.6915, 0.3083],  # Red
                [0.1700, 0.7000],  # Green  
                [0.1532, 0.0475]   # Blue
            ]
        }
    }
    
    # Adjust based on features if available
    if features:
        # Multizone capability
        if features.get("multizone"):
            capabilities["streaming"]["renderer"] = True
            capabilities["points_capable"] = 16  # LIFX strips have 16 zones typically
            
        # Matrix capability (Tiles)
        if features.get("matrix"):
            capabilities["streaming"]["renderer"] = True
            capabilities["points_capable"] = 64  # Tiles have 64 LEDs each
            
        # Temperature range
        if features.get("temperature"):
            min_k = features.get("min_kelvin", 2500)
            max_k = features.get("max_kelvin", 9000)
            capabilities["control"]["ct"] = {
                "min": max(153, int(1000000 / max_k)),  # Convert Kelvin to mirek
                "max": min(500, int(1000000 / min_k))
            }
        
        # Color capability
        if not features.get("color", True):
            # White-only device
            capabilities["control"]["colorgamuttype"] = None
            capabilities["control"]["colorgamut"] = None
    
    # Special handling for known products
    if lifx_product_id == 38:  # LIFX Beam
        capabilities["points_capable"] = 10  # 10 zones
    elif lifx_product_id in [31, 32]:  # LIFX Z strips
        capabilities["points_capable"] = 16  # 16 zones default
    elif lifx_product_id == 55:  # LIFX Tile
        capabilities["points_capable"] = 64  # 64 LEDs per tile
        
    return capabilities

def identify_lifx_model(device) -> tuple:
    """
    Identify LIFX device model and capabilities.
    
    Args:
        device: LIFX device object
        
    Returns:
        Tuple of (hue_model_id, capabilities_dict, product_name)
    """
    try:
        # Get product info from device
        product_id = device.get_product()
        product_name = device.get_product_name()
        features = device.get_product_features()
        
        # Get Hue model ID
        hue_model = get_hue_model_from_lifx(product_id, product_name)
        
        # Get capabilities
        capabilities = get_lifx_capabilities(product_id, features)
        
        return hue_model, capabilities, product_name
        
    except Exception as e:
        # Default fallback
        return DEFAULT_HUE_MODEL, get_lifx_capabilities(0), "Unknown LIFX"