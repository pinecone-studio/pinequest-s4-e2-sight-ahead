"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

type ScreenShareState = {
  stream: MediaStream | null;
  error: string | null;
  isSharing: boolean;
  requestShare: () => Promise<void>;
  stopShare: () => void;
};

const ScreenShareContext = createContext<ScreenShareState | null>(null);

// Holds the screen-share MediaStream and exposes request/stop helpers to any
// child via the useScreenShare() hook.
export function ScreenShareProvider({ children }: { children: ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestShare = useCallback(async () => {
    setError(null);
    try {
      // permission prompt. success = granted.
      // audio: true so the Whisper transcriber can read the shared tab's audio —
      // the user must tick "Share tab audio" in the picker for a track to appear.
      // (OCR ignores the audio track, so this is harmless to that path.)
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: true,
      });
      media.getVideoTracks()[0].addEventListener("ended", () => {
        setStream(null);
      });
      setStream(media);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screen share denied");
      setStream(null);
    }
  }, []);

  const stopShare = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  return (
    <ScreenShareContext.Provider
      value={{
        stream,
        error,
        isSharing: stream !== null,
        requestShare,
        stopShare,
      }}
    >
      {children}
    </ScreenShareContext.Provider>
  );
}

export function useScreenShare() {
  const ctx = useContext(ScreenShareContext);
  if (!ctx)
    throw new Error(
      "useScreenShare must be used within the designated Provider",
    );
  return ctx;
}
