from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.caption_fetcher import fetch_caption
from app.services.translator import translate
from app.services.tts_service import synthesize
from app.utils.video import extract_video_id
from app.utils.audio import save_audio, audio_url_path
from app.utils.job import get_cached_result, set_cached_result

router = APIRouter()


class DubRequest(BaseModel):
    url: str
    source_lang: str = "en"


@router.post("/dub")
async def dub_video(request: DubRequest):
    video_id = extract_video_id(request.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL or video ID")

    cached = get_cached_result(video_id)
    if cached:
        return cached

    captions = fetch_caption(video_id)
    if not captions:
        # EXTENSION POINT: Whisper-based transcription for videos without captions
        raise HTTPException(status_code=422, detail={
            "code": "NO_CAPTIONS",
            "message": "This video has no captions. Whisper fallback is not yet implemented.",
        })

    segments = []
    for i, seg in enumerate(captions):
        mongolian_text = translate(seg["text"], request.source_lang)
        audio_bytes = synthesize(mongolian_text)
        save_audio(audio_bytes, video_id, i)
        segments.append({
            "text": mongolian_text,
            "start": seg["start"],
            "duration": seg["duration"],
            "audio_url": audio_url_path(video_id, i),
        })

    result = {"video_id": video_id, "segments": segments}
    set_cached_result(video_id, result)
    return result
