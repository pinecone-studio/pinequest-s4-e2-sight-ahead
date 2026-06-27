"use client"

import { useEffect, useRef, useState } from "react"
import { fetchTranscript, streamProcess, base64ToBlobUrl, type StreamedSegment } from "@/lib/process-stream"

export type DubStep = "idle" | "fetching" | "translating" | "tts" | "ready" | "error"

type DubSegment = {
  start: number
  duration: number
  blobUrl: string | null
}

export function useDubAudio(
  videoId: string,
  currentTime: number,
  enabled: boolean,
  gender: "male" | "female",
  playbackRate: number = 1,
) {
  const [segments, setSegments] = useState<DubSegment[]>([])
  const [step, setStep] = useState<DubStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeIdxRef = useRef<number>(-1)
  const abortRef = useRef<AbortController | null>(null)
  const blobUrlsRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
      abortRef.current?.abort()
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  // Fetch transcript + stream translate/TTS when enabled or gender changes
  useEffect(() => {
    if (!videoId || !enabled) return

    audioRef.current?.pause()
    audioRef.current = null
    activeIdxRef.current = -1
    abortRef.current?.abort()
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlsRef.current = []
    setSegments([])
    setError(null)
    setProgress(null)
    setStep("fetching")

    const controller = new AbortController()
    abortRef.current = controller

    void (async () => {
      try {
        const transcript = await fetchTranscript(videoId)
        if (controller.signal.aborted) return

        if (!transcript.segments.length) {
          setError("No transcript available for this video.")
          setStep("error")
          return
        }

        const total = transcript.segments.length
        const built: DubSegment[] = transcript.segments.map((s) => ({
          start: s.start,
          duration: s.duration,
          blobUrl: null,
        }))
        setStep("translating")
        setProgress({ done: 0, total })

        await streamProcess(
          { source_lang: transcript.source_lang, segments: transcript.segments, gender },
          {
            onSegment: (seg: StreamedSegment, index: number, segTotal: number) => {
              if (controller.signal.aborted) return
              const blobUrl = seg.audio_b64 ? base64ToBlobUrl(seg.audio_b64) : null
              if (blobUrl) blobUrlsRef.current.push(blobUrl)
              built[index] = { start: seg.offset, duration: seg.duration, blobUrl }
              setSegments([...built])
              setProgress({ done: index + 1, total: segTotal })
              if (index === 0) setStep("tts")
            },
            onDone: () => {
              if (controller.signal.aborted) return
              setStep("ready")
              setProgress(null)
            },
            onError: (msg: string) => {
              if (controller.signal.aborted) return
              setError(msg)
              setStep("error")
              setProgress(null)
            },
          },
          controller.signal,
        )
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Дуб бэлдэхэд алдаа гарлаа")
        setStep("error")
        setProgress(null)
      }
    })()

    return () => {
      controller.abort()
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [videoId, enabled, gender])

  // Clear everything when dub mode is turned off
  useEffect(() => {
    if (enabled) return
    abortRef.current?.abort()
    abortRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    activeIdxRef.current = -1
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlsRef.current = []
    setSegments([])
    setError(null)
    setProgress(null)
    setStep("idle")
  }, [enabled])

  // Apply playback rate changes to currently playing audio
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // Sync audio to video playback time — runs every 250ms via currentTime
  useEffect(() => {
    if (!enabled || segments.length === 0) return

    const idx = segments.findIndex(
      (s) => currentTime >= s.start && currentTime < s.start + s.duration,
    )

    if (idx === -1) {
      audioRef.current?.pause()
      return
    }

    if (idx === activeIdxRef.current && audioRef.current) {
      const expected = currentTime - segments[idx].start
      if (Math.abs(audioRef.current.currentTime - expected) > 0.5) {
        audioRef.current.currentTime = expected
      }
      return
    }

    audioRef.current?.pause()
    audioRef.current = null

    const seg = segments[idx]
    activeIdxRef.current = idx
    if (!seg.blobUrl) return

    const audio = new Audio(seg.blobUrl)
    audio.currentTime = Math.max(0, currentTime - seg.start)
    audio.playbackRate = playbackRate
    audioRef.current = audio
    audio.play().catch(() => {})
  }, [currentTime, segments, enabled])

  return { step, error, progress, segmentCount: segments.length }
}
