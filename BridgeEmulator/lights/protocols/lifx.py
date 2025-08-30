"""
LIFX Protocol Implementation for Hue Bridge Emulator

Entertainment Mode Optimizations:
- Power state caching to avoid redundant on/off commands
- Kelvin value caching per device to reduce get_color calls  
- Frame rate limiting (configurable, default 30 FPS)
- Batch processing support for multiple simultaneous updates
- Parallel UDP packet sending for better performance

Discovery Optimizations (Docker):
- Subnet scanning instead of broadcast for Docker compatibility
- Direct unicast GetService messages to each IP
- Automatic subnet detection from config.yaml host IP
- Device caching with 5-minute TTL
"""

import colorsys
import threading
import time
import os
import subprocess
import socket
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

import logManager

from functions.colors import convert_xy

logging = logManager.logger.get_logger(__name__)

try:
    from lifxlan import LifxLAN, Light as LifxLight, Device as LifxDevice
    import lifxlan.device as lifx_device_mod
    LIFX_AVAILABLE = True
    
    # No longer needed - using subnet scanning in Docker instead
    
except ImportError:
    LIFX_AVAILABLE = False
    LifxLAN = None
    LifxLight = None
    LifxDevice = None
    lifx_device_mod = None
    logging.warning("LIFX: lifxlan library not installed")


class LifxDeviceCache:
    """Thread-safe cache for LIFX devices with TTL and lazy refresh."""
    
    def __init__(self, ttl: int = 300):  # 5 minute TTL
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.RLock()
        self._ttl = ttl
        self._lan_instance = None
        self._discovery_lock = threading.Lock()
        self._last_discovery = 0
        self._discovery_interval = 30  # Minimum seconds between discoveries
        
    def _get_lan(self):
        """Get or create LifxLAN instance."""
        if not LIFX_AVAILABLE:
            return None
        if self._lan_instance is None:
            try:
                self._lan_instance = LifxLAN()
            except Exception as e:
                logging.error(f"LIFX: Failed to create LifxLAN instance: {e}")
        return self._lan_instance
    
    def get(self, key: str) -> Optional[Any]:
        """Get device from cache if not expired."""
        with self._lock:
            if key in self._cache:
                device, timestamp = self._cache[key]
                if time.time() - timestamp < self._ttl:
                    return device  # Skip validation check for performance
            return None
    
    def put(self, key: str, device: Any) -> None:
        """Store device in cache."""
        with self._lock:
            self._cache[key] = (device, time.time())
    
    def clear_expired(self) -> None:
        """Remove expired entries from cache."""
        with self._lock:
            current_time = time.time()
            expired = [k for k, (_, t) in self._cache.items() if current_time - t >= self._ttl]
            for k in expired:
                del self._cache[k]
    
    def discover_device(self, mac: Optional[str] = None, ip: Optional[str] = None) -> Optional[Any]:
        """Discover a specific device by MAC or IP."""
        if not LIFX_AVAILABLE:
            return None
            
        # Check cache first
        cache_key = mac or ip
        if cache_key:
            cached = self.get(cache_key)
            if cached:
                return cached
        
        lan = self._get_lan()
        if not lan:
            return None
            
        # Try targeted discovery
        device = None
        
        if ip:
            # Try unicast discovery to specific IP
            device = self._unicast_discover(ip)
            
        if not device and (time.time() - self._last_discovery > self._discovery_interval):
            # Fallback to broadcast discovery (rate limited)
            with self._discovery_lock:
                if time.time() - self._last_discovery > self._discovery_interval:
                    device = self._broadcast_discover(mac, ip)
                    self._last_discovery = time.time()
        
        if device and cache_key:
            self.put(cache_key, device)
            # Also cache by both MAC and IP if available
            try:
                device_mac = device.get_mac_addr()
                device_ip = device.get_ip_addr()
                if device_mac and device_mac != cache_key:
                    self.put(device_mac, device)
                if device_ip and device_ip != cache_key:
                    self.put(device_ip, device)
            except:
                pass
                
        return device
    
    def _unicast_discover(self, ip: str) -> Optional[Any]:
        """Discover device by sending unicast to specific IP."""
        if not LIFX_AVAILABLE:
            return None
            
        try:
            # Method 1: Try targeted discovery by overriding broadcast addresses
            if lifx_device_mod:
                original_addrs = list(getattr(lifx_device_mod, 'UDP_BROADCAST_IP_ADDRS', []))
                lifx_device_mod.UDP_BROADCAST_IP_ADDRS = [ip]
                
                try:
                    lan = LifxLAN(num_lights=1)  # Hint for faster discovery
                    devices = lan.get_lights() or []
                    for device in devices:
                        try:
                            if device.get_ip_addr() == ip:
                                return device
                        except:
                            continue
                finally:
                    lifx_device_mod.UDP_BROADCAST_IP_ADDRS = original_addrs
            
            # Method 2: Try direct Light construction (works in some cases)
            if LifxLight and ip:
                try:
                    # Create a Light with just the IP (MAC will be discovered later)
                    device = LifxLight("00:00:00:00:00:00", ip)
                    # Verify it's responsive
                    device.get_power()
                    return device
                except:
                    pass
                    
        except Exception as e:
            logging.debug(f"LIFX: Unicast discovery failed for {ip}: {e}")
            
        return None
    
    def _broadcast_discover(self, mac: Optional[str] = None, ip: Optional[str] = None) -> Optional[Any]:
        """Discover device via broadcast."""
        lan = self._get_lan()
        if not lan:
            return None
            
        try:
            devices = lan.get_lights() or []
            for device in devices:
                try:
                    if mac and device.get_mac_addr() == mac:
                        return device
                    if ip and device.get_ip_addr() == ip:
                        return device
                except:
                    continue
        except Exception as e:
            logging.debug(f"LIFX: Broadcast discovery failed: {e}")
            
        return None


