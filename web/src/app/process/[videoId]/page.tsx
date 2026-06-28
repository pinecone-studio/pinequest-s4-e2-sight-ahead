"use client";

// Standalone "processing" tab opened from the dashboard.
// It plays the chosen YouTube video (muted, captions on) and OCRs the captions
// straight off the SHARED SCREEN (getDisplayMedia) — the same approach as
// /test/screengrab. Screen-share gives an untainted MediaStream, so the canvas
// never gets tainted and we never call any YouTube/transcript API (nothing to
// IP-block). For now it just console.logs the segmented caption data; batching
// it to the backend for translation + dubbing comes later.

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ScreenShareProvider,
  useScreenShare,
} from "@/app/test/screengrab/_comps/ScreenShareProvider";
import { CaptionOCR, DEFAULT_CROP } from "@/app/test/screengrab/_comps/CaptionOcr";

// One OCR'd caption line with a rough start time (seconds since processing began).
type Segment = { index: number; start: number; text: string };

function ProcessRunner({ videoId }: { videoId: string }) {
  const { isSharing, error, requestShare, stopShare } = useScreenShare();
  const [segments, setSegments] = useState<Segment[]>([]);
  // Most recent line OCR read — shown so you can tell "OCR running but nothing
  // in the crop box" apart from "OCR not running at all".
  const [lastText, setLastText] = useState("");
  // When sharing started, so we can timestamp each caption relative to it.
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isSharing && startRef.current === null) startRef.current = performance.now();
    if (!isSharing) startRef.current = null;
  }, [isSharing]);

  // Each distinct caption line OCR reports becomes a segment. We log the single
  // segment and the running batch — this is the data that will later be POSTed
  // to the backend in one batch for translation + dubbing.
  const handleText = (text: string) => {
    setLastText(text);
    const start =
      startRef.current === null ? 0 : (performance.now() - startRef.current) / 1000;
    setSegments((prev) => {
      const seg: Segment = {
        index: prev.length,
        start: Math.round(start * 10) / 10,
        text,
      };
      const next = [...prev, seg];
      console.log("[process] segment", seg);
      console.log("[process] batch so far", next);
      return next;
    });
  };

  if (!videoId) {
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-100">
        <p>No video id in the URL.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-black text-zinc-100">
      {/* Full-bleed player so that when the user shares THIS tab, the video
          fills the captured frame and captions land where the OCR crop expects. */}
      <iframe
        title="processing-player"
        className="absolute inset-0 h-full w-full border-0"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&cc_load_policy=1&playsinline=1&controls=1`}
        allow="autoplay; encrypted-media"
      />

      {/* Highlighted OCR crop region — exactly where CaptionOCR's drawImage reads
          (DEFAULT_CROP, fractions of the captured frame). Use `fixed` so the box
          maps to the viewport, which IS the captured frame when sharing this tab.
          The captions must fall inside this lime box to be read. */}
      <div
        className="fixed z-20 border-2 border-lime-400/90 pointer-events-none"
        style={{
          left: `${DEFAULT_CROP.left * 100}%`,
          top: `${DEFAULT_CROP.top * 100}%`,
          width: `${DEFAULT_CROP.width * 100}%`,
          height: `${DEFAULT_CROP.height * 100}%`,
        }}
      >
        <span className="absolute -top-5 left-0 text-[11px] text-lime-300">
          OCR reads here
        </span>
      </div>

      {/* Floating controls (top-left). OCR crops the bottom-center band, so this
          top UI never interferes with what gets read. */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg bg-black/70 p-3 text-sm pointer-events-auto">
        <strong>SightAhead · Processing</strong>
        {!isSharing ? (
          <button
            onClick={requestShare}
            className="rounded bg-blue-600 px-3 py-1.5 font-semibold hover:bg-blue-500"
          >
            Share this tab to start OCR
          </button>
        ) : (
          <button
            onClick={stopShare}
            className="rounded bg-red-600 px-3 py-1.5 font-semibold hover:bg-red-500"
          >
            Stop OCR
          </button>
        )}
        {error && <span className="text-red-400">{error}</span>}
        <span className="text-zinc-400">{segments.length} segments captured</span>
        <span className="max-w-65 truncate text-zinc-300">
          last read: {lastText || "—"}
        </span>
        <span className="text-zinc-500 text-xs">
          (open the console to see the segmented data)
        </span>
      </div>

      {/* OCR worker pool runs only while a screen is being shared. */}
      {isSharing && <CaptionOCR onText={handleText} />}
    </main>
  );
}

export default function ProcessPage() {
  const params = useParams();
  const raw = params?.videoId;
  const videoId = Array.isArray(raw) ? raw[0] : (raw ?? "");

  return (
    <ScreenShareProvider>
      <ProcessRunner videoId={videoId} />
    </ScreenShareProvider>
  );
}
