import os


AUDIO_DIR = os.getenv("AUDIO_DIR", "audio")


def save_audio(audio_bytes: bytes, video_id: str, segment_index: int) -> str:
    dir_path = os.path.join(AUDIO_DIR, video_id)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"segment_{segment_index}.mp3")
    with open(file_path, "wb") as f:
        f.write(audio_bytes)
    return file_path


def audio_url_path(video_id: str, segment_index: int) -> str:
    return f"/audio/{video_id}/segment_{segment_index}.mp3"
