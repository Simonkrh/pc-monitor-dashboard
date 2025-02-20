# API-server som henter data fra Windows-PC

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests

app = Flask(__name__, static_folder='static')
CORS(app)

WINDOWS_PC_IP = "192.168.1.196"
GLANCES_API_URL = f"http://{WINDOWS_PC_IP}:61208/api/4"

@app.route('/')
def index():
    """Serve the frontend (index.html)"""
    return send_from_directory('static', 'index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Fetch and return system stats from Glances"""
    try:
        cpu_data = requests.get(f"{GLANCES_API_URL}/cpu/total").json()
        ram_data = requests.get(f"{GLANCES_API_URL}/mem/percent").json()

        formatted_data = {
            "cpu": cpu_data.get("total", "N/A"),
            "ram": ram_data.get("percent", "N/A"),
        }

        return jsonify(formatted_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
