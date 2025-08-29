"""
Entertainment Service Hue Bridge Synchronization
Creates and manages entertainment groups on real Hue bridge
"""

import logManager
import configManager
import requests
import json
import uuid
from services.uuid_mapper import get_uuid_mapper
import math

logging = logManager.logger.get_logger(__name__)
bridgeConfig = configManager.bridgeConfig.yaml_config


def create_hue_entertainment_group(group_name, hue_lights, locations):
    """
    Create or update entertainment group on real Hue bridge
    with only the Hue bulbs from our mixed group
    """
    if not bridgeConfig["config"].get("hue", {}).get("ip"):
        logging.warning("No Hue bridge configured")
        return None
        
    hue_ip = bridgeConfig["config"]["hue"]["ip"]
    hue_user = bridgeConfig["config"]["hue"]["hueUser"]
    
    # Get existing entertainment groups on real bridge
    try:
        r = requests.get(f"http://{hue_ip}/api/{hue_user}/groups", timeout=3)
        existing_groups = r.json()
        
        # Check if our group already exists
        group_id = None
        diyhue_group_name = f"DIYHue_{group_name}"
        
        for gid, gdata in existing_groups.items():
            if gdata.get("name") == diyhue_group_name:
                if gdata.get("type") == "Entertainment":
                    group_id = gid
                    logging.info(f"Found existing Hue entertainment group: {group_id}")
                    break
                else:
                    # Found group but wrong type - need to delete and recreate
                    logging.warning(f"Found group {gid} with name '{diyhue_group_name}' but type is '{gdata.get('type')}', not 'Entertainment'")
                    logging.info(f"Deleting non-entertainment group {gid} to recreate as Entertainment...")
                    del_r = requests.delete(f"http://{hue_ip}/api/{hue_user}/groups/{gid}", timeout=3)
                    logging.info(f"Deleted group {gid}: {del_r.text[:100]}")
        
        # Prepare group data
        light_ids = [str(light.protocol_cfg["id"]) for light in hue_lights]
        
        group_data = {
            "name": diyhue_group_name,
            "type": "Entertainment",
            "lights": light_ids,
            "class": "TV"
        }
        
        # Note: Don't add locations in group creation - Hue bridge doesn't support it
        # Locations must be set after group creation using a separate API call
        
        if group_id:
            # Update existing entertainment group's lights
            # First verify it's still an Entertainment group
            check_r = requests.get(f"http://{hue_ip}/api/{hue_user}/groups/{group_id}", timeout=3)
            group_info = check_r.json()
            
            if group_info.get("type") != "Entertainment" or "stream" not in group_info:
                if group_info.get("type") != "Entertainment":
                    logging.error(f"Group {group_id} is not Entertainment type: {group_info.get('type')}")
                else:
                    logging.warning(f"Group {group_id} is Entertainment but lacks 'stream' config - recreating")
                
                # Delete and recreate
                del_r = requests.delete(f"http://{hue_ip}/api/{hue_user}/groups/{group_id}", timeout=3)
                logging.info(f"Deleted group {group_id} for recreation: {del_r.text}")
                
                # Clear cached UUID mapping since we're recreating
                mapper = get_uuid_mapper()
                mapper.remove_mapping(group_name)
                
                group_id = None  # Force recreation
            else:
                # Update lights in entertainment group
                update_data = {"lights": light_ids}
                r = requests.put(
                    f"http://{hue_ip}/api/{hue_user}/groups/{group_id}",
                    json=update_data,
                    timeout=3
                )
                logging.info(f"Updated Hue entertainment group {group_id}: {r.text[:100]}")
        
        
        if not group_id:
            # Create new group
            r = requests.post(
                f"http://{hue_ip}/api/{hue_user}/groups",
                json=group_data,
                timeout=3
            )
            result = r.json()
            if isinstance(result, list) and len(result) > 0:
                if "success" in result[0]:
                    group_id = result[0]["success"]["id"]
                    logging.info(f"Created new Hue entertainment group: {group_id}")
                elif "error" in result[0]:
                    # Log specific error details
                    error = result[0]["error"]
                    logging.error(f"Failed to create Hue group - Type: {error.get('type')}, "
                                f"Address: {error.get('address')}, "
                                f"Description: {error.get('description')}")
                    return None
            else:
                logging.error(f"Unexpected response creating Hue group: {result}")
                return None
        
        # Set locations for entertainment groups
        # DIYHue stores positions as an array of position dicts: [{"x": ..., "y": ..., "z": ...}, ...]
        # Hue bridge expects: {"locations": {"light_id": [x, y, z], ...}}
        if group_id and locations:
            try:
                location_dict = {}
                for light in hue_lights:
                    light_id = str(light.protocol_cfg["id"])  # Must be string for JSON key
                    
                    # Get location for this light
                    if light in locations:
                        loc = locations[light]
                        logging.debug(f"Light {light.name} (ID {light_id}) location data: {loc}")
                        
                        # DIYHue stores positions as array of dicts
                        x, y, z = 0.0, 0.0, 0.0  # Default center position
                        
                        if isinstance(loc, list) and len(loc) > 0:
                            # Get the first position entry
                            pos = loc[0]
                            if isinstance(pos, dict):
                                # Extract x, y, z from the position dict
                                x = float(pos.get("x", 0))
                                y = float(pos.get("y", 0))
                                z = float(pos.get("z", 0))
                                logging.debug(f"Extracted position: x={x}, y={y}, z={z}")
                            elif isinstance(pos, (list, tuple)):
                                # Sometimes it might be stored as [x, y, z]
                                x = float(pos[0]) if len(pos) > 0 else 0.0
                                y = float(pos[1]) if len(pos) > 1 else 0.0
                                z = float(pos[2]) if len(pos) > 2 else 0.0
                        elif isinstance(loc, dict):
                            # Direct dict format
                            x = float(loc.get("x", 0))
                            y = float(loc.get("y", 0))
                            z = float(loc.get("z", 0))
                        
                        # Round to 4 decimal places for precision
                        x = round(max(-1.0, min(1.0, x)), 4)
                        y = round(max(-1.0, min(1.0, y)), 4)
                        z = round(max(-1.0, min(1.0, z)), 4)
                        
                        # Add to dictionary - Hue expects [x, y, z] array per light
                        location_dict[light_id] = [x, y, z]
                        logging.debug(f"Mapped light {light_id} to position: [{x}, {y}, {z}]")
                    else:
                        # No location data for this light, use center
                        location_dict[light_id] = [0.0, 0.0, 0.0]
                        logging.debug(f"No location for light {light_id}, using center position")
                
                if location_dict:
                    # Log the complete location mapping
                    logging.info(f"Setting locations for {len(location_dict)} lights in group {group_id}")
                    logging.debug(f"Location mapping: {location_dict}")
                    
                    # Update group with locations
                    r = requests.put(
                        f"http://{hue_ip}/api/{hue_user}/groups/{group_id}",
                        json={"locations": location_dict},
                        timeout=3
                    )
                    result = r.json()
                    if isinstance(result, list) and len(result) > 0:
                        success = False
                        for item in result:
                            if "success" in item:
                                success = True
                                break
                        if success:
                            logging.info(f"✓ Set locations for Hue group {group_id}")
                        else:
                            # Log the specific error
                            for item in result:
                                if "error" in item:
                                    err = item["error"]
                                    logging.warning(f"Location error: {err.get('description', 'Unknown')}")
                                    logging.warning(f"Full error: {item}")
            except Exception as e:
                logging.warning(f"Failed to set locations: {e}")
                import traceback
                logging.debug(traceback.format_exc())
                # Don't fail the whole operation if locations can't be set
        
        return int(group_id) if group_id else None
        
    except Exception as e:
        logging.error(f"Error managing Hue entertainment group: {e}")
        return None


