import eventlet

eventlet.monkey_patch()
from flask import Blueprint, jsonify
from dotenv import load_dotenv
import urllib3
import os
import platform
from wakeonlan import send_magic_packet
import subprocess
import time
import re
import json


monitoring = Blueprint("monitoring", __name__)
load_dotenv()

MONITORED_PC_IP = os.getenv("MONITORED_PC_IP")
MONITORED_PC_MAC = os.getenv("MONITORED_PC_MAC")

OHM_API_URL = f"http://{MONITORED_PC_IP}:8085/data.json"

RAW_MONITORED_DISKS = os.getenv("MONITORED_DISKS", "")
MONITORED_DISKS = [d.strip() for d in RAW_MONITORED_DISKS.split(",") if d.strip()]

UPDATE_INTERVAL = 1
FETCH_NETWORK_EVERY_N_LOOPS = 3

socketio = None

last_stats = {}


def sanitize_ohm_value(value_str):
    """
    Convert strings like '15,0 %', '67,4 °C', '83,2 %' to float (e.g. 15.0, 67.4, 83.2).
    If invalid or 'N/A', returns 0.0 by default.
    """
    if not value_str or "N/A" in value_str:
        return 0.0

    cleaned = re.sub(r"[^\d.,-]+", "", value_str)

    cleaned = cleaned.replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return 0.0


http = urllib3.PoolManager()


def fetch_ohm_data():
    """Fetch data from Open Hardware Monitor"""
    try:
        response = http.request("GET", OHM_API_URL, timeout=1.0)
        return json.loads(response.data.decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}


def extract_sensor_value(
    data, sensor_name, required_parent_text=None, parent_text=None
):
    """Extract a raw sensor string (like '15,0 %') from the OHM JSON."""
    for child in data.get("Children", []):
        val = extract_sensor_value(
            child, sensor_name, required_parent_text, parent_text=data.get("Text", "")
        )
        if val is not None:
            return val

    if data.get("Text") == sensor_name:
        if required_parent_text is not None:
            if parent_text != required_parent_text:
                return None
        return data.get("Value", "N/A")

    return None


def find_node_by_text(node, text):
    """Recursively find a node by its 'Text' field."""
    if node.get("Text") == text:
        return node

    for child in node.get("Children", []):
        found = find_node_by_text(child, text)
        if found:
            return found

    return None


def get_disk_used_space(data, disk_name):
    """
    Recursively find a disk node named `disk_name` anywhere in `data`,
    then locate 'Load' -> 'Used Space'.
    """
    disk_node = find_node_by_text(data, disk_name)
    if not disk_node:
        print(f"[ERROR] Disk '{disk_name}' not found in JSON.")
        return "N/A"

    load_node = next(
        (
            child
            for child in disk_node.get("Children", [])
            if child.get("Text") == "Load"
        ),
        None,
    )
    if not load_node:
        print(f"[ERROR] 'Load' node missing for {disk_name}.")
        return "N/A"

    used_space_node = next(
        (
            child
            for child in load_node.get("Children", [])
            if child.get("Text") == "Used Space"
        ),
        None,
    )
    if not used_space_node:
        print(f"[ERROR] 'Used Space' node missing for {disk_name}.")
        return "N/A"

    raw_value = used_space_node.get("Value", "N/A")
    return raw_value


@monitoring.route("/wake", methods=["POST"])
def wake_pc():
    """Send a magic packet to wake up the monitored PC."""
    if MONITORED_PC_MAC:
        send_magic_packet(MONITORED_PC_MAC)
        return jsonify({"status": "Magic packet sent!"})
    else:
        return jsonify({"error": "MAC address not configured"}), 400


@monitoring.route("/ping", methods=["GET"])
def ping():
    """Ping the monitored PC and return online/offline status."""
    if not MONITORED_PC_IP:
        return jsonify({"error": "MONITORED_PC_IP not configured"}), 400

    def check_ping():
        param = "-n" if platform.system().lower() == "windows" else "-c"
        try:
            result = subprocess.run(
                ["ping", param, "2", MONITORED_PC_IP],
                capture_output=True,
                text=True,
                timeout=3,
            )
            return "ttl=" in result.stdout.lower()
        except Exception as e:
            print("[ERROR] Ping failed:", e)
            return False

    if check_ping():
        return jsonify({"status": "online"}), 200

    time.sleep(1)
    if check_ping():
        return jsonify({"status": "online"}), 200

    return jsonify({"status": "offline"}), 200


@monitoring.route("/stats", methods=["GET"])
def get_stats():
    """Return minimal info so the frontend can confirm Open Hardware Monitor is alive."""
    ohm_data = fetch_ohm_data()
    if "error" in ohm_data:
        return jsonify({"error": ohm_data["error"]}), 500

    # Extract a couple of sensors to prove OHM is up
    cpu_usage_str = extract_sensor_value(ohm_data, "CPU Total", "Load")
    cpu_temp_str = extract_sensor_value(ohm_data, "CPU Package", "Temperatures")

    if not cpu_usage_str or not cpu_temp_str or "N/A" in (cpu_usage_str, cpu_temp_str):
        return jsonify({"error": "Open Hardware Monitor returned incomplete data"}), 503

    return jsonify({"cpu_usage": cpu_usage_str, "cpu_temp": cpu_temp_str}), 200


def background_task():
    """
    Continuously fetch data and send updates via WebSockets.
    """
    global last_stats

    loop_counter = 0

    while True:
        try:
            if not socketio:
                time.sleep(1)
                continue

            loop_counter += 1

            # Always fetch OHM
            ohm_data = fetch_ohm_data()
            if "error" in ohm_data:
                print("[WARNING] OHM fetch failed:", ohm_data["error"])
                time.sleep(1)
                continue

            # Extract + sanitize values
            raw_cpu_usage = extract_sensor_value(ohm_data, "CPU Total", "Load")
            raw_cpu_temp = extract_sensor_value(ohm_data, "CPU Package", "Temperatures")
            raw_cpu_power = extract_sensor_value(ohm_data, "CPU Package", "Powers")
            raw_gpu_usage = extract_sensor_value(ohm_data, "GPU Core", "Load")
            raw_gpu_temp = extract_sensor_value(ohm_data, "GPU Core", "Temperatures")
            raw_gpu_power = extract_sensor_value(ohm_data, "GPU Power", "Powers")
            raw_ram_usage = extract_sensor_value(ohm_data, "Used Memory", "Data")

            disk_stats = {}
            for disk_name in MONITORED_DISKS:
                raw_value = get_disk_used_space(ohm_data, disk_name)
                disk_stats[disk_name] = sanitize_ohm_value(raw_value)

            stats = {
                "cpu_usage": sanitize_ohm_value(raw_cpu_usage),
                "cpu_temp": sanitize_ohm_value(raw_cpu_temp),
                "cpu_power": sanitize_ohm_value(raw_cpu_power),
                "gpu_usage": sanitize_ohm_value(raw_gpu_usage),
                "gpu_temp": sanitize_ohm_value(raw_gpu_temp),
                "gpu_power": sanitize_ohm_value(raw_gpu_power),
                "ram_usage_gb": sanitize_ohm_value(raw_ram_usage),
                "disks": disk_stats,
            }

            socketio.emit("update_stats", stats)
            time.sleep(UPDATE_INTERVAL)

        except Exception as e:
            print("[ERROR] Unexpected exception in background_task:", str(e))
            time.sleep(1)


def setup_socketio(sio):
    """Attach WebSocket event handlers."""
    global socketio
    socketio = sio

    @socketio.on("connect")
    def handle_connect():
        print("Client connected")

    socketio.start_background_task(background_task)
