import uuid
import logManager
from lights.light_types import lightTypes, archetype
from lights.protocols import protocols
from HueObjects import genV2Uuid, incProcess, v1StateToV2, generate_unique_id, v2StateToV1, StreamEvent
from datetime import datetime, timezone
from copy import deepcopy
from time import sleep

logging = logManager.logger.get_logger(__name__)

class Light():
    def __init__(self, data):
        self.name = data["name"]
        self.modelid = data["modelid"]
        self.id_v1 = data["id_v1"]
        self.id_v2 = data["id_v2"] if "id_v2" in data else genV2Uuid()
        self.uniqueid = data["uniqueid"] if "uniqueid" in data else generate_unique_id()
        self.state = data["state"] if "state" in data else deepcopy(
            lightTypes[self.modelid]["state"])
        self.protocol = data["protocol"] if "protocol" in data else "dummy"
        self.config = data["config"] if "config" in data else deepcopy(
            lightTypes[self.modelid]["config"])
        self.protocol_cfg = data["protocol_cfg"] if "protocol_cfg" in data else {}
        self.streaming = False
        self.dynamics = deepcopy(lightTypes[self.modelid]["dynamics"])
        self.effect = "no_effect"
        self.function = data["function"] if "function" in data else "mixed"

        # entertainment
        streamMessage = {"creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [{"id": str(uuid.uuid5(
                             uuid.NAMESPACE_URL, self.id_v2 + 'entertainment')), "type": "entertainent"}],
                         "id": str(uuid.uuid4()),
                         "type": "add"
                         }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        streamMessage["data"][0].update(self.getV2Entertainment())
        StreamEvent(streamMessage)

        # zigbee_connectivity
        streamMessage = {"creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [self.getZigBee()],
                         "id": str(uuid.uuid4()),
                         "type": "add"
                         }
        StreamEvent(streamMessage)

        # light
        streamMessage = {"creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [self.getV2Api()],
                         "id": str(uuid.uuid4()),
                         "type": "add"
                         }
        StreamEvent(streamMessage)

        # device
        streamMessage = {"creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [self.getDevice()],
                         "id": str(uuid.uuid4()),
                         "type": "add"
                         }
        streamMessage["data"][0].update(self.getDevice())
        StreamEvent(streamMessage)

    def __del__(self):
        ## light ##
        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [{"id": self.id_v2, "type": "light"}],
                         "id": str(uuid.uuid4()),
                         "type": "delete"
                         }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        StreamEvent(streamMessage)

        ## device ##
        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [{"id": self.getDevice()["id"], "type": "device"}],
                         "id": str(uuid.uuid4()),
                         "type": "delete"
                         }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        StreamEvent(streamMessage)

        # Zigbee Connectivity
        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [{"id": self.getZigBee()["id"], "type": "zigbee_connectivity"}],
                         "id": str(uuid.uuid4()),
                         "type": "delete"
                         }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        StreamEvent(streamMessage)

        # Entertainment
        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [{"id": self.getV2Entertainment()["id"], "type": "entertainment"}],
                         "id": str(uuid.uuid4()),
                         "type": "delete"
                         }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        StreamEvent(streamMessage)

        logging.info(self.name + " light was destroyed.")

    def update_attr(self, newdata):
        for key, value in newdata.items():
            updateAttribute = getattr(self, key)
            if isinstance(updateAttribute, dict):
                updateAttribute.update(value)
                setattr(self, key, updateAttribute)
            else:
                setattr(self, key, value)
        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [self.getDevice()],
                         "id": str(uuid.uuid4()),
                         "type": "update"
                         }
        StreamEvent(streamMessage)

    def getV1Api(self):
        result = lightTypes[self.modelid]["v1_static"]
        result["config"] = self.config
        result["state"] = {"on": self.state["on"]}
        if "bri" in self.state and self.modelid not in ["LOM001", "LOM004", "LOM010"]:
            result["state"]["bri"] = int(self.state["bri"]) if self.state["bri"] is not None else 1
        if "ct" in self.state and self.modelid not in ["LOM001", "LOM004", "LOM010", "LTW001", "LLC010"]:
            result["state"]["ct"] = self.state["ct"]
            result["state"]["colormode"] = self.state["colormode"]
        if "xy" in self.state and self.modelid not in ["LOM001", "LOM004", "LOM010", "LTW001", "LWB010"]:
            result["state"]["xy"] = self.state["xy"]
            result["state"]["hue"] = self.state["hue"]
            result["state"]["sat"] = self.state["sat"]
            result["state"]["colormode"] = self.state["colormode"]
        result["state"]["alert"] = self.state["alert"]
        if "mode" in self.state:
            result["state"]["mode"] = self.state["mode"]
        result["state"]["reachable"] = self.state["reachable"]
        result["modelid"] = self.modelid
        result["name"] = self.name
        result["uniqueid"] = self.uniqueid
        return result

    def updateLightState(self, state):

        if "xy" in state and "xy" in self.state:
            self.state["colormode"] = "xy"
        elif "ct" in state and "ct" in self.state:
            self.state["colormode"] = "ct"
        elif ("hue" in state or "sat" in state) and "hue" in self.state:
            self.state["colormode"] = "hs"

    def setV1State(self, state, advertise=True):
        if "lights" not in state:
            state = incProcess(self.state, state)
            self.updateLightState(state)
            for key, value in state.items():
                if key in self.state:
                    self.state[key] = value
                if key in self.config:
                    if key == "archetype":
                        self.config[key] = value.replace("_","")
                    else:
                        self.config[key] = value
                if key == "name":
                    self.name = value
                if key == "function":
                    self.function = value
            if "bri" in state:
                if "min_bri" in self.protocol_cfg and self.protocol_cfg["min_bri"] > state["bri"]:
                    state["bri"] = self.protocol_cfg["min_bri"]
                if "max_bri" in self.protocol_cfg and self.protocol_cfg["max_bri"] < state["bri"]:
                    state["bri"] = self.protocol_cfg["max_bri"]

        if self.protocol not in ["dummy"]:
            for protocol in protocols:
                if "lights.protocols." + self.protocol == protocol.__name__:
                    try:
                        protocol.set_light(self, state)
                        self.state["reachable"] = True
                    except Exception as e:
                        self.state["reachable"] = False
                        logging.warning(self.name + " light error, details: %s", e)
                    return
        if advertise:
            v2State = v1StateToV2(state)
            self.genStreamEvent(v2State)

    def setV2State(self, state):
        v1State = v2StateToV1(state)
        if "effects_v2" in state and "action" in state["effects_v2"]:
            v1State["effect"] = state["effects_v2"]["action"]["effect"]
            self.effect = v1State["effect"]
        if "effects" in state:
            v1State["effect"] = state["effects"]["effect"]
            self.effect = v1State["effect"]
        if "dynamics" in state and "speed" in state["dynamics"]:
            self.dynamics["speed"] = state["dynamics"]["speed"]
        if "metadata" in state:
            if "archetype" in state["metadata"]:
                v1State["archetype"] = state["metadata"]["archetype"]
            if "name" in state["metadata"]:
                v1State["name"] = state["metadata"]["name"]
            if "function" in state["metadata"]:
                v1State["function"] = state["metadata"]["function"]
        self.setV1State(v1State, advertise=False)
        self.genStreamEvent(state)

    def genStreamEvent(self, v2State):
        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [{"id": self.id_v2,"id_v1": "/lights/" + self.id_v1, "type": "light"}],
                         "id": str(uuid.uuid4()),
                         "type": "update"
                         }
        streamMessage["data"][0].update(v2State)
        streamMessage["data"][0].update({"owner": {"rid": self.getDevice()["id"], "rtype": "device"}})
        streamMessage["data"][0].update({"service_id": self.protocol_cfg["light_nr"]-1 if "light_nr" in self.protocol_cfg else 0})
        StreamEvent(streamMessage)
        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "data": [self.getDevice()],
                         "id": str(uuid.uuid4()),
                         "type": "update"
                         }
        StreamEvent(streamMessage)

    def getDevice(self):
        result = {"id": str(uuid.uuid5(
            uuid.NAMESPACE_URL, self.id_v2 + 'device'))}
        result["id_v1"] = "/lights/" + self.id_v1
        result["identify"] = {}
        result["metadata"] = {
            "archetype": archetype[self.config["archetype"]],
            "name": self.name
        }
        result["product_data"] = lightTypes[self.modelid]["device"]
        result["product_data"]["model_id"] = self.modelid
        result["service_id"] = self.protocol_cfg["light_nr"]-1 if "light_nr" in self.protocol_cfg else 0
        result["services"] = [
            {
                "rid": self.id_v2,
                "rtype": "light"
            },
            {
                "rid": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'zigbee_connectivity')),
                "rtype": "zigbee_connectivity"
            },
            {
                "rid": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'entertainment')),
                "rtype": "entertainment"
            }
        ]
        result["type"] = "device"
        return result

    def getZigBee(self):
        result = {}
        result["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL,
                                      self.id_v2 + 'zigbee_connectivity'))
        result["id_v1"] = "/lights/" + self.id_v1
        result["mac_address"] = self.uniqueid[:23]
        result["owner"] = {
            "rid": self.getDevice()["id"],
            "rtype": "device"
        }
        result["status"] = "connected" if self.state["reachable"] else "connectivity_issue"
        result["type"] = "zigbee_connectivity"
        return result

    def getBridgeHome(self):
        return {
            "rid": self.id_v2,
            "rtype": "light"
        }

    def getV2Api(self):
        result = {}
        result["alert"] = {"action_values": ["breathe"]}
        # gradient lights
        if self.modelid in ["LCX002", "915005987201", "LCX004", "LCX006"]:
            result["effects"] = {
                "effect_values": [
                    "no_effect",
                    "candle",
                    "fire"
                ],
                "status": self.effect,
                "status_values": [
                    "no_effect",
                    "candle",
                    "fire"
                ]
            }
            result["gradient"] = {"points": self.state["gradient"]["points"],
                                  "points_capable": self.protocol_cfg["points_capable"]}

        # color lights only
        if self.modelid in ["LST002", "LCT001", "LCT015", "LCX002", "915005987201", "LCX004", "LCX006", "LCA005", "LLC010"]:
            colorgamut = lightTypes[self.modelid]["v1_static"]["capabilities"]["control"]["colorgamut"]
            result["color"] = {
                "gamut": {
                    "blue":  {"x": colorgamut[2][0], "y": colorgamut[2][1]},
                    "green": {"x": colorgamut[1][0], "y": colorgamut[1][1]},
                    "red":   {"x": colorgamut[0][0], "y": colorgamut[0][1]}
                },
                "gamut_type": lightTypes[self.modelid]["v1_static"]["capabilities"]["control"]["colorgamuttype"],
                "xy": {
                    "x": self.state["xy"][0],
                    "y": self.state["xy"][1]
                }
            }
        if "ct" in self.state:
            result["color_temperature"] = {
                "mirek": self.state["ct"] if self.state["colormode"] == "ct" else None,
                "mirek_schema": {
                    "mirek_maximum": 500,
                    "mirek_minimum": 153
                }
            }
            result["color_temperature"]["mirek_valid"] = True if self.state[
                "ct"] != None and self.state["ct"] < 500 and self.state["ct"] > 153 else False
            result["color_temperature_delta"] = {}
        if "bri" in self.state:
            bri_value = self.state["bri"]
            if bri_value is None or bri_value == "null":
                bri_value = 1
            result["dimming"] = {
                "brightness": round(float(bri_value) / 2.54, 2),
                "min_dim_level": 0.1  # Adjust this value as needed
            }
            result["dimming_delta"] = {}
        result["dynamics"] = self.dynamics
        result["effects"] = {
            "effect_values": [
                "no_effect",
                "candle",
                "fire"
            ],
            "status": "no_effect",
            "status_values": [
                "no_effect",
                "candle",
                "fire"
            ]
        }
        result["timed_effects"] = {}
        result["identify"] = {}
        result["id"] = self.id_v2
        result["id_v1"] = "/lights/" + self.id_v1
        result["metadata"] = {"name": self.name, "function": self.function,
                              "archetype": archetype[self.config["archetype"]]}
        result["mode"] = "normal"
        if "mode" in self.state and self.state["mode"] == "streaming":
            result["mode"] = "streaming"
        result["on"] = {
            "on": self.state["on"]
        }
        result["owner"] = {
            "rid": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'device')),
            "rtype": "device"
        }
        result["product_data"] = {"function": "mixed"}
        result["signaling"] = {"signal_values": [
            "no_signal",
            "on_off"]}
        result["powerup"] = {
            "preset": "last_on_state",
            "configured": True,
            "on": {
                 "mode": "on",
                 "on": {
                      "on": True
                }
            },
            "dimming": {
                "mode": "previous"
            }
        }
        result["service_id"] = self.protocol_cfg["light_nr"]-1 if "light_nr" in self.protocol_cfg else 0
        result["type"] = "light"
        return result

    def getV2Entertainment(self):
        entertainmenUuid = str(uuid.uuid5(
            uuid.NAMESPACE_URL, self.id_v2 + 'entertainment'))
        result = {
            "equalizer": True,
            "id": entertainmenUuid,
            "id_v1": "/lights/" + self.id_v1,
            "proxy": lightTypes[self.modelid]["v1_static"]["capabilities"]["streaming"]["proxy"],
            "renderer": lightTypes[self.modelid]["v1_static"]["capabilities"]["streaming"]["renderer"],
            "renderer_reference": {
                "rid": self.id_v2,
                "rtype": "light"
            }
        }
        result["owner"] = {
            "rid": self.getDevice()["id"], "rtype": "device"}
        result["segments"] = {
            "configurable": False
        }
        if self.modelid == "LCX002":
            result["segments"]["max_segments"] = 7
            result["segments"]["segments"] = [
                {
                    "length": 2,
                    "start": 0
                },
                {
                    "length": 2,
                    "start": 2
                },
                {
                    "length": 4,
                    "start": 4
                },
                {
                    "length": 4,
                    "start": 8
                },
                {
                    "length": 4,
                    "start": 12
                },
                {
                    "length": 2,
                    "start": 16
                },
                {
                    "length": 2,
                    "start": 18
                }]
        elif self.modelid in ["915005987201", "LCX004", "LCX006"]:
            result["segments"]["max_segments"] = 10
            result["segments"]["segments"] = [
                {
                    "length": 3,
                    "start": 0
                },
                {
                    "length": 4,
                    "start": 3
                },
                {
                    "length": 3,
                    "start": 7
                }
            ]
        else:
            result["segments"]["max_segments"] = 1
            result["segments"]["segments"] = [{
                "length": 1,
                "start": 0
            }]
        result["type"] = "entertainment"
        return result

    def getObjectPath(self):
        return {"resource": "lights", "id": self.id_v1}

    def dynamicScenePlay(self, palette, index):
        logging.debug("Start Dynamic scene play for " + self.name)
        if "dynamic_palette" in self.dynamics["status_values"]:
            self.dynamics["status"] = "dynamic_palette"
        
        # Check if this is a WLED gradient model that should use palette effect
        is_wled_gradient = (self.protocol == "wled" and 
                           self.modelid in ["LCX002", "915005987201", "LCX004", "LCX006"])
        
        if is_wled_gradient:
            # Use WLED's palette effect for smooth gradient animation
            import requests
            import json
            from functions.colors import convert_xy
            
            logging.info(f"Starting WLED palette effect for {self.name}")
            
            # Get WLED connection info
            ip = self.protocol_cfg["ip"]
            segment_id = self.protocol_cfg.get("segment_id", 0)
            
            # Convert Hue palette colors to WLED custom palette
            wled_colors = []
            if "color" in palette:
                for color_state in palette["color"]:
                    # The palette colors are light states with color info
                    # Extract the actual color from the state
                    if "color" in color_state and "xy" in color_state["color"]:
                        # V2 format: {"color": {"xy": {"x": ..., "y": ...}}}
                        xy = color_state["color"]["xy"]
                        rgb = convert_xy(xy["x"], xy["y"], 255)
                    elif "xy" in color_state:
                        # V1 format fallback: {"xy": [x, y]}
                        rgb = convert_xy(color_state["xy"][0], color_state["xy"][1], 255)
                    else:
                        # Default to white if format unknown
                        logging.warning(f"Unknown color format in palette: {color_state}")
                        rgb = [255, 255, 255]
                    
                    # WLED uses hex colors in format RRGGBB
                    hex_color = '{:02x}{:02x}{:02x}'.format(int(rgb[0]), int(rgb[1]), int(rgb[2]))
                    wled_colors.append(hex_color)
            else:
                # No colors in palette, use default rainbow
                wled_colors = ['ff0000', '00ff00', '0000ff']
                logging.warning(f"No colors found in palette, using defaults")
            
            # Create custom palette string (up to 16 colors)
            # WLED palette format: "RRGGBB,RRGGBB,RRGGBB..."
            palette_string = ','.join(wled_colors[:16])
            
            # Calculate speed for WLED (0-255, where 128 is medium)
            # Hue dynamics speed: 1.0 = slowest, higher = faster
            speed_value = self.dynamics.get("speed", 1.0)
            # Map to WLED speed: 1.0 -> 64 (slow), 5.0 -> 128 (medium), 10.0 -> 192 (fast)
            wled_speed = min(255, int(speed_value * 25.6))
            
            # Get current brightness from tracked state
            from lights.protocols.wled import LightStates
            state_key = f"{ip}_{segment_id}"
            current_brightness = 255
            if state_key in LightStates and "bri" in LightStates[state_key]:
                current_brightness = LightStates[state_key]["bri"]
            
            # Configure WLED to use palette effect
            try:
                # Build the JSON payload for WLED with palette effect and custom colors
                # Convert colors to RGB arrays for WLED
                color_arrays = []
                for hex_color in wled_colors[:3]:  # Use up to 3 colors for the gradient
                    r = int(hex_color[:2], 16)
                    g = int(hex_color[2:4], 16)
                    b = int(hex_color[4:6], 16)
                    color_arrays.append([r, g, b])
                
                # Ensure we have at least 2 colors for a gradient
                if len(color_arrays) < 2:
                    color_arrays.append([255, 0, 0])  # Add red as fallback
                if len(color_arrays) < 2:
                    color_arrays.append([0, 255, 0])  # Add green as second fallback
                
                wled_payload = {
                    "on": True,
                    "bri": current_brightness,
                    "seg": [{
                        "id": segment_id,
                        "fx": 37,  # Palette effect ID
                        "sx": wled_speed,  # Effect speed (0-255)
                        "ix": 128,  # Intensity (medium)
                        "col": color_arrays,  # Set the colors for gradient
                        "pal": 0  # Use default palette (will be overridden by col)
                    }]
                }
                
                response = requests.post(
                    f"http://{ip}/json/state",
                    json=wled_payload,
                    timeout=3
                )
                
                logging.info(f"WLED palette effect configured with speed {wled_speed} and {len(color_arrays)} colors")
                
            except Exception as e:
                logging.error(f"Failed to configure WLED palette effect: {e}")
            
            # Keep the dynamic scene active but don't send continuous updates
            # WLED will handle the animation internally
            while self.dynamics["status"] == "dynamic_palette":
                sleep(1)  # Just check status periodically
            
            # When dynamic scene stops, restore previous state
            try:
                # Turn off the effect
                wled_payload = {
                    "seg": [{
                        "id": segment_id,
                        "fx": 0  # Back to solid effect
                    }]
                }
                requests.post(f"http://{ip}/json/state", json=wled_payload, timeout=3)
                logging.info(f"WLED palette effect stopped for {self.name}")
            except:
                pass
                
        else:
            # Original implementation for non-WLED or non-gradient lights
            while self.dynamics["status"] == "dynamic_palette":
                transition = int(30 / self.dynamics["speed"])
                logging.debug("using transistiontime " + str(transition))
                if self.modelid in ["LCT001", "LCT015", "LST002", "LCX002", "915005987201", "LCX004", "LCX006", "LCA005"]:
                    if index >= len(palette["color"]):
                        index = 0
                    points = []
                    if self.modelid in ["LCX002", "915005987201", "LCX004", "LCX006"]:
                        # for gradient lights - create smooth gradient loop animation
                        points_capable = self.protocol_cfg.get("points_capable", 5)
                        palette_length = len(palette["color"])
                        
                        # Create gradient points by cycling through palette with offset
                        # This creates a smooth loop effect by shifting the gradient pattern
                        for x in range(points_capable):
                            palette_index = (index + x) % palette_length
                            points.append(palette["color"][palette_index])
                        
                        self.setV2State(
                            {"gradient": {"points": points}, "transitiontime": transition})
                    else:
                        if index >= len(palette["color"]):
                            index = 0
                        lightState = palette["color"][index]
                        # based on youtube videos, the transition is slow
                        lightState["transitiontime"] = transition
                        self.setV2State(lightState)
                elif self.modelid == "LTW001":
                    if index == len(palette["color_temperature"]):
                        index = 0
                    lightState = palette["color_temperature"][index]
                    lightState["transitiontime"] = transition
                    self.setV2State(lightState)
                else:
                    if index == len(palette["dimming"]):
                        index = 0
                    lightState = palette["dimming"][index]
                    lightState["transitiontime"] = transition
                    self.setV2State(lightState)
                sleep(transition / 10)
                index += 1
                logging.debug("Step forward dynamic scene " + self.name)
        
        logging.debug("Dynamic Scene " + self.name + " stopped.")

    def save(self):
        result = {"id_v2": self.id_v2, "name": self.name, "modelid": self.modelid, "uniqueid": self.uniqueid, "function": self.function,
                  "state": self.state, "config": self.config, "protocol": self.protocol, "protocol_cfg": self.protocol_cfg}
        return result
