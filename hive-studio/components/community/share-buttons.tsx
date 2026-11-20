"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Link2 } from "lucide-react"

/** The News Feed's row of coloured share squares (D-079), for a Media Feed
    post's public page /g/<id>. Chris: "all of the different social network
    share buttons ... function the same way" - so this is the News Feed's own
    widget: ShareThis inline buttons on MarketHive's ShareThis property
    (newsfeed_query.php), which owns the networks and their order. If
    ShareThis can't load (blocked, offline), our own squares stand in:
    Facebook, X, Pinterest, Email, LinkedIn, Reddit, Tumblr, Telegram,
    WhatsApp, and copy the link. */

const SHARETHIS_SRC =
  "https://platform-api.sharethis.com/js/sharethis.js#property=5fe204321226130018af0226&product=inline-share-buttons"

type ShareThis = { initialize: () => void; load: (kind: string) => void }

let shareThis: Promise<ShareThis> | null = null

/** Loads ShareThis once per page; rejects if it doesn't arrive. */
function loadShareThis(): Promise<ShareThis> {
  const ready = () =>
    (window as unknown as { __sharethis__?: ShareThis }).__sharethis__
  const existing = ready()
  if (existing) return Promise.resolve(existing)
  shareThis ??= new Promise<ShareThis>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SHARETHIS_SRC
    script.async = true
    script.onload = () => {
      const st = ready()
      if (st) resolve(st)
      else reject(new Error("ShareThis missing"))
    }
    script.onerror = () => reject(new Error("ShareThis blocked"))
    document.head.appendChild(script)
    window.setTimeout(() => reject(new Error("ShareThis timeout")), 8000)
  }).catch((error: unknown) => {
    shareThis = null
    throw error
  })
  return shareThis
}

type Target = {
  name: string
  short: string
  bg: string
  fg?: string
  href: (u: string, t: string, img: string) => string
}

const TARGETS: Target[] = [
  {
    name: "Facebook",
    short: "f",
    bg: "#5f8ee8",
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  },
  {
    name: "X",
    short: "X",
    bg: "#000000",
    href: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
  },
  {
    name: "Pinterest",
    short: "P",
    bg: "#e8364c",
    href: (u, t, img) =>
      `https://pinterest.com/pin/create/button/?url=${u}&description=${t}${img ? `&media=${img}` : ""}`,
  },
  {
    name: "Email",
    short: "@",
    bg: "#c4c4c4",
    href: (u, t) => `mailto:?subject=${t}&body=${u}`,
  },
  {
    name: "LinkedIn",
    short: "in",
    bg: "#13b0e8",
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  },
  {
    name: "Reddit",
    short: "r",
    bg: "#f2611f",
    href: (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}`,
  },
  {
    name: "Tumblr",
    short: "t",
    bg: "#5a7b9c",
    href: (u, t) =>
      `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${u}&title=${t}`,
  },
  {
    name: "Telegram",
    short: "Tg",
    bg: "#3fa9e0",
    href: (u, t) => `https://t.me/share/url?url=${u}&text=${t}`,
  },
  {
    name: "WhatsApp",
    short: "W",
    bg: "#2fbf5b",
    href: (u, t) => `https://wa.me/?text=${t}%20${u}`,
  },
]

export function shareLink(postId: string) {
  return `${window.location.origin}/g/${postId}`
}

export function ShareButtons({
  link,
  label,
  image,
}: {
  link: string
  label: string
  /** The picture, for Pinterest. */
  image?: string
}) {
  const [fallback, setFallback] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    let check = 0
    loadShareThis()
      .then((st) => {
        if (!live) return
        st.initialize()
        try {
          st.load("inline-share-buttons")
        } catch {
          // initialize() already drew every .sharethis-inline-share-buttons
        }
        // ShareThis draws nothing on a host its property doesn't allow:
        // then our own squares stand in.
        check = window.setTimeout(() => {
          if (live && !box.current?.childElementCount) setFallback(true)
        }, 3000)
      })
      .catch(() => live && setFallback(true))
    return () => {
      live = false
      window.clearTimeout(check)
    }
  }, [link])

  if (!fallback)
    return (
      <div
        ref={box}
        className="sharethis-inline-share-buttons"
        data-url={link}
        data-title={label.slice(0, 120) || "Made on Hive Studio"}
        {...(image ? { "data-image": image } : {})}
      />
    )
  return <OwnSquares link={link} label={label} image={image} />
}

function OwnSquares({
  link,
  label,
  image,
}: {
  link: string
  label: string
  image?: string
}) {
  const [copied, setCopied] = useState(false)
  const u = encodeURIComponent(link)
  const t = encodeURIComponent(label.slice(0, 120) || "Made on Hive Studio")
  const img = image ? encodeURIComponent(image) : ""

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <ul className="flex flex-wrap gap-[8px]" aria-label="Share this post">
      {TARGETS.map((target) => (
        <li key={target.name}>
          <a
            href={target.href(u, t, img)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Share on ${target.name}`}
            aria-label={`Share on ${target.name}`}
            className="flex size-9 items-center justify-center rounded-[4px] text-[13px] font-bold text-white hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            style={{ background: target.bg }}
          >
            {target.short}
          </a>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={copy}
          title="Copy link"
          aria-label={copied ? "Link copied" : "Copy link"}
          className="flex size-9 items-center justify-center rounded-[4px] bg-[#eef25a] text-[#333] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Link2 className="size-4" aria-hidden />
          )}
        </button>
      </li>
    </ul>
  )
}
