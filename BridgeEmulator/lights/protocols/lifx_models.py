#!/usr/bin/env python3
"""
LIFX Device Models and Capabilities
High-performance device management for LIFX products
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import IntEnum

class LIFXProduct(IntEnum):
    """LIFX Product IDs"""
    # Bulbs
    ORIGINAL_1000 = 1
    COLOR_650 = 3
    WHITE_800_LV = 10
    WHITE_800_HV = 11
    WHITE_900_BR30_LV = 18
    WHITE_900_BR30_HV = 19
    COLOR_1000_BR30 = 20
    COLOR_1000 = 22
    A19 = 27
    BR30 = 28
    A19_PLUS = 29
    BR30_PLUS = 30
    
    # Candles & Accent
    CANDLE = 68
    CANDLE_COLOR = 96
    
    # Light Strips
    Z = 31
    Z_2 = 32
    BEAM = 38
    LIGHTSTRIP = 81
    NEON = 117
    
    # Matrix Products
    TILE = 55
    CANDLE_MATRIX = 57
    TUBE = 121
    CEILING = 174
    CEILING_320 = 175
    CEILING_400 = 176
    
    # Mini Series
    MINI_COLOR = 49
    MINI_WHITE = 50
    MINI_DAY_DUSK = 51
    MINI_WHITE_INT = 59
    MINI_COLOR_INT = 60
    
    # Downlights
    DOWNLIGHT = 36
    DOWNLIGHT_WHITE = 37
    DOWNLIGHT_COLOR = 39
    DOWNLIGHT_WHITE_INT = 40
    
    # Switches
    SWITCH = 70
    SWITCH_V2 = 71
    RELAY = 89

@dataclass
class DeviceCapabilities:
    """Device capability definitions"""
    has_color: bool = True
    has_variable_color_temp: bool = True
    has_ir: bool = False
    has_chain: bool = False
    has_matrix: bool = False
    has_multizone: bool = False
    has_extended_multizone: bool = False
    min_kelvin: int = 1500
    max_kelvin: int = 9000
    zones: int = 0
    zone_width: int = 0
    zone_height: int = 0
    
    @property
    def total_zones(self) -> int:
        """Calculate total zones for matrix devices"""
        if self.has_matrix:
            return self.zone_width * self.zone_height
        return self.zones

# Device capability mappings
DEVICE_CAPABILITIES: Dict[int, DeviceCapabilities] = {
    # Standard bulbs
    LIFXProduct.ORIGINAL_1000: DeviceCapabilities(),
    LIFXProduct.COLOR_650: DeviceCapabilities(),
    LIFXProduct.COLOR_1000: DeviceCapabilities(),
    LIFXProduct.A19: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    LIFXProduct.BR30: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    LIFXProduct.A19_PLUS: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    LIFXProduct.BR30_PLUS: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    
    # White only bulbs
    LIFXProduct.WHITE_800_LV: DeviceCapabilities(has_color=False, min_kelvin=2700, max_kelvin=6500),
    LIFXProduct.WHITE_800_HV: DeviceCapabilities(has_color=False, min_kelvin=2700, max_kelvin=6500),
    LIFXProduct.WHITE_900_BR30_LV: DeviceCapabilities(has_color=False, min_kelvin=2700, max_kelvin=6500),
    LIFXProduct.WHITE_900_BR30_HV: DeviceCapabilities(has_color=False, min_kelvin=2700, max_kelvin=6500),
    
    # Candles
    LIFXProduct.CANDLE: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    LIFXProduct.CANDLE_COLOR: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    
    # Matrix Candle (6x5 zones)
    LIFXProduct.CANDLE_MATRIX: DeviceCapabilities(
        has_matrix=True,
        has_extended_multizone=True,
        zone_width=6,
        zone_height=5,
        zones=26,  # 6x5 minus corners
        min_kelvin=2500,
        max_kelvin=9000
    ),
    
    # Light strips (multizone)
    LIFXProduct.Z: DeviceCapabilities(
        has_multizone=True,
        zones=16,
        min_kelvin=2500,
        max_kelvin=9000
    ),
    LIFXProduct.BEAM: DeviceCapabilities(
        has_multizone=True,
        has_extended_multizone=True,
        zones=10,
        min_kelvin=2500,
        max_kelvin=9000
    ),
    LIFXProduct.LIGHTSTRIP: DeviceCapabilities(
        has_multizone=True,
        has_extended_multizone=True,
        zones=82,
        min_kelvin=1500,
        max_kelvin=9000
    ),
    LIFXProduct.NEON: DeviceCapabilities(
        has_multizone=True,
        has_extended_multizone=True,
        zones=32,
        min_kelvin=2500,
        max_kelvin=9000
    ),
    
    # Tile (8x8 zones)
    LIFXProduct.TILE: DeviceCapabilities(
        has_matrix=True,
        has_extended_multizone=True,
        has_chain=True,
        zone_width=8,
        zone_height=8,
        zones=64,
        min_kelvin=2500,
        max_kelvin=9000
    ),
    
    # Tube (5x11 zones)
    LIFXProduct.TUBE: DeviceCapabilities(
        has_matrix=True,
        has_extended_multizone=True,
        zone_width=5,
        zone_height=11,
        zones=51,  # 5x11 minus corners
        min_kelvin=2500,
        max_kelvin=9000
    ),
    
    # Ceiling (8x7 zones for 15", more for larger models)
    LIFXProduct.CEILING: DeviceCapabilities(
        has_matrix=True,
        has_extended_multizone=True,
        zone_width=8,
        zone_height=7,
        zones=56,
        min_kelvin=2500,
        max_kelvin=9000
    ),
    LIFXProduct.CEILING_320: DeviceCapabilities(
        has_matrix=True,
        has_extended_multizone=True,
        zone_width=10,
        zone_height=8,
        zones=80,
        min_kelvin=2500,
        max_kelvin=9000
    ),
    LIFXProduct.CEILING_400: DeviceCapabilities(
        has_matrix=True,
        has_extended_multizone=True,
        zone_width=12,
        zone_height=10,
        zones=120,
        min_kelvin=2500,
        max_kelvin=9000
    ),
    
    # Mini series
    LIFXProduct.MINI_COLOR: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    LIFXProduct.MINI_WHITE: DeviceCapabilities(has_color=False, min_kelvin=2700, max_kelvin=6500),
    LIFXProduct.MINI_DAY_DUSK: DeviceCapabilities(has_color=False, min_kelvin=2700, max_kelvin=4000),
    
    # Downlights
    LIFXProduct.DOWNLIGHT: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    LIFXProduct.DOWNLIGHT_COLOR: DeviceCapabilities(min_kelvin=2500, max_kelvin=9000),
    LIFXProduct.DOWNLIGHT_WHITE: DeviceCapabilities(has_color=False, min_kelvin=2700, max_kelvin=6500),
}

@dataclass
class LIFXDevice:
    """LIFX device representation with performance optimizations"""
    ip: str
    mac: str
    label: str = ""
    product_id: int = 0
    vendor_id: int = 1  # LIFX vendor ID
    version: int = 0
    capabilities: Optional[DeviceCapabilities] = None
    
    def __post_init__(self):
        """Initialize capabilities based on product ID"""
        if self.capabilities is None and self.product_id in DEVICE_CAPABILITIES:
            self.capabilities = DEVICE_CAPABILITIES[self.product_id]
        elif self.capabilities is None:
            # Default capabilities for unknown products
            self.capabilities = DeviceCapabilities()
    
    @property
    def is_matrix(self) -> bool:
        """Check if device is a matrix product"""
        return self.capabilities.has_matrix if self.capabilities else False
    
    @property
    def is_multizone(self) -> bool:
        """Check if device supports multizone"""
        return self.capabilities.has_multizone if self.capabilities else False
    
    @property
    def zone_count(self) -> int:
        """Get total number of zones"""
        if self.capabilities:
            return self.capabilities.total_zones
        return 0
    
    def get_zone_layout(self) -> Tuple[int, int]:
        """Get zone layout (width, height) for matrix devices"""
        if self.capabilities and self.capabilities.has_matrix:
            return (self.capabilities.zone_width, self.capabilities.zone_height)
        return (0, 0)
    
    def supports_extended_multizone(self) -> bool:
        """Check if device supports extended multizone (82 zones per message)"""
        return self.capabilities.has_extended_multizone if self.capabilities else False
    
    def get_kelvin_range(self) -> Tuple[int, int]:
        """Get supported kelvin temperature range"""
        if self.capabilities:
            return (self.capabilities.min_kelvin, self.capabilities.max_kelvin)
        return (2500, 9000)  # Default range

class DeviceRegistry:
    """Registry for managing LIFX devices"""
    
    def __init__(self):
        self.devices: Dict[str, LIFXDevice] = {}  # Keyed by MAC address
        self.ip_to_mac: Dict[str, str] = {}  # IP to MAC mapping
        
    def register_device(self, device: LIFXDevice) -> bool:
        """Register a new device"""
        if device.mac:
            self.devices[device.mac] = device
            if device.ip:
                self.ip_to_mac[device.ip] = device.mac
            return True
        return False
    
    def get_device_by_mac(self, mac: str) -> Optional[LIFXDevice]:
        """Get device by MAC address"""
        return self.devices.get(mac)
    
    def get_device_by_ip(self, ip: str) -> Optional[LIFXDevice]:
        """Get device by IP address"""
        mac = self.ip_to_mac.get(ip)
        if mac:
            return self.devices.get(mac)
        return None
    
    def update_device_ip(self, mac: str, new_ip: str) -> bool:
        """Update device IP address"""
        if mac in self.devices:
            device = self.devices[mac]
            # Remove old IP mapping
            if device.ip in self.ip_to_mac:
                del self.ip_to_mac[device.ip]
            # Update with new IP
            device.ip = new_ip
            self.ip_to_mac[new_ip] = mac
            return True
        return False
    
    def get_all_devices(self) -> List[LIFXDevice]:
        """Get all registered devices"""
        return list(self.devices.values())
    
    def get_matrix_devices(self) -> List[LIFXDevice]:
        """Get all matrix devices"""
        return [d for d in self.devices.values() if d.is_matrix]
    
    def get_multizone_devices(self) -> List[LIFXDevice]:
        """Get all multizone devices"""
        return [d for d in self.devices.values() if d.is_multizone]
    
    def remove_device(self, mac: str) -> bool:
        """Remove device from registry"""
        if mac in self.devices:
            device = self.devices[mac]
            if device.ip in self.ip_to_mac:
                del self.ip_to_mac[device.ip]
            del self.devices[mac]
            return True
        return False

# Global device registry
device_registry = DeviceRegistry()

def get_product_name(product_id: int) -> str:
    """Get human-readable product name"""
    product_names = {
        LIFXProduct.ORIGINAL_1000: "Original 1000",
        LIFXProduct.COLOR_650: "Color 650",
        LIFXProduct.COLOR_1000: "Color 1000",
        LIFXProduct.A19: "A19",
        LIFXProduct.BR30: "BR30",
        LIFXProduct.A19_PLUS: "A19+",
        LIFXProduct.BR30_PLUS: "BR30+",
        LIFXProduct.CANDLE: "Candle",
        LIFXProduct.CANDLE_COLOR: "Candle Color",
        LIFXProduct.CANDLE_MATRIX: "Candle (Matrix)",
        LIFXProduct.Z: "Z Strip",
        LIFXProduct.BEAM: "Beam",
        LIFXProduct.LIGHTSTRIP: "Lightstrip",
        LIFXProduct.NEON: "Neon",
        LIFXProduct.TILE: "Tile",
        LIFXProduct.TUBE: "Tube",
        LIFXProduct.CEILING: "Ceiling 15\"",
        LIFXProduct.CEILING_320: "Ceiling 320",
        LIFXProduct.CEILING_400: "Ceiling 400",
        LIFXProduct.MINI_COLOR: "Mini Color",
        LIFXProduct.MINI_WHITE: "Mini White",
        LIFXProduct.MINI_DAY_DUSK: "Mini Day & Dusk",
        LIFXProduct.DOWNLIGHT: "Downlight",
        LIFXProduct.DOWNLIGHT_COLOR: "Downlight Color",
        LIFXProduct.DOWNLIGHT_WHITE: "Downlight White",
    }
    return product_names.get(product_id, f"Unknown Product ({product_id})")