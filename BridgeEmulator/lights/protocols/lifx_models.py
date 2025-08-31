"""
LIFX Model Identification and Mapping
Maps LIFX product IDs to appropriate Philips Hue model IDs and capabilities
"""

# Mapping from LIFX product IDs to Hue model IDs
# MAXIMIZING CAPABILITIES - Using the most capable Hue models regardless of form factor
# Priority: Gradient/Entertainment > Latest Gen > Color Range > Form Factor

LIFX_TO_HUE_MODEL = {
    # ALL MULTIZONE PRODUCTS -> Gradient-capable models (entertainment optimized)
    31: "LCX006",    # LIFX Z - Gradient strip V4 (most capable)
    32: "LCX006",    # LIFX Z
    38: "915005987201",  # LIFX Beam - Play gradient strip
    117: "LCX006",   # LIFX Z US
    118: "LCX006",   # LIFX Z Intl
    119: "915005987201",  # LIFX Beam US
    120: "915005987201",  # LIFX Beam Intl
    141: "LCX002",   # LIFX Neon US - Gradient Signe
    142: "LCX002",   # LIFX Neon Intl
    161: "LCX002",   # LIFX Outdoor Neon US
    162: "LCX002",   # LIFX Outdoor Neon Intl
    205: "LCX002",   # LIFX Indoor Neon US
    206: "LCX002",   # LIFX Indoor Neon Intl
    213: "LCX004",   # LIFX Permanent Outdoor US - Gradient strip outdoor
    214: "LCX004",   # LIFX Permanent Outdoor Intl
    217: "LCX002",   # LIFX Tube US - Gradient tube
    218: "LCX002",   # LIFX Tube Intl
    
    # ALL MATRIX PRODUCTS -> Most capable 2D control models
    55: "440400982841",   # LIFX Tile - Hue Tile/Panel
    57: "440400982841",   # LIFX Candle (has matrix!)
    68: "440400982841",   # LIFX Candle
    137: "440400982841",  # LIFX Candle Color US
    138: "440400982841",  # LIFX Candle Colour Intl
    143: "LST004",    # LIFX String US - Latest string lights
    144: "LST004",    # LIFX String Intl
    176: "440400982841",  # LIFX Ceiling US - Matrix ceiling
    177: "440400982841",  # LIFX Ceiling Intl
    185: "440400982841",  # LIFX Candle Color US
    186: "440400982841",  # LIFX Candle Colour Intl
    187: "440400982841",  # LIFX Candle Color US
    188: "440400982841",  # LIFX Candle Colour Intl
    201: "440400982841",  # LIFX Ceiling 13x26 US
    202: "440400982841",  # LIFX Ceiling 13x26 Intl
    203: "LST004",    # LIFX String US
    204: "LST004",    # LIFX String Intl
    215: "440400982841",  # LIFX Candle Color US
    216: "440400982841",  # LIFX Candle Colour Intl
    219: "440400982841",  # LIFX Luna US - Matrix round
    220: "440400982841",  # LIFX Luna Intl
    
    # INFRARED CAPABLE (Night Vision) -> Latest entertainment bulbs
    29: "LCT024",    # LIFX A19 Night Vision
    30: "LCT024",    # LIFX BR30 Night Vision
    45: "LCT024",    # LIFX A19 Night Vision
    46: "LCT024",    # LIFX BR30 Night Vision
    64: "LCT024",    # LIFX A19 Night Vision
    65: "LCT024",    # LIFX BR30 Night Vision
    109: "LCT024",   # LIFX A19 Night Vision
    110: "LCT024",   # LIFX BR30 Night Vision
    111: "LCT024",   # LIFX A19 Night Vision
    112: "LCT024",   # LIFX BR30 Night Vision Intl
    
    # HEV ANTIBACTERIAL -> Latest gen for special features
    90: "LCT024",    # LIFX Clean
    99: "LCT024",    # LIFX Clean
    
    # HIGH-END COLOR BULBS -> Latest generation models
    1: "LCT024",     # LIFX Original 1000
    3: "LCT024",     # LIFX Color 650
    15: "LCT024",    # LIFX Color 1000
    22: "LCT024",    # LIFX Color 1000
    27: "LCT024",    # LIFX A19
    43: "LCT024",    # LIFX A19
    62: "LCT024",    # LIFX A19
    91: "LCT024",    # LIFX Color
    92: "LCT024",    # LIFX Color
    93: "LCT024",    # LIFX A19 US
    97: "LCT024",    # LIFX A19
    100: "LCT024",   # LIFX Filament Clear
    123: "LCT024",   # LIFX Color US
    124: "LCT024",   # LIFX Colour Intl
    129: "LCT024",   # LIFX Color US
    130: "LCT024",   # LIFX Colour Intl
    135: "LCT024",   # LIFX GU10 Color US
    136: "LCT024",   # LIFX GU10 Colour Intl
    163: "LCT024",   # LIFX A19 US
    165: "LCT024",   # LIFX A19 Intl
    169: "LCT024",   # LIFX A21 1600lm US (high lumen)
    170: "LCT024",   # LIFX A21 1600lm Intl
    181: "LCT024",   # LIFX Color US
    182: "LCT024",   # LIFX Colour Intl
    
    # BR30 BULBS -> Latest BR30 model with entertainment
    20: "LCT024",    # LIFX Color 1000 BR30
    28: "LCT024",    # LIFX BR30
    44: "LCT024",    # LIFX BR30
    63: "LCT024",    # LIFX BR30
    94: "LCT024",    # LIFX BR30
    98: "LCT024",    # LIFX BR30
    164: "LCT024",   # LIFX BR30 US
    166: "LCT024",   # LIFX BR30 Intl
    
    # DOWNLIGHTS -> Latest downlight with entertainment
    36: "LCG002",    # LIFX Downlight
    37: "LCG002",    # LIFX Downlight
    40: "LCG002",    # LIFX Downlight
    121: "LCG002",   # LIFX Downlight Intl
    122: "LCG002",   # LIFX Downlight US
    167: "LCG002",   # LIFX Downlight
    168: "LCG002",   # LIFX Downlight
    178: "LCG002",   # LIFX Downlight US
    179: "LCG002",   # LIFX Downlight US
    180: "LCG002",   # LIFX Downlight US
    223: "LCG002",   # LIFX Downlight US
    224: "LCG002",   # LIFX Downlight Intl
    
    # MINI COLOR -> Compact but capable
    49: "LCT024",    # LIFX Mini Color
    59: "LCT024",    # LIFX Mini Color
    
    # GU10 SPOTS -> Latest GU10 with extended gamut
    52: "LCT003",    # LIFX GU10
    53: "LCT003",    # LIFX GU10
    
    # TUNABLE WHITE (White to Warm) -> Latest tunable models
    39: "LTW013",    # LIFX Downlight White to Warm
    50: "LTW013",    # LIFX Mini White to Warm
    60: "LTW013",    # LIFX Mini White to Warm
    81: "LTW013",    # LIFX Candle White to Warm
    96: "LTW013",    # LIFX Candle White to Warm
    113: "LTW013",   # LIFX Mini WW US
    114: "LTW013",   # LIFX Mini WW Intl
    125: "LTW013",   # LIFX White to Warm US
    126: "LTW013",   # LIFX White to Warm Intl
    131: "LTW013",   # LIFX White To Warm US
    132: "LTW013",   # LIFX White To Warm Intl
    
    # WHITE ONLY -> Basic white bulbs
    10: "LWB014",    # LIFX White 800 (Low Voltage) - newer model
    11: "LWB014",    # LIFX White 800 (High Voltage)
    18: "LWB014",    # LIFX White 900 BR30 (Low Voltage)
    19: "LWB014",    # LIFX White 900 BR30 (High Voltage)
    51: "LWB014",    # LIFX Mini White
    61: "LWB014",    # LIFX Mini White
    66: "LWB014",    # LIFX Mini White
    87: "LWB014",    # LIFX Mini White
    88: "LWB014",    # LIFX Mini White
    127: "LWB014",   # LIFX White US
    128: "LWB014",   # LIFX White Intl
    133: "LWB014",   # LIFX White US
    134: "LWB014",   # LIFX White Intl
    
    # FILAMENT BULBS -> Vintage style with warm color
    82: "LWV001",    # LIFX Filament Clear
    85: "LWV001",    # LIFX Filament Amber
    101: "LWV001",   # LIFX Filament Amber
    
    # OUTDOOR/SPECIALTY LIGHTS
    171: "LCT024",   # LIFX Round Spot US
    173: "LCT024",   # LIFX Round Path US
    174: "LCT024",   # LIFX Square Path US
    175: "LCT024",   # LIFX PAR38 US
    221: "LCT024",   # LIFX Round Spot Intl
    222: "LCT024",   # LIFX Round Path Intl
    225: "LCT024",   # LIFX PAR38 INTL
    
    # NON-LIGHT PRODUCTS (switches, etc) - Map to remote/button
    70: "ROM001",    # LIFX Switch
    71: "ROM001",    # LIFX Switch
    89: "ROM001",    # LIFX Switch
    115: "ROM001",   # LIFX Switch
    116: "ROM001",   # LIFX Switch
}