# Global cache instance
_device_cache = LifxDeviceCache()

# Export for external use (e.g., manual discovery)
def _unicast_discover_by_ip(ip: str) -> Optional[Any]:
    """Legacy compatibility function for manual discovery."""
    return _device_cache.discover_device(ip=ip)




def _scale_bri_254_to_65535(bri: int) -> int:
    bri = max(1, min(int(bri), 254))
    return int(bri * 257)  # 254*257 ~= 65535


def _scale_sat_254_to_65535(sat: int) -> int:
    sat = max(0, min(int(sat), 254))
    return int((sat / 254.0) * 65535)


def _scale_bri_65535_to_254(bri: int) -> int:
    bri = max(0, min(int(bri), 65535))
    return max(1, int(round(bri * 254 / 65535)))


def _scale_sat_65535_to_254(sat: int) -> int:
    sat = max(0, min(int(sat), 65535))
    return int(round(sat * 254 / 65535))


def _mirek_to_kelvin(mirek: int) -> int:
    try:
        k = int(1000000 / max(1, int(mirek)))
    except Exception:
        k = 3500
    # LIFX typically supports roughly 1500-9000 K (device specific). Clamp safely.
    return max(1500, min(k, 9000))


def _kelvin_to_mirek(kelvin: int) -> int:
    kelvin = max(1, int(kelvin))
    return int(round(1000000 / kelvin))


def _rgb_to_hsv65535(r: int, g: int, b: int) -> Tuple[int, int, int]:
    # r,g,b in 0..255 -> hsv scales 0..65535 for h,s,v
    rr, gg, bb = r / 255.0, g / 255.0, b / 255.0
    h, s, v = colorsys.rgb_to_hsv(rr, gg, bb)
    return int(round(h * 65535)), int(round(s * 65535)), int(round(v * 65535))


