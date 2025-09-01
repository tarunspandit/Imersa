# Complete LIFX LAN Protocol Implementation Guide

## Protocol architecture and packet structure

The LIFX LAN protocol operates entirely over UDP port 56700 using binary messages with **little-endian byte ordering**. Every packet consists of a 36-byte header followed by an optional payload. The protocol requires no authentication, operating on network-level trust where devices accept commands from any source on the local network.

### Complete 36-byte header structure

The header divides into three distinct sections with precise byte positions:

**Frame Header (Bytes 0-7):**
```
Bytes 0-1:  size (uint16) - Total packet size including header
Bytes 2-3:  protocol (12 bits) + flags (4 bits)
  - Bits 0-11:  protocol (always 1024/0x0400)
  - Bit 12:     addressable (always 1)
  - Bit 13:     tagged (1=broadcast, 0=unicast)
  - Bits 14-15: origin (always 0)
Bytes 4-7:  source (uint32) - Unique client identifier
```

**Frame Address (Bytes 8-23):**
```
Bytes 8-15:  target (8 bytes) - Device MAC (6 bytes) + 2 zeros
Bytes 16-21: reserved (6 bytes) - Always zeros
Byte 22:     flags (8 bits)
  - Bit 0: res_required - Request state response
  - Bit 1: ack_required - Request acknowledgment
  - Bits 2-7: reserved
Byte 23:     sequence (uint8) - Message sequence number
```

**Protocol Header (Bytes 24-35):**
```
Bytes 24-31: reserved (8 bytes) - Always zeros
Bytes 32-33: type (uint16) - Message type identifier
Bytes 34-35: reserved (2 bytes) - Always zeros
```

### Bit packing implementation

For the protocol field at bytes 2-3, the bit packing works as follows when protocol=1024, addressable=1, tagged=0:
```python
combo = 1024 | (1 << 12) | (0 << 13) | (0 << 14)
# Results in 0x1400 (little-endian: 0x00 0x14)
```

## Standard bulb message types

### Core discovery and service messages

**GetService (Type 2)** initiates device discovery with no payload. Set tagged=1 and target=all zeros for broadcast discovery. Devices respond with **StateService (Type 3)** containing service type (1=UDP) and port number (typically 56700).

### Power control messages

**GetPower (20)** queries device power with empty payload, returning **StatePower (22)** with 2-byte power level (0=off, 65535=on). **SetPower (21)** sets power state with a 2-byte level field. The enhanced **GetLightPower (116)**, **SetLightPower (117)**, and **StateLightPower (118)** variants add duration support for smooth transitions.

### Color control messages

**GetColor (101)** queries current color, returning **LightState (107)** with complete device state. **SetColor (102)** changes color with this 13-byte payload structure:
```
Byte 0:     reserved (always 0)
Bytes 1-2:  hue (0-65535, maps to 0-360°)
Bytes 3-4:  saturation (0-65535, maps to 0-100%)
Bytes 5-6:  brightness (0-65535, maps to 0-100%)
Bytes 7-8:  kelvin (1500-9000K color temperature)
Bytes 9-12: duration (milliseconds for transition)
```

**LightState (107)** returns 52 bytes containing current HSBK values, power state, and 32-byte device label.

### Device information messages

**GetLabel (23)**, **SetLabel (24)**, and **StateLabel (25)** manage the 32-byte device label (not null-terminated). **GetVersion (32)** and **StateVersion (33)** report hardware details including vendor ID, product ID, and version. **GetInfo (34)** and **StateInfo (35)** provide runtime statistics including uptime and current time.

## Multizone message architecture

### Legacy multizone control

The original multizone protocol uses 8-zone segments with these core messages:

**GetColorZones (502)** queries zones with start/end indices, returning either **StateZone (503)** for single zones or **StateMultiZone (506)** for 8-zone segments. **SetColorZones (501)** sets contiguous zone ranges with HSBK color, duration, and apply flag.

### Extended multizone protocol

The extended protocol dramatically improves efficiency by handling up to 82 zones per message:

