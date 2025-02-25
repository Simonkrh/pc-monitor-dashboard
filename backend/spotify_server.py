from flask import Flask, jsonify, request
import requests
import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("SPOTIFY_REFRESH_TOKEN")

TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1/me/player"

app = Flask(__name__)
app.secret_key = "supersecretkey"

def get_access_token():
    token_data = {
        "grant_type": "refresh_token",
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }
    response = requests.post(TOKEN_URL, data=token_data)
    token_info = response.json()
    
    if "access_token" in token_info:
        return token_info["access_token"]
    else:
        print("Error getting access token:", token_info)
        return None

def get_active_device():
    """Returns the ID of an active Spotify device or None if no device is available."""
    access_token = get_access_token()
    if not access_token:
        return None

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{SPOTIFY_API_BASE_URL}/devices", headers=headers)
    
    if response.status_code == 200:
        devices = response.json().get("devices", [])
        if devices:
            return devices[0]["id"]  
    return None

def send_spotify_command(command):
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    device_id = get_active_device()
    if not device_id:
        return jsonify({"error": "No active Spotify device found"}), 404  

    if command in ["play", "pause"]:
        response = requests.put(f"{SPOTIFY_API_BASE_URL}/{command}?device_id={device_id}", headers=headers, json={})
    else:
        response = requests.post(f"{SPOTIFY_API_BASE_URL}/{command}?device_id={device_id}", headers=headers)

    if response.status_code in [204, 202]:
        return jsonify({"success": True})
    else:
        try:
            error_message = response.json()  
        except requests.exceptions.JSONDecodeError:
            error_message = {"error": "Empty response from Spotify", "status_code": response.status_code}

        print(f"Spotify API Error ({response.status_code}): {error_message}")  
        return jsonify(error_message), response.status_code


@app.route("/play", methods=["POST"])
def play():
    return send_spotify_command("play")

@app.route("/pause", methods=["POST"])
def pause():
    return send_spotify_command("pause")

@app.route("/next", methods=["POST"])
def next_track():
    return send_spotify_command("next")

@app.route("/prev", methods=["POST"])
def prev_track():
    return send_spotify_command("previous")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)  

