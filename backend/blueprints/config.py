import os
import re
from pathlib import Path

from dotenv import load_dotenv
from flask import Blueprint, current_app, jsonify, request


config = Blueprint("config", __name__)
load_dotenv()

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"
FRONTEND_CONFIG_PATH = ROOT_DIR / "frontend" / "config.js"

ENV_KEYS = [
    "MONITORED_PC_IP",
    "MONITORED_PC_MAC",
    "SERVER_PC_IP",
    "SPOTIFY_CLIENT_ID",
    "SPOTIFY_CLIENT_SECRET",
    "SPOTIFY_REFRESH_TOKEN",
    "UPLOAD_FOLDER",
    "MONITORED_DISKS",
]

FRONTEND_KEYS = [
    "SERVER_PC_IP",
    "MACRO_PC_IP",
]


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        return value[1:-1]
    return value


def _escape_env_value(value: str) -> str:
    return value.replace('"', '\\"')


def _escape_js_value(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def read_env_file(path: Path) -> dict:
    if not path.exists():
        return {}

    data = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not match:
            continue
        key = match.group(1)
        value = _strip_quotes(match.group(2).strip())
        data[key] = value
    return data


def update_env_file(path: Path, updates: dict) -> None:
    existing_lines = []
    if path.exists():
        existing_lines = path.read_text(encoding="utf-8").splitlines()

    updated_keys = set()
    new_lines = []

    for line in existing_lines:
        match = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if match and match.group(1) in updates:
            key = match.group(1)
            updated_keys.add(key)
            value = _escape_env_value(updates[key])
            new_lines.append(f'{key}="{value}"')
        else:
            new_lines.append(line)

    for key, value in updates.items():
        if key not in updated_keys:
            new_lines.append(f'{key}="{_escape_env_value(value)}"')

    content = "\n".join(new_lines).rstrip() + "\n"
    path.write_text(content, encoding="utf-8")


def read_frontend_config(path: Path) -> dict:
    if not path.exists():
        return {}

    content = path.read_text(encoding="utf-8")
    result = {}
    for key in FRONTEND_KEYS:
        match = re.search(rf"{key}\s*:\s*['\"]([^'\"]*)['\"]", content)
        if match:
            result[key] = match.group(1)
    return result


def update_frontend_config(path: Path, updates: dict) -> None:
    if not path.exists():
        lines = ["const CONFIG = {"] + [
            f'    {key}: "{_escape_js_value(value)}",'
            for key, value in updates.items()
        ] + ["};", ""]
        path.write_text("\n".join(lines), encoding="utf-8")
        return

    content = path.read_text(encoding="utf-8")
    updated = content
    missing = []

    for key, value in updates.items():
        pattern = rf"({key}\s*:\s*)(['\"]).*?\2"
        if re.search(pattern, updated):
            updated = re.sub(
                pattern,
                rf'\1"{_escape_js_value(value)}"',
                updated,
            )
        else:
            missing.append((key, value))

    if missing:
        insert_lines = "\n".join(
            f'    {key}: "{_escape_js_value(value)}",'
            for key, value in missing
        )
        match = re.search(r"\n?\s*}\s*;\s*$", updated)
        if match:
            idx = match.start()
            updated = updated[:idx] + "\n" + insert_lines + updated[idx:]
        else:
            updated = updated.rstrip() + "\n" + insert_lines + "\n"

    if updated != content:
        path.write_text(updated, encoding="utf-8")


def ensure_frontend_config_exists() -> None:
    if FRONTEND_CONFIG_PATH.exists():
        return
    env = read_env_file(ENV_PATH)
    updates = {
        "SERVER_PC_IP": env.get("SERVER_PC_IP", ""),
        "MACRO_PC_IP": env.get("MACRO_PC_IP", ""),
    }
    update_frontend_config(FRONTEND_CONFIG_PATH, updates)


def get_config_snapshot() -> dict:
    env = read_env_file(ENV_PATH)
    frontend = read_frontend_config(FRONTEND_CONFIG_PATH)

    env_view = {key: env.get(key, "") for key in ENV_KEYS}
    frontend_view = {key: frontend.get(key, "") for key in FRONTEND_KEYS}

    return {"env": env_view, "frontend": frontend_view}


def apply_runtime_updates(env_updates: dict) -> None:
    if not env_updates:
        return

    for key, value in env_updates.items():
        os.environ[key] = value

    try:
        from blueprints import monitoring, slideshow, spotify

        monitoring.MONITORED_PC_IP = os.getenv("MONITORED_PC_IP") or ""
        monitoring.MONITORED_PC_MAC = os.getenv("MONITORED_PC_MAC") or ""
        monitoring.RAW_MONITORED_DISKS = os.getenv("MONITORED_DISKS", "")
        monitoring.MONITORED_DISKS = [
            d.strip()
            for d in monitoring.RAW_MONITORED_DISKS.split(",")
            if d.strip()
        ]
        monitoring.OHM_API_URL = (
            f"http://{monitoring.MONITORED_PC_IP}:8085/data.json"
            if monitoring.MONITORED_PC_IP
            else ""
        )

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
    ensure_frontend_config_exists()
    return jsonify(get_config_snapshot())


@config.route("", methods=["POST"])
def save_config():
    payload = request.get_json(silent=True) or {}

    env_payload = payload.get("env", {}) if isinstance(payload, dict) else {}
    frontend_payload = (
        payload.get("frontend", {}) if isinstance(payload, dict) else {}
    )

    env_updates = {
        key: str(value) if value is not None else ""
        for key, value in env_payload.items()
        if key in ENV_KEYS
    }
    frontend_updates = {
        key: str(value) if value is not None else ""
        for key, value in frontend_payload.items()
        if key in FRONTEND_KEYS
    }

    if not env_updates and not frontend_updates:
        return jsonify({"error": "No valid config keys provided"}), 400

    if env_updates:
        update_env_file(ENV_PATH, env_updates)
        apply_runtime_updates(env_updates)

    if frontend_updates:
        update_frontend_config(FRONTEND_CONFIG_PATH, frontend_updates)

    return jsonify({"status": "ok", "config": get_config_snapshot()})
