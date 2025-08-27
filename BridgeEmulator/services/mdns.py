import logManager
import socket
import time
import threading
from zeroconf import IPVersion, ServiceInfo, Zeroconf
from zeroconf._exceptions import EventLoopBlocked, NonUniqueNameException

logging = logManager.logger.get_logger(__name__)

def mdnsListener(ip, port, modelid, brigeid):
    """mDNS service registration with proper error handling"""
    logging.info('<MDNS> listener starting')
    
    # Delay initial registration to allow network to stabilize
    time.sleep(2)
    
    max_retries = 3
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            ip_version = IPVersion.V4Only
            zeroconf = Zeroconf(ip_version=ip_version)
            
            props = {
                'modelid': modelid,
                'bridgeid': brigeid
            }
            
            service_name = f"DIYHue-{brigeid[-6:]}._hue._tcp.local."
            
            info = ServiceInfo(
                "_hue._tcp.local.",
                service_name,
                addresses=[socket.inet_aton(ip)],
                port=port,
                properties=props,
                server=f"DIYHue-{brigeid}.local."
            )
            
            # Register with a shorter timeout
            try:
                zeroconf.register_service(info)
                logging.info(f'<MDNS> Successfully registered service: {service_name}')
                
                # Keep the service running
                try:
                    while True:
                        time.sleep(60)  # Check every minute
                except KeyboardInterrupt:
                    pass
                finally:
                    logging.info('<MDNS> Unregistering service')
                    zeroconf.unregister_service(info)
                    zeroconf.close()
                    
                break  # Success, exit retry loop
                
            except EventLoopBlocked:
                logging.warning(f'<MDNS> Event loop blocked, attempt {attempt + 1}/{max_retries}')
                zeroconf.close()
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                else:
                    logging.error('<MDNS> Failed to register after all retries - service will run without mDNS')
                    
            except NonUniqueNameException:
                logging.warning(f'<MDNS> Service name {service_name} already registered')
                zeroconf.close()
                break
                
        except Exception as e:
            logging.error(f'<MDNS> Registration error: {e}')
            if attempt < max_retries - 1:
                logging.info(f'<MDNS> Retrying in {retry_delay} seconds...')
                time.sleep(retry_delay)
            else:
                logging.error('<MDNS> mDNS registration failed - bridge will work but may not be discoverable')
    
    logging.info('<MDNS> listener thread ending') 