**SetExtendedColorZones (510)** sends all zone colors in one packet:
```
Bytes 0-3:   duration (milliseconds)
Byte 4:      apply (0=buffer, 1=apply now)
Bytes 5-6:   zone_index (starting position)
Byte 7:      colors_count (up to 82)
Bytes 8-663: colors (82 × 8-byte HSBK structures)
```

**GetExtendedColorZones (511)** queries all zones efficiently, with **StateExtendedColorZones (512)** returning zone data. Devices with >82 zones send multiple response packets with different zone_index values.

### Zone buffering strategy

The apply field enables synchronized updates across multiple zones. Send multiple messages with apply=0 (NO_APPLY) to buffer changes, then a final message with apply=1 (APPLY) to trigger simultaneous color changes.

## Tile and matrix control system

### Device chain discovery

**GetDeviceChain (701)** queries tile configuration, with **StateDeviceChain (702)** returning tile positions, dimensions, and orientation data. Each tile reports user_x and user_y coordinates representing its center point in tile-width units.

### 64-pixel tile control

**SetTileState64 (715)** controls individual tiles with this structure:
```
Byte 0:      tile_index (0=master tile)
Byte 1:      length (consecutive tiles to affect)
Byte 2:      x (starting x coordinate)
Byte 3:      y (starting y coordinate)
Byte 4:      width (update region width)
Bytes 5-8:   duration (transition milliseconds)
Bytes 9-520: colors (64 × 8-byte HSBK values)
```

**GetTileState64 (707)** queries tile colors, returning **StateTileState64 (711)** with current pixel states.

### Matrix coordinate mapping

Each tile contains 64 pixels in an 8×8 grid. The linear index mapping for right-side-up orientation:
```python
def xy_to_index(x, y):
    return x + (y * 8)

# Grid layout (0,0 at top-left):
#  0  1  2  3  4  5  6  7
#  8  9 10 11 12 13 14 15
# 16 17 18 19 20 21 22 23
# ...continues to index 63
```

### Orientation-aware mapping

Tiles report accelerometer data for automatic orientation detection. Apply rotation transformations based on orientation:
```python
def rotated_index(i, orientation):
    x, y = i % 8, i // 8
    if orientation == "UpsideDown":
        new_x, new_y = 7 - x, 7 - y
    elif orientation == "RotatedLeft":
        new_x, new_y = 7 - y, x
    elif orientation == "RotatedRight":
        new_x, new_y = y, 7 - x
    else:  # RightSideUp
        new_x, new_y = x, y
    return new_x + (new_y * 8)
```

## Device discovery implementation

Discovery uses UDP broadcast to enumerate all LIFX devices on the network:

```python
def discover_devices(timeout=5):
    # Create UDP socket with broadcast enabled
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(0.5)
    
    # Build GetService packet
    packet = build_header(
        message_type=2,  # GetService
        tagged=1,        # Broadcast mode
        target=None      # All zeros for broadcast
    )
    
    # Send to broadcast address
    sock.sendto(packet, ('255.255.255.255', 56700))
    
    # Collect responses
    devices = []
    start = time.time()
    while time.time() - start < timeout:
        try:
            data, addr = sock.recvfrom(1024)
            devices.append(parse_discovery_response(data, addr))
        except socket.timeout:
            continue
    
    return devices
```

## UDP socket configuration

Configure sockets for both broadcast and unicast communication:

```python
class LifxSocket:
    def __init__(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Enable broadcast capability
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        # Allow port reuse for multiple clients
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        # Bind to port 56700
        self.socket.bind(('0.0.0.0', 56700))
        
    def send_broadcast(self, packet):
        self.socket.sendto(packet, ('255.255.255.255', 56700))
        
    def send_unicast(self, packet, device_ip):
        self.socket.sendto(packet, (device_ip, 56700))
```

## Color space conversion algorithms

### RGB to HSBK conversion

Convert standard RGB (0-255) to LIFX HSBK format (0-65535):

