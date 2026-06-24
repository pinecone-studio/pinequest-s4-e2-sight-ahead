import os
import httpx

# Switch providers with a single env var: TTS_PROVIDER=azure|chimege
PROVIDER = os.getenv("TTS_PROVIDER", "azure")

AZURE_KEY = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.getenv("AZURE_SPEECH_REGION", "eastus")

CHIMEGE_TTS_KEY = os.getenv("CHIMEGE_TTS_API_KEY", "")
CHIMEGE_TTS_URL = os.getenv("CHIMEGE_TTS_URL", "https://api.chimege.com/v1.0/synthesize")

_AZURE_VOICES = {
    "female": "mn-MN-YesuiNeural",
    "male": "mn-MN-BataaNeural",
}


def synthesize(text: str, options: dict = None) -> bytes:
    """Return MP3 audio bytes for the given Mongolian text."""
    opts = options or {}
    if PROVIDER == "azure":
        return _azure_synthesize(text, opts)
    if PROVIDER == "chimege":
        return _chimege_synthesize(text, opts)
    raise ValueError(f"Unknown TTS provider: {PROVIDER}")


def _azure_synthesize(text: str, options: dict) -> bytes:
    gender = options.get("gender", "female")
    voice = _AZURE_VOICES.get(gender, _AZURE_VOICES["female"])

    ssml = (
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='mn-MN'>"
        f"<voice name='{voice}'>{text}</voice>"
        "</speak>"
    )

    url = f"https://{AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
    }
    resp = httpx.post(url, content=ssml.encode("utf-8"), headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.content


def _chimege_synthesize(text: str, options: dict) -> bytes:
    resp = httpx.post(CHIMEGE_TTS_URL, headers={
        "Authorization": f"Bearer {CHIMEGE_TTS_KEY}",
        "Content-Type": "application/json",
    }, json={"text": text}, timeout=30)
    resp.raise_for_status()
    return resp.content
