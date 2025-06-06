from flask import Flask, send_from_directory

app = Flask(__name__, static_folder="../frontend")


@app.route("/")
def index():
    return send_from_directory(app.static_folder + "/pages/index", "index.html")


@app.route("/resources")
def resources():
    return send_from_directory(app.static_folder + "/pages/resources", "resources.html")


@app.route("/spotify")
def spotify():
    return send_from_directory(app.static_folder + "/pages/spotify", "spotify.html")


@app.route("/dashboard")
def dashboard():
    return send_from_directory(app.static_folder + "/pages/dashboard", "dashboard.html")


@app.route("/upload")
def upload():
    return send_from_directory(app.static_folder + "/pages/upload", "upload.html")

@app.route("/manageMacros")
def manageMacros():
    return send_from_directory(app.static_folder + "/pages/manageMacros", "manageMacros.html")


@app.route("/settings")
def settings():
    return send_from_directory(app.static_folder + "/pages/settings", "settings.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