# Default model for unknown LIFX products - Use latest generation
DEFAULT_HUE_MODEL = "LCT024"  # Latest generation color bulb with best capabilities

# Product capabilities that affect Hue configuration
LIFX_CAPABILITIES = {
    "multizone": [31, 32, 38, 117, 118, 119, 120, 141, 142, 161, 162, 205, 206, 213, 214, 217, 218],  # All multizone products
    "matrix": [55, 57, 68, 137, 138, 143, 144, 176, 177, 185, 186, 187, 188, 201, 202, 203, 204, 215, 216, 219, 220],  # All matrix products
    "infrared": [29, 30, 45, 46, 64, 65, 109, 110, 111, 112],  # Night vision products
    "hev": [90, 99],  # Clean antibacterial light
    "chain": [55],  # Products that can chain together
    "extended_multizone": [38, 119, 120],  # Beam with extended multizone
    "high_lumen": [169, 170],  # A21 1600lm high brightness
    "outdoor": [161, 162, 171, 173, 174, 175, 213, 214, 221, 222, 225],  # Outdoor rated products
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
            # Different products have different zone counts
            if lifx_product_id in [38, 119, 120]:  # LIFX Beam
                capabilities["points_capable"] = 10
            elif lifx_product_id in [141, 142, 161, 162, 205, 206]:  # Neon products
                capabilities["points_capable"] = 32  # Neon can have more zones
            elif lifx_product_id in [213, 214]:  # Permanent Outdoor
                capabilities["points_capable"] = 100  # Many zones for outdoor
            elif lifx_product_id in [217, 218]:  # LIFX Tube
                capabilities["points_capable"] = 16
            else:
                capabilities["points_capable"] = 16  # Default for strips
            
        # Matrix capability
        if features.get("matrix"):
            capabilities["streaming"]["renderer"] = True
            # Different matrix products have different capabilities
            if lifx_product_id == 55:  # LIFX Tile
                capabilities["points_capable"] = 64  # 64 LEDs per tile
            elif lifx_product_id in [57, 68, 137, 138, 185, 186, 187, 188, 215, 216]:  # Candle
                capabilities["points_capable"] = 24  # Candle flame effect zones
            elif lifx_product_id in [143, 144, 203, 204]:  # String lights
                capabilities["points_capable"] = 50  # Many individual bulbs
            elif lifx_product_id in [176, 177]:  # Ceiling
                capabilities["points_capable"] = 100  # Large ceiling matrix
            elif lifx_product_id in [201, 202]:  # Ceiling 13x26
                capabilities["points_capable"] = 338  # 13x26 = 338 zones!
            elif lifx_product_id in [219, 220]:  # Luna
                capabilities["points_capable"] = 60  # Round matrix
            else:
                capabilities["points_capable"] = 64  # Default for matrix
            
        # Temperature range
        if features.get("temperature"):
            min_k = features.get("min_kelvin", 2500)
            max_k = features.get("max_kelvin", 9000)
            # LIFX has some products with extreme ranges (1500K for candles)
            if min_k == 1500:  # Candle/string lights with ultra-warm
                capabilities["control"]["ct"] = {
                    "min": 153,  # Hue's warmest
                    "max": 667  # 1500K in mirek
                }
            else:
                capabilities["control"]["ct"] = {
                    "min": max(153, int(1000000 / max_k)),  # Convert Kelvin to mirek
                    "max": min(500, int(1000000 / min_k))
                }
        
        # Color capability
        if not features.get("color", True):
            # White-only device
            capabilities["control"]["colorgamuttype"] = None
            capabilities["control"]["colorgamut"] = None
    
    # High lumen products
    if lifx_product_id in LIFX_CAPABILITIES.get("high_lumen", []):
        capabilities["control"]["maxlumen"] = 1600  # A21 high brightness
    
    # Outdoor products - more robust
    if lifx_product_id in LIFX_CAPABILITIES.get("outdoor", []):
        capabilities["outdoor"] = True
        capabilities["control"]["maxlumen"] = 1400  # Outdoor typically brighter
        
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