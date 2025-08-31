"""
LIFX Protocol Constants
Centralized constants for LIFX device types and capabilities.
"""

# Matrix/Polychrome Product IDs (TileChain devices)
MATRIX_PRODUCT_IDS = {
    55,   # LIFX Tile
    57,   # LIFX Candle
    68,   # LIFX Candle
    137,  # LIFX Candle Color US
    138,  # LIFX Candle Colour Intl
    143,  # LIFX Flex
    144,  # LIFX Flex
    176,  # LIFX Ceiling US (15")
    177,  # LIFX Ceiling Intl (15")
    185,  # LIFX Candle Color US
    186,  # LIFX Candle Colour Intl
    187,  # LIFX Candle Color US
    188,  # LIFX Candle Colour Intl
    201,  # LIFX Ceiling 13x26 US (26")
    202,  # LIFX Ceiling 13x26 Intl (26")
    215,  # LIFX Candle Color US
    216,  # LIFX Candle Colour Intl
    217,  # LIFX Tube US
    218,  # LIFX Tube Intl
    219,  # LIFX Luna US
    220,  # LIFX Luna Intl
}

# MultiZone Product IDs (strips and beams)
MULTIZONE_PRODUCT_IDS = {
    31,   # LIFX Z
    32,   # LIFX Z
    38,   # LIFX Beam
    117,  # LIFX Lightstrip US
    118,  # LIFX Lightstrip Intl
    119,  # LIFX Lightstrip US
    120,  # LIFX Lightstrip Intl
    141,  # LIFX Neon Flex US
    142,  # LIFX Neon Flex Intl
    143,  # LIFX Flex (also in matrix)
    144,  # LIFX Flex (also in matrix)
    161,  # LIFX String US
    162,  # LIFX String Intl
    203,  # LIFX String EU
    204,  # LIFX String US
    205,  # LIFX String UK
    206,  # LIFX String CA
    213,  # LIFX Lightstrip 2m US
    214,  # LIFX Lightstrip 2m Intl
}

# Extended MultiZone Product IDs (support 82 zones)
EXTENDED_MULTIZONE_PRODUCT_IDS = {
    38,   # LIFX Beam
    117,  # LIFX Lightstrip
    118,  # LIFX Lightstrip
    119,  # LIFX Lightstrip
    120,  # LIFX Lightstrip
    141,  # LIFX Neon Flex
    142,  # LIFX Neon Flex
    213,  # LIFX Lightstrip 2m
    214,  # LIFX Lightstrip 2m
}

# Matrix device dimensions
MATRIX_DIMENSIONS = {
    # Candle variants (26 zones)
    57: (6, 5),
    68: (6, 5),
    137: (6, 5),
    138: (6, 5),
    185: (6, 5),
    186: (6, 5),
    187: (6, 5),
    188: (6, 5),
    215: (6, 5),
    216: (6, 5),
    
    # Tube variants (51 zones)
    217: (5, 11),
    218: (5, 11),
    
    # Tile (64 zones)
    55: (8, 8),
    
    # Ceiling 15" (56 zones)
    176: (8, 7),
    177: (8, 7),
    
    # Ceiling 26" (120 zones)
    201: (10, 12),
    202: (10, 12),
    
    # Luna (64 zones)
    219: (8, 8),
    220: (8, 8),
    
    # Flex (variable, default to 8x8)
    143: (8, 8),
    144: (8, 8),
}

# Zone counts by product ID
MATRIX_ZONE_COUNTS = {
    # Candle variants - 26 zones
    57: 26, 68: 26, 137: 26, 138: 26, 185: 26, 
    186: 26, 187: 26, 188: 26, 215: 26, 216: 26,
    
    # Tube variants - 51 zones
    217: 51, 218: 51,
    
    # Tile - 64 zones
    55: 64,
    
    # Ceiling 15" - 56 zones
    176: 56, 177: 56,
    
    # Ceiling 26" - 120 zones
    201: 120, 202: 120,
    
    # Luna - 64 zones
    219: 64, 220: 64,
    
    # Flex - variable, default to 64
    143: 64, 144: 64,
}