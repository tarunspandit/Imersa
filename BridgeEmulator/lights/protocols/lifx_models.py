MULTIZONE_PIDS=set()
MATRIX_PIDS=set()
EXTENDED_MZ_PIDS=set()
GRADIENT_MODEL='LCX004'
"""
LIFX Model Identification and Mapping
Maps LIFX product IDs to appropriate Philips Hue model IDs and capabilities
"""

from typing import Dict, Any, Optional, Tuple

# Mapping from LIFX product IDs to Hue model IDs
# MAXIMIZING CAPABILITIES - Using the most capable Hue models regardless of form factor
# Priority: Gradient/Entertainment > Latest Gen > Color Range > Form Factor

LIFX_TO_HUE_MODEL = {
    # ALL MULTIZONE PRODUCTS -> LCX004 Ambiance Gradient (allows multiple in entertainment zone)
    31: "LCX004",    # LIFX Z - Ambiance Gradient
    32: "LCX004",    # LIFX Z
    38: "LCX004",    # LIFX Beam - Ambiance Gradient
    117: "LCX004",   # LIFX Z US
    118: "LCX004",   # LIFX Z Intl
    119: "LCX004",   # LIFX Beam US
    120: "LCX004",   # LIFX Beam Intl
    141: "LCX004",   # LIFX Neon US - Ambiance Gradient
    142: "LCX004",   # LIFX Neon Intl
    161: "LCX004",   # LIFX Outdoor Neon US
    162: "LCX004",   # LIFX Outdoor Neon Intl
    205: "LCX004",   # LIFX Indoor Neon US
    206: "LCX004",   # LIFX Indoor Neon Intl
    213: "LCX004",   # LIFX Permanent Outdoor US
    214: "LCX004",   # LIFX Permanent Outdoor Intl
    217: "LCX004",   # LIFX Tube US - Ambiance Gradient
    218: "LCX004",   # LIFX Tube Intl
    
    # ALL MATRIX PRODUCTS -> LCX004 Ambiance Gradient (avoids Play strip limitation)
    55: "LCX004",    # LIFX Tile - Ambiance Gradient
    57: "LCX004",    # LIFX Candle - Ambiance Gradient
    68: "LCX004",    # LIFX Candle
    137: "LCX004",   # LIFX Candle Color US
    138: "LCX004",   # LIFX Candle Colour Intl
    143: "LCX004",   # LIFX String US - Ambiance Gradient for addressable zones
    144: "LCX004",   # LIFX String Intl
    176: "LCX004",   # LIFX Ceiling US - Ambiance Gradient
    177: "LCX004",   # LIFX Ceiling Intl
    185: "LCX004",   # LIFX Candle Color US
    186: "LCX004",   # LIFX Candle Colour Intl
    187: "LCX004",   # LIFX Candle Color US
    188: "LCX004",   # LIFX Candle Colour Intl
    201: "LCX004",   # LIFX Ceiling 13x26 US - Ambiance Gradient
    202: "LCX004",   # LIFX Ceiling 13x26 Intl
    203: "LCX004",   # LIFX String US
    204: "LCX004",   # LIFX String Intl
    215: "LCX004",   # LIFX Candle Color US
    216: "LCX004",   # LIFX Candle Colour Intl
    219: "LCX004",   # LIFX Luna US - Ambiance Gradient
    220: "LCX004",   # LIFX Luna Intl
    
    # INFRARED CAPABLE (Night Vision) -> Latest Hue bulb models with best features
    29: "LCA005",    # LIFX A19 Night Vision - Latest A19 model
    30: "LCA005",    # LIFX BR30 Night Vision - Use A19 model (no BR30 gradient)
    45: "LCA005",    # LIFX A19 Night Vision
    46: "LCA005",    # LIFX BR30 Night Vision
    64: "LCA005",    # LIFX A19 Night Vision
    65: "LCA005",    # LIFX BR30 Night Vision
    109: "LCA005",   # LIFX A19 Night Vision
    110: "LCA005",   # LIFX BR30 Night Vision
    111: "LCA005",   # LIFX A19 Night Vision
    112: "LCA005",   # LIFX BR30 Night Vision Intl
    
    # HEV ANTIBACTERIAL -> Latest bulb for special features
    90: "LCA005",    # LIFX Clean
    99: "LCA005",    # LIFX Clean
    
    # HIGH-END COLOR BULBS -> Latest A19 model (LCA005 = v7 with best gamut)
    1: "LCA005",     # LIFX Original 1000
    3: "LCA005",     # LIFX Color 650
    15: "LCA005",    # LIFX Color 1000
    22: "LCA005",    # LIFX Color 1000
    27: "LCA005",    # LIFX A19
    43: "LCA005",    # LIFX A19
    62: "LCA005",    # LIFX A19
    91: "LCA005",    # LIFX Color
    92: "LCA005",    # LIFX Color
    93: "LCA005",    # LIFX A19 US
    97: "LCA005",    # LIFX A19
    100: "LCA005",   # LIFX Filament Clear (use color model for capability)
    123: "LCA005",   # LIFX Color US
    124: "LCA005",   # LIFX Colour Intl
    129: "LCA005",   # LIFX Color US
    130: "LCA005",   # LIFX Colour Intl
    135: "LCA005",   # LIFX GU10 Color US (use A19 model for capability)
    136: "LCA005",   # LIFX GU10 Colour Intl
    163: "LCA005",   # LIFX A19 US
    165: "LCA005",   # LIFX A19 Intl
    169: "LCA005",   # LIFX A21 1600lm US (high lumen)
    170: "LCA005",   # LIFX A21 1600lm Intl
    181: "LCA005",   # LIFX Color US
    182: "LCA005",   # LIFX Colour Intl
    
    # BR30 BULBS -> Use best A19 model (no special BR30 in light_types)
    20: "LCA005",    # LIFX Color 1000 BR30
    28: "LCA005",    # LIFX BR30
    44: "LCA005",    # LIFX BR30
    63: "LCA005",    # LIFX BR30
    94: "LCA005",    # LIFX BR30
    98: "LCA005",    # LIFX BR30
    164: "LCA005",   # LIFX BR30 US
    166: "LCA005",   # LIFX BR30 Intl
    
    # DOWNLIGHTS -> Use best bulb model (no downlight model in light_types)
    36: "LCA005",    # LIFX Downlight
    37: "LCA005",    # LIFX Downlight
    40: "LCA005",    # LIFX Downlight
    121: "LCA005",   # LIFX Downlight Intl
    122: "LCA005",   # LIFX Downlight US
    167: "LCA005",   # LIFX Downlight
    168: "LCA005",   # LIFX Downlight
    178: "LCA005",   # LIFX Downlight US
    179: "LCA005",   # LIFX Downlight US
    180: "LCA005",   # LIFX Downlight US
    223: "LCA005",   # LIFX Downlight US
    224: "LCA005",   # LIFX Downlight Intl
    
    # MINI COLOR -> Use best bulb model
    49: "LCA005",    # LIFX Mini Color
    59: "LCA005",    # LIFX Mini Color
    
    # GU10 SPOTS -> Use best bulb (no GU10 in light_types)
    52: "LCA005",    # LIFX GU10
    53: "LCA005",    # LIFX GU10
    
    # TUNABLE WHITE (White to Warm) -> LTW001 (only tunable model available)
    39: "LTW001",    # LIFX Downlight White to Warm
    50: "LTW001",    # LIFX Mini White to Warm
    60: "LTW001",    # LIFX Mini White to Warm
    81: "LTW001",    # LIFX Candle White to Warm
    96: "LTW001",    # LIFX Candle White to Warm
    113: "LTW001",   # LIFX Mini WW US
    114: "LTW001",   # LIFX Mini WW Intl
    125: "LTW001",   # LIFX White to Warm US
    126: "LTW001",   # LIFX White to Warm Intl
    131: "LTW001",   # LIFX White To Warm US
    132: "LTW001",   # LIFX White To Warm Intl
    
    # WHITE ONLY -> LWB010 (only white model available)
    10: "LWB010",    # LIFX White 800 (Low Voltage)
    11: "LWB010",    # LIFX White 800 (High Voltage)
    18: "LWB010",    # LIFX White 900 BR30 (Low Voltage)
    19: "LWB010",    # LIFX White 900 BR30 (High Voltage)
    51: "LWB010",    # LIFX Mini White
    61: "LWB010",    # LIFX Mini White
    66: "LWB010",    # LIFX Mini White
    87: "LWB010",    # LIFX Mini White
    88: "LWB010",    # LIFX Mini White
    127: "LWB010",   # LIFX White US
    128: "LWB010",   # LIFX White Intl
    133: "LWB010",   # LIFX White US
    134: "LWB010",   # LIFX White Intl
    
    # FILAMENT BULBS -> Use tunable white for vintage style
    82: "LTW001",    # LIFX Filament Clear - tunable for warmth
    85: "LTW001",    # LIFX Filament Amber
    101: "LTW001",   # LIFX Filament Amber
    
    # OUTDOOR/SPECIALTY LIGHTS -> Use best bulb model
    171: "LCA005",   # LIFX Round Spot US
    173: "LCA005",   # LIFX Round Path US
    174: "LCA005",   # LIFX Square Path US
    175: "LCA005",   # LIFX PAR38 US
    221: "LCA005",   # LIFX Round Spot Intl
    222: "LCA005",   # LIFX Round Path Intl
    225: "LCA005",   # LIFX PAR38 INTL
    
    # NON-LIGHT PRODUCTS (switches, etc) - Map to smart plug
    70: "LOM001",    # LIFX Switch - Use smart plug model
    71: "LOM001",    # LIFX Switch
    89: "LOM001",    # LIFX Switch
    115: "LOM001",   # LIFX Switch
    116: "LOM001",   # LIFX Switch
    
    # Additional fallback for common unknown IDs
    0: "LCA005",      # Unknown/Default - Use best color bulb
}

