#!/usr/bin/env python3
"""
DTLS Bridge for Entertainment Stream
Terminates DTLS from client and re-establishes to real Hue bridge
Handles PSK authentication on both sides
"""

import socket
import threading
import time
import logging
import subprocess
from subprocess import Popen, PIPE
import os
import select
import configManager

logging = logging.getLogger(__name__)
bridgeConfig = configManager.bridgeConfig.yaml_config

class DTLSBridge:
    """
    DTLS Bridge that:
    1. Accepts DTLS connection from client using DIYHue PSK
    2. Decrypts entertainment data  
    3. Re-encrypts and sends to real bridge using bridge PSK
    """
    
    def __init__(self, diyhue_user, diyhue_key, listen_port=2100, target_uuid=None, channel_map=None):
        self.listen_port = listen_port
        self.diyhue_user = diyhue_user
        self.diyhue_key = diyhue_key
        
        # Real bridge config
        self.bridge_ip = None
        self.bridge_port = 2100
        self.bridge_user = None
        self.bridge_key = None
        
        # Processes
        self.server_process = None  # OpenSSL server for client
        self.client_process = None  # OpenSSL client to bridge
        
        # Threading
        self.running = False
        self.bridge_thread = None

        # Stats
        self.packets_processed = 0
        self.last_packet_time = 0
        
        # Target Hue entertainment UUID (for HueStream v2 packet rewrite)
        self.target_uuid = target_uuid  # string like 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        # Mapping from DIY channel index -> Hue-only compacted index
        # Example: {3:0, 5:1, 7:2}
        self.channel_map = channel_map or {}

        # Local mirror (decrypted HueStream) to feed DIYHue processing for non-Hue lights
        try:
            streaming_cfg = bridgeConfig["config"].get("streaming", {})
            self.mirror_host = streaming_cfg.get("mirror_host", "127.0.0.1")
            self.mirror_port = int(streaming_cfg.get("mirror_port", 2101))
        except Exception:
            self.mirror_host = "127.0.0.1"
            self.mirror_port = 2101
        self._mirror_sock = None
        
        logging.info(f"DTLS Bridge initialized for user {diyhue_user[:8]}...")
    
    def configure_bridge(self, bridge_ip, bridge_user, bridge_key):
        """Configure real Hue bridge connection details"""
        self.bridge_ip = bridge_ip
        self.bridge_user = bridge_user
        self.bridge_key = bridge_key
        logging.info(f"Configured bridge connection to {bridge_ip}")
    
    def start(self):
        """Start the DTLS bridge"""
        if not self.bridge_ip:
            logging.error("Cannot start bridge: Real bridge not configured")
            return False
        
        try:
            # Allow overriding openssl binary via config: config.openssl.bin
            openssl_bin = bridgeConfig["config"].get("openssl", {}).get("bin", "openssl")
            # Kill any existing OpenSSL processes first
            subprocess.run(["killall", "openssl"], capture_output=True)
            time.sleep(0.2)
            
            # Start OpenSSL server to accept client connections
            server_cmd = [
                openssl_bin, 's_server',
                '-dtls1_2',                        # enforce DTLS 1.2
                '-cipher', 'PSK-AES128-GCM-SHA256', # Hue uses PSK GCM
                '-psk', self.diyhue_key,
                '-psk_identity', self.diyhue_user,
                '-nocert',
                '-accept', str(self.listen_port),
                '-quiet'
            ]
            
            logging.info(f"Starting DTLS server on port {self.listen_port} for client connections...")
            self.server_process = Popen(server_cmd, stdin=PIPE, stdout=PIPE, stderr=PIPE)
            
            time.sleep(0.5)  # Give server time to start
            
            # Check if server started successfully
            if self.server_process.poll() is not None:
                stderr = self.server_process.stderr.read().decode('utf-8') if self.server_process.stderr else ""
                stdout = self.server_process.stdout.read().decode('utf-8') if self.server_process.stdout else ""
                logging.error(f"DTLS server failed to start")
                logging.error(f"  stderr: {stderr}")
                logging.error(f"  stdout: {stdout}")
                logging.error(f"  Command was: {' '.join(server_cmd[:6])}...")
                return False
            
            # Start OpenSSL client to connect to real bridge
            client_cmd = [
                openssl_bin, 's_client',
                '-dtls1_2',
                '-cipher', 'PSK-AES128-GCM-SHA256',
                '-psk', self.bridge_key,
                '-psk_identity', self.bridge_user,
                '-mtu', '1200',                    # avoid EMSGSIZE on some stacks
                '-connect', f'{self.bridge_ip}:{self.bridge_port}',
                '-quiet'
            ]
            
            logging.info(f"Connecting DTLS client to real bridge at {self.bridge_ip}:{self.bridge_port}...")
            self.client_process = Popen(client_cmd, stdin=PIPE, stdout=PIPE, stderr=PIPE)
            
            time.sleep(0.5)  # Give client time to connect
            
            # Check if client connected successfully
            if self.client_process.poll() is not None:
                stderr = self.client_process.stderr.read().decode('utf-8') if self.client_process.stderr else ""
                stdout = self.client_process.stdout.read().decode('utf-8') if self.client_process.stdout else ""
                logging.error(f"DTLS client failed to connect to bridge")
                logging.error(f"  stderr: {stderr}")
                logging.error(f"  stdout: {stdout}")
                logging.error(f"  Bridge: {self.bridge_ip}:{self.bridge_port}")
                logging.error(f"  User: {self.bridge_user[:8]}...")
                logging.error(f"  Key: {self.bridge_key[:16]}... (length: {len(self.bridge_key)})")
                self.stop()
                return False
            
            self.running = True

            # Start bridge thread
            self.bridge_thread = threading.Thread(target=self._bridge_loop, daemon=True)
            self.bridge_thread.start()
            
            logging.info("✓ DTLS Bridge started successfully")
            logging.info(f"  Client → DIYHue:{self.listen_port} → Bridge:{self.bridge_ip}:{self.bridge_port}")
            
            return True
            
        except Exception as e:
            logging.error(f"Failed to start DTLS bridge: {e}")
            self.stop()
            return False
    
    def _bridge_loop(self):
        """Main bridge loop - forwards decrypted data between client and bridge"""
        logging.info("DTLS Bridge loop started")
        logging.info(f"  Waiting for client connection on port {self.listen_port}...")
        logging.info(f"  Connected to bridge at {self.bridge_ip}:{self.bridge_port}")
        
        buffer_size = 65536
        last_status_log = time.time()
        no_data_count = 0
        
        while self.running:
            try:
                # Check if processes are still alive
                if self.server_process.poll() is not None:
                    stderr = self.server_process.stderr.read().decode('utf-8') if self.server_process.stderr else ""
                    logging.error(f"DTLS server process died: {stderr}")
                    self.running = False
                    break
                
                if self.client_process.poll() is not None:
                    stderr = self.client_process.stderr.read().decode('utf-8') if self.client_process.stderr else ""
                    logging.error(f"DTLS client process died: {stderr}")
                    self.running = False
                    break
                
                # Use select to check for data
                ready_to_read = []
                if self.server_process.stdout:
                    ready_to_read.append(self.server_process.stdout)
                if self.client_process.stdout:
                    ready_to_read.append(self.client_process.stdout)
                
                if not ready_to_read:
                    time.sleep(0.001)
                    continue
                
                readable, _, _ = select.select(ready_to_read, [], [], 0.01)
                
                if readable:
                    no_data_count = 0
                    for stream in readable:
                        # Forward data from client to bridge
                        if stream == self.server_process.stdout:
                            data = os.read(self.server_process.stdout.fileno(), buffer_size)
                            if data:
                                self.packets_processed += 1
                                self.last_packet_time = time.time()
                                
                                # Always log first packet
                                if self.packets_processed == 1:
                                    logging.info(f"✓ First client packet received! ({len(data)} bytes)")
                                
                                # Log first few packets
                                if self.packets_processed <= 10:
                                    logging.info(f"Client→Bridge packet #{self.packets_processed} ({len(data)} bytes)")
                                    if data.startswith(b'HueStream'):
                                        logging.info("  ✓ HueStream packet detected")
                                    elif self.packets_processed <= 3:
                                        # Show hex preview for debugging
                                        preview = data[:32].hex()
                                        logging.debug(f"  Packet preview: {preview}")
                                
                                # Mirror decrypted packet to local processor (non-Hue lights)
                                try:
                                    if self._mirror_sock is None:
                                        self._mirror_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                        self._mirror_sock.setblocking(False)
                                    # Best-effort send; ignore EWOULDBLOCK
                                    self._mirror_sock.sendto(data, (self.mirror_host, self.mirror_port))
                                except Exception:
                                    pass

                                # Rewrite HueStream v2 UUID to match real bridge if needed
                                try:
                                    if self.target_uuid and len(data) >= 52 and data.startswith(b'HueStream') and data[9] == 2:
                                        # HueStream v2 UUID at bytes 16..52 (36 ASCII chars)
                                        pkt_uuid = data[16:52].decode('ascii', errors='ignore')
                                        if pkt_uuid != self.target_uuid and len(self.target_uuid) == 36:
                                            new_data = data[:16] + self.target_uuid.encode('ascii') + data[52:]
                                            data = new_data
                                            if self.packets_processed <= 5:
                                                logging.info("Rewrote HueStream UUID %s -> %s", pkt_uuid, self.target_uuid)
                                except Exception as e:
                                    # Non-fatal
                                    logging.debug(f"UUID rewrite skipped: {e}")

                                # Remap channel indices for HueStream v2 to match Hue-only group
                                try:
                                    if self.channel_map and data.startswith(b'HueStream') and len(data) > 60 and data[9] == 2:
                                        # Build new frame: header + only Hue channel blocks with remapped indices
                                        header = data[:52]
                                        i = 52
                                        end = len(data)
                                        out = bytearray(header)
                                        kept = 0
                                        while i + 6 < end:
                                            ch_idx = data[i]
                                            if ch_idx in self.channel_map:
                                                new_idx = self.channel_map[ch_idx]
                                                # Append 7-byte block with new index
                                                out.append(new_idx)
                                                out.extend(data[i+1:i+7])
                                                kept += 1
                                            # else: drop non-Hue channel
                                            i += 7
                                        data = bytes(out)
                                        if self.packets_processed <= 5:
                                            logging.info(f"Remapped channels: kept {kept} for Hue bridge")
                                except Exception as e:
                                    logging.debug(f"Channel remap skipped: {e}")

                                # Forward to bridge
                                if self.client_process.stdin:
                                    self.client_process.stdin.write(data)
                                    self.client_process.stdin.flush()
                        
                        # Forward data from bridge to client
                        elif stream == self.client_process.stdout:
                            data = os.read(self.client_process.stdout.fileno(), buffer_size)
                            if data:
                                # Forward to client
                                if self.server_process.stdin:
                                    self.server_process.stdin.write(data)
                                    self.server_process.stdin.flush()
                else:
                    no_data_count += 1
                    # Log periodically if we're not getting data
                    if no_data_count == 500:  # About 5 seconds
                        logging.info("Waiting for client to send entertainment data...")
                        no_data_count = 0
                
                # Log status periodically
                if time.time() - last_status_log > 10:
                    logging.info(f"DTLS Bridge status - Packets processed: {self.packets_processed}")
                    last_status_log = time.time()
                
            except Exception as e:
                logging.error(f"Error in bridge loop: {e}")
                if not self.running:
                    break
        
        logging.info("DTLS Bridge loop stopped")
    
    def get_stats(self):
        """Get bridge statistics"""
        return {
            "running": self.running,
            "bridge": f"{self.bridge_ip}:{self.bridge_port}" if self.bridge_ip else None,
            "packets_processed": self.packets_processed,
            "last_packet": self.last_packet_time,
            "server_alive": self.server_process.poll() is None if self.server_process else False,
            "client_alive": self.client_process.poll() is None if self.client_process else False
        }
    
    def stop(self):
        """Stop the DTLS bridge"""
        self.running = False
        
        # Kill OpenSSL processes
        if self.server_process:
            try:
                self.server_process.terminate()
                time.sleep(0.1)
                if self.server_process.poll() is None:
                    self.server_process.kill()
            except:
                pass
            self.server_process = None
        
        if self.client_process:
            try:
                self.client_process.terminate()
                time.sleep(0.1)
                if self.client_process.poll() is None:
                    self.client_process.kill()
            except:
                pass
            self.client_process = None
        
        # Wait for thread
        if self.bridge_thread and self.bridge_thread.is_alive():
            self.bridge_thread.join(timeout=2.0)
        
        logging.info(f"DTLS Bridge stopped (processed {self.packets_processed} packets)")


