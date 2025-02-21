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
        "ram_usage_gb": extract_sensor_value(data, "Used Memory", "Data"),
    }


        print("\n✅ Extracted Stats:", stats)  # Debugging Output

        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
