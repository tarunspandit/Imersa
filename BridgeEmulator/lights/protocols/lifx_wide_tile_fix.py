def _fallback_to_tile_colors(device, matrix_colors, light, zone_colors):
    """Fallback method using set_tile_colors with support for wide tiles (e.g., 16×8)."""
    try:
        # Get tile dimensions to handle wide tiles
        tile_width = 8  # Default
        tile_height = 8  # Default
        
        # Try to get actual tile dimensions
        if hasattr(device, 'get_tile_info'):
            try:
                tile_info = device.get_tile_info()
                if tile_info and len(tile_info) > 0:
                    tile_width = tile_info[0].width if hasattr(tile_info[0], 'width') else 8
                    tile_height = tile_info[0].height if hasattr(tile_info[0], 'height') else 8
                    logging.debug(f"LIFX: Tile dimensions for {light.name}: {tile_width}×{tile_height}")
            except:
                pass
        
        # Calculate total zones based on actual dimensions
        cfg = getattr(light, 'protocol_cfg', {})
        total_zones = cfg.get('total_zones', 0)
        
        if total_zones == 0:
            if hasattr(device, 'get_tile_count'):
                try:
                    tile_count = device.get_tile_count()
                    # Calculate zones based on actual dimensions
                    total_zones = tile_count * tile_width * tile_height
                except:
                    total_zones = tile_width * tile_height
            else:
                total_zones = len(matrix_colors) if matrix_colors else (tile_width * tile_height)
        
        # Only send the actual number of colors needed
        colors_to_send = matrix_colors[:total_zones]
        
        # Pad only to the actual zone count if needed
        while len(colors_to_send) < total_zones:
            colors_to_send.append([0, 0, 0, 3500])  # Black padding
        
        # For tiles wider than 8 (like 16×8 Ceiling), send multiple Set64 messages
        if tile_width > 8:
            # Need to send multiple Set64 messages with different x offsets
            num_chunks = (tile_width + 7) // 8  # Round up division
            logging.info(f"LIFX: Wide tile detected ({tile_width}×{tile_height}), sending {num_chunks} Set64 messages")
            
            for chunk_idx in range(num_chunks):
                x_offset = chunk_idx * 8
                chunk_width = min(8, tile_width - x_offset)
                
                # Extract colors for this chunk (8 columns at a time)
                chunk_colors = []
                for y in range(tile_height):
                    for x in range(8):  # Always send 8 columns worth
                        actual_x = x_offset + x
                        if actual_x < tile_width:
                            idx = y * tile_width + actual_x
                            if idx < len(colors_to_send):
                                chunk_colors.append(colors_to_send[idx])
                            else:
                                chunk_colors.append([0, 0, 0, 3500])
                        else:
                            # Pad with black if beyond tile width
                            chunk_colors.append([0, 0, 0, 3500])
                
                # Ensure we have exactly 64 colors
                while len(chunk_colors) < 64:
                    chunk_colors.append([0, 0, 0, 3500])
                chunk_colors = chunk_colors[:64]  # Ensure exactly 64
                
                # Send this chunk with appropriate x offset
                device.set_tile_colors(0, chunk_colors, duration=0,
                                     tile_count=1, x=x_offset, y=0, width=8, rapid=True)
                logging.info(f"LIFX: Sent Set64 for x={x_offset}-{x_offset+7} (64 colors)")
        
        # For standard tiles or multiple tiles
        elif hasattr(device, 'get_tile_count'):
            try:
                tile_count = device.get_tile_count()
                for tile_idx in range(tile_count):
                    start = tile_idx * 64
                    end = start + 64
                    tile_colors = colors_to_send[start:end]
                    # Pad this tile to 64 if needed
                    while len(tile_colors) < 64:
                        tile_colors.append([0, 0, 0, 3500])
                    device.set_tile_colors(tile_idx, tile_colors, duration=0, 
                                         tile_count=1, x=0, y=0, width=8, rapid=True)
                logging.debug(f"LIFX: set_tile_colors succeeded for {light.name} ({tile_count} tiles, {total_zones} zones)")
            except Exception as e:
                # Fallback to single tile
                device.set_tile_colors(0, colors_to_send[:64], duration=0, 
                                     tile_count=1, x=0, y=0, width=8, rapid=True)
                logging.debug(f"LIFX: set_tile_colors (single) succeeded for {light.name}")
        else:
            # Single tile device
            device.set_tile_colors(0, colors_to_send[:64], duration=0, 
                                 tile_count=1, x=0, y=0, width=8, rapid=True)
            logging.debug(f"LIFX: set_tile_colors succeeded for {light.name} ({len(colors_to_send)} colors)")
    except Exception as e:
        logging.error(f"LIFX: set_tile_colors failed for {light.name}: {e}")
        _fallback_to_average_color(device, zone_colors, light)