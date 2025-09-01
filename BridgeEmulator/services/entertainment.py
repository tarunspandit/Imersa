from time import sleep
import logManager
import configManager
import requests
import socket, json, uuid
from subprocess import Popen, PIPE
from functions.colors import convert_rgb_xy, convert_xy
import paho.mqtt.publish as publish
import time
from concurrent.futures import ThreadPoolExecutor
from lights.protocols import lifx_native as lifx_protocol
# Using lifx_native for all LIFX functionality
lifx_native_protocol = lifx_protocol
from collections import deque

logging = logManager.logger.get_logger(__name__)
bridgeConfig = configManager.bridgeConfig.yaml_config

# Performance optimization - Use system resource detection
try:
    from functions.system_resources import get_worker_count, get_buffer_size, get_tolerances
    _use_adaptive = True
except ImportError:
    # Fallback if system_resources not available
    def get_worker_count():
        import os
        cpu_count = os.cpu_count() or 1
        return min(4, max(1, cpu_count // 2))
    
    def get_buffer_size():
        return 32768
    
    def get_tolerances():
        return (0.008, 6)  # Default values
    
    _use_adaptive = False

# Adaptive tolerances based on system resources (AFTER imports)
cieTolerance, briTolerange = get_tolerances()
logging.debug(f"Using tolerances - CIE: {cieTolerance}, Brightness: {briTolerange}")

lastAppliedFrame = {}
YeelightConnections = {}
_music_server = None
_yeelight_last_send = {}
_lifx_last_send = {}
udp_socket_pool = {}  # Socket pool to prevent creating 600+ sockets/second

_worker_count = get_worker_count()
executor = ThreadPoolExecutor(max_workers=_worker_count)
logging.info(f"Entertainment service using {_worker_count} worker threads (adaptive: {_use_adaptive})")

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


def _yeelight_tuning():
    music_cfg = bridgeConfig.get("config", {}).get("yeelight", {}).get("music", {})
    max_fps = music_cfg.get("max_fps", 60)  # Increased default from 40
    smooth_ms = music_cfg.get("smooth_ms", 20)  # Reduced default from 60
    # Note: cieTolerance and briTolerange are now set from system resources
    # But can still be overridden in config if needed
    global cieTolerance, briTolerange
    if "cie_tolerance" in music_cfg:
        cieTolerance = float(music_cfg["cie_tolerance"])
    if "bri_tolerance" in music_cfg:
        briTolerange = int(music_cfg["bri_tolerance"])
    # sanitize
    return max(10, int(max_fps)), max(0, int(smooth_ms))


def _lifx_tuning():
    """Get LIFX performance tuning from config.

    Returns (max_fps:int)
    """
    try:
        lifx_cfg = bridgeConfig.get("temp", {}).get("integrations", {}).get("lifx", {})
        if not lifx_cfg:
            lifx_cfg = bridgeConfig.get("config", {}).get("lifx", {})
    except Exception:
        lifx_cfg = {}
    max_fps = lifx_cfg.get("max_fps", 120)
    return max(30, int(max_fps))


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


def entertainmentService(group, user, mirror_port=None):
    """
    Entertainment service with DTLS splitting for mixed light setups.
    
    Architecture:
    - If group contains ANY Hue bulbs: Creates matching group on real Hue bridge
    - Reads DTLS stream from Hue Sync once
    - Forwards raw stream to real Hue bridge for native processing
    - Also processes same stream locally for WLED/Native lights
    - Result: All lights stay perfectly in sync with zero lag
    """
    # Validate inputs
    if not group or not user:
        logging.error("Invalid group or user for entertainment service")
        return
    
    logging.info(f"Starting entertainment service for group {group.id_v1}")
    logging.debug("User: " + user.username)
    logging.debug(f"Key: {user.client_key[:16]}...")  # Only log part of key for security
    
    use_mirror = mirror_port is not None
    
    # Import sync module
    from services.entertainment_hue_sync import sync_entertainment_group
    
    # Ensure stream is marked as active from the start with error handling
    try:
        bridgeConfig["groups"][group.id_v1].stream["active"] = True
        bridgeConfig["groups"][group.id_v1].stream["owner"] = user.username
        bridgeConfig["groups"][group.id_v1].state = {"all_on": True, "any_on": True}
    except Exception as e:
        logging.error(f"Failed to initialize entertainment stream state: {e}")
        return
    
    # Start LIFX entertainment mode for better performance
    try:
        lifx_protocol.start_entertainment_mode()
    except Exception as e:
        logging.debug(f"Could not start LIFX entertainment mode: {e}")
    
    # Start LIFX Native entertainment mode
    try:
        lifx_native_protocol.start_entertainment_mode()
    except Exception as e:
        logging.debug(f"Could not start LIFX Native entertainment mode: {e}")

    lights_v2 = []
    lights_v1 = {}
    non_UDP_update_counter = 0
    
    # Check for Hue lights and sync entertainment group
    hue_lights = []
    has_hue_lights = False
    hue_bridge_group_id = None
    hue_tunnel_process = None
    
    for light in group.lights:
        lights_v1[int(light().id_v1)] = light()
        if light().protocol == "hue":
            hue_lights.append(light())
            has_hue_lights = True
        bridgeConfig["lights"][light().id_v1].state["mode"] = "streaming"
        bridgeConfig["lights"][light().id_v1].state["on"] = True
        bridgeConfig["lights"][light().id_v1].state["colormode"] = "xy"
    
    # If we have ANY Hue lights, sync/create entertainment group on real bridge
    if has_hue_lights:
        logging.info(f"Entertainment group has {len(hue_lights)} Hue lights - syncing with real bridge")
        try:
            hue_bridge_group_id, hue_bridge_group_uuid = sync_entertainment_group(group)
            if hue_bridge_group_id:
                logging.info(f"✓ Synced with Hue bridge group ID: {hue_bridge_group_id}")
                if hue_bridge_group_uuid:
                    logging.info(f"✓ Got Hue bridge entertainment UUID: {hue_bridge_group_uuid}")
                    # CRITICAL: Set DIYHue's group UUID to match the real bridge!
                    group.id_v2 = hue_bridge_group_uuid
                    logging.info(f"✓ Updated DIYHue group UUID to match: {group.id_v2}")
            else:
                logging.warning("Failed to sync with Hue bridge, Hue lights may be laggy")
                has_hue_lights = False  # Disable tunnel mode if sync failed
        except Exception as e:
            logging.error(f"Exception syncing with Hue bridge: {e}")
            has_hue_lights = False  # Disable tunnel mode on error

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

    # Allow OpenSSL binary override (e.g., Homebrew OpenSSL 3 on macOS)
    try:
        openssl_bin = bridgeConfig["config"].get("openssl", {}).get("bin", "openssl")
    except Exception:
        openssl_bin = "openssl"

    p = None
    mirror_sock = None
    if not use_mirror:
        opensslCmd = [
            openssl_bin, 's_server', '-dtls1_2', '-cipher', 'PSK-AES128-GCM-SHA256',
            '-psk', user.client_key,
            '-psk_identity', user.username, '-nocert', '-accept', '2100', '-quiet'
        ]
        logging.info(f"Starting DTLS server on port 2100...")
        try:
            p = Popen(opensslCmd, stdin=PIPE, stdout=PIPE, stderr=PIPE)
            sleep(0.5)
            if p.poll() is not None:
                stderr = p.stderr.read().decode('utf-8') if p.stderr else "No error output"
                logging.error(f"OpenSSL process died immediately: {stderr}")
                bridgeConfig["groups"][group.id_v1].stream["active"] = False
                bridgeConfig["groups"][group.id_v1].stream["owner"] = None
                return
            logging.info("DTLS server started successfully, waiting for client connection...")
        except Exception as e:
            logging.error(f"Failed to start DTLS server: {e}")
            bridgeConfig["groups"][group.id_v1].stream["active"] = False
            bridgeConfig["groups"][group.id_v1].stream["owner"] = None
            return
    else:
        # Mirror mode: listen for decrypted HueStream frames on local UDP
        try:
            mirror_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            mirror_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            mirror_sock.bind(("127.0.0.1", int(mirror_port)))
            mirror_sock.setblocking(False)
            logging.info(f"Mirror mode active: listening on 127.0.0.1:{mirror_port} for HueStream frames")
        except Exception as e:
            logging.error(f"Failed to start mirror UDP listener on {mirror_port}: {e}")
            bridgeConfig["groups"][group.id_v1].stream["active"] = False
            bridgeConfig["groups"][group.id_v1].stream["owner"] = None
            return

    # Setup DTLS tunnel to real Hue bridge if we have Hue lights
    # NOTE: We start the tunnel AFTER we receive the first data from client
    # This ensures proper timing and prevents connection issues

    init = False
    frameBites = 10
    frameID = 1
    initMatchBytes = 0
    host_ip = bridgeConfig["config"]["ipaddress"]

    # WLED device state (persist across frames for smoothing)
    wledLights = {}

    # FPS windowing with performance tracking
    fps_window_start = time.time()
    frames_in_window = 0
    fps_tracker = deque(maxlen=60)
    last_fps_log = time.time()

    # Add frame counter for debugging
    frame_count = 0
    
    # Initialize hue_tunnel_process and flag properly at function scope
    hue_tunnel_process = None
    hue_tunnel_active = False
    
    # Check if stream is still active before entering loop
    if not bridgeConfig["groups"][group.id_v1].stream["active"]:
        logging.warning("Stream was deactivated before entering main loop")
        if p:
            p.kill()
        return
    
    if not use_mirror:
        logging.info("Waiting for initial data from DTLS connection...")
    
    # Wait for initial byte with timeout
    import select
    if not use_mirror:
        ready, _, _ = select.select([p.stdout], [], [], 5.0)  # 5 second timeout
        if ready:
            p.stdout.read(1)  # read one byte so the init function will correctly detect the frameBites
            logging.info("Initial byte received, entering main loop")
        else:
            logging.warning("No data received from DTLS within 5 seconds")
    else:
        logging.info("Entering main loop in mirror mode")
    
    logging.info(f"Entering main entertainment loop (hue_tunnel={hue_tunnel_active}, mirror={use_mirror})")
    try:
        while bridgeConfig["groups"][group.id_v1].stream["active"]:
            if not use_mirror and not init:
                # Check if we should still be running
                if not bridgeConfig["groups"][group.id_v1].stream["active"]:
                    logging.info("Stream deactivated during initialization")
                    break
                    
                readByte = p.stdout.read(1)
                if not readByte:
                    logging.warning("EOF during initialization")
                    break
                    
                logging.debug(f"Init byte {frameID}: {readByte.hex() if readByte else 'None'}")
                if readByte in b'\x48\x75\x65\x53\x74\x72\x65\x61\x6d':  # "HueStream"
                    initMatchBytes += 1
                else:
                    initMatchBytes = 0
                if initMatchBytes == 9:
                    frameBites = frameID - 8
                    logging.info(f"✓ HueStream header detected! Frame size: {frameBites} bytes - Connection established")
                    # Read the rest of the first frame
                    first_frame_remainder = p.stdout.read(frameBites - 9)
                    # Reconstruct the complete first frame for later forwarding
                    first_frame = b'HueStream' + first_frame_remainder
                    init = True
                    # Ensure stream is still marked as active
                    bridgeConfig["groups"][group.id_v1].stream["active"] = True
                    
                    # NOW setup Hue bridge tunnel after we know client is connected
                    if has_hue_lights and hue_bridge_group_id and not hue_tunnel_process and not hue_tunnel_active:
                        try:
                            hue_ip = bridgeConfig["config"]["hue"]["ip"]
                            hue_user = bridgeConfig["config"]["hue"]["hueUser"]
                            hue_cfg = bridgeConfig["config"].get("hue", {})
                            hue_key = hue_cfg.get("hueClientKey") or hue_cfg.get("hueKey") or hue_user
                            
                            logging.info(f"Activating entertainment on Hue bridge group {hue_bridge_group_id}")
                            
                            # Enable streaming on real Hue bridge
                            # CRITICAL: Must activate stream BEFORE opening DTLS connection!
                            url = f"http://{hue_ip}/api/{hue_user}/groups/{hue_bridge_group_id}"
                            # Forward complete stream configuration from DIYHue group
                            stream_data = {
                                "stream": {
                                    "active": True,
                                    "owner": hue_user,  # Must use the Hue bridge user
                                    "proxymode": "auto",
                                    "proxynode": "/bridge"
                                }
                            }
                            try:
                                r = requests.put(url, json=stream_data, timeout=3)
                                result = r.json()
                                logging.debug(f"Stream activation response: {result}")
                            except requests.exceptions.RequestException as e:
                                logging.error(f"Failed to activate Hue bridge stream: {e}")
                                result = []
                            
                            # Check if stream was activated (even partial success is OK)
                            hue_stream_active = False
                            if isinstance(result, list):
                                for item in result:
                                    if "success" in item and "stream/active" in str(item):
                                        hue_stream_active = True
                                        break
                                    elif "error" in item:
                                        err_desc = item.get("error", {}).get("description", "Unknown error")
                                        logging.warning(f"Hue bridge error: {err_desc}")
                            
                            if hue_stream_active:
                                logging.info(f"✓ Hue bridge streaming activated for group {hue_bridge_group_id}")
                                # The group UUID was already updated during sync
                            else:
                                # Streaming might already be active (started by API layer); continue anyway
                                logging.warning(f"Hue bridge stream activation uncertain: {result[:200] if result else 'No response'} - proceeding to tunnel")
                            
                            if hue_bridge_group_id:
                                # Now create DTLS tunnel using Python client
                                logging.info(f"Creating DTLS tunnel to Hue bridge at {hue_ip}:2100")
                                logging.debug(f"Using PSK identity: {hue_user}, PSK key: {hue_key[:16]}...")
                                
                                # Use Python DTLS client for better stability
                                from services.dtls_client import create_hue_tunnel
                                
                                hue_tunnel_process = create_hue_tunnel(
                                    host=hue_ip,
                                    port=2100,
                                    psk_identity=hue_user,
                                    psk_key=hue_key
                                )
                                
                                if hue_tunnel_process and hue_tunnel_process.connected:
                                    logging.info(f"✓ DTLS tunnel established to Hue bridge at {hue_ip}")
                                    hue_tunnel_active = True
                                    
                                    # Send the first frame after a small delay
                                    sleep(0.5)  # Give DTLS time to stabilize
                                    try:
                                        if 'first_frame' in locals() and first_frame:
                                            # Replace UUID in first frame if needed
                                            if len(first_frame) >= 52 and first_frame[9] == 2:
                                                packet_uuid = first_frame[16:52].decode('ascii', errors='ignore')
                                                logging.info(f"First frame UUID: {packet_uuid}")
                                                logging.info(f"Real bridge UUID: {group.id_v2}")
                                                if packet_uuid != group.id_v2:
                                                    # Replace UUID with real bridge's UUID
                                                    first_frame = first_frame[:16] + group.id_v2.encode('ascii') + first_frame[52:]
                                                    logging.info(f"✓ Replaced UUID in first frame")
                                            
                                            if not hue_tunnel_process.send_packet(first_frame):
                                                logging.warning("Failed to send first frame")
                                            else:
                                                logging.info(f"✓ Sent initial frame ({len(first_frame)} bytes)")
                                        else:
                                            logging.warning("No first_frame captured during init")
                                    except Exception as e:
                                        logging.error(f"Failed to send initial frame: {e}")
                                    
                                    logging.info("✓ DTLS tunnel ready for streaming")
                                else:
                                    # Connection failed
                                    logging.error("DTLS tunnel connection failed")
                                    logging.error("Check that entertainment is not already active on Hue bridge")
                                    
                                    hue_tunnel_process = None
                                    hue_tunnel_active = False
                        except Exception as e:
                            logging.error(f"Failed to setup Hue bridge tunnel: {e}")
                            import traceback
                            logging.debug(traceback.format_exc())
                            hue_tunnel_process = None
                            hue_tunnel_active = False
                    
                frameID += 1
            else:
                if use_mirror:
                    # Read datagram from local mirror
                    import select as _select
                    r, _, _ = _select.select([mirror_sock], [], [], 0.5)
                    if not r:
                        continue
                    try:
                        data, _addr = mirror_sock.recvfrom(65536)
                    except Exception:
                        continue
                else:
                    data = p.stdout.read(frameBites)
                
                # DTLS SPLITTING: Forward COMPLETE packet to Hue bridge (header + data)
                if hue_tunnel_active and hue_tunnel_process:
                    try:
                        # Check if process is still alive
                        if hue_tunnel_process.connected:
                            # Debug logging for first frames
                            if frame_count <= 10:
                                logging.debug(f"Frame {frame_count + 1}: Tunnel active, forwarding {len(data)} bytes")
                            # Replace UUID in packet if needed before forwarding
                            if len(data) >= 52 and data[9] == 2:  # V2 protocol with UUID
                                # Extract UUID from packet (bytes 16-52)
                                packet_uuid = data[16:52].decode('ascii', errors='ignore')
                                
                                # Only log first few packets
                                if frame_count <= 5:
                                    logging.debug(f"Packet UUID: {packet_uuid}")
                                    logging.debug(f"Bridge UUID: {group.id_v2}")
                                
                                # If UUIDs don't match, replace it
                                if packet_uuid != group.id_v2:
                                    # Replace the UUID in the packet with the real bridge's UUID
                                    modified_data = data[:16] + group.id_v2.encode('ascii') + data[52:]
                                    data = modified_data
                                    if frame_count <= 5:
                                        logging.info(f"Replaced UUID in packet for Hue bridge")
                            
                            # Debug logging for first few frames
                            if frame_count <= 5:
                                version = data[9] if len(data) > 9 else 0
                                logging.info(f"Frame {frame_count}: Proxying packet ({len(data)} bytes, v{version}) to Hue bridge")
                                if frame_count == 1 and version == 2 and len(data) >= 52:
                                    uuid_in_packet = data[16:52].decode('ascii', errors='ignore')
                                    logging.info(f"UUID in packet: {uuid_in_packet}")
                                    logging.info(f"Expected UUID: {group.id_v2}")
                                    if uuid_in_packet == group.id_v2:
                                        logging.info("✓ UUID matches - packets will work with real bridge!")
                            
                            # Send the packet (with replaced UUID if it was modified)
                            if not hue_tunnel_process.send_packet(data):
                                logging.warning("Failed to send packet to Hue bridge")
                                hue_tunnel_active = False
                            
                            # Log successful forwarding periodically
                            if frame_count % 500 == 0:
                                logging.debug(f"Proxied {frame_count} frames to Hue bridge")
                        else:
                            # Tunnel process died
                            exit_code = -1
                            logging.error(f"DTLS tunnel process died with exit code {exit_code}")
                            
                            # Try to get error output (non-blocking)
                            try:
                                import select
                                # Python client doesn't have stderr
                                pass
                            except:
                                pass
                            
                            hue_tunnel_active = False
                            hue_tunnel_process = None
                    except BrokenPipeError:
                        # The tunnel is dead
                        logging.error("DTLS tunnel broken pipe - Hue bridge connection lost")
                        hue_tunnel_active = False
                        hue_tunnel_process = None
                    except Exception as e:
                        if frame_count % 100 == 0:  # Don't spam logs
                            logging.warning(f"Failed to forward to Hue bridge: {e}")
                
                nativeLights = {}
                esphomeLights = {}
                mqttLights = []
                lifxLights = {}    # Collect LIFX zones for batch processing
                # Clear wledLights lights list for new frame
                for ip in list(wledLights.keys()):
                    if "lights" in wledLights[ip]:
                        wledLights[ip]["lights"] = []
                haLights = []      # Batch Home Assistant lights
                non_UDP_lights = []
                # Yeelight music mode is handled inline per-light below

                frame_count += 1
                if frame_count % 100 == 0:  # Log every 100 frames
                    logging.debug(f"Processed {frame_count} frames")
                    
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

                            # YEELIGHT (music mode inline)
                            elif proto == "yeelight":
                                ip = light.protocol_cfg["ip"]
                                enableMusic(ip, host_ip)
                                c = YeelightConnections[ip]
                                op = skipSimilarFrames(light.id_v1, light.state["xy"], light.state["bri"])
                                max_fps, smooth_ms = _yeelight_tuning()
                                now = time.time()
                                last = _yeelight_last_send.get(ip, 0)
                                min_interval = 1.0 / max_fps
                                if now - last < min_interval:
                                    pass
                                else:
                                    if op == 1:
                                        c.command("set_bright", [int(light.state["bri"] / 2.55), "smooth", smooth_ms])
                                        _yeelight_last_send[ip] = now
                                    elif op == 2:
                                        c.command("set_rgb", [(r * 65536) + (g * 256) + b, "smooth", smooth_ms])
                                        _yeelight_last_send[ip] = now


                            # LIFX (native LAN protocol with zone support)
                            elif proto == "lifx" or proto == "lifx_native":
                                # Respect runtime integration toggle
                                try:
                                    lifx_rt = bridgeConfig.get("temp", {}).get("integrations", {}).get("lifx", {})
                                    if lifx_rt.get("enabled") is False:
                                        raise Exception("LIFX disabled")
                                except Exception:
                                    pass
                                
                                key = light.protocol_cfg.get("id") or light.protocol_cfg.get("ip")
                                if key:
                                    if key not in lifxLights:
                                        lifxLights[key] = {
                                            "light": light,
                                            "zones": {},  # zone_index -> (r, g, b)
                                            "gradient_points": [],
                                            "is_gradient": is_gradient_model,
                                            "points_capable": light.protocol_cfg.get("points_capable", 0)
                                        }
                                    
                                    # Collect gradient points for gradient-capable devices
                                    if is_gradient_model:
                                        # In API v1, dev_type==1 means gradient point
                                        # In API v2, seg_index > 0 typically means additional segments
                                        is_gradient_point = (apiVersion == 1 and 'dev_type' in locals() and dev_type == 1) or \
                                                           (apiVersion == 2 and seg_index > 0)
                                        
                                        if is_gradient_point:  # Gradient point
                                            lifxLights[key]["gradient_points"].append({
                                                "id": seg_index,
                                                "color": [r, g, b]
                                            })
                                        else:  # Whole device color or first segment
                                            lifxLights[key]["zones"][0] = [r, g, b]
                                            # For API v2, collect as first gradient point
                                            if apiVersion == 2:
                                                lifxLights[key]["gradient_points"].append({
                                                    "id": seg_index,
                                                    "color": [r, g, b]
                                                })
                                            else:
                                                lifxLights[key]["gradient_points"] = [{"id": 0, "color": [r, g, b]}]
                                    else:
                                        # Non-gradient device - single color
                                        lifxLights[key]["zones"][0] = [r, g, b]

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
                            elif proto == "hue":
                                # Skip Hue lights entirely - they're handled by the real bridge via DTLS tunnel
                                pass

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
                                c = YeelightConnections[ip]
                                op = skipSimilarFrames(light.id_v1, light.state["xy"], light.state["bri"])
                                max_fps, smooth_ms = _yeelight_tuning()
                                now = time.time()
                                last = _yeelight_last_send.get(ip, 0)
                                min_interval = 1.0 / max_fps
                                if now - last < min_interval:
                                    pass
                                else:
                                    if op == 1:
                                        c.command("set_bright", [int(light.state["bri"] / 2.55), "smooth", smooth_ms])
                                        _yeelight_last_send[ip] = now
                                    elif op == 2:
                                        c.command("set_rgb", [(r * 65536) + (g * 256) + b, "smooth", smooth_ms])
                                        _yeelight_last_send[ip] = now

                            # LIFX (native LAN protocol with zone support)
                            elif proto == "lifx" or proto == "lifx_native":
                                # Respect runtime integration toggle
                                try:
                                    lifx_rt = bridgeConfig.get("temp", {}).get("integrations", {}).get("lifx", {})
                                    if lifx_rt.get("enabled") is False:
                                        raise Exception("LIFX disabled")
                                except Exception:
                                    pass
                                
                                key = light.protocol_cfg.get("id") or light.protocol_cfg.get("ip")
                                if key:
                                    if key not in lifxLights:
                                        lifxLights[key] = {
                                            "light": light,
                                            "zones": {},  # zone_index -> (r, g, b)
                                            "gradient_points": [],
                                            "is_gradient": is_gradient_model,
                                            "points_capable": light.protocol_cfg.get("points_capable", 0)
                                        }
                                    
                                    # Collect gradient points for gradient-capable devices
                                    if is_gradient_model:
                                        # In API v1, dev_type==1 means gradient point
                                        # In API v2, seg_index > 0 typically means additional segments
                                        is_gradient_point = (apiVersion == 1 and 'dev_type' in locals() and dev_type == 1) or \
                                                           (apiVersion == 2 and seg_index > 0)
                                        
                                        if is_gradient_point:  # Gradient point
                                            lifxLights[key]["gradient_points"].append({
                                                "id": seg_index,
                                                "color": [r, g, b]
                                            })
                                        else:  # Whole device color or first segment
                                            lifxLights[key]["zones"][0] = [r, g, b]
                                            # For API v2, collect as first gradient point
                                            if apiVersion == 2:
                                                lifxLights[key]["gradient_points"].append({
                                                    "id": seg_index,
                                                    "color": [r, g, b]
                                                })
                                            else:
                                                lifxLights[key]["gradient_points"] = [{"id": 0, "color": [r, g, b]}]
                                    else:
                                        # Non-gradient device - single color
                                        lifxLights[key]["zones"][0] = [r, g, b]

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

                            elif proto == "hue":
                                # Skip Hue lights entirely - they're handled by the real bridge via DTLS tunnel
                                pass

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

                    # native UDP 2100 - Optimized
                    if nativeLights:
                        for ip in nativeLights.keys():
                            udpmsg = bytearray()
                            for light_idx, rgb in nativeLights[ip].items():
                                udpmsg += bytes([light_idx]) + bytes([rgb[0]]) + bytes([rgb[1]]) + bytes([rgb[2]])
                            if ip not in udp_socket_pool:
                                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                buffer_size = get_buffer_size()
                                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, buffer_size)
                                sock.setblocking(False)
                                udp_socket_pool[ip] = sock
                            try:
                                udp_socket_pool[ip].sendto(udpmsg, (ip.split(":")[0], 2100))
                            except:
                                pass

                    # esphome UDP 2100 (0 + R + G + B + BRIGHT) - Optimized
                    if esphomeLights:
                        for ip in esphomeLights.keys():
                            udpmsg = bytearray()
                            c = esphomeLights[ip]["color"]
                            udpmsg += bytes([0]) + bytes([c[0]]) + bytes([c[1]]) + bytes([c[2]]) + bytes([c[3]])
                            if ip not in udp_socket_pool:
                                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                buffer_size = get_buffer_size()
                                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, buffer_size)
                                sock.setblocking(False)
                                udp_socket_pool[ip] = sock
                            try:
                                udp_socket_pool[ip].sendto(udpmsg, (ip.split(":")[0], 2100))
                            except:
                                pass

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
                            udpdata[1] = 255  # No timeout for instant response
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
                                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                buffer_size = get_buffer_size()
                                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, buffer_size)
                                sock.setblocking(False)
                                udp_socket_pool[ip] = sock
                            try:
                                udp_socket_pool[ip].sendto(udpdata, (ip.split(":")[0], udp_port))
                            except:
                                pass

                    # LIFX zone/gradient processing
                    if lifxLights:
                        max_fps = _lifx_tuning()
                        min_interval = 1.0 / max_fps
                        now_ts = time.time()
                        
                        for key, data in lifxLights.items():
                            # Check frame rate limit
                            last_ts = _lifx_last_send.get(key, 0)
                            if now_ts - last_ts < min_interval:
                                continue
                                
                            light = data["light"]
                            points_capable = data["points_capable"]
                            gradient_points = data["gradient_points"]
                            zones = data["zones"]
                            
                            try:
                                if points_capable > 0 and gradient_points:
                                    # Device supports zones/gradient
                                    # Sort gradient points by ID
                                    gradient_points.sort(key=lambda x: x["id"])
                                    
                                    # Build zone colors array
                                    zone_colors = []
                                    
                                    # If we have multiple gradient points, interpolate between them
                                    if len(gradient_points) > 1:
                                        # Map gradient points to zones
                                        for i in range(points_capable):
                                            # Find position in gradient (0.0 to 1.0)
                                            position = i / max(1, points_capable - 1)
                                            
                                            # Find surrounding gradient points
                                            for j in range(len(gradient_points) - 1):
                                                pt1_pos = gradient_points[j]["id"] / max(1, len(gradient_points) - 1)
                                                pt2_pos = gradient_points[j + 1]["id"] / max(1, len(gradient_points) - 1)
                                                
                                                if pt1_pos <= position <= pt2_pos:
                                                    # Interpolate between these two points
                                                    if pt2_pos - pt1_pos > 0:
                                                        t = (position - pt1_pos) / (pt2_pos - pt1_pos)
                                                    else:
                                                        t = 0
                                                    
                                                    r1, g1, b1 = gradient_points[j]["color"]
                                                    r2, g2, b2 = gradient_points[j + 1]["color"]
                                                    
                                                    r = int(r1 + (r2 - r1) * t)
                                                    g = int(g1 + (g2 - g1) * t)
                                                    b = int(b1 + (b2 - b1) * t)
                                                    
                                                    zone_colors.append((r, g, b))
                                                    break
                                            else:
                                                # Use last color for remaining zones
                                                if gradient_points:
                                                    zone_colors.append(tuple(gradient_points[-1]["color"]))
                                    else:
                                        # Single gradient point - use it for all zones
                                        color = tuple(gradient_points[0]["color"])
                                        zone_colors = [color] * points_capable
                                    
                                    # Send zones to device
                                    if light.protocol == "lifx":
                                        lifx_protocol.send_rgb_zones_rapid(light, zone_colors)
                                    else:  # lifx_native
                                        lifx_native_protocol.send_rgb_zones_rapid(light, zone_colors)
                                    
                                elif zones:
                                    # Non-gradient device with single color
                                    r, g, b = zones.get(0, [0, 0, 0])
                                    if light.protocol == "lifx":
                                        lifx_protocol.send_rgb_rapid(light, r, g, b)
                                    else:  # lifx_native
                                        lifx_native_protocol.send_rgb_rapid(light, r, g, b)
                                    
                                _lifx_last_send[key] = now_ts
                                
                            except Exception as e:
                                logging.debug(f"LIFX zone processing error: {e}")

                    # Hue lights are handled via DTLS tunnel, no need for API calls

                    # (Yeelight updates are already sent inline in the loops above.)
                    # Home Assistant batch
                    if haLights:
                        from services.homeAssistantWS import homeassistant_ws_client
                        if homeassistant_ws_client and not homeassistant_ws_client.client_terminated:
                            try:
                                homeassistant_ws_client.change_lights_batch(haLights)
                            except Exception as e:
                                logging.debug(f"HA batch update failed: {e}")

                    # Non-UDP fallbacks round-robin - Process more lights per frame
                    if non_UDP_lights:
                        # Process up to 2 lights per frame to reduce lag
                        lights_to_process = min(2, len(non_UDP_lights))
                        for _ in range(lights_to_process):
                            light = non_UDP_lights[non_UDP_update_counter]
                            op = skipSimilarFrames(light.id_v1, light.state["xy"], light.state["bri"])
                            if op == 1:
                                light.setV1State({"bri": light.state["bri"], "transitiontime": 2})
                            elif op == 2:
                                light.setV1State({"xy": light.state["xy"], "transitiontime": 2})
                            non_UDP_update_counter = (non_UDP_update_counter + 1) % len(non_UDP_lights)

                    # FPS logging (windowed) - Optimized
                    frames_in_window += 1
                    now = time.time()
                    if now - fps_window_start >= 1.0:
                        current_fps = frames_in_window / (now - fps_window_start)
                        fps_tracker.append(current_fps)
                        
                        # Only log every 5 seconds to reduce overhead
                        if now - last_fps_log >= 5.0:
                            if fps_tracker:
                                avg_fps = sum(fps_tracker) / len(fps_tracker)
                                min_fps = min(fps_tracker) if fps_tracker else 0
                                max_fps = max(fps_tracker) if fps_tracker else 0
                                mode_str = " (DTLS tunnel ACTIVE)" if hue_tunnel_active else ""
                                logging.info("Entertainment FPS - Avg: %.1f, Min: %.1f, Max: %.1f, Lights: %d%s",
                                           avg_fps, min_fps, max_fps, len(lights_v1), mode_str)
                            last_fps_log = now
                        
                        fps_window_start = now
                        frames_in_window = 0

                else:
                    logging.warning(f"Invalid frame data - HueStream header missing (got {data[:9] if data else 'empty'})")
                    # Try to recover by skipping this frame
                    if frame_count > 10:  # Only bail if we've had some successful frames
                        logging.error("Too many invalid frames, stopping entertainment")
                        p.kill()
                        break
                    else:
                        logging.info("Skipping invalid frame, continuing...")
    except Exception as e:
        logging.error(f"Entertainment service error: {e}")
        import traceback
        logging.debug(traceback.format_exc())
    finally:
        logging.info(f"Entertainment service stopping after {frame_count} frames")

    # Clean up main DTLS server
    try:
        p.kill()
    except:
        pass
    
    # Clean up Hue tunnel if active
    if hue_tunnel_process:
        try:
            # Try graceful shutdown first
            hue_tunnel_process.disconnect()
        except:
            # Force kill if graceful shutdown fails
            try:
                pass  # Already disconnected
            except:
                pass
        
        # Disable streaming on real Hue bridge
        if hue_bridge_group_id:
            try:
                hue_ip = bridgeConfig["config"]["hue"]["ip"]
                hue_user = bridgeConfig["config"]["hue"]["hueUser"]
                url = f"http://{hue_ip}/api/{hue_user}/groups/{hue_bridge_group_id}"
                requests.put(url, json={"stream": {"active": False}}, timeout=2)
                logging.info(f"✓ Hue bridge streaming disabled for group {hue_bridge_group_id}")
            except Exception as e:
                logging.debug(f"Failed to disable Hue bridge streaming: {e}")
    
    bridgeConfig["groups"][group.id_v1].stream["owner"] = None
    bridgeConfig["groups"][group.id_v1].stream["active"] = False
    
    # Stop LIFX entertainment mode
    try:
        lifx_protocol.stop_entertainment_mode()
    except Exception as e:
        logging.debug(f"Could not stop LIFX entertainment mode: {e}")
    
    # Stop LIFX Native entertainment mode
    try:
        lifx_native_protocol.stop_entertainment_mode()
    except Exception as e:
        logging.debug(f"Could not stop LIFX Native entertainment mode: {e}")
    
    for light in group.lights:
        bridgeConfig["lights"][light().id_v1].state["mode"] = "homeautomation"

    # Clean up resources
    for sock in udp_socket_pool.values():
        try:
            sock.close()
        except:
            pass
    udp_socket_pool.clear()
    
    # Shutdown thread pool
    try:
        executor.shutdown(wait=False, cancel_futures=True)
    except:
        pass
    
    logging.info("Entertainment service stopped")


