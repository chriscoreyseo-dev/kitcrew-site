"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

/** Muted looping preview that only plays while on screen, and never
    autoplays when the viewer prefers reduced motion. */
export function FeedVideo({
  src,
  className,
  label,
}: {
  src: string
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !reduce.matches)
          video.play().catch(() => undefined)
        else video.pause()
      },
      { threshold: 0.25 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      className={cn("size-full object-cover", className)}
    />
  )
}
