import os

from flask import Blueprint, current_app, jsonify, request
from config_store import ENV_KEYS, get_config_snapshot, update_env_file

config = Blueprint("config", __name__)


def apply_runtime_updates(env_updates: dict) -> None:
    if not env_updates:
        return

    for key, value in env_updates.items():
        os.environ[key] = value

    try:
        from blueprints import monitoring, slideshow, spotify

        monitoring.MONITORED_PC_IP = os.getenv("MONITORED_PC_IP") or ""
        monitoring.MONITORED_PC_MAC = os.getenv("MONITORED_PC_MAC") or ""
        monitoring.OHM_PORT = (os.getenv("OHM_PORT", "8085") or "8085").strip()
        monitoring.RAW_MONITORED_DISKS = os.getenv("MONITORED_DISKS", "")
        monitoring.MONITORED_DISKS = [
            d.strip()
            for d in monitoring.RAW_MONITORED_DISKS.split(",")
            if d.strip()
        ]
        monitoring.OHM_API_URL = monitoring.build_ohm_api_url()

        spotify.CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
        spotify.CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
        spotify.REFRESH_TOKEN = os.getenv("SPOTIFY_REFRESH_TOKEN")

        new_upload_folder = os.getenv("UPLOAD_FOLDER") or "uploads"
        os.makedirs(new_upload_folder, exist_ok=True)
        slideshow.UPLOAD_FOLDER = new_upload_folder
        slideshow.HASH_FILE = os.path.join(new_upload_folder, "hashes.json")
        current_app.config["UPLOAD_FOLDER"] = new_upload_folder
    except Exception:
        pass


@config.route("", methods=["GET"])
def get_config():
    return jsonify(get_config_snapshot())


@config.route("", methods=["POST"])
def save_config():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("env"), dict):
        return jsonify({"error": "Expected an env settings object"}), 400
    updates = {
        key: str(value) if value is not None else ""
        for key, value in payload["env"].items() if key in ENV_KEYS
    }
    if not updates:
        return jsonify({"error": "No valid config keys provided"}), 400
    update_env_file(updates)
    apply_runtime_updates(updates)
    return jsonify({"status": "ok", "config": get_config_snapshot()})
