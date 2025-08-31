"""
LIFX Protocol Implementation for Hue Bridge Emulator

Entertainment Mode Optimizations:
- Power state caching to avoid redundant on/off commands
- Kelvin value caching per device to reduce get_color calls  
- Frame rate limiting (configurable, default 30 FPS)
- Batch processing support for multiple simultaneous updates
- Parallel UDP packet sending for better performance
- Anti-flicker smoothing with exponential moving average

Discovery Optimizations (Docker):
- Subnet scanning instead of broadcast for Docker compatibility
- Direct unicast GetService messages to each IP
- Automatic subnet detection from config.yaml host IP
- Device caching with 5-minute TTL

Keep-Alive Mechanism:
- Background thread sends periodic GetPower packets (default 45s interval)
- Prevents LIFX bulbs from going into sleep/timeout state
- Automatically registers devices during discovery and first use
- Configurable interval (10-120 seconds) via UI
- Only pings devices that are actively being used
"""

import colorsys
import threading
import time
import os
import subprocess
import socket
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

import logManager

from functions.colors import convert_xy, convert_rgb_xy, hsv_to_rgb

# Import LIFX model identification
try:
    from lights.protocols.lifx_models import identify_lifx_model, get_hue_model_from_lifx, get_lifx_capabilities
    LIFX_MODELS_AVAILABLE = True
except ImportError:
    LIFX_MODELS_AVAILABLE = False
    # Fallback if module not available
    def identify_lifx_model(device):
        try:
            if hasattr(device, 'supports_color') and device.supports_color():
                return "LCT015", {}, "LIFX Color"
            else:
                return "LWB010", {}, "LIFX White"
        except:
            return "LCT015", {}, "LIFX"

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

# Global executor for parallel operations
_parallel_executor = None
_executor_lock = Lock()

def _get_parallel_executor() -> ThreadPoolExecutor:
    """Get or create the thread pool executor for parallel operations."""
    global _parallel_executor
    if _parallel_executor is None:
        with _executor_lock:
            if _parallel_executor is None:
                _parallel_executor = ThreadPoolExecutor(max_workers=20)
    return _parallel_executor

# Keep-alive tracking
_keepalive_state = {
    "thread": None,
    "running": False,
    "interval": 45,  # seconds between keep-alive pings
    "last_ping": {},  # device_id -> last ping time
    "active_devices": set(),  # Set of device IDs that need keep-alive
}

def _send_keepalive_packet(ip: str) -> bool:
    """Send a raw UDP GetService packet to keep device alive."""
    try:
        import socket
        from lifxlan.msgtypes import GetService
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        
        # Send GetService directly to IP (same as discovery)
        msg = GetService("00:00:00:00:00:00", 12345, 0, {}, False, True)
        sock.sendto(msg.packed_message, (ip, 56700))
        
        # We don't need to wait for response - just send the packet
        sock.close()
        return True
    except Exception as e:
        logging.debug(f"Keep-alive packet failed: {e}")
        return False

def _keepalive_worker():
    """Background thread that sends periodic keep-alive packets to LIFX devices."""
    logging.info("LIFX: Keep-alive thread started")
    
    while _keepalive_state["running"]:
        try:
            current_time = datetime.now()
            devices_to_ping = []
            
            # Check which devices need a keep-alive
            for device_id in list(_keepalive_state["active_devices"]):
                last_ping = _keepalive_state["last_ping"].get(device_id, datetime.min)
                if (current_time - last_ping).total_seconds() >= _keepalive_state["interval"]:
                    # Device ID could be MAC or IP
                    # Try to get IP from cache or use it directly if it's an IP
                    ip = None
                    if "." in device_id:  # It's an IP
                        ip = device_id
                    else:  # It's a MAC, try to find IP from cache
                        with _device_cache._lock:
                            cached = _device_cache._cache.get(device_id)
                            if cached and cached[0]:
                                try:
                                    ip = cached[0].ip_addr
                                except:
                                    ip = getattr(cached[0], 'ip', None)
                    
                    if ip:
                        devices_to_ping.append((device_id, ip))
            
            # Log if we have devices to ping
            if devices_to_ping:
                logging.info(f"LIFX: Sending keep-alive to {len(devices_to_ping)} device(s)")
            
            # Send keep-alive packets in parallel using global executor
            executor = _get_parallel_executor()
            futures = {}
            for device_id, ip in devices_to_ping:
                future = executor.submit(_send_keepalive_packet, ip)
                futures[future] = (device_id, ip)
            
            # Check results as they complete
            for future in as_completed(futures, timeout=2):
                device_id, ip = futures[future]
                try:
                    if future.result():
                        _keepalive_state["last_ping"][device_id] = current_time
                        logging.debug(f"LIFX: Keep-alive sent to {ip} ({device_id})")
                    else:
                        logging.warning(f"LIFX: Keep-alive failed for {ip} ({device_id})")
                except:
                    pass
            
            # Sleep for a bit before next check
            time.sleep(5)  # Check every 5 seconds, but only ping based on interval
            
        except Exception as e:
            logging.error(f"LIFX: Keep-alive thread error: {e}")
            time.sleep(5)
    
    logging.info("LIFX: Keep-alive thread stopped")

