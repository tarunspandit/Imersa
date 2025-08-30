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
    
    # Fix broadcast addresses for Docker
    def _fix_docker_broadcasts():
        """Replace broadcast addresses for Docker - don't just add, REPLACE."""
        # Check if running in Docker
        try:
            is_docker = (
                os.path.exists('/.dockerenv') or 
                os.environ.get('DOCKER_CONTAINER', False) or
                (os.path.exists('/proc/1/cgroup') and 
                 os.path.isfile('/proc/1/cgroup') and 
                 'docker' in open('/proc/1/cgroup').read())
            )
        except:
            is_docker = False
        
        if not is_docker:
            return
        
        logging.info("LIFX: Detected Docker environment, replacing broadcast addresses")
        
        # REPLACE addresses entirely for Docker
        docker_broadcasts = []
        
        # Add environment-specified broadcast first
        if os.environ.get('LIFX_BROADCAST'):
            docker_broadcasts.append(os.environ.get('LIFX_BROADCAST'))
            logging.info(f"LIFX: Using environment broadcast: {os.environ.get('LIFX_BROADCAST')}")
        
        # Add common home network broadcasts
        common_broadcasts = [
            "192.168.1.255",   # Most common
            "192.168.0.255",   # Alternative  
            "10.0.0.255",      # Some networks
            "10.0.1.255",      # Apple routers
            "192.168.2.255",   # Some routers
        ]
        
        # Try to detect actual host network
        try:
            # Get gateway to infer host network
            result = subprocess.run(
                ['ip', 'route', 'show', 'default'],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            if result.returncode == 0 and 'via' in result.stdout:
                # Parse gateway IP
                for line in result.stdout.strip().split('\n'):
                    if 'default' in line and 'via' in line:
                        parts = line.split()
                        gateway = parts[parts.index('via') + 1]
                        
                        # If gateway is Docker's (172.x), use environment hint
                        if gateway.startswith('172.'):
                            # Check for environment variable hint
                            host_net = os.environ.get('HOST_NETWORK', '192.168.1.0')
                            octets = host_net.split('.')[:3]
                            host_broadcast = f"{'.'.join(octets)}.255"
                            if host_broadcast not in common_broadcasts:
                                common_broadcasts.insert(0, host_broadcast)
        except:
            pass
        
        # Add common broadcasts to our Docker list
        for addr in common_broadcasts:
            if addr not in docker_broadcasts:
                docker_broadcasts.append(addr)
        
        # REPLACE lifxlan's list entirely (don't keep Docker's 172.x.x.x)
        lifx_device_mod.UDP_BROADCAST_IP_ADDRS = docker_broadcasts
        
        logging.info(f"LIFX: Replaced broadcast addresses for Docker: {docker_broadcasts}")
    
    # Docker fix will be applied lazily on first discovery
    
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


# Track if Docker fix has been applied
_docker_fix_applied = False

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
    global _docker_fix_applied
    
    if not LIFX_AVAILABLE:
        logging.info("LIFX: lifxlan not available, skipping discovery")
        return
    
    # Apply Docker fix on first discovery only
    if not _docker_fix_applied:
        try:
            _fix_docker_broadcasts()
            _docker_fix_applied = True
        except Exception as e:
            logging.debug(f"LIFX: Docker broadcast fix failed: {e}")
        
    logging.info("LIFX: Starting discovery...")
    
    added = 0
    
    # Get configuration options
    num_lights = opts.get("num_lights") if opts else None
    timeout = opts.get("discovery_timeout", 60) if opts else 60
    static_ips = opts.get("static_ips", []) if opts else []
    subnet = opts.get("subnet", os.environ.get("LIFX_SUBNET", "192.168.1")) if opts else "192.168.1"
    
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
    
    # Then try broadcast discovery (may not work in Docker)
    try:
        lifx = LifxLAN(num_lights=num_lights)
        
        start_time = time.time()
        devices = []
        
        # Try discovery with timeout and multiple attempts
        logging.info(f"LIFX: Attempting broadcast discovery (timeout: {timeout}s)")
        attempts = 0
        max_attempts = max(3, int(timeout / 3))
        
        while time.time() - start_time < timeout and attempts < max_attempts:
            attempts += 1
            try:
                logging.debug(f"LIFX: Discovery attempt {attempts}/{max_attempts}")
                devices = lifx.get_lights()
                if devices:
                    logging.info(f"LIFX: Broadcast found {len(devices)} device(s)")
                    break
                time.sleep(min(3, timeout / max_attempts))
            except Exception as e:
                logging.debug(f"LIFX: Broadcast attempt {attempts} failed: {e}")
                if attempts < max_attempts:
                    time.sleep(min(3, timeout / max_attempts))
                continue
        
        # If broadcast discovery failed in Docker, try subnet scanning
        if not devices and (os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER')):
            logging.info("LIFX: Broadcast failed in Docker, trying subnet scan...")
            devices = _scan_subnet_for_lifx(subnet)
            if devices:
                logging.info(f"LIFX: Subnet scan found {len(devices)} device(s)")
        
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
    
    except Exception as e:
        logging.warning(f"LIFX: Discovery error: {e}")
    
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


def send_rgb_rapid(light: Any, r: int, g: int, b: int) -> None:
    """Send RGB color rapidly for entertainment mode."""
    device = _get_device(light)
    if not device:
        return
    
    try:
        # Handle black as power off
        if r == 0 and g == 0 and b == 0:
            device.set_power("off", duration=0, rapid=True)
            return
        
        # Ensure power is on
        device.set_power("on", duration=0, rapid=True)
        
        # Convert RGB to HSBK
        h, s, v = _rgb_to_hsv65535(r, g, b)
        
        # Use cached kelvin or default
        try:
            _, _, _, k = device.get_color()
        except:
            k = 3500
        
        # Send color update
        device.set_color([h, s, max(1, v), k], duration=0, rapid=True)
        
    except Exception as e:
        logging.debug(f"LIFX: Rapid send failed for {light.name}: {e}")