# Global bridge instance
_dtls_bridge = None

def get_dtls_bridge():
    """Get or create the global DTLS bridge instance"""
    global _dtls_bridge
    if _dtls_bridge is None:
        # This will be initialized with proper credentials when needed
        pass
    return _dtls_bridge

def start_dtls_bridge(diyhue_user, diyhue_key, bridge_ip, entertainment_uuid=None, channel_map=None):
    """Start the DTLS bridge with proper credentials"""
    global _dtls_bridge
    
    # Get bridge credentials from config
    if not bridgeConfig["config"].get("hue", {}).get("hueUser"):
        logging.error("No Hue bridge user configured")
        return False
    
    bridge_user = bridgeConfig["config"]["hue"]["hueUser"]
    
    # For entertainment, we need the client key (PSK) that was generated 
    # when we registered for entertainment access on the real bridge
    # This might be stored as:
    # 1. hueClientKey - specific entertainment key
    # 2. hueKey - general key 
    # 3. Same as hueUser - some bridges use the API key as PSK
    bridge_key = (bridgeConfig["config"]["hue"].get("hueClientKey") or 
                  bridgeConfig["config"]["hue"].get("hueKey") or 
                  bridge_user)
    
    logging.info(f"DTLS Bridge config:")
    logging.info(f"  DIYHue: user={diyhue_user[:8]}... key={diyhue_key[:16]}...")
    logging.info(f"  Bridge: user={bridge_user[:8]}... key={bridge_key[:16]}...")
    
    # Create and start bridge
    _dtls_bridge = DTLSBridge(diyhue_user, diyhue_key, target_uuid=entertainment_uuid, channel_map=channel_map)
    _dtls_bridge.configure_bridge(bridge_ip, bridge_user, bridge_key)
    
    return _dtls_bridge.start()

