import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routers.transcribe import router as transcribe_router
from app.routers.translate import router as translate_router
from app.routers.dub import router as dub_router

app = FastAPI(title="SightAhead Backend")

AUDIO_DIR = os.getenv("AUDIO_DIR", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")

app.include_router(transcribe_router)
app.include_router(translate_router)
app.include_router(dub_router)


@app.get("/")
def root():
    return {"status": "ok"}
