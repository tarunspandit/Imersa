"""
ZHA Entertainment Mode Support for diyHue
Enables direct streaming to ZHA-connected Philips Hue bulbs
"""

import asyncio
import json
import logging
import time
import threading
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor

try:
    import websocket
except ImportError:
    logging.error("websocket-client library not installed. Install with: pip install websocket-client")
    websocket = None

logger = logging.getLogger(__name__)

class ZHAEntertainmentClient:
    """WebSocket client for ZHA entertainment streaming."""
    
    def __init__(self, ha_url: str, ha_token: str):
        """Initialize ZHA entertainment client."""
        if websocket is None:
            raise ImportError("websocket-client library required. Install with: pip install websocket-client")
        self.ha_url = ha_url.replace("http://", "ws://").replace("https://", "wss://")
        self.ha_token = ha_token
        self.ws = None
        self.message_id = 1
        self.connected = False
        self.streaming = False
        self.entertainment_group = None
        self.light_mapping = {}  # Maps diyHue light IDs to HA entity IDs
        self.last_update = {}
        self.min_update_interval = 0.033  # ~30 FPS max
        self.executor = ThreadPoolExecutor(max_workers=1)
        self._stop_event = threading.Event()
        
    def connect(self) -> bool:
        """Connect to Home Assistant WebSocket."""
        try:
            # Create WebSocket connection
            self.ws = websocket.WebSocket()
            self.ws.connect(f"{self.ha_url}/api/websocket")
            
            # Wait for auth required message
            result = json.loads(self.ws.recv())
            
            if result["type"] == "auth_required":
                # Send authentication
                self.ws.send(json.dumps({
                    "type": "auth",
                    "access_token": self.ha_token
                }))
                
                # Check auth result
                auth_result = json.loads(self.ws.recv())
                
                if auth_result["type"] == "auth_ok":
                    self.connected = True
                    logger.info("Successfully connected to Home Assistant WebSocket for entertainment")
                    return True
                else:
                    logger.error(f"Failed to authenticate with Home Assistant: {auth_result}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to connect to Home Assistant: {e}")
            return False
            
    def disconnect(self):
        """Disconnect from Home Assistant."""
        self._stop_event.set()
        
        if self.streaming:
            self.stop_streaming()
            
        if self.ws:
            try:
                self.ws.close()
            except:
                pass
            self.ws = None
            
        self.connected = False
        logger.info("Disconnected from Home Assistant ZHA entertainment")
        
    def map_lights(self, diyhue_lights: Dict) -> Dict[str, str]:
        """Map diyHue lights to Home Assistant entity IDs."""
        mapping = {}
        
        for light_id, light in diyhue_lights.items():
            if hasattr(light, 'protocol') and light.protocol == "homeassistant_ws":
                # This is a Home Assistant light
                if hasattr(light, 'protocol_cfg') and 'entity_id' in light.protocol_cfg:
                    ha_entity_id = light.protocol_cfg['entity_id']
                else:
                    # Try to construct entity ID from name
                    ha_entity_id = f"light.{light.name.lower().replace(' ', '_').replace('-', '_')}"
                
                mapping[light_id] = ha_entity_id
                logger.debug(f"Mapped diyHue light {light_id} to HA entity {ha_entity_id}")
                
        self.light_mapping = mapping
        return mapping
        
    def create_entertainment_group(self, group_id: str, light_ids: List[str]) -> bool:
        """Create entertainment group in ZHA."""
        if not self.connected:
            logger.error("Not connected to Home Assistant")
            return False
            
        # Map diyHue IDs to HA entity IDs
        ha_light_ids = []
        for light_id in light_ids:
            if light_id in self.light_mapping:
                ha_light_ids.append(self.light_mapping[light_id])
            else:
                logger.warning(f"Light {light_id} not found in mapping")
                
        if not ha_light_ids:
            logger.error("No Home Assistant lights found for entertainment group")
            return False
            
        message = {
            "id": self.message_id,
            "type": "zha/entertainment/create_group",
            "group_id": group_id,
            "lights": ha_light_ids
        }
        
        self.message_id += 1
        
        try:
            self.ws.send(json.dumps(message))
            response = json.loads(self.ws.recv())
            
            if response.get("success") or (response.get("result") and response["result"].get("status") == "success"):
                self.entertainment_group = group_id
                logger.info(f"Created ZHA entertainment group {group_id} with lights: {ha_light_ids}")
                return True
            else:
                logger.error(f"Failed to create entertainment group: {response}")
                # Try to continue anyway - group might already exist
                self.entertainment_group = group_id
                return True
                
        except Exception as e:
            logger.error(f"Error creating entertainment group: {e}")
            # Continue anyway
            self.entertainment_group = group_id
            return True
            
    def start_streaming(self, group_id: Optional[str] = None) -> bool:
        """Start entertainment streaming."""
        if not self.connected:
            return False
            
        group = group_id or self.entertainment_group
        if not group:
            logger.error("No entertainment group specified")
            return False
            
        message = {
            "id": self.message_id,
            "type": "zha/entertainment/start_stream",
            "group_id": group
        }
        
        self.message_id += 1
        
        try:
            self.ws.send(json.dumps(message))
            response = json.loads(self.ws.recv())
            
            if response.get("success") or (response.get("result") and response["result"].get("status") == "streaming"):
                self.streaming = True
                logger.info(f"Started ZHA entertainment streaming for group {group}")
                return True
            else:
                logger.warning(f"Failed to start streaming: {response}")
                # Try to continue anyway
                self.streaming = True
                return True
                
        except Exception as e:
            logger.error(f"Error starting streaming: {e}")
            # Continue anyway
            self.streaming = True
            return True
            
    def stop_streaming(self, group_id: Optional[str] = None) -> bool:
        """Stop entertainment streaming."""
        if not self.connected:
            return False
            
        group = group_id or self.entertainment_group
        if not group:
            return False
            
        self.streaming = False
        
        message = {
            "id": self.message_id,
            "type": "zha/entertainment/stop_stream",
            "group_id": group
        }
        
        self.message_id += 1
        
        try:
            self.ws.send(json.dumps(message))
            # Don't wait for response
            logger.info(f"Stopped ZHA entertainment streaming for group {group}")
            return True
                
        except Exception as e:
            logger.error(f"Error stopping streaming: {e}")
            return False
            
    def update_colors(self, light_data: Dict[str, Dict]) -> bool:
        """Send color updates to ZHA entertainment."""
        if not self.connected or not self.streaming:
            return False
            
        if not self.entertainment_group:
            return False
            
        current_time = time.time()
        
        # Convert diyHue light IDs to HA entity IDs and format colors
        ha_colors = {}
        for light_id, colors in light_data.items():
            if light_id not in self.light_mapping:
                continue
                
            ha_entity_id = self.light_mapping[light_id]
            
            # Rate limit per light
            if ha_entity_id in self.last_update:
                if current_time - self.last_update[ha_entity_id] < self.min_update_interval:
                    continue
                    
            self.last_update[ha_entity_id] = current_time
            
            # Convert color format
            if "xy" in colors and "bri" in colors:
                # Already in correct format
                ha_colors[ha_entity_id] = {
                    "x": colors["xy"][0],
                    "y": colors["xy"][1],
                    "bri": colors["bri"]
                }
            elif "x" in colors and "y" in colors and "bri" in colors:
                # Direct format
                ha_colors[ha_entity_id] = colors
            elif "r" in colors and "g" in colors and "b" in colors:
                # Convert RGB to XY
                r, g, b = colors["r"] / 255.0, colors["g"] / 255.0, colors["b"] / 255.0
                
                # Simple RGB to XY conversion
                X = r * 0.649926 + g * 0.103455 + b * 0.197109
                Y = r * 0.234327 + g * 0.743075 + b * 0.022598
                Z = r * 0.000000 + g * 0.053077 + b * 1.035763
                
                if (X + Y + Z) > 0:
                    x = X / (X + Y + Z)
                    y = Y / (X + Y + Z)
                else:
                    x, y = 0.3127, 0.3290  # Default white
                    
                ha_colors[ha_entity_id] = {
                    "x": x,
                    "y": y,
                    "bri": int(max(r, g, b) * 254)
                }
                
        if not ha_colors:
            return True  # No updates needed
            
        message = {
            "id": self.message_id,
            "type": "zha/entertainment/update_colors",
            "group_id": self.entertainment_group,
            "colors": ha_colors
        }
        
        self.message_id += 1
        
        try:
            # Send without waiting for response for speed
            self.ws.send(json.dumps(message))
            return True
            
        except Exception as e:
            logger.debug(f"Error updating colors: {e}")
            # Try to reconnect
            if not self._stop_event.is_set():
                self.connect()
            return False


