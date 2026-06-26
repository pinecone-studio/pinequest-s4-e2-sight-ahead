"use client";

import { useEffect, useState } from "react";
import { processVideo, type Segment } from "@/lib/backend-api";

// Calls POST /process for the selected video and returns the translated
// segment data (transcript). Audio dub (segment.audio_path) is returned too but
// not played yet — that needs a backend restructure.
export function useProcessedVideo(videoId: string) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!videoId) {
      setSegments([]);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    processVideo(videoId)
      .then((result) => {
        if (active) setSegments(result.segments);
      })
      .catch((err) => {
        if (!active) return;
        setSegments([]);
        setError(err instanceof Error ? err.message : "Transcript failed to load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [videoId]);

  return { segments, loading, error };
}
