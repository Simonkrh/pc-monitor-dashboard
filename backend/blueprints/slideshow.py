import os
import hashlib
import json
import shutil
import subprocess
import tempfile

from flask import Blueprint, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()

slideshow = Blueprint("slideshow", __name__)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER") or "uploads"
HASH_FILE = os.path.join(UPLOAD_FOLDER, "hashes.json")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif")
VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".mkv", ".avi")
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS + (".mp4", ".webm")

VIDEO_MAX_WIDTH = int(os.getenv("SLIDESHOW_VIDEO_MAX_WIDTH", "1024"))
VIDEO_MAX_HEIGHT = int(os.getenv("SLIDESHOW_VIDEO_MAX_HEIGHT", "600"))
VIDEO_FPS = int(os.getenv("SLIDESHOW_VIDEO_FPS", "30"))
VIDEO_CRF = os.getenv("SLIDESHOW_VIDEO_CRF", "27")
VIDEO_PRESET = os.getenv("SLIDESHOW_VIDEO_PRESET", "veryfast")


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


def clean_filename(filename):
    """Keep user-friendly names while preventing path traversal."""
    return filename.replace("\\", "/").rsplit("/", 1)[-1].strip()


def is_video_file(filename):
    return filename.lower().endswith(VIDEO_EXTENSIONS)


def available_filename(filename):
    name, ext = os.path.splitext(filename)
    candidate = filename
    counter = 1

    while os.path.exists(os.path.join(UPLOAD_FOLDER, candidate)):
        candidate = f"{name} ({counter}){ext}"
        counter += 1

    return candidate


def output_video_filename(filename):
    name, _ext = os.path.splitext(filename)
    return available_filename(f"{name}.mp4")


def ffmpeg_path():
    return os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg")


def transcode_video(source_path, output_path):
    ffmpeg = ffmpeg_path()
    if not ffmpeg:
        raise RuntimeError(
            "ffmpeg was not found. Install ffmpeg on the Pi to optimize slideshow videos."
        )

    video_filter = (
        f"scale={VIDEO_MAX_WIDTH}:{VIDEO_MAX_HEIGHT}:"
        "force_original_aspect_ratio=decrease:force_divisible_by=2,"
        f"fps={VIDEO_FPS},format=yuv420p"
    )

    command = [
        ffmpeg,
        "-hide_banner",
        "-y",
        "-i",
        source_path,
        "-vf",
        video_filter,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        VIDEO_PRESET,
        "-crf",
        str(VIDEO_CRF),
        "-profile:v",
        "high",
        "-level",
        "3.1",
        "-movflags",
        "+faststart",
        output_path,
    ]

    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        details = result.stderr.strip().splitlines()[-8:]
        raise RuntimeError("ffmpeg failed: " + "\n".join(details))


def save_uploaded_file(file, filename):
    if is_video_file(filename):
        tmp_dir = os.path.join(UPLOAD_FOLDER, ".tmp")
        os.makedirs(tmp_dir, exist_ok=True)

        source_suffix = os.path.splitext(filename)[1] or ".video"
        with tempfile.NamedTemporaryFile(
            dir=tmp_dir, suffix=source_suffix, delete=False
        ) as source_tmp:
            source_path = source_tmp.name
            file.save(source_path)

        final_filename = output_video_filename(filename)
        final_path = os.path.join(UPLOAD_FOLDER, final_filename)

        with tempfile.NamedTemporaryFile(
            dir=tmp_dir, suffix=".mp4", delete=False
        ) as output_tmp:
            output_path = output_tmp.name

        try:
            transcode_video(source_path, output_path)
            os.replace(output_path, final_path)
            return final_filename
        finally:
            for path in (source_path, output_path):
                try:
                    if os.path.exists(path):
                        os.remove(path)
                except OSError:
                    pass

    final_filename = available_filename(filename)
    save_path = os.path.join(UPLOAD_FOLDER, final_filename)
    file.save(save_path)
    return final_filename


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
        filename = clean_filename(file.filename)
        if filename == "":
            continue

        file_hash = calculate_file_hash(file.stream)

        if file_hash in hash_cache:
            print(f"Duplicate file skipped: {filename}")
            duplicate_filenames.append(filename)
            continue

        try:
            saved_filename = save_uploaded_file(file, filename)
        except Exception as e:
            if uploaded_filenames:
                save_hash_cache(hash_cache)
            return jsonify({
                "error": f"Failed to process {filename}",
                "details": str(e),
            }), 500

        uploaded_filenames.append(saved_filename)
        hash_cache[file_hash] = saved_filename

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

@slideshow.route("/check-hash", methods=["POST"])
def check_hash():
    data = request.get_json()
    file_hash = data.get("hash")

    if not file_hash:
        return jsonify({"error": "No hash provided"}), 400

    hash_cache = load_hash_cache()

    if file_hash in hash_cache:
        return jsonify({"duplicate": True}), 200
    return jsonify({"duplicate": False}), 200

@slideshow.route("/uploads/<filename>")
def uploaded_file(filename):
    response = send_from_directory(UPLOAD_FOLDER, filename, conditional=True, max_age=3600)
    response.headers["Cache-Control"] = "public, max-age=3600"
    return response


@slideshow.route("/media")
def list_media():
    media_files = [
        f for f in os.listdir(UPLOAD_FOLDER)
        if f.lower().endswith(MEDIA_EXTENSIONS)
    ]
    return jsonify(media_files)

@slideshow.route("/delete/<filename>", methods=["DELETE"])
def delete_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    hash_cache = load_hash_cache()

    # Remove the file from disk
    try:
        os.remove(file_path)
    except Exception as e:
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500

    # Remove the file's hash from the hash cache
    new_cache = {k: v for k, v in hash_cache.items() if v != filename}
    save_hash_cache(new_cache)

    return jsonify({"message": "File deleted"}), 200

@slideshow.route("/delete-multiple", methods=["POST"])
def delete_multiple_files():
    data = request.get_json()
    files_to_delete = data.get("files", [])

    if not isinstance(files_to_delete, list):
        return jsonify({"error": "Invalid data"}), 400

    hash_cache = load_hash_cache()
    updated_cache = {
        k: v for k, v in hash_cache.items()
        if v not in files_to_delete
    }

    errors = []
    for filename in files_to_delete:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            errors.append(f"{filename}: {str(e)}")

    save_hash_cache(updated_cache)

    if errors:
        return jsonify({"error": "Some files could not be deleted", "details": errors}), 500

    return jsonify({"message": "Files deleted"}), 200

