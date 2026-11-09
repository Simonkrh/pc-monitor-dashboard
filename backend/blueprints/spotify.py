from flask import Blueprint, jsonify, request
import requests
import os
import time
from dotenv import load_dotenv

load_dotenv()

spotify = Blueprint("spotify", __name__)

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("SPOTIFY_REFRESH_TOKEN")

TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1/me/player"
SPOTIFY_API_GENERIC = "https://api.spotify.com/v1"

_access_token = None
_access_token_expires_at = 0.0
_access_token_credentials = None


class SpotifyReadError(Exception):
    def __init__(self, message, status=502, retry_after=None):
        self.message = message
        self.status = status
        self.retry_after = retry_after


@spotify.errorhandler(SpotifyReadError)
def handle_spotify_read_error(error):
    response = jsonify({"error": error.message, "retry_after": error.retry_after})
    response.status_code = error.status
    if error.retry_after is not None:
        response.headers["Retry-After"] = str(error.retry_after)
    return response


def read_spotify(path, params=None):
    """Bound playlist reads and refresh an expired token once, without retry storms."""
    global _access_token_expires_at
    for attempt in range(2):
        token = get_access_token()
        if not token:
            raise SpotifyReadError("Could not connect to Spotify. Check your Spotify credentials in Settings.", 401)
        try:
            response = requests.get(
                f"{SPOTIFY_API_GENERIC}/{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params, timeout=(5, 10),
            )
        except requests.Timeout:
            raise SpotifyReadError("Spotify took too long to respond. Please retry.", 504)
        except requests.RequestException:
            raise SpotifyReadError("Could not reach Spotify. Please retry.")
        if response.status_code == 401 and attempt == 0:
            _access_token_expires_at = 0
            continue
        if response.status_code != 200:
            messages = {
                401: "Spotify authorization expired. Check your Spotify credentials in Settings.",
                403: "Spotify denied access. In Development Mode, playlist songs are available only for playlists you own or collaborate on. Private playlists also require permission.",
                404: "Spotify could not find this playlist, or it is no longer available to your account.",
                429: "Spotify is limiting requests. Please wait before retrying.",
            }
            retry_after = response.headers.get("Retry-After")
            retry_after = int(retry_after) if retry_after and retry_after.isdigit() else None
            raise SpotifyReadError(
                messages.get(response.status_code, "Spotify could not load the playlist. Please retry."),
                response.status_code, retry_after,
            )
        try:
            data = response.json()
        except ValueError:
            raise SpotifyReadError("Spotify returned an invalid response. Please retry.")
        if not isinstance(data, dict):
            raise SpotifyReadError("Spotify returned an invalid response. Please retry.")
        return data


def playlist_offset():
    try:
        offset = int(request.args.get("offset", "0"))
        if offset < 0:
            raise ValueError
        return offset
    except ValueError:
        raise SpotifyReadError("Invalid playlist offset.", 400)


def playlist_page(data, offset):
    items = data.get("items")
    if not isinstance(items, list) or (data.get("next") and not items):
        raise SpotifyReadError("Spotify returned an incomplete playlist page. Please retry.")
    return {
        "items": items,
        "total": data.get("total", len(items)),
        "next_offset": offset + len(items) if data.get("next") else None,
    }


def get_access_token():
    global _access_token, _access_token_expires_at, _access_token_credentials

    credentials = (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
    if (
        _access_token
        and _access_token_credentials == credentials
        and time.monotonic() < _access_token_expires_at
    ):
        return _access_token

    token_data = {
        "grant_type": "refresh_token",
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }

    try:
        response = requests.post(TOKEN_URL, data=token_data, timeout=10)
        token_info = response.json()
    except (requests.RequestException, ValueError) as error:
        print("Error getting access token:", error)
        return None

    if "access_token" in token_info:
        expires_in = int(token_info.get("expires_in", 3600))
        _access_token = token_info["access_token"]
        _access_token_expires_at = time.monotonic() + max(0, expires_in - 60)
        _access_token_credentials = credentials
        return _access_token

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
    offset = playlist_offset()
    name = None
    if offset == 0:
        info = read_spotify(f"playlists/{playlist_id}")
        name = info.get("name", "Unknown Playlist")
        data = info.get("items") or info.get("tracks")
        if not isinstance(data, dict):
            raise SpotifyReadError(
                "Spotify only provides the name of this playlist. In Development Mode, songs are available only for playlists you own or collaborate on.",
                403,
            )
    else:
        data = read_spotify(f"playlists/{playlist_id}/items", {"limit": 50, "offset": offset})
    page = playlist_page(data, offset)
    page["items"] = [
        {"track": item.get("item", item.get("track"))} if isinstance(item, dict) else {"track": None}
        for item in page["items"]
    ]
    return jsonify({"name": name, "tracks": page})


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
    offset = playlist_offset()
    data = read_spotify("me/playlists", {"limit": 50, "offset": offset})
    return jsonify(playlist_page(data, offset))
