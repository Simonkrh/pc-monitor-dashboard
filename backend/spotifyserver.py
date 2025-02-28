from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("SPOTIFY_REFRESH_TOKEN")

TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1/me/player"
SPOTIFY_API_GENERIC = "https://api.spotify.com/v1"

app = Flask(__name__)
CORS(app) 
app.secret_key = "supersecretkey"


def get_access_token():
    token_data = {
        "grant_type": "refresh_token",
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
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
        endpoint = "previous" if command == "prev" else "next"
        response = requests.post(f"{SPOTIFY_API_BASE_URL}/{endpoint}?device_id={device_id}", headers=headers)

    if response.status_code in [200, 202, 204]:
        return jsonify({"success": True})

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

@app.route("/previous", methods=["POST"])
def prev_track():
    return send_spotify_command("previous")

@app.route("/current-song", methods=["GET"])
def current_song():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{SPOTIFY_API_BASE_URL}/currently-playing", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if not data or "item" not in data:
            return jsonify({"error": "No song currently playing"}), 204
        return jsonify(data)
    elif response.status_code == 204:  
        return jsonify({"error": "No song currently playing"}), 204
    else:
        return jsonify({"error": "Failed to fetch song info"}), response.status_code

@app.route("/playlist/<playlist_id>", methods=["GET"])
def get_playlist(playlist_id):
    """
    Fetches the playlist tracks for the given playlist_id.
    """
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    url = f"{SPOTIFY_API_GENERIC}/playlists/{playlist_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    r = requests.get(url, headers=headers)

    if r.status_code != 200:
        return jsonify({"error": "Failed to fetch playlist info"}), r.status_code
    
    playlist_data = r.json()
    return jsonify(playlist_data)

@app.route("/play-track", methods=["POST"])
def play_track():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    device_id = get_active_device()
    if not device_id:
        return jsonify({"error": "No active Spotify device found"}), 404

    req_data = request.get_json()
    track_uri = req_data.get("uri")
    playlist_id = req_data.get("playlistId")

    if not track_uri:
        return jsonify({"error": "No URI provided"}), 400

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "context_uri": f"spotify:playlist:{playlist_id}", 
        "offset": {"uri": track_uri},  
        "position_ms": 0
    }

    r = requests.put(
        f"{SPOTIFY_API_BASE_URL}/play?device_id={device_id}",
        headers=headers,
        json=payload
    )

    if r.status_code in [200, 202, 204]:
        return jsonify({"success": True})

    return jsonify({"error": "Failed to play track", "details": r.json()}), r.status_code

@app.route("/set-volume", methods=["PUT"])
def set_volume():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    volume = request.args.get("volume")  # Get volume from request
    if volume is None or not volume.isdigit():
        return jsonify({"error": "Invalid volume value"}), 400

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"volume_percent": int(volume)}

    response = requests.put(f"{SPOTIFY_API_BASE_URL}/volume", headers=headers, params=params)

    if response.status_code in [200, 204]:
        return jsonify({"success": True})

    return jsonify({"error": "Failed to change volume"}), response.status_code

@app.route("/get-volume", methods=["GET"])
def get_volume():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{SPOTIFY_API_BASE_URL}", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if "device" in data and data["device"]:
            return jsonify({"volume_percent": data["device"]["volume_percent"]})
        else:
            return jsonify({"error": "No active device found"}), 404
    else:
        return jsonify({"error": "Failed to retrieve volume"}), response.status_code

@app.route("/playlists", methods=["GET"])
def get_playlists():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    playlists = []
    next_url = f"{SPOTIFY_API_GENERIC}/me/playlists?limit=50"

    while next_url:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(next_url, headers=headers)

        if response.status_code != 200:
            return jsonify({"error": "Failed to fetch playlists"}), response.status_code

        data = response.json()
        playlists.extend(data["items"])

        next_url = data.get("next")  

    return jsonify({"items": playlists})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
