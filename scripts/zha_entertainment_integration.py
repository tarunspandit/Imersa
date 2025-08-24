#!/usr/bin/env python3
"""
ZHA Entertainment Mode Integration
Modifications needed for Home Assistant ZHA integration
"""

# This shows what would be added to homeassistant/components/zha/light.py

class ZHALight:
    """Enhanced ZHA Light with entertainment support"""
    
    def __init__(self, unique_id, zha_device, channels, **kwargs):
        # ... existing ZHA light initialization
        self._entertainment_capable = self._check_entertainment_support()
        self._entertainment_active = False
        self._entertainment_group = None
        
    def _check_entertainment_support(self) -> bool:
        """Check if this light supports Hue entertainment mode"""
        try:
            # Check manufacturer and model for Hue bulbs
            manufacturer = self._device.manufacturer
            model = self._device.model
            
            # Hue bulbs that support entertainment
            hue_entertainment_models = [
                "LCT015", "LCT016", "LCT021",  # Color bulbs
                "LTW015", "LTW016", "LTW021",  # White ambiance
                "LLC020", "LLC014", "LLC010",  # Light strips
            ]
            
            if manufacturer and "Philips" in manufacturer:
                if model in hue_entertainment_models:
                    return True
                    
            return False
        except Exception:
            return False
    
    @property 
    def entertainment_capable(self) -> bool:
        """Return if light supports entertainment mode"""
        return self._entertainment_capable
        
    async def async_entertainment_update(self, x: float, y: float, brightness: int) -> bool:
        """Direct entertainment update bypassing normal light entity"""
        if not self._entertainment_capable or not self._entertainment_active:
            return False
            
        try:
            # Send direct Zigbee command bypassing entity state
            await self._send_direct_color_command(x, y, brightness)
            return True
        except Exception as e:
            _LOGGER.error(f"Entertainment update failed for {self.name}: {e}")
            return False
            
    async def _send_direct_color_command(self, x: float, y: float, brightness: int):
        """Send direct Zigbee color command"""
        try:
            # Get the color control cluster
            color_cluster = self._device.device.endpoints[1].color
            
            # Convert xy to Zigbee format (0-65535 range)
            zigbee_x = int(x * 65535)
            zigbee_y = int(y * 65535)
            zigbee_bri = max(1, min(254, brightness))
            
            # Send commands directly without entity state updates
            # This bypasses the normal HA entity system for speed
            tasks = [
                color_cluster.move_to_color(zigbee_x, zigbee_y, transition_time=1),
                color_cluster.move_to_level_with_on_off(zigbee_bri, transition_time=1)
            ]
            
            await asyncio.gather(*tasks, return_exceptions=True)
            
        except Exception as e:
            _LOGGER.error(f"Direct color command failed: {e}")
            raise


# This shows what would be added to homeassistant/components/zha/websocket_api.py

@websocket_api.websocket_command({
    vol.Required("type"): "zha/entertainment/create_group",
    vol.Required("group_id"): str,
    vol.Required("lights"): [str],
})
def websocket_create_entertainment_group(hass, connection, msg):
    """Create ZHA entertainment group."""
    
    @websocket_api.async_response
    async def create_group(hass, connection, msg):
        zha_gateway = hass.data[DATA_ZHA][DATA_ZHA_GATEWAY]
        
        # Get ZHA light entities
        light_entities = []
        for entity_id in msg["lights"]:
            entity = hass.states.get(entity_id)
            if entity and entity.platform == "zha":
                zha_entity = get_zha_entity(hass, entity_id)
                if hasattr(zha_entity, 'entertainment_capable') and zha_entity.entertainment_capable:
                    light_entities.append(zha_entity)
        
        if not light_entities:
            connection.send_error(msg["id"], "no_entertainment_lights", "No entertainment capable lights found")
            return
            
        # Create entertainment group
        success = await zha_gateway.create_entertainment_group(msg["group_id"], light_entities)
        
        if success:
            connection.send_result(msg["id"], {"status": "success"})
        else:
            connection.send_error(msg["id"], "creation_failed", "Failed to create entertainment group")
            
    create_group(hass, connection, msg)


@websocket_api.websocket_command({
    vol.Required("type"): "zha/entertainment/start_stream", 
    vol.Required("group_id"): str,
})
def websocket_start_entertainment_stream(hass, connection, msg):
    """Start ZHA entertainment streaming."""
    
    @websocket_api.async_response
    async def start_stream(hass, connection, msg):
        zha_gateway = hass.data[DATA_ZHA][DATA_ZHA_GATEWAY]
        
        success = await zha_gateway.start_entertainment_stream(msg["group_id"])
        
        if success:
            connection.send_result(msg["id"], {"status": "streaming"})
        else:
            connection.send_error(msg["id"], "stream_failed", "Failed to start entertainment stream")
            
    start_stream(hass, connection, msg)


