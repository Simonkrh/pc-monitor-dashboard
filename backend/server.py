# API-server som henter data fra Windows-PC ved hjelp av Open Hardware Monitor

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests

app = Flask(__name__, static_folder='static')
CORS(app)

WINDOWS_PC_IP = "192.168.1.196"
OHM_API_URL = f"http://{WINDOWS_PC_IP}:8085/data.json"

def fetch_ohm_data():
    """Fetch data from Open Hardware Monitor"""
    try:
        response = requests.get(OHM_API_URL)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def extract_sensor_value(data, sensor_name, desired_parent=None, current_parent=None):
    """
    Recursively search for a sensor value.
    
    - If a node's "Text" matches the desired_parent, update current_parent.
    - Then, when a node with sensor_name is found, return its Value if the current_parent matches desired_parent.
    """
    # If the current node is the desired parent, update current_parent.
    if "Text" in data and desired_parent and data["Text"] == desired_parent:
        current_parent = data["Text"]
    
    # Recurse through children (if any)
    if "Children" in data:
        for child in data["Children"]:
            result = extract_sensor_value(child, sensor_name, desired_parent, current_parent)
            if result is not None:
                return result

    # If this node is our sensor...
    if "Text" in data and data["Text"] == sensor_name:
        if desired_parent:
            if current_parent == desired_parent:
                return data.get("Value", "N/A")
            else:
                return None
        return data.get("Value", "N/A")
    
    return None

@app.route('/')
def index():
    """Serve the frontend (index.html)"""
    return send_from_directory('static', 'index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Fetch and return system stats from Open Hardware Monitor"""
    try:
        data = fetch_ohm_data()
        if "error" in data:
            return jsonify({"error": data["error"]}), 500

        stats = {
            "cpu_usage": extract_sensor_value(data, "CPU Total", "Load"),
            "cpu_temp": extract_sensor_value(data, "CPU Package", "Temperatures"),
            "cpu_power": extract_sensor_value(data, "CPU Package", "Powers"),
            "gpu_usage": extract_sensor_value(data, "GPU Core", "Load"),
            "gpu_temp": extract_sensor_value(data, "GPU Core", "Temperatures"),
            "gpu_power": extract_sensor_value(data, "GPU Power", "Powers"),
            "ram_usage_mb": extract_sensor_value(data, "Used Memory", "Data"),
        }

        print("\n✅ Extracted Stats:", stats)  # Debugging output
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