def start_keepalive():
    """Start the keep-alive background thread."""
    global _keepalive_state
    
    if _keepalive_state["running"]:
        return  # Already running
    
    _keepalive_state["running"] = True
    _keepalive_state["thread"] = threading.Thread(target=_keepalive_worker, daemon=True)
    _keepalive_state["thread"].start()
    logging.info("LIFX: Keep-alive mechanism started")

def stop_keepalive():
    """Stop the keep-alive background thread."""
    global _keepalive_state
    
    _keepalive_state["running"] = False
    if _keepalive_state["thread"]:
        _keepalive_state["thread"].join(timeout=2)
        _keepalive_state["thread"] = None
    logging.info("LIFX: Keep-alive mechanism stopped")

def register_device_for_keepalive(device_id: str, ip: str = None):
    """Register a device to receive keep-alive packets.
    
    Args:
        device_id: MAC address or IP of device
        ip: Optional IP address if device_id is MAC
    """
    # If we have an IP, use it as the primary identifier
    if ip:
        _keepalive_state["active_devices"].add(ip)
        _keepalive_state["last_ping"][ip] = datetime.now()
        logging.debug(f"LIFX: Registered {ip} for keep-alive")
    else:
        _keepalive_state["active_devices"].add(device_id)
        _keepalive_state["last_ping"][device_id] = datetime.now()
        logging.debug(f"LIFX: Registered {device_id} for keep-alive")
    
    # Start the keep-alive thread if not running
    if not _keepalive_state["running"]:
        start_keepalive()
    
    # Start keep-alive thread if not running
    if not _keepalive_state["running"]:
        start_keepalive()

def set_keepalive_interval(seconds: int):
    """Set the interval between keep-alive pings."""
    _keepalive_state["interval"] = max(10, min(seconds, 300))  # Clamp between 10-300 seconds
    logging.info(f"LIFX: Keep-alive interval set to {_keepalive_state['interval']} seconds")

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
    
    device = _device_cache.discover_device(mac, ip)
    
    # Register for keep-alive if we got a device
    if device:
        if ip:
            register_device_for_keepalive(mac or ip, ip)
        elif mac:
            # Try to get IP from device
            device_ip = getattr(device, 'ip_addr', None) or getattr(device, 'ip', None)
            register_device_for_keepalive(mac, device_ip)
    
    return device


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


def initialize_lifx():
    """Initialize LIFX module and start keep-alive for existing devices."""
    logging.info("LIFX: Initializing module")
    
    # Load entertainment settings
    try:
        import configManager
        config = configManager.bridgeConfig.yaml_config
        lifx_settings = config.get("config", {}).get("lifx", {})
        if not lifx_settings:
            lifx_settings = config.get("temp", {}).get("integrations", {}).get("lifx", {})
        if lifx_settings:
            update_entertainment_settings(lifx_settings)
            logging.info(f"LIFX: Loaded settings - FPS: {lifx_settings.get('max_fps', 30)}, Smoothing: {lifx_settings.get('smoothing_enabled', False)}, Keep-alive: {lifx_settings.get('keepalive_interval', 45)}s")
    except Exception as e:
        logging.error(f"LIFX: Could not load entertainment settings: {e}")
    
    # Start keep-alive for existing LIFX devices
    if LIFX_AVAILABLE:
        try:
            lights = config.get("lights", {})
            lifx_count = 0
            for light_id, light_obj in lights.items():
                # Handle both dict and object formats
                if isinstance(light_obj, dict):
                    protocol = light_obj.get("protocol")
                    protocol_cfg = light_obj.get("protocol_cfg", {})
                else:
                    protocol = getattr(light_obj, "protocol", None)
                    protocol_cfg = getattr(light_obj, "protocol_cfg", {})
                
                if protocol == "lifx":
                    device_id = protocol_cfg.get("id") or protocol_cfg.get("mac")
                    device_ip = protocol_cfg.get("ip")
                    if device_id or device_ip:
                        register_device_for_keepalive(device_id or device_ip, device_ip)
                        lifx_count += 1
                        logging.debug(f"LIFX: Registered device {device_ip or device_id} for keep-alive")
            
            if lifx_count > 0:
                logging.info(f"LIFX: Registered {lifx_count} existing device(s) for keep-alive")
                if not _keepalive_state["running"]:
                    start_keepalive()
            else:
                logging.info("LIFX: No existing devices found to register for keep-alive")
        except Exception as e:
            logging.error(f"LIFX: Error registering existing devices: {e}")

