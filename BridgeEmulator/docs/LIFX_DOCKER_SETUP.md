# LIFX Docker Setup Guide

## Overview
This guide helps you configure LIFX discovery to work properly in Docker containers.

## Network Modes

### 1. Host Network Mode (Recommended for LIFX)
Using host network mode allows the container to directly access your network, making LIFX discovery work best.

```yaml
version: '3'
services:
  imersa:
    container_name: imersa
    image: imersa:latest
    network_mode: host
    environment:
      - DOCKER_CONTAINER=true
```

### 2. Bridge Network Mode (Default)
If you must use bridge network mode, you'll need to configure static IPs for your LIFX devices.

```yaml
version: '3'
services:
  imersa:
    container_name: imersa
    image: imersa:latest
    ports:
      - "80:80"
      - "443:443"
      - "56700:56700/udp"  # LIFX port
    environment:
      - DOCKER_CONTAINER=true
      - LIFX_STATIC_IPS=192.168.1.243,192.168.1.191,192.168.1.27,192.168.1.231,192.168.1.45,192.168.1.42,192.168.1.77,192.168.1.186,192.168.1.147
```

## Configuration Options

### Static IP Configuration
If automatic discovery doesn't find all devices, you can specify static IPs:

1. In your configuration file, add:
```json
{
  "lights": {
    "protocols": {
      "lifx": {
        "static_ips": [
          "192.168.1.243",
          "192.168.1.191",
          "192.168.1.27",
          "192.168.1.231",
          "192.168.1.45",
          "192.168.1.42",
          "192.168.1.77",
          "192.168.1.186",
          "192.168.1.147"
        ]
      }
    }
  }
}
```

2. Or set via environment variable:
```bash
LIFX_STATIC_IPS=192.168.1.243,192.168.1.191,192.168.1.27
```

## Troubleshooting

### Not all devices found
1. **Check network mode**: Host mode works best for LIFX discovery
2. **Configure static IPs**: List all your LIFX device IPs manually
3. **Check firewall**: Ensure UDP port 56700 is open
4. **Increase timeout**: The discovery timeout is automatically increased in Docker

### Discovery takes too long
The Docker discovery is optimized to scan multiple network ranges. It may take 10-15 seconds to find all devices.

### Devices found but not controllable
Ensure the container can reach the LIFX devices:
```bash
docker exec imersa ping 192.168.1.243  # Replace with your LIFX IP
```

## Docker Discovery Behavior

When running in Docker, the LIFX discovery:
1. Scans common Docker network ranges (172.17.x.x, 172.18.x.x)
2. Scans your home network range (192.168.x.x)
3. Increases discovery timeout to 10 seconds
4. Supports up to 500 IP addresses (vs 254 normally)
5. Prioritizes static IPs if configured

## Best Practices

1. **Use host network mode** when possible for best compatibility
2. **Configure static IPs** as a backup for reliable discovery
3. **Test discovery** after container restart to ensure all devices are found
4. **Monitor logs** to see how many devices are discovered:
   ```bash
   docker logs imersa | grep "LIFX discovery"
   ```