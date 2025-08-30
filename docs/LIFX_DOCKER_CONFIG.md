# LIFX Configuration for Docker

## Network Configuration

For LIFX discovery to work properly in Docker, you need to configure the network correctly.

### Option 1: Host Network Mode (Recommended)

Add to your `docker-compose.yml`:

```yaml
services:
  bridge:
    network_mode: host
```

This allows the container to use the host's network stack directly, enabling UDP broadcast discovery.

### Option 2: Bridge Network with Static IPs

If you can't use host networking, configure static IPs:

```python
# In your configuration
lifx_config = {
    "static_ips": [
        "192.168.1.98",   # Your LIFX bulb IPs
        "192.168.1.182",
        "192.168.1.237"
    ],
    "num_lights": 3,      # Speed up discovery
    "discovery_timeout": 10  # Increase timeout for Docker
}
```

### Option 3: Custom Bridge Network

Create a custom bridge network that supports multicast:

```bash
docker network create --driver bridge \
  --opt com.docker.network.bridge.enable_ip_masquerade=true \
  --opt com.docker.network.bridge.enable_icc=true \
  lifx-network
```

## Troubleshooting

1. **Only 1 light found**: This usually means broadcast discovery is blocked. Use static IPs.

2. **No lights found**: Check firewall rules for UDP port 56700.

3. **Slow discovery**: Provide `num_lights` hint to speed up discovery.

## Environment Variables

```bash
# Add to .env or docker-compose.yml
LIFX_NUM_LIGHTS=3
LIFX_DISCOVERY_TIMEOUT=10
LIFX_STATIC_IPS=192.168.1.98,192.168.1.182,192.168.1.237
```