# Don't call at import time - config may not be loaded yet
# initialize_lifx() should be called after config is loaded

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
                            # Identify model and capabilities
                            hue_model, capabilities, product_name = identify_lifx_model(device)
                            
                            detectedLights.append({
                                "protocol": "lifx",
                                "name": label,
                                "modelid": hue_model,
                                "protocol_cfg": {
                                    "ip": ip,
                                    "id": mac or ip,
                                    "label": label,
                                    "product_name": product_name
                                }
                            })
                            added += 1
                            logging.info(f"LIFX: Added {product_name} ({label}) at {ip} as Hue model {hue_model}")
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
                    # Identify model and capabilities using proper identification
                    hue_model, capabilities, product_name = identify_lifx_model(device)
                    
                    # Build protocol_cfg with all necessary fields
                    protocol_cfg = {
                        "ip": ip,
                        "id": mac,
                        "label": label,
                        "product_name": product_name
                    }
                    
                    # Add capabilities to protocol_cfg
                    if capabilities.get("points_capable", 0) > 0:
                        # For gradient/multizone capable devices
                        protocol_cfg["points_capable"] = capabilities["points_capable"]
                    
                    # Add other capabilities as needed
                    if capabilities.get("control", {}).get("ct"):
                        protocol_cfg["ct_min"] = capabilities["control"]["ct"]["min"]
                        protocol_cfg["ct_max"] = capabilities["control"]["ct"]["max"]
                    
                    detectedLights.append({
                        "protocol": "lifx",
                        "name": label,
                        "modelid": hue_model,
                        "protocol_cfg": protocol_cfg
                    })
                    added += 1
                    
                    logging.info(f"LIFX: Detected {product_name} ({mac}) as Hue model {hue_model}")
                    
                    # Cache the device
                    _device_cache.put(mac, device)
                    _device_cache.put(ip, device)
                    
                    # Register for keep-alive with IP
                    register_device_for_keepalive(mac, ip)
                    
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
                            # Identify model and capabilities
                            hue_model, capabilities, product_name = identify_lifx_model(device)
                            
                            # Build protocol_cfg with all necessary fields
                            protocol_cfg = {
                                "ip": ip,
                                "id": mac or ip,
                                "label": label,
                                "product_name": product_name
                            }
                            
                            # Add capabilities to protocol_cfg
                            if capabilities.get("points_capable", 0) > 0:
                                # For gradient/multizone capable devices
                                protocol_cfg["points_capable"] = capabilities["points_capable"]
                            
                            # Add other capabilities as needed
                            if capabilities.get("control", {}).get("ct"):
                                protocol_cfg["ct_min"] = capabilities["control"]["ct"]["min"]
                                protocol_cfg["ct_max"] = capabilities["control"]["ct"]["max"]
                            
                            detectedLights.append({
                                "protocol": "lifx",
                                "name": label,
                                "modelid": hue_model,
                                "protocol_cfg": protocol_cfg
                            })
                            added += 1
                            
                            logging.info(f"LIFX: Added {product_name} ({label}) at {ip} as Hue model {hue_model}")
                            
                            # Register for keep-alive
                            if mac:
                                register_device_for_keepalive(mac)
                            else:
                                register_device_for_keepalive(ip)
                    except:
                        pass
            except:
                continue
    
    logging.info(f"LIFX: Discovery complete. Added {added} device(s)")
    
    # Start keep-alive thread if we have devices
    if added > 0 and not _keepalive_state["running"]:
        start_keepalive()


