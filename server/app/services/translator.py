import os
import httpx

PROVIDER = os.getenv("TRANSLATION_PROVIDER", "google")
GOOGLE_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")
CHIMEGE_KEY = os.getenv("CHIMEGE_TRANSLATE_API_KEY", "")
CHIMEGE_URL = os.getenv("CHIMEGE_TRANSLATE_URL", "https://api.chimege.com/v1.0/translate")


def translate(text: str, source_lang: str, target_lang: str = "mn") -> str:
    if PROVIDER == "google":
        return _google_translate(text, source_lang, target_lang)
    if PROVIDER == "chimege":
        return _chimege_translate(text, source_lang, target_lang)
    raise ValueError(f"Unknown translation provider: {PROVIDER}")


def _google_translate(text: str, source_lang: str, target_lang: str) -> str:
    url = "https://translation.googleapis.com/language/translate/v2"
    try:
        resp = httpx.post(url, params={"key": GOOGLE_KEY}, json={
            "q": text,
            "source": source_lang,
            "target": target_lang,
            "format": "text",
        }, timeout=15)
        resp.raise_for_status()
        return resp.json()["data"]["translations"][0]["translatedText"]
    except httpx.HTTPStatusError:
        # Pivot via English if direct path is unsupported
        if source_lang != "en" and target_lang == "mn":
            en_text = _google_translate(text, source_lang, "en")
            return _google_translate(en_text, "en", "mn")
        raise


def _chimege_translate(text: str, source_lang: str, target_lang: str) -> str:
    resp = httpx.post(CHIMEGE_URL, headers={
        "Authorization": f"Bearer {CHIMEGE_KEY}",
        "Content-Type": "application/json",
    }, json={"text": text, "source": source_lang, "target": target_lang}, timeout=15)
    resp.raise_for_status()
    return resp.json()["result"]