```python
def rgb_to_hsbk(r, g, b, kelvin=3500):
    # Normalize to 0-1
    r_norm = r / 255.0
    g_norm = g / 255.0
    b_norm = b / 255.0
    
    # Calculate HSV components
    max_val = max(r_norm, g_norm, b_norm)
    min_val = min(r_norm, g_norm, b_norm)
    diff = max_val - min_val
    
    # Brightness
    brightness = max_val
    
    # Saturation
    saturation = 0 if max_val == 0 else diff / max_val
    
    # Hue calculation
    if diff == 0:
        hue = 0
    elif max_val == r_norm:
        hue = (60 * ((g_norm - b_norm) / diff) + 360) % 360
    elif max_val == g_norm:
        hue = (60 * ((b_norm - r_norm) / diff) + 120) % 360
    else:
        hue = (60 * ((r_norm - g_norm) / diff) + 240) % 360
    
    # Convert to LIFX scale
    hue_uint16 = int((65535 * hue / 360)) % 65536
    sat_uint16 = int(65535 * saturation)
    bri_uint16 = int(65535 * brightness)
    
    return (hue_uint16, sat_uint16, bri_uint16, kelvin)
```

### Kelvin to RGB approximation

```python
def kelvin_to_rgb(kelvin):
    temp = kelvin / 100
    
    if temp <= 66:
        red = 255
        green = 99.4708025861 * math.log(temp) - 161.1195681661
        blue = 138.5177312231 * math.log(temp - 10) - 305.0447927307 if temp >= 19 else 0
    else:
        red = 329.698727446 * math.pow(temp - 60, -0.1332047592)
        green = 288.1221695283 * math.pow(temp - 60, -0.0755148492)
        blue = 255
    
    return (
        max(0, min(255, int(red))),
        max(0, min(255, int(green))),
        max(0, min(255, int(blue)))
    )
```

## Zone mapping for multizone devices

Multizone devices use zero-based indexing starting from the controller end. Efficient zone updates leverage the extended protocol:

```python
def update_all_zones(device_id, colors):
    """Update all zones with optimal message strategy"""
    zone_count = len(colors)
    
    if zone_count <= 82:
        # Single extended message for all zones
        packet = build_extended_zones_packet(
            zone_index=0,
            colors=colors,
            apply=1  # Apply immediately
        )
        send_packet(device_id, packet)
    else:
        # Multiple messages for >82 zones
        for i in range(0, zone_count, 82):
            chunk = colors[i:i+82]
            packet = build_extended_zones_packet(
                zone_index=i,
                colors=chunk,
                apply=(i + 82 >= zone_count)  # Apply on last chunk
            )
            send_packet(device_id, packet)
```

## Packet encoding and decoding

### Building packets with struct

```python
import struct

def build_setcolor_packet(target_mac, hue, sat, bri, kelvin, duration=0):
    # Calculate sizes
    header_size = 36
    payload_size = 13
    total_size = header_size + payload_size
    
    # Build header components
    frame = struct.pack('<HHI',
        total_size,
        0x1400,  # protocol=1024, addressable=1, tagged=0
        2  # source ID
    )
    
    # Target address (MAC + padding)
    target = target_mac + b'\x00\x00'
    
    # Frame address
    frame_addr = struct.pack('<8s6sBB',
        target,
        b'\x00' * 6,  # reserved
        0x02,  # ack_required=1
        1  # sequence
    )
    
    # Protocol header
    proto_header = struct.pack('<8sH2s',
        b'\x00' * 8,  # reserved
        102,  # SetColor type
        b'\x00' * 2  # reserved
    )
    
    # Payload
    payload = struct.pack('<BHHHHHI',
        0,  # reserved
        hue, sat, bri, kelvin,
        duration
    )
    
    return frame + frame_addr + proto_header + payload
```

### Parsing received packets