def _set_light_worker(device: Any, data: Dict, light_name: str) -> bool:
    """Worker function to set a single light's state."""
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
        return True
    except Exception as e:
        logging.warning(f"LIFX: Error setting state for {light_name}: {e}")
        return False

def set_light(light: Any, data: Dict) -> None:
    """Set LIFX light state with parallel execution."""
    device = _get_device(light)
    if not device:
        logging.debug(f"LIFX: Device not found for {light.name}")
        return
    
    # Submit to executor for parallel execution
    executor = _get_parallel_executor()
    future = executor.submit(_set_light_worker, device, data, light.name)
    # Don't wait - fire and forget for maximum speed
    # The future will complete in the background


def set_lights_batch(lights: List[Any], data: Dict) -> None:
    """Set multiple LIFX lights simultaneously in parallel."""
    if not lights:
        return
    
    executor = _get_parallel_executor()
    futures = []
    
    for light in lights:
        device = _get_device(light)
        if device:
            future = executor.submit(_set_light_worker, device, data, light.name)
            futures.append(future)
    
    # Don't wait - let them all execute in parallel
    if futures:
        logging.debug(f"LIFX: Submitted {len(futures)} parallel light updates")


def set_light_multizone(light: Any, zone_colors: List[Tuple[int, int, int]]) -> None:
    """Set colors for different zones on multizone LIFX devices (strips, beams).
    
    Args:
        light: Light object
        zone_colors: List of RGB tuples, one per zone
    """
    device = _get_device(light)
    if not device:
        logging.debug(f"LIFX: Device not found for {light.name}")
        return
        
    try:
        # Check if device supports multizone
        if not hasattr(device, 'set_zone_colors'):
            logging.debug(f"LIFX: Device {light.name} does not support multizone")
            # Fall back to setting single color (average of zones)
            if zone_colors:
                avg_r = sum(c[0] for c in zone_colors) // len(zone_colors)
                avg_g = sum(c[1] for c in zone_colors) // len(zone_colors)
                avg_b = sum(c[2] for c in zone_colors) // len(zone_colors)
                h, s, v = _rgb_to_hsv65535(avg_r, avg_g, avg_b)
                device.set_color([h, s, v, 3500], duration=0, rapid=True)
            return
            
        # Convert RGB colors to HSBK for each zone
        hsbk_colors = []
        for r, g, b in zone_colors:
            h, s, v = _rgb_to_hsv65535(r, g, b)
            hsbk_colors.append([h, s, v, 3500])  # Default kelvin
            
        # Set zone colors
        # Prefer extended protocol if available (fewer packets, less flicker)
if hasattr(device, 'extended_set_zone_color'):
    try:
        device.extended_set_zone_color(hsbk_colors, index=0, duration=0, rapid=True, apply=1)
    except Exception as _:
        device.set_zone_colors(hsbk_colors, duration=0, rapid=True)
else:
    device.set_zone_colors(hsbk_colors, duration=0, rapid=True)
        logging.debug(f"LIFX: Set {len(zone_colors)} zone colors for {light.name}")
        
    except Exception as e:
        logging.warning(f"LIFX: Failed to set multizone for {light.name}: {e}")


def set_light_gradient(light: Any, gradient_points: List[Dict]) -> None:
    """Set gradient for LIFX devices that support it.
    
    Args:
        light: Light object
        gradient_points: List of dicts with 'color' (xy) and optionally 'position' (0.0-1.0)
    """
    device = _get_device(light)
    if not device:
        return
        
    try:
        # Check if device has gradient/multizone capability
        points_capable = light.protocol_cfg.get("points_capable", 0)
        
        if points_capable > 0:
            # Convert gradient points to zone colors
            zone_colors = []
            
            for i in range(min(points_capable, len(gradient_points))):
                point = gradient_points[i]
                if "color" in point:
                    x, y = point["color"]
                    r, g, b = convert_xy(x, y, 255)
                    zone_colors.append((r, g, b))
                    
            # Fill remaining zones with last color if needed
            if zone_colors and len(zone_colors) < points_capable:
                last_color = zone_colors[-1]
                while len(zone_colors) < points_capable:
                    zone_colors.append(last_color)
                    
            # Apply to multizone device
            if zone_colors:
                set_light_multizone(light, zone_colors)
        else:
            # Non-gradient device - just set to first color
            if gradient_points and "color" in gradient_points[0]:
                x, y = gradient_points[0]["color"]
                set_light(light, {"xy": [x, y]})
                
    except Exception as e:
        logging.warning(f"LIFX: Failed to set gradient for {light.name}: {e}")


