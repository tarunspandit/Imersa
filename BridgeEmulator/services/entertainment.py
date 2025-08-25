from time import sleep
import logManager
import configManager
import requests
import socket, json, uuid
from subprocess import Popen, PIPE
from functions.colors import convert_rgb_xy, convert_xy
import paho.mqtt.publish as publish
import time

logging = logManager.logger.get_logger(__name__)
bridgeConfig = configManager.bridgeConfig.yaml_config

cieTolerance = 0.03  # new frames will be ignored if the color change is smaller than this value
briTolerange = 16    # new frames will be ignored if the brightness change is smaller than this value
lastAppliedFrame = {}
YeelightConnections = {}
udp_socket_pool = {}  # Socket pool to prevent creating 600+ sockets/second

# Models that support gradient segments
GRADIENT_MODELS = {"LCX001", "LCX002", "LCX003", "915005987201", "LCX004", "LCX006"}


def skipSimilarFrames(light, color, brightness):
    if light not in lastAppliedFrame:  # check if light exist in dictionary
        lastAppliedFrame[light] = {"xy": [0, 0], "bri": 0}

    if lastAppliedFrame[light]["xy"][0] + cieTolerance < color[0] or color[0] < lastAppliedFrame[light]["xy"][0] - cieTolerance:
        lastAppliedFrame[light]["xy"] = color
        return 2
    if lastAppliedFrame[light]["xy"][1] + cieTolerance < color[1] or color[1] < lastAppliedFrame[light]["xy"][1] - cieTolerance:
        lastAppliedFrame[light]["xy"] = color
        return 2
    if lastAppliedFrame[light]["bri"] + briTolerange < brightness or brightness < lastAppliedFrame[light]["bri"] - briTolerange:
        lastAppliedFrame[light]["bri"] = brightness
        return 1
    return 0


def getObject(v2uuid):
    for key, obj in bridgeConfig["lights"].items():
        if str(uuid.uuid5(uuid.NAMESPACE_URL, obj.id_v2 + 'entertainment')) == v2uuid:
            return obj
    logging.info("element not found!")
    return False


def findGradientStrip(group):
    # Kept for compatibility if you still call it elsewhere
    for light in group.lights:
        if light().modelid in GRADIENT_MODELS:
            return light()
    return None


def get_hue_entertainment_group(light, groupname):
    group = requests.get(
        "http://" + light.protocol_cfg["ip"] + "/api/" + light.protocol_cfg["hueUser"] + "/groups/",
        timeout=3
    )
    groups = json.loads(group.text)
    out = -1
    for i, grp in groups.items():
        if (grp["name"] == groupname) and (grp["type"] == "Entertainment") and (light.protocol_cfg["id"] in grp["lights"]):
            out = i
            logging.debug("Found Corresponding entertainment group with id " + out + " for light " + light.name)
    return int(out)


def entertainmentService(group, user):
    logging.debug("User: " + user.username)
    logging.debug("Key: " + user.client_key)
    bridgeConfig["groups"][group.id_v1].stream["owner"] = user.username
    bridgeConfig["groups"][group.id_v1].state = {"all_on": True, "any_on": True}

    lights_v2 = []
    lights_v1 = {}
    hueGroup = -1
    hueGroupLights = {}
    non_UDP_update_counter = 0

    for light in group.lights:
        lights_v1[int(light().id_v1)] = light()
        if light().protocol == "hue" and get_hue_entertainment_group(light(), group.name) != -1:
            hueGroup = get_hue_entertainment_group(light(), group.name)
            hueGroupLights[int(light().protocol_cfg["id"])] = []  # Add light id to list
        bridgeConfig["lights"][light().id_v1].state["mode"] = "streaming"
        bridgeConfig["lights"][light().id_v1].state["on"] = True
        bridgeConfig["lights"][light().id_v1].state["colormode"] = "xy"

    v2LightNr = {}
    for channel in group.getV2Api()["channels"]:
        lightObj = getObject(channel["members"][0]["service"]["rid"])
        if lightObj.id_v1 not in v2LightNr:
            v2LightNr[lightObj.id_v1] = 0
        else:
            v2LightNr[lightObj.id_v1] += 1
        lights_v2.append({"light": lightObj, "lightNr": v2LightNr[lightObj.id_v1]})

    logging.debug(lights_v1)
    logging.debug(lights_v2)

    opensslCmd = [
        'openssl', 's_server', '-dtls', '-psk', user.client_key,
        '-psk_identity', user.username, '-nocert', '-accept', '2100', '-quiet'
    ]
    p = Popen(opensslCmd, stdin=PIPE, stdout=PIPE, stderr=PIPE)

    if hueGroup != -1:
        h = HueConnection(bridgeConfig["config"]["hue"]["ip"])
        h.connect(hueGroup, hueGroupLights)
        if h._connected is False:
            hueGroupLights = {}  # on a failed connection, empty the list

    init = False
    frameBites = 10
    frameID = 1
    initMatchBytes = 0
    host_ip = bridgeConfig["config"]["ipaddress"]

    # WLED device state (persist across frames for smoothing)
    wledLights = {}

    # FPS windowing
    fps_window_start = time.time()
    frames_in_window = 0

    p.stdout.read(1)  # read one byte so the init function will correctly detect the frameBites
    try:
        while bridgeConfig["groups"][group.id_v1].stream["active"]:
            if not init:
                readByte = p.stdout.read(1)
                logging.debug(readByte)
                if readByte in b'\x48\x75\x65\x53\x74\x72\x65\x61\x6d':  # "HueStream"
                    initMatchBytes += 1
                else:
                    initMatchBytes = 0
                if initMatchBytes == 9:
                    frameBites = frameID - 8
                    logging.debug("frameBites: " + str(frameBites))
                    p.stdout.read(frameBites - 9)  # sync streaming bytes
                    init = True
                frameID += 1
            else:
                data = p.stdout.read(frameBites)
                nativeLights = {}
                esphomeLights = {}
                mqttLights = []
                # Clear wledLights lights list for new frame
                for ip in list(wledLights.keys()):
                    if "lights" in wledLights[ip]:
                        wledLights[ip]["lights"] = []
                haLights = []      # Batch Home Assistant lights
                non_UDP_lights = []
                yeelightAgg = {}

                if data[:9].decode('utf-8') == "HueStream":
                    i = 0
                    apiVersion = 0
                    counter = 0

                    if data[9] == 1:  # api version 1
                        i = 16
                        apiVersion = 1
                        counter = len(data)
                        channels = {}  # v1: light_id -> occurrence index for gradient segments
                    elif data[9] == 2:  # api version 2
                        i = 52
                        apiVersion = 2
                        counter = len(group.getV2Api()["channels"]) * 7 + 52

                    while i < counter:
                        if apiVersion == 1:
                            # device type and ids
                            dev_type = data[i]                # 0=Light (whole device), 1=Gradient point
                            light_id = (data[i+1] << 8) | data[i+2]

                            # occurrence index per frame for gradient mapping
                            if light_id in channels:
                                channels[light_id] += 1
                            else:
                                channels[light_id] = 0
                            seg_index = channels[light_id]

                            # identify light
                            if light_id == 0 or light_id not in lights_v1:
                                break
                            light = lights_v1[light_id]

                            # decode color space
                            if data[14] == 0:  # RGB 16-bit -> 8-bit
                                r = ((data[i+3] << 8) | data[i+4]) >> 8
                                g = ((data[i+5] << 8) | data[i+6]) >> 8
                                b = ((data[i+7] << 8) | data[i+8]) >> 8
                                bri = 0
                                x = y = None
                            else:  # CIE
                                x = ((data[i+3] << 8) | data[i+4]) / 65535.0
                                y = ((data[i+5] << 8) | data[i+6]) / 65535.0
                                bri = ((data[i+7] << 8) | data[i+8]) >> 8
                                r, g, b = convert_xy(x, y, bri)

                            # on/off + state
                            if r == 0 and g == 0 and b == 0:
                                light.state["on"] = False
                            else:
                                if bri == 0:
                                    light.state.update({
                                        "on": True,
                                        "bri": int((r + g + b) / 3),
                                        "xy": convert_rgb_xy(r, g, b),
                                        "colormode": "xy"
                                    })
                                else:
                                    light.state.update({"on": True, "bri": bri, "xy": [x, y], "colormode": "xy"})

                            proto = light.protocol
                            is_gradient_model = light.modelid in GRADIENT_MODELS

                            # NATIVE (UDP 2100)
                            if proto in ["native", "native_multi", "native_single"]:
                                ip = light.protocol_cfg["ip"]
                                if ip not in nativeLights:
                                    nativeLights[ip] = {}

                                if is_gradient_model:
                                    if dev_type == 1:
                                        nativeLights[ip][seg_index] = [r, g, b]
                                    else:
                                        for xseg in range(7):
                                            nativeLights[ip][xseg] = [r, g, b]
                                else:
                                    nativeLights[ip][light.protocol_cfg["light_nr"] - 1] = [r, g, b]

                            # ESPHOME
                            elif proto == "esphome":
                                ip = light.protocol_cfg["ip"]
                                if ip not in esphomeLights:
                                    esphomeLights[ip] = {}
                                esphomeLights[ip]["color"] = [r, g, b, int(max(r, g, b))]

                            # MQTT
                            elif proto == "mqtt":
                                op = skipSimilarFrames(light.id_v1, light.state["xy"], light.state["bri"])
                                if op == 1:
                                    mqttLights.append({
                                        "topic": light.protocol_cfg["command_topic"],
                                        "payload": json.dumps({"brightness": light.state["bri"], "transition": 0.2})
                                    })
                                elif op == 2:
                                    mqttLights.append({
                                        "topic": light.protocol_cfg["command_topic"],
                                        "payload": json.dumps({
                                            "color": {"x": light.state["xy"][0], "y": light.state["xy"][1]},
                                            "transition": 0.15
                                        })
                                    })

                            # YEELIGHT
                            
                            elif proto == "yeelight":
                                ip = light.protocol_cfg["ip"]
                                enableMusic(ip, host_ip)
                                if ip not in yeelightAgg:
                                    yeelightAgg[ip] = {"light": light, "sum_r": 0, "sum_g": 0, "sum_b": 0, "sum_bri": 0, "count": 0}
                                yeelightAgg[ip]["sum_r"] += r
                                yeelightAgg[ip]["sum_g"] += g
                                yeelightAgg[ip]["sum_b"] += b
                                yeelightAgg[ip]["sum_bri"] += light.state["bri"]
                                yeelightAgg[ip]["count"] += 1


                            # WLED (Realtime UDP 21324, DNRGB)
                            elif proto == "wled":
                                ip = light.protocol_cfg["ip"]
                                if ip not in wledLights:
                                    wledLights[ip] = {
                                        "lights": [],
                                        "total_leds": 0,
                                        "udp_port": light.protocol_cfg.get("udp_port", 21324),
                                        "pixel_data": None,
                                        "previous_colors": None,
                                        "decay_factor": 0.85
                                    }

                                seg_start = light.protocol_cfg.get("segment_start", 0)
                                seg_stop = light.protocol_cfg.get("segment_stop", light.protocol_cfg.get("ledCount", 100))
                                led_count = seg_stop - seg_start

                                entry = {
                                    "light": light,
                                    "segment_start": seg_start,
                                    "segment_stop": seg_stop,
                                    "led_count": led_count,
                                    "is_gradient": is_gradient_model,
                                    "color": [r, g, b],
                                    "gradient_points": []
                                }

                                if is_gradient_model:
                                    if dev_type == 1:
                                        entry["gradient_points"].append({"id": seg_index, "color": [r, g, b]})
                                    else:
                                        entry["gradient_points"] = [{"id": 0, "color": [r, g, b]}]

                                wledLights[ip]["lights"].append(entry)
                                wledLights[ip]["total_leds"] = max(wledLights[ip]["total_leds"], seg_stop)

                            # HUE passthrough
                            elif proto == "hue" and int(light.protocol_cfg["id"]) in hueGroupLights:
                                hueGroupLights[int(light.protocol_cfg["id"])] = [r, g, b]

                            # Home Assistant WS (batch)
                            elif proto == "homeassistant_ws":
                                haLights.append({
                                    "light": light,
                                    "data": {"bri": light.state["bri"], "xy": light.state["xy"], "on": light.state["on"]}
                                })

                            else:
                                if light not in non_UDP_lights:
                                    non_UDP_lights.append(light)

                            frameID += 1
                            if frameID == 25:
                                frameID = 1
                            i += 9

                        elif apiVersion == 2:
                            ch_idx = data[i]
                            light = lights_v2[ch_idx]["light"]
                            seg_index = lights_v2[ch_idx]["lightNr"]  # 0..N segment per light

                            if data[14] == 0:
                                r = ((data[i+1] << 8) | data[i+2]) >> 8
                                g = ((data[i+3] << 8) | data[i+4]) >> 8
                                b = ((data[i+5] << 8) | data[i+6]) >> 8
                                bri = 0
                                x = y = None
                            else:
                                x = ((data[i+1] << 8) | data[i+2]) / 65535.0
                                y = ((data[i+3] << 8) | data[i+4]) / 65535.0
                                bri = ((data[i+5] << 8) | data[i+6]) >> 8
                                r, g, b = convert_xy(x, y, bri)

                            if r == 0 and g == 0 and b == 0:
                                light.state["on"] = False
                            else:
                                if bri == 0:
                                    light.state.update({
                                        "on": True,
                                        "bri": int((r + g + b) / 3),
                                        "xy": convert_rgb_xy(r, g, b),
                                        "colormode": "xy"
                                    })
                                else:
                                    light.state.update({"on": True, "bri": bri, "xy": [x, y], "colormode": "xy"})

                            proto = light.protocol
                            is_gradient_model = light.modelid in GRADIENT_MODELS

                            if proto in ["native", "native_multi", "native_single"]:
                                ip = light.protocol_cfg["ip"]
                                if ip not in nativeLights:
                                    nativeLights[ip] = {}
                                if is_gradient_model:
                                    nativeLights[ip][seg_index] = [r, g, b]
                                else:
                                    nativeLights[ip][light.protocol_cfg["light_nr"] - 1] = [r, g, b]

                            elif proto == "esphome":
                                ip = light.protocol_cfg["ip"]
                                if ip not in esphomeLights:
                                    esphomeLights[ip] = {}
                                esphomeLights[ip]["color"] = [r, g, b, int(max(r, g, b))]

                            elif proto == "mqtt":
                                op = skipSimilarFrames(light.id_v1, light.state["xy"], light.state["bri"])
                                if op == 1:
                                    mqttLights.append({
                                        "topic": light.protocol_cfg["command_topic"],
                                        "payload": json.dumps({"brightness": light.state["bri"], "transition": 0.2})
                                    })
                                elif op == 2:
                                    mqttLights.append({
                                        "topic": light.protocol_cfg["command_topic"],
                                        "payload": json.dumps({
                                            "color": {"x": light.state["xy"][0], "y": light.state["xy"][1]},
                                            "transition": 0.15
                                        })
                                    })

                            
                            elif proto == "yeelight":
                                ip = light.protocol_cfg["ip"]
                                enableMusic(ip, host_ip)
                                if ip not in yeelightAgg:
                                    yeelightAgg[ip] = {"light": light, "sum_r": 0, "sum_g": 0, "sum_b": 0, "sum_bri": 0, "count": 0}
                                yeelightAgg[ip]["sum_r"] += r
                                yeelightAgg[ip]["sum_g"] += g
                                yeelightAgg[ip]["sum_b"] += b
                                yeelightAgg[ip]["sum_bri"] += light.state["bri"]
                                yeelightAgg[ip]["count"] += 1


                            elif proto == "wled":
                                ip = light.protocol_cfg["ip"]
                                if ip not in wledLights:
                                    wledLights[ip] = {
                                        "lights": [],
                                        "total_leds": 0,
                                        "udp_port": light.protocol_cfg.get("udp_port", 21324),
                                        "pixel_data": None,
                                        "previous_colors": None,
                                        "decay_factor": 0.85
                                    }

                                seg_start = light.protocol_cfg.get("segment_start", 0)
                                seg_stop = light.protocol_cfg.get("segment_stop", light.protocol_cfg.get("ledCount", 100))
                                led_count = seg_stop - seg_start

                                entry = {
                                    "light": light,
                                    "segment_start": seg_start,
                                    "segment_stop": seg_stop,
                                    "led_count": led_count,
                                    "is_gradient": is_gradient_model,
                                    "color": [r, g, b],
                                    "gradient_points": []
                                }

                                if is_gradient_model:
                                    entry["gradient_points"].append({"id": seg_index, "color": [r, g, b]})

                                wledLights[ip]["lights"].append(entry)
                                wledLights[ip]["total_leds"] = max(wledLights[ip]["total_leds"], seg_stop)

                            elif proto == "hue" and int(light.protocol_cfg["id"]) in hueGroupLights:
                                hueGroupLights[int(light.protocol_cfg["id"])] = [r, g, b]

                            elif proto == "homeassistant_ws":
                                haLights.append({
                                    "light": light,
                                    "data": {"bri": light.state["bri"], "xy": light.state["xy"], "on": light.state["on"]}
                                })

                            else:
                                if light not in non_UDP_lights:
                                    non_UDP_lights.append(light)

                            frameID += 1
                            if frameID == 25:
                                frameID = 1
                            i += 7

                    # === SEND PHASE ===

                    # native UDP 2100
                    if nativeLights:
                        for ip in nativeLights.keys():
                            udpmsg = bytearray()
                            for light_idx, rgb in nativeLights[ip].items():
                                udpmsg += bytes([light_idx]) + bytes([rgb[0]]) + bytes([rgb[1]]) + bytes([rgb[2]])
                            if ip not in udp_socket_pool:
                                udp_socket_pool[ip] = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                            udp_socket_pool[ip].sendto(udpmsg, (ip.split(":")[0], 2100))

                    # esphome UDP 2100 (0 + R + G + B + BRIGHT)
                    if esphomeLights:
                        for ip in esphomeLights.keys():
                            udpmsg = bytearray()
                            c = esphomeLights[ip]["color"]
                            udpmsg += bytes([0]) + bytes([c[0]]) + bytes([c[1]]) + bytes([c[2]]) + bytes([c[3]])
                            if ip not in udp_socket_pool:
                                udp_socket_pool[ip] = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                            udp_socket_pool[ip].sendto(udpmsg, (ip.split(":")[0], 2100))

                    # MQTT batch
                    if mqttLights:
                        auth = None
                        if bridgeConfig["config"]["mqtt"]["mqttUser"] != "" and bridgeConfig["config"]["mqtt"]["mqttPassword"] != "":
                            auth = {
                                'username': bridgeConfig["config"]["mqtt"]["mqttUser"],
                                'password': bridgeConfig["config"]["mqtt"]["mqttPassword"]
                            }
                        publish.multiple(
                            mqttLights,
                            hostname=bridgeConfig["config"]["mqtt"]["mqttServer"],
                            port=bridgeConfig["config"]["mqtt"]["mqttPort"],
                            auth=auth
                        )

                    # WLED DNRGB packet build & send
                    if wledLights:
                        for ip in wledLights.keys():
                            w = wledLights[ip]
                            lights_list = w.get("lights", [])
                            udp_port = w.get("udp_port", 21324)
                            total_leds = w.get("total_leds", 100)
                            previous_colors = w.get("previous_colors")
                            decay_factor = w.get("decay_factor", 0.85)

                            # header + start index (0)
                            udpdata = bytearray(4 + total_leds * 3)
                            udpdata[0] = 4  # DNRGB
                            udpdata[1] = 2  # 2s timeout
                            udpdata[2] = 0
                            udpdata[3] = 0

                            pixel_colors = [[0, 0, 0] for _ in range(total_leds)]

                            # Collect all gradient points from all lights for this WLED device
                            all_gradient_points = []
                            for entry in lights_list:
                                if entry["is_gradient"] and entry.get("gradient_points"):
                                    all_gradient_points.extend(entry["gradient_points"])
                            
                            # Sort all gradient points by ID for consistent ordering
                            all_gradient_points.sort(key=lambda x: x["id"])
                            logging.debug(f"WLED {ip}: Collected {len(all_gradient_points)} gradient points: {all_gradient_points}")

                            # paint segments
                            for entry in lights_list:
                                seg_start = entry["segment_start"]
                                seg_stop = entry["segment_stop"]
                                led_count = entry["led_count"]
                                is_grad = entry["is_gradient"]
                                base_color = entry["color"]
                                
                                # Use all collected gradient points for gradient models
                                gpts = all_gradient_points if is_grad else entry.get("gradient_points", [])

                                if is_grad and gpts:
                                    if len(gpts) == 1:
                                        color = gpts[0]["color"]
                                        for led_idx in range(seg_start, min(seg_stop, total_leds)):
                                            pixel_colors[led_idx] = [color[0], color[1], color[2]]
                                    else:
                                        for led_idx in range(seg_start, min(seg_stop, total_leds)):
                                            local_pos = (led_idx - seg_start) / max(1, led_count - 1)
                                            scaled = local_pos * (len(gpts) - 1)
                                            li = int(scaled)
                                            ui = min(li + 1, len(gpts) - 1)
                                            if li == ui:
                                                color = gpts[li]["color"]
                                                pixel_colors[led_idx] = [color[0], color[1], color[2]]
                                            else:
                                                f = scaled - li
                                                lc = gpts[li]["color"]
                                                uc = gpts[ui]["color"]
                                                r = int(lc[0] + (uc[0] - lc[0]) * f)
                                                g = int(lc[1] + (uc[1] - lc[1]) * f)
                                                b = int(lc[2] + (uc[2] - lc[2]) * f)
                                                pixel_colors[led_idx] = [r, g, b]
                                else:
                                    for led_idx in range(seg_start, min(seg_stop, total_leds)):
                                        pixel_colors[led_idx] = [base_color[0], base_color[1], base_color[2]]

                            # smoothing with previous frame
                            if previous_colors and len(previous_colors) == total_leds:
                                mix = 0.8  # 80% new, 20% old
                                for led_idx in range(total_leds):
                                    pixel_colors[led_idx][0] = int(pixel_colors[led_idx][0] * mix + previous_colors[led_idx][0] * (1 - mix))
                                    pixel_colors[led_idx][1] = int(pixel_colors[led_idx][1] * mix + previous_colors[led_idx][1] * (1 - mix))
                                    pixel_colors[led_idx][2] = int(pixel_colors[led_idx][2] * mix + previous_colors[led_idx][2] * (1 - mix))

                            # fill packet
                            idx = 4
                            for led_idx in range(total_leds):
                                udpdata[idx] = max(0, min(255, pixel_colors[led_idx][0]))
                                udpdata[idx+1] = max(0, min(255, pixel_colors[led_idx][1]))
                                udpdata[idx+2] = max(0, min(255, pixel_colors[led_idx][2]))
                                idx += 3

                            # store for next smoothing
                            wledLights[ip]["previous_colors"] = pixel_colors

                            if ip not in udp_socket_pool:
                                udp_socket_pool[ip] = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                            udp_socket_pool[ip].sendto(udpdata, (ip.split(":")[0], udp_port))

                    # Hue passthrough
                    if hueGroupLights:
                        h.send(hueGroupLights, hueGroup)

                    
                    # Yeelight music-mode batch (average gradient -> single color per bulb)
                    if "yeelightAgg" in locals() and yeelightAgg:
                        for ip, entry in yeelightAgg.items():
                            light = entry["light"]
                            cnt = entry["count"] or 0
                            if cnt <= 0:
                                continue
                            r_avg = int(entry["sum_r"] / cnt)
                            g_avg = int(entry["sum_g"] / cnt)
                            b_avg = int(entry["sum_b"] / cnt)
                            bri_avg = int(entry["sum_bri"] / cnt)
                            try:
                                c = YeelightConnections[ip]
                            except KeyError:
                                enableMusic(ip, host_ip)
                                c = YeelightConnections[ip]
                            # Only send what's changed enough
                            xy = convert_rgb_xy(r_avg, g_avg, b_avg)
                            op = skipSimilarFrames(light.id_v1, xy, bri_avg)
                            if op == 1:
                                c.command("set_bright", [int(bri_avg / 2.55), "smooth", 200])
                            elif op == 2:
                                c.command("set_rgb", [(r_avg * 65536) + (g_avg * 256) + b_avg, "smooth", 200])
    # Home Assistant batch
                    if haLights:
                        from services.homeAssistantWS import homeassistant_ws_client
                        if homeassistant_ws_client and not homeassistant_ws_client.client_terminated:
                            try:
                                homeassistant_ws_client.change_lights_batch(haLights)
                            except Exception as e:
                                logging.debug(f"HA batch update failed: {e}")

                    # Non-UDP fallbacks round-robin
                    if non_UDP_lights:
                        light = non_UDP_lights[non_UDP_update_counter]
                        op = skipSimilarFrames(light.id_v1, light.state["xy"], light.state["bri"])
                        if op == 1:
                            light.setV1State({"bri": light.state["bri"], "transitiontime": 3})
                        elif op == 2:
                            light.setV1State({"xy": light.state["xy"], "transitiontime": 3})
                        non_UDP_update_counter = non_UDP_update_counter + 1 if non_UDP_update_counter < len(non_UDP_lights) - 1 else 0

                    # FPS logging (windowed)
                    frames_in_window += 1
                    now = time.time()
                    if now - fps_window_start >= 1.0:
                        logging.info("Entertainment FPS: %.1f", frames_in_window / (now - fps_window_start))
                        fps_window_start = now
                        frames_in_window = 0

                else:
                    logging.info("HueStream was missing in the frame")
                    p.kill()
                    try:
                        h.disconnect()
                    except UnboundLocalError:
                        pass
    except Exception as e:  # Assuming the only exception is a network timeout
        logging.info("Entertainment Service timed out, stopping server and clearing state: " + str(e))

    p.kill()
    bridgeConfig["groups"][group.id_v1].stream["owner"] = None
    try:
        h.disconnect()
    except UnboundLocalError:
        pass
    bridgeConfig["groups"][group.id_v1].stream["active"] = False
    for light in group.lights:
        bridgeConfig["lights"][light().id_v1].state["mode"] = "homeautomation"

    # Clean up socket pool
    for sock in udp_socket_pool.values():
        try:
            sock.close()
        except:
            pass
    udp_socket_pool.clear()
    logging.info("Entertainment service stopped")


def enableMusic(ip, host_ip):
    if ip in YeelightConnections:
        c = YeelightConnections[ip]
        if not c._music:
            c.enableMusic(host_ip)
    else:
        c = YeelightConnection(ip)
        YeelightConnections[ip] = c
        c.enableMusic(host_ip)


def disableMusic(ip):
    if ip in YeelightConnections:  # Else? LOL
        YeelightConnections[ip].disableMusic()


class YeelightConnection(object):
    _music = False
    _connected = False
    _socket = None
    _host_ip = ""

    def __init__(self, ip):
        self._ip = ip

    def connect(self, simple=False):  # Use simple when you don't need to reconnect music mode
        self.disconnect()  # To clean old socket
        self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._socket.settimeout(5)
        self._socket.connect((self._ip, int(55443)))
        if not simple and self._music:
            self.enableMusic(self._host_ip)
        else:
            self._connected = True

    def disconnect(self):
        self._connected = False
        if self._socket:
            self._socket.close()
        self._socket = None

    def enableMusic(self, host_ip):
        if self._connected and self._music:
            raise AssertionError("Already in music mode!")

        self._host_ip = host_ip

        tempSock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)  # Setup listener
        tempSock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        tempSock.settimeout(5)

        tempSock.bind(("", 0))
        port = tempSock.getsockname()[1]  # Get listener port

        tempSock.listen(3)

        if not self._connected:
            self.connect(True)  # Basic connect for set_music

        self.command("set_music", [1, host_ip, port])  # MAGIC
        self.disconnect()  # Disconnect from basic mode

        while 1:
            try:
                conn, addr = tempSock.accept()
                if addr[0] == self._ip:  # Ignore wrong connections
                    tempSock.close()  # Close listener
                    self._socket = conn  # Replace socket with music one
                    self._connected = True
                    self._music = True
                    break
                else:
                    try:
                        logging.info("Rejecting connection to the music mode listener from %s", self._ip)
                        conn.close()
                    except:
                        pass
            except Exception as e:
                tempSock.close()
                raise ConnectionError("Yeelight with IP {} doesn't want to connect in music mode: {}".format(self._ip, e))

        logging.info("Yeelight device with IP %s is now in music mode", self._ip)

    def disableMusic(self):
        if not self._music:
            return

        if self._socket:
            self._socket.close()
            self._socket = None
        self._music = False
        logging.info("Yeelight device with IP %s is no longer using music mode", self._ip)

    def send(self, data: bytes, flags: int = 0):
        try:
            if not self._connected:
                self.connect()
            self._socket.send(data, flags)
        except Exception as e:
            self._connected = False
            raise e

    def recv(self, bufsize: int, flags: int = 0) -> bytes:
        try:
            if not self._connected:
                self.connect()
            return self._socket.recv(bufsize, flags)
        except Exception as e:
            self._connected = False
            raise e

    def command(self, api_method, param):
        try:
            msg = json.dumps({"id": 1, "method": api_method, "params": param}) + "\r\n"
            self.send(msg.encode())
        except Exception as e:
            logging.warning("Yeelight command error: %s", e)


