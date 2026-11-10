import { describe, expect, it } from "vitest"

import {
  contentHeight,
  fitsContent,
  permalinkDate,
  popupPlace,
  rowClickOpens,
  ROW_CONTROLS,
} from "@/lib/media-feed-frame"

/** S624 (Tom's video, 2026-11-07): the Media Feed inside MarketHive's frame -
    one scroll (the frame takes the feed's height) and the News Feed popup
    kept on screen in that tall frame. */

describe("which routes size the frame to the feed", () => {
  it("is the Media Feed and its paging, nothing else", () => {
    expect(fitsContent("/community")).toBe(true)
    expect(fitsContent("/community/anything")).toBe(true)
    expect(fitsContent("/communityx")).toBe(false)
    expect(fitsContent("/image")).toBe(false)
    expect(fitsContent("/g/abc")).toBe(false)
    expect(fitsContent("/watch-later")).toBe(false)
  })
})

describe("the height the studio reports", () => {
  const body = (scrollHeight: number, height: number) => ({
    scrollHeight,
    getBoundingClientRect: () => ({ height }),
  })
  it("is the content, rounded up, overflow included", () => {
    expect(contentHeight(body(1200, 1199.2))).toBe(1200)
    expect(contentHeight(body(900, 1450.4))).toBe(1451)
  })
})

describe("the post window in a frame", () => {
  it("unframed-like: the whole frame on screen takes 92% of it, 37px down", () => {
    expect(popupPlace({ top: 0, height: 1000, frame: 1000 })).toEqual({
      top: 37,
      height: 920,
    })
  })

  it("a feed-tall frame: 92% of the screen's part, at that part's top", () => {
    // 9000px frame, the member is looking at 4000..4900 of it.
    expect(popupPlace({ top: 4000, height: 900, frame: 9000 })).toEqual({
      top: 4037,
      height: 828,
    })
  })

  it("the frame's top edge on screen: under it, not in the frame's middle", () => {
    // MarketHive's bars take the first 250px of a 1080px screen.
    expect(popupPlace({ top: 0, height: 830, frame: 9000 })).toEqual({
      top: 37,
      height: 764,
    })
  })

  it("the frame's bottom edge on screen: never past the frame", () => {
    const p = popupPlace({ top: 8500, height: 500, frame: 9000 })
    expect(p.height).toBe(460)
    expect(p.top + p.height).toBeLessThanOrEqual(9000)
    expect(p.top).toBeGreaterThanOrEqual(8500)
  })

  it("a sliver on screen: 360px at least, centred on the sliver, inside the frame", () => {
    const p = popupPlace({ top: 3000, height: 200, frame: 9000 })
    expect(p.height).toBe(360)
    expect(p.top).toBe(3000 + 100 - 180)
    expect(popupPlace({ top: 0, height: 120, frame: 9000 }).top).toBe(0)
  })

  it("a frame shorter than 360px: the whole frame", () => {
    expect(popupPlace({ top: 0, height: 300, frame: 300 })).toEqual({
      top: 0,
      height: 300,
    })
  })
})

describe("the Permalink date", () => {
  it("reads like the News Feed's CREATED_AT", () => {
    const ms = new Date(2026, 10, 8, 1, 40, 30).getTime()
    expect(permalinkDate(ms)).toBe("2026-11-08 01:40:30")
  })
})

/** Chris, 2026-11-09: a click anywhere on a Media Feed row opens the post
    window, as on the News Feed; the row's own controls keep their click. */
describe("a click on a Media Feed row", () => {
  const plain = {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  }
  // A stand-in element, inside a row control or not; a stand-in row that
  // holds the clicked element or not.
  const el = (inControl: boolean) => ({
    closest: (selector: string) =>
      inControl && selector === ROW_CONTROLS ? {} : null,
  })
  const row = (holds: boolean) => ({ contains: () => holds })

  it("opens on text, empty space or the picture box", () => {
    expect(rowClickOpens(plain, el(false), row(true))).toBe(true)
  })
  it("leaves links, buttons, menus and players to themselves", () => {
    expect(rowClickOpens(plain, el(true), row(true))).toBe(false)
  })
  it("does not open twice when an opener link already handled it", () => {
    expect(
      rowClickOpens({ ...plain, defaultPrevented: true }, el(false), row(true))
    ).toBe(false)
  })
  it("ignores modified and non-primary clicks", () => {
    for (const k of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)
      expect(rowClickOpens({ ...plain, [k]: true }, el(false), row(true))).toBe(
        false
      )
    expect(rowClickOpens({ ...plain, button: 1 }, el(false), row(true))).toBe(
      false
    )
  })
  it("ignores a click that bubbled in from a portal outside the row", () => {
    expect(rowClickOpens(plain, el(false), row(false))).toBe(false)
    expect(rowClickOpens(plain, null, row(true))).toBe(false)
  })
  it("names every control the row draws", () => {
    for (const s of [
      "a",
      "button",
      "input",
      "textarea",
      "video",
      "[role='menuitem']",
      "[role='dialog']",
    ])
      expect(ROW_CONTROLS.split(", ")).toContain(s)
  })
})