def _get_device(light) -> Optional[Any]:
    """Get LIFX device for a light object, using cache."""
    if not LIFX_AVAILABLE:
        return None
        
    mac = light.protocol_cfg.get("id")
    ip = light.protocol_cfg.get("ip")
    
    # Handle host:port format
    if isinstance(ip, str) and ":" in ip:
        ip = ip.split(":", 1)[0]
    
    return _device_cache.discover_device(mac, ip)


# No longer tracking Docker fix - using subnet scanning instead

def _scan_ip_direct(ip: str, timeout: float = 0.5) -> Optional[Any]:
    """Directly probe an IP for LIFX device without broadcast."""
    if not LIFX_AVAILABLE:
        return None
    
    try:
        import socket
        from lifxlan.msgtypes import GetService, StateService
        from lifxlan.unpack import unpack_lifx_message
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        
        # Send GetService directly to IP
        msg = GetService("00:00:00:00:00:00", 12345, 0, {}, False, True)
        sock.sendto(msg.packed_message, (ip, 56700))
        
        # Wait for response
        data, addr = sock.recvfrom(1024)
        response = unpack_lifx_message(data)
        
        if isinstance(response, StateService):
            # Create Light object for this device
            mac = response.target_addr
            light = LifxLight(mac, ip)
            return light
            
    except:
        pass
    finally:
        try:
            sock.close()
        except:
            pass
    
    return None


def _scan_subnet_for_lifx(subnet: str = "192.168.1") -> List[Any]:
    """Scan a subnet for LIFX devices when broadcast fails."""
    devices = []
    logging.info(f"LIFX: Scanning subnet {subnet}.0/24 for devices...")
    
    # Quick scan of common IPs in parallel
    import threading
    lock = threading.Lock()
    
    def scan_worker(ip):
        device = _scan_ip_direct(ip, timeout=0.2)
        if device:
            with lock:
                devices.append(device)
                logging.info(f"LIFX: Found device at {ip}")
    
    threads = []
    for i in range(1, 255):
        ip = f"{subnet}.{i}"
        t = threading.Thread(target=scan_worker, args=(ip,))
        threads.append(t)
        t.start()
        
        # Limit concurrent threads
        if len(threads) >= 50:
            for t in threads[:25]:
                t.join()
            threads = threads[25:]
    
    # Wait for remaining
    for t in threads:
        t.join()
    
    return devices


