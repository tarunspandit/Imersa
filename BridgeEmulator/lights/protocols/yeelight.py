import logManager
import yeelight
from functions.colors import convert_rgb_xy, convert_xy
from time import sleep

logging = logManager.logger.get_logger(__name__)
Connections = {}


def discover(detectedLights, device_ips=None):
    """Discover Yeelight bulbs.

    Primary path uses multicast discovery via python-yeelight. As a fallback,
    when device_ips are provided (e.g., results of a TCP port scan on 55443),
    probe each IP directly to build a minimal light entry so users can add by IP
    even when multicast is blocked.
    """
    logging.debug("Yeelight: <discover> invoked!")

    # Keep a set of already known IDs/IPs to avoid duplicates
    known_ids = set()
    known_ips = set()
    for l in detectedLights:
        if l.get("protocol") == "yeelight":
            if "id" in l.get("protocol_cfg", {}):
                known_ids.add(l["protocol_cfg"]["id"])
            if "ip" in l.get("protocol_cfg", {}):
                known_ips.add(l["protocol_cfg"]["ip"].split(":")[0])

    # Multicast discovery first
    try:
        md = yeelight.discover_bulbs()
    except Exception as e:
        logging.debug(f"Yeelight: multicast discovery failed: {e}")
        md = []

    for light in md:
        try:
            cap = light.get("capabilities", {})
            dev_id = cap.get("id")
            ip = light.get("ip")
            if not ip:
                continue
            if dev_id in known_ids or ip in known_ips:
                continue
            logging.info("Found YeeLight: " + str(dev_id))
            modelid = "LWB010"
            if cap.get("model") == "desklamp":
                modelid = "LTW001"
            elif cap.get("model") in ["ceiling10", "ceiling20", "ceiling4", "ceilb"]:
                detectedLights.append({
                    "protocol": "yeelight",
                    "name": (cap.get("name") + '-bg') if cap.get("name") not in [None, ""] else 'Yeelight ' + str(dev_id),
                    "modelid": "LCT015",
                    "protocol_cfg": {"ip": ip, "id": str(dev_id) + "bg", "backlight": True, "model": cap.get("model")}
                })
                modelid = "LWB010"  # second light must be CT only
            elif cap.get("rgb"):
                modelid = "LCT015"
            elif cap.get("ct"):
                modelid = "LTW001"
            elif cap.get("xy"):
                modelid = "LLC010"
            detectedLights.append({
                "protocol": "yeelight",
                "name": cap.get("name") if cap.get("name") not in [None, ""] else 'Yeelight ' + str(dev_id),
                "modelid": modelid,
                "protocol_cfg": {"ip": ip, "id": str(dev_id), "backlight": False, "model": cap.get("model")}
            })
            known_ids.add(str(dev_id))
            known_ips.add(ip)
        except Exception as e:
            logging.debug(f"Yeelight: error parsing multicast discovery entry: {e}")

    # Fallback: probe provided IPs directly (no multicast)
    if device_ips:
        for host in device_ips:
            try:
                ip = host.split(":")[0]
                if ip in known_ips:
                    continue
                b = yeelight.Bulb(ip)
                props = b.get_properties()
                # Validate this really looks like a Yeelight device
                if not props or ("power" not in props and "bg_power" not in props) or "bright" not in props:
                    logging.debug(f"Yeelight probe ignored {ip}: missing required properties {props}")
                    continue
                name = props.get("name") if props.get("name") not in [None, ""] else f"Yeelight {ip}"
                # If device supports RGB modes, prefer color model
                color_mode = props.get("color_mode")
                modelid = "LCT015" if color_mode in ["1", "3"] else "LTW001"
                detectedLights.append({
                    "protocol": "yeelight",
                    "name": name,
                    "modelid": modelid,
                    "protocol_cfg": {"ip": ip, "id": ip, "backlight": False, "model": props.get("model", "")}
                })
                known_ips.add(ip)
            except Exception as e:
                logging.debug(f"Yeelight: error probing {host}: {e}")

    return detectedLights


