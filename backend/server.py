# API-server som henter data fra Windows-PC

from flask import Flask, jsonify
import requests

app = Flask(__name__)

# Sett IP-adressen til din Windows-PC med Glances
WINDOWS_PC_IP = "192.168.1.196"
GLANCES_API_URL = f"http://{WINDOWS_PC_IP}:61208/api/3/"

@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        response = requests.get(GLANCES_API_URL)
        data = response.json()

        # Formaterer dataene for nettsiden
        formatted_data = {
            "cpu": data["cpu"]["total"],
            "ram": data["mem"]["percent"],
            "disk": data["disk"]["percent"]
        }

        return jsonify(formatted_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
