import colorsys
from typing import Any, Dict, List, Optional, Tuple

import logManager

from functions.colors import convert_xy

logging = logManager.logger.get_logger(__name__)

try:
    # lifxlan docs: https://github.com/mclarkk/lifxlan
    from lifxlan import LifxLAN, Light as LifxLight
    import lifxlan.device as lifx_device_mod
except Exception:
    LifxLAN = None  # Graceful degradation if library not installed
    LifxLight = None
    lifx_device_mod = None


# Simple cache to avoid repeated lookups
_DEVICE_CACHE: Dict[str, Any] = {}


def _get_mac_from_arp(ip: str) -> Optional[str]:
    """Try to resolve a device's MAC via the ARP table (Linux/Unix)."""
    try:
        with open("/proc/net/arp", "r", encoding="utf-8") as fp:
            lines = fp.read().strip().splitlines()
        for line in lines[1:]:  # skip header
            parts = [p for p in line.split(" ") if p]
            if len(parts) >= 4:
                ip_addr, hw_type, flags, mac = parts[0], parts[1], parts[2], parts[3]
                if ip_addr == ip and mac and mac != "00:00:00:00:00:00":
                    return mac
    except Exception:
        pass
    # Fallback: try 'ip neigh' via /proc/self/mount; avoid spawning external processes
    return None


def _unicast_discover_by_ip(ip: str) -> Optional[Any]:
    """Discover a single device by targeting only its IP using lifxlan's broadcast workflow.

    This works by temporarily overriding lifxlan's UDP_BROADCAST_IP_ADDRS to a list containing
    only the given IP address, forcing a 'broadcast' packet to be sent directly to that host.
    """
    if LifxLAN is None or lifx_device_mod is None:
        return None
    try:
        # Preserve and override broadcast addresses
        original_addrs = list(getattr(lifx_device_mod, 'UDP_BROADCAST_IP_ADDRS', []))
        lifx_device_mod.UDP_BROADCAST_IP_ADDRS = [ip]
        try:
            lan = LifxLAN()
            devs = lan.get_devices() or []
            for d in devs:
                try:
                    if hasattr(d, 'get_ip_addr') and d.get_ip_addr() == ip:
                        return d
                except Exception:
                    continue
            # fallback: match first light with same ip
            for l in (lan.get_lights() or []):
                try:
                    if l.get_ip_addr() == ip:
                        return l
                except Exception:
                    continue
        finally:
            lifx_device_mod.UDP_BROADCAST_IP_ADDRS = original_addrs
    except Exception:
        return None
    return None


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
    """Resolve and cache a lifxlan device by MAC (preferred) or IP."""
    if LifxLAN is None:
        logging.info("LIFX: lifxlan not installed; skipping device resolution")
        return None
    mac = light.protocol_cfg.get("id")
    ip = light.protocol_cfg.get("ip")
    # Some callers pass host:port strings; split out port if present
    if isinstance(ip, str) and ":" in ip:
        ip = ip.split(":", 1)[0]

    if mac and mac in _DEVICE_CACHE:
        return _DEVICE_CACHE.get(mac)
    if ip and ip in _DEVICE_CACHE:
        return _DEVICE_CACHE.get(ip)

    try:
        lifx = LifxLAN()
    except Exception as e:
        logging.warning("LIFX: Failed to init LifxLAN: %s", e)
        return None

    dev = None
    # First, try a unicast discovery to the IP if we have one
    if dev is None and ip:
        dev = _unicast_discover_by_ip(ip)
    # Otherwise, broadcast discovery (may fail in restricted networks)
    if dev is None:
        try:
            for d in lifx.get_lights() or []:
                try:
                    if mac and getattr(d, "mac_addr", None) and d.get_mac_addr() == mac:
                        dev = d
                        break
                    if ip and d.get_ip_addr() == ip:
                        dev = d
                        break
                except Exception:
                    continue
        except Exception:
            pass
    # Last resort: construct a Light from ARP-resolved MAC and IP
    if dev is None and ip and LifxLight is not None:
        try:
            mac_guess = mac or _get_mac_from_arp(ip)
            if mac_guess:
                dev = LifxLight(mac_guess, ip)
        except Exception:
            dev = None

    key = mac or ip
    if key and dev is not None:
        _DEVICE_CACHE[key] = dev
    return dev


def discover(detectedLights: List[Dict], opts: Optional[Dict] = None) -> None:
    """Discover LIFX devices over LAN via lifxlan and append to detectedLights.

    Each discovered device is mapped to a Hue-like light using modelid LCT015
    (color-capable). White-only bulbs will still work for on/off/brightness/ct.
    """
    if LifxLAN is None:
        logging.info("LIFX: lifxlan not installed; discovery disabled")
        return
    logging.info("LIFX: discovery started")
    lifx = None
    lights: List[Any] = []
    try:
        lifx = LifxLAN()
        try:
            lights = lifx.get_lights() or []
        except Exception as e:
            logging.debug("LIFX: broadcast get_lights failed: %s", e)
            lights = []
    except Exception as e:
        logging.warning("LIFX: init failed: %s", e)
        lifx = None

    added = 0
    for dev in lights:
        try:
            ip = dev.get_ip_addr()
            label = dev.get_label() or "LIFX"
            mac = dev.get_mac_addr()
            # Default to Hue color bulb mapping
            detectedLights.append({
                "protocol": "lifx",
                "name": label,
                "modelid": "LCT015",
                "protocol_cfg": {"ip": ip, "id": mac, "label": label}
            })
            added += 1
        except Exception:
            continue

    # Optional: discover specific static IPs provided in config
    static_ips: List[str] = []
    if opts and isinstance(opts, dict):
        static_ips = opts.get("static_ips", []) or []
    for ip in static_ips:
        try:
            if ":" in ip:
                ip = ip.split(":", 1)[0]
            dev = _unicast_discover_by_ip(ip)
            mac = None
            label = None
            if dev is not None:
                try:
                    mac = dev.get_mac_addr()
                except Exception:
                    mac = None
                try:
                    label = dev.get_label()
                except Exception:
                    label = None
            # Try ARP for MAC if needed
            if mac is None:
                mac = _get_mac_from_arp(ip)
            if label is None:
                label = f"LIFX {ip}"
            detectedLights.append({
                "protocol": "lifx",
                "name": label,
                "modelid": "LCT015",
                "protocol_cfg": {"ip": ip, "id": mac or ip, "label": label}
            })
            added += 1
        except Exception:
            continue
    logging.info(f"LIFX: discovery finished. Added {added} bulbs")


