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
            # Treat entire WLED strip as one gradient light
            modelid = "LCX002"  # Default gradient strip model
            total_leds = sum(seg["len"] for seg in x.segments)
            lights.append({"protocol": "wled",
                           "name": x.name,
                           "modelid": modelid,
                           "protocol_cfg": {
                               "ip": x.ip,
                               "ledCount": total_leds,
                               "mdns_name": device[1],
                               "mac": x.mac,
                               "segments": x.segments,  # Store all segments
                               "segmentCount": x.segmentCount,
                               "udp_port": x.udpPort,
                               "points_capable": x.segmentCount  # Number of gradient points supported
                           }
                           })
            for light in lights:
                detectedLights.append(light)
        except:
            break


def set_light(light, data):
    ip = light.protocol_cfg['ip']
    if ip in Connections:
        c = Connections[ip]
    else:
        c = WledDevice(ip, light.protocol_cfg['mdns_name'])
        Connections[ip] = c

    if "gradient" in data:
        # Handle gradient data - distribute colors across segments
        send_gradient_data(c, light, data)
    elif "lights" in data:
        # We ignore the segment count of hue provides atm
        destructured_data = data["lights"][list(data["lights"].keys())[0]]
        send_light_data(c, light, destructured_data)
    else:
        send_light_data(c, light, data)


def send_gradient_data(c, light, data):
    """Send gradient data to WLED by distributing colors across segments"""
    state = {}
    segments = []
    
    gradient_points = data.get("gradient", {}).get("points", [])
    num_segments = light.protocol_cfg.get("segmentCount", 1)
    
    if gradient_points:
        # Distribute gradient points across segments
        # We'll interpolate colors if we have fewer points than segments
        for seg_idx in range(num_segments):
            # Calculate which gradient point this segment should use
            point_idx = min(int(seg_idx * len(gradient_points) / num_segments), len(gradient_points) - 1)
            point = gradient_points[point_idx]
            
            xy = point.get("color", {}).get("xy", {})
            color = convert_xy(xy.get("x", 0.5), xy.get("y", 0.5), 255)
            
            seg = {
                "id": seg_idx,
                "on": data.get("on", True),
                "bri": data.get("bri", 254),
                "col": [[color[0], color[1], color[2]]]
            }
            segments.append(seg)
    
    # Apply other properties like on/off and brightness
    for k, v in data.items():
        if k == "on":
            for seg in segments:
                seg["on"] = v
        elif k == "bri":
            for seg in segments:
                seg["bri"] = v + 1
    
    state["seg"] = segments
    c.sendJson(state)


def send_light_data(c, light, data):
    state = {}
    segments = []
    
    # Apply to all segments for single color
    num_segments = light.protocol_cfg.get("segmentCount", 1)
    
    for seg_idx in range(num_segments):
        seg = {
            "id": seg_idx,
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
                # Flash all segments
                for alert_seg in range(num_segments):
                    c.setBriSeg(0, alert_seg)
                sleep(0.6)
                for alert_seg in range(num_segments):
                    c.setBriSeg(data.get("bri", 254), alert_seg)
                return
        
        segments.append(seg)
    
    state["seg"] = segments
    c.sendJson(state)

def get_light_state(light):
    ip = light.protocol_cfg['ip']
    if ip in Connections:
        c = Connections[ip]
    else:
        c = WledDevice(ip, light.protocol_cfg['mdns_name'])
        Connections[ip] = c
    
    # Get state for all segments and combine for gradient
    num_segments = light.protocol_cfg.get("segmentCount", 1)
    if num_segments > 1:
        # Return gradient state combining all segments
        return c.getGradientState()
    else:
        # Single segment, return normal state
        return c.getSegState(0)


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
        req = urllib.request.Request(self.url + "/json")
        req.add_header('Content-Type', 'application/json; charset=utf-8')
        jsondata = json.dumps(data)
        jsondataasbytes = jsondata.encode('utf-8')
        req.add_header('Content-Length', len(jsondataasbytes))
        response = urllib.request.urlopen(req, jsondataasbytes)
