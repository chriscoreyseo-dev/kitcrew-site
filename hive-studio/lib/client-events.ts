/** Tiny cross-component signal for the credit balance (header pill ↔ studio). */
export const BALANCE_EVENT = "hive:balance"

export function announceBalance(credits: number): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<number>(BALANCE_EVENT, { detail: credits })
  )
}

/** MarketHive's LIBRARY menu asks the library view for: home | all | new |
    project:<id> (S584). */
export const LIBRARY_EVENT = "hive:library"

/** The Media Feed post window opened (true) or went away (false). Inside
    MarketHive's frame the host passes it on, and MarketHive brings the frame
    to the top of the screen so the window opens at one size wherever the
    member was on the page (S628). */
export const POST_WINDOW_EVENT = "hive:post-window"

export function announcePostWindow(open: boolean): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<boolean>(POST_WINDOW_EVENT, { detail: open })
  )
}

/** MarketHive's answer: the frame is where it will stay while the post window
    is open, so the window can measure the screen once and keep that size. */
export const FRAME_PLACED_EVENT = "hive:frame-placed"

/** Which part of the frame is on screen, as fractions of the frame's height
    (S629). MarketHive sends it with its answer, because it is the page that
    moved the frame; a page that sends none (an older one) leaves the window to
    measure for itself. */
export type PlacedPart = { top: number; height: number }

export function placedPart(top: unknown, height: unknown): PlacedPart | null {
  if (typeof top !== "number" || typeof height !== "number") return null
  if (!Number.isFinite(top) || !Number.isFinite(height)) return null
  if (top < 0 || height <= 0 || top + height > 1.0001) return null
  return { top, height: Math.min(height, 1 - top) }
}