def _round4(v: float) -> float:
    try:
        return round(float(v), 4)
    except Exception:
        return 0.0


def _default_orientation():
    # Defaults per guide: horizontal (parallel), flat, cable at left
    return {
        "pose": "flat",             # flat | standing
        "axis": "horizontal",       # horizontal | vertical
        "cable": "left"             # left | right
    }


def _calculate_gradient_positions(orientation: dict) -> list:
    """Return 7 segment positions for gradient strip in normalized Hue coords.
    Orientation keys: pose(flat|standing), axis(horizontal|vertical), cable(left|right)
    """
    # Base layout: 5 along top, then two side anchors
    base = [
        (-0.8, 0.5), (-0.4, 0.5), (0.0, 0.5), (0.4, 0.5), (0.8, 0.5),
        (0.8, 0.0), (-0.8, 0.0)
    ]
    axis = (orientation.get("axis") or "horizontal").lower()
    cable = (orientation.get("cable") or "left").lower()
    pose = (orientation.get("pose") or "flat").lower()

    out = []
    for (x, y) in base:
        # Cable direction swaps left/right
        if cable == "right":
            x = -x
        # Axis vertical swaps axes
        if axis == "vertical":
            x, y = y, x
        z = 0.3 if pose == "standing" else 0.0
        out.append({"x": _round4(x), "y": _round4(y), "z": _round4(z)})
    return out


def _patch_v2_entertainment_positions(hue_ip: str, hue_user: str, ent_config_uuid: str, diyhue_group) -> bool:
    """PATCH service_locations.positions to Hue v2 entertainment_configuration.
    For gradient-capable models, send multiple positions per light service based on orientation.
    """
    if not hue_ip or not hue_user or not ent_config_uuid:
        return False

    # Build service_locations payload
    service_locations = []

    # Some gradient-capable models
    GRADIENT_MODELS = {"LCX001", "LCX002", "LCX003", "915005987201", "LCX004", "LCX006"}

    # Optional per-light orientation store on group: orientations[light_obj] or by id_v1
    orientations = getattr(diyhue_group, 'orientations', {}) or {}

    for light_ref in diyhue_group.lights:
        light = light_ref()
        if not light or getattr(light, 'protocol', None) != 'hue':
            continue

        # Locate primary position for this light
        x, y, z = 0.0, 0.0, 0.0
        if hasattr(diyhue_group, 'locations') and light in diyhue_group.locations:
            loc = diyhue_group.locations[light]
            try:
                if isinstance(loc, list) and len(loc) > 0:
                    pos = loc[0]
                    if isinstance(pos, dict):
                        x = float(pos.get('x', 0))
                        y = float(pos.get('y', 0))
                        z = float(pos.get('z', 0))
                    elif isinstance(pos, (list, tuple)):
                        x = float(pos[0]) if len(pos) > 0 else 0.0
                        y = float(pos[1]) if len(pos) > 1 else 0.0
                        z = float(pos[2]) if len(pos) > 2 else 0.0
            except Exception:
                pass

        # Clip and round
        x = _round4(max(-1.0, min(1.0, x)))
        y = _round4(max(-1.0, min(1.0, y)))
        z = _round4(max(-1.0, min(1.0, z)))

        positions = [{"x": x, "y": y, "z": z}]

        # If gradient model, compute 7 segment positions based on orientation
        try:
            if getattr(light, 'modelid', None) in GRADIENT_MODELS:
                # Pull orientation if available
                orient = orientations.get(light) or orientations.get(getattr(light, 'id_v1', ''), _default_orientation())
                positions = _calculate_gradient_positions(orient)
        except Exception:
            pass

        service_locations.append({
            "service": {"rid": light.id_v2, "rtype": "light"},
            "positions": positions
        })

    if not service_locations:
        logging.debug("No service_locations to PATCH for v2 entertainment configuration")
        return False

    url = f"https://{hue_ip}/clip/v2/resource/entertainment_configuration/{ent_config_uuid}"
    headers = {"hue-application-key": hue_user}
    payload = {"service_locations": service_locations}

    try:
        r = requests.patch(url, headers=headers, json=payload, verify=False, timeout=4)
        ok = 200 <= r.status_code < 300
        if not ok:
            logging.warning(f"Hue v2 positions PATCH failed {r.status_code}: {r.text[:200]}")
        else:
            logging.info(f"✓ Patched v2 entertainment positions for {len(service_locations)} lights")
        return ok
    except Exception as e:
        logging.warning(f"Failed v2 positions PATCH: {e}")
        return False


def sync_entertainment_group(diyhue_group):
    """
    Ensure real Hue bridge has matching entertainment group
    Returns tuple: (group_id, entertainment_config_uuid) or (None, None)
    """
    # Check for existing UUID mapping first
    mapper = get_uuid_mapper()
    existing_uuid = mapper.get_bridge_uuid(diyhue_group.name)
    existing_group_id = mapper.get_bridge_group_id(diyhue_group.name)
    
    if existing_uuid and existing_group_id:
        logging.info(f"Using cached UUID mapping for '{diyhue_group.name}': {existing_uuid}")
        # Update DIYHue UUID to match cached
        if hasattr(diyhue_group, 'id_v2') and diyhue_group.id_v2 != existing_uuid:
            diyhue_group.id_v2 = existing_uuid
        return existing_group_id, existing_uuid
    
    # Find all Hue protocol lights in this group
    hue_lights = []
    hue_locations = {}
    
    for light_ref in diyhue_group.lights:
        light = light_ref()
        if light.protocol == "hue":
            hue_lights.append(light)
            # Get location if it exists
            if hasattr(diyhue_group, 'locations') and light in diyhue_group.locations:
                hue_locations[light] = diyhue_group.locations[light]
    
    if not hue_lights:
        logging.debug("No Hue lights in entertainment group")
        return None, None
    
    logging.info(f"Found {len(hue_lights)} Hue lights to sync")
    
    # Log the exact lights and their order
    for i, light in enumerate(hue_lights):
        logging.info(f"  Channel {i} → DIYHue light {light.id_v1} → Hue bridge light {light.protocol_cfg['id']}")
    
    # Create/update group on real Hue bridge
    hue_group_id = create_hue_entertainment_group(
        diyhue_group.name,
        hue_lights,
        hue_locations
    )
    
    # Get the entertainment configuration UUID from V2 API if available
    entertainment_uuid = None
    if hue_group_id and bridgeConfig["config"].get("hue", {}).get("ip"):
        try:
            hue_ip = bridgeConfig["config"]["hue"]["ip"]
            hue_user = bridgeConfig["config"]["hue"]["hueUser"]
            
            # Try V2 API first to get entertainment configuration
            headers = {"hue-application-key": hue_user}
            r = requests.get(f"https://{hue_ip}/clip/v2/resource/entertainment_configuration", 
                           headers=headers, verify=False, timeout=3)
            
            if r.status_code == 200:
                v2_data = r.json()
                if "data" in v2_data:
                    # Find the entertainment config that matches our group
                    for config in v2_data["data"]:
                        # Check if this config is for our group (might need to match by name or lights)
                        if "metadata" in config and "name" in config["metadata"]:
                            if f"DIYHue_{diyhue_group.name}" in config["metadata"]["name"]:
                                entertainment_uuid = config["id"]
                                logging.info(f"✓ Found V2 entertainment config UUID from real bridge: {entertainment_uuid}")
                                
                                # IMPORTANT: Update DIYHue group UUID to match the real bridge
                                old_uuid = diyhue_group.id_v2 if hasattr(diyhue_group, 'id_v2') else None
                                if old_uuid and old_uuid != entertainment_uuid:
                                    diyhue_group.id_v2 = entertainment_uuid
                                    logging.info(f"✓ Updated DIYHue entertainment UUID: {old_uuid} -> {entertainment_uuid}")
                                
                                # Save mapping
                                mapper = get_uuid_mapper()
                                mapper.add_mapping(diyhue_group.name, old_uuid or entertainment_uuid, entertainment_uuid, hue_group_id)
                                
                                break
            
            # If no V2 UUID found, try to construct one from V1 data
            if not entertainment_uuid:
                # Check V1 API for any special UUID field
                r = requests.get(f"http://{hue_ip}/api/{hue_user}/groups/{hue_group_id}", timeout=3)
                group_data = r.json()
                
                # Some Hue bridges store entertainment UUID in group data
                if "stream" in group_data and "id" in group_data["stream"]:
                    entertainment_uuid = group_data["stream"]["id"]
                    logging.info(f"Found entertainment UUID in stream data: {entertainment_uuid}")
                elif "uuid" in group_data:
                    entertainment_uuid = group_data["uuid"]
                    logging.info(f"Found UUID in group data: {entertainment_uuid}")
                else:
                    # Generate a proper UUID v5 based on bridge and group
                    import uuid
                    namespace = uuid.NAMESPACE_URL
                    name = f"hue://{hue_ip}/groups/{hue_group_id}"
                    entertainment_uuid = str(uuid.uuid5(namespace, name))
                    logging.info(f"Generated UUID v5 for entertainment: {entertainment_uuid}")
                
                # Update DIYHue group UUID to match
                if entertainment_uuid and hasattr(diyhue_group, 'id_v2'):
                    old_uuid = diyhue_group.id_v2
                    if old_uuid != entertainment_uuid:
                        diyhue_group.id_v2 = entertainment_uuid
                        logging.info(f"✓ Synchronized DIYHue UUID: {old_uuid} -> {entertainment_uuid}")
                    
                    # Save mapping
                    mapper = get_uuid_mapper()
                    mapper.add_mapping(diyhue_group.name, old_uuid, entertainment_uuid, hue_group_id)
                    
        except Exception as e:
            logging.warning(f"Failed to get entertainment UUID from Hue bridge: {e}")
            # Generate fallback UUID
            import uuid
            entertainment_uuid = str(uuid.uuid4())
        
        # After we have a config UUID, PATCH v2 positions (and gradient segment positions)
        if entertainment_uuid:
            _patch_v2_entertainment_positions(hue_ip, hue_user, entertainment_uuid, diyhue_group)
    
    return hue_group_id, entertainment_uuid


def delete_hue_entertainment_group(group_name):
    """
    Delete entertainment group from real Hue bridge
    """
    if not bridgeConfig["config"].get("hue", {}).get("ip"):
        return
        
    hue_ip = bridgeConfig["config"]["hue"]["ip"]
    hue_user = bridgeConfig["config"]["hue"]["hueUser"]
    diyhue_group_name = f"DIYHue_{group_name}"
    
    try:
        # Find and delete the group
        r = requests.get(f"http://{hue_ip}/api/{hue_user}/groups", timeout=3)
        existing_groups = r.json()
        
        for gid, gdata in existing_groups.items():
            if gdata.get("name") == diyhue_group_name:
                r = requests.delete(f"http://{hue_ip}/api/{hue_user}/groups/{gid}", timeout=3)
                logging.info(f"Deleted Hue entertainment group {gid}: {r.text}")
                break
                
    except Exception as e:
        logging.error(f"Error deleting Hue group: {e}")
