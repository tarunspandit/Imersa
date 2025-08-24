#!/usr/bin/env python3
"""
Bridge between diyHue entertainment mode and ZHA entertainment API.
This allows diyHue to stream entertainment data directly to ZHA-connected Hue bulbs.
"""

import asyncio
import json
import logging
import time
from typing import Dict, List
import websockets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ZHAEntertainmentBridge:
    """Bridge to connect diyHue entertainment to ZHA."""
    
    def __init__(self, ha_url: str, ha_token: str):
        """Initialize the bridge."""
        self.ha_url = ha_url.replace("http://", "ws://").replace("https://", "wss://")
        self.ha_token = ha_token
        self.websocket = None
        self.message_id = 1
        self.entertainment_group = None
        self.is_streaming = False
        
    async def connect(self):
        """Connect to Home Assistant WebSocket."""
        try:
            # Connect to WebSocket
            self.websocket = await websockets.connect(f"{self.ha_url}/api/websocket")
            
            # Wait for auth request
            msg = await self.websocket.recv()
            auth_msg = json.loads(msg)
            
            if auth_msg["type"] == "auth_required":
                # Send authentication
                await self.websocket.send(json.dumps({
                    "type": "auth",
                    "access_token": self.ha_token
                }))
                
                # Wait for auth result
                msg = await self.websocket.recv()
                auth_result = json.loads(msg)
                
                if auth_result["type"] == "auth_ok":
                    logger.info("Successfully connected to Home Assistant WebSocket")
                    return True
                else:
                    logger.error("Authentication failed: %s", auth_result)
                    return False
                    
        except Exception as e:
            logger.error("Failed to connect to Home Assistant: %s", e)
            return False
            
    async def create_entertainment_group(self, group_id: str, light_ids: List[str]):
        """Create an entertainment group in ZHA."""
        if not self.websocket:
            logger.error("Not connected to Home Assistant")
            return False
            
        message = {
            "id": self.message_id,
            "type": "zha/entertainment/create_group",
            "group_id": group_id,
            "lights": light_ids
        }
        
        self.message_id += 1
        
        try:
            await self.websocket.send(json.dumps(message))
            response = await self.websocket.recv()
            result = json.loads(response)
            
            if result.get("success"):
                self.entertainment_group = group_id
                logger.info("Created entertainment group %s with lights: %s", 
                          group_id, light_ids)
                return True
            else:
                logger.error("Failed to create entertainment group: %s", result)
                return False
                
        except Exception as e:
            logger.error("Error creating entertainment group: %s", e)
            return False
            
    async def start_streaming(self, group_id: str = None):
        """Start entertainment streaming."""
        if not self.websocket:
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
            await self.websocket.send(json.dumps(message))
            response = await self.websocket.recv()
            result = json.loads(response)
            
            if result.get("result", {}).get("status") == "streaming":
                self.is_streaming = True
                logger.info("Started entertainment streaming for group %s", group)
                return True
            else:
                logger.error("Failed to start streaming: %s", result)
                return False
                
        except Exception as e:
            logger.error("Error starting streaming: %s", e)
            return False
            
    async def stop_streaming(self, group_id: str = None):
        """Stop entertainment streaming."""
        if not self.websocket:
            return False
            
        group = group_id or self.entertainment_group
        if not group:
            return False
            
        message = {
            "id": self.message_id,
            "type": "zha/entertainment/stop_stream",
            "group_id": group
        }
        
        self.message_id += 1
        
        try:
            await self.websocket.send(json.dumps(message))
            response = await self.websocket.recv()
            result = json.loads(response)
            
            if result.get("result", {}).get("status") == "stopped":
                self.is_streaming = False
                logger.info("Stopped entertainment streaming for group %s", group)
                return True
                
        except Exception as e:
            logger.error("Error stopping streaming: %s", e)
            return False
            
    async def update_colors(self, color_data: Dict[str, Dict], group_id: str = None):
        """Update colors for entertainment group."""
        if not self.websocket or not self.is_streaming:
            return False
            
        group = group_id or self.entertainment_group
        if not group:
            return False
            
        message = {
            "id": self.message_id,
            "type": "zha/entertainment/update_colors",
            "group_id": group,
            "colors": color_data
        }
        
        self.message_id += 1
        
        try:
            # Use send without waiting for response for speed
            await self.websocket.send(json.dumps(message))
            return True
            
        except Exception as e:
            logger.error("Error updating colors: %s", e)
            return False
            
    async def disconnect(self):
        """Disconnect from Home Assistant."""
        if self.is_streaming:
            await self.stop_streaming()
            
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            
        logger.info("Disconnected from Home Assistant")


class DiyHueZHAConnector:
    """Connector to integrate diyHue with ZHA entertainment."""
    
    def __init__(self, ha_url: str, ha_token: str):
        """Initialize the connector."""
        self.bridge = ZHAEntertainmentBridge(ha_url, ha_token)
        self.light_mapping = {}  # Map diyHue light IDs to HA entity IDs
        
    async def setup(self, light_mapping: Dict[str, str]):
        """Set up the connection and mappings."""
        self.light_mapping = light_mapping
        
        # Connect to Home Assistant
        connected = await self.bridge.connect()
        if not connected:
            raise ConnectionError("Failed to connect to Home Assistant")
            
        return True
        
    async def create_entertainment_session(self, group_name: str, diyhue_light_ids: List[str]):
        """Create an entertainment session for diyHue lights."""
        # Map diyHue light IDs to HA entity IDs
        ha_light_ids = []
        for diyhue_id in diyhue_light_ids:
            if diyhue_id in self.light_mapping:
                ha_light_ids.append(self.light_mapping[diyhue_id])
                
        if not ha_light_ids:
            logger.error("No mapped lights found for entertainment")
            return False
            
        # Create entertainment group
        success = await self.bridge.create_entertainment_group(group_name, ha_light_ids)
        if not success:
            return False
            
        # Start streaming
        return await self.bridge.start_streaming(group_name)
        
    async def stream_entertainment_data(self, frame_data: Dict):
        """Stream entertainment frame data from diyHue."""
        if not self.bridge.is_streaming:
            return False
            
        # Convert diyHue format to ZHA format
        color_data = {}
        for diyhue_id, colors in frame_data.items():
            if diyhue_id in self.light_mapping:
                ha_id = self.light_mapping[diyhue_id]
                # Convert RGB to XY if needed
                if "r" in colors and "g" in colors and "b" in colors:
                    # Simple RGB to XY conversion (can be improved)
                    r, g, b = colors["r"] / 255, colors["g"] / 255, colors["b"] / 255
                    x = r * 0.649926 + g * 0.103455 + b * 0.197109
                    y = r * 0.234327 + g * 0.743075 + b * 0.022598
                    z = r * 0.000000 + g * 0.053077 + b * 1.035763
                    
                    if (x + y + z) > 0:
                        x = x / (x + y + z)
                        y = y / (x + y + z)
                    else:
                        x, y = 0.3, 0.3
                        
                    color_data[ha_id] = {
                        "x": x,
                        "y": y,
                        "bri": max(r, g, b) * 254
                    }
                elif "x" in colors and "y" in colors:
                    # Already in XY format
                    color_data[ha_id] = colors
                    
        return await self.bridge.update_colors(color_data)
        
    async def stop_entertainment(self):
        """Stop entertainment streaming."""
        return await self.bridge.stop_streaming()
        
    async def cleanup(self):
        """Clean up the connection."""
        await self.bridge.disconnect()


# Example usage
async def main():
    """Example of using the ZHA entertainment bridge."""
    
    # Configuration
    HA_URL = "ws://homeassistant.local:8123"
    HA_TOKEN = "your_long_lived_access_token"
    
    # Mapping of diyHue light IDs to Home Assistant entity IDs
    LIGHT_MAPPING = {
        "1": "light.hue_bulb_1",
        "2": "light.hue_bulb_2",
        "3": "light.hue_bulb_3",
    }
    
    # Create connector
    connector = DiyHueZHAConnector(HA_URL, HA_TOKEN)
    
    try:
        # Set up connection
        await connector.setup(LIGHT_MAPPING)
        
        # Create entertainment session
        await connector.create_entertainment_session(
            "entertainment_1",
            ["1", "2", "3"]
        )
        
        # Simulate entertainment frames (60 FPS)
        logger.info("Starting entertainment simulation...")
        for i in range(600):  # 10 seconds at 60 FPS
            # Generate test colors
            frame_data = {}
            for light_id in ["1", "2", "3"]:
                # Cycle through colors
                if i % 180 < 60:
                    # Red
                    frame_data[light_id] = {"r": 255, "g": 0, "b": 0}
                elif i % 180 < 120:
                    # Green
                    frame_data[light_id] = {"r": 0, "g": 255, "b": 0}
                else:
                    # Blue
                    frame_data[light_id] = {"r": 0, "g": 0, "b": 255}
                    
            # Stream frame
            await connector.stream_entertainment_data(frame_data)
            
            # 60 FPS timing
            await asyncio.sleep(1/60)
            
        # Stop entertainment
        await connector.stop_entertainment()
        
    finally:
        # Clean up
        await connector.cleanup()


if __name__ == "__main__":
    asyncio.run(main())