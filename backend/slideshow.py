from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER")  
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return "No file part", 400

    files = request.files.getlist("file")
    if not files:
        return "No selected file(s)", 400

    uploaded_filenames = []

    for file in files:
        if file.filename == "":
            continue  # Skip empty uploads
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
        file.save(save_path)
        uploaded_filenames.append(file.filename)

    if not uploaded_filenames:
        return "No valid files uploaded", 400

    return jsonify({
        "message": "Files uploaded successfully!",
        "uploaded_files": uploaded_filenames
    }), 200

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/images")
def list_images():
    images = [f for f in os.listdir(UPLOAD_FOLDER) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
    return jsonify(images)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5010)