class HueConnection(object):
    _connected = False
    _ip = ""
    _entGroup = -1
    _connection = ""
    _hueLights = []

    def __init__(self, ip):
        self._ip = ip

    def connect(self, hueGroup, *lights):
        self._entGroup = hueGroup
        self._hueLights = lights
        self.disconnect()

        url = "HTTP://" + str(self._ip) + "/api/" + bridgeConfig["config"]["hue"]["hueUser"] + "/groups/" + str(self._entGroup)
        r = requests.put(url, json={"stream": {"active": True}})
        logging.debug("Outgoing connection to hue Bridge returned: " + r.text)
        try:
            _opensslCmd = [
                'openssl', 's_client', '-quiet', '-cipher', 'PSK-AES128-GCM-SHA256', '-dtls',
                '-psk', bridgeConfig["config"]["hue"]["hueKey"],
                '-psk_identity', bridgeConfig["config"]["hue"]["hueUser"],
                '-connect', self._ip + ':2100'
            ]
            self._connection = Popen(_opensslCmd, stdin=PIPE, stdout=None, stderr=None)  # Open a dtls connection to the Hue bridge
            self._connected = True
            sleep(1)  # Wait a bit to catch errors
            err = self._connection.poll()
            if err is not None:
                raise ConnectionError(err)
        except Exception as e:
            logging.info("Error connecting to Hue bridge for entertainment. Is a proper hueKey set? openssl connection returned: %s", e)
            self.disconnect()

    def disconnect(self):
        try:
            url = "HTTP://" + str(self._ip) + "/api/" + bridgeConfig["config"]["hue"]["hueUser"] + "/groups/" + str(self._entGroup)
            if self._connected:
                self._connection.kill()
            requests.put(url, json={"stream": {"active": False}})
            self._connected = False
        except:
            pass

    def send(self, lights, hueGroup):
        arr = bytearray("HueStream", 'ascii')
        msg = [
            1, 0,  # Api version
            0,     # Sequence number, not needed
            0, 0,  # Zeroes
            0,     # 0: RGB Color space, 1: XY Brightness
            0,     # Zero
        ]
        for id in lights:
            r, g, b = lights[id]
            msg.extend([
                0,     # Type: Light
                0, id, # Light id (v1-type), 16 Bit
                r, r,  # Red (or X) as 16 (2 * 8) bit value
                g, g,  # Green (or Y)
                b, b,  # Blue (or Brightness)
            ])
        arr.extend(msg)
        logging.debug("Outgoing data to other Hue Bridge: " + arr.hex(','))
        try:
            self._connection.stdin.write(arr)
            self._connection.stdin.flush()
        except:
            logging.debug("Reconnecting to Hue bridge to sync. This is normal.")  # Reconnect if the connection timed out
            self.disconnect()
            self.connect(hueGroup)
