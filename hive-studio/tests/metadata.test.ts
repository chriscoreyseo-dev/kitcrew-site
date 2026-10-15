import { describe, expect, it } from "vitest"

import { MODELS } from "@/generation/catalog"
import { MODEL_META } from "@/generation/catalog/metadata"

describe("model metadata", () => {
  it("covers exactly the installed catalog", () => {
    expect(Object.keys(MODEL_META).sort()).toEqual(
      MODELS.map((m) => m.id).sort()
    )
  })

  it("AUDIO and 4K badges match what the model can actually do", () => {
    for (const model of MODELS) {
      const badges = MODEL_META[model.id]?.badges ?? []
      const settings = JSON.stringify(model.settings)
      if (badges.includes("AUDIO"))
        expect(settings, model.id).toMatch(/generateAudio|sound|audio/i)
      if (badges.includes("4K"))
        expect(settings + model.id, model.id).toMatch(/4k/i)
    }
  })
})
