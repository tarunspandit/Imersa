"""
Alternative async mDNS implementation for better performance
Use this if the main mdns.py continues to have issues
"""

import asyncio
import logManager
import socket
from typing import Optional
from zeroconf import IPVersion, ServiceInfo, Zeroconf
from zeroconf.asyncio import AsyncZeroconf
from zeroconf._exceptions import EventLoopBlocked, NonUniqueNameException

logging = logManager.logger.get_logger(__name__)

class AsyncMDNSService:
    """Async mDNS service registration"""
    
    def __init__(self, ip: str, port: int, modelid: str, bridgeid: str):
        self.ip = ip
        self.port = port
        self.modelid = modelid
        self.bridgeid = bridgeid
        self.azc: Optional[AsyncZeroconf] = None
        self.info: Optional[ServiceInfo] = None
        
    async def start(self):
        """Start mDNS service registration"""
        logging.info('<MDNS> Async listener starting')
        
        # Wait a bit for network to stabilize
        await asyncio.sleep(2)
        
        try:
            # Create async zeroconf instance
            self.azc = AsyncZeroconf(ip_version=IPVersion.V4Only)
            
            props = {
                'modelid': self.modelid,
                'bridgeid': self.bridgeid
            }
            
            service_name = f"DIYHue-{self.bridgeid[-6:]}._hue._tcp.local."
            
            self.info = ServiceInfo(
                "_hue._tcp.local.",
                service_name,
                addresses=[socket.inet_aton(self.ip)],
                port=self.port,
                properties=props,
                server=f"DIYHue-{self.bridgeid}.local."
            )
            
            # Register service with timeout
            try:
                await asyncio.wait_for(
                    self.azc.async_register_service(self.info),
                    timeout=10.0
                )
                logging.info(f'<MDNS> Successfully registered async service: {service_name}')
                
            except asyncio.TimeoutError:
                logging.warning('<MDNS> Registration timed out, continuing without mDNS')
            except EventLoopBlocked:
                logging.warning('<MDNS> Event loop blocked, continuing without mDNS')
            except NonUniqueNameException:
                logging.info('<MDNS> Service already registered')
                
        except Exception as e:
            logging.error(f'<MDNS> Async registration error: {e}')
    
    async def stop(self):
        """Stop mDNS service"""
        if self.azc and self.info:
            try:
                await self.azc.async_unregister_service(self.info)
                await self.azc.async_close()
                logging.info('<MDNS> Service unregistered')
            except Exception as e:
                logging.error(f'<MDNS> Error during shutdown: {e}')

def mdnsListenerAsync(ip, port, modelid, bridgeid):
    """Async wrapper for thread compatibility"""
    async def run():
        service = AsyncMDNSService(ip, port, modelid, bridgeid)
        await service.start()
        
        # Keep running
        try:
            while True:
                await asyncio.sleep(60)
        except KeyboardInterrupt:
            await service.stop()
    
    # Run in new event loop
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run())
    except Exception as e:
        logging.error(f'<MDNS> Async listener error: {e}')
    finally:
        loop.close()
        
    logging.info('<MDNS> Async listener thread ending')