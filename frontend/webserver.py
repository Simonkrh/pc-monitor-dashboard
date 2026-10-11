import json
import sys
from pathlib import Path

import requests
from flask import Flask, Response, jsonify, request, send_from_directory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from config_store import public_config, read_config

app = Flask(__name__, static_folder="../frontend", static_url_path="/frontend")

# Cache static assets aggressively by default.
# CSS/JS are revalidated below so UI changes show up during development.
# HTML routes are served with max_age=0 below so navigation always revalidates.
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 60 * 60 * 24 * 7  # 7 days


def send_no_cache(directory, filename):
    response = send_from_directory(directory, filename, max_age=0)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.after_request
def prevent_stale_styles_and_scripts(response):
    if request.path.startswith("/frontend/") and request.path.endswith((".css", ".js")):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.route("/")
def index():
    return send_from_directory(
        app.static_folder + "/pages/index", "index.html", max_age=0
    )


@app.route("/app")
def app_shell():
    return send_from_directory(
        app.static_folder + "/pages/app", "app.html", max_age=0
    )


@app.route("/resources")
def resources():
    return send_from_directory(
        app.static_folder + "/pages/resources", "resources.html", max_age=0
    )


@app.route("/spotify")
def spotify():
    return send_from_directory(
        app.static_folder + "/pages/spotify", "spotify.html", max_age=0
    )


@app.route("/browser")
def browser():
    return send_from_directory(
        app.static_folder + "/pages/browser", "browser.html", max_age=0
    )


@app.route("/dashboard")
def dashboard():
    return send_from_directory(
        app.static_folder + "/pages/dashboard", "dashboard.html", max_age=0
    )


@app.route("/timers")
def timers():
    return send_from_directory(
        app.static_folder + "/pages/timers", "timers.html", max_age=0
    )


@app.route("/upload")
def upload():
    return send_from_directory(
        app.static_folder + "/pages/upload", "upload.html", max_age=0
    )


@app.route("/manageMacros")
def manageMacros():
    return send_from_directory(
        app.static_folder + "/pages/manageMacros", "manageMacros.html", max_age=0
    )


@app.route("/frontend/config.js")
def frontend_config():
    public = public_config(read_config())
    script = "window.CONFIG = " + json.dumps(public) + ";\n"
    script += 'if (!CONFIG.SERVER_PC_IP) CONFIG.SERVER_PC_IP = window.location.hostname + ":5000";\n'
    return Response(script, mimetype="application/javascript")


@app.route("/api/config", methods=["GET", "POST"])
def config_api():
    # Config belongs to this installation, regardless of the browser's storage
    # or the public address currently saved in .env.
    try:
        upstream = requests.request(
            request.method, "http://127.0.0.1:5000/config",
            data=request.get_data() if request.method == "POST" else None,
            headers={"Content-Type": "application/json"},
            timeout=5, allow_redirects=False,
        )
        response = Response(upstream.content, status=upstream.status_code,
                            content_type=upstream.headers.get("Content-Type", "application/json"))
    except requests.RequestException:
        response = jsonify({"error": "Cannot reach the local backend on port 5000. Start backend/app.py and reload."})
        response.status_code = 502
    response.headers["Cache-Control"] = "no-store"
    return response


@app.route("/settings")
def settings():
    return send_from_directory(
        app.static_folder + "/pages/settings", "settings.html", max_age=0
    )


@app.route("/config")
def config_page():
    return send_from_directory(
        app.static_folder + "/pages/config", "config.html", max_age=0
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
