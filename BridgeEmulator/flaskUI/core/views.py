from flask import render_template, request, Blueprint, redirect, url_for, make_response, send_file, send_from_directory
from werkzeug.security import generate_password_hash,check_password_hash
from flaskUI.core.forms import LoginForm
import flask_login
import uuid
import json
import configManager
from HueObjects import ApiUser
from flaskUI.core import User
from lights.light_types import lightTypes
from subprocess import check_output
from pprint import pprint
import os
import sys
import logManager
import subprocess
logging = logManager.logger.get_logger(__name__)
bridgeConfig = configManager.bridgeConfig.yaml_config
core = Blueprint('core',__name__)

# React UI Static Files
@core.route('/')
def index():
    # Serve React UI from local dist directory
    # Try local development path first
    local_react_dist = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'react-ui', 'dist')
    docker_react_path = '/opt/hue-emulator/react-ui'
    
    # Use local dist if available, otherwise Docker path
    if os.path.exists(os.path.join(local_react_dist, 'index.html')):
        logging.info(f"Serving React UI from {local_react_dist}")
        return send_from_directory(local_react_dist, 'index.html')
    elif os.path.exists(os.path.join(docker_react_path, 'index.html')):
        logging.info("Serving React UI from /opt/hue-emulator/react-ui")
        return send_from_directory(docker_react_path, 'index.html')
    else:
        # If React UI not found, return error
        logging.error("React UI not found")
        return "React UI not installed. Please build with 'npm run build' in react-ui directory.", 500

@core.route('/assets/<path:path>')
def static_assets(path):
    # Serve React static files from assets
    # Try local dist/assets first
    local_react_assets = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'react-ui', 'dist', 'assets')
    docker_react_assets = '/opt/hue-emulator/react-ui/assets'
    
    logging.info(f"Asset request: {path}")
    
    # Check local dist/assets first
    if os.path.exists(local_react_assets):
        local_full_path = os.path.join(local_react_assets, path)
        if os.path.exists(local_full_path):
            logging.info(f"Serving local asset: {path}")
            return send_from_directory(local_react_assets, path)
    
    # Fall back to Docker path
    docker_full_path = os.path.join(docker_react_assets, path)
    logging.info(f"React assets dir exists: {os.path.exists(docker_react_assets)}")
    
    # Check Docker path if local didn't work
    if os.path.exists(docker_react_assets):
        assets_list = os.listdir(docker_react_assets)
        logging.info(f"Files in Docker assets ({len(assets_list)} total): {assets_list[:10]}")
        
        # Check if exact file exists
        if os.path.exists(docker_full_path):
            logging.info(f"Found Docker asset, serving: {path}")
            return send_from_directory(docker_react_assets, path)
        else:
            logging.error(f"Asset file not found: {docker_full_path}")
    else:
        logging.error(f"Assets directory doesn't exist in either location")
    
    # Try Flask assets directory as fallback
    flask_assets = os.path.join(os.path.dirname(__file__), '..', 'assets')
    flask_asset_path = os.path.join(flask_assets, path)
    
    if os.path.exists(flask_asset_path):
        logging.info(f"Serving Flask asset: {path}")
        return send_from_directory(flask_assets, path)
    
    logging.error(f"Asset not found anywhere: {path}")
    return '', 404

@core.route('/vite.svg')
def vite_icon():
    # Serve vite icon
    local_react_dist = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'react-ui', 'dist')
    docker_react_path = '/opt/hue-emulator/react-ui'
    
    # Try local dist first
    if os.path.exists(os.path.join(local_react_dist, 'vite.svg')):
        return send_from_directory(local_react_dist, 'vite.svg')
    elif os.path.exists(os.path.join(docker_react_path, 'vite.svg')):
        return send_from_directory(docker_react_path, 'vite.svg')
    return '', 404

# Removed duplicate route - using the one at line 344 instead

@core.route('/debug/react-ui')
def debug_react_ui():
    # Debug endpoint to check React UI installation
    react_path = '/opt/hue-emulator/react-ui'
    react_assets = '/opt/hue-emulator/react-ui/assets'
    
    info = {
        'react_ui_exists': os.path.exists(react_path),
        'assets_exists': os.path.exists(react_assets),
        'react_ui_files': [],
        'assets_files': []
    }
    
    if os.path.exists(react_path):
        info['react_ui_files'] = os.listdir(react_path)
    
    if os.path.exists(react_assets):
        info['assets_files'] = os.listdir(react_assets)
    
    return info

@core.route('/get-key')
#@flask_login.login_required
def get_key():
    if len(bridgeConfig["apiUsers"]) == 0:
        # generate a new user for the web interface
        username = str(uuid.uuid1()).replace('-', '')
        bridgeConfig["apiUsers"][username] = ApiUser.ApiUser(username, 'WebUi', None)
        configManager.bridgeConfig.save_config()
    return list(bridgeConfig["apiUsers"])[0]

