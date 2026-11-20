import { describe, expect, it } from "vitest"

import { placedPart } from "@/lib/client-events"

// S629: MarketHive tells the post window which part of the frame is on screen,
// as fractions of the frame's height. Anything else is ignored and the window
// measures for itself, as it did before.
describe("placedPart", () => {
  it("takes the fractions MarketHive sends", () => {
    expect(placedPart(0, 0.25)).toEqual({ top: 0, height: 0.25 })
    expect(placedPart(0.1, 0.2)).toEqual({ top: 0.1, height: 0.2 })
    expect(placedPart(0, 1)).toEqual({ top: 0, height: 1 })
  })

  it("forgives a rounding hair past the end of the frame", () => {
    expect(placedPart(0.5, 0.50005)).toEqual({ top: 0.5, height: 0.5 })
  })

  it("ignores an answer with no numbers (an older MarketHive page)", () => {
    expect(placedPart(undefined, undefined)).toBeNull()
    expect(placedPart(0, undefined)).toBeNull()
  })

  it("ignores anything that is not a part of the frame", () => {
    expect(placedPart("0", "1")).toBeNull()
    expect(placedPart(NaN, 0.5)).toBeNull()
    expect(placedPart(0, Infinity)).toBeNull()
    expect(placedPart(-0.1, 0.5)).toBeNull()
    expect(placedPart(0, 0)).toBeNull()
    expect(placedPart(0, -0.2)).toBeNull()
    expect(placedPart(0.8, 0.5)).toBeNull()
    expect(placedPart(0, 200)).toBeNull()
  })
})
