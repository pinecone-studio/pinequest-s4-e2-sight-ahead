/// <reference lib="webworker" />

// Web Worker: runs in-browser speech-to-text with transformers.js so the model
// inference never blocks the UI thread. Receives 16 kHz mono Float32 audio
// windows from WhisperTranscriber and posts back the transcribed text.
//
// Requires the package:  npm i @xenova/transformers
// (Imported inside a Worker, webpack resolves the BROWSER build, so the Node-only
// onnxruntime isn't bundled.)

import { pipeline, env } from "@xenova/transformers";

// Fetch the model from the HF hub (don't look for local model files).
env.allowLocalModels = false;

// Lazy singleton — load the model once, on first use.
let transcriberPromise: Promise<any> | null = null;
function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
    );
  }
  return transcriberPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  // Preload the model so the first real transcription isn't extra slow.
  if (msg?.type === "init") {
    try {
      await getTranscriber();
      (self as DedicatedWorkerGlobalScope).postMessage({ type: "ready" });
    } catch (err) {
      (self as DedicatedWorkerGlobalScope).postMessage({
        type: "error",
        error: String(err),
      });
    }
    return;
  }

  // Transcribe one audio window (Float32, 16 kHz, mono, range [-1, 1]).
  if (msg?.type === "audio") {
    try {
      const transcriber = await getTranscriber();
      const out = await transcriber(msg.samples as Float32Array, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      const text = (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out?.text ?? "")
        .trim();
      (self as DedicatedWorkerGlobalScope).postMessage({ type: "text", text });
    } catch (err) {
      (self as DedicatedWorkerGlobalScope).postMessage({
        type: "error",
        error: String(err),
      });
    }
  }
};
