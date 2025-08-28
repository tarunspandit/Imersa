"""
UUID Mapper for Entertainment Groups
Maps DIYHue group UUIDs to real Hue bridge UUIDs
"""

import json
import os
import logging
from threading import Lock

logging = logging.getLogger(__name__)

class UUIDMapper:
    """
    Manages UUID mappings between DIYHue and real Hue bridge
    Persists mappings to disk for consistency across restarts
    """
    
    def __init__(self, config_path="/opt/hue-emulator/config/uuid_mappings.json"):
        self.config_path = config_path
        self.mappings = {}
        self.lock = Lock()
        self.load()
    
    def load(self):
        """Load UUID mappings from disk"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    self.mappings = json.load(f)
                logging.info(f"Loaded {len(self.mappings)} UUID mappings")
        except Exception as e:
            logging.warning(f"Could not load UUID mappings: {e}")
            self.mappings = {}
    
    def save(self):
        """Save UUID mappings to disk"""
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, 'w') as f:
                json.dump(self.mappings, f, indent=2)
            logging.debug(f"Saved {len(self.mappings)} UUID mappings")
        except Exception as e:
            logging.error(f"Failed to save UUID mappings: {e}")
    
    def add_mapping(self, group_name, diyhue_uuid, bridge_uuid, bridge_group_id=None):
        """Add or update a UUID mapping"""
        with self.lock:
            self.mappings[group_name] = {
                "diyhue_uuid": diyhue_uuid,
                "bridge_uuid": bridge_uuid,
                "bridge_group_id": bridge_group_id,
                "last_updated": str(os.path.getmtime(self.config_path) if os.path.exists(self.config_path) else 0)
            }
            self.save()
            logging.info(f"Mapped group '{group_name}': DIYHue {diyhue_uuid} -> Bridge {bridge_uuid}")
    
    def get_bridge_uuid(self, group_name):
        """Get bridge UUID for a group"""
        with self.lock:
            if group_name in self.mappings:
                return self.mappings[group_name].get("bridge_uuid")
            return None
    
    def get_bridge_group_id(self, group_name):
        """Get bridge group ID for a group"""
        with self.lock:
            if group_name in self.mappings:
                return self.mappings[group_name].get("bridge_group_id")
            return None
    
    def get_diyhue_uuid(self, group_name):
        """Get DIYHue UUID for a group"""
        with self.lock:
            if group_name in self.mappings:
                return self.mappings[group_name].get("diyhue_uuid")
            return None
    
    def remove_mapping(self, group_name):
        """Remove a UUID mapping"""
        with self.lock:
            if group_name in self.mappings:
                del self.mappings[group_name]
                self.save()
                logging.info(f"Removed UUID mapping for group '{group_name}'")
    
    def get_all_mappings(self):
        """Get all UUID mappings"""
        with self.lock:
            return self.mappings.copy()


# Global mapper instance
_uuid_mapper = None

def get_uuid_mapper():
    """Get or create the global UUID mapper instance"""
    global _uuid_mapper
    if _uuid_mapper is None:
        _uuid_mapper = UUIDMapper()
    return _uuid_mapper