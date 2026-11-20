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

/** The controls inside a Media Feed row that keep their own click and never
    open the post window: links (the photo, the name, the opener links, which
    open it themselves), buttons (the D-079 bar, the three-dot menu, Like,
    Dislike, Comment (n)), form fields, players and anything acting as a
    button or menu. Mirrors MarketHive's whole-card rule for Blog Feed rows
    (js/blog_post_popup.js: `closest('a, .nf-post-action-bar, ...')`). */
export const ROW_CONTROLS =
  "a, button, input, textarea, select, option, label, summary, video, audio, iframe, [role='button'], [role='menu'], [role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio'], [role='option'], [role='checkbox'], [role='switch'], [role='dialog'], [contenteditable=''], [contenteditable='true'], [data-row-control]"

/** Chris, 2026-11-09: "I should be able to click anywhere inside of our
    table and have it open up the next window" - a plain click on any part of
    a Media Feed row (text, empty space, picture) opens the post window, the
    way a News Feed row does. Not when a control inside the row already
    handled it (or would), not a modified or non-primary click, and not a
    click that only bubbled up through React from a portal (a menu or dialog
    drawn outside the row). */
export function rowClickOpens(
  event: {
    defaultPrevented: boolean
    button: number
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
  },
  target: { closest: (selector: string) => unknown } | null,
  row: { contains: (node: never) => boolean }
): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return false
  if (!target || !row.contains(target as never)) return false
  return !target.closest(ROW_CONTROLS)
}