def _get_state_worker(device: Any, light_name: str) -> Dict:
    """Worker function to get a single light's state."""
    try:
        state = {"reachable": True}
        
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
        
        return state
    except Exception as e:
        logging.debug(f"LIFX: Error getting state for {light_name}: {e}")
        return {"reachable": False}

def get_device_info(light: Any) -> Dict:
    """Get detailed device information including model and capabilities.
    
    Args:
        light: Light object
        
    Returns:
        Dict with device info including model, features, capabilities
    """
    device = _get_device(light)
    if not device:
        return {"error": "Device not found"}
        
    try:
        info = {
            "ip": device.get_ip_addr(),
            "mac": device.get_mac_addr(),
            "label": device.get_label(),
            "vendor": device.get_vendor(),
            "product_id": device.get_product(),
            "product_name": device.get_product_name(),
            "version": device.get_version(),
            "features": device.get_product_features()
        }
        
        # Get Hue model mapping
        hue_model, capabilities, _ = identify_lifx_model(device)
        info["hue_model"] = hue_model
        info["capabilities"] = capabilities
        
        return info
        
    except Exception as e:
        logging.error(f"LIFX: Failed to get device info: {e}")
        return {"error": str(e)}


def get_light_state(light: Any) -> Dict:
    """Get current LIFX light state with parallel execution."""
    device = _get_device(light)
    if not device:
        return {"on": False, "reachable": False}
    
    # Submit to executor and wait for result
    executor = _get_parallel_executor()
    future = executor.submit(_get_state_worker, device, light.name)
    
    try:
        # Wait for result with timeout
        return future.result(timeout=2.0)
    except Exception as e:
        logging.debug(f"LIFX: Timeout or error getting state: {e}")
        return {"reachable": False}


# Entertainment mode state tracking
_entertainment_state = {
    "active": False,
    "power_states": {},  # Track power state per device
    "kelvin_cache": {},  # Cache kelvin per device
    "last_update": {},   # Track last update time per device
    "frame_limit": 30,   # Max FPS (LIFX can handle ~20 messages/sec)
    "smoothing_enabled": False,  # Whether to apply color smoothing
    "smoothing_ms": 50,  # Smoothing time window in milliseconds
    "color_history": {},  # Recent color history per device for smoothing
    "target_colors": {},  # Target colors for smooth transitions
}

def start_entertainment_mode() -> None:
    """Initialize entertainment mode for better performance."""
    global _entertainment_state
    _entertainment_state["active"] = True
    _entertainment_state["power_states"].clear()
    _entertainment_state["kelvin_cache"].clear()
    _entertainment_state["last_update"].clear()
    _entertainment_state["color_history"].clear()
    _entertainment_state["target_colors"].clear()
    logging.info(f"LIFX: Entertainment mode started - FPS: {_entertainment_state['frame_limit']}, Smoothing: {_entertainment_state['smoothing_enabled']}, Smoothing window: {_entertainment_state['smoothing_ms']}ms")

def stop_entertainment_mode() -> None:
    """Clean up entertainment mode."""
    global _entertainment_state
    _entertainment_state["active"] = False
    _entertainment_state["power_states"].clear()
    _entertainment_state["kelvin_cache"].clear()
    _entertainment_state["last_update"].clear()
    logging.info("LIFX: Entertainment mode stopped")

