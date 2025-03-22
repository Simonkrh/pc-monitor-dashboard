from flask import Blueprint, jsonify, request
import requests
import os
from dotenv import load_dotenv

load_dotenv()

spotify = Blueprint("spotify", __name__)

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("SPOTIFY_REFRESH_TOKEN")

TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1/me/player"
SPOTIFY_API_GENERIC = "https://api.spotify.com/v1"


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
        "Content-Type": "application/json",
    }

    device_id = get_active_device()
    if not device_id:
        return jsonify({"error": "No active Spotify device found"}), 404

    if command in ["play", "pause"]:
        response = requests.put(
            f"{SPOTIFY_API_BASE_URL}/{command}?device_id={device_id}",
            headers=headers,
            json={},
        )
    else:
        endpoint = "previous" if command == "prev" else "next"
        response = requests.post(
            f"{SPOTIFY_API_BASE_URL}/{endpoint}?device_id={device_id}", headers=headers
        )

    if response.status_code in [200, 202, 204]:
        return jsonify({"success": True})

    try:
        error_message = response.json()
    except requests.exceptions.JSONDecodeError:
        error_message = {
            "error": "Empty response from Spotify",
            "status_code": response.status_code,
        }

    print(f"Spotify API Error ({response.status_code}): {error_message}")
    return jsonify(error_message), response.status_code


@spotify.route("/play", methods=["POST"])
def play():
    return send_spotify_command("play")


@spotify.route("/pause", methods=["POST"])
def pause():
    return send_spotify_command("pause")


@spotify.route("/next", methods=["POST"])
def next_track():
    return send_spotify_command("next")


@spotify.route("/previous", methods=["POST"])
def prev_track():
    return send_spotify_command("previous")


@spotify.route("/current-song", methods=["GET"])
def current_song():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{SPOTIFY_API_BASE_URL}/currently-playing", headers=headers
    )

    if response.status_code == 200:
        data = response.json()
        if not data or "item" not in data:
            return jsonify({"error": "No song currently playing"}), 204
        return jsonify(data)
    elif response.status_code == 204:
        return jsonify({"error": "No song currently playing"}), 204
    else:
        return jsonify({"error": "Failed to fetch song info"}), response.status_code


@spotify.route("/player-state", methods=["GET"])
def get_player_state():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{SPOTIFY_API_BASE_URL}", headers=headers)

    if response.status_code == 200:
        data = response.json()
        return jsonify(
            {
                "shuffle_state": data.get("shuffle_state", False),
                "repeat_state": data.get("repeat_state", "off"),
            }
        )

    return jsonify({"error": "Failed to get player state"}), response.status_code


@spotify.route("/playlist/<playlist_id>", methods=["GET"])
def get_playlist(playlist_id):
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {"Authorization": f"Bearer {access_token}"}
    all_tracks = []
    offset = 0
    limit = 100

    while True:
        url = f"{SPOTIFY_API_GENERIC}/playlists/{playlist_id}/tracks?limit={limit}&offset={offset}"
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            return jsonify(
                {"error": "Failed to fetch playlist info"}
            ), response.status_code

        data = response.json()
        tracks = data.get("items", [])
        all_tracks.extend(tracks)

        if len(tracks) < limit:  # No more tracks left to fetch
            break

        offset += limit  # Move to next batch

    playlist_info_url = f"{SPOTIFY_API_GENERIC}/playlists/{playlist_id}"
    response = requests.get(playlist_info_url, headers=headers)
    playlist_info = response.json() if response.status_code == 200 else {}

    return jsonify(
        {
            "name": playlist_info.get("name", "Unknown Playlist"),
            "tracks": {"items": all_tracks},
        }
    )


@spotify.route("/play-track", methods=["POST"])
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
        "Content-Type": "application/json",
    }

    payload = {
        "context_uri": f"spotify:playlist:{playlist_id}",
        "offset": {"uri": track_uri},
        "position_ms": 0,
    }

    r = requests.put(
        f"{SPOTIFY_API_BASE_URL}/play?device_id={device_id}",
        headers=headers,
        json=payload,
    )

    if r.status_code in [200, 202, 204]:
        return jsonify({"success": True})

    return jsonify(
        {"error": "Failed to play track", "details": r.json()}
    ), r.status_code


@spotify.route("/repeat", methods=["POST"])
def set_repeat():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(f"{SPOTIFY_API_BASE_URL}", headers=headers)
    if response.status_code != 200:
        return jsonify({"error": "Failed to get repeat state"}), response.status_code

    repeat_state = response.json().get("repeat_state", "off")

    new_repeat_mode = "track" if repeat_state == "off" else "off"

    response = requests.put(
        f"{SPOTIFY_API_BASE_URL}/repeat?state={new_repeat_mode}", headers=headers
    )

    if response.status_code in [200, 204]:
        return jsonify({"success": True, "mode": new_repeat_mode})

    return jsonify({"error": "Failed to set repeat"}), response.status_code


@spotify.route("/shuffle", methods=["POST"])
def set_shuffle():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(f"{SPOTIFY_API_BASE_URL}", headers=headers)
    if response.status_code != 200:
        return jsonify({"error": "Failed to get shuffle state"}), response.status_code

    player_state = response.json()
    shuffle_state = player_state.get("shuffle_state", False)

    if shuffle_state == "smart":
        print("Smart Shuffle is enabled. Disabling it first...")
        disable_response = requests.put(
            f"{SPOTIFY_API_BASE_URL}/shuffle?state=false", headers=headers
        )
        if disable_response.status_code not in [200, 204]:
            return jsonify(
                {"error": "Failed to disable Smart Shuffle"}
            ), disable_response.status_code
        shuffle_state = False

    new_shuffle_state = not shuffle_state
    response = requests.put(
        f"{SPOTIFY_API_BASE_URL}/shuffle?state={str(new_shuffle_state).lower()}",
        headers=headers,
    )

    if response.status_code in [200, 204]:
        return jsonify({"success": True, "shuffle_state": new_shuffle_state})

    return jsonify({"error": "Failed to toggle shuffle"}), response.status_code


@spotify.route("/set-volume", methods=["PUT"])
def set_volume():
    access_token = get_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get access token"}), 401

    volume = request.args.get("volume")  # Get volume from request
    if volume is None or not volume.isdigit():
        return jsonify({"error": "Invalid volume value"}), 400

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"volume_percent": int(volume)}

    response = requests.put(
        f"{SPOTIFY_API_BASE_URL}/volume", headers=headers, params=params
    )

    if response.status_code in [200, 204]:
        return jsonify({"success": True})

    return jsonify({"error": "Failed to change volume"}), response.status_code


@spotify.route("/get-volume", methods=["GET"])
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


@spotify.route("/playlists", methods=["GET"])
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
