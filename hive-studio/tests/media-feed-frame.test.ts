import { describe, expect, it } from "vitest"

import { permalinkDate, popupPlace } from "@/lib/media-feed-frame"

/** S624 (Tom's video, 2026-11-07): the News Feed popup kept on screen in a
    feed-tall MarketHive frame. */

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