def _apply_smoothing(device_id: str, r: int, g: int, b: int) -> Tuple[int, int, int]:
    """Apply exponential moving average smoothing to prevent flickering.
    
    This doesn't add delay - it immediately responds to changes but smooths
    out rapid oscillations by blending with recent history.
    """
    if not _entertainment_state["smoothing_enabled"]:
        return r, g, b
    
    import time
    current_time = time.time() * 1000  # Convert to milliseconds
    
    # Initialize history if needed
    if device_id not in _entertainment_state["color_history"]:
        _entertainment_state["color_history"][device_id] = []
        _entertainment_state["target_colors"][device_id] = (r, g, b)
    
    history = _entertainment_state["color_history"][device_id]
    target = _entertainment_state["target_colors"][device_id]
    
    # Add current color to history with timestamp
    history.append((current_time, r, g, b))
    
    # Remove old entries outside smoothing window
    smoothing_window = _entertainment_state["smoothing_ms"]
    cutoff_time = current_time - smoothing_window
    history[:] = [(t, r, g, b) for t, r, g, b in history if t > cutoff_time]
    
    if len(history) <= 1:
        return r, g, b
    
    # Calculate weighted average based on time (newer = more weight)
    total_weight = 0
    weighted_r = weighted_g = weighted_b = 0
    
    for t, hr, hg, hb in history:
        # Exponential decay weight - more recent colors have more influence
        age = current_time - t
        weight = 1.0 * (1.0 - (age / smoothing_window))
        weight = max(0.1, weight)  # Minimum weight
        
        weighted_r += hr * weight
        weighted_g += hg * weight
        weighted_b += hb * weight
        total_weight += weight
    
    if total_weight > 0:
        # Blend current color with weighted average
        # Dynamic blend factor based on smoothing window - longer window = more smoothing
        blend_factor = max(0.3, 1.0 - (smoothing_window / 300.0))  # 30-70% current based on window
        smooth_r = int(r * blend_factor + (weighted_r / total_weight) * (1 - blend_factor))
        smooth_g = int(g * blend_factor + (weighted_g / total_weight) * (1 - blend_factor))
        smooth_b = int(b * blend_factor + (weighted_b / total_weight) * (1 - blend_factor))
        
        # Clamp to valid range
        smooth_r = max(0, min(255, smooth_r))
        smooth_g = max(0, min(255, smooth_g))
        smooth_b = max(0, min(255, smooth_b))
        
        return smooth_r, smooth_g, smooth_b
    
    return r, g, b

def send_rgb_rapid(light: Any, r: int, g: int, b: int, zone_index: int = None) -> None:
    """Send RGB color rapidly for entertainment mode with optimizations.
    
    Args:
        light: Light object
        r, g, b: RGB color values (0-255)
        zone_index: Optional zone index for multizone/matrix devices
    """
    device = _get_device(light)
    if not device:
        return
    
    try:
        import time
        current_time = time.time()
        device_id = str(light.protocol_cfg.get("mac", light.name))
        
        # Apply smoothing if enabled
        original_rgb = (r, g, b)
        r, g, b = _apply_smoothing(device_id, r, g, b)
        if _entertainment_state["smoothing_enabled"] and original_rgb != (r, g, b):
            logging.debug(f"LIFX: Smoothing applied - Original: {original_rgb}, Smoothed: ({r}, {g}, {b})")
        
        # Frame rate limiting - skip if too soon since last update
        last_update = _entertainment_state["last_update"].get(device_id, 0)
        min_interval = 1.0 / _entertainment_state["frame_limit"]
        if current_time - last_update < min_interval:
            # Only log if entertainment mode is active to avoid spam during normal operation
            if _entertainment_state["active"]:
                logging.debug(f"LIFX: FPS limit - skipping frame (interval: {current_time - last_update:.3f}s < {min_interval:.3f}s)")
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


# Batch processing for multiple lights and zones
_batch_buffer = {
    "updates": {},  # device_id -> (r, g, b) mapping
    "zones": {},    # device_id -> {zone_index: (r, g, b)} mapping for multizone devices
    "last_flush": 0,
    "batch_interval": 0.016,  # ~60 FPS batch processing
}

