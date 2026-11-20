import { describe, expect, it } from "vitest"

import { MODELS, parseSettings } from "@/generation/catalog"
import type {
  GenerationPlane,
  MediaRole,
  ModelEntry,
} from "@/generation/catalog/types"
import { toPlatform } from "@/generation/to-platform"

/** Every model × every input combination it advertises → the exact platform
    request (or the error the user would see). Snapshots make any mapper change
    reviewable; the assertions below pin the bugs fixed in Phase 4. */

const KIND: Record<MediaRole, "image" | "video" | "audio"> = {
  start: "image",
  end: "image",
  reference: "image",
  video: "video",
  audio: "audio",
  source: "video",
}

function item(role: MediaRole, n = 0) {
  return {
    id: `${role}${n}`,
    url: `https://in.test/${role}${n}`,
    role,
    kind: KIND[role],
  }
}

function plane(
  model: ModelEntry,
  media: Partial<Record<MediaRole, number>>,
  prompt = "a lighthouse at dusk"
): GenerationPlane {
  return {
    model: model.id,
    prompt: { text: prompt },
    media: Object.fromEntries(
      Object.entries(media).map(([role, count]) => [
        role,
        Array.from({ length: count ?? 0 }, (_, n) =>
          item(role as MediaRole, n)
        ),
      ])
    ),
    settings: parseSettings(model, {}),
  }
}

function scenarios(
  model: ModelEntry
): Array<[string, Partial<Record<MediaRole, number>>]> {
  const r = model.roles
  const list: Array<[string, Partial<Record<MediaRole, number>>]> = [
    ["prompt only", {}],
  ]
  if (r.start) list.push(["start frame", { start: 1 }])
  if (r.start && r.end) list.push(["start + end frames", { start: 1, end: 1 }])
  if (r.reference)
    list.push(["references", { reference: Math.min(2, r.reference) }])
  if (r.video) list.push(["video reference", { video: 1 }])
  if (r.audio) list.push(["audio reference", { audio: 1 }])
  if (r.source) list.push(["source video", { source: 1 }])
  return list
}

function attempt(p: GenerationPlane) {
  try {
    return toPlatform(p)
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

describe("toPlatform snapshots", () => {
  for (const model of MODELS) {
    it(model.id, () => {
      const out = Object.fromEntries(
        scenarios(model).map(([name, media]) => [
          name,
          attempt(plane(model, media)),
        ])
      )
      expect(out).toMatchSnapshot()
    })
  }
})

describe("invariants", () => {
  it("every path is a relative catalog path", () => {
    for (const model of MODELS)
      for (const [, media] of scenarios(model)) {
        const result = attempt(plane(model, media))
        if ("path" in result)
          expect(result.path, model.id).toMatch(/^[a-z0-9][a-z0-9._/-]*$/i)
      }
  })

  it("an attached frame is never silently dropped", () => {
    const dropped = MODELS.filter((model) => {
      if (!model.roles.start) return false
      const result = attempt(plane(model, { start: 1 }))
      return (
        "body" in result &&
        !JSON.stringify(result.body).includes("https://in.test/start0")
      )
    }).map((m) => m.id)
    expect(dropped).toEqual([])
  })
})

describe("Phase 4 fixes (decisions D-034)", () => {
  const byId = (id: string) => MODELS.find((m) => m.id === id)!

  it("frame-only endpoints refuse a prompt-only run with a clear message", () => {
    for (const id of ["kling-o1", "kling-o3", "kling-2.5", "dop"]) {
      const result = attempt(plane(byId(id), {}))
      expect(result, id).toEqual({
        error: expect.stringMatching(/^Add a start frame to use /),
      })
    }
  })

  it("LTX no longer offers a start frame it can't send", () => {
    for (const id of ["ltx-2.5-fast", "ltx-2.5-pro"])
      expect(byId(id).roles.start).toBeUndefined()
  })
})

describe("Genjutsu (S611)", () => {
  const genjutsu = MODELS.find((m) => m.id === "genjutsu")!

  it("sends the member's video and references to motion transfer", () => {
    const result = attempt(plane(genjutsu, { video: 1, reference: 2 }))
    expect(result).toEqual({
      path: "higgsfield/genjutsu/motion-transfer/v1.0",
      body: {
        video_url: "https://in.test/video0",
        image_urls: ["https://in.test/reference0", "https://in.test/reference1"],
        prompt: "a lighthouse at dusk",
        resolution: "720p",
      },
    })
  })

  it("leaves out an empty prompt (it is optional)", () => {
    const result = attempt(plane(genjutsu, { video: 1, reference: 1 }, ""))
    expect("body" in result && "prompt" in result.body).toBe(false)
  })

  it("needs both a video and at least one image, with a readable message", () => {
    expect(attempt(plane(genjutsu, { reference: 1 }))).toEqual({
      error: "Add video references to use Genjutsu.",
    })
    expect(attempt(plane(genjutsu, { video: 1 }))).toEqual({
      error: "Add image references to use Genjutsu.",
    })
  })
})
