// Browser-side cross-check of OCR against the Whisper audio transcript.
//
// OCR reads a fixed box, so it picks up whatever pixels are there — including
// non-caption junk. Whisper transcribes what was actually SAID, so it's a clean
// reference for "did this really get spoken?". We keep OCR's accurate on-screen
// TIMING but verify (and clean up) its TEXT against the audio transcript:
//   - confidence = fraction of an OCR segment's words found in the transcript
//   - verified   = confidence high enough → trust it ("guaranteed" data)
//   - text       = for verified segments, use Whisper's cleaner wording
//
// Pure logic, no DOM/network — runs in the browser where it's imported.

import type { Segment } from "./captionAssembler";

export type ValidatedSegment = Segment & {
  ocrText: string; // original OCR text, kept for reference
  confidence: number; // 0-1 word overlap with the audio transcript
  verified: boolean; // corroborated by Whisper → trustworthy
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
const toTokens = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);

export type ValidateOpts = {
  minConfidence?: number; // overlap fraction needed to verify (default 0.5)
  minTokens?: number; // min OCR words to be eligible (default 2)
};

// Annotate each OCR segment with how well the audio transcript backs it up.
export function validateSegments(
  ocr: Segment[],
  whisperTranscript: string,
  opts: ValidateOpts = {},
): ValidatedSegment[] {
  const minConfidence = opts.minConfidence ?? 0.5;
  const minTokens = opts.minTokens ?? 2;

  const wRaw = whisperTranscript.split(/\s+/).filter(Boolean);
  const wNorm = wRaw.map(norm);

  return ocr.map((seg) => {
    const segTokens = toTokens(seg.text);
    const result: ValidatedSegment = {
      ...seg,
      ocrText: seg.text,
      confidence: 0,
      verified: false,
    };
    if (segTokens.length === 0 || wNorm.length === 0) return result;

    // Slide a window the size of the OCR segment across the transcript and find
    // the position whose words overlap the segment most (order-insensitive).
    const win = segTokens.length;
    const segSet = new Set(segTokens);
    let best = 0;
    let bestPos = 0;
    const limit = Math.max(1, wNorm.length - win + 1);
    for (let p = 0; p < limit; p++) {
      let matches = 0;
      for (let i = 0; i < win && p + i < wNorm.length; i++) {
        if (segSet.has(wNorm[p + i])) matches++;
      }
      if (matches > best) {
        best = matches;
        bestPos = p;
      }
    }

    const confidence = Number((best / segTokens.length).toFixed(2));
    const verified = segTokens.length >= minTokens && confidence >= minConfidence;
    // Verified segments adopt Whisper's cleaner wording for that span; the rest
    // keep the OCR text so nothing is silently dropped from view.
    const text = verified ? wRaw.slice(bestPos, bestPos + win).join(" ") : seg.text;

    return { ...result, confidence, verified, text };
  });
}

// The trustworthy subset, in the plain Segment shape ready for the backend.
export function guaranteedSegments(validated: ValidatedSegment[]): Segment[] {
  return validated
    .filter((v) => v.verified)
    .map(({ start, duration, text }) => ({ start, duration, text }));
}
