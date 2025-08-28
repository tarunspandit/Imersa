"""
Entertainment Service Hue Bridge Synchronization
Creates and manages entertainment groups on real Hue bridge
"""

import logManager
import configManager
import requests
import json
import uuid

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
            if gdata.get("name") == diyhue_group_name and gdata.get("type") == "Entertainment":
                group_id = gid
                logging.info(f"Found existing Hue entertainment group: {group_id}")
                break
        
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
            # Update existing group (only update lights, not recreate)
            update_data = {"lights": light_ids}
            r = requests.put(
                f"http://{hue_ip}/api/{hue_user}/groups/{group_id}",
                json=update_data,
                timeout=3
            )
            logging.info(f"Updated Hue entertainment group {group_id}: {r.text[:100]}")
        else:
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
        
        # Note: Locations for entertainment groups are complex and often fail
        # The Hue bridge is very picky about the format
        # For now, skip setting locations to avoid breaking the sync
        logging.debug("Skipping location setup - Hue bridge will use default positions")
        
        return int(group_id) if group_id else None
        
    except Exception as e:
        logging.error(f"Error managing Hue entertainment group: {e}")
        return None


def sync_entertainment_group(diyhue_group):
    """
    Ensure real Hue bridge has matching entertainment group
    Returns the Hue bridge group ID or None
    """
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
        return None
    
    logging.info(f"Found {len(hue_lights)} Hue lights to sync")
    
    # Create/update group on real Hue bridge
    hue_group_id = create_hue_entertainment_group(
        diyhue_group.name,
        hue_lights,
        hue_locations
    )
    
    return hue_group_id


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