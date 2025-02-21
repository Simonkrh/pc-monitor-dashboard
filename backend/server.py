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
        response = requests.get(OHM_API_URL, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def find_sensor_value(data, sensor_name, desired_parent=None):
    """
    Iteratively search for a sensor value using DFS.
    
    - data: The JSON object (dict)
    - sensor_name: The sensor to look for (e.g., "CPU Package")
    - desired_parent: The parent category (e.g., "Temperatures" or "Powers")
    
    Returns the sensor's value if found, else None.
    """
    stack = [(data, None)]  # each element is (node, current_parent)
    
    while stack:
        node, current_parent = stack.pop()
        # If this node is the desired parent, update current_parent
        if "Text" in node and desired_parent and node["Text"] == desired_parent:
            current_parent = node["Text"]
        
        # Check if the node matches the sensor_name
        if "Text" in node and node["Text"] == sensor_name:
            if desired_parent:
                if current_parent == desired_parent:
                    return node.get("Value", "N/A")
            else:
                return node.get("Value", "N/A")
        
        # Add children to the stack if present
        if "Children" in node:
            for child in node["Children"]:
                stack.append((child, current_parent))
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
            "cpu_usage": find_sensor_value(data, "CPU Total", "Load"),
            "cpu_temp": find_sensor_value(data, "CPU Package", "Temperatures"),
            "cpu_power": find_sensor_value(data, "CPU Package", "Powers"),
            "gpu_usage": find_sensor_value(data, "GPU Core", "Load"),
            "gpu_temp": find_sensor_value(data, "GPU Core", "Temperatures"),
            "gpu_power": find_sensor_value(data, "GPU Power", "Powers"),
            "ram_usage_mb": find_sensor_value(data, "Used Memory", "Data"),
        }

        print("\n✅ Extracted Stats:", stats)
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
