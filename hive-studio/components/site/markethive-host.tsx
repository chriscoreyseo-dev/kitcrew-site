"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { BALANCE_EVENT } from "@/lib/client-events"

/** Paths the host may send the studio to: same-origin, no scheme, no "//". */
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9\-_/?=&.%]*$/

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * The studio's side of MarketHive's /hivestudio page (S584, D-067). That page
 * frames the studio under MarketHive's own toolbar and, on every frame load,
 * posts {type: "hive-studio:host", chrome: "page"}; the studio then hides its
 * own header (html[data-mh-chrome="page"], styles/markethive.css). The toolbar
 * sends {type: "hive-studio:navigate", path}; the studio reports its route and
 * credit balance back so the toolbar can mark the current section and show the
 * balance. Only the MarketHive origin (MARKETHIVE_BASE_URL) is listened to or
 * written to, and only when the studio is actually framed.
 */
export function MarketHiveHost({ homeUrl }: { homeUrl: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const origin = originOf(homeUrl)

  useEffect(() => {
    if (!origin || window.parent === window) return
    const post = (message: Record<string, unknown>) =>
      window.parent.postMessage(message, origin)

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== window.parent) return
      const data = event.data as {
        type?: unknown
        chrome?: unknown
        path?: unknown
      } | null
      if (data?.type === "hive-studio:host" && data.chrome === "page") {
        document.documentElement.dataset.mhChrome = "page"
        post({ type: "hive-studio:route", path: window.location.pathname })
      } else if (
        data?.type === "hive-studio:navigate" &&
        typeof data.path === "string" &&
        SAFE_PATH.test(data.path)
      ) {
        router.push(data.path)
      }
    }
    const onBalance = (event: Event) => {
      const credits = (event as CustomEvent<number>).detail
      if (typeof credits === "number" && Number.isFinite(credits))
        post({ type: "hive-studio:balance", credits })
    }

    window.addEventListener("message", onMessage)
    window.addEventListener(BALANCE_EVENT, onBalance)
    post({ type: "hive-studio:ready" })
    return () => {
      window.removeEventListener("message", onMessage)
      window.removeEventListener(BALANCE_EVENT, onBalance)
    }
  }, [origin, router])

  useEffect(() => {
    if (!origin || window.parent === window) return
    window.parent.postMessage(
      { type: "hive-studio:route", path: pathname },
      origin
    )
  }, [origin, pathname])

  return null
}