def set_light(light: Any, data: Dict) -> None:
    """Apply state changes to a LIFX light.

    Supports keys: on, bri, xy, hue, sat, ct, transitiontime (optional)
    """
    dev = _get_device(light)
    if dev is None:
        logging.warning("LIFX: set_light could not resolve device for %s (ip=%s, id=%s)", light.name, light.protocol_cfg.get("ip"), light.protocol_cfg.get("id"))
        return

    duration_ms = 0
    if "transitiontime" in data:
        # Hue transitiontime is in deciseconds; lifxlan expects milliseconds
        try:
            duration_ms = int(max(0, float(data["transitiontime"])) * 100)
        except Exception:
            duration_ms = 0

    try:
        if "on" in data:
            dev.set_power("on" if data["on"] else "off", duration=duration_ms)

        # Read current HSBK to preserve unspecified channels
        try:
            current_h, current_s, current_b, current_k = dev.get_color()
        except Exception:
            current_h, current_s, current_b, current_k = (0, 0, 32768, 3500)

        target_h, target_s, target_b, target_k = current_h, current_s, current_b, current_k

        # Brightness
        if "bri" in data and data["bri"] is not None:
            target_b = _scale_bri_254_to_65535(int(data["bri"]))

        # Color temperature (dominates over color if present)
        if "ct" in data and data["ct"] is not None:
            target_k = _mirek_to_kelvin(int(data["ct"]))
            target_s = 0  # use white channel

        # XY color
        if "xy" in data and isinstance(data["xy"], list) and len(data["xy"]) == 2:
            x, y = float(data["xy"][0]), float(data["xy"][1])
            # Use provided bri if present, else approximate from current_b
            bri_254 = int(data.get("bri", _scale_bri_65535_to_254(target_b)))
            r, g, b = convert_xy(x, y, 255)
            h655, s655, v655 = _rgb_to_hsv65535(r, g, b)
            target_h, target_s = h655, s655
            # Keep brightness derived from bri (already set above) or v component
            if "bri" not in data:
                target_b = max(target_b, v655)
            # keep kelvin

        # Hue/Sat color
        hue_changed = "hue" in data and data["hue"] is not None
        sat_changed = "sat" in data and data["sat"] is not None
        if hue_changed or sat_changed:
            if hue_changed:
                # Hue already uses 0..65535 in Hue API
                target_h = int(max(0, min(int(data["hue"]), 65535)))
            if sat_changed:
                target_s = _scale_sat_254_to_65535(int(data["sat"]))

        # Apply color if any color channel changed
        if (target_h, target_s, target_b, target_k) != (current_h, current_s, current_b, current_k):
            dev.set_color([target_h, target_s, target_b, target_k], duration=duration_ms, rapid=(duration_ms == 0))

    except Exception as e:
        logging.warning("LIFX: error setting state for %s: %s", light.name, e)


def get_light_state(light: Any) -> Dict:
    """Query live state from a LIFX device and map to Hue fields."""
    dev = _get_device(light)
    if dev is None:
        return {}
    state: Dict[str, Any] = {}
    try:
        pwr = dev.get_power()
        state["on"] = bool(pwr and int(pwr) > 0)
    except Exception:
        state["on"] = False
    try:
        h, s, b, k = dev.get_color()
        state["bri"] = _scale_bri_65535_to_254(int(b))
        # Decide color mode: treat low saturation as CT mode
        if int(s) < 512:
            state["ct"] = max(153, min(500, _kelvin_to_mirek(int(k))))
            state["colormode"] = "ct"
        else:
            state["hue"] = int(h)
            state["sat"] = _scale_sat_65535_to_254(int(s))
            state["colormode"] = "hs"
    except Exception:
        pass
    return state


def send_rgb_rapid(light: Any, r: int, g: int, b: int) -> None:
    """High-FPS path: set color rapidly using UDP without waiting for ACKs.

    - Automatically turns power on when sending non-zero color.
    - Turns power off if RGB is 0,0,0 to avoid extra traffic.
    """
    dev = _get_device(light)
    if dev is None:
        return
    try:
        if r == 0 and g == 0 and b == 0:
            try:
                dev.set_power("off", duration=0, rapid=True)
            except Exception:
                pass
            return
        # Ensure power on for visible updates
        try:
            dev.set_power("on", duration=0, rapid=True)
        except Exception:
            pass
        h, s, v = _rgb_to_hsv65535(r, g, b)
        # Keep previous kelvin or use neutral 3500K
        try:
            _, _, _, k = dev.get_color()
        except Exception:
            k = 3500
        dev.set_color([h, s, max(1, v), k], duration=0, rapid=True)
    except Exception as e:
        logging.debug("LIFX rapid send failed for %s: %s", light.name, e)
