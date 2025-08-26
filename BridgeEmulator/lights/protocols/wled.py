import socket
import urllib.request
import json
import math
import logManager
import requests
from functions.colors import convert_rgb_xy, convert_xy
from time import sleep
from zeroconf import IPVersion, ServiceBrowser, ServiceStateChange, Zeroconf

logging = logManager.logger.get_logger(__name__)

discovered_lights = []
Connections = {}
# Local state tracking to avoid querying WLED for current values
LightStates = {}  # Format: {"ip_segment": {"bri": 255, "xy": [0.5, 0.5], "ct": None}}


def on_mdns_discover(zeroconf, service_type, name, state_change):
    global discovered_lights
    if "wled" in name.lower() and state_change is ServiceStateChange.Added:
        info = zeroconf.get_service_info(service_type, name)
        if info:
            addresses = ["%s" % (socket.inet_ntoa(addr)) for addr in info.addresses]
            try:
                ip = addresses[0]
                port = info.port or 80
                ip_port = f"{ip}:{port}" if port != 80 else ip
                logging.debug(f"<WLED> mDNS discovered {name} at {ip}:{port}")
                discovered_lights.append([ip_port, name])
            except Exception as e:
                logging.debug(f"<WLED> mDNS parse error for {name}: {e}")


def discover(detectedLights, device_ips):
    logging.info('<WLED> discovery started')
    # Reset previous mDNS results to avoid stale entries across scans
    try:
        discovered_lights.clear()
    except Exception:
        pass
    ip_version = IPVersion.V4Only
    zeroconf = Zeroconf(ip_version=ip_version)
    services = "_http._tcp.local."
    browser = ServiceBrowser(zeroconf, services, handlers=[on_mdns_discover])
    sleep(2)
    if len(discovered_lights) == 0:
        # Didn't find anything using mdns, trying device_ips
        logging.info(
            "<WLED> Nothing found using mDNS, trying device_ips method...")
        for ip in device_ips:
            try:
                response = requests.get("http://" + ip + "/json/info", timeout=3)
                if response.status_code == 200:
                    json_resp = json.loads(response.content)
                    if json_resp['brand'] == "WLED":
                        discovered_lights.append([ip, json_resp['name']])
            except Exception as e:
                logging.debug("<WLED> ip %s is unknown device (%s)", ip, e)

    # Done with mDNS
    try:
        zeroconf.close()
    except Exception:
        pass

    for device in discovered_lights:
        try:
            x = WledDevice(device[0], device[1])
            lights = []  # Initialize lights list for this device
            logging.info("<WLED> Found device: %s (%s) with %d segments" % (device[1], device[0], x.segmentCount))
            
            # Create a light for each segment
            if x.segmentCount > 1:
                # Multiple segments - create one light per segment, skip segment 0
                for seg_idx in range(1, x.segmentCount):  # Start from 1, skip 0
                    try:
                        segment = x.segments[seg_idx]
                        segment_start = segment["start"]
                        segment_stop = segment["stop"] 
                        led_count = segment["len"]
                        logging.debug(f"<WLED> Processing segment {seg_idx}: start={segment_start}, stop={segment_stop}, len={led_count}")
                    except (IndexError, KeyError) as e:
                        logging.error(f"<WLED> Error accessing segment {seg_idx}: {e}")
                        # Estimate segment boundaries as fallback
                        leds_per_segment = x.ledCount // x.segmentCount
                        segment_start = seg_idx * leds_per_segment
                        segment_stop = (seg_idx + 1) * leds_per_segment
                        led_count = leds_per_segment
                        logging.debug(f"<WLED> Using estimated segment {seg_idx}: start={segment_start}, stop={segment_stop}, len={led_count}")
                    
                    segment_name = f"{x.name}_seg{seg_idx}"
                    modelid = "LCT015"  # Default to solid color
                    
                    lights.append({"protocol": "wled",
                                   "name": segment_name,
                                   "modelid": modelid,
                                   "protocol_cfg": {
                                       "ip": x.ip,
                                       "segment_id": seg_idx,
                                       "segment_start": segment_start,
                                       "segment_stop": segment_stop,
                                       "ledCount": led_count,
                                       "mdns_name": device[1],
                                       "mac": x.mac,
                                       "udp_port": x.udpPort,
                                       "is_segment": True,
                                       "points_capable": 5
                                   }
                                   })
            else:
                # Single segment or no segments - create one light for entire strip
                total_leds = sum(seg["len"] for seg in x.segments) if x.segments else x.ledCount
                # Default to LCT015 for solid color, user can change to gradient model
                modelid = "LCT015"
                
                lights.append({"protocol": "wled",
                               "name": x.name,
                               "modelid": modelid,
                               "protocol_cfg": {
                                   "ip": x.ip,
                                   "segment_id": 0,  # Entire strip
                                   "segment_start": 0,
                                   "segment_stop": total_leds,
                                   "ledCount": total_leds,
                                   "mdns_name": device[1],
                                   "mac": x.mac,
                                   "udp_port": x.udpPort,
                                   "is_segment": False,
                                   "points_capable": 5  # Gradient points if model changed to gradient
                               }
                               })
            
            for light in lights:
                detectedLights.append(light)
        except Exception as e:
            logging.error(f"<WLED> Failed to process device {device[1]} at {device[0]}: {e}")
            continue


