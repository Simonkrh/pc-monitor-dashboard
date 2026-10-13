import re
from pathlib import Path

from dotenv import dotenv_values, set_key

ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"
LEGACY_CONFIG_PATH = ROOT_DIR / "frontend" / "config.js"
ENV_KEYS = [
    "MONITORED_PC_IP", "MONITORED_PC_MAC", "OHM_PORT", "SERVER_PC_IP",
    "MACRO_PC_IP", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET",
    "SPOTIFY_REFRESH_TOKEN", "UPLOAD_FOLDER", "MONITORED_DISKS", "BROWSER_SEND_TOKEN", "BROWSER_PAGE_URL",
]


def update_env_file(updates):
    for key, value in updates.items():
        set_key(str(ENV_PATH), key, value, quote_mode="always")


def read_config():
    values = dict(dotenv_values(ENV_PATH, interpolate=False))
    # Import legacy addresses once. Existing .env values always win, including
    # deliberately empty values. Never execute the old JavaScript.
    missing = [key for key in ("SERVER_PC_IP", "MACRO_PC_IP") if key not in values]
    updates = {}
    if missing and LEGACY_CONFIG_PATH.exists():
        content = LEGACY_CONFIG_PATH.read_text(encoding="utf-8")
        for key in missing:
            match = re.search(rf"\b{key}\s*:\s*['\"]([^'\"]*)['\"]", content)
            if match:
                updates[key] = match.group(1)
    if updates:
        update_env_file(updates)
        values.update(updates)
    return {key: values.get(key) or "" for key in ENV_KEYS}


def public_config(values):
    host = values.get("SERVER_PC_IP", "").strip()
    if host and ":" not in host:
        host += ":5000"
    return {"SERVER_PC_IP": host, "MACRO_PC_IP": values.get("MACRO_PC_IP", "")}


def get_config_snapshot():
    values = read_config()
    return {"env": values, "frontend": public_config(values)}
