"use client"

import { useEffect, useState } from "react"

/** Length of an attached video in seconds, read from its metadata in the
    browser so the Generate button can show a price for models billed on the
    input video (S611, Genjutsu). Display only: the server measures the file
    itself and charges from that. */

const cache = new Map<string, number | null>()
const TIMEOUT_MS = 15_000

export function readVideoSeconds(url: string): Promise<number | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null)
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    let settled = false
    const done = (seconds: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
      cache.set(url, seconds)
      resolve(seconds)
    }
    const timer = setTimeout(() => done(null), TIMEOUT_MS)
    video.onloadedmetadata = () =>
      done(
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : null
      )
    video.onerror = () => done(null)
    video.src = url
  })
}

/** Seconds by URL for the given video URLs, filled in as each one loads. */
export function useVideoSeconds(urls: string[]): Record<string, number> {
  const key = urls.join("\n")
  const [seconds, setSeconds] = useState<Record<string, number>>({})
  useEffect(() => {
    let live = true
    for (const url of key ? key.split("\n") : []) {
      void readVideoSeconds(url).then((value) => {
        if (live && value !== null)
          setSeconds((current) =>
            current[url] === value ? current : { ...current, [url]: value }
          )
      })
    }
    return () => {
      live = false
    }
  }, [key])
  return seconds
}
