"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { cn } from "@/lib/utils"

/** MarketHive's dictation mic (js/mh_dictate.js, S412) for a React field in
    the Media Feed (Chris, 2026-10-30: "inside the write a comment box ... we
    need to have a microphone"). MarketHive's script writes the field's value
    directly, which a React-controlled field never sees, so this is the same
    mic built the React way, with the same look and the same rules:
    - APPENDS to what is there, never replaces (people dictate in chunks);
    - continuous + interim results, the words show while you speak;
    - restarts itself when Chrome ends recognition after a silence;
    - English voice punctuation ("period", "comma", "question mark" ...);
    - honours the field's maximum length;
    - one mic at a time: starting one stops any other;
    - stops when the text is sent (the field calls `stop()`; what is on
      screen is what goes).
    Audio goes to the browser's speech service, as on MarketHive. Without
    speech recognition (Firefox) the mic is not shown. */

type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
type RecognitionEvent = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Join dictated text on without gluing words or opening a gap. */
export function joinText(base: string, add: string): string {
  if (!base) return add
  if (/^[.,!?;:]/.test(add)) return base.replace(/\s+$/, "") + add
  if (/\s$/.test(base)) return base + add
  return `${base} ${add}`
}

const MARKS: Record<string, string> = {
  period: ".",
  "full stop": ".",
  "question mark": "?",
  "exclamation mark": "!",
  "exclamation point": "!",
  comma: ",",
  semicolon: ";",
  colon: ":",
}

/** English voice commands; "literal period" keeps the word. */
export function punctuate(text: string, lang: string): string {
  if (!/^en(?:-|$)/i.test(lang)) return text
  return text
    .replace(
      /\b(literal\s+)?(question mark|exclamation mark|exclamation point|full stop|semicolon|period|comma|colon)\b[.,!?]?/gi,
      (_m, literal: string | undefined, command: string) =>
        literal ? command : MARKS[command.toLowerCase()]
    )
    .replace(/\s+([.,!?;:])/g, "$1")
}

const noop = () => () => undefined

/** The one listening mic on the page. */
let liveStop: (() => void) | null = null

export type DictateHandle = { stop: () => void }

export const DictateButton = forwardRef<
  DictateHandle,
  {
    /** The field's text now. */
    value: string
    onChange: (text: string) => void
    maxLength?: number
    className?: string
  }
>(function DictateButton({ value, onChange, maxLength, className }, ref) {
  // Feature detection on the client only: never during SSR.
  const supported = useSyncExternalStore(
    noop,
    () => recognitionCtor() !== null,
    () => false
  )
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const want = useRef(false)
  const restarts = useRef<number[]>([])
  const latest = useRef({ value, onChange, maxLength })
  useEffect(() => {
    latest.current = { value, onChange, maxLength }
  })

  useEffect(
    () => () => {
      want.current = false
      rec.current?.abort()
    },
    []
  )

  const cap = (text: string) => {
    const max = latest.current.maxLength
    return max && text.length > max ? text.slice(0, max) : text
  }

  function stop() {
    want.current = false
    setInterim("")
    setListening(false)
    // Abort, not stop: late results never land after Send.
    rec.current?.abort()
    if (liveStop === stop) liveStop = null
  }

  useImperativeHandle(ref, () => ({ stop }))

  function begin() {
    const Ctor = recognitionCtor()
    if (!Ctor) return
    liveStop?.()
    liveStop = stop
    setError(null)
    want.current = true
    restarts.current = []
    const r = new Ctor()
    r.continuous = true
    r.interimResults = true
    r.lang = document.documentElement.lang || "en-US"
    r.onresult = (e) => {
      let heard = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const chunk = punctuate(result[0].transcript.trim(), r.lang)
        if (!chunk) continue
        if (result.isFinal) {
          // Words typed while listening are kept: join onto the field as it is now.
          const next = cap(joinText(latest.current.value, chunk))
          latest.current = { ...latest.current, value: next }
          latest.current.onChange(next)
        } else heard = heard ? `${heard} ${chunk}` : chunk
      }
      setInterim(heard)
    }
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return
      want.current = false
      setListening(false)
      setInterim("")
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone is blocked. Allow it in your browser to dictate."
          : "Dictation stopped. Tap the mic to try again."
      )
    }
    r.onend = () => {
      if (!want.current) return
      // Chrome ends after a silence even in continuous mode: start again,
      // but never more than 5 times in 10 seconds (a restart storm).
      const now = Date.now()
      restarts.current = restarts.current.filter((t) => now - t < 10_000)
      if (restarts.current.length >= 5) {
        stop()
        return
      }
      restarts.current.push(now)
      try {
        r.start()
      } catch {
        stop()
      }
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      want.current = false
      setError("Dictation could not start. Try again.")
    }
  }

  if (!supported) return null
  const label = listening
    ? "Stop dictating"
    : "Dictate — speak instead of typing"
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        onClick={() => (listening ? stop() : begin())}
        title={error ?? label}
        aria-label={error ?? label}
        aria-pressed={listening}
        className={
          listening
            ? "relative flex size-[30px] items-center justify-center rounded-full border border-[#a5301f] bg-[#c0392b] text-white outline-none hover:bg-[#a5301f] focus-visible:shadow-[0_0_0_3px_rgba(95,120,171,.35)]"
            : error
              ? "flex size-[30px] items-center justify-center rounded-full border border-[#b05c5c] bg-[#fdf3f3] text-[#8a2f2f] outline-none focus-visible:shadow-[0_0_0_3px_rgba(95,120,171,.35)]"
              : "flex size-[30px] items-center justify-center rounded-full border border-[#c3c6d6] bg-white text-[#5c6690] outline-none hover:border-[#5c6690] hover:bg-[#eef0f8] hover:text-[#1a1a2e] focus-visible:border-[#5f78ab] focus-visible:shadow-[0_0_0_3px_rgba(95,120,171,.35)]"
        }
      >
        {listening ? (
          <>
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden
              focusable="false"
            >
              <rect
                x="6"
                y="6"
                width="12"
                height="12"
                rx="2"
                fill="currentColor"
              />
            </svg>
            {/* Decoration only: the colour, icon and chip carry the state. */}
            <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#c0392b] motion-safe:animate-ping" />
          </>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            aria-hidden
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M12 14.2a3 3 0 0 0 3-3V5.2a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"
            />
            <path
              fill="currentColor"
              d="M17.4 11.2a.9.9 0 0 0-1.8 0 3.6 3.6 0 0 1-7.2 0 .9.9 0 0 0-1.8 0 5.4 5.4 0 0 0 4.5 5.3v2.2H9.4a.9.9 0 0 0 0 1.8h5.2a.9.9 0 0 0 0-1.8h-1.7v-2.2a5.4 5.4 0 0 0 4.5-5.3z"
            />
          </svg>
        )}
      </button>
      {listening || error ? (
        <span
          role="status"
          className={`pointer-events-none absolute right-0 bottom-[36px] z-10 max-w-[260px] rounded-[3px] px-2 py-[3px] text-[11px] leading-[1.4] font-bold tracking-[.3px] text-white ${
            error ? "bg-[#8a2f2f]" : "truncate bg-[#c0392b]"
          }`}
        >
          {error ?? (interim || "Listening")}
        </span>
      ) : null}
    </span>
  )
})