@websocket_api.websocket_command({
    vol.Required("type"): "zha/entertainment/update_colors",
    vol.Required("group_id"): str, 
    vol.Required("colors"): dict,
})
def websocket_update_entertainment_colors(hass, connection, msg):
    """Update entertainment colors."""
    
    @websocket_api.async_response  
    async def update_colors(hass, connection, msg):
        zha_gateway = hass.data[DATA_ZHA][DATA_ZHA_GATEWAY]
        
        success = await zha_gateway.update_entertainment_colors(msg["group_id"], msg["colors"])
        
        connection.send_result(msg["id"], {"success": success})
        
    update_colors(hass, connection, msg)


# This shows what would be added to the ZHA gateway class

class ZHAGateway:
    """Enhanced ZHA Gateway with entertainment support"""
    
    def __init__(self, hass, config, coordinator):
        # ... existing initialization
        self._entertainment_groups = {}
        self._entertainment_active = {}
        
    async def create_entertainment_group(self, group_id: str, light_entities: list) -> bool:
        """Create entertainment group with ZHA lights"""
        try:
            # Validate all lights are entertainment capable
            valid_lights = [
                light for light in light_entities 
                if light.entertainment_capable
            ]
            
            if not valid_lights:
                return False
                
            # Create group
            self._entertainment_groups[group_id] = {
                "lights": valid_lights,
                "created": time.time()
            }
            
            _LOGGER.info(f"Created entertainment group {group_id} with {len(valid_lights)} lights")
            return True
            
        except Exception as e:
            _LOGGER.error(f"Failed to create entertainment group: {e}")
            return False
            
    async def start_entertainment_stream(self, group_id: str) -> bool:
        """Start entertainment streaming for group"""
        if group_id not in self._entertainment_groups:
            return False
            
        try:
            group = self._entertainment_groups[group_id]
            
            # Mark lights as entertainment active
            for light in group["lights"]:
                light._entertainment_active = True
                light._entertainment_group = group_id
                
            self._entertainment_active[group_id] = True
            
            _LOGGER.info(f"Started entertainment streaming for group {group_id}")
            return True
            
        except Exception as e:
            _LOGGER.error(f"Failed to start entertainment stream: {e}")
            return False
            
    async def stop_entertainment_stream(self, group_id: str) -> bool:
        """Stop entertainment streaming"""
        if group_id not in self._entertainment_groups:
            return False
            
        try:
            group = self._entertainment_groups[group_id]
            
            # Mark lights as entertainment inactive
            for light in group["lights"]:
                light._entertainment_active = False
                light._entertainment_group = None
                
            self._entertainment_active[group_id] = False
            
            _LOGGER.info(f"Stopped entertainment streaming for group {group_id}")
            return True
            
        except Exception as e:
            _LOGGER.error(f"Failed to stop entertainment stream: {e}")
            return False
            
    async def update_entertainment_colors(self, group_id: str, color_data: dict) -> bool:
        """Update colors for entertainment group"""
        if group_id not in self._entertainment_groups:
            return False
            
        if not self._entertainment_active.get(group_id, False):
            return False
            
        try:
            group = self._entertainment_groups[group_id]
            
            # Send bulk updates to all lights simultaneously
            tasks = []
            for light in group["lights"]:
                light_id = light.entity_id
                if light_id in color_data:
                    colors = color_data[light_id]
                    task = light.async_entertainment_update(
                        colors.get("x", 0.3),
                        colors.get("y", 0.3), 
                        colors.get("bri", 254)
                    )
                    tasks.append(task)
            
            # Execute all updates concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check if any updates succeeded
            success_count = sum(1 for result in results if result is True)
            
            return success_count > 0
            
        except Exception as e:
            _LOGGER.error(f"Entertainment color update failed: {e}")
            return False


# Integration with diyHue - modify your entertainment service:

class ZHAEntertainmentConnector:
    """Connector to interface diyHue with ZHA entertainment mode"""
    
    def __init__(self, ha_url: str, ha_token: str):
        self.ha_url = ha_url
        self.ha_token = ha_token
        self.websocket = None
        
    async def connect(self):
        """Connect to Home Assistant WebSocket"""
        # Implementation for WebSocket connection to HA
        pass
        
    async def create_entertainment_group(self, group_id: str, light_ids: list):
        """Create entertainment group via HA WebSocket"""
        message = {
            "type": "zha/entertainment/create_group",
            "group_id": group_id,
            "lights": light_ids
        }
        return await self._send_websocket_command(message)
        
    async def start_streaming(self, group_id: str):
        """Start entertainment streaming"""
        message = {
            "type": "zha/entertainment/start_stream", 
            "group_id": group_id
        }
        return await self._send_websocket_command(message)
        
    async def update_colors(self, group_id: str, color_data: dict):
        """Update entertainment colors"""
        message = {
            "type": "zha/entertainment/update_colors",
            "group_id": group_id,
            "colors": color_data
        }
        return await self._send_websocket_command(message)
        
    async def _send_websocket_command(self, message):
        """Send WebSocket command to Home Assistant"""
        # Implementation for sending WebSocket messages
        pass