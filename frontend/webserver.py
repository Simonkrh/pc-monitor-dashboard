from flask import Flask, send_from_directory

app = Flask(__name__, static_folder="../frontend", static_url_path="/frontend")

# Cache static assets aggressively (CSS/JS/images under /frontend/*).
# HTML routes are served with max_age=0 below so navigation always revalidates.
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 60 * 60 * 24 * 7  # 7 days


@app.route("/")
def index():
    return send_from_directory(app.static_folder + "/pages/index", "index.html", max_age=0)


@app.route("/resources")
def resources():
    return send_from_directory(
        app.static_folder + "/pages/resources", "resources.html", max_age=0
    )


@app.route("/spotify")
def spotify():
    return send_from_directory(app.static_folder + "/pages/spotify", "spotify.html", max_age=0)


@app.route("/dashboard")
def dashboard():
    return send_from_directory(
        app.static_folder + "/pages/dashboard", "dashboard.html", max_age=0
    )


@app.route("/upload")
def upload():
    return send_from_directory(app.static_folder + "/pages/upload", "upload.html", max_age=0)

@app.route("/manageMacros")
def manageMacros():
    return send_from_directory(
        app.static_folder + "/pages/manageMacros", "manageMacros.html", max_age=0
    )


@app.route("/settings")
def settings():
    return send_from_directory(
        app.static_folder + "/pages/settings", "settings.html", max_age=0
    )

@app.route("/config")
def config_page():
    return send_from_directory(app.static_folder + "/pages/config", "config.html", max_age=0)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
