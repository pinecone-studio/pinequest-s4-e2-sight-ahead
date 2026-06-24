import os
import json


CACHE_DIR = os.getenv("CACHE_DIR", "cache")


def get_cached_result(video_id: str) -> dict | None:
    path = os.path.join(CACHE_DIR, f"{video_id}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None


def set_cached_result(video_id: str, result: dict) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{video_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)
