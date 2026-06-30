# Helex — Architecture

## Зорилго

YouTube контентыг монгол хэрэглэгчид **монгол subtitle болон монгол дубтайгаар** саадгүй үзүүлэх.

Хэрэглэгч URL оруулахад:
- Монгол **subtitle** харагдана
- Монгол **дуу** сонсогдоно
- Хоёулаа **нэгэн зэрэг**, синхроноор ажиллана

---

## Системийн давхаргууд

```
Хэрэглэгч (Browser)
        ↓
Frontend — Next.js (Vercel)
        ↓  REST API
Backend — FastAPI (Railway)
        ↓
Гадаад үйлчилгээнүүд:
  - Transcript (RapidAPI / youtube-transcript-api)
  - Орчуулга (OpenAI / Gemini)
  - TTS дуб (Azure / F5)
  - Auth + Cache (Firebase)
```

---

## Үндсэн pipeline

```
YouTube URL
    ↓
Transcript татах
    ↓
Монгол орчуулга
    ↓
Монгол дуб (TTS)
    ↓
Subtitle + Дуб хоёулаг нэгэн зэрэг тоглуулна
    ↓
Cache хадгална — дараагийн хэрэглэгч шууд авна
```

---

## Subtitle + Дуб хоёуланг нэгэн зэрэг харуулах

Энэ бол аппын **гол онцлог**. Хэрэгжүүлэх зарчим:

- Subtitle болон дуб хоёулаа **нэг segment**-аас үүснэ — text, start, duration
- Subtitle нь хэрэглэгчийн дэлгэцэнд timestamp-тайгаар харагдана
- Дуб нь яг тэр timestamp-тай sync хийгдэн тоглогдоно
- Хэрэглэгч subtitle-г унших эсвэл дубыг сонсох — хоёр аргаар хэлийг ойлгоно

---

## Суурь зарчмууд

**1. Зорилго нэг — арга олон**
Transcript, орчуулга, TTS-д ямар API, ямар library ашиглах нь туршилтаар шийдэгдэнэ. Гол нь эцсийн үр дүн: монгол subtitle + дуб хоёулаг ажиллах.

**2. Cache**
Нэг удаа боловсруулсан видеог хадгална. Дараагийн хэрэглэгч тэр видеог нээхэд шууд авна — дахин боловсруулахгүй.

**3. Хэрэглэгчид саадгүй байх**
Боловсруулалт нь хэрэглэгчийн харахаас өмнө дуусах ёстой — latency мэдрэгдэхгүй байх нь зорилго.

---

## Багийн хуваарилалт

| Хэсэг | Хариуцах |
|-------|---------|
| Frontend, UI/UX | Anu, Erkhme, Mugi |
| Backend, Architecture | Tsengel, Zolo |

---

## Шаардлагатай ENV

**Backend:**
```
OPENAI_API_KEY
GEMINI_API_KEY
AZURE_SPEECH_KEY / AZURE_SPEECH_REGION
FIREBASE_PROJECT_ID
FIREBASE_CREDENTIALS_JSON
RAPIDAPI_KEY
```

**Frontend:**
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_BACKEND_URL
```