def set_light(light, data):
    ip = light.protocol_cfg['ip']
    if ip in Connections:
        c = Connections[ip]
    else:
        c = WledDevice(ip, light.protocol_cfg['mdns_name'])
        Connections[ip] = c

    # For WLED, always use WARLS approach like entertainment mode
    # Collect data for this specific light and send via WARLS
    send_warls_data(light, data)

def send_warls_data(light, data):
    """Send data to WLED using the same approach as entertainment mode"""
    import socket
    
    # Extract color data from various possible formats
    r, g, b = 0, 0, 0
    brightness = 255  # Default brightness
    
    if "lights" in data:
        destructured_data = data["lights"][list(data["lights"].keys())[0]]
        data = destructured_data
    
    # Get light state key for local tracking
    ip = light.protocol_cfg['ip']
    segment_id = light.protocol_cfg.get("segment_id", 0)
    state_key = f"{ip}_{segment_id}"
    
    # Initialize or get existing state
    if state_key not in LightStates:
        LightStates[state_key] = {"bri": 255, "xy": [0.5, 0.5], "ct": None, "gradient": None}
    
    current_state = LightStates[state_key]
    
    # Handle brightness - if not provided, use tracked brightness
    if "bri" in data:
        brightness = max(1, min(255, data["bri"]))
        current_state["bri"] = brightness  # Update tracked state
    else:
        brightness = current_state["bri"]
    
    # Extract RGB values and update tracked state
    if "xy" in data:
        # For XY colors, use full brightness in conversion, then apply current brightness
        color = convert_xy(data["xy"][0], data["xy"][1], 255)
        r, g, b = color[0], color[1], color[2]
        # Apply current brightness to the color
        r = int(r * brightness / 255)
        g = int(g * brightness / 255)
        b = int(b * brightness / 255)
        # Update tracked state
        current_state["xy"] = [data["xy"][0], data["xy"][1]]
        current_state["ct"] = None  # Clear CT when XY is set
        current_state["gradient"] = None  # Clear gradient when XY is set
    elif "ct" in data:
        # Convert color temperature to RGB and apply current brightness
        kelvin = round(translateRange(data["ct"], 153, 500, 6500, 2000))
        color = kelvinToRgb(kelvin)
        # Apply current brightness to color temperature
        r = int(color[0] * brightness / 255)
        g = int(color[1] * brightness / 255) 
        b = int(color[2] * brightness / 255)
        # Update tracked state
        current_state["ct"] = data["ct"]
        current_state["xy"] = None  # Clear XY when CT is set
        current_state["gradient"] = None  # Clear gradient when CT is set
    elif "bri" in data and ("xy" not in data and "ct" not in data and "gradient" not in data):
        # Brightness-only change - use tracked color state
        if current_state["xy"]:
            # Use tracked XY color
            color = convert_xy(current_state["xy"][0], current_state["xy"][1], 255)
            r = int(color[0] * brightness / 255)
            g = int(color[1] * brightness / 255)
            b = int(color[2] * brightness / 255)
        elif current_state["ct"]:
            # Use tracked CT color
            kelvin = round(translateRange(current_state["ct"], 153, 500, 6500, 2000))
            color = kelvinToRgb(kelvin)
            r = int(color[0] * brightness / 255)
            g = int(color[1] * brightness / 255) 
            b = int(color[2] * brightness / 255)
        elif current_state["gradient"]:
            # Use tracked gradient - recreate gradient data with new brightness
            # This will be processed through the gradient logic below
            data["gradient"] = current_state["gradient"]
        else:
            # Fallback to white if no tracked color
            r = brightness
            g = brightness  
            b = brightness
    
    # Handle on/off state
    if "on" in data and not data["on"]:
        # If turning off, set RGB to 0
        r, g, b = 0, 0, 0
    
    # Get device info
    ip = light.protocol_cfg['ip']
    segment_start = light.protocol_cfg.get("segment_start", 0)
    segment_stop = light.protocol_cfg.get("segment_stop", 100)
    led_count = segment_stop - segment_start
    udp_port = light.protocol_cfg.get("udp_port", 21324)
    
    # Check if this light has a gradient model ID
    is_gradient_model = light.modelid in ["LCX001", "LCX002", "LCX003", "915005987201", "LCX004", "LCX006"]
    
    # Create pixel data array - use same approach as entertainment mode
    pixel_colors = [[0, 0, 0] for _ in range(led_count)]
    
    # Process gradient or solid color
    if is_gradient_model and "gradient" in data:
        gradient_points = data["gradient"]["points"]
        # Track gradient state for brightness-only changes
        current_state["gradient"] = data["gradient"]
        current_state["xy"] = None  # Clear XY when gradient is set
        current_state["ct"] = None  # Clear CT when gradient is set
        
        if len(gradient_points) > 1:
            # Multiple gradient points - interpolate across segment
            for led_idx in range(led_count):
                # Calculate position within segment (0.0 to 1.0)
                local_position = led_idx / max(1, led_count - 1)
                
                # Map position to gradient points
                scaled_pos = local_position * (len(gradient_points) - 1)
                lower_idx = int(scaled_pos)
                upper_idx = min(lower_idx + 1, len(gradient_points) - 1)
                
                if lower_idx == upper_idx:
                    # Same index, use the color directly
                    point = gradient_points[lower_idx]
                    xy = point.get("color", {}).get("xy", {"x": 0.5, "y": 0.5})
                    color = convert_xy(xy.get("x", 0.5), xy.get("y", 0.5), brightness)
                    pixel_colors[led_idx] = [color[0], color[1], color[2]]
                else:
                    # Interpolate between two gradient points
                    factor = scaled_pos - lower_idx
                    
                    lower_point = gradient_points[lower_idx]
                    upper_point = gradient_points[upper_idx]
                    
                    lower_xy = lower_point.get("color", {}).get("xy", {"x": 0.5, "y": 0.5})
                    upper_xy = upper_point.get("color", {}).get("xy", {"x": 0.5, "y": 0.5})
                    
                    lower_color = convert_xy(lower_xy.get("x", 0.5), lower_xy.get("y", 0.5), brightness)
                    upper_color = convert_xy(upper_xy.get("x", 0.5), upper_xy.get("y", 0.5), brightness)
                    
                    interp_r = int(lower_color[0] + (upper_color[0] - lower_color[0]) * factor)
                    interp_g = int(lower_color[1] + (upper_color[1] - lower_color[1]) * factor)
                    interp_b = int(lower_color[2] + (upper_color[2] - lower_color[2]) * factor)
                    
                    pixel_colors[led_idx] = [interp_r, interp_g, interp_b]
        else:
            # Single gradient point - apply to all pixels
            point = gradient_points[0]
            xy = point.get("color", {}).get("xy", {"x": 0.5, "y": 0.5})
            color = convert_xy(xy.get("x", 0.5), xy.get("y", 0.5), brightness)
            for led_idx in range(led_count):
                pixel_colors[led_idx] = [color[0], color[1], color[2]]
    else:
        # Non-gradient model or solid color - apply same color to all pixels
        for led_idx in range(led_count):
            pixel_colors[led_idx] = [r, g, b]
    
    # Use DNRGB protocol for segments
    udpdata = bytearray(4 + led_count * 3)  # header + start_index + RGB per LED
    udpdata[0] = 4  # DNRGB protocol
    udpdata[1] = 255  # No timeout - stay on UDP data until changed by another method
    udpdata[2] = (segment_start >> 8) & 0xFF  # Start index high byte
    udpdata[3] = segment_start & 0xFF  # Start index low byte
    
    # Fill UDP packet with DNRGB format (R,G,B per LED)
    idx = 4
    for led_idx in range(led_count):
        udpdata[idx] = max(0, min(255, pixel_colors[led_idx][0]))     # Red
        udpdata[idx+1] = max(0, min(255, pixel_colors[led_idx][1]))   # Green
        udpdata[idx+2] = max(0, min(255, pixel_colors[led_idx][2]))   # Blue
        idx += 3
    
    # Send WARLS data
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(udpdata, (ip.split(":")[0], udp_port))
        sock.close()
    except Exception as e:
        logging.error(f"Failed to send WARLS data to {ip}: {e}")

def send_light_data(c, light, data):
    """Send data to a specific segment of WLED device"""
    state = {}
    
    # Get the specific segment this light controls
    segment_id = light.protocol_cfg.get("segment_id", 0)
    
    seg = {
        "id": segment_id,
        "on": True
    }
    
    for k, v in data.items():
        if k == "on":
            seg["on"] = v
        elif k == "bri":
            seg["bri"] = v + 1
        elif k == "ct":
            kelvin = round(translateRange(v, 153, 500, 6500, 2000))
            color = kelvinToRgb(kelvin)
            seg["col"] = [[color[0], color[1], color[2]]]
        elif k == "xy":
            color = convert_xy(v[0], v[1], 255)
            seg["col"] = [[color[0], color[1], color[2]]]
        elif k == "alert" and v != "none":
            # Flash this specific segment
            c.setBriSeg(0, segment_id)
            sleep(0.6)
            c.setBriSeg(data.get("bri", 254), segment_id)
            return
    
    state["seg"] = [seg]
    c.sendJson(state)

def get_light_state(light):
    ip = light.protocol_cfg['ip']
    if ip in Connections:
        c = Connections[ip]
    else:
        c = WledDevice(ip, light.protocol_cfg['mdns_name'])
        Connections[ip] = c
    
    # Check if this WLED light has a gradient-capable model ID
    is_gradient_model = light.modelid in ["LCX001", "LCX002", "LCX003", "915005987201", "LCX004", "LCX006"]
    segment_id = light.protocol_cfg.get("segment_id", 0)
    
    if is_gradient_model:
        # Return gradient state for this light
        return c.getGradientState()
    else:
        # Return normal state for this specific segment
        return c.getSegState(segment_id)


def translateRange(value, leftMin, leftMax, rightMin, rightMax):
    leftSpan = leftMax - leftMin
    rightSpan = rightMax - rightMin
    valueScaled = float(value - leftMin) / float(leftSpan)
    return rightMin + (valueScaled * rightSpan)


def clamp(num, min_val, max_val):
    return max(min(num, max_val), min_val)


def kelvinToRgb(temp):
    tmpKelvin = clamp(temp, 1000, 40000) / 100
    r = 255 if tmpKelvin <= 66 else clamp(
        329.698727446 * pow(tmpKelvin - 60, -0.1332047592), 0, 255)
    g = clamp(99.4708025861 * math.log(tmpKelvin) - 161.1195681661, 0,
              255) if tmpKelvin <= 66 else clamp(288.1221695283 * (pow(tmpKelvin - 60, -0.0755148492)), 0, 255)
    if tmpKelvin >= 66:
        b = 255
    elif tmpKelvin <= 19:
        b = 0
    else:
        b = clamp(138.5177312231 * math.log(tmpKelvin - 10) -
                  305.0447927307, 0, 255)
    return [r, g, b]


class WledDevice:

    def __init__(self, ip, mdns_name):
        self.ip = ip
        self.name = mdns_name.split(".")[0]
        self.url = 'http://' + self.ip
        self.ledCount = 0
        self.mac = None
        self.segmentCount = 1  # Default number of segments in WLED
        self.segments = []
        self.getInitialState()

    def getInitialState(self):
        self.state = self.getLightState()
        self.getInfo()
    
    def getInfo(self):
        data = self.state or {}
        info = data.get('info')
        state = data.get('state')

        # If one of the sections is missing, try dedicated endpoints
        if info is None:
            try:
                info = requests.get(self.url + '/json/info', timeout=2).json()
            except Exception:
                info = {}
        if state is None:
            try:
                state = requests.get(self.url + '/json/state', timeout=2).json()
            except Exception:
                state = {}

        # LED count
        try:
            self.ledCount = info.get('leds', {}).get('count', 0)
        except Exception:
            self.ledCount = 0

        # MAC address
        try:
            mac_raw = info.get('mac')
            if mac_raw and len(mac_raw) == 12:
                self.mac = ':'.join(mac_raw[i:i+2] for i in range(0, 12, 2))
            else:
                self.mac = None
        except Exception:
            self.mac = None

        # Segments
        try:
            self.segments = state.get('seg', [])
            self.segmentCount = len(self.segments) if isinstance(self.segments, list) else 1
        except Exception:
            self.segments = []
            self.segmentCount = 1

        # UDP port for realtime
        try:
            self.udpPort = info.get('udpport', 21324)
        except Exception:
            self.udpPort = 21324

    def getLightState(self):
        # Prefer requests with a short timeout and graceful fallback endpoints
        urls = [self.url + '/json', self.url + '/json/info']
        last_err = None
        for u in urls:
            try:
                resp = requests.get(u, timeout=2)
                if resp.ok:
                    return resp.json()
            except Exception as e:
                last_err = e
        # Final fallback using urllib with timeout
        try:
            with urllib.request.urlopen(self.url + '/json', timeout=2) as resp:
                data = json.loads(resp.read())
                return data
        except Exception as e:
            raise ConnectionError(f"Unable to fetch WLED JSON from {self.url} ({last_err or e})")

    def getSegState(self, seg):
        state = {}
        data = self.getLightState()['state']
        seg = data['seg'][seg]
        state['bri'] = seg['bri']
        state['on'] = seg['on']
        # Weird division by zero when a color is 0
        r = int(seg['col'][0][0])+1
        g = int(seg['col'][0][1])+1
        b = int(seg['col'][0][2])+1
        state['xy'] = convert_rgb_xy(r, g, b)
        state["colormode"] = "xy"
        return state
    
    def getGradientState(self):
        """Get combined state for gradient strip with all segments"""
        state = {}
        data = self.getLightState()['state']
        segments = data['seg']
        
        # Use first segment for on/off and brightness
        state['on'] = segments[0]['on'] if segments else False
        state['bri'] = segments[0]['bri'] if segments else 0
        
        # Build gradient points from all segments
        gradient_points = []
        for seg in segments:
            r = int(seg['col'][0][0]) + 1
            g = int(seg['col'][0][1]) + 1
            b = int(seg['col'][0][2]) + 1
            xy = convert_rgb_xy(r, g, b)
            
            gradient_points.append({
                "color": {
                    "xy": {"x": xy[0], "y": xy[1]}
                }
            })
        
        state['gradient'] = {"points": gradient_points}
        state["colormode"] = "gradient"
        return state

    def setRGBSeg(self, r, g, b, seg):
        state = {"seg": [{"id": seg, "col": [[r, g, b]]}]}
        self.sendJson(state)

    def setOnSeg(self, on, seg):
        state = {"seg": [{"id": seg, "on": on}]}
        self.sendJson(state)

    def setBriSeg(self, bri, seg):
        state = {"seg": [{"id": seg, "bri": bri}]}
        self.sendJson(state)

    def sendJson(self, data):
        try:
            response = requests.post(self.url + "/json", json=data, timeout=2)
            response.raise_for_status()
        except Exception as e:
            logging.debug(f"<WLED> sendJson failed for {self.url}: {e}")
