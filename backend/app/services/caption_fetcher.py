import logging
import os
import threading
import time

from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
from app.models.segment import Segment
from app.utils.lang import normalize

logger = logging.getLogger(__name__)

_api = YouTubeTranscriptApi()

# --- YouTube rate-limit safety -------------------------------------------------
# A deployed server shares one datacenter IP, so bursts of caption requests
# quickly trip YouTube's "too many requests" / IP block. We serialize calls and
# enforce a minimum interval between them. Combined with the cache layer in
# routers/pipeline.py (same video is never re-fetched), this keeps us well under
# YouTube's limits. There is NO retry — a failure returns None so the caller can
# back off instead of hammering.
_throttle_lock = threading.Lock()
_last_call_ts = 0.0
_MIN_INTERVAL = float(os.getenv("YT_CAPTION_MIN_INTERVAL", "1.0"))


def _throttle() -> None:
    global _last_call_ts
    with _throttle_lock:
        wait = _MIN_INTERVAL - (time.monotonic() - _last_call_ts)
        if wait > 0:
            time.sleep(wait)
        _last_call_ts = time.monotonic()


def fetch_captions(video_id: str) -> tuple[str, list[Segment]] | None:
    _throttle()

    try:
        transcript_list = _api.list(video_id)
    except TranscriptsDisabled:
        logger.info("captions disabled for %s", video_id)
        return None
    except Exception:
        # Network error, rate-limit, or IP block — log it so it's visible in
        # deploy logs (instead of silently looking like "no captions").
        logger.exception("could not list transcripts for %s (rate-limit/IP block?)", video_id)
        return None

    source_lang = "en"
    try:
        transcript = transcript_list.find_transcript(["en"])
    except NoTranscriptFound:
        try:
            transcript = next(iter(transcript_list))
            source_lang = normalize(transcript.language_code)
        except StopIteration:
            return None

    try:
        data = transcript.fetch()
    except Exception:
        logger.exception("could not fetch transcript for %s", video_id)
        return None

    segments = [
        Segment(
            start=seg.start,
            duration=seg.duration,
            text=seg.text,
            source="youtube_captions",
        )
        for seg in data
    ]
    return source_lang, segments
