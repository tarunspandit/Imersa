import configManager
import logManager
from HueObjects import Group, EntertainmentConfiguration, Scene, BehaviorInstance, GeofenceClient, SmartScene, StreamEvent
import uuid
import json
import weakref
import requests
from subprocess import Popen
from flask_restful import Resource
from flask import request
from services.entertainment import entertainmentService
from threading import Thread
from time import sleep
from functions.core import nextFreeId
from datetime import datetime, timezone
from functions.scripts import behaviorScripts
from lights.discover import scanForLights
from functions.daylightSensor import daylightSensor

logging = logManager.logger.get_logger(__name__)

bridgeConfig = configManager.bridgeConfig.yaml_config

v2Resources = {"light": {}, "scene": {}, "smart_scene": {}, "grouped_light": {}, "room": {}, "zone": {
}, "entertainment": {}, "entertainment_configuration": {}, "zigbee_connectivity": {}, "zigbee_device_discovery": {}, "device": {}, "device_power": {},
"geofence_client": {}, "motion": {}, "light_level": {}, "temperature": {}, "relative_rotary": {}, "button": {}}


def getObject(element, v2uuid):
    if element in ["behavior_instance"]:
        return bridgeConfig[element][v2uuid]
    elif element in v2Resources and v2uuid in v2Resources[element]:
        logging.debug("Cache Hit for " + element)
        return v2Resources[element][v2uuid]()
    elif element in ["light", "scene", "grouped_light", "smart_scene"]:
        for v1Element in ["lights", "groups", "scenes", "smart_scene"]:
            for key, obj in bridgeConfig[v1Element].items():
                if obj.id_v2 == v2uuid:
                    v2Resources[element][v2uuid] = weakref.ref(obj)
                    logging.debug("Cache Miss " + element)
                    return obj
    elif element in ["entertainment"]:
        for key, obj in bridgeConfig["lights"].items():
            if str(uuid.uuid5(uuid.NAMESPACE_URL, obj.id_v2 + 'entertainment')) == v2uuid:
                v2Resources[element][v2uuid] = weakref.ref(obj)
                return obj
    else:
        for v1Element in ["lights", "groups", "scenes", "sensors", "geofence_clients"]:
            for key, obj in bridgeConfig[v1Element].items():
                if str(uuid.uuid5(uuid.NAMESPACE_URL, obj.id_v2 + element)) == v2uuid:
                    logging.debug("Cache Miss " + element)
                    v2Resources[element][v2uuid] = weakref.ref(obj)
                    return obj
                elif obj.id_v2 == v2uuid:
                    logging.debug("Cache Miss " + element)
                    v2Resources[element][v2uuid] = weakref.ref(obj)
                    return obj
    logging.info("element not found!")
    return False


def authorizeV2(headers):
    if "hue-application-key" in headers and headers["hue-application-key"] in bridgeConfig["apiUsers"]:
        bridgeConfig["apiUsers"][headers["hue-application-key"]
                                 ].last_use_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        return {"user": bridgeConfig["apiUsers"][headers["hue-application-key"]]}
    return []


def _parse_dt_safe(s: str):
    try:
        # Stored as "%Y-%m-%dT%H:%M:%S"
        from datetime import datetime
        return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S")
    except Exception:
        return None


def select_entertainment_user(default_user):
    """Select the best API user to accept Hue Sync DTLS connections.

    Preference order:
    1) Names containing 'sync', 'tv', 'box', or 'entertain' with a client_key
    2) Otherwise, the most recently used user with a client_key
    3) Fallback: the provided default_user
    """
    try:
        users = bridgeConfig.get("apiUsers", {})
        if not users:
            return default_user

        preferred_keywords = ("sync", "tv", "box", "entertain")
        scored = []

        for uname, u in users.items():
            key = getattr(u, 'client_key', None)
            name = (getattr(u, 'name', '') or '').lower()
            if not key:
                continue
            score = 0
            if any(k in name for k in preferred_keywords):
                score += 100
            # Recency by last_use_date
            dt = _parse_dt_safe(getattr(u, 'last_use_date', '') or '')
            ts = dt.timestamp() if dt else 0
            score += int(ts % 1_000_000)  # keep ordering stable
            scored.append((score, u))

        if scored:
            scored.sort(key=lambda x: x[0], reverse=True)
            chosen = scored[0][1]
            if chosen.username != default_user.username:
                logging.info(f"Using entertainment PSK from user '{chosen.name}' ({chosen.username[:8]}...) instead of default")
            return chosen
    except Exception as e:
        logging.debug(f"select_entertainment_user fallback: {e}")
    return default_user

