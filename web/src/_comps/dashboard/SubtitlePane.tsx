"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Segment } from "@/lib/backend-api";

type SubtitlePaneProps = {
  segments: Segment[];
  currentTime: number; // seconds, from the YouTube player (player.time)
  loading?: boolean;
  error?: string;
  // User's dub-speed pref (1 = default, 2 = 2× faster, 0.5 = half). Only
  // affects the karaoke-style highlight so it stays in sync with the audio.
  dubSpeed?: number;
  // Live position of the currently-playing TTS audio. When provided AND the
  // active segment matches, the karaoke highlight follows the audio clock
  // exactly (word progress = audioTime / audioSeconds) instead of a
  // video-time-based estimate.
  audioProgress?: {
    segmentStart: number;
    audioTime: number;
    audioSeconds: number;
  } | null;
  // True when Mongolian dub is on. In dub mode the subtitle appears only while
  // the TTS voice is actively speaking a segment (audioProgress matches) —
  // silence between segments hides the line. In non-dub mode we fall back to
  // showing the line for its entire video-time window.
  dubActive?: boolean;
};

type TranslatedWord = {
  original: string;
  translated: string | null; // null while the OpenAI call is in flight
  from: "mn" | "en";
};

// Keyed by "segmentStart::wordIndex::sourceLang" so a translation lives on the
// exact word that was double-clicked and gets discarded when the segment moves
// on. Including the source lang means flipping the card and double-clicking
// the "same" word position gets a fresh lookup in the new direction.
type WordTxMap = Record<string, TranslatedWord>;

// Debounce single-click from double-click. Delay is the time we wait after a
// click to decide it wasn't the first half of a double-click.
const CLICK_VS_DBLCLICK_MS = 220;

