from flask import Blueprint, request, jsonify, send_from_directory
import os
from dotenv import load_dotenv

load_dotenv()

slideshow = Blueprint("slideshow", __name__)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@slideshow.route("/upload", methods=["POST"])
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
        save_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(save_path)
        uploaded_filenames.append(file.filename)

    if not uploaded_filenames:
        return "No valid files uploaded", 400

    return jsonify(
        {
            "message": "Files uploaded successfully!",
            "uploaded_files": uploaded_filenames,
        }
    ), 200


@slideshow.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@slideshow.route("/images")
def list_images():
    images = [
        f
        for f in os.listdir(UPLOAD_FOLDER)
        if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))
    ]
    return jsonify(images)