def v2BridgeEntertainment():
    return {"id": "57a9ebc9-406d-4a29-a4ff-42acee9e9be7",
            "owner": {
                "rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'device')),
                "rtype": "device"
                },
            "renderer": False,
            "proxy": True,
            "equalizer": False,
            "max_streams": 1,
            "type": "entertainment"
            }



def v2HomeKit():
    return {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'homekit')),
            "status": "unpaired",
            "status_values": [
                "pairing",
                "paired",
                "unpaired"
            ],
        "type": "homekit"
    }


def v2BridgeZigBee():
    return {"id": str(uuid.uuid5(
        uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'zigbee_connectivity')),
            "owner": {
                "rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'device')),
                "rtype": "device"
                },
            "status": "connected",
            "mac_address": bridgeConfig["config"]["mac"][:8] + ":01:01:" +  bridgeConfig["config"]["mac"][9:],
            "channel": {
                "value": "channel_25",
                "status": "set"
                },
            "type": "zigbee_connectivity"
            }

def v2BridgeZigBeeDiscovery():
    return{"id": str(uuid.uuid5(
        uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'zigbee_device_discovery')),
        "owner": {
            "rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'device')),
            "rtype": "device"
        },
        "action": {
            "action_type_values": [
                "search"
            ]
        },
        "status": bridgeConfig["config"]["zigbee_device_discovery_info"]["status"],
        "type": "zigbee_device_discovery",
        }


def v2GeofenceClient():
    user = authorizeV2(request.headers)
    result = {
      "id": str(uuid.uuid5(uuid.NAMESPACE_URL, request.headers["hue-application-key"])),
      "name": user["user"].name,
      "type": "geofence_client"
    }
    return result


def v2BridgeHome():
    result = {}
    result["children"] = []
    result["children"].append({"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'device')), "rtype": "device"})
    #result["grouped_services"] = []
    #if len(bridgeConfig["lights"]) > 0:
    #    result["grouped_services"].append({
    #        "rid": bridgeConfig["groups"]["0"].id_v2,
    #        "rtype": "grouped_light"
    #    })
    result["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL,
                                  bridgeConfig["groups"]["0"].id_v2 + 'bridge_home'))
    result["id_v1"] = "/groups/0"
    result["services"] = []
    result["type"] = "bridge_home"
    for key, light in bridgeConfig["lights"].items():
        result["services"].append(light.getBridgeHome())
        result["children"].append({"rid": light.getDevice()["id"], "rtype": "device"})
    for key, group in bridgeConfig["groups"].items():
        if group.type == "Room":
            result["children"].append({"rid": group.getV2Room()["id"], "rtype": "room"})
    for key, sensor in bridgeConfig["sensors"].items():
        if sensor.getBridgeHome():
            result["services"].append(sensor.getBridgeHome())
    result["services"].append({"rid": bridgeConfig["groups"]["0"].id_v2 ,"rtype": "grouped_light"})
    return result


def v2Bridge():
    bridge_id = bridgeConfig["config"]["bridgeid"]
    return {
        "bridge_id": bridge_id.lower(),
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'bridge')),
        "id_v1": "",
        "owner": {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'device')), "rtype": "device"},
        "time_zone": {"time_zone": bridgeConfig["config"]["timezone"]},
        "type": "bridge"
    }

def geoLocation():
    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, bridgeConfig["config"]["bridgeid"] + 'geolocation')),
        "is_configured": bridgeConfig["sensors"]["1"].config["configured"],
        "sun_today": {
            "sunset_time": bridgeConfig["sensors"]["1"].config["sunset"] if "lat" in bridgeConfig["sensors"]["1"].protocol_cfg else "",
            "day_type": "normal_day"
        },
        "type": "geolocation"
    }


def v2BridgeDevice():
    config = bridgeConfig["config"]
    bridge_id = config["bridgeid"]
    result = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'device')), "type": "device"}
    result["id_v1"] = ""
    result["metadata"] = {"archetype": "bridge_v2", "name": config["name"]}
    result["identify"] = {}
    result["product_data"] = {
        "certified": True,
        "manufacturer_name": "Signify Netherlands B.V.",
        "model_id": "BSB002",
        "product_archetype": "bridge_v2",
        "product_name": "Philips hue",
        "software_version": config["apiversion"][:5] + config["swversion"]
    }
    result["services"] = [
        {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'bridge')), "rtype": "bridge"},
        {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'zigbee_connectivity')), "rtype": "zigbee_connectivity"},
        {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'zigbee_device_discovery')), "rtype": "zigbee_device_discovery"},
        {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'entertainment')), "rtype": "entertainment"}
    ]
    return result