def enableMusic(ip, host_ip):
    if ip in YeelightConnections:
        c = YeelightConnections[ip]
        if not c._music:
            c.enableMusic(host_ip, require_override=True)
    else:
        c = YeelightConnection(ip)
        YeelightConnections[ip] = c
        c.enableMusic(host_ip, require_override=True)


def disableMusic(ip):
    if ip in YeelightConnections:  # Else? LOL
        YeelightConnections[ip].disableMusic()


class YeelightConnection(object):
    _music = False
    _connected = False
    _socket = None
    _host_ip = ""
    _music_attempted = False

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

    def enableMusic(self, host_ip, require_override=None):
        if self._connected and self._music:
            raise AssertionError("Already in music mode!")
        if self._music_attempted and not self._music:
            # Don't keep retrying every frame if already attempted and fell back
            return
        self._music_attempted = True

        self._host_ip = host_ip

        # Determine advertised host IP preference from config if set
        try:
            music_cfg = bridgeConfig["config"].get("yeelight", {}).get("music", {})
        except Exception:
            music_cfg = {}
        host_ip_override = music_cfg.get("host_ip") or None
        require_music = bool(music_cfg.get("require", False))
        if require_override is not None:
            require_music = bool(require_override)

        # Start or reuse a single shared music server port
        global _music_server
        if _music_server is None or not _music_server.running:
            _music_server = YeelightMusicServer(music_cfg)
            _music_server.start()

        if not self._connected:
            self.connect(True)  # Basic connect for set_music

        # Determine the best local IP to advertise (route to device) or use config override
        local_host_ip = host_ip_override or host_ip
        # Only auto-detect when host_ip is not set to a concrete LAN IP
        if not host_ip_override and (not host_ip or host_ip in ["0.0.0.0", "127.0.0.1"]):
            try:
                _tmp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                _tmp.connect((self._ip, 1))
                local_host_ip = _tmp.getsockname()[0]
                _tmp.close()
            except Exception:
                pass

        logging.info("Yeelight music: advertising %s:%s", local_host_ip, _music_server.port)
        self.command("set_music", [1, local_host_ip, _music_server.port])  # MAGIC
        self.disconnect()  # Disconnect from basic mode

        try:
            deadline = time.time() + 12  # wait up to 12s to establish
            while True:
                if self._music and self._connected:
                    break
                if time.time() >= deadline:
                    raise ConnectionError("music connect timeout")
                # re-issue set_music in case the previous attempt missed
                try:
                    self.connect(True)
                    self.command("set_music", [1, local_host_ip, _music_server.port])
                    self.disconnect()
                except Exception:
                    pass
                time.sleep(0.25)
        except Exception as e:
            if require_music:
                raise ConnectionError("Yeelight with IP {} doesn't want to connect in music mode: {}".format(self._ip, e))
            else:
                # Fallback: continue in non-music mode (maintain outbound TCP to device)
                self._music = False
                self._connected = False
                logging.info("Yeelight with IP %s couldn't enter music mode (%s). Falling back to non-music mode.", self._ip, e)
                return

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


