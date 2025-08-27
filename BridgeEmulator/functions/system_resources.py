"""
System Resource Detection and Optimization
Automatically adapts performance settings based on available hardware
"""

import os
import platform
import logManager

logging = logManager.logger.get_logger(__name__)

class SystemProfile:
    """Detect and manage system resource profiles"""
    
    # Singleton instance
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SystemProfile, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.profile = self._detect_profile()
        self.settings = self._get_settings()
        self._initialized = True
        
        logging.info(f"System Profile: {self.profile}")
        logging.info(f"CPU Cores: {self.cpu_count}, Memory: {self.memory_gb:.1f}GB")
        logging.info(f"Platform: {self.platform_type}")
    
    def _detect_profile(self):
        """Detect system capabilities and return profile name"""
        self.cpu_count = os.cpu_count() or 1
        self.memory_gb = self._get_memory_gb()
        self.platform_type = self._detect_platform()
        
        # Raspberry Pi detection
        if self.platform_type == "raspberry_pi":
            if self.memory_gb < 0.6:  # RPi Zero/1 (512MB)
                return "rpi_minimal"
            elif self.memory_gb < 1.5:  # RPi 2/3 (1GB)
                return "rpi_low"
            else:  # RPi 4+ (2GB+)
                return "rpi_medium"
        
        # Docker detection
        elif self.platform_type == "docker":
            if self.memory_gb < 0.5:
                return "docker_minimal"
            elif self.memory_gb < 1.0:
                return "docker_low"
            else:
                return "docker_normal"
        
        # Regular systems
        else:
            if self.memory_gb < 1:
                return "minimal"
            elif self.memory_gb < 2:
                return "low"
            elif self.memory_gb < 4:
                return "medium"
            else:
                return "full"
    
    def _get_memory_gb(self):
        """Get total system memory in GB"""
        try:
            # Try /proc/meminfo first (Linux)
            with open('/proc/meminfo', 'r') as f:
                for line in f:
                    if line.startswith('MemTotal:'):
                        kb = int(line.split()[1])
                        return kb / (1024 * 1024)
        except:
            pass
        
        try:
            # Fallback to psutil if available
            import psutil
            return psutil.virtual_memory().total / (1024**3)
        except:
            pass
        
        # Default assumption
        return 2.0
    
    def _detect_platform(self):
        """Detect platform type"""
        # Check for Raspberry Pi
        try:
            with open('/proc/cpuinfo', 'r') as f:
                cpuinfo = f.read()
                if 'Raspberry Pi' in cpuinfo or 'BCM' in cpuinfo:
                    return "raspberry_pi"
        except:
            pass
        
        # Check for Docker
        try:
            with open('/proc/self/cgroup', 'r') as f:
                if 'docker' in f.read().lower():
                    return "docker"
        except:
            pass
        
        # Check if in container (generic)
        if os.path.exists('/.dockerenv'):
            return "docker"
        
        # Check platform
        system = platform.system().lower()
        if 'arm' in platform.machine().lower():
            return "arm_device"
        
        return system
    
    def _get_settings(self):
        """Get optimized settings for detected profile"""
        profiles = {
            "rpi_minimal": {
                "max_workers": 1,
                "udp_buffer": 8192,
                "max_lights": 20,
                "target_fps": 30,
                "frame_buffer": 2,
                "cie_tolerance": 0.020,
                "bri_tolerance": 12,
                "enable_smoothing": False,
                "log_level": "WARNING"
            },
            "rpi_low": {
                "max_workers": 2,
                "udp_buffer": 16384,
                "max_lights": 50,
                "target_fps": 45,
                "frame_buffer": 2,
                "cie_tolerance": 0.015,
                "bri_tolerance": 10,
                "enable_smoothing": True,
                "log_level": "INFO"
            },
            "rpi_medium": {
                "max_workers": 3,
                "udp_buffer": 32768,
                "max_lights": 100,
                "target_fps": 60,
                "frame_buffer": 3,
                "cie_tolerance": 0.010,
                "bri_tolerance": 8,
                "enable_smoothing": True,
                "log_level": "INFO"
            },
            "docker_minimal": {
                "max_workers": 1,
                "udp_buffer": 8192,
                "max_lights": 30,
                "target_fps": 30,
                "frame_buffer": 2,
                "cie_tolerance": 0.018,
                "bri_tolerance": 10,
                "enable_smoothing": False,
                "log_level": "WARNING"
            },
            "docker_low": {
                "max_workers": 2,
                "udp_buffer": 16384,
                "max_lights": 60,
                "target_fps": 45,
                "frame_buffer": 2,
                "cie_tolerance": 0.012,
                "bri_tolerance": 8,
                "enable_smoothing": True,
                "log_level": "INFO"
            },
            "docker_normal": {
                "max_workers": 4,
                "udp_buffer": 32768,
                "max_lights": 100,
                "target_fps": 60,
                "frame_buffer": 3,
                "cie_tolerance": 0.008,
                "bri_tolerance": 6,
                "enable_smoothing": True,
                "log_level": "INFO"
            },
            "minimal": {
                "max_workers": 2,
                "udp_buffer": 16384,
                "max_lights": 40,
                "target_fps": 30,
                "frame_buffer": 2,
                "cie_tolerance": 0.015,
                "bri_tolerance": 10,
                "enable_smoothing": False,
                "log_level": "WARNING"
            },
            "low": {
                "max_workers": 2,
                "udp_buffer": 32768,
                "max_lights": 60,
                "target_fps": 45,
                "frame_buffer": 3,
                "cie_tolerance": 0.012,
                "bri_tolerance": 8,
                "enable_smoothing": True,
                "log_level": "INFO"
            },
            "medium": {
                "max_workers": 4,
                "udp_buffer": 49152,
                "max_lights": 100,
                "target_fps": 60,
                "frame_buffer": 3,
                "cie_tolerance": 0.010,
                "bri_tolerance": 7,
                "enable_smoothing": True,
                "log_level": "INFO"
            },
            "full": {
                "max_workers": 8,
                "udp_buffer": 65536,
                "max_lights": 200,
                "target_fps": 60,
                "frame_buffer": 5,
                "cie_tolerance": 0.008,
                "bri_tolerance": 5,
                "enable_smoothing": True,
                "log_level": "DEBUG"
            }
        }
        
        return profiles.get(self.profile, profiles["medium"])
    
    def get_setting(self, key, default=None):
        """Get a specific setting value"""
        return self.settings.get(key, default)
    
    def is_low_resource(self):
        """Check if running on low-resource system"""
        return "minimal" in self.profile or "low" in self.profile
    
    def is_raspberry_pi(self):
        """Check if running on Raspberry Pi"""
        return self.platform_type == "raspberry_pi"
    
    def is_docker(self):
        """Check if running in Docker"""
        return self.platform_type == "docker"
    
    def get_recommendations(self):
        """Get optimization recommendations"""
        recs = []
        
        if self.is_low_resource():
            recs.append("Disable non-essential services (MQTT, HomeAssistant)")
            recs.append("Reduce number of active lights")
            recs.append("Use wired connection instead of WiFi")
            
        if self.is_raspberry_pi():
            recs.append("Use heatsink/fan for better thermal performance")
            recs.append("Use Class 10 SD card or better")
            recs.append("Consider overclocking if thermal solution allows")
            
        if self.is_docker():
            recs.append("Increase container memory limit if possible")
            recs.append("Use host networking mode for better performance")
            
        return recs

