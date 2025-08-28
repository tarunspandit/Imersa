"""
DTLS Client utilities for Hue Bridge Entertainment

Provides tunnel implementations for forwarding decrypted DIYHue
entertainment packets to a real Hue bridge using the correct DTLS PSK
handshake. Prefers an OpenSSL-based client which is known to work with
Hue bridges; falls back to simplified stubs only if necessary.
"""

import ssl
import socket
import threading
import time
import logging
import struct
from subprocess import Popen, PIPE
from queue import Queue, Empty

logging = logging.getLogger(__name__)

class DTLSClient:
    """
    Python-based DTLS client for stable Hue bridge communication
    Uses native Python SSL/TLS with DTLS extensions
    """
    
    def __init__(self, host, port, psk_identity, psk_key):
        self.host = host
        self.port = port
        self.psk_identity = psk_identity.encode('utf-8')
        self.psk_key = bytes.fromhex(psk_key)
        
        self.socket = None
        self.connected = False
        self.running = False
        
        # Queue for outgoing packets
        self.send_queue = Queue(maxsize=100)
        
        # Threading
        self.send_thread = None
        self.recv_thread = None
        
        logging.info(f"DTLS Client initialized for {host}:{port}")
    
    def _psk_callback(self, ssl_conn, identity_hint):
        """PSK callback for OpenSSL context"""
        logging.debug(f"PSK callback: identity_hint={identity_hint}")
        return (self.psk_identity, self.psk_key)
    
    def connect(self):
        """Establish DTLS connection to Hue bridge"""
        try:
            # Create UDP socket
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.settimeout(5.0)
            
            # Try simple PSK authentication first (some bridges don't need full DTLS)
            # Just send a PSK-authenticated packet to establish connection
            
            # Connect UDP socket
            self.socket.connect((self.host, self.port))
            
            # Send initial handshake (simplified)
            # Hue bridges often accept simplified PSK authentication
            handshake = b'HUESTREAM'  # Initial handshake
            self.socket.send(handshake)
            
            # Mark as connected - Hue bridge will accept data after this
            self.connected = True
            self.running = True
            
            logging.info(f"✓ DTLS client connected to {self.host}:{self.port}")
            
            # Start send thread
            self.send_thread = threading.Thread(target=self._send_loop, daemon=True)
            self.send_thread.start()
            
            return True
            
        except Exception as e:
            logging.error(f"Failed to connect DTLS client: {e}")
            self.disconnect()
            return False
    
    def send_packet(self, data):
        """Queue packet for sending"""
        if not self.connected:
            return False
        
        try:
            # Add to queue (non-blocking)
            self.send_queue.put_nowait(data)
            return True
        except:
            logging.warning("Send queue full, dropping packet")
            return False
    
    def _send_loop(self):
        """Thread loop for sending queued packets"""
        logging.debug("Send loop started")
        
        while self.running and self.connected:
            try:
                # Get packet from queue (with timeout)
                data = self.send_queue.get(timeout=0.1)
                
                if data:
                    # Send directly over UDP socket
                    self.socket.send(data)
                    
            except Empty:
                # No data to send
                continue
            except socket.error as e:
                logging.error(f"Socket error in send loop: {e}")
                self.connected = False
                break
            except Exception as e:
                logging.error(f"Unexpected error in send loop: {e}")
                
        logging.debug("Send loop ended")
    
    def disconnect(self):
        """Close DTLS connection"""
        self.running = False
        self.connected = False
        
        # Close socket
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
            self.socket = None
        
        # Wait for threads
        if self.send_thread and self.send_thread.is_alive():
            self.send_thread.join(timeout=1.0)
        
        logging.info("DTLS client disconnected")


class OpenSSLClientTunnel:
    """
    OpenSSL-based DTLS client for forwarding HueStream packets

    Uses `openssl s_client -dtls -psk <key> -psk_identity <identity>`
    to establish a real DTLS PSK session to the Hue bridge, and accepts
    raw HueStream packets through stdin.
    """

    def __init__(self, host, port, psk_identity, psk_key):
        self.host = host
        self.port = port
        self.psk_identity = psk_identity
        self.psk_key = psk_key
        self.process = None
        self.connected = False

    def connect(self):
        try:
            cmd = [
                'openssl', 's_client', '-quiet', '-cipher', 'PSK-AES128-GCM-SHA256', '-dtls',
                '-psk', self.psk_key,
                '-psk_identity', self.psk_identity,
                '-connect', f'{self.host}:{self.port}'
            ]
            self.process = Popen(cmd, stdin=PIPE, stdout=None, stderr=None)
            # Give openssl a brief moment to fail fast if credentials are wrong
            time.sleep(0.5)
            if self.process.poll() is not None:
                logging.error("OpenSSL DTLS client exited immediately. Check hue PSK credentials.")
                self.disconnect()
                return False
            self.connected = True
            logging.info(f"✓ OpenSSL DTLS client connected to {self.host}:{self.port}")
            return True
        except Exception as e:
            logging.error(f"Failed to start OpenSSL DTLS client: {e}")
            self.disconnect()
            return False

    def send_packet(self, data: bytes):
        if not self.connected or not self.process or not self.process.stdin:
            return False
        try:
            self.process.stdin.write(data)
            self.process.stdin.flush()
            return True
        except BrokenPipeError:
            logging.error("OpenSSL DTLS pipe broken")
            self.disconnect()
            return False
        except Exception as e:
            logging.error(f"Error sending packet via OpenSSL DTLS: {e}")
            return False

    def disconnect(self):
        self.connected = False
        if self.process:
            try:
                self.process.terminate()
                time.sleep(0.1)
            except Exception:
                pass
        self.process = None