def v2DiyHueBridge():
    bridge_id = bridgeConfig["config"]["bridgeid"]
    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'diyhue')),
        "id_v1": "",
        "owner": {"rid": str(uuid.uuid5(uuid.NAMESPACE_URL, bridge_id + 'device')), "rtype": "device"},
        "type": "diyhue",
        "hue_essentials_key": bridgeConfig["config"]["Hue Essentials key"], 
        "remote_api_enabled": bridgeConfig["config"]["Remote API enabled"],
        "remote_discovery": bridgeConfig["config"]["discovery"]
    }

class AuthV1(Resource):
    def get(self):
        authorisation = authorizeV2(request.headers)
        if "user" in authorisation:
            logging.debug("Auth 200")
            return {}, 200, {'hue-application-id': request.headers["hue-application-key"]}

        else:
            logging.info("Auth 403")
            return '', 403


class ClipV2(Resource):
    def get(self):
        authorisation = authorizeV2(request.headers)
        if "user" not in authorisation:
            return "", 403
        data = []
        # homekit
        data.append(v2HomeKit())
        # device
        data.append(v2BridgeDevice())
        for key, light in bridgeConfig["lights"].items():
            data.append(light.getDevice())
        for key, sensor in bridgeConfig["sensors"].items():
            if sensor.getDevice() != None:
                data.append(sensor.getDevice())
        # bridge
        data.append(v2Bridge())
        data.append(v2DiyHueBridge())
        # zigbee
        data.append(v2BridgeZigBee())
        for key, light in bridgeConfig["lights"].items():
            data.append(light.getZigBee())
        for key, sensor in bridgeConfig["sensors"].items():
            if sensor.getZigBee() != None:
                data.append(sensor.getZigBee())
        data.append(v2BridgeZigBeeDiscovery())
        # entertainment
        data.append(v2BridgeEntertainment())
        for key, light in bridgeConfig["lights"].items():
            data.append(light.getV2Entertainment())
        # scenes
        for key, scene in bridgeConfig["scenes"].items():
            data.append(scene.getV2Api())
        # smart_scene
        for key, smartscene in bridgeConfig["smart_scene"].items():
            data.append(smartscene.getV2Api())
        # lights
        for key, light in bridgeConfig["lights"].items():
            data.append(light.getV2Api())
        # room
        for key, group in bridgeConfig["groups"].items():
            if group.type == "Room":
                data.append(group.getV2Room())
            elif group.type == "Zone":
                data.append(group.getV2Zone())
        # behavior_instance
        for key, instance in bridgeConfig["behavior_instance"].items():
            data.append(instance.getV2Api())
        # entertainment_configuration
        for key, group in bridgeConfig["groups"].items():
            if group.type == "Entertainment":
                data.append(group.getV2Api())
        # group
            else:
                data.append(group.getV2GroupedLight())
        # bridge home
        data.append(v2BridgeHome())
        data.append(v2GeofenceClient())
        data.append(geoLocation())
        for script in behaviorScripts():
            data.append(script)
        for key, sensor in bridgeConfig["sensors"].items():
            motion = sensor.getMotion()
            if motion != None:
                data.append(motion)
            buttons = sensor.getButtons()
            if len(buttons) != 0:
                for button in buttons:
                    data.append(button)
            power = sensor.getDevicePower()
            if power != None:
                data.append(power)
            rotarys = sensor.getRotary()
            if len(rotarys) != 0:
                for rotary in rotarys:
                    data.append(rotary)
            temperature = sensor.getTemperature()
            if temperature != None:
                data.append(temperature)
            lightlevel = sensor.getLightlevel()
            if lightlevel != None:
                data.append(lightlevel)

        return {"errors": [], "data": data}


