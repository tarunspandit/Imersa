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


def on_mdns_discover(zeroconf, service_type, name, state_change):
    global discovered_lights
    if "wled" in name and state_change is ServiceStateChange.Added:
        info = zeroconf.get_service_info(service_type, name)
        if info:
            addresses = ["%s" % (socket.inet_ntoa(addr))
                         for addr in info.addresses]
            discovered_lights.append([addresses[0], name])


def discover(detectedLights, device_ips):
    logging.info('<WLED> discovery started')
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
                response = requests.get(
                    "http://" + ip + "/json/info", timeout=3)
                if response.status_code == 200:
                    json_resp = json.loads(response.content)
                    if json_resp['brand'] == "WLED":
                        discovered_lights.append([ip, json_resp['name']])
            except Exception as e:
                logging.debug("<WLED> ip %s is unknown device", ip)

    lights = []
    for device in discovered_lights:
        try:
            x = WledDevice(device[0], device[1])
            logging.info("<WLED> Found device: %s with %d segments" %
                         (device[1], x.segmentCount))
            
            # Create a separate light for each segment
            if x.segmentCount > 1:
                # Multiple segments - create a light for each (skip segment 0 as it's the entire strip)
                for seg_idx, segment in enumerate(x.segments):
                    # Log segment details for debugging
                    seg_start = segment.get("start", 0)
                    seg_stop = segment.get("stop", 0)
                    seg_len = segment.get("len", 0)
                    logging.info(f"<WLED> Segment {seg_idx}: start={seg_start}, stop={seg_stop}, len={seg_len}")
                    
                    # Skip segment 0 (it's the entire strip) when we have multiple segments
                    if seg_idx == 0:
                        logging.info(f"<WLED> Skipping segment 0 (main segment covering entire strip)")
                        continue
                    
                    # Skip segments with 0 LEDs
                    if seg_len == 0:
                        logging.info(f"<WLED> Skipping segment {seg_idx} with 0 LEDs")
                        continue
                        
                    # Default model ID for segments - can be changed in GUI
                    modelid = "LST002"  # Default Hue Lightstrip Plus model
                    lights.append({"protocol": "wled",
                                   "name": f"{x.name} Segment {seg_idx}",  # Use actual segment number
                                   "modelid": modelid,
                                   "protocol_cfg": {
                                       "ip": x.ip,
                                       "ledCount": seg_len,
                                       "mdns_name": device[1],
                                       "mac": x.mac,
                                       "segment_id": seg_idx,  # Which segment this light controls
                                       "segment_start": seg_start,  # Starting LED index
                                       "segment_stop": seg_stop,  # Ending LED index
                                       "total_segments": x.segmentCount,
                                       "udp_port": x.udpPort,
                                       "wled_name": x.name  # Original WLED device name
                                   }
                                   })
            else:
                # Single segment (or only segment 0) - treat as one light
                modelid = "LCX002"  # Default gradient strip model for single segment
                segment = x.segments[0] if x.segments else {}
                seg_start = segment.get("start", 0)
                seg_stop = segment.get("stop", x.ledCount)
                seg_len = segment.get("len", x.ledCount)
                
                lights.append({"protocol": "wled",
                               "name": x.name,
                               "modelid": modelid,
                               "protocol_cfg": {
                                   "ip": x.ip,
                                   "ledCount": seg_len,
                                   "mdns_name": device[1],
                                   "mac": x.mac,
                                   "segment_id": 0,
                                   "segment_start": seg_start,
                                   "segment_stop": seg_stop,
                                   "total_segments": 1,
                                   "udp_port": x.udpPort,
                                   "wled_name": x.name
                               }
                               })
            
            for light in lights:
                detectedLights.append(light)
        except Exception as e:
            logging.error(f"<WLED> Error processing device {device}: {e}")
            continue


def set_light(light, data):
    ip = light.protocol_cfg['ip']
    if ip in Connections:
        c = Connections[ip]
    else:
        c = WledDevice(ip, light.protocol_cfg.get('mdns_name', light.protocol_cfg.get('wled_name', 'wled')))
        Connections[ip] = c

    # Check if this light has a gradient-capable model ID
    gradient_models = ["LCX001", "LCX002", "LCX003", "LCX004", "915005987201"]
    is_gradient_light = light.modelid in gradient_models
    
    if "gradient" in data and is_gradient_light:
        # Handle gradient data for gradient-capable lights
        send_gradient_to_segment(c, light, data)
    elif "lights" in data:
        # We ignore the segment count of hue provides atm
        destructured_data = data["lights"][list(data["lights"].keys())[0]]
        send_segment_data(c, light, destructured_data)
    else:
        send_segment_data(c, light, data)