# Legacy JSON endpoint moved to avoid React route conflict
@core.route('/legacy/lights')
#@flask_login.login_required
def get_lights():
    result = {}
    for light, object in bridgeConfig["lights"].items():
        result[light] = object.save()
    return result

# Legacy JSON endpoint moved to avoid React route conflict
@core.route('/legacy/sensors')
#@flask_login.login_required
def get_sensors():
    result = {}
    for sensor, object in bridgeConfig["sensors"].items():
        result[sensor] = object.save()
    return result

@core.route('/light-types', methods=['GET', 'POST'])
#@flask_login.login_required
def get_light_types():
    if request.method == 'GET':
        result = []
        for modelid in lightTypes.keys():
            result.append(modelid)
        return {"result": result}
    elif request.method == 'POST':
        data = request.get_json(force=True)
        lightId = list(data)[0]
        modelId = data[lightId]
        bridgeConfig["lights"][lightId].modelid = modelId
        bridgeConfig["lights"][lightId].state = lightTypes[modelId]["state"]
        bridgeConfig["lights"][lightId].config = lightTypes[modelId]["config"]
        if modelId in ["LCX002", "915005987201", "LCX004", "LCX006"]:
            bridgeConfig["lights"][lightId].protocol_cfg["points_capable"] = 5
        return "success"

@core.route('/tradfri', methods=['POST'])
def pairTradfri():
    try:
        data = request.get_json(force=True)
        pprint(data)
        cmd = ["coap-client-gnutls", "-m", "post", "-u", "Client_identity", "-k", data["tradfriCode"], "-e", "{\"9090\":\"" + data["identity"] + "\"}", "coaps://" + data["tradfriGwIp"] + ":5684/15011/9063"]
        registration = json.loads(check_output(cmd).decode('utf-8').rstrip('\n').split("\n")[-1])
        if "9091" in registration:
            bridgeConfig["config"]["tradfri"] = {"psk": registration["9091"], "tradfriGwIp": data["tradfriGwIp"], "identity": data["identity"]}
            return {"result": "success", "psk": registration["9091"]}
        return {"result": registration}
    except Exception as e:
        return {"result": str(e)}

@core.route('/save')
def save_config():
    if request.args.get('backup', type = str) == "True":
        configManager.bridgeConfig.save_config(backup=True)
        return "backup config\n"
    else:
        configManager.bridgeConfig.save_config()
        return "config saved\n"

@core.route('/reset_config')
@flask_login.login_required
def reset_config():
    configManager.bridgeConfig.reset_config()
    return "config reset\n"

@core.route('/remove_cert')
@flask_login.login_required
def remove_cert():
    configManager.bridgeConfig.remove_cert()
    logging.info("restart " + str(sys.executable) + " with args : " + str(sys.argv))
    os.execl(sys.executable, sys.executable, *sys.argv)
    return "Certificate removed, restart python with args"

@core.route('/restore_config')
@flask_login.login_required
def restore_config():
    configManager.bridgeConfig.restore_backup()
    return "restore config\n"

@core.route('/download_config')
@flask_login.login_required
def download_config():
    path = configManager.bridgeConfig.download_config()
    return send_file(path, as_attachment=True)

@core.route('/download_log')
#@flask_login.login_required
def download_log():
    path = configManager.bridgeConfig.download_log()
    return send_file(path, as_attachment=True)

@core.route('/download_debug')
#@flask_login.login_required
def download_debug():
    path = configManager.bridgeConfig.download_debug()
    return send_file(path, as_attachment=True)

@core.route('/restart')
def restart():
    logging.info("restart " + str(sys.executable) + " with args : " + str(sys.argv))
    os.execl(sys.executable, sys.executable, *sys.argv)
    return "restart python with args"

@core.route('/info')
#@flask_login.login_required
def info():
    response = {}
    response["sysname"] = os.uname().sysname
    response["machine"] = os.uname().machine
    response["os_version"] = os.uname().version
    response["os_release"] = os.uname().release
    response["diyhue"] = subprocess.run("stat -c %y HueEmulator3.py", shell=True, capture_output=True, text=True).stdout.replace("\n", "")
    response["webui"] = subprocess.run("stat -c %y flaskUI/templates/index.html", shell=True, capture_output=True, text=True).stdout.replace("\n", "")
    return response

@core.route('/login', methods=['GET', 'POST'])
def login():
    # Bridge emulator doesn't require authentication - just redirect to main UI
    return redirect(url_for('core.index'))

@core.route('/description.xml')
def description_xml():
    HOST_HTTP_PORT = configManager.runtimeConfig.arg["HTTP_PORT"]
    mac = configManager.runtimeConfig.arg["MAC"]
    resp = make_response(render_template('description.xml', mimetype='text/xml', port=HOST_HTTP_PORT, name=bridgeConfig["config"]["name"], ipaddress=bridgeConfig["config"]["ipaddress"], serial=mac))
    resp.headers['Content-type'] = 'text/xml'
    return resp

