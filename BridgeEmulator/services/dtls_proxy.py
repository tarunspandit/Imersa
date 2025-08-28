"""
DTLS Bridge for Entertainment Stream
Terminates DTLS from client and re-establishes to real Hue bridge
"""

import socket
import threading
import time
import logging
import struct
from queue import Queue, Empty
import select
import subprocess
from subprocess import Popen, PIPE
import os
import configManager

logging = logging.getLogger(__name__)
bridgeConfig = configManager.bridgeConfig.yaml_config

class DTLSProxy:
    """
    Transparent DTLS proxy that forwards packets untouched between client and Hue bridge.
    Since we sync UUIDs, we can forward everything transparently.
    """
    
    def __init__(self, listen_port=2100):
        self.listen_port = listen_port
        self.hue_bridge_ip = None
        self.hue_bridge_port = 2100
        
        # Sockets
        self.listen_socket = None
        self.bridge_socket = None
        
        # Client tracking
        self.client_address = None
        self.last_client_packet = 0
        
        # Threading
        self.running = False
        self.proxy_thread = None
        
        # Statistics
        self.packets_from_client = 0
        self.packets_to_bridge = 0
        self.packets_from_bridge = 0
        self.packets_to_client = 0
        
        logging.info(f"DTLS Proxy initialized on port {listen_port}")
    
    def configure_bridge(self, bridge_ip, bridge_port=2100):
        """Configure the real Hue bridge endpoint"""
        self.hue_bridge_ip = bridge_ip
        self.hue_bridge_port = bridge_port
        logging.info(f"Configured DTLS proxy to forward to {bridge_ip}:{bridge_port}")
    
    def start(self):
        """Start the DTLS proxy"""
        if not self.hue_bridge_ip:
            logging.error("Cannot start proxy: Hue bridge IP not configured")
            return False
        
        try:
            # Create listening socket for client connections
            self.listen_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.listen_socket.bind(('0.0.0.0', self.listen_port))
            self.listen_socket.setblocking(False)
            
            # Create socket for bridge connection
            self.bridge_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.bridge_socket.setblocking(False)
            
            self.running = True
            
            # Start proxy thread
            self.proxy_thread = threading.Thread(target=self._proxy_loop, daemon=True)
            self.proxy_thread.start()
            
            logging.info(f"✓ DTLS Proxy started on port {self.listen_port}")
            logging.info(f"  Forwarding to: {self.hue_bridge_ip}:{self.hue_bridge_port}")
            
            return True
            
        except Exception as e:
            logging.error(f"Failed to start DTLS proxy: {e}")
            self.stop()
            return False
    
    def _proxy_loop(self):
        """Main proxy loop - forwards packets bidirectionally"""
        logging.info(f"DTLS Proxy loop started - forwarding between 0.0.0.0:{self.listen_port} and {self.hue_bridge_ip}:{self.hue_bridge_port}")
        
        last_status_log = time.time()
        
        while self.running:
            try:
                # Log status every 10 seconds
                if time.time() - last_status_log > 10:
                    logging.info(f"DTLS Proxy status - Packets: client→bridge={self.packets_to_bridge}, bridge→client={self.packets_to_client}")
                    last_status_log = time.time()
                
                # Use select to monitor both sockets
                readable, _, _ = select.select(
                    [self.listen_socket, self.bridge_socket], 
                    [], 
                    [], 
                    0.1  # 100ms timeout
                )
                
                for sock in readable:
                    if sock == self.listen_socket:
                        # Packet from client -> forward to bridge
                        self._handle_client_packet()
                    
                    elif sock == self.bridge_socket:
                        # Packet from bridge -> forward to client
                        self._handle_bridge_packet()
                
                # Clean up stale client connection (30 second timeout)
                if self.client_address and time.time() - self.last_client_packet > 30:
                    logging.info(f"Client {self.client_address} timed out")
                    self.client_address = None
                    
            except Exception as e:
                logging.error(f"Error in proxy loop: {e}")
                if not self.running:
                    break
        
        logging.info("DTLS Proxy loop stopped")
    
    def _handle_client_packet(self):
        """Handle packet from client and forward to bridge"""
        try:
            # Receive from client
            data, addr = self.listen_socket.recvfrom(65536)
            
            # Update client tracking
            if self.client_address != addr:
                logging.info(f"✓ New client connected from {addr}")
                self.client_address = addr
            
            self.last_client_packet = time.time()
            self.packets_from_client += 1
            
            # Log ALL packets initially for debugging
            packet_preview = data[:100].hex() if len(data) > 100 else data.hex()
            logging.info(f"Client→Bridge packet #{self.packets_from_client} from {addr} ({len(data)} bytes)")
            
            # Check if it's a HueStream packet
            if data.startswith(b'HueStream'):
                logging.info(f"  ✓ HueStream packet detected")
            
            # Log first 20 packets in detail
            if self.packets_from_client <= 20:
                logging.debug(f"  Packet data: {packet_preview}...")
            
            # Forward UNTOUCHED to bridge
            sent = self.bridge_socket.sendto(data, (self.hue_bridge_ip, self.hue_bridge_port))
            self.packets_to_bridge += 1
            logging.debug(f"  → Forwarded {sent} bytes to {self.hue_bridge_ip}:{self.hue_bridge_port}")
            
        except socket.error as e:
            if e.errno != 11:  # Ignore EAGAIN/EWOULDBLOCK
                logging.error(f"Socket error handling client packet: {e}")
        except Exception as e:
            logging.error(f"Unexpected error handling client packet: {e}")
            import traceback
            logging.error(traceback.format_exc())
    
    def _handle_bridge_packet(self):
        """Handle packet from bridge and forward to client"""
        try:
            # Receive from bridge
            data, addr = self.bridge_socket.recvfrom(65536)
            
            # Verify it's from our configured bridge
            if addr[0] != self.hue_bridge_ip:
                logging.warning(f"Received packet from unexpected source: {addr}")
                return
            
            self.packets_from_bridge += 1
            
            # Log first few packets for debugging
            if self.packets_from_bridge <= 5:
                packet_preview = data[:50].hex() if len(data) > 50 else data.hex()
                logging.debug(f"Bridge->Client packet #{self.packets_from_bridge} ({len(data)} bytes): {packet_preview}...")
            
            # Forward UNTOUCHED to client (if we have one)
            if self.client_address:
                self.listen_socket.sendto(data, self.client_address)
                self.packets_to_client += 1
            else:
                logging.warning("Received bridge packet but no client connected")
                
        except socket.error as e:
            if e.errno != 11:  # Ignore EAGAIN/EWOULDBLOCK
                logging.error(f"Error handling bridge packet: {e}")
        except Exception as e:
            logging.error(f"Unexpected error handling bridge packet: {e}")
    
    def get_stats(self):
        """Get proxy statistics"""
        return {
            "running": self.running,
            "client": str(self.client_address) if self.client_address else None,
            "bridge": f"{self.hue_bridge_ip}:{self.hue_bridge_port}" if self.hue_bridge_ip else None,
            "packets": {
                "from_client": self.packets_from_client,
                "to_bridge": self.packets_to_bridge,
                "from_bridge": self.packets_from_bridge,
                "to_client": self.packets_to_client
            }
        }
    
    def stop(self):
        """Stop the DTLS proxy"""
        self.running = False
        
        # Close sockets
        if self.listen_socket:
            try:
                self.listen_socket.close()
            except:
                pass
            self.listen_socket = None
        
        if self.bridge_socket:
            try:
                self.bridge_socket.close()
            except:
                pass
            self.bridge_socket = None
        
        # Wait for thread
        if self.proxy_thread and self.proxy_thread.is_alive():
            self.proxy_thread.join(timeout=2.0)
        
        logging.info(f"DTLS Proxy stopped (forwarded {self.packets_to_bridge} packets to bridge, {self.packets_to_client} to client)")


# Global proxy instance
_dtls_proxy = None

def get_dtls_proxy():
    """Get or create the global DTLS proxy instance"""
    global _dtls_proxy
    if _dtls_proxy is None:
        _dtls_proxy = DTLSProxy()
    return _dtls_proxy

def start_dtls_proxy(bridge_ip, bridge_port=2100, listen_port=2100):
    """Start the DTLS proxy with configuration"""
    proxy = get_dtls_proxy()
    proxy.configure_bridge(bridge_ip, bridge_port)
    return proxy.start()

def stop_dtls_proxy():
    """Stop the DTLS proxy"""
    global _dtls_proxy
    if _dtls_proxy:
        _dtls_proxy.stop()
        _dtls_proxy = None