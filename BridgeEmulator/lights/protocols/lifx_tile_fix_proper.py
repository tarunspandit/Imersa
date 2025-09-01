def _fallback_to_tile_colors(device, matrix_colors, light, zone_colors):
    """Send colors to tile devices using the correct number of Set64 messages.
    
    Each Set64 message handles exactly 8×8 = 64 zones.
    For tiles larger than 8×8, we need multiple Set64 messages with different x,y offsets.
    """
    try:
        # Get tile information
        tile_infos = []
        if hasattr(device, 'get_tile_info'):
            try:
                tile_infos = device.get_tile_info()
                logging.info(f"LIFX: Got tile info for {light.name}: {len(tile_infos)} tile(s)")
            except Exception as e:
                logging.debug(f"LIFX: Could not get tile info: {e}")
        
        # If we couldn't get tile info, assume single 8×8 tile
        if not tile_infos:
            tile_infos = [{'width': 8, 'height': 8}]  # Default fallback
            
        # Process each tile
        color_idx = 0
        for tile_idx, tile_info in enumerate(tile_infos):
            # Get tile dimensions
            if hasattr(tile_info, 'width'):
                tile_width = tile_info.width
                tile_height = tile_info.height
            else:
                # Fallback to dict access or defaults
                tile_width = tile_info.get('width', 8)
                tile_height = tile_info.get('height', 8)
            
            logging.info(f"LIFX: Tile {tile_idx} dimensions: {tile_width}×{tile_height}")
            
            # Calculate how many Set64 messages we need for this tile
            # Each Set64 covers 8×8, so we need (width/8) × (height/8) messages
            num_x_chunks = (tile_width + 7) // 8  # Round up division
            num_y_chunks = (tile_height + 7) // 8  # Round up division
            
            total_set64_messages = num_x_chunks * num_y_chunks
            logging.info(f"LIFX: Tile {tile_idx} needs {total_set64_messages} Set64 message(s) "
                        f"({num_x_chunks}×{num_y_chunks} grid)")
            
            # Send Set64 messages for this tile
            for y_chunk in range(num_y_chunks):
                for x_chunk in range(num_x_chunks):
                    # Calculate x,y offsets for this Set64
                    x_offset = x_chunk * 8
                    y_offset = y_chunk * 8
                    
                    # Build 64 colors for this Set64 message
                    set64_colors = []
                    for y in range(8):  # Always 8 rows in Set64
                        for x in range(8):  # Always 8 cols in Set64
                            # Calculate actual position in the tile
                            actual_x = x_offset + x
                            actual_y = y_offset + y
                            
                            # Check if this position is within the tile bounds
                            if actual_x < tile_width and actual_y < tile_height:
                                # Calculate index in the linear color array
                                tile_linear_idx = actual_y * tile_width + actual_x
                                overall_idx = color_idx + tile_linear_idx
                                
                                # Get color if available
                                if overall_idx < len(matrix_colors):
                                    set64_colors.append(matrix_colors[overall_idx])
                                else:
                                    set64_colors.append([0, 0, 0, 3500])  # Black padding
                            else:
                                # Outside tile bounds, pad with black
                                set64_colors.append([0, 0, 0, 3500])
                    
                    # Ensure we have exactly 64 colors
                    while len(set64_colors) < 64:
                        set64_colors.append([0, 0, 0, 3500])
                    set64_colors = set64_colors[:64]  # Ensure exactly 64
                    
                    # Send this Set64 message
                    try:
                        device.set_tile_colors(
                            tile_index=tile_idx,
                            colors=set64_colors,
                            duration=0,
                            tile_count=1,
                            x=x_offset,
                            y=y_offset,
                            width=8,  # Always 8 for Set64
                            rapid=True
                        )
                        logging.debug(f"LIFX: Sent Set64 for tile {tile_idx} at "
                                     f"x={x_offset}-{x_offset+7}, y={y_offset}-{y_offset+7}")
                    except Exception as e:
                        logging.error(f"LIFX: Failed to send Set64 for tile {tile_idx}: {e}")
            
            # Move color index to next tile's starting position
            color_idx += tile_width * tile_height
            
        logging.info(f"LIFX: Successfully sent colors to {len(tile_infos)} tile(s) for {light.name}")
        
    except Exception as e:
        logging.error(f"LIFX: set_tile_colors failed for {light.name}: {e}")
        _fallback_to_average_color(device, zone_colors, light)


# Example usage patterns:
"""
1. Single 8×8 tile (standard Tile):
   - 1 Set64 message at (x=0, y=0)

2. Single 16×8 tile (LIFX Ceiling):
   - 2 Set64 messages:
     - Set64 #1: (x=0, y=0) for columns 0-7
     - Set64 #2: (x=8, y=0) for columns 8-15

3. Single 16×16 tile (hypothetical):
   - 4 Set64 messages:
     - Set64 #1: (x=0, y=0) for columns 0-7, rows 0-7
     - Set64 #2: (x=8, y=0) for columns 8-15, rows 0-7
     - Set64 #3: (x=0, y=8) for columns 0-7, rows 8-15
     - Set64 #4: (x=8, y=8) for columns 8-15, rows 8-15

4. Two 8×8 tiles:
   - Tile 0: 1 Set64 at (x=0, y=0)
   - Tile 1: 1 Set64 at (x=0, y=0)
   
5. Complex setup (e.g., 2 tiles: one 16×8, one 8×8):
   - Tile 0 (16×8): 2 Set64 messages at (x=0,y=0) and (x=8,y=0)
   - Tile 1 (8×8): 1 Set64 message at (x=0,y=0)
"""