import uuid
import sys
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
        self.state = data["state"] if "state" in data else deepcopy(lightTypes[self.modelid]["state"])
        self.protocol = data["protocol"] if "protocol" in data else "dummy"
        self.config = data["config"] if "config" in data else deepcopy(lightTypes[self.modelid]["config"])
        self.protocol_cfg = data["protocol_cfg"] if "protocol_cfg" in data else {}
        self.streaming = False
        self.dynamics = deepcopy(lightTypes[self.modelid]["dynamics"])
        self.effect = "no_effect"
        self.function = data["function"] if "function" in data else "mixed"

        # entertainment (ADD)
        streamMessage = {
            "creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [{
                "id": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'entertainment')),
                "type": "entertainment"
            }],
            "id": str(uuid.uuid4()),
            "type": "add"
        }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        streamMessage["data"][0].update(self.getV2Entertainment())
        StreamEvent(streamMessage)

        # zigbee_connectivity (ADD)
        streamMessage = {
            "creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [self.getZigBee()],
            "id": str(uuid.uuid4()),
            "type": "add"
        }
        StreamEvent(streamMessage)

        # light (ADD)
        streamMessage = {
            "creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [self.getV2Api()],
            "id": str(uuid.uuid4()),
            "type": "add"
        }
        StreamEvent(streamMessage)

        # device (ADD)
        streamMessage = {
            "creationtime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [self.getDevice()],
            "id": str(uuid.uuid4()),
            "type": "add"
        }
        # (update is redundant but harmless; keep for consistency with your original pattern)
        streamMessage["data"][0].update(self.getDevice())
        StreamEvent(streamMessage)

    def __del__(self):
        try:
            if getattr(sys, 'meta_path', None) is None:
                return
        except Exception:
            return
        ## light ##
        streamMessage = {
            "creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [{"id": self.id_v2, "type": "light"}],
            "id": str(uuid.uuid4()),
            "type": "delete"
        }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        try:
            StreamEvent(streamMessage)
        except Exception:
            pass

        ## device ##
        streamMessage = {
            "creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [{"id": self.getDevice()["id"], "type": "device"}],
            "id": str(uuid.uuid4()),
            "type": "delete"
        }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        try:
            StreamEvent(streamMessage)
        except Exception:
            pass

        # Zigbee Connectivity
        streamMessage = {
            "creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [{"id": self.getZigBee()["id"], "type": "zigbee_connectivity"}],
            "id": str(uuid.uuid4()),
            "type": "delete"
        }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        try:
            StreamEvent(streamMessage)
        except Exception:
            pass

        # Entertainment
        streamMessage = {
            "creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [{"id": self.getV2Entertainment()["id"], "type": "entertainment"}],
            "id": str(uuid.uuid4()),
            "type": "delete"
        }
        streamMessage["id_v1"] = "/lights/" + self.id_v1
        try:
            StreamEvent(streamMessage)
        except Exception:
            pass

        logging.info(self.name + " light was destroyed.")

    def update_attr(self, newdata):
        for key, value in newdata.items():
            updateAttribute = getattr(self, key)
            if isinstance(updateAttribute, dict):
                updateAttribute.update(value)
                setattr(self, key, updateAttribute)
            else:
                setattr(self, key, value)
        streamMessage = {
            "creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
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
        streamMessage = {
            "creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [{"id": self.id_v2, "id_v1": "/lights/" + self.id_v1, "type": "light"}],
            "id": str(uuid.uuid4()),
            "type": "update"
        }
        streamMessage["data"][0].update(v2State)
        streamMessage["data"][0].update({"owner": {"rid": self.getDevice()["id"], "rtype": "device"}})
        streamMessage["data"][0].update({"service_id": self.protocol_cfg["light_nr"]-1 if "light_nr" in self.protocol_cfg else 0})
        StreamEvent(streamMessage)

        streamMessage = {
            "creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "data": [self.getDevice()],
            "id": str(uuid.uuid4()),
            "type": "update"
        }
        StreamEvent(streamMessage)

    def getDevice(self):
        result = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'device'))}
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
            {"rid": self.id_v2, "rtype": "light"},
            {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'zigbee_connectivity')), "rtype": "zigbee_connectivity"},
            {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'entertainment')), "rtype": "entertainment"}
        ]
        result["type"] = "device"
        return result

    def getZigBee(self):
        result = {}
        result["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'zigbee_connectivity'))
        result["id_v1"] = "/lights/" + self.id_v1
        result["mac_address"] = self.uniqueid[:23]
        result["owner"] = {"rid": self.getDevice()["id"], "rtype": "device"}
        result["status"] = "connected" if self.state["reachable"] else "connectivity_issue"
        result["type"] = "zigbee_connectivity"
        return result

    def getBridgeHome(self):
        return {"rid": self.id_v2, "rtype": "light"}

    def getV2Api(self):
        result = {}
        result["alert"] = {"action_values": ["breathe"]}

        # gradient lights
        if self.modelid in ["LCX002", "915005987201", "LCX004", "LCX006"]:
            result["gradient"] = {
                "points": self.state["gradient"]["points"],
                "points_capable": self.protocol_cfg["points_capable"]
            }

        # color-capable lights
        if self.modelid in ["LST002", "LCT001", "LCT015", "LCX002", "915005987201", "LCX004", "LCX006", "LCA005", "LLC010"]:
            colorgamut = lightTypes[self.modelid]["v1_static"]["capabilities"]["control"]["colorgamut"]
            result["color"] = {
                "gamut": {
                    "blue":  {"x": colorgamut[2][0], "y": colorgamut[2][1]},
                    "green": {"x": colorgamut[1][0], "y": colorgamut[1][1]},
                    "red":   {"x": colorgamut[0][0], "y": colorgamut[0][1]}
                },
                "gamut_type": lightTypes[self.modelid]["v1_static"]["capabilities"]["control"]["colorgamuttype"],
                "xy": {"x": self.state["xy"][0], "y": self.state["xy"][1]}
            }

        if "ct" in self.state:
            result["color_temperature"] = {
                "mirek": self.state["ct"] if self.state["colormode"] == "ct" else None,
                "mirek_schema": {"mirek_maximum": 500, "mirek_minimum": 153}
            }
            result["color_temperature"]["mirek_valid"] = (
                self.state["ct"] is not None and 153 < self.state["ct"] < 500
            )
            result["color_temperature_delta"] = {}

        if "bri" in self.state:
            bri_value = self.state["bri"]
            if bri_value is None or bri_value == "null":
                bri_value = 1
            result["dimming"] = {
                "brightness": round(float(bri_value) / 2.54, 2),
                "min_dim_level": 0.1
            }
            result["dimming_delta"] = {}

        result["dynamics"] = self.dynamics

        # Single, final effects block (avoid overwriting earlier)
        result["effects"] = {
            "effect_values": ["no_effect", "candle", "fire"],
            "status": getattr(self, "effect", "no_effect"),
            "status_values": ["no_effect", "candle", "fire"]
        }

        result["timed_effects"] = {}
        result["identify"] = {}
        result["id"] = self.id_v2
        result["id_v1"] = "/lights/" + self.id_v1
        result["metadata"] = {"name": self.name, "function": self.function, "archetype": archetype[self.config["archetype"]]}
        result["mode"] = "streaming" if ("mode" in self.state and self.state["mode"] == "streaming") else "normal"
        result["on"] = {"on": self.state["on"]}
        result["owner"] = {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'device')), "rtype": "device"}
        result["product_data"] = {"function": "mixed"}
        result["signaling"] = {"signal_values": ["no_signal", "on_off"]}
        result["powerup"] = {
            "preset": "last_on_state",
            "configured": True,
            "on": {"mode": "on", "on": {"on": True}},
            "dimming": {"mode": "previous"}
        }
        result["service_id"] = self.protocol_cfg["light_nr"]-1 if "light_nr" in self.protocol_cfg else 0
        result["type"] = "light"
        return result

    def getV2Entertainment(self):
        entertainmenUuid = str(uuid.uuid5(uuid.NAMESPACE_URL, self.id_v2 + 'entertainment'))
        result = {
            "equalizer": True,
            "id": entertainmenUuid,
            "id_v1": "/lights/" + self.id_v1,
            "proxy": lightTypes[self.modelid]["v1_static"]["capabilities"]["streaming"]["proxy"],
            "renderer": lightTypes[self.modelid]["v1_static"]["capabilities"]["streaming"]["renderer"],
            "renderer_reference": {"rid": self.id_v2, "rtype": "light"}
        }
        result["owner"] = {"rid": self.getDevice()["id"], "rtype": "device"}
        result["segments"] = {"configurable": False}
        if self.modelid == "LCX002":
            result["segments"]["max_segments"] = 7
            result["segments"]["segments"] = [
                {"length": 2, "start": 0},
                {"length": 2, "start": 2},
                {"length": 4, "start": 4},
                {"length": 4, "start": 8},
                {"length": 4, "start": 12},
                {"length": 2, "start": 16},
                {"length": 2, "start": 18},
            ]
        elif self.modelid in ["915005987201", "LCX004", "LCX006"]:
            result["segments"]["max_segments"] = 10
            result["segments"]["segments"] = [
                {"length": 3, "start": 0},
                {"length": 4, "start": 3},
                {"length": 3, "start": 7},
            ]
        else:
            result["segments"]["max_segments"] = 1
            result["segments"]["segments"] = [{"length": 1, "start": 0}]
        result["type"] = "entertainment"
        return result

    def getObjectPath(self):
        return {"resource": "lights", "id": self.id_v1}

    def dynamicScenePlay(self, palette, index):
        import requests
        from functions.colors import convert_xy

        logging.debug("Start Dynamic scene play for %s", self.name)
        if "status_values" in self.dynamics and "dynamic_palette" in self.dynamics["status_values"]:
            self.dynamics["status"] = "dynamic_palette"

        # ensure palette is at least an empty dict to avoid key errors
        palette = palette or {}

        is_wled_gradient = (
            self.protocol == "wled"
            and self.modelid in ["LCX002", "915005987201", "LCX004", "LCX006"]
        )

        # -----------------------------
        # WLED gradient path (Palette effect + Set Colors palette)
        # -----------------------------
        if is_wled_gradient:
            ip = self.protocol_cfg["ip"]
            segment_id = self.protocol_cfg.get("segment_id", 0)
            logging.info("Starting WLED palette effect for %s", self.name)

            # Resolve effect/palette IDs robustly (names can move across builds)
            try:
                eff_list = requests.get(f"http://{ip}/json/eff", timeout=3).json()
                pal_list = requests.get(f"http://{ip}/json/pal", timeout=3).json()
                fx_palette_id = next((i for i, n in enumerate(eff_list) if n and n.lower() == "palette"), 65)
                set_colors_pal_id = next((i for i, n in enumerate(pal_list) if n and n.lower().startswith("set colors")), 4)
            except Exception:
                fx_palette_id = 65
                set_colors_pal_id = 4

            # Extract up to 3 RGB colors
            rgb_colors = []
            if isinstance(palette, dict) and "color" in palette:
                for color_state in palette["color"]:
                    if isinstance(color_state, dict):
                        if "color" in color_state and "xy" in color_state["color"]:
                            xy = color_state["color"]["xy"]
                            r, g, b = convert_xy(xy["x"], xy["y"], 255)
                        elif "xy" in color_state and isinstance(color_state["xy"], (list, tuple)) and len(color_state["xy"]) >= 2:
                            r, g, b = convert_xy(color_state["xy"][0], color_state["xy"][1], 255)
                        else:
                            r, g, b = (255, 255, 255)
                        rgb_colors.append([int(r), int(g), int(b)])

            if not rgb_colors:
                rgb_colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255]]

            if len(rgb_colors) > 3:
                idxs = [0, len(rgb_colors)//2, len(rgb_colors)-1]
                rgb_colors = [rgb_colors[i] for i in idxs]
            while len(rgb_colors) < 3:
                rgb_colors.append(rgb_colors[-1])

            # Map Hue dynamics speed (1..12) -> WLED (30..255)
            speed_value = float(self.dynamics.get("speed", 1.0))
            # speed_value = max(1.0, min(12.0, speed_value))
            wled_speed = int(round( (speed_value  * 255 ) * .25))
            intensity = 128

            # Current brightness (optional)
            try:
                from lights.protocols.wled import LightStates
                state_key = f"{ip}_{segment_id}"
                current_brightness = int(LightStates.get(state_key, {}).get("bri", 255))
            except Exception:
                current_brightness = 255

            seg_cfg = {
                "fx": fx_palette_id,
                "sx": wled_speed,
                "ix": intensity,
                "pal": set_colors_pal_id,  # numeric palette id
                "col": rgb_colors,         # 3 color slots for Set Colors
                "c1": 0,                 # stretch
                "c2": 0,                   # rotation
                "c3": 16                   # animate shift
            }
            if segment_id != 0:
                seg_cfg["id"] = segment_id

            # Apply effect (disable live to allow effect control)
            try:
                payload = {"on": True, "bri": current_brightness, "live": False, "seg": [seg_cfg]}
                r = requests.post(f"http://{ip}/json/state", json=payload, timeout=3)
                r.raise_for_status()
                logging.info("Applied WLED Palette effect (speed=%d, pal=%d)", wled_speed, set_colors_pal_id)
                # Pin rotation to zero explicitly
                seg_patch = {"rs": 0}
                if segment_id != 0:
                    seg_patch["id"] = segment_id
                requests.post(f"http://{ip}/json/state",
              json={"seg": [seg_patch]},
              timeout=3)

            except Exception as e:
                logging.error("WLED API error applying effect: %s", e)
                return

            # Idle loop: let WLED animate internally
            try:
                while self.dynamics.get("status") == "dynamic_palette":
                    sleep(1)
            finally:
                # Restore UDP/live mode and solid effect
                try:
                    seg_restore = {"fx": 0}
                    if segment_id != 0:
                        seg_restore["id"] = segment_id
                    restore_payload = {"live": True, "seg": [seg_restore]}
                    requests.post(f"http://{ip}/json/state", json=restore_payload, timeout=3)
                    logging.info("WLED palette effect stopped; live mode restored for %s", self.name)
                except Exception:
                    pass

            logging.debug("Dynamic Scene %s stopped.", self.name)
            return  # end WLED path

        # -----------------------------
        # Non-WLED / generic fallback (original dynamic loop)
        # -----------------------------
        while self.dynamics.get("status") == "dynamic_palette":
            speed = float(self.dynamics.get("speed", 1.0)) or 1.0
            speed = max(0.1, min(12.0, speed))
            transition = int(30 / speed)
            logging.debug("using transitiontime %s", transition)

            if self.modelid in ["LCT001", "LCT015", "LST002", "LCX002", "915005987201", "LCX004", "LCX006", "LCA005"]:
                if "color" not in palette or not palette["color"]:
                    break

                if self.modelid in ["LCX002", "915005987201", "LCX004", "LCX006"]:
                    # gradient loop animation across points
                    points_capable = self.protocol_cfg.get("points_capable", 5)
                    palette_length = len(palette["color"])
                    points = []
                    for x in range(points_capable):
                        palette_index = (index + x) % palette_length
                        points.append(palette["color"][palette_index])
                    self.setV2State({"gradient": {"points": points}, "transitiontime": transition})
                else:
                    if index >= len(palette["color"]):
                        index = 0
                    lightState = dict(palette["color"][index])
                    lightState["transitiontime"] = transition
                    self.setV2State(lightState)

            elif self.modelid == "LTW001":
                if "color_temperature" not in palette or not palette["color_temperature"]:
                    break
                if index >= len(palette["color_temperature"]):
                    index = 0
                lightState = dict(palette["color_temperature"][index])
                lightState["transitiontime"] = transition
                self.setV2State(lightState)

            else:
                if "dimming" not in palette or not palette["dimming"]:
                    break
                if index >= len(palette["dimming"]):
                    index = 0
                lightState = dict(palette["dimming"][index])
                lightState["transitiontime"] = transition
                self.setV2State(lightState)

            sleep(transition / 10)
            index = (index + 1) % 10_000_000
            logging.debug("Step forward dynamic scene %s", self.name)

        logging.debug("Dynamic Scene %s stopped.", self.name)

    def save(self):
        result = {
            "id_v2": self.id_v2,
            "name": self.name,
            "modelid": self.modelid,
            "uniqueid": self.uniqueid,
            "function": self.function,
            "state": self.state,
            "config": self.config,
            "protocol": self.protocol,
            "protocol_cfg": self.protocol_cfg
        }
        return result
