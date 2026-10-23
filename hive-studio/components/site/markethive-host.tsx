"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { balanceAction } from "@/generation/billing-actions"
import { listLibraryAction } from "@/generation/library-actions"
import {
  announceBalance,
  BALANCE_EVENT,
  LIBRARY_EVENT,
} from "@/lib/client-events"
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
      }
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
    document.addEventListener("click", onClick, true)
    post({ type: "hive-studio:ready" })
    return () => {
      window.removeEventListener("message", onMessage)
      window.removeEventListener(BALANCE_EVENT, onBalance)
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

  return null
}
