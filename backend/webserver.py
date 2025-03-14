from flask import Flask, send_from_directory

app = Flask(__name__, static_folder="../frontend")


@app.route("/")
def index():
    return send_from_directory(app.static_folder + "/pages/index", "index.html")


@app.route("/resources")
def resources():
    return send_from_directory(app.static_folder + "/pages/index", "index.html")


@app.route("/spotify")
def spotify():
    return send_from_directory(app.static_folder + "/pages/spotify", "spotify.html")


@app.route("/macro")
def macro():
    return send_from_directory(app.static_folder + "/pages/macro", "macro.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