def stop_dtls_bridge():
    """Stop the DTLS bridge"""
    global _dtls_bridge
    if _dtls_bridge:
        _dtls_bridge.stop()
        _dtls_bridge = None


class MultiDTLSBridge:
    """
    One DTLS server (port 2100) fans-out decrypted frames to multiple Hue bridges.
    Applies per-target UUID rewrite and channel filter/remap.
    Also mirrors decrypted frames to local UDP for non-Hue processing.
    """
    def __init__(self, diyhue_user, diyhue_key, targets, listen_port=2100, mirror_host="127.0.0.1", mirror_port=2101):
        self.diyhue_user = diyhue_user
        self.diyhue_key = diyhue_key
        self.listen_port = listen_port
        self.targets = targets  # list of {ip,user,key,uuid,channel_map}
        self.mirror_host = mirror_host
        self.mirror_port = mirror_port
        self.server_process = None
        self.client_procs = []
        self.running = False
        self.thread = None
        self.mirror_sock = None

    def start(self):
        openssl_bin = bridgeConfig["config"].get("openssl", {}).get("bin", "openssl")
        # Start DTLS server
        server_cmd = [
            openssl_bin, 's_server', '-dtls1_2', '-cipher', 'PSK-AES128-GCM-SHA256',
            '-psk', self.diyhue_key, '-psk_identity', self.diyhue_user,
            '-nocert', '-accept', str(self.listen_port), '-quiet'
        ]
        self.server_process = Popen(server_cmd, stdin=PIPE, stdout=PIPE, stderr=PIPE)
        time.sleep(0.4)
        if self.server_process.poll() is not None:
            err = self.server_process.stderr.read().decode('utf-8') if self.server_process.stderr else ''
            logging.error(f"MultiDTLS server failed: {err}")
            return False
        # Start clients
        for t in self.targets:
            try:
                client_cmd = [
                    openssl_bin, 's_client', '-dtls1_2', '-cipher', 'PSK-AES128-GCM-SHA256',
                    '-psk', t['key'], '-psk_identity', t['user'], '-mtu', '1200',
                    '-connect', f"{t['ip']}:2100", '-quiet'
                ]
                proc = Popen(client_cmd, stdin=PIPE, stdout=PIPE, stderr=PIPE)
                time.sleep(0.2)
                if proc.poll() is not None:
                    er = proc.stderr.read().decode('utf-8') if proc.stderr else ''
                    logging.error(f"DTLS client failed for {t['ip']}: {er}")
                    continue
                self.client_procs.append({"proc": proc, **t})
            except Exception as e:
                logging.error(f"Failed DTLS client for {t.get('ip')}: {e}")
        if not self.client_procs:
            logging.error("No DTLS clients started; aborting")
            try:
                self.server_process.terminate()
            except Exception:
                pass
            return False
        # Mirror socket
        try:
            self.mirror_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.mirror_sock.setblocking(False)
        except Exception:
            self.mirror_sock = None
        # Thread
        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()
        logging.info(f"✓ MultiDTLS Bridge started with {len(self.client_procs)} targets")
        return True

    def _loop(self):
        buffer_size = 65536
        while self.running:
            try:
                if self.server_process.poll() is not None:
                    break
                r, _, _ = select.select([self.server_process.stdout], [], [], 0.05)
                if not r:
                    continue
                data = os.read(self.server_process.stdout.fileno(), buffer_size)
                if not data:
                    continue
                # Mirror locally
                try:
                    if self.mirror_sock:
                        self.mirror_sock.sendto(data, (self.mirror_host, self.mirror_port))
                except Exception:
                    pass
                # Send per-target
                for t in list(self.client_procs):
                    proc = t['proc']
                    if proc.poll() is not None:
                        self.client_procs.remove(t)
                        continue
                    out = data
                    try:
                        if out.startswith(b'HueStream') and len(out) > 60 and out[9] == 2:
                            # UUID rewrite
                            uuid = t.get('uuid')
                            if uuid and len(uuid) == 36:
                                if out[16:52].decode('ascii', 'ignore') != uuid:
                                    out = out[:16] + uuid.encode('ascii') + out[52:]
                            # Channel filter/remap
                            cmap = t.get('channel_map') or {}
                            if cmap:
                                header = out[:52]
                                i = 52
                                end = len(out)
                                ba = bytearray(header)
                                while i + 6 < end:
                                    ch = out[i]
                                    if ch in cmap:
                                        ba.append(cmap[ch])
                                        ba.extend(out[i+1:i+7])
                                    i += 7
                                out = bytes(ba)
                    except Exception:
                        pass
                    try:
                        proc.stdin.write(out)
                        proc.stdin.flush()
                    except Exception:
                        self.client_procs.remove(t)
                        try:
                            proc.terminate()
                        except Exception:
                            pass
            except Exception:
                if not self.running:
                    break
        self.stop()

    def stop(self):
        self.running = False
        if self.server_process:
            try:
                self.server_process.terminate()
            except Exception:
                pass
        for t in self.client_procs:
            try:
                t['proc'].terminate()
            except Exception:
                pass
        self.client_procs.clear()
        if self.thread and self.thread.is_alive():
            try:
                self.thread.join(timeout=1.0)
            except Exception:
                pass


_multi_dtls = None

def start_multi_dtls_bridge(diyhue_user, diyhue_key, targets, mirror_port=2101):
    global _multi_dtls
    _multi_dtls = MultiDTLSBridge(diyhue_user, diyhue_key, targets, listen_port=2100, mirror_port=mirror_port)
    return _multi_dtls.start()

def stop_multi_dtls_bridge():
    global _multi_dtls
    if _multi_dtls:
        _multi_dtls.stop()
        _multi_dtls = None
