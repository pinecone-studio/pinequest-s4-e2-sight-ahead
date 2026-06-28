"use client";

// Real-time-ish speech-to-text from the SHARED TAB'S AUDIO using in-browser
// Whisper (transformers.js, run in a Web Worker). An alternative to OCR: instead
// of reading pixels in a box (which picks up non-caption junk), it transcribes
// what's actually being said. Captures the audio track, downsamples it to 16 kHz
// mono, and transcribes a sliding window every few seconds. Overlapping windows
// are de-duplicated downstream by CaptionAssembler.

import { useEffect, useRef, useState } from "react";
import { useScreenShare } from "./ScreenShareProvider";

const TARGET_RATE = 16000; // Whisper expects 16 kHz mono
const WINDOW_SEC = 10; // transcribe the last N seconds each pass
const STRIDE_MS = 4000; // start a new pass every N ms (if not already busy)
const MIN_SEC = 2; // wait for at least this much audio before the first pass

type Props = { onText: (text: string) => void };

export function WhisperTranscriber({ onText }: Props) {
  const { stream } = useScreenShare();
  const [status, setStatus] = useState("starting…");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      setStatus('no audio — re-share and tick "Share tab audio".');
      return;
    }

    let cancelled = false;
    let busy = false;

    // ── Audio capture: collect mono chunks at the context's native rate. ──
    const ctx = new AudioContext();
    const nativeRate = ctx.sampleRate;
    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    // Route through a muted gain so the processor runs without replaying audio.
    const mute = ctx.createGain();
    mute.gain.value = 0;

    const maxSamples = Math.ceil(nativeRate * (WINDOW_SEC + 1));
    let chunks: Float32Array[] = [];
    let total = 0;

    processor.onaudioprocess = (ev) => {
      // Copy — WebAudio reuses the underlying buffer between callbacks.
      const ch = new Float32Array(ev.inputBuffer.getChannelData(0));
      chunks.push(ch);
      total += ch.length;
      // Drop old chunks beyond the window we keep.
      while (chunks.length > 1 && total - chunks[0].length >= maxSamples) {
        total -= chunks.shift()!.length;
      }
    };

    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);

    // ── Worker: model inference off the main thread. ──
    const worker = new Worker(new URL("./whisperWorker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") setStatus("listening…");
      else if (m.type === "error") setStatus("error: " + m.error);
      else if (m.type === "text") {
        busy = false;
        if (!cancelled && m.text) onTextRef.current(m.text);
      }
    };
    worker.onerror = (e) => setStatus("worker error: " + e.message);
    setStatus("loading model…");
    worker.postMessage({ type: "init" });

    // ── Drive transcription on a fixed stride (skip if a pass is in flight). ──
    const interval = setInterval(() => {
      if (cancelled || busy || total < nativeRate * MIN_SEC) return;

      // Concatenate the kept chunks into one window, then downsample to 16 kHz.
      const window = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        window.set(c, off);
        off += c.length;
      }
      const samples = downsample(window, nativeRate, TARGET_RATE);
      busy = true;
      worker.postMessage({ type: "audio", samples }, [samples.buffer]);
    }, STRIDE_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
      void ctx.close();
      worker.terminate();
      chunks = [];
    };
  }, [stream]);

  return <span className="text-sm text-zinc-400">Whisper: {status}</span>;
}

// Linear-interpolation downsample to the target rate (mono).
function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return input;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = idx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}