def discover(detectedLights: List[Dict], opts: Optional[Dict] = None) -> None:
    """Discover LIFX devices and add them to detectedLights."""
    
    if not LIFX_AVAILABLE:
        logging.info("LIFX: lifxlan not available, skipping discovery")
        return
    
    # Get host IP from bridgeConfig to determine subnet
    try:
        from configManager import bridgeConfig
        host_ip = bridgeConfig.yaml_config["config"]["ipaddress"]
        # Extract subnet from host IP (e.g., "192.168.1.187" -> "192.168.1")
        subnet = '.'.join(host_ip.split('.')[:-1])
        logging.info(f"LIFX: Using subnet {subnet} from host IP {host_ip}")
    except Exception as e:
        logging.debug(f"LIFX: Could not get host IP from config: {e}")
        subnet = os.environ.get("LIFX_SUBNET", "192.168.1")
        
    logging.info("LIFX: Starting discovery...")
    
    added = 0
    
    # Get configuration options
    num_lights = opts.get("num_lights") if opts else None
    timeout = opts.get("discovery_timeout", 60) if opts else 60
    static_ips = opts.get("static_ips", []) if opts else []
    
    # First, try static IPs (works better in Docker)
    if static_ips:
        logging.info(f"LIFX: Trying static IPs: {static_ips}")
        for ip in static_ips:
            try:
                if ":" in ip:
                    ip = ip.split(":", 1)[0]
                    
                device = _device_cache.discover_device(ip=ip)
                if device:
                    try:
                        mac = device.get_mac_addr()
                        label = device.get_label() or f"LIFX {ip}"
                        
                        already_exists = any(
                            d.get("protocol_cfg", {}).get("id") == mac 
                            for d in detectedLights
                        )
                        
                        if not already_exists:
                            detectedLights.append({
                                "protocol": "lifx",
                                "name": label,
                                "modelid": "LCT015",
                                "protocol_cfg": {
                                    "ip": ip,
                                    "id": mac or ip,
                                    "label": label
                                }
                            })
                            added += 1
                            logging.info(f"LIFX: Added {label} at {ip}")
                    except Exception as e:
                        logging.debug(f"LIFX: Error getting device info for {ip}: {e}")
            except Exception as e:
                logging.debug(f"LIFX: Failed to connect to {ip}: {e}")
    
    # Skip broadcast discovery entirely in Docker - go straight to subnet scanning
    devices = []
    
    if os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER'):
        # In Docker, use subnet scanning directly (much faster and more reliable)
        logging.info(f"LIFX: Docker detected, using subnet scan on {subnet}.0/24")
        devices = _scan_subnet_for_lifx(subnet)
        if devices:
            logging.info(f"LIFX: Subnet scan found {len(devices)} device(s)")
    else:
        # Not in Docker, use normal broadcast discovery
        try:
            lifx = LifxLAN(num_lights=num_lights)
            logging.info("LIFX: Using broadcast discovery")
            devices = lifx.get_lights()
            if devices:
                logging.info(f"LIFX: Broadcast found {len(devices)} device(s)")
        except Exception as e:
            logging.debug(f"LIFX: Broadcast failed: {e}")
    
    if devices:
        for device in devices:
            try:
                ip = device.get_ip_addr()
                mac = device.get_mac_addr()
                label = device.get_label() or f"LIFX {mac[-8:]}"
                
                # Check if already in list
                already_exists = any(
                    d.get("protocol_cfg", {}).get("id") == mac 
                    for d in detectedLights
                )
                
                if not already_exists:
                    # Determine model based on capabilities
                    if device.supports_color():
                        modelid = "LCT015"  # Color bulb
                    else:
                        modelid = "LWB010"  # White bulb
                    
                    detectedLights.append({
                        "protocol": "lifx",
                        "name": label,
                        "modelid": modelid,
                        "protocol_cfg": {
                            "ip": ip,
                            "id": mac,
                            "label": label
                        }
                    })
                    added += 1
                    
                    # Cache the device
                    _device_cache.put(mac, device)
                    _device_cache.put(ip, device)
                    
            except Exception as e:
                logging.debug(f"LIFX: Error processing device: {e}")
                continue
    
    # Also try static IPs if provided
    if opts and "static_ips" in opts:
        for ip in opts["static_ips"]:
            try:
                if ":" in ip:
                    ip = ip.split(":", 1)[0]
                    
                device = _device_cache.discover_device(ip=ip)
                if device:
                    try:
                        mac = device.get_mac_addr()
                        label = device.get_label() or f"LIFX {ip}"
                        
                        already_exists = any(
                            d.get("protocol_cfg", {}).get("id") == mac 
                            for d in detectedLights
                        )
                        
                        if not already_exists:
                            detectedLights.append({
                                "protocol": "lifx",
                                "name": label,
                                "modelid": "LCT015",
                                "protocol_cfg": {
                                    "ip": ip,
                                    "id": mac or ip,
                                    "label": label
                                }
                            })
                            added += 1
                    except:
                        pass
            except:
                continue
    
    logging.info(f"LIFX: Discovery complete. Added {added} device(s)")