# Default model for unknown LIFX products - Use best available color bulb
DEFAULT_HUE_MODEL = "LCA005"  # Latest A19 v7 with Gamut C and entertainment

# Product capabilities that affect Hue configuration
LIFX_CAPABILITIES = {
    "multizone": [31, 32, 38, 117, 118, 119, 120, 141, 142, 161, 162, 205, 206, 213, 214],  # All multizone products (linear strips)
    "matrix": [55, 57, 68, 137, 138, 143, 144, 176, 177, 185, 186, 187, 188, 201, 202, 203, 204, 215, 216, 217, 218, 219, 220],  # All matrix/polychrome products (includes Tube)
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
    # Log unmapped product IDs
    if lifx_product_id not in LIFX_TO_HUE_MODEL and lifx_product_id != 0:
        import logging
        logging.info(f"LIFX: Unmapped product ID {lifx_product_id} with name '{product_name}'")
    
    # Direct mapping
    if lifx_product_id in LIFX_TO_HUE_MODEL:
        return LIFX_TO_HUE_MODEL[lifx_product_id]
    
    # Try to guess based on product name if available
    # IMPORTANT: Only use model IDs that exist in light_types.py
    if product_name:
        name_lower = product_name.lower()
        
        # Check for specific product types
        if "br30" in name_lower:
            return "LCA005"  # Use latest A19 model (no BR30 model exists)
        elif "gu10" in name_lower:
            return "LCA005"  # Use latest A19 model (no GU10 model exists)
        elif "downlight" in name_lower:
            return "LCA005"  # Use latest A19 model (no downlight model exists)
        elif "candle" in name_lower:
            return "LCX004"  # Ambiance Gradient for matrix capability
        elif "filament" in name_lower:
            return "LTW001"  # Tunable white (no filament model exists)
        elif "strip" in name_lower or " z " in name_lower:
            return "LCX004"  # Ambiance Gradient strip
        elif "beam" in name_lower:
            return "LCX004"  # Ambiance Gradient strip
        elif "tile" in name_lower:
            return "LCX004"  # Ambiance Gradient for matrix
        elif "mini" in name_lower:
            if "white to warm" in name_lower:
                return "LTW001"  # Tunable white
            elif "white" in name_lower:
                return "LWB010"  # White only
            else:
                return "LCA005"  # Latest color bulb
        elif "white to warm" in name_lower:
            return "LTW001"  # Tunable white  
        elif "white" in name_lower:
            return "LWB010"  # White only
        elif "neon" in name_lower:
            return "LCX004"  # Ambiance Gradient for zones
        elif "string" in name_lower or "holiday" in name_lower:
            return "LCX004"  # Ambiance Gradient for addressable zones
    
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
    # Check if product is multizone or matrix
    is_multizone = lifx_product_id in LIFX_CAPABILITIES.get("multizone", [])
    is_matrix = lifx_product_id in LIFX_CAPABILITIES.get("matrix", [])
    
    capabilities = {
        "certified": True,
        "streaming": {
            "renderer": is_multizone or is_matrix,
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
    
    # Set points_capable based on product ID (hardcoded defaults)
    if is_multizone:
        # Multizone products (linear strips)
        if lifx_product_id in [38, 119, 120]:  # LIFX Beam
            capabilities["points_capable"] = 10
        elif lifx_product_id in [141, 142, 161, 162, 205, 206]:  # Neon products
            capabilities["points_capable"] = 32  # Neon can have more zones
        elif lifx_product_id in [213, 214]:  # Permanent Outdoor
            capabilities["points_capable"] = 100  # Many zones for outdoor
        else:
            capabilities["points_capable"] = 16  # Default for strips
    
    elif is_matrix:
        # Matrix products (Polychrome technology)
        if lifx_product_id == 55:  # LIFX Tile
            capabilities["points_capable"] = 64  # 64 LEDs per tile
        elif lifx_product_id in [57, 68, 137, 138, 185, 186, 187, 188, 215, 216]:  # Candle
            capabilities["points_capable"] = 26  # 26 zones per Candle (official spec)
        elif lifx_product_id in [143, 144, 203, 204]:  # String lights
            capabilities["points_capable"] = 50  # Many individual bulbs
        elif lifx_product_id in [176, 177]:  # Ceiling
            capabilities["points_capable"] = 56  # 56 zones
        elif lifx_product_id in [201, 202]:  # Ceiling 13x26
            capabilities["points_capable"] = 120  # 120 zones (official spec)
        elif lifx_product_id in [217, 218]:  # LIFX Tube
            capabilities["points_capable"] = 52  # 52 zones per Tube (official spec)
        elif lifx_product_id in [219, 220]:  # Luna
            capabilities["points_capable"] = 60  # Round matrix
        else:
            capabilities["points_capable"] = 64  # Default for matrix
    
    # Override with features if available (but don't remove capabilities)
    if features:
        # Only enhance capabilities, don't remove them
        if features.get("multizone") and not capabilities.get("points_capable"):
            capabilities["streaming"]["renderer"] = True
            capabilities["points_capable"] = 16  # Default if not already set
            
        if features.get("matrix") and not capabilities.get("points_capable"):
            capabilities["streaming"]["renderer"] = True
            capabilities["points_capable"] = 64  # Default if not already set
            
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
        
        # Log unknown product IDs for debugging
        if product_name == "Unknown" or product_name == "Unknown product":
            import logging
            logging.info(f"LIFX: Found unknown product with ID {product_id}, features: {features}")
        
        # Get Hue model ID
        hue_model = get_hue_model_from_lifx(product_id, product_name)
        
        # Get capabilities
        capabilities = get_lifx_capabilities(product_id, features)
        
        # Query actual device zone/tile count for accurate capabilities
        if capabilities.get("points_capable", 0) > 0:
            actual_zones = _get_device_actual_zones(device)
            if actual_zones > 0:
                capabilities["points_capable"] = actual_zones
            
            # Get matrix dimensions for tile devices
            matrix_dims = _get_device_matrix_dimensions(device)
            if matrix_dims:
                capabilities["matrix_width"] = matrix_dims[0]
                capabilities["matrix_height"] = matrix_dims[1]
        
        return hue_model, capabilities, product_name
        
    except Exception as e:
        # Default fallback
        import logging
        logging.debug(f"LIFX: Error identifying device: {e}")
        return DEFAULT_HUE_MODEL, get_lifx_capabilities(0), "Unknown LIFX"

def _get_device_actual_zones(device) -> int:
    """Query actual zone count from LIFX device.
    
    Args:
        device: LIFX device object
        
    Returns:
        int: Actual number of zones from device, or 0 if unable to query
    """
    try:
        # For MultiZone devices (strips, beams, etc)
        if hasattr(device, 'get_color_zones'):
            try:
                # Import the message types we need
                from lifxlan.msgtypes import MultiZoneGetColorZones, MultiZoneStateZone, MultiZoneStateMultiZone
                
                # Query zones from device
                response = device.req_with_resp(
                    MultiZoneGetColorZones, 
                    [MultiZoneStateZone, MultiZoneStateMultiZone], 
                    {"start_index": 0, "end_index": 255}
                )
                
                if hasattr(response, 'count'):
                    import logging
                    logging.debug(f"LIFX: Device {device.get_label()} has {response.count} zones")
                    return response.count
            except Exception as e:
                import logging
                logging.debug(f"LIFX: Unable to query zones from multizone device: {e}")
        
        # For TileChain devices (tiles, candles, etc)
        if hasattr(device, 'get_tile_count'):
            try:
                tile_count = device.get_tile_count()
                # Each tile typically has 64 zones (8x8)
                total_zones = tile_count * 64
                import logging
                logging.debug(f"LIFX: Device {device.get_label()} has {tile_count} tiles = {total_zones} zones")
                return total_zones
            except Exception as e:
                import logging
                logging.debug(f"LIFX: Unable to query tiles from tile device: {e}")
        
        return 0
    except:
        return 0

def _get_device_matrix_dimensions(device) -> Optional[Tuple[int, int]]:
    """Get matrix dimensions for tile/matrix devices.
    
    Args:
        device: LIFX device object
        
    Returns:
        Optional[Tuple[int, int]]: (width, height) or None if not a matrix device
    """
    try:
        # For TileChain devices
        if hasattr(device, 'get_tile_info'):
            try:
                tile_info = device.get_tile_info()
                if tile_info and len(tile_info) > 0:
                    # Get dimensions from first tile
                    first_tile = tile_info[0]
                    width = first_tile.width if hasattr(first_tile, 'width') else 8
                    height = first_tile.height if hasattr(first_tile, 'height') else 8
                    
                    import logging
                    logging.debug(f"LIFX: Device {device.get_label()} has matrix dimensions {width}x{height}")
                    return (width, height)
            except Exception as e:
                import logging
                logging.debug(f"LIFX: Unable to query tile info: {e}")
        
        # For known matrix products, return default dimensions
        try:
            product_id = device.get_product()
            
            # Known matrix dimensions  
            if product_id in [57, 68, 137, 138, 185, 186, 187, 188, 215, 216]:  # Candle
                return (5, 6)
            elif product_id in [176, 177]:  # Ceiling
                return (8, 7)
            elif product_id in [201, 202]:  # Ceiling 13x26
                return (10, 12)
            elif product_id in [217, 218]:  # Tube
                return (8, 7)
            elif product_id in [219, 220]:  # Luna
                return (8, 8)
            elif product_id == 55:  # Tile
                return (8, 8)
        except:
            pass
        
        return None
    except:
        return None

def get_hue_model_from_lifx(lifx_product_id: int, product_name: Optional[str] = None) -> str:
    if lifx_product_id in LIFX_TO_HUE_MODEL:
        return LIFX_TO_HUE_MODEL[lifx_product_id]
    if lifx_product_id in MULTIZONE_PIDS or lifx_product_id in MATRIX_PIDS:
        return GRADIENT_MODEL
    return DEFAULT_HUE_MODEL

def get_lifx_capabilities(lifx_product_id: int, features: Optional[dict] = None) -> dict:
    features = features or {}
    is_multizone = lifx_product_id in MULTIZONE_PIDS or bool(features.get("multizone"))
    is_matrix    = lifx_product_id in MATRIX_PIDS or bool(features.get("matrix"))
    return {
        "multizone": is_multizone,
        "matrix": is_matrix,
        "extended_multizone": lifx_product_id in EXTENDED_MZ_PIDS,
        "control": {
            "colorgamuttype": "C",
            "colorgamut": [[0.6915,0.3083],[0.1700,0.7000],[0.1532,0.0475]],
            "mindimlevel": 2000,
            "maxlumen": 1100,
        }
    }

def identify_lifx_model(device) -> Tuple[str, dict, str]:
    pid, name = -1, "LIFX"
    try:
        if hasattr(device, "get_product_id"):
            pid = int(device.get_product_id())
    except Exception:
        pass
    try:
        if hasattr(device, "get_label"):
            name = device.get_label() or name
    except Exception:
        pass
    hue_model = get_hue_model_from_lifx(pid, name)
    features = {}
    try:
        if hasattr(device, "get_product_features"):
            features = device.get_product_features() or {}
    except Exception:
        features = {}
    caps = get_lifx_capabilities(pid, features)
    return hue_model, caps, name

