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

def extract_sensor_value(data, sensor_name, parent_name=None):
    """Extract a sensor value from Open Hardware Monitor JSON data"""
    if "Children" in data:
        for child in data["Children"]:
            result = extract_sensor_value(child, sensor_name, data.get("Text", None))
            if result is not None:
                return result

    if "Text" in data and data["Text"] == sensor_name:
        # Ensure we get the correct sensor based on parent section (if provided)
        if parent_name and parent_name != data.get("Text", ""):
            return None  # Skip if this is not the right parent

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
            "cpu_usage": extract_sensor_value(data, "CPU Total"),
            "cpu_temp": extract_sensor_value(data, "CPU Package", "Temperatures"),  
            "cpu_power": extract_sensor_value(data, "CPU Package", "Powers"),
            "gpu_usage": extract_sensor_value(data, "GPU Core Load"),
            "gpu_temp": extract_sensor_value(data, "GPU Temperature"),
            "gpu_power": extract_sensor_value(data, "GPU Power"),
            "ram_usage_mb": extract_sensor_value(data, "Used Memory"),
        }

        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