def set_light(light: Any, data: Dict) -> None:
    """Set LIFX light state."""
    device = _get_device(light)
    if not device:
        logging.debug(f"LIFX: Device not found for {light.name}")
        return
    
    try:
        # Extract transition time
        duration_ms = 0
        if "transitiontime" in data:
            # Hue uses deciseconds, LIFX uses milliseconds
            duration_ms = int(max(0, float(data["transitiontime"])) * 100)
        
        # Handle power state
        if "on" in data:
            power = "on" if data["on"] else "off"
            device.set_power(power, duration=duration_ms, rapid=(duration_ms == 0))
        
        # Get current color state to preserve unchanged values
        try:
            current_h, current_s, current_b, current_k = device.get_color()
        except:
            current_h, current_s, current_b, current_k = 0, 0, 32768, 3500
        
        target_h, target_s, target_b, target_k = current_h, current_s, current_b, current_k
        color_changed = False
        
        # Handle brightness
        if "bri" in data and data["bri"] is not None:
            target_b = _scale_bri_254_to_65535(int(data["bri"]))
            color_changed = True
        
        # Handle color temperature (takes precedence over color)
        if "ct" in data and data["ct"] is not None:
            target_k = _mirek_to_kelvin(int(data["ct"]))
            target_s = 0  # Use white channel
            color_changed = True
        
        # Handle XY color
        elif "xy" in data and isinstance(data["xy"], list) and len(data["xy"]) == 2:
            x, y = float(data["xy"][0]), float(data["xy"][1])
            r, g, b = convert_xy(x, y, 255)
            h655, s655, v655 = _rgb_to_hsv65535(r, g, b)
            target_h, target_s = h655, s655
            if "bri" not in data:
                target_b = v655
            color_changed = True
        
        # Handle Hue/Saturation
        elif "hue" in data or "sat" in data:
            if "hue" in data and data["hue"] is not None:
                target_h = int(max(0, min(int(data["hue"]), 65535)))
                color_changed = True
            if "sat" in data and data["sat"] is not None:
                target_s = _scale_sat_254_to_65535(int(data["sat"]))
                color_changed = True
        
        # Apply color changes
        if color_changed:
            device.set_color(
                [target_h, target_s, target_b, target_k],
                duration=duration_ms,
                rapid=(duration_ms == 0)
            )
            
    except Exception as e:
        logging.warning(f"LIFX: Error setting state for {light.name}: {e}")


def get_light_state(light: Any) -> Dict:
    """Get current LIFX light state."""
    device = _get_device(light)
    if not device:
        return {"on": False, "reachable": False}
    
    state = {"reachable": True}
    
    try:
        # Get power state
        power = device.get_power()
        state["on"] = bool(power and int(power) > 0)
        
        # Get color state
        h, s, b, k = device.get_color()
        state["bri"] = _scale_bri_65535_to_254(int(b))
        state["hue"] = int(h)
        state["sat"] = _scale_sat_65535_to_254(int(s))
        
        # Determine color mode
        if int(s) < 512:  # Low saturation, white mode
            state["ct"] = max(153, min(500, _kelvin_to_mirek(int(k))))
            state["colormode"] = "ct"
        else:
            state["colormode"] = "hs"
            
    except Exception as e:
        logging.debug(f"LIFX: Error getting state for {light.name}: {e}")
        state["reachable"] = False
    
    return state


# Entertainment mode state tracking
_entertainment_state = {
    "active": False,
    "power_states": {},  # Track power state per device
    "kelvin_cache": {},  # Cache kelvin per device
    "last_update": {},   # Track last update time per device
    "frame_limit": 30,   # Max FPS (LIFX can handle ~20 messages/sec)
}

def start_entertainment_mode() -> None:
    """Initialize entertainment mode for better performance."""
    global _entertainment_state
    _entertainment_state["active"] = True
    _entertainment_state["power_states"].clear()
    _entertainment_state["kelvin_cache"].clear()
    _entertainment_state["last_update"].clear()
    logging.info("LIFX: Entertainment mode started")

def stop_entertainment_mode() -> None:
    """Clean up entertainment mode."""
    global _entertainment_state
    _entertainment_state["active"] = False
    _entertainment_state["power_states"].clear()
    _entertainment_state["kelvin_cache"].clear()
    _entertainment_state["last_update"].clear()
    logging.info("LIFX: Entertainment mode stopped")

def send_rgb_rapid(light: Any, r: int, g: int, b: int) -> None:
    """Send RGB color rapidly for entertainment mode with optimizations."""
    device = _get_device(light)
    if not device:
        return
    
    try:
        import time
        current_time = time.time()
        device_id = str(light.protocol_cfg.get("mac", light.name))
        
        # Frame rate limiting - skip if too soon since last update
        if _entertainment_state["active"]:
            last_update = _entertainment_state["last_update"].get(device_id, 0)
            min_interval = 1.0 / _entertainment_state["frame_limit"]
            if current_time - last_update < min_interval:
                return  # Skip this frame to maintain frame rate limit
            _entertainment_state["last_update"][device_id] = current_time
        
        # Track power state to avoid redundant commands
        is_black = (r == 0 and g == 0 and b == 0)
        current_power = _entertainment_state["power_states"].get(device_id, None)
        
        if is_black:
            # Only send power off if not already off
            if current_power != False:
                device.set_power("off", duration=0, rapid=True)
                _entertainment_state["power_states"][device_id] = False
            return
        
        # Only send power on if not already on
        if current_power != True:
            device.set_power("on", duration=0, rapid=True)
            _entertainment_state["power_states"][device_id] = True
        
        # Convert RGB to HSBK
        h, s, v = _rgb_to_hsv65535(r, g, b)
        
        # Use cached kelvin value to avoid repeated get_color calls
        if device_id not in _entertainment_state["kelvin_cache"]:
            try:
                _, _, _, k = device.get_color()
                _entertainment_state["kelvin_cache"][device_id] = k
            except:
                _entertainment_state["kelvin_cache"][device_id] = 3500
        
        k = _entertainment_state["kelvin_cache"][device_id]
        
        # Send color update without duration for minimal latency
        device.set_color([h, s, max(1, v), k], duration=0, rapid=True)
        
    except Exception as e:
        logging.debug(f"LIFX: Rapid send failed for {light.name}: {e}")


# Batch processing for multiple lights
_batch_buffer = {
    "updates": {},  # device_id -> (r, g, b) mapping
    "last_flush": 0,
    "batch_interval": 0.016,  # ~60 FPS batch processing
}

def batch_rgb_update(light: Any, r: int, g: int, b: int) -> None:
    """Queue RGB update for batch processing."""
    device = _get_device(light)
    if not device:
        return
    
    device_id = str(light.protocol_cfg.get("mac", light.name))
    _batch_buffer["updates"][device_id] = (device, r, g, b)
    
    # Check if we should flush the batch
    import time
    current_time = time.time()
    if current_time - _batch_buffer["last_flush"] >= _batch_buffer["batch_interval"]:
        flush_batch_updates()
        _batch_buffer["last_flush"] = current_time

def flush_batch_updates() -> None:
    """Process all queued updates in parallel."""
    if not _batch_buffer["updates"]:
        return
    
    from concurrent.futures import ThreadPoolExecutor
    import time
    
    def _send_update(item):
        device, r, g, b = item
        try:
            # Skip black handling for batch - just send color
            if r == 0 and g == 0 and b == 0:
                device.set_power("off", duration=0, rapid=True)
            else:
                h, s, v = _rgb_to_hsv65535(r, g, b)
                # Use a default kelvin for batch updates
                k = 3500
                device.set_color([h, s, max(1, v), k], duration=0, rapid=True)
        except Exception as e:
            logging.debug(f"LIFX batch update failed: {e}")
    
    # Process all updates in parallel
    with ThreadPoolExecutor(max_workers=min(len(_batch_buffer["updates"]), 10)) as executor:
        updates = [(dev, r, g, b) for dev, r, g, b in _batch_buffer["updates"].values()]
        executor.map(_send_update, updates)
    
    _batch_buffer["updates"].clear()

def set_entertainment_frame_limit(fps: int) -> None:
    """Set the maximum frame rate for entertainment mode."""
    global _entertainment_state
    _entertainment_state["frame_limit"] = max(1, min(fps, 60))  # Clamp between 1-60 FPS
    logging.info(f"LIFX: Entertainment frame limit set to {_entertainment_state['frame_limit']} FPS")