def send_rgb_zones_rapid(light: Any, zone_colors: List[Tuple[int, int, int]]) -> None:
    """Send RGB colors to multiple zones rapidly for entertainment mode.
    
    Args:
        light: Light object
        zone_colors: List of (r, g, b) tuples for each zone
    """
    device = _get_device(light)
    if not device:
        return
        
    try:
        import time
        current_time = time.time()
        device_id = str(light.protocol_cfg.get("mac", light.name))
        
        # Frame rate limiting
        last_update = _entertainment_state["last_update"].get(device_id, 0)
        min_interval = 1.0 / _entertainment_state["frame_limit"]
        if current_time - last_update < min_interval:
            if _entertainment_state["active"]:
                logging.debug(f"LIFX: FPS limit - skipping zone frame")
            return
        _entertainment_state["last_update"][device_id] = current_time
        
        # Get device features to determine type
        try:
            features = device.get_product_features()
            is_matrix = features.get('matrix', False)
            is_multizone = features.get('multizone', False)
        except:
            # Fallback to method detection
            is_matrix = hasattr(device, 'set_tile_colors') or hasattr(device, 'set_tilechain_colors')
            is_multizone = hasattr(device, 'set_zone_colors')
        
        if is_matrix:
    # Some devices (e.g., LIFX Candle Color) report 'matrix' but are actually MultiZone under the hood.
    has_tile_methods = hasattr(device, 'set_tile_colors') or hasattr(device, 'set_tilechain_colors')
    has_multizone = hasattr(device, 'set_zone_colors') or hasattr(device, 'extended_set_zone_color')
    if not has_tile_methods and is_matrix:
        # Stay matrix; do not re-route to multizone for Candle/Tile/Ceiling
        pass
    else:
        try:
            # Matrix/Tile devices (Tile, Ceiling, etc.)
            # Get matrix dimensions from protocol_cfg or query device
            matrix_width = light.protocol_cfg.get('matrix_width', 0)
            matrix_height = light.protocol_cfg.get('matrix_height', 0)

            # If not stored, try to get from device

            # Candle Color heuristic: if exactly 5 zones, assume 5x1
            if (matrix_width == 0 or matrix_height == 0):
                try:
                    zones = len(zone_colors) if isinstance(zone_colors, (list, tuple)) else 0
                except Exception:
                    zones = 0
                if zones == 5:
                    matrix_width, matrix_height = 5, 1
                elif zones in (64, 49):
                    matrix_width, matrix_height = (8,8) if zones == 64 else (7,7)
    
            if (matrix_width == 0 or matrix_height == 0) and hasattr(device, 'get_tile_info'):
                try:
                    tile_info = device.get_tile_info()
                    if tile_info and hasattr(tile_info[0], 'width') and hasattr(tile_info[0], 'height'):
                        matrix_width = int(getattr(tile_info[0], 'width', 8) or 8)
                        matrix_height = int(getattr(tile_info[0], 'height', 8) or 8)
                except Exception:
                    pass

            # Sensible defaults
            if matrix_width == 0: matrix_width = 8
            if matrix_height == 0: matrix_height = 8

            # Convert linear zone list into 2D tile order
            matrix_colors = []
            for y in range(matrix_height):
                for x in range(matrix_width):
                    idx = y * matrix_width + x
                    if idx < len(zone_colors):
                        r, g, b = zone_colors[idx]
                    else:
                        r, g, b = zone_colors[-1] if zone_colors else (0, 0, 0)
                    h, s, v = _rgb_to_hsv65535(r, g, b)
                    matrix_colors.append([h, s, max(1, v), 3500])

            
            # Final guard for dimensions
            if matrix_width == 0 or matrix_height == 0:
                z = len(zone_colors)
                if z == 5:
                    matrix_width, matrix_height = 5, 1
                else:
                    matrix_width, matrix_height = z, 1
            if hasattr(device, 'set_tile_colors'):
                device.set_tile_colors(0, matrix_colors[:64], duration=0, tile_count=1, x=0, y=0, width=matrix_width, rapid=True)
                logging.debug(f"LIFX: Set {len(matrix_colors)} matrix zones ({matrix_width}x{matrix_height}) for {light.name}")
            elif hasattr(device, 'set_tilechain_colors'):
                tiles = []
                tile_size = 64
                for i in range(0, len(matrix_colors), tile_size):
                    tiles.append(matrix_colors[i:i+tile_size])
                device.set_tilechain_colors(tiles, duration=0, rapid=True)
                logging.debug(f"LIFX: Set {len(tiles)} tiles for {light.name}")
            else:
                # Final fallback: average to single color
                if zone_colors:
                    avg_r = sum(c[0] for c in zone_colors) // len(zone_colors)
                    avg_g = sum(c[1] for c in zone_colors) // len(zone_colors)
                    avg_b = sum(c[2] for c in zone_colors) // len(zone_colors)
                    h, s, v = _rgb_to_hsv65535(avg_r, avg_g, avg_b)
                    device.set_color([h, s, max(1, v), 3500], duration=0, rapid=True)
        except Exception as e:
            logging.debug(f"LIFX: Matrix update failed for {light.name}: {e}")