class ClipV2Resource(Resource):
    def get(self, resource):
        # logging.debug(request.headers)
        authorisation = authorizeV2(request.headers)
        if "user" not in authorisation:
            return "", 403
        response = {"data": [], "errors": []}
        if resource == "scene":
            for key, scene in bridgeConfig["scenes"].items():
                response["data"].append(scene.getV2Api())
        elif resource == "smart_scene":
            for key, smartscene in bridgeConfig["smart_scene"].items():
                response["data"].append(smartscene.getV2Api())
        elif resource == "light":
            for key, light in bridgeConfig["lights"].items():
                response["data"].append(light.getV2Api())
        elif resource == "room":
            for key, group in bridgeConfig["groups"].items():
                if group.type == "Room":
                    response["data"].append(group.getV2Room())
        elif resource == "zone":
            for key, group in bridgeConfig["groups"].items():
                if group.type == "Zone":
                    response["data"].append(group.getV2Zone())
        elif resource == "grouped_light":
            for key, group in bridgeConfig["groups"].items():
                response["data"].append(group.getV2GroupedLight())
        elif resource == "zigbee_connectivity":
            for key, light in bridgeConfig["lights"].items():
                zigbee = light.getZigBee()
                if zigbee != None:
                    response["data"].append(zigbee)
            for key, sensor in bridgeConfig["sensors"].items():
                zigbee = sensor.getZigBee()
                if zigbee != None:
                    response["data"].append(zigbee)
            response["data"].append(v2BridgeZigBee())  # the bridge
        elif resource == "entertainment":
            for key, light in bridgeConfig["lights"].items():
                response["data"].append(light.getV2Entertainment())
            response["data"].append(v2BridgeEntertainment())
        elif resource == "entertainment_configuration":
            for key, group in bridgeConfig["groups"].items():
                if group.type == "Entertainment":
                    response["data"].append(group.getV2Api())
        elif resource == "device":
            for key, light in bridgeConfig["lights"].items():
                response["data"].append(light.getDevice())
            for key, sensor in bridgeConfig["sensors"].items():
                device = sensor.getDevice()
                if device != None:
                    response["data"].append(device)
            response["data"].append(v2BridgeDevice())  # the bridge
        elif resource == "zigbee_device_discovery":
            response["data"].append(v2BridgeZigBeeDiscovery())
        elif resource == "bridge":
            response["data"].append(v2Bridge())
        elif resource == "diyhue":
            response["data"].append(v2DiyHueBridge())
        elif resource == "bridge_home":
            response["data"].append(v2BridgeHome())
        elif resource == "homekit":
            response["data"].append(v2HomeKit())
        elif resource == "geolocation":
            response["data"].append(geoLocation())
        elif resource == "behavior_instance":
            for key, instance in bridgeConfig["behavior_instance"].items():
                response["data"].append(instance.getV2Api())
        elif resource == "geofence_client":
            response["data"].append(v2GeofenceClient())
        elif resource == "behavior_script":
            for script in behaviorScripts():
                response["data"].append(script)
        elif resource == "motion":
            for key, sensor in bridgeConfig["sensors"].items():
                motion = sensor.getMotion()
                if motion != None:
                    response["data"].append(motion)
        elif resource == "device_power":
            for key, sensor in bridgeConfig["sensors"].items():
                power = sensor.getDevicePower()
                if power != None:
                    response["data"].append(power)
        elif resource == "button":
            for key, sensor in bridgeConfig["sensors"].items():
                buttons = sensor.getButtons()
                if len(buttons) != 0:
                    for button in buttons:
                        response["data"].append(button)
        elif resource == "relative_rotary":
            for key, sensor in bridgeConfig["sensors"].items():
                rotarys = sensor.getRotary()
                if len(rotarys) != 0:
                    for rotary in rotarys:
                        response["data"].append(rotary)
        elif resource == "temperature":
            for key, sensor in bridgeConfig["sensors"].items():
                temperature = sensor.getTemperature()
                if temperature != None:
                    response["data"].append(temperature)
        elif resource == "light_level":
            for key, sensor in bridgeConfig["sensors"].items():
                lightlevel = sensor.getLightlevel()
                if lightlevel != None:
                    response["data"].append(lightlevel)
        else:
            response["errors"].append({"description": "Not Found"})
            del response["data"]

        return response

    def post(self, resource):
        # logging.debug(request.headers)
        authorisation = authorizeV2(request.headers)
        if "user" not in authorisation:
            return "", 403
        postDict = request.get_json(force=True)
        logging.info(postDict)
        newObject = None
        if resource == "scene":
            new_object_id = nextFreeId(bridgeConfig, "scenes")
            objCreation = {
                "id_v1": new_object_id,
                "name": postDict["metadata"]["name"],
                "image": postDict["metadata"]["image"]["rid"] if "image" in postDict["metadata"] else None,
                "owner": bridgeConfig["apiUsers"][request.headers["hue-application-key"]],
            }
            if "group" in postDict:
                objCreation["group"] = weakref.ref(
                    getObject(postDict["group"]["rtype"], postDict["group"]["rid"]))
                objCreation["type"] = "GroupScene"
                del postDict["group"]
            elif "lights" in postDict:
                objCreation["type"] = "LightScene"
                objLights = []
                for light in postDict["lights"]:
                    objLights.append(getObject(light["rtype"], light["rid"]))
                objCreation["lights"] = objLights
            objCreation.update(postDict)
            newObject = Scene.Scene(objCreation)
            bridgeConfig["scenes"][new_object_id] = newObject
            if "actions" in postDict:
                for action in postDict["actions"]:
                    if "target" in action:
                        if action["target"]["rtype"] == "light":
                            lightObj = getObject(
                                "light",  action["target"]["rid"])
                            sceneState = {}
                            scene = action["action"]
                            if "on" in scene:
                                sceneState["on"] = scene["on"]["on"]
                            if "dimming" in scene:
                                sceneState["bri"] = int(
                                    scene["dimming"]["brightness"] * 2.54)
                            if "color" in scene:
                                if "xy" in scene["color"]:
                                    sceneState["xy"] = [
                                        scene["color"]["xy"]["x"], scene["color"]["xy"]["y"]]
                            if "color_temperature" in scene:
                                if "mirek" in scene["color_temperature"]:
                                    sceneState["ct"] = scene["color_temperature"]["mirek"]
                            if "gradient" in scene:
                                sceneState["gradient"] = scene["gradient"]
                            newObject.lightstates[lightObj] = sceneState
        elif resource == "smart_scene":
            new_object_id = nextFreeId(bridgeConfig, "smart_scene")
            objCreation = {
                "id_v1": new_object_id,
                "name": postDict["metadata"]["name"],
                "image": postDict["metadata"]["image"]["rid"] if "image" in postDict["metadata"] else None,
                "action": postDict["recall"]["action"],
                "timeslots": postDict["week_timeslots"][0]["timeslots"],
                "recurrence": postDict["week_timeslots"][0]["recurrence"]
            }
            del postDict["week_timeslots"]
            objCreation.update(postDict)
            newObject = SmartScene.SmartScene(objCreation)
            bridgeConfig["smart_scene"][new_object_id] = newObject
        elif resource == "behavior_instance":
            newObject = BehaviorInstance.BehaviorInstance(postDict)
            bridgeConfig["behavior_instance"][newObject.id_v2] = newObject
        elif resource == "entertainment_configuration":
            new_object_id = nextFreeId(bridgeConfig, "groups")
            objCreation = {
                "id_v1": new_object_id,
                "name": postDict["metadata"]["name"]
            }
            objCreation.update(postDict)
            newObject = EntertainmentConfiguration.EntertainmentConfiguration(objCreation)
            if "locations" in postDict:
                if "service_locations" in postDict["locations"]:
                    for element in postDict["locations"]["service_locations"]:
                        obj = getObject(
                            element["service"]["rtype"], element["service"]["rid"])
                        newObject.add_light(obj)
                        newObject.locations[obj] = element["positions"]
            bridgeConfig["groups"][new_object_id] = newObject
        elif resource in ["room", "zone"]:
            new_object_id = nextFreeId(bridgeConfig, "groups")
            objCreation = {
                "id_v1": new_object_id,
                "name": postDict["metadata"]["name"],
                "owner": bridgeConfig["apiUsers"][request.headers["hue-application-key"]],
            }
            objCreation["type"] = "Room" if resource == "room" else "Zone"
            if "archetype" in postDict["metadata"]:
                objCreation["icon_class"] = postDict["metadata"]["archetype"].replace("_", " ").capitalize()
            objCreation.update(postDict)
            newObject = Group.Group(objCreation)
            if "children" in postDict:
                for children in postDict["children"]:
                    obj = getObject(
                        children["rtype"], children["rid"])
                    newObject.add_light(obj)

            bridgeConfig["groups"][new_object_id] = newObject
        elif resource == 'geofence_client':
            new_object_id = nextFreeId(bridgeConfig, "geofence_clients")
            objCreation = {
                "id_v1": new_object_id,
                "name": postDict["name"],
                "type": "geofence_client",
                "is_at_home": postDict.get("is_at_home", False)
            }
            newObject = GeofenceClient.GeofenceClient(objCreation)
            bridgeConfig["geofence_clients"][new_object_id] = newObject
        else:
            return {
                "errors": [{
                    "description": f"Resource type not supported: {resource}"
                }]
            }, 500

        # return message
        returnMessage = {"data": [{
            "rid": newObject.id_v2,
            "rtype": resource}
        ], "errors": []}

        logging.debug(json.dumps(returnMessage, sort_keys=True, indent=4))
        return returnMessage


