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
            
            # Create a light for each segment
            if x.segmentCount > 1:
                # Multiple segments - create one light per segment, skip segment 0
                for seg_idx, segment in enumerate(x.segments):
                    if seg_idx == 0:
                        continue  # Skip segment 0 for multi-segment devices
                    
                    segment_name = f"{x.name}_seg{seg_idx}"
                    # Default to LCT015 for solid color, user can change to gradient model
                    modelid = "LCT015"  
                    
                    lights.append({"protocol": "wled",
                                   "name": segment_name,
                                   "modelid": modelid,
                                   "protocol_cfg": {
                                       "ip": x.ip,
                                       "segment_id": seg_idx,  # Which segment this light controls
                                       "segment_start": segment["start"],  # Starting LED index
                                       "segment_stop": segment["stop"],   # Ending LED index
                                       "ledCount": segment["len"],        # Number of LEDs in this segment
                                       "mdns_name": device[1],
                                       "mac": x.mac,
                                       "udp_port": x.udpPort,
                                       "is_segment": True,
                                       "points_capable": 5  # Gradient points if model changed to gradient
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
        except:
            break


def set_light(light, data):
    ip = light.protocol_cfg['ip']
    if ip in Connections:
        c = Connections[ip]
    else:
        c = WledDevice(ip, light.protocol_cfg['mdns_name'])
        Connections[ip] = c

    # For WLED lights, we primarily use WARLS via entertainment mode
    # This is a fallback for direct API calls (not entertainment mode)
    if "lights" in data:
        # We ignore the segment count of hue provides atm
        destructured_data = data["lights"][list(data["lights"].keys())[0]]
        send_light_data(c, light, destructured_data)
    else:
        send_light_data(c, light, data)



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