@core.route('/logout')
@flask_login.login_required
def logout():
    flask_login.logout_user()
    return redirect(url_for('core.index'))

@core.route('/wled-settings')
def wled_settings():
    # Return JSON for React UI instead of template
    return {
        "wled_gradient_mode": bridgeConfig["config"].get("wled_gradient_mode", "sparse"),
        "status": "success"
    }

@core.route('/yeelight-settings', methods=['GET', 'POST'])
def yeelight_settings():
    music = bridgeConfig["config"].get("yeelight", {}).get("music", {})
    if request.method == 'POST':
        # Parse JSON for React UI
        data = request.get_json(force=True)
        
        # Ensure structure exists
        if "yeelight" not in bridgeConfig["config"]:
            bridgeConfig["config"]["yeelight"] = {"enabled": True}
        if "music" not in bridgeConfig["config"]["yeelight"]:
            bridgeConfig["config"]["yeelight"]["music"] = {}
        
        # Update settings
        bridgeConfig["config"]["yeelight"]["music"].update(data)
        configManager.bridgeConfig.save_config()
        
        return {"status": "success", "settings": bridgeConfig["config"]["yeelight"]["music"]}
    
    return {"status": "success", "settings": music}

@core.route('/lifx-settings', methods=['GET', 'POST'])
def lifx_settings():
    try:
        temp = bridgeConfig.setdefault("temp", {})
        integrations = temp.setdefault("integrations", {})
        lifx = integrations.setdefault("lifx", {
            "enabled": True, 
            "max_fps": 30, 
            "smoothing_enabled": False,
            "smoothing_ms": 50,
            "keepalive_interval": 45,
            "static_ips": []
        })
        if flask_login.current_user.is_authenticated or True:
            if request.method == 'POST':
                data = request.get_json(force=True)
                if isinstance(data, dict):
                    # Only accept specific keys
                    allowed_keys = ["enabled", "max_fps", "smoothing_enabled", "smoothing_ms", 
                                   "keepalive_interval", "static_ips"]
                    for k in allowed_keys:
                        if k in data:
                            lifx[k] = data[k]
                    
                    # Update entertainment settings in real-time
                    try:
                        from lights.protocols import lifx as lifx_protocol
                        lifx_protocol.update_entertainment_settings(lifx)
                    except Exception as e:
                        logging.debug(f"Could not update LIFX entertainment settings: {e}")
                    
                    # Persist a copy in config for durability
                    cfg = bridgeConfig.setdefault("config", {})
                    cfg_lifx = cfg.setdefault("lifx", {})
                    for k in allowed_keys:
                        if k in lifx:
                            cfg_lifx[k] = lifx[k]
                    configManager.bridgeConfig.save_config()
                return {"status": "success", "settings": lifx}
        return {"status": "success", "settings": lifx}
    except Exception as e:
        logging.debug(f"lifx-settings error: {e}")
        return {"status": "error", "message": str(e)}, 500

@core.route('/entertainment-wizard')
def entertainment_wizard():
    # React UI will handle the wizard
    return redirect(url_for('core.index'))

# Legacy routes that should redirect to React UI
@core.route('/ui')
@core.route('/ui/')
@core.route('/ui/<path:path>')
def ui_routes(path=None):
    # All UI routes handled by React
    local_react_dist = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'react-ui', 'dist')
    docker_react_path = '/opt/hue-emulator/react-ui'
    
    if os.path.exists(os.path.join(local_react_dist, 'index.html')):
        return send_from_directory(local_react_dist, 'index.html')
    else:
        return send_from_directory(docker_react_path, 'index.html')

@core.route('/index.html')
def ui_index_html():
    return redirect(url_for('core.index'))

@core.route('/ui/health')
def ui_health():
    return {"ui": "Imersa-React", "routes": [
        "/", "/lights", "/groups", "/scenes", "/schedules", 
        "/sensors", "/rules", "/entertainment", "/entertainment-wizard",
        "/wled-settings", "/yeelight-settings"
    ]}

# Convenience redirects
# (Handled by react_frontend_routes below)

# React Router front-end paths: serve index.html
@core.route('/lights')
@core.route('/groups')
@core.route('/scenes')
@core.route('/gradients')
@core.route('/entertainment')
@core.route('/entertainment/wizard')
@core.route('/wled')
@core.route('/scheduler')
@core.route('/automation')
@core.route('/sensors')
@core.route('/analytics')
@core.route('/devices')
@core.route('/settings')
@core.route('/help')
def react_frontend_routes():
    # All these routes are client-side handled by React Router.
    local_react_dist = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'react-ui', 'dist')
    docker_react_path = '/opt/hue-emulator/react-ui'
    if os.path.exists(os.path.join(local_react_dist, 'index.html')):
        return send_from_directory(local_react_dist, 'index.html')
    return send_from_directory(docker_react_path, 'index.html')
