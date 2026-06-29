"use client";

// Test page: harvest captions by OCR AND transcribe the tab's audio with
// in-browser Whisper, then CROSS-CHECK them. OCR gives accurate on-screen timing
// but picks up pixel junk; Whisper gives clean language for what was actually
// said. Validating OCR segments against the Whisper transcript yields the
// "guaranteed" segments — the trustworthy data we'd send to the backend.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaptionOCR, DEFAULT_CROP } from "./_comps/CaptionOcr";
import { WhisperTranscriber } from "./_comps/WhisperTranscriber";
import { useScreenShare } from "./_comps/ScreenShareProvider";
import { CaptionAssembler, type Segment } from "./_comps/captionAssembler";
import { validateSegments, guaranteedSegments } from "./_comps/captionValidator";
import { streamProcess } from "@/lib/process-stream";

// POST guaranteed segments to the backend /process pipeline in batches of ~60.
const BATCH_SIZE = 60;

export default function TestDubPage() {
  const { stream, error, isSharing, requestShare, stopShare } =
    useScreenShare();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Two independent harvest streams, each merged by its own assembler.
  const ocrAssemblerRef = useRef(new CaptionAssembler());
  const whisperAssemblerRef = useRef(new CaptionAssembler());
  const startRef = useRef<number | null>(null);

  const [ocrSegments, setOcrSegments] = useState(() =>
    ocrAssemblerRef.current.segments(),
  );
  const [whisperText, setWhisperText] = useState("");
  const [lastOcr, setLastOcr] = useState("");
  const [lastWhisper, setLastWhisper] = useState("");

  // Feed the shared stream into the preview <video>.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);

  // Reset both streams when a share starts/stops; timestamps run from here.
  useEffect(() => {
    ocrAssemblerRef.current.reset();
    whisperAssemblerRef.current.reset();
    setOcrSegments([]);
    setWhisperText("");
    setLastOcr("");
    setLastWhisper("");
    sentCountRef.current = 0;
    setSentCount(0);
    setTranslatedCount(0);
    startRef.current = isSharing ? performance.now() : null;
  }, [isSharing]);

  const elapsed = () =>
    startRef.current === null ? 0 : (performance.now() - startRef.current) / 1000;

  const handleOcr = (text: string) => {
    setLastOcr(text);
    ocrAssemblerRef.current.add(text, elapsed());
    setOcrSegments(ocrAssemblerRef.current.segments());
  };

  const handleWhisper = (text: string) => {
    setLastWhisper(text);
    whisperAssemblerRef.current.add(text, elapsed());
    setWhisperText(whisperAssemblerRef.current.transcript());
  };

  // Cross-check OCR timing/text against the Whisper transcript.
  const validated = useMemo(
    () => validateSegments(ocrSegments, whisperText),
    [ocrSegments, whisperText],
  );
  const guaranteed = useMemo(() => guaranteedSegments(validated), [validated]);

  // ── Batch send: POST guaranteed segments to the backend ~60 at a time. ──
  const sentCountRef = useRef(0); // how many guaranteed segments already sent
  const sendingRef = useRef(false); // one batch in flight at a time
  const [sentCount, setSentCount] = useState(0);
  const [translatedCount, setTranslatedCount] = useState(0);

  // POST one batch through the existing /process SSE helper and log results.
  const sendBatch = useCallback(async (batch: Segment[]) => {
    if (!batch.length) return;
    console.log(`[screengrab] → POST ${batch.length} segments to /process`);
    try {
      await streamProcess(
        {
          source_lang: "en",
          gender: "female",
          segments: batch.map(({ start, duration, text }) => ({
            start,
            duration,
            text,
          })),
        },
        {
          onSegment: (seg) => {
            setTranslatedCount((n) => n + 1);
            console.log("[screengrab] ← translated", seg.translated_text);
          },
          onDone: (total) => console.log(`[screengrab] ← batch done (${total})`),
          onError: (msg) => console.warn("[screengrab] batch error:", msg),
        },
      );
    } catch (e) {
      console.warn("[screengrab] send failed:", e);
    }
  }, []);

  // Auto-send whenever a full batch of new guaranteed segments has accumulated.
  useEffect(() => {
    if (sendingRef.current) return;
    if (guaranteed.length - sentCountRef.current < BATCH_SIZE) return;
    const batch = guaranteed.slice(sentCountRef.current, sentCountRef.current + BATCH_SIZE);
    sendingRef.current = true;
    sentCountRef.current += batch.length;
    setSentCount(sentCountRef.current);
    void sendBatch(batch).finally(() => {
      sendingRef.current = false;
    });
  }, [guaranteed, sendBatch]);

  // Manually flush the remaining (< BATCH_SIZE) segments, e.g. at the end.
  const sendRemaining = useCallback(() => {
    if (sendingRef.current) return;
    const batch = guaranteed.slice(sentCountRef.current);
    if (!batch.length) return;
    sendingRef.current = true;
    sentCountRef.current = guaranteed.length;
    setSentCount(sentCountRef.current);
    void sendBatch(batch).finally(() => {
      sendingRef.current = false;
    });
  }, [guaranteed, sendBatch]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-4">
      <header>
        <h1 className="text-xl font-bold">Caption harvest + audio cross-check</h1>
        <p className="text-sm text-zinc-400">
          Share the tab playing a video (tick <b>Share tab audio</b>). OCR reads
          the caption pixels; Whisper transcribes the audio; verified = OCR
          corroborated by the audio = guaranteed data.
        </p>
      </header>

      {/* Screen permission button. */}
      <div className="flex gap-2">
        {!isSharing ? (
          <button
            onClick={requestShare}
            className="rounded bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500"
          >
            Share screen
          </button>
        ) : (
          <button
            onClick={stopShare}
            className="rounded bg-red-600 px-4 py-2 font-semibold hover:bg-red-500"
          >
            Stop sharing
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Preview with the OCR crop box. */}
      <div className="relative w-full max-w-3xl">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full rounded-lg border border-zinc-800 bg-black aspect-video object-fill"
        />
        {isSharing && (
          <div
            className="absolute border-2 border-lime-400/90 pointer-events-none"
            style={{
              left: `${DEFAULT_CROP.left * 100}%`,
              top: `${DEFAULT_CROP.top * 100}%`,
              width: `${DEFAULT_CROP.width * 100}%`,
              height: `${DEFAULT_CROP.height * 100}%`,
            }}
          />
        )}
      </div>

      {/* Live status of each source. */}
      <section className="max-w-3xl grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded bg-zinc-900 p-3 text-xs">
          <div className="text-zinc-400 mb-1">Last OCR read</div>
          <div className="font-mono wrap-break-word">{lastOcr || "—"}</div>
        </div>
        <div className="rounded bg-zinc-900 p-3 text-xs">
          <div className="text-zinc-400 mb-1">Last Whisper read</div>
          <div className="font-mono wrap-break-word">{lastWhisper || "—"}</div>
        </div>
      </section>

      {/* OCR segments annotated with their audio-cross-check confidence. */}
      <section className="max-w-3xl">
        <h2 className="text-sm text-zinc-400 mb-1">
          OCR segments ({validated.length}) — {guaranteed.length} verified
        </h2>
        <div className="max-h-64 overflow-auto rounded bg-zinc-900 p-3 font-mono text-xs space-y-1">
          {validated.length === 0 ? (
            <span className="text-zinc-600">No segments yet.</span>
          ) : (
            validated.map((seg, i) => (
              <div key={i} className="wrap-break-word">
                <span
                  className={seg.verified ? "text-green-400" : "text-zinc-600"}
                  title={`confidence ${seg.confidence}`}
                >
                  {seg.verified ? "✓" : "·"} [{seg.start.toFixed(1)}s ·{" "}
                  {(seg.confidence * 100).toFixed(0)}%]
                </span>{" "}
                {seg.text}
                {seg.verified && seg.text !== seg.ocrText && (
                  <span className="text-zinc-600"> (ocr: {seg.ocrText})</span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Backend batch status: auto-sends every 60 verified segments. */}
      <section className="max-w-3xl flex items-center gap-3 text-xs text-zinc-400">
        <span>
          sent {sentCount}/{guaranteed.length} · translated {translatedCount}
        </span>
        <button
          onClick={sendRemaining}
          disabled={guaranteed.length - sentCount <= 0}
          className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
        >
          Send remaining ({Math.max(0, guaranteed.length - sentCount)})
        </button>
      </section>

      {/* The trustworthy output (also logged to the console). */}
      <section className="max-w-3xl">
        <h2 className="text-sm text-zinc-400 mb-1">
          Guaranteed segments ({guaranteed.length})
        </h2>
        <div className="max-h-48 overflow-auto rounded bg-zinc-900 p-3 font-mono text-xs space-y-1">
          {guaranteed.length === 0 ? (
            <span className="text-zinc-600">
              None verified yet (Whisper lags OCR by a few seconds).
            </span>
          ) : (
            guaranteed.map((seg, i) => (
              <div key={i} className="wrap-break-word text-green-300">
                <span className="text-zinc-500">
                  [{seg.start.toFixed(1)}s · {seg.duration.toFixed(1)}s]
                </span>{" "}
                {seg.text}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Both harvesters run together while sharing. */}
      {isSharing && <CaptionOCR onText={handleOcr} />}
      {isSharing && (
        <section className="max-w-3xl">
          <WhisperTranscriber onText={handleWhisper} />
        </section>
      )}
    </main>
  );
}