```python
def parse_packet(data):
    if len(data) < 36:
        raise ValueError("Packet too short")
    
    # Parse header fields
    size, proto_flags = struct.unpack('<HH', data[0:4])
    source = struct.unpack('<I', data[4:8])[0]
    
    # Extract flags
    protocol = proto_flags & 0xFFF
    tagged = (proto_flags >> 13) & 1
    
    # Parse address
    target = data[8:16]
    flags = data[22]
    sequence = data[23]
    
    # Parse type
    msg_type = struct.unpack('<H', data[32:34])[0]
    
    return {
        'size': size,
        'source': source,
        'target': target,
        'sequence': sequence,
        'type': msg_type,
        'payload': data[36:]
    }
```

## Sequence number management

Maintain per-device sequence counters for request-response matching:

```python
class SequenceManager:
    def __init__(self):
        self.sequences = {}  # device_id -> current sequence
        self.pending = {}    # (source, sequence, target) -> callback
        
    def get_next_sequence(self, device_id):
        if device_id not in self.sequences:
            self.sequences[device_id] = 0
        else:
            self.sequences[device_id] = (self.sequences[device_id] + 1) % 256
        return self.sequences[device_id]
    
    def register_callback(self, source, sequence, target, callback):
        key = (source, sequence, target)
        self.pending[key] = callback
        
    def handle_response(self, packet):
        key = (packet['source'], packet['sequence'], packet['target'])
        if key in self.pending:
            callback = self.pending.pop(key)
            callback(packet)
```

## Rapid mode for low-latency updates

Rapid mode trades reliability for speed by sending multiple packets without waiting for acknowledgments:

```python
class RapidMode:
    def __init__(self, socket):
        self.socket = socket
        self.rapid_enabled = False
        
    def rapid_update(self, device_ip, packets):
        """Send multiple packets without waiting for ACK"""
        for packet in packets:
            # Clear ack_required flag for rapid mode
            packet = self.modify_ack_flag(packet, ack_required=False)
            self.socket.send_unicast(packet, device_ip)
            # Minimal delay between packets
            time.sleep(0.001)  # 1ms spacing
            
    def modify_ack_flag(self, packet, ack_required):
        # Modify byte 22 to set/clear ack_required
        packet_list = list(packet)
        if ack_required:
            packet_list[22] |= 0x02
        else:
            packet_list[22] &= ~0x02
        return bytes(packet_list)
```

## Keep-alive and connection monitoring

Since UDP is stateless, implement application-level monitoring:

```python
class ConnectionMonitor:
    def __init__(self, check_interval=30):
        self.last_seen = {}
        self.check_interval = check_interval
        
    def mark_device_seen(self, device_id):
        self.last_seen[device_id] = time.time()
        
    def check_device_health(self, device_id):
        """Send GetPower to check device responsiveness"""
        packet = build_get_power_packet(device_id)
        send_with_timeout(packet, device_id, timeout=2.0)
        
    def monitor_loop(self):
        while True:
            current_time = time.time()
            for device_id, last_time in self.last_seen.items():
                if current_time - last_time > self.check_interval:
                    self.check_device_health(device_id)
            time.sleep(self.check_interval)
```

## Error handling with exponential backoff

Implement robust retry logic for unreliable network conditions:

```python
def send_with_retry(packet, device_ip, max_retries=5):
    base_delay = 1.0
    max_delay = 60.0
    
    for attempt in range(max_retries):
        try:
            # Send packet
            socket.sendto(packet, (device_ip, 56700))
            
            # Wait for response with timeout
            socket.settimeout(2.0)
            response, addr = socket.recvfrom(1024)
            return response
            
        except socket.timeout:
            if attempt == max_retries - 1:
                raise
            
            # Calculate exponential backoff with jitter
            delay = min(base_delay * (2 ** attempt), max_delay)
            jitter = random.uniform(0, delay * 0.1)
            time.sleep(delay + jitter)
            
            print(f"Retry {attempt + 1}/{max_retries} after {delay:.2f}s")
```

## Frame rate limiting and smoothing

Implement intelligent rate limiting to prevent overwhelming devices:

```python
class RateLimiter:
    def __init__(self, max_rate=20, window=1.0):
        self.max_rate = max_rate
        self.window = window
        self.timestamps = defaultdict(deque)
        
    def can_send(self, device_id):
        now = time.time()
        queue = self.timestamps[device_id]
        
        # Remove old timestamps
        while queue and now - queue[0] > self.window:
            queue.popleft()
        
        return len(queue) < self.max_rate
    
    def wait_if_needed(self, device_id):
        while not self.can_send(device_id):
            # Calculate wait time
            queue = self.timestamps[device_id]
            wait_time = self.window - (time.time() - queue[0]) + 0.01
            time.sleep(wait_time)
        
        # Record this request
        self.timestamps[device_id].append(time.time())
```

### Color smoothing for animations

Implement smooth color transitions using linear interpolation:

```python
class ColorSmoother:
    def __init__(self, frame_rate=30):
        self.frame_rate = frame_rate
        self.frame_time = 1.0 / frame_rate
        
    def smooth_transition(self, start_color, end_color, duration_ms):
        """Generate smooth color transition frames"""
        frames = int(duration_ms / 1000.0 * self.frame_rate)
        
        for i in range(frames):
            t = i / float(frames - 1) if frames > 1 else 1
            
            # Linear interpolation for each component
            hue = self.lerp(start_color[0], end_color[0], t)
            sat = self.lerp(start_color[1], end_color[1], t)
            bri = self.lerp(start_color[2], end_color[2], t)
            kelvin = int(self.lerp(start_color[3], end_color[3], t))
            
            yield (int(hue), int(sat), int(bri), kelvin)
            
    def lerp(self, start, end, t):
        """Linear interpolation"""
        return start + (end - start) * t
```

## Complete implementation example

Here's a minimal but complete LIFX client implementation:

```python
class LifxClient:
    def __init__(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self.socket.bind(('0.0.0.0', 56700))
        self.source_id = random.randint(2, 0xFFFFFFFF)
        self.sequences = defaultdict(int)
        
    def discover(self):
        # Build GetService packet
        packet = struct.pack('<HHIHH8sHH6sBB8sHH',
            36,  # size
            0x3400,  # protocol + flags (tagged=1)
            self.source_id,
            0, 0,  # padding
            b'\x00' * 8,  # target (broadcast)
            0, 0,  # padding
            b'\x00' * 6,  # reserved
            0,  # flags
            0,  # sequence
            0, 0,  # reserved
            2,  # GetService
            0  # reserved
        )
        
        self.socket.sendto(packet, ('255.255.255.255', 56700))
        
    def set_color(self, mac_address, hue, sat, bri, kelvin=3500):
        # Get next sequence number
        seq = self.sequences[mac_address]
        self.sequences[mac_address] = (seq + 1) % 256
        
        # Build SetColor packet
        header = struct.pack('<HHIHH',
            49,  # size (36 header + 13 payload)
            0x1400,  # protocol + flags
            self.source_id,
            0, 0  # padding
        )
        
        address = struct.pack('<6s2s6sBB',
            bytes.fromhex(mac_address.replace(':', '')),
            b'\x00\x00',  # target padding
            b'\x00' * 6,  # reserved
            0x02,  # ack_required
            seq  # sequence
        )
        
        protocol = struct.pack('<8sHH',
            b'\x00' * 8,  # reserved
            102,  # SetColor
            0  # reserved
        )
        
        payload = struct.pack('<BHHHHHI',
            0,  # reserved
            hue, sat, bri, kelvin,
            0  # duration
        )
        
        packet = header + address + protocol + payload
        
        # Send to device (would need IP lookup in real implementation)
        self.socket.sendto(packet, ('<device_ip>', 56700))
```

## Conclusion

This comprehensive guide provides all the technical details necessary to implement the LIFX LAN protocol from scratch. The protocol's binary structure enables efficient control over UDP, while features like multizone and tile support allow sophisticated lighting effects. Key implementation considerations include proper byte ordering, rate limiting to prevent device overload, and robust error handling for UDP's unreliable nature. The extended multizone protocol and rapid mode offer significant performance improvements for advanced use cases, while the stateless design requires application-level monitoring for connection management.