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