def send_gradient_to_segment(c, light, data):
    """Send gradient data to a specific WLED segment with linear interpolation"""
    segment_id = light.protocol_cfg.get('segment_id', 0)
    led_count = light.protocol_cfg.get('ledCount', 30)
    segment_start = light.protocol_cfg.get('segment_start', 0)
    
    gradient_points = data.get("gradient", {}).get("points", [])
    
    if gradient_points and len(gradient_points) >= 2:
        # Linear interpolation across all LEDs in this segment
        colors = []
        for led_idx in range(led_count):
            # Calculate position (0.0 to 1.0) of this LED within the segment
            position = led_idx / max(1, led_count - 1)
            
            # Find which two gradient points we're between
            segment_pos = position * (len(gradient_points) - 1)
            lower_idx = int(segment_pos)
            upper_idx = min(lower_idx + 1, len(gradient_points) - 1)
            blend_factor = segment_pos - lower_idx
            
            # Get colors from gradient points
            lower_point = gradient_points[lower_idx]
            upper_point = gradient_points[upper_idx]
            
            lower_xy = lower_point.get("color", {}).get("xy", {})
            upper_xy = upper_point.get("color", {}).get("xy", {})
            
            lower_color = convert_xy(lower_xy.get("x", 0.5), lower_xy.get("y", 0.5), 255)
            upper_color = convert_xy(upper_xy.get("x", 0.5), upper_xy.get("y", 0.5), 255)
            
            # Linear interpolation between colors
            r = int(lower_color[0] + (upper_color[0] - lower_color[0]) * blend_factor)
            g = int(lower_color[1] + (upper_color[1] - lower_color[1]) * blend_factor)
            b = int(lower_color[2] + (upper_color[2] - lower_color[2]) * blend_factor)
            
            colors.append([r, g, b])
        
        # Send via UDP for smooth gradient
        if hasattr(c, 'udpPort') and c.udpPort:
            send_udp_gradient(c.ip, c.udpPort, segment_start, colors, led_count)
    else:
        # Fallback to single color if not enough gradient points
        send_segment_data(c, light, data)


def send_segment_data(c, light, data):
    """Send data to a specific WLED segment"""
    segment_id = light.protocol_cfg.get('segment_id', 0)
    
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
            # Flash this segment
            c.setBriSeg(0, segment_id)
            sleep(0.6)
            c.setBriSeg(data.get("bri", 254), segment_id)
            return
    
    state = {"seg": [seg]}
    c.sendJson(state)

def send_udp_gradient(ip, port, segment_start, colors, led_count):
    """Send gradient colors via UDP using DRGB protocol for specific segment position"""
    try:
        if segment_start == 0:
            # For the first segment (or segments starting at 0), use WARLS
            # WARLS protocol: 0x01 (protocol) + 0x02 (wait 2 frames) + RGB data
            buffer = bytearray(2 + led_count * 3)
            buffer[0] = 0x01  # WARLS protocol
            buffer[1] = 0x02  # Wait 2 frames
            
            # Fill in RGB values
            for i, color in enumerate(colors[:led_count]):
                buffer[2 + i*3] = color[0]     # R
                buffer[2 + i*3 + 1] = color[1] # G
                buffer[2 + i*3 + 2] = color[2] # B
        else:
            # For other segments, use DRGB with offset
            # DRGB protocol: 0x04 + offset (2 bytes) + RGB data
            buffer = bytearray(3 + led_count * 3)
            buffer[0] = 0x04  # DRGB protocol
            buffer[1] = (segment_start >> 8) & 0xFF  # Offset high byte
            buffer[2] = segment_start & 0xFF  # Offset low byte
            
            # Fill in RGB values
            for i, color in enumerate(colors[:led_count]):
                buffer[3 + i*3] = color[0]     # R
                buffer[3 + i*3 + 1] = color[1] # G
                buffer[3 + i*3 + 2] = color[2] # B
        
        # Send UDP packet
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(buffer, (ip, port))
        sock.close()
    except Exception as e:
        logging.error(f"<WLED> Error sending UDP gradient: {e}")

def get_light_state(light):
    ip = light.protocol_cfg['ip']
    if ip in Connections:
        c = Connections[ip]
    else:
        c = WledDevice(ip, light.protocol_cfg.get('mdns_name', light.protocol_cfg.get('wled_name', 'wled')))
        Connections[ip] = c
    
    segment_id = light.protocol_cfg.get('segment_id', 0)
    
    # Check if this light has a gradient-capable model ID
    gradient_models = ["LCX001", "LCX002", "LCX003", "LCX004", "915005987201"]
    is_gradient_light = light.modelid in gradient_models
    
    if is_gradient_light:
        # Return gradient state for this segment
        return c.getSegmentGradientState(segment_id)
    else:
        # Return normal state for this segment
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
        self.ledCount = self.state['info']['leds']['count']
        self.mac = ':'.join(self.state[
                            'info']['mac'][i:i+2] for i in range(0, 12, 2))
        self.segments = self.state['state']['seg']
        self.segmentCount = len(self.segments)
        self.udpPort = self.state['info']['udpport']

    def getLightState(self):
        with urllib.request.urlopen(self.url + '/json') as resp:
            data = json.loads(resp.read())
            return data

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
    
    def getSegmentGradientState(self, seg_id):
        """Get gradient state for a specific segment"""
        state = {}
        data = self.getLightState()['state']
        
        if seg_id < len(data['seg']):
            seg = data['seg'][seg_id]
            state['on'] = seg['on']
            state['bri'] = seg['bri']
            
            # Create gradient points from segment's current color
            # For single segment gradient, we'll create 2 points with the same color
            r = int(seg['col'][0][0]) + 1
            g = int(seg['col'][0][1]) + 1
            b = int(seg['col'][0][2]) + 1
            xy = convert_rgb_xy(r, g, b)
            
            gradient_points = [
                {"color": {"xy": {"x": xy[0], "y": xy[1]}}},
                {"color": {"xy": {"x": xy[0], "y": xy[1]}}}
            ]
            
            state['gradient'] = {"points": gradient_points}
            state["colormode"] = "gradient"
        else:
            # Fallback if segment doesn't exist
            state = self.getSegState(0)
            state["colormode"] = "gradient"
            state['gradient'] = {"points": []}
        
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
        req = urllib.request.Request(self.url + "/json")
        req.add_header('Content-Type', 'application/json; charset=utf-8')
        jsondata = json.dumps(data)
        jsondataasbytes = jsondata.encode('utf-8')
        req.add_header('Content-Length', len(jsondataasbytes))
        response = urllib.request.urlopen(req, jsondataasbytes)
