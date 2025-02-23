# API-server som henter data fra Windows-PC ved hjelp av Open Hardware Monitor

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests

app = Flask(__name__, static_folder='static')
CORS(app)

WINDOWS_PC_IP = "192.168.1.196"
OHM_API_URL = f"http://{WINDOWS_PC_IP}:8085/data.json"
NETWORK_API_URL = "http://localhost:61208/api/4/network"

def fetch_ohm_data():
    """Fetch data from Open Hardware Monitor"""
    try:
        response = requests.get(OHM_API_URL)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def fetch_network_data():
    """Fetch network data from the local API."""
    try:
        response = requests.get(NETWORK_API_URL)
        response.raise_for_status()
        network_data = response.json()

        # Find Ethernet interface
        ethernet = next((iface for iface in network_data if iface.get("interface_name") == "Ethernet"), None)

        if ethernet:
            return {
                "download_speed": ethernet.get("bytes_recv_rate_per_sec", 0),  # Bytes per sec
                "upload_speed": ethernet.get("bytes_sent_rate_per_sec", 0)     # Bytes per sec
            }
        return {"download_speed": 0, "upload_speed": 0}

    except requests.exceptions.RequestException as e:
        return {"error": str(e)}


def extract_sensor_value(data, sensor_name, required_parent_text=None, parent_text=None):
    """
    Extract a sensor value from OHM JSON data, ensuring (if required_parent_text
    is given) that the sensor is *directly* inside that parent's text.
    """
    for child in data.get("Children", []):
        val = extract_sensor_value(
            child, 
            sensor_name, 
            required_parent_text, 
            parent_text=data.get("Text", "")
        )
        if val is not None:
            return val

    if data.get("Text") == sensor_name:
        if required_parent_text is not None:
            if parent_text != required_parent_text:
                return None
        return data.get("Value", "N/A")

    return None

def find_node_by_text(node, text):
    """
    Recursively search for the first node whose "Text" matches 'text'.
    Returns the node if found, otherwise None.
    """
    if node.get("Text") == text:
        return node
    for child in node.get("Children", []):
        found = find_node_by_text(child, text)
        if found:
            return found
    return None

def get_disk_used_space(data, disk_name):
    disk_node = find_node_by_text(data, disk_name)
    if not disk_node:
        return "N/A"

    load_node = find_node_by_text(disk_node, "Load")
    if not load_node:
        return "N/A"

    used_space_node = find_node_by_text(load_node, "Used Space")
    if not used_space_node:
        return "N/A"

    return used_space_node.get("Value", "N/A")

@app.route('/')
def index():
    """Serve the frontend (index.html)"""
    return send_from_directory('static', 'index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Fetch and return system stats from Open Hardware Monitor & Network API"""
    try:
        data = fetch_ohm_data()
        network_stats = fetch_network_data()

        if "error" in data:
            return jsonify({"error": data["error"]}), 500

        stats = {
            "cpu_usage": extract_sensor_value(data, "CPU Total", "Load"),
            "cpu_temp": extract_sensor_value(data, "CPU Package", "Temperatures"),
            "cpu_power": extract_sensor_value(data, "CPU Package", "Powers"),
            "gpu_usage": extract_sensor_value(data, "GPU Core", "Load"),
            "gpu_temp": extract_sensor_value(data, "GPU Core", "Temperatures"),
            "gpu_power": extract_sensor_value(data, "GPU Power", "Powers"),
            "ram_usage_gb": extract_sensor_value(data, "Used Memory", "Data"),

            "disk_d_usage": get_disk_used_space(data, "SSD Sata (D:)"),
            "disk_c_usage": get_disk_used_space(data, "SSD M2 (C:)"),
            "disk_f_usage": get_disk_used_space(data, "SSD M2 (F:)"),

            "network_download": network_stats["download_speed"],
            "network_upload": network_stats["upload_speed"]
        }

        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
