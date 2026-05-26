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

UPLOAD_FOLDER = os.path.abspath(os.getenv("UPLOAD_FOLDER") or "uploads")
HASH_FILE = os.path.join(UPLOAD_FOLDER, "hashes.json")
THUMBNAIL_FOLDER = os.path.join(UPLOAD_FOLDER, ".thumbnails")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(THUMBNAIL_FOLDER, exist_ok=True)

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif")
VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".mkv", ".avi")
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS + (".mp4", ".webm")
PLAYABLE_VIDEO_EXTENSIONS = (".mp4", ".webm")

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


def safe_upload_path(filename):
    cleaned = clean_filename(filename)
    path = os.path.abspath(os.path.join(UPLOAD_FOLDER, cleaned))
    upload_root = os.path.abspath(UPLOAD_FOLDER)
    if not path.startswith(upload_root + os.sep):
        raise ValueError("Invalid filename")
    return cleaned, path


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
            "ffmpeg was not found. Install ffmpeg to optimize slideshow videos."
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


def video_thumbnail_filename(filename):
    digest = hashlib.sha256(filename.encode("utf-8")).hexdigest()[:16]
    name, _ext = os.path.splitext(clean_filename(filename))
    safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name)
    return f"{safe_name}-{digest}.jpg"


def create_video_thumbnail(video_path, thumbnail_path):
    ffmpeg = ffmpeg_path()
    if not ffmpeg:
        raise RuntimeError("ffmpeg was not found.")

    command = [
        ffmpeg,
        "-hide_banner",
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        video_path,
        "-frames:v",
        "1",
        "-vf",
        "scale=360:240:force_original_aspect_ratio=increase,crop=360:240",
        "-q:v",
        "4",
        thumbnail_path,
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
        raise RuntimeError("ffmpeg thumbnail failed: " + "\n".join(details))


def save_uploaded_file(file, filename, optimize_video=True):
    if is_video_file(filename):
        if not optimize_video and not filename.lower().endswith(PLAYABLE_VIDEO_EXTENSIONS):
            raise RuntimeError(
                "This video format needs optimization before it can be used in the slideshow."
            )

        if not optimize_video:
            final_filename = available_filename(filename)
            save_path = os.path.join(UPLOAD_FOLDER, final_filename)
            file.save(save_path)
            return final_filename

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
    optimize_videos = request.form.get("optimize_videos", "true").lower() == "true"

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
            saved_filename = save_uploaded_file(file, filename, optimize_videos)
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


@slideshow.route("/thumbnail/<filename>")
def video_thumbnail(filename):
    try:
        cleaned_filename, file_path = safe_upload_path(filename)
    except ValueError:
        return jsonify({"error": "Invalid filename"}), 400

    if not is_video_file(cleaned_filename) or not os.path.exists(file_path):
        return jsonify({"error": "Video not found"}), 404

    thumbnail_filename = video_thumbnail_filename(cleaned_filename)
    thumbnail_path = os.path.join(THUMBNAIL_FOLDER, thumbnail_filename)

    if not os.path.exists(thumbnail_path):
        try:
            create_video_thumbnail(file_path, thumbnail_path)
        except Exception as e:
            return jsonify({"error": "Failed to create thumbnail", "details": str(e)}), 500

    response = send_from_directory(
        THUMBNAIL_FOLDER,
        thumbnail_filename,
        conditional=True,
        max_age=86400,
    )
    response.headers["Cache-Control"] = "public, max-age=86400"
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
    try:
        cleaned_filename, file_path = safe_upload_path(filename)
    except ValueError:
        return jsonify({"error": "Invalid filename"}), 400

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    hash_cache = load_hash_cache()

    # Remove the file from disk
    try:
        os.remove(file_path)
    except Exception as e:
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500

    # Remove the file's hash from the hash cache
    new_cache = {k: v for k, v in hash_cache.items() if v != cleaned_filename}
    save_hash_cache(new_cache)

    thumbnail_path = os.path.join(THUMBNAIL_FOLDER, video_thumbnail_filename(cleaned_filename))
    if os.path.exists(thumbnail_path):
        try:
            os.remove(thumbnail_path)
        except OSError:
            pass

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
        try:
            cleaned_filename, file_path = safe_upload_path(filename)
        except ValueError:
            errors.append(f"{filename}: invalid filename")
            continue

        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            thumbnail_path = os.path.join(THUMBNAIL_FOLDER, video_thumbnail_filename(cleaned_filename))
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
        except Exception as e:
            errors.append(f"{filename}: {str(e)}")

    save_hash_cache(updated_cache)

    if errors:
        return jsonify({"error": "Some files could not be deleted", "details": errors}), 500

    return jsonify({"message": "Files deleted"}), 200