class YeelightMusicServer:
    def __init__(self, music_cfg):
        self.running = False
        self.port = None
        self._sock = None
        self._thread = None
        # Choose port: prefer single port, else range start, else default 59000
        port = None
        if "port" in music_cfg:
            try:
                port = int(music_cfg.get("port"))
            except Exception:
                port = None
        if port is None:
            pr = music_cfg.get("port_range") or music_cfg.get("ports")
            if isinstance(pr, dict) and "start" in pr:
                try:
                    port = int(pr["start"])
                except Exception:
                    port = None
            elif isinstance(pr, (list, tuple)) and len(pr) >= 1:
                try:
                    port = int(pr[0])
                except Exception:
                    port = None
        if port is None:
            port = 59000
        self.port = port

    def start(self):
        if self.running:
            return
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("", self.port))
        self._sock.listen(16)
        self.running = True

        import threading

        def _loop():
            while self.running:
                try:
                    conn, addr = self._sock.accept()
                    ip = addr[0]
                    if ip in YeelightConnections:
                        c = YeelightConnections[ip]
                        # Replace or set music socket
                        try:
                            if c._socket:
                                try:
                                    c._socket.close()
                                except Exception:
                                    pass
                            c._socket = conn
                            c._connected = True
                            c._music = True
                            logging.info("Yeelight device with IP %s is now in music mode (shared)", ip)
                        except Exception:
                            try:
                                conn.close()
                            except Exception:
                                pass
                    else:
                        try:
                            conn.close()
                        except Exception:
                            pass
                except Exception:
                    time.sleep(0.2)

        self._thread = threading.Thread(target=_loop, daemon=True)
        self._thread.start()


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
