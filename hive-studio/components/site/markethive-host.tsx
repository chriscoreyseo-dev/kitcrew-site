"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { balanceAction } from "@/generation/billing-actions"
import { listLibraryAction } from "@/generation/library-actions"
import {
  announceBalance,
  BALANCE_EVENT,
  FRAME_PLACED_EVENT,
  LIBRARY_EVENT,
  POST_WINDOW_EVENT,
} from "@/lib/client-events"
import { contentHeight, fitsContent } from "@/lib/media-feed-frame"
import { useProjects } from "@/lib/studio/projects"

/** MarketHive's LIBRARY menu (S584): home | all | new | project:<id>. */
const LIBRARY_TARGET = /^(home|all|new|project:[A-Za-z0-9-]{1,64})$/

/** Where a Library choice lives when the library view is not on screen. */
function libraryPath(target: string): string {
  if (target === "home") return "/assets?library=home"
  if (target === "new") return "/assets?library=new"
  if (target.startsWith("project:")) return `/projects/${target.slice(8)}`
  return "/assets"
}

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
 *
 * Balance (S584): the studio holds Hive credits in cents; the page shows dollars,
 * so `credits` is posted in dollars. Topping up: in page mode the studio's own
 * "Add credits" links (href = creditsUrl) post {type: "hive-studio:add-credits"}
 * and the page opens MarketHive's Wallet on the Vault section in place; when it
 * closes the page sends {type: "hive-studio:refresh-balance"}.
 *
 * One scroll on the Media Feed (S624; Tom, 2026-11-07: "Why do we have the
 * scroll inside the scroll? ... get rid of it"): in page mode on /community
 * (and its paging) the studio reports its content height,
 * {type: "hive-studio:height", height, path}, and MarketHive makes the frame
 * that tall, so MarketHive's page is the only scroll. A ResizeObserver on the
 * page sends at most one message per animation frame, and only when the
 * height changed. html[data-mh-fit="content"] drops the body's screen-height
 * minimum there (styles/markethive.css) so the frame can shrink as well as
 * grow. Generator pages keep MarketHive's screen-height frame.
 * In a frame that tall, anything fixed to the frame's middle (every dialog)
 * would open thousands of pixels off screen, so the part of the frame on
 * screen is kept in --mh-vis-top / --mh-vis-h on <html> (an
 * IntersectionObserver on a frame-sized probe; its root is the top-level
 * viewport, even cross-origin) and dialogs centre on it. While the frame
 * covers the whole screen the observer has nothing new to report as the page
 * scrolls, so it is asked afresh on every press (pointerdown, keydown) - just
 * before a dialog can open.
 *
 * The post window at one size (S628; Chris: "I want it just to be the same
 * size all the time when I open it up"): the window is sized to the part of
 * the frame on screen, and at the top of the page MarketHive's bars take the
 * first 250px of the screen, so it opened small and grew as the page scrolled.
 * The studio now says when the window opens and closes,
 * {type: "hive-studio:popup", open}; MarketHive brings the frame to the top
 * of the screen (and puts the page back on close) and answers
 * {type: "hive-studio:popup-placed"}, after which the window measures once.
 */
export function MarketHiveHost({
  homeUrl,
  creditsUrl,
}: {
  homeUrl: string
  creditsUrl: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const origin = originOf(homeUrl)
  const [pageMode, setPageMode] = useState(false)

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
        setPageMode(true)
        post({ type: "hive-studio:route", path: window.location.pathname })
      } else if (
        data?.type === "hive-studio:library" &&
        typeof (data as { target?: unknown }).target === "string" &&
        LIBRARY_TARGET.test((data as { target: string }).target)
      ) {
        const target = (data as { target: string }).target
        const path = window.location.pathname
        // The library view is mounted: switch it in place. Otherwise go there.
        if (path === "/assets" || path.startsWith("/projects/"))
          window.dispatchEvent(
            new CustomEvent(LIBRARY_EVENT, { detail: target })
          )
        else router.push(libraryPath(target))
      } else if (data?.type === "hive-studio:refresh-balance") {
        void balanceAction().then((r) => {
          if (r.ok) announceBalance(r.data.subscription + r.data.topup)
        })
      } else if (
        data?.type === "hive-studio:navigate" &&
        typeof data.path === "string" &&
        SAFE_PATH.test(data.path)
      ) {
        router.push(data.path)
      } else if (data?.type === "hive-studio:popup-placed") {
        window.dispatchEvent(new Event(FRAME_PLACED_EVENT))
      }
    }
    const onPostWindow = (event: Event) => {
      const open = (event as CustomEvent<boolean>).detail
      if (typeof open === "boolean") post({ type: "hive-studio:popup", open })
    }
    const onBalance = (event: Event) => {
      const credits = (event as CustomEvent<number>).detail
      if (typeof credits === "number" && Number.isFinite(credits))
        post({ type: "hive-studio:balance", credits: credits / 100 })
    }
    // Page mode: Add credits opens the Wallet on the page, not a new page load.
    const onClick = (event: MouseEvent) => {
      if (document.documentElement.dataset.mhChrome !== "page" || !creditsUrl)
        return
      const link = (event.target as Element | null)?.closest?.("a[href]")
      if (!link || link.getAttribute("href") !== creditsUrl) return
      event.preventDefault()
      post({ type: "hive-studio:add-credits" })
    }

    window.addEventListener("message", onMessage)
    window.addEventListener(BALANCE_EVENT, onBalance)
    window.addEventListener(POST_WINDOW_EVENT, onPostWindow)
    document.addEventListener("click", onClick, true)
    post({ type: "hive-studio:ready" })
    return () => {
      window.removeEventListener("message", onMessage)
      window.removeEventListener(BALANCE_EVENT, onBalance)
      window.removeEventListener(POST_WINDOW_EVENT, onPostWindow)
      document.removeEventListener("click", onClick, true)
    }
  }, [origin, router, creditsUrl])

  useEffect(() => {
    if (!origin || window.parent === window) return
    const send = () =>
      window.parent.postMessage(
        {
          type: "hive-studio:projects",
          projects: useProjects
            .getState()
            .projects.slice(0, 30)
            .map((p) => ({ id: p.id, name: p.name.slice(0, 80) })),
        },
        origin
      )
    send()
    const unsubscribe = useProjects.subscribe(send)
    if (!useProjects.getState().projects.length)
      void listLibraryAction().then((r) => {
        if (r.ok && !useProjects.getState().projects.length)
          useProjects.getState().hydrate(r.data.projects)
      })
    return unsubscribe
  }, [origin])

  useEffect(() => {
    if (!origin || window.parent === window) return
    window.parent.postMessage(
      { type: "hive-studio:route", path: pathname },
      origin
    )
  }, [origin, pathname])

  useEffect(() => {
    if (
      !origin ||
      window.parent === window ||
      !pageMode ||
      !fitsContent(pathname) ||
      typeof ResizeObserver === "undefined"
    )
      return
    const root = document.documentElement
    root.dataset.mhFit = "content"
    let frame = 0
    let last = -1
    const send = () => {
      frame = 0
      const height = contentHeight(document.body)
      if (height === last) return
      last = height
      window.parent.postMessage(
        {
          type: "hive-studio:height",
          height,
          path: window.location.pathname,
        },
        origin
      )
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(send)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    schedule()

    const probe = document.createElement("div")
    probe.setAttribute("aria-hidden", "true")
    probe.style.cssText =
      "position:fixed;inset:0;pointer-events:none;visibility:hidden"
    document.body.appendChild(probe)
    const seen =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              const r = entry?.intersectionRect
              if (!r || r.height <= 0) return
              root.style.setProperty("--mh-vis-top", `${Math.round(r.top)}px`)
              root.style.setProperty("--mh-vis-h", `${Math.round(r.height)}px`)
            },
            { threshold: Array.from({ length: 51 }, (_, i) => i / 50) }
          )
    seen?.observe(probe)
    const refresh = () => {
      seen?.unobserve(probe)
      seen?.observe(probe)
    }
    document.addEventListener("pointerdown", refresh, true)
    document.addEventListener("keydown", refresh, true)

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      seen?.disconnect()
      probe.remove()
      document.removeEventListener("pointerdown", refresh, true)
      document.removeEventListener("keydown", refresh, true)
      root.style.removeProperty("--mh-vis-top")
      root.style.removeProperty("--mh-vis-h")
      delete root.dataset.mhFit
    }
  }, [origin, pageMode, pathname])

  return null
}