# Global instance
system_profile = SystemProfile()

def get_optimized_settings():
    """Get all optimized settings for current system"""
    return system_profile.settings

def get_worker_count():
    """Get optimal worker thread count"""
    return system_profile.get_setting("max_workers", 4)

def get_buffer_size():
    """Get optimal UDP buffer size"""
    return system_profile.get_setting("udp_buffer", 32768)

def get_tolerances():
    """Get optimal color/brightness tolerances"""
    return (
        system_profile.get_setting("cie_tolerance", 0.010),
        system_profile.get_setting("bri_tolerance", 8)
    )

def should_enable_feature(feature):
    """Check if a feature should be enabled based on resources"""
    if system_profile.is_low_resource():
        # Disable heavy features on low-resource systems
        heavy_features = ["homeassistant", "mqtt", "deconz", "animation_smoothing"]
        return feature not in heavy_features
    return True

def log_system_info():
    """Log system information and recommendations"""
    logging.info("=" * 60)
    logging.info("SYSTEM RESOURCE PROFILE")
    logging.info("=" * 60)
    logging.info(f"Profile: {system_profile.profile}")
    logging.info(f"Platform: {system_profile.platform_type}")
    logging.info(f"CPU Cores: {system_profile.cpu_count}")
    logging.info(f"Memory: {system_profile.memory_gb:.1f} GB")
    logging.info(f"Settings: {system_profile.settings}")
    
    recs = system_profile.get_recommendations()
    if recs:
        logging.info("Optimization Recommendations:")
        for rec in recs:
            logging.info(f"  • {rec}")
    logging.info("=" * 60)