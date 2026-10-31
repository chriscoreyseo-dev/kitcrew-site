import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/** S611: the AI prompt writer asks MarketHive's OpenAI proxy for a recipe
    (photos needed, a label per photo, the prompt) from a video's frames. */

vi.mock("@/lib/db/mongo", () => ({ db: () => ({}) }))

beforeEach(() => {
  vi.stubEnv("OPENAI_PROXY_URL", "https://proxy.example.com/openai")
  vi.stubEnv("OPENAI_PROXY_TOKEN", "t".repeat(32))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const load = () => import("@/lib/ai/recipe")

function answer(content: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  typeof content === "string" ? content : JSON.stringify(content),
              },
            },
          ],
        }),
        { status }
      )
  )
}

const GOOD = {
  people: 2,
  slots: ["Man in front in the black suit", "Man behind with the boombox"],
  prompt:
    "Two men dance down a street of red-brick mills on an overcast day. The man in front has the face and look of photo 1; the man behind with the boombox has the face and look of photo 2. Keep every face true to its photo.",
}

describe("askForRecipe", () => {
  it("sends the frames to the proxy's blog key and allow-listed model, and returns the recipe", async () => {
    const { askForRecipe } = await load()
    const fetcher = answer(GOOD)
    const recipe = await askForRecipe(
      ["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"],
      fetcher as unknown as typeof fetch
    )
    expect(recipe).toEqual(GOOD)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://proxy.example.com/openai")
    const headers = init.headers as Record<string, string>
    expect(headers["X-Proxy-Auth"]).toBe("t".repeat(32))
    expect(headers["X-Proxy-Key"]).toBe("blog")
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe("gpt-5-nano")
    expect(body.response_format).toEqual({ type: "json_object" })
    const images = body.messages[1].content.filter(
      (c: { type: string }) => c.type === "image_url"
    )
    expect(images).toHaveLength(2)
  })

  it("refuses an answer whose slots don't match the people, or that isn't JSON", async () => {
    const { askForRecipe } = await load()
    await expect(
      askForRecipe(["x"], answer({ ...GOOD, people: 3 }) as unknown as typeof fetch)
    ).rejects.toThrow(/unusable/)
    await expect(
      askForRecipe(["x"], answer("not json") as unknown as typeof fetch)
    ).rejects.toThrow(/unusable/)
  })

  it("turns a proxy error into a plain message", async () => {
    const { askForRecipe } = await load()
    await expect(
      askForRecipe(["x"], answer(GOOD, 400) as unknown as typeof fetch)
    ).rejects.toThrow(/couldn't read this video/)
  })
})

describe("setup and size", () => {
  it("says plainly when the proxy isn't set up", async () => {
    vi.stubEnv("OPENAI_PROXY_URL", "")
    vi.stubEnv("OPENAI_PROXY_TOKEN", "")
    const { assertRecipesConfigured } = await load()
    expect(() => assertRecipesConfigured()).toThrow(/isn't switched on/)
  })

  it("keeps frames under the proxy's body cap, first and last kept", async () => {
    const { fitFrames } = await load()
    const frames = ["a", "b", "c", "d", "e", "f"].map((k) => k.repeat(50_000))
    const kept = fitFrames(frames, 200_000)
    expect(kept.reduce((n, f) => n + f.length, 0)).toBeLessThanOrEqual(200_000)
    expect(kept[0]).toBe(frames[0])
    expect(kept.at(-1)).toBe(frames.at(-1))
  })
})
