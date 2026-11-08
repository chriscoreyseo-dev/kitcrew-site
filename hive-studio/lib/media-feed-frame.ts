/** The Media Feed inside MarketHive's /hivestudio frame (S624; Tom's video of
    2026-11-07): the sums behind "one scroll" and "the window stays on screen".
    Pure functions, safe on the server and in tests. */

/** The Media Feed and its paging (?cursor=): the routes whose frame MarketHive
    sizes to the studio's content (code/hivestudio_page.js isFeedRoute). */
export function fitsContent(path: string): boolean {
  return path === "/community" || path.startsWith("/community/")
}

/** The page's content height in CSS px: the body's box or what overflows it,
    whichever is taller. Not documentElement.scrollHeight, which is never less
    than the frame itself, so a feed that got shorter (a post unpublished, a
    member excluded) could never shrink the frame back. */
export function contentHeight(body: {
  scrollHeight: number
  getBoundingClientRect: () => { height: number }
}): number {
  return Math.ceil(
    Math.max(body.scrollHeight, body.getBoundingClientRect().height)
  )
}

/** MarketHive's post popup (css/style.css .newsfeed-post-permalink-popup-
    container): 960px wide at most, 92% of the window tall, 37px from the top
    (#page_centered_content_container_inner_inside). 360px is the least it is
    ever squeezed to (D-078). */
export const POPUP = { maxW: 960, share: 0.92, top: 37, min: 360 } as const

/** The part of the frame on screen, in the frame's own coordinates, and the
    frame's height. */
export type Visible = { top: number; height: number; frame: number }

/** Where the post window sits in a frame: 92% of the visible part's height -
    of the window the member actually sees, not of a feed-tall frame - 37px
    under its top (less when the part is short), always inside the frame.
    When even the 360px minimum is taller than the visible part, it centres
    on that part. */
export function popupPlace(v: Visible): { top: number; height: number } {
  const height = Math.min(
    v.frame,
    Math.max(Math.round(v.height * POPUP.share), Math.min(POPUP.min, v.frame))
  )
  const top =
    height <= v.height
      ? v.top + Math.max(0, Math.min(POPUP.top, v.height - height))
      : v.top + v.height / 2 - height / 2
  return {
    top: Math.round(Math.max(0, Math.min(top, v.frame - height))),
    height,
  }
}

/** "2026-11-08 01:40:30": the News Feed's Permalink date (its CREATED_AT),
    in the viewer's time. */
export function permalinkDate(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