def connect(light):
    ip = light.protocol_cfg["ip"]
    if ip in Connections:
        c = Connections[ip]
    else:
        c = yeelight.Bulb(ip)
        Connections[ip] = c
    return c

def set_light(light, data):
    c = connect(light)
    payload = {}
    transitiontime = 400
    cmdPrefix = ''
    if "backlight" in light.protocol_cfg and light.protocol_cfg["backlight"]:
        cmdPrefix = "bg_"
    if "transitiontime" in data:
        transitiontime = int(data["transitiontime"] * 100)
    for key, value in data.items():
        if key == "on":
            if value:
                payload[cmdPrefix + "set_power"] = ["on", "smooth", transitiontime]
            else:
                payload[cmdPrefix + "set_power"] = ["off", "smooth", transitiontime]
        elif key == "bri":
            payload[cmdPrefix + "set_bright"] = [int(value / 2.55) + 1, "smooth", transitiontime]
        elif key == "ct":
            #if ip[:-3] == "201" or ip[:-3] == "202":
            if light.name.find("desklamp") > 0:
                if value > 369: value = 369
            payload[cmdPrefix + "set_ct_abx"] = [int((-4800/347) * value + 2989900/347), "smooth", transitiontime]
        elif key == "hue":
            payload[cmdPrefix + "set_hsv"] = [int(value / 182), int(light.state["sat"] / 2.54), "smooth", transitiontime]
        elif key == "sat":
            payload[cmdPrefix + "set_hsv"] = [int(light.state["hue"] / 182), int(value / 2.54), "smooth", transitiontime]
        elif key == "xy":
            color = convert_xy(value[0], value[1], light.state["bri"])
            payload[cmdPrefix + "set_rgb"] = [(color[0] * 65536) + (color[1] * 256) + color[2], "smooth", transitiontime] #according to docs, yeelight needs this to set rgb. its r * 65536 + g * 256 + b
        elif key == "alert" and value != "none":
            payload[cmdPrefix + "start_cf"] = [ 4, 0, "1000, 2, 5500, 100, 1000, 2, 5500, 1, 1000, 2, 5500, 100, 1000, 2, 5500, 1"]

    # yeelight uses different functions for each action, so it has to check for each function
    # see page 9 http://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf
    # check if hue wants to change brightness
    for key, value in payload.items():
        c.send_command(key, value)
        sleep(0.4)

def hex_to_rgb(value):
    value = value.lstrip('#')
    lv = len(value)
    tup = tuple(int(value[i:i + lv // 3], 16) for i in range(0, lv, lv // 3))
    return list(tup)


def calculate_color_temp(value):
    return int(-(347/4800) * int(value) +(2989900/4800))

def get_light_state(light):
    c = connect(light)
    state = {}
    light_data = c.get_properties()
    prefix = ''
    if light.protocol_cfg.get("backlight"):
        prefix = "bg_"
    if light_data[prefix + "power"] == "on": #powerstate
        state['on'] = True
    else:
        state['on'] = False

    state["bri"] = int(int(light_data[prefix + "bright"]) * 2.54)

    if light_data["color_mode"] == "1": #rgb mode
        hex_rgb = "%06x" % int(light_data[prefix + "rgb"])
        rgb=hex_to_rgb(hex_rgb)
        state["xy"] = convert_rgb_xy(rgb[0],rgb[1],rgb[2])
        state["colormode"] = "xy"
    elif light_data["color_mode"] == "2": #ct mode
        state["ct"] =  calculate_color_temp(light_data[prefix + "ct"])
        state["colormode"] = "ct"
    elif light_data["color_mode"] == "3": #hs mode
        state["hue"] = int(light_data[prefix + "hue"] * 182)
        state["sat"] = int(light_data[prefix + "sat"] * 2.54)
        state["colormode"] = "hs"
    return state
