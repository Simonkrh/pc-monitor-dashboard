from flask import Blueprint, request, jsonify, send_from_directory
import os
import hashlib
import json
from dotenv import load_dotenv

load_dotenv()

slideshow = Blueprint("slideshow", __name__)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER")
HASH_FILE = os.path.join(UPLOAD_FOLDER, "hashes.json")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def calculate_file_hash(file_stream):
    """Calculate SHA-256 hash of a file stream."""
    hash_obj = hashlib.sha256()
    while chunk := file_stream.read(8192):
        hash_obj.update(chunk)
    file_stream.seek(0)  # Reset stream to beginning
    return hash_obj.hexdigest()


def load_hash_cache():
    """Load or initialize hash cache."""
    if os.path.exists(HASH_FILE):
        with open(HASH_FILE, "r") as f:
            return json.load(f)
    return {}


def save_hash_cache(cache):
    """Save hash cache to file."""
    with open(HASH_FILE, "w") as f:
        json.dump(cache, f)


@slideshow.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return "No file part", 400

    files = request.files.getlist("file")
    if not files:
        return "No selected file(s)", 400

    hash_cache = load_hash_cache()
    uploaded_filenames = []
    duplicate_filenames = []

    for file in files:
        if file.filename == "":
            continue

        file_hash = calculate_file_hash(file.stream)

        if file_hash in hash_cache:
            print(f"Duplicate file skipped: {file.filename}")
            duplicate_filenames.append(file.filename)
            continue

        save_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(save_path)
        uploaded_filenames.append(file.filename)
        hash_cache[file_hash] = file.filename

    save_hash_cache(hash_cache)

    if not uploaded_filenames:
        return jsonify({
            "message": "All files were duplicates and skipped.",
            "uploaded_files": [],
            "duplicates": duplicate_filenames
        }), 200

    return jsonify({
        "message": "Files uploaded successfully!",
        "uploaded_files": uploaded_filenames,
        "duplicates": duplicate_filenames
    }), 200


@slideshow.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@slideshow.route("/media")
def list_media():
    valid_extensions = (".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm")
    media_files = [
        f for f in os.listdir(UPLOAD_FOLDER)
        if f.lower().endswith(valid_extensions)
    ]
    return jsonify(media_files)