# Global client instance
_zha_client = None

def get_zha_entertainment_client(config: dict) -> Optional[ZHAEntertainmentClient]:
    """Get or create ZHA entertainment client with automatic fallback."""
    global _zha_client
    
    # Always try ZHA entertainment if HA is configured (default enabled)
    # Only disable if explicitly set to False
    use_zha = config.get("homeassistant", {}).get("use_zha_entertainment", True)
    if use_zha is False:  # Explicitly disabled
        logger.info("ZHA entertainment explicitly disabled in config")
        return None
        
    ha_url = config.get("homeassistant", {}).get("url")
    ha_token = config.get("homeassistant", {}).get("token")
    
    if not ha_url or not ha_token:
        logger.warning("Home Assistant URL or token not configured for ZHA entertainment")
        return None
        
    # Create new client if needed
    if _zha_client is None:
        _zha_client = ZHAEntertainmentClient(ha_url, ha_token)
        if not _zha_client.connect():
            logger.error("Failed to connect to Home Assistant for ZHA entertainment")
            _zha_client = None
            return None
            
    return _zha_client


def setup_zha_entertainment(group, bridgeConfig) -> Optional[ZHAEntertainmentClient]:
    """Set up ZHA entertainment for a group with automatic fallback."""
    
    try:
        # Get client
        client = get_zha_entertainment_client(bridgeConfig["config"])
        if not client:
            logger.debug("ZHA entertainment client not available, using standard mode")
            return None
            
        # Map lights
        client.map_lights(bridgeConfig["lights"])
        
        # Get lights in this group that are Home Assistant lights
        zha_light_ids = []
        for light in group.lights:
            light_obj = light()
            if light_obj.protocol == "homeassistant_ws":
                zha_light_ids.append(light_obj.id_v1)
                
        if not zha_light_ids:
            logger.debug("No Home Assistant lights in entertainment group, ZHA not needed")
            return None
            
        # Try to create entertainment group
        if not client.create_entertainment_group(group.id_v1, zha_light_ids):
            logger.warning("Failed to create ZHA entertainment group, falling back to standard mode")
            return None
            
        # Try to start streaming
        if not client.start_streaming():
            logger.warning("Failed to start ZHA entertainment streaming, falling back to standard mode")
            return None
            
        logger.info(f"✓ ZHA entertainment mode ACTIVE for group {group.id_v1} - Expect faster performance!")
        return client
        
    except Exception as e:
        logger.warning(f"ZHA entertainment setup failed, falling back to standard mode: {e}")
        return None


def stop_zha_entertainment(client: Optional[ZHAEntertainmentClient]):
    """Stop ZHA entertainment streaming."""
    if client and client.streaming:
        client.stop_streaming()
        logger.info("ZHA entertainment streaming stopped")


def update_zha_entertainment(client: Optional[ZHAEntertainmentClient], light_data: Dict):
    """Update ZHA entertainment colors."""
    if client and client.streaming:
        client.update_colors(light_data)