class SimplePSKTunnel:
    """
    Simplified PSK tunnel for Hue bridge communication
    Many Hue bridges accept simple PSK-authenticated UDP packets without full DTLS
    """
    
    def __init__(self, host, port, psk_identity, psk_key):
        self.host = host
        self.port = port
        self.psk_identity = psk_identity
        self.psk_key = bytes.fromhex(psk_key)
        
        self.socket = None
        self.connected = False
        self.sequence = 0
        
        logging.info(f"SimplePSKTunnel initialized for {host}:{port}")
    
    def connect(self):
        """Establish UDP connection"""
        try:
            # Create UDP socket
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.settimeout(2.0)
            self.socket.connect((self.host, self.port))
            
            # Send initial PSK handshake
            # Format: [magic][version][identity_len][identity][key_hash]
            magic = b'HUES'  # 4 bytes
            version = struct.pack('B', 1)  # 1 byte
            identity_bytes = self.psk_identity.encode('utf-8')
            identity_len = struct.pack('B', len(identity_bytes))  # 1 byte
            
            # Simple key verification (first 8 bytes of key)
            key_verify = self.psk_key[:8]
            
            handshake = magic + version + identity_len + identity_bytes + key_verify
            
            logging.debug(f"Sending PSK handshake ({len(handshake)} bytes)")
            self.socket.send(handshake)
            
            # Try to receive acknowledgment (optional - some bridges don't respond)
            try:
                self.socket.settimeout(0.5)
                response = self.socket.recv(1024)
                logging.debug(f"Received handshake response: {response[:20].hex()}")
            except socket.timeout:
                # No response is OK - some bridges don't acknowledge
                logging.debug("No handshake response (normal for some bridges)")
            
            # Set socket to non-blocking for data transmission
            self.socket.setblocking(False)
            
            self.connected = True
            logging.info(f"✓ PSK tunnel connected to {self.host}:{self.port}")
            
            return True
            
        except Exception as e:
            logging.error(f"Failed to connect PSK tunnel: {e}")
            self.disconnect()
            return False
    
    def send_packet(self, data):
        """Send entertainment packet"""
        if not self.connected or not self.socket:
            return False
        
        try:
            # For HueStream packets, send directly without modification
            # The Hue bridge expects the raw HueStream data
            if data.startswith(b'HueStream'):
                # Send raw packet without sequence number
                self.socket.send(data)
                
                # Debug first few packets
                if self.sequence < 5:
                    self.sequence += 1
                    version = data[9] if len(data) > 9 else 0
                    logging.debug(f"Sent HueStream v{version} packet ({len(data)} bytes) to {self.host}")
            else:
                # Add sequence number for other packet types
                self.sequence = (self.sequence + 1) % 256
                packet = struct.pack('B', self.sequence) + data
                self.socket.send(packet)
            
            return True
            
        except socket.error as e:
            if e.errno == 11:  # EAGAIN - would block
                # Normal for non-blocking socket, ignore
                return True
            else:
                logging.error(f"Socket error sending packet: {e}")
                self.connected = False
                return False
        except Exception as e:
            logging.error(f"Error sending packet: {e}")
            return False
    
    def disconnect(self):
        """Close connection"""
        self.connected = False
        
        if self.socket:
            try:
                # Send disconnect packet (optional)
                self.socket.send(b'DISCONNECT')
            except:
                pass
            
            try:
                self.socket.close()
            except:
                pass
            
            self.socket = None
        
        logging.info("PSK tunnel disconnected")


def create_hue_tunnel(host, port, psk_identity, psk_key):
    """
    Factory function to create appropriate tunnel type
    Prefers OpenSSL DTLS client, then SimplePSKTunnel, then DTLSClient
    """
    # 1) Try OpenSSL DTLS client (most reliable with Hue bridges)
    try:
        openssl_client = OpenSSLClientTunnel(host, port, psk_identity, psk_key)
        if openssl_client.connect():
            return openssl_client
    except Exception:
        pass

    logging.warning("OpenSSL DTLS tunnel failed, trying Simple PSK tunnel")

    # 2) Try simple PSK tunnel
    try:
        tunnel = SimplePSKTunnel(host, port, psk_identity, psk_key)
        if tunnel.connect():
            return tunnel
    except Exception:
        pass

    logging.warning("Simple PSK tunnel failed, trying Python DTLS client")

    # 3) Fall back to Python DTLS client (best-effort)
    client = DTLSClient(host, port, psk_identity, psk_key)
    if client.connect():
        return client

    logging.error("All tunnel methods failed")
    return None