// Shows the single subtitle line whose [start, start + duration) window contains
// the current playback time. Single-click flips between Mongolian and English
// with a smooth 3D rotation; double-clicking a word shows a small translation
// tooltip (mn↔en) so the user can look up words without leaving the video.
export function SubtitlePane({
  segments,
  currentTime,
  loading,
  error,
  dubSpeed = 1,
  audioProgress,
  dubActive = false,
}: SubtitlePaneProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [wordTx, setWordTx] = useState<WordTxMap>({});
  const singleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep-alive display state so the ghost fade-out animation gets to play
  // even after `active` returns null (voice ended → onended cleared audioProgress).
  const [displayActive, setDisplayActive] = useState<{
    mn: string;
    en: string;
    progress: number;
    segStart: number;
  } | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = useMemo(() => {
    if (dubActive) {
      if (!audioProgress || audioProgress.audioSeconds <= 0) return null;
      const seg = segments.find(
        (s) => Math.abs(s.start - audioProgress.segmentStart) < 0.01,
      );
      if (!seg) return null;
      const mn = seg.translated_text?.trim() || "";
      const en = seg.text?.trim() || "";
      if (!mn && !en) return null;
      const progress = Math.max(
        0,
        Math.min(1, audioProgress.audioTime / audioProgress.audioSeconds),
      );
      return { mn, en, progress, segStart: seg.start };
    }

    const seg = segments.find(
      (s) => currentTime >= s.start && currentTime < s.start + s.duration,
    );
    if (!seg) return null;
    const mn = seg.translated_text?.trim() || "";
    const en = seg.text?.trim() || "";
    if (!mn && !en) return null;

    const videoElapsed = currentTime - seg.start;
    const dur = Math.max(0.1, seg.duration);
    let progress: number;
    if (
      audioProgress &&
      audioProgress.audioSeconds > 0 &&
      Math.abs(audioProgress.segmentStart - seg.start) < 0.01
    ) {
      progress = Math.max(
        0,
        Math.min(1, audioProgress.audioTime / audioProgress.audioSeconds),
      );
    } else if (seg.audio_ms && seg.audio_ms > 0) {
      const audioSeconds = seg.audio_ms / 1000;
      const fitRate =
        audioSeconds > dur
          ? Math.min(1.35, Math.max(1, audioSeconds / dur))
          : 1;
      const audioElapsed = videoElapsed * dubSpeed * fitRate;
      progress = Math.max(0, Math.min(1, audioElapsed / audioSeconds));
    } else {
      progress = Math.max(0, Math.min(1, videoElapsed / dur));
    }
    return { mn, en, progress, segStart: seg.start };
  }, [segments, currentTime, dubSpeed, audioProgress, dubActive]);

  // Drop stale word translations only when the displayed segment CHANGES
  // (not during the silence gap where we keep the previous line on screen).
  // `active` is the live segment; while it's null we compare against the
  // persisted `displayActive` so lookups on the still-visible line survive
  // the gap.
  const currentSegKey = active?.segStart ?? displayActive?.segStart ?? null;
  const seenKeysRef = useRef<number | null>(null);
  if (seenKeysRef.current !== currentSegKey) {
    seenKeysRef.current = currentSegKey;
    if (Object.keys(wordTx).length > 0) setWordTx({});
  }

  // Sync displayActive with the live `active`, BUT don't clear it when active
  // goes null (silence between voice segments). The line stays on screen until
  // the NEXT segment arrives — then it swaps in place. That way the reader
  // never stares at an empty video during the gap between one line ending and
  // the next starting.
  useEffect(() => {
    if (active) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setDisplayActive(active);
    }
  }, [active]);

  // Cleanup pending timer on unmount so no dangling setState after teardown.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // Prefer live `active`, fall back to the frozen `displayActive` we keep
  // around during the ghost fade-out (see the useEffect above).
  const rendered = active ?? displayActive;

  if (!rendered) {
    const status = error || (loading ? "Хадмал ачааллаж байна..." : "");
    if (!status) return null;
    return (
      <div className="dashboard-subtitle-pane">
        <p className="dashboard-subtitle-status">{status}</p>
      </div>
    );
  }

  // Front is ALWAYS Mongolian (with karaoke), back is ALWAYS English.
  // Toggling `showOriginal` just rotates the card 180° so the corresponding
  // face turns toward the viewer — swapping the text content here would send
  // the wrong side to the viewer after the flip lands.
  const mnText = rendered.mn;
  const enText = rendered.en;
  const visibleLang: "mn" | "en" = showOriginal ? "en" : "mn";
  if (!mnText && !enText) return null;

  const handleContainerClick = () => {
    // Delay so we can distinguish from a double-click on a word.
    if (singleClickTimer.current) clearTimeout(singleClickTimer.current);
    singleClickTimer.current = setTimeout(() => {
      setShowOriginal((v) => !v);
      setWordTx({});
    }, CLICK_VS_DBLCLICK_MS);
  };

  const cancelPendingSingleClick = () => {
    if (singleClickTimer.current) {
      clearTimeout(singleClickTimer.current);
      singleClickTimer.current = null;
    }
  };

  const translateWord = async (
    word: string,
    fromLang: "mn" | "en",
  ): Promise<string> => {
    const target = fromLang === "mn" ? "en" : "mn";
    try {
      const res = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, from: fromLang, to: target }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { translation?: string };
      return data.translation?.trim() || "";
    } catch {
      return "";
    }
  };

  const wordKey = (idx: number, lang: "mn" | "en") =>
    `${rendered.segStart}::${idx}::${lang}`;

  const handleWordDoubleClick = async (idx: number, raw: string) => {
    cancelPendingSingleClick();
    const cleaned = raw.replace(/[^\p{L}\p{N}'-]+/gu, "").trim();
    if (!cleaned) return;
    const key = wordKey(idx, visibleLang);

    // Toggle off if the same word is double-clicked again (revert to original).
    if (wordTx[key]?.translated) {
      setWordTx((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    // Optimistic loading state so the word visibly reacts to the click before
    // the OpenAI call returns.
    setWordTx((prev) => ({
      ...prev,
      [key]: { original: cleaned, translated: null, from: visibleLang },
    }));
    const translation = await translateWord(cleaned, visibleLang);
    setWordTx((prev) => {
      const cur = prev[key];
      if (!cur || cur.original !== cleaned) return prev;
      return {
        ...prev,
        [key]: {
          ...cur,
          translated: translation || cleaned,
        },
      };
    });
  };

  // Render one face of the card. `isVisible` is true for the side facing the
  // viewer right now — that side gets pointer events (double-click lookup)
  // and, when it's the Mongolian face, the live karaoke highlight.
  const renderFace = (text: string, faceLang: "mn" | "en") => {
    if (!text) return <p className="dashboard-subtitle-text" />;
    const isVisible = visibleLang === faceLang;
    const withKaraoke = faceLang === "mn" && isVisible;

    const tokens = text.split(/(\s+)/);
    const wordCount = tokens.filter((t) => t.trim().length > 0).length;
    // When the voice has finished but we're still holding the line on screen
    // (silence before the next segment), snap all words to "read" so the line
    // reads as complete instead of frozen partway through.
    const effectiveProgress = active ? rendered.progress : 1;
    const litCount = withKaraoke
      ? Math.min(wordCount, Math.ceil(effectiveProgress * wordCount))
      : 0;
    let wordIdx = 0;

    return (
      <p className="dashboard-subtitle-text" aria-hidden={!isVisible}>
        {tokens.map((token, i) => {
          if (!token.trim()) return <span key={i}>{token}</span>;
          const thisWordIdx = wordIdx;
          wordIdx++;
          const isRead = thisWordIdx < litCount;

          // Live translation for THIS word (if the user double-clicked it).
          // While the OpenAI call is in-flight we keep the original text but
          // add a loading class so the user sees something is happening.
          const tx = isVisible ? wordTx[wordKey(thisWordIdx, faceLang)] : undefined;
          const display =
            tx?.translated
              ? tx.translated
              : token;
          const isLoading = !!tx && tx.translated == null;
          const isTranslated = !!tx?.translated;

          return (
            <span
              key={i}
              className={[
                "dashboard-subtitle-word",
                isRead ? "is-read" : "",
                isLoading ? "is-translating" : "",
                isTranslated ? "is-translated" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={
                isTranslated && tx
                  ? `${tx.original} → ${tx.translated}`
                  : undefined
              }
              onDoubleClick={
                isVisible
                  ? (e) => {
                      e.stopPropagation();
                      void handleWordDoubleClick(thisWordIdx, token);
                    }
                  : undefined
              }
            >
              {display}
            </span>
          );
        })}
      </p>
    );
  };

  return (
    <div
      className="dashboard-subtitle-pane"
      onClick={handleContainerClick}
      role="button"
      tabIndex={0}
      aria-label="Хадмалыг эргүүлэх"
    >
      <div
        className={`dashboard-subtitle-flip${
          showOriginal ? " is-flipped" : ""
        }`}
      >
        {/* Front is always Mongolian (source of truth for the karaoke). */}
        <div className="dashboard-subtitle-face dashboard-subtitle-face-front">
          {renderFace(mnText, "mn")}
        </div>
        {/* Back is always English — pre-rotated 180° so it lands upright when
            the card flips. */}
        <div className="dashboard-subtitle-face dashboard-subtitle-face-back">
          {renderFace(enText, "en")}
        </div>
      </div>
    </div>
  );
}