elif is_multizone:
            # Multizone strips (LIFX Z, Beam, Neon)
            try:
                # Get actual zone count from device or protocol_cfg
                actual_zones = light.protocol_cfg.get('points_capable', 0)
                
                # If not stored, query device
                if actual_zones == 0:
                    try:
                        from lifxlan.msgtypes import MultiZoneGetColorZones, MultiZoneStateZone, MultiZoneStateMultiZone
                        response = device.req_with_resp(
                            MultiZoneGetColorZones,
                            [MultiZoneStateZone, MultiZoneStateMultiZone],
                            {"start_index": 0, "end_index": 255}
                        )
                        if hasattr(response, 'count'):
                            actual_zones = response.count
                            # Store for next time
                            light.protocol_cfg['points_capable'] = actual_zones
                    except:
                        actual_zones = len(zone_colors)  # Use provided length as fallback
                
                # Ensure we have the right number of zones
                if actual_zones > 0 and len(zone_colors) != actual_zones:
                    # Interpolate or truncate to match actual zone count
                    if len(zone_colors) < actual_zones:
                        # Interpolate to fill all zones
                        new_colors = []
                        for i in range(actual_zones):
                            pos = i * len(zone_colors) / actual_zones
                            idx = int(pos)
                            if idx < len(zone_colors) - 1:
                                frac = pos - idx
                                r1, g1, b1 = zone_colors[idx]
                                r2, g2, b2 = zone_colors[idx + 1]
                                r = int(r1 + (r2 - r1) * frac)
                                g = int(g1 + (g2 - g1) * frac)
                                b = int(b1 + (b2 - b1) * frac)
                                new_colors.append((r, g, b))
                            else:
                                new_colors.append(zone_colors[-1])
                        zone_colors = new_colors
                    else:
                        # Truncate to actual zone count
                        zone_colors = zone_colors[:actual_zones]
                
                # Convert RGB to HSBK
                hsbk_colors = []
                for r, g, b in zone_colors:
                    # Apply smoothing per zone if enabled
                    zone_key = f"{device_id}_z{len(hsbk_colors)}"
                    if _entertainment_state["smoothing_enabled"]:
                        r, g, b = _apply_smoothing(zone_key, r, g, b)
                    
                    h, s, v = _rgb_to_hsv65535(r, g, b)
                    hsbk_colors.append([h, s, max(1, v), 3500])
                
                # Send to device
                device.set_zone_colors(hsbk_colors, duration=0, rapid=True)
                logging.debug(f"LIFX: Set {len(zone_colors)} zones for {light.name}")
            except Exception as e:
                logging.debug(f"LIFX: Multizone update failed for {light.name}: {e}")
        else:
            # Fall back to single color (average)
            if zone_colors:
                avg_r = sum(c[0] for c in zone_colors) // len(zone_colors)
                avg_g = sum(c[1] for c in zone_colors) // len(zone_colors)
                avg_b = sum(c[2] for c in zone_colors) // len(zone_colors)
                send_rgb_rapid(light, avg_r, avg_g, avg_b)
                
    except Exception as e:
        logging.debug(f"LIFX: Zone rapid send failed for {light.name}: {e}")

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

def set_smoothing_enabled(enabled: bool) -> None:
    """Enable or disable color smoothing."""
    global _entertainment_state
    _entertainment_state["smoothing_enabled"] = enabled
    if not enabled:
        # Clear history when disabling
        _entertainment_state["color_history"].clear()
        _entertainment_state["target_colors"].clear()
    logging.info(f"LIFX: Smoothing {'enabled' if enabled else 'disabled'}")

def set_smoothing_time(ms: int) -> None:
    """Set the smoothing time window in milliseconds."""
    global _entertainment_state
    _entertainment_state["smoothing_ms"] = max(10, min(ms, 500))  # Clamp between 10-500ms
    logging.info(f"LIFX: Smoothing time set to {_entertainment_state['smoothing_ms']}ms")

def update_entertainment_settings(settings: Dict[str, Any]) -> None:
    """Update entertainment settings from config."""
    global _entertainment_state
    
    if "max_fps" in settings:
        set_entertainment_frame_limit(settings["max_fps"])
    
    if "smoothing_enabled" in settings:
        set_smoothing_enabled(settings["smoothing_enabled"])
    
    if "smoothing_ms" in settings:
        set_smoothing_time(settings["smoothing_ms"])
    
    if "keepalive_interval" in settings:
        set_keepalive_interval(settings["keepalive_interval"])
    
    logging.info(f"LIFX: Updated entertainment settings from config")
