import eventlet
eventlet.monkey_patch()
from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from dotenv import load_dotenv
import os
from blueprints.slideshow import slideshow
from blueprints.monitoring import monitoring, setup_socketio
from blueprints.spotify import spotify

load_dotenv()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
CORS(app)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")  
os.makedirs(UPLOAD_FOLDER, exist_ok=True) 
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


app.register_blueprint(monitoring, url_prefix="/monitoring")
app.register_blueprint(spotify, url_prefix="/spotify")
app.register_blueprint(slideshow, url_prefix="/slideshow")

setup_socketio(socketio)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")

@socketio.on("connect")
def handle_connect():
    print("Client connected")