class ClipV2ResourceId(Resource):
    def get(self, resource, resourceid):
        # logging.debug(request.headers)
        authorisation = authorizeV2(request.headers)
        if "user" not in authorisation:
            return "", 403
        object = getObject(resource, resourceid)
        if not object:
            return {"errors": [], "data": []}

        if resource in ["scene", "light", "smart_scene"]:
            return {"errors": [], "data": [object.getV2Api()]}
        elif resource == "room":
            return {"errors": [], "data": [object.getV2Room()]}
        elif resource == "zone":
            return {"errors": [], "data": [object.getV2Zone()]}
        elif resource == "grouped_light":
            return {"errors": [], "data": [object.getV2GroupedLight()]}
        elif resource == "device":
            return {"errors": [], "data": [object.getDevice()]}
        elif resource == "zigbee_connectivity":
            return {"errors": [], "data": [object.getZigBee()]}
        elif resource == "zigbee_device_discovery":
            return {"errors": [], "data": [object.getZigBeeDiscovery()]}
        elif resource == "entertainment":
            return {"errors": [], "data": [object.getV2Entertainment()]}
        elif resource == "entertainment_configuration":
            return {"errors": [], "data": [object.getV2Api()]}
        elif resource == "bridge":
            return {"errors": [], "data": [v2Bridge()]}
        elif resource == "motion":
            return {"errors": [], "data": [object.getMotion()]}
        elif resource == "device_power":
            return {"errors": [], "data": [object.getDevicePower()]}
        elif resource == "button":
            return {"errors": [], "data": [object.getButtons()]}
        elif resource == "relative_rotary":
            return {"errors": [], "data": [object.getRotary()]}
        elif resource == "temperature":
            return {"errors": [], "data": [object.getTemperature()]}
        elif resource == "light_level":
            return {"errors": [], "data": [object.getLightlevel()]}

    def put(self, resource, resourceid):
        logging.debug(request.headers)
        authorisation = authorizeV2(request.headers)
        if "user" not in authorisation:
            return "", 403
        putDict = request.get_json(force=True)
        logging.info(putDict)
        object = getObject(resource, resourceid)
        if resource == "light":
            object.setV2State(putDict)
        elif resource == "entertainment_configuration":
            if "action" in putDict:
                if putDict["action"] == "start":
                    logging.info("start hue entertainment")
                    
                    # Kill any existing openssl DTLS server first
                    try:
                        import subprocess
                        # Kill any process on port 2100
                        result = subprocess.run(["lsof", "-ti", ":2100"], capture_output=True, text=True)
                        if result.stdout:
                            for pid in result.stdout.strip().split('\n'):
                                subprocess.run(["kill", "-9", pid])
                                logging.info(f"Killed existing process {pid} on port 2100")
                        # Also kill any openssl processes
                        subprocess.run(["killall", "openssl"], capture_output=True)
                        sleep(0.2)  # Give time for port to be released
                    except:
                        pass
                    
                    # Decide operation mode
                    has_hue = False
                    has_non_hue = False
                    try:
                        for lref in object.lights:
                            p = lref().protocol
                            if p == 'hue':
                                has_hue = True
                            else:
                                has_non_hue = True
                    except Exception:
                        pass
                    use_hybrid = has_hue and has_non_hue

                    # Sync with real Hue bridge FIRST to get matching UUID
                    hue_proxy_mode = False
                    try:
                        from services.entertainment_hue_sync import sync_entertainment_group
                        hue_group_id, entertainment_uuid = sync_entertainment_group(object)
                        
                        if hue_group_id and entertainment_uuid:
                            logging.info(f"✓ Entertainment synced - Group ID: {hue_group_id}, UUID: {entertainment_uuid}")
                            # Store Hue bridge info
                            object.hue_bridge_group_id = hue_group_id
                            object.hue_bridge_uuid = entertainment_uuid
                            
                            # Prepare Hue bridge connectivity
                            if bridgeConfig["config"].get("hue", {}).get("ip"):
                                hue_ip = bridgeConfig["config"]["hue"]["ip"]
                                # Choose the best API user for DTLS PSK (prefer Hue Sync app user)
                                sel_user = select_entertainment_user(authorisation["user"])
                                diyhue_user = sel_user.username
                                diyhue_key = sel_user.client_key
                                if use_hybrid:
                                    logging.info(f"Hybrid mode: will start local entertainment using PSK for '{sel_user.name}' ({diyhue_user[:8]}...)")
                                else:
                                    from services.dtls_bridge import start_dtls_bridge
                                    logging.info(f"DTLS server using PSK for user '{sel_user.name}' ({diyhue_user[:8]}...) ")
                                    if start_dtls_bridge(diyhue_user, diyhue_key, hue_ip, entertainment_uuid):
                                        logging.info(f"✓ DTLS bridge started - bridging to {hue_ip}:2100")
                                        object.dtls_proxy_active = True
                                        hue_proxy_mode = True
                                    else:
                                        logging.warning("Failed to start DTLS bridge - falling back to direct mode")

                                # Start streaming on real bridge (both modes)
                                try:
                                    hue_user = bridgeConfig["config"]["hue"]["hueUser"]
                                    stream_payload = {"stream": {"active": True}}
                                    r = requests.put(
                                        f"http://{hue_ip}/api/{hue_user}/groups/{hue_group_id}",
                                        json=stream_payload,
                                        timeout=3
                                    )
                                    result = r.json() if r.text else {}
                                    if isinstance(result, list):
                                        ok = any("success" in item for item in result)
                                        if ok:
                                            logging.info(f"✓ Started streaming on real bridge group {hue_group_id}")
                                        else:
                                            logging.warning(f"Start streaming response: {result}")
                                    else:
                                        logging.info(f"Bridge stream response: {r.text[:200]}")
                                except Exception as e:
                                    logging.warning(f"Failed to start streaming on real bridge: {e}")
                    except Exception as e:
                        logging.warning(f"Could not sync with Hue bridge: {e}")
                    
                    # Set stream active
                    object.update_attr({"stream": {"active": True, "owner": authorisation["user"].username, "proxymode": "auto", "proxynode": "/bridge"}})
                    
                    # Update light modes
                    for light in object.lights:
                        light().update_attr({"state": {"mode": "streaming"}})
                    
                    # Start local entertainment if hybrid (mixed) or no Hue; otherwise proxy-only
                    if ("use_hybrid" in locals() and use_hybrid) or ("has_hue" in locals() and not has_hue) or not hue_proxy_mode:
                        # Choose Hue Sync user when available (for DTLS PSK on server side)
                        try:
                            start_user = sel_user
                        except NameError:
                            start_user = authorisation["user"]
                        entertainment_thread = Thread(target=entertainmentService, args=[object, start_user])
                        entertainment_thread.daemon = True
                        entertainment_thread.start()
                        sleep(0.1)
                    else:
                        logging.info("DTLS proxy active - not starting local entertainment service")
                    
                elif putDict["action"] == "stop":
                    logging.info("stop entertainment")
                    
                    # Check if using DTLS proxy mode
                    proxy_mode = hasattr(object, 'dtls_proxy_active') and object.dtls_proxy_active
                    
                    # Stop streaming on real bridge if in proxy mode
                    if proxy_mode and hasattr(object, 'hue_bridge_group_id'):
                        try:
                            hue_ip = bridgeConfig["config"]["hue"]["ip"]
                            hue_user = bridgeConfig["config"]["hue"]["hueUser"]
                            # Stop streaming on real bridge - V1 API requires PUT to /groups/{id} with stream payload
                            stream_payload = {"stream": {"active": False}}
                            r = requests.put(
                                f"http://{hue_ip}/api/{hue_user}/groups/{object.hue_bridge_group_id}",
                                json=stream_payload,
                                timeout=3
                            )
                            result = r.json() if r.text else {}
                            if isinstance(result, list):
                                ok = any("success" in item for item in result)
                                if ok:
                                    logging.info(f"✓ Stopped streaming on real bridge group {object.hue_bridge_group_id}")
                                else:
                                    logging.warning(f"Stop streaming response: {result}")
                            else:
                                logging.info(f"Bridge stream stop response: {r.text[:100]}")
                        except Exception as e:
                            logging.warning(f"Failed to stop streaming on real bridge: {e}")
                    
                    # Stop DTLS bridge if running
                    if proxy_mode:
                        try:
                            from services.dtls_bridge import stop_dtls_bridge
                            stop_dtls_bridge()
                            object.dtls_proxy_active = False
                            logging.info("✓ DTLS bridge stopped")
                        except Exception as e:
                            logging.error(f"Error stopping DTLS bridge: {e}")
                    
                    # First set stream to inactive to signal the service to stop gracefully
                    object.update_attr({"stream": {"active": False}})
                    
                    # Update light states
                    for light in object.lights:
                        light().update_attr({"state": {"mode": "homeautomation"}})
                    
                    # Only kill OpenSSL if NOT in proxy mode (local entertainment)
                    if not proxy_mode:
                        # Give the service a moment to stop gracefully before killing OpenSSL
                        sleep(0.5)
                        
                        # Only kill OpenSSL if absolutely necessary (use more targeted approach)
                        try:
                            # Try to kill only the DTLS server on port 2100
                            import subprocess
                            result = subprocess.run(["lsof", "-ti", ":2100"], capture_output=True, text=True)
                            if result.stdout:
                                pid = result.stdout.strip()
                                subprocess.run(["kill", pid])
                                logging.debug(f"Killed OpenSSL process {pid} on port 2100")
                        except:
                            # Fallback to killall if lsof doesn't work
                            try:
                                Popen(["killall", "openssl"])
                            except:
                                pass
        elif resource == "scene":
            if "recall" in putDict:
                object.activate(putDict)
            if "speed" in putDict:
                object.speed = putDict["speed"]
            if "palette" in putDict:
                object.palette = putDict["palette"]
            if "metadata" in putDict:
                object.name = putDict["metadata"]["name"]
        elif resource == "smart_scene":
            if "recall" in putDict and "action" in putDict["recall"]:
                object.activate(putDict)
            if "transition_duration" in putDict:
                object.speed = putDict["transition_duration"]
            if "week_timeslots" in putDict:
                if "timeslots" in putDict["week_timeslots"][0]:
                    object.timeslots = putDict["week_timeslots"][0]["timeslots"]
                if "recurrence" in putDict["week_timeslots"][0]:
                    object.recurrence = putDict["week_timeslots"][0]["recurrence"]
            if "metadata" in putDict:
                object.name = putDict["metadata"]["name"]
        elif resource == "grouped_light":
            object.setV2Action(putDict)
        elif resource == "geolocation":
            bridgeConfig["sensors"]["1"].protocol_cfg = {
                "lat": putDict["latitude"], "long": putDict["longitude"]}
            bridgeConfig["sensors"]["1"].config["configured"] = True
            daylightSensor(bridgeConfig["config"]["timezone"], bridgeConfig["sensors"]["1"])
        elif resource == "behavior_instance":
            object.update_attr(putDict)
        elif resource in ["room", "zone"]:
            v1Api = {}
            if "metadata" in putDict:
                if "name" in putDict["metadata"]:
                    v1Api["name"] = putDict["metadata"]["name"]
                if "archetype" in putDict["metadata"]:
                    v1Api["icon_class"] = putDict["metadata"]["archetype"].replace("_", " ").capitalize()
            if "children" in putDict:
                for children in putDict["children"]:
                    obj = getObject(
                        children["rtype"], children["rid"])
                    object.add_light(obj)
            object.update_attr(v1Api)
        elif resource == 'geofence_client':
            attrs = {}
            if "name" in putDict:
                attrs['name'] = putDict['name']
            if 'is_at_home' in putDict:
                attrs['is_at_home'] = putDict['is_at_home']
            if hasattr(object, 'update_attr') and callable(getattr(object, 'update_attr')):
                object.update_attr(attrs)
        elif resource == "zigbee_device_discovery":
            if putDict["action"]["action_type"] == "search":
                bridgeConfig["config"]["zigbee_device_discovery_info"]["status"] = "active"
                Thread(target=scanForLights).start()
        elif resource == "device":
            if "identify" in putDict and putDict["identify"]["action"] == "identify":
                object.setV1State({"alert": "select"})
            if "metadata" in putDict:
                if "name" in putDict["metadata"]:
                    if object:
                        object.name = putDict["metadata"]["name"]
                    elif resourceid == v2BridgeDevice()["id"]:
                        bridgeConfig["config"]["name"] = putDict["metadata"]["name"]
                        streamMessage = {"creationtime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                                        "data": [{
                                            "id": resourceid,
                                            "metadata": {
                                                "name": bridgeConfig["config"]["name"]
                                                },
                                            "type": "device"
                                        }],
                                        "id": str(uuid.uuid4()),
                                        "type": "update"
                                        }
                        StreamEvent(streamMessage)
                    configManager.bridgeConfig.save_config(backup=False, resource="config")
        elif resource == "motion":
            if "enabled" in putDict:
                object.update_attr({"config": {"on": putDict["enabled"]}})
        else:
            return {
                "errors": [{
                    "description": f"Resource type not supported: {resource}"
                }]
            }, 500

        response = {"data": [{
            "rid": resourceid,
            "rtype": resource
        }]}

        return response

    def delete(self, resource, resourceid):
        # logging.debug(request.headers)
        authorisation = authorizeV2(request.headers)
        if "user" not in authorisation:
            return "", 403
        object = getObject(resource, resourceid)
        
        # Clean up Hue bridge entertainment group if deleting entertainment_configuration
        if resource == "entertainment_configuration" and object:
            try:
                from services.entertainment_hue_sync import delete_hue_entertainment_group
                delete_hue_entertainment_group(object.name)
            except:
                pass  # Don't fail deletion if cleanup fails

        if hasattr(object, 'getObjectPath'):
            del bridgeConfig[object.getObjectPath()["resource"]
                             ][object.getObjectPath()["id"]]
        else:
            del bridgeConfig[resource][resourceid]

        response = {"data": [{
            "rid": resourceid,
            "rtype": resource
        }]}
        return response
