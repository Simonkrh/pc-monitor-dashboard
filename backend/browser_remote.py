import hmac
import ipaddress
import os
from urllib.parse import urlsplit

from dotenv import dotenv_values
from flask import Blueprint, jsonify, request

from config_store import ENV_PATH


def setup_browser_remote(app, socketio):
    routes = Blueprint("browser_remote", __name__)
    displays = set()
    namespace = "/browser-control"

    @socketio.on("connect", namespace=namespace)
    def connect(auth=None):
        try:
            local = ipaddress.ip_address(request.remote_addr or "").is_loopback
        except ValueError:
            local = False
        if not local or request.headers.get("Origin"):
            return False
        displays.add(request.sid)

    @socketio.on("disconnect", namespace=namespace)
    def disconnect(reason=None):
        displays.discard(request.sid)

    @routes.post("/open")
    def open_browser():
        token = dotenv_values(ENV_PATH, interpolate=False).get("BROWSER_SEND_TOKEN")
        token = token or os.environ.get("BROWSER_SEND_TOKEN", "")
        if not token:
            return jsonify(error="Link sending is disabled. Generate and save a pairing token in dashboard Settings > Config > Browser Extension."), 503
        supplied = request.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied.encode(), f"Bearer {token}".encode()):
            return jsonify(error="Pairing token is incorrect."), 401
        if request.content_length and request.content_length > 16384:
            return jsonify(error="Request is too large."), 413
        data = request.get_json(silent=True)
        url = data.get("url") if isinstance(data, dict) else None
        if not isinstance(url, str) or len(url) > 8192:
            return jsonify(error="Send an HTTP or HTTPS website URL."), 400
        try:
            parsed = urlsplit(url)
            valid = (parsed.scheme in ("http", "https") and parsed.hostname
                     and not parsed.username and not parsed.password
                     and not any(ord(char) < 33 for char in url))
            _ = parsed.port
        except ValueError:
            valid = False
        if not valid:
            return jsonify(error="Send an HTTP or HTTPS URL without embedded login details."), 400
        if not displays:
            return jsonify(error="The Pi backend is online, but Electron is not connected. Start npm run desktop on the Pi."), 503
        socketio.emit("browser:open", {"url": url}, namespace=namespace)
        return jsonify(status="sent"), 202

    app.register_blueprint(routes, url_prefix="/browser")
