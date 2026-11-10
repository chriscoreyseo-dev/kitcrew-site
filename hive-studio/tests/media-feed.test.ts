import { ObjectId } from "mongodb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GenerationDoc } from "@/lib/generations/model"

import { fakeDb } from "./fakes/mongo"

/** D-079 (Chris, 2026-10-30): the Media Feed's News Feed action bar and
    three-dot menu - THE LIFT's feed order, the bar's MarketHive calls, and
    Watch Later / playlists. */

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  user: null as { id: string; email: string; role: "user" | "admin" } | null,
  calls: [] as { action: string; fields: Record<string, unknown> }[],
  reply: {} as Record<string, unknown>,
}))

vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))
vi.mock("@/lib/session", () => ({ currentUser: async () => h.user }))
vi.mock("@/lib/mode", () => ({
  isMarketHive: () => true,
  studioMode: () => "markethive",
}))
vi.mock("@/lib/higgsfield", () => ({ platform: () => ({}) }))
vi.mock("@/lib/storage/r2", () => ({
  isR2Configured: () => false,
  copyToR2: async () => null,
  deleteFromR2: async () => undefined,
}))
vi.mock("@/lib/markethive/wallet", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/markethive/wallet")>()
  return {
    ...real,
    call: async (action: string, fields: Record<string, unknown>) => {
      h.calls.push({ action, fields })
      return { ok: true, ...h.reply }
    },
  }
})

const community = await import("@/lib/community")
const feed = await import("@/lib/community-feed")
const actions = await import("@/generation/media-actions")
const saved = await import("@/lib/saved-lists")

const VIEWER = new ObjectId()
const AUTHOR = new ObjectId()

async function seedUser(id: ObjectId, memberId: number, name: string) {
  await h.db.collection("users").insertOne({
    _id: id,
    email: `${name}@example.com`,
    markethive: { memberId, name },
  })
}

async function seedPost(
  at: Date,
  extra: Partial<GenerationDoc> = {}
): Promise<GenerationDoc> {
  const doc: GenerationDoc = {
    _id: new ObjectId(),
    userId: AUTHOR,
    clientRequestId: crypto.randomUUID(),
    surface: "image",
    modelId: "z-image-turbo",
    modelLabel: "Z-Image Turbo",
    modelPath: "m",
    prompt: "a lighthouse",
    settings: {},
    media: [],
    status: "completed",
    hfRequestId: "hf",
    cost: 1,
    outputs: [{ kind: "image", url: "https://media.test/0.png", r2Key: "k" }],
    aspect: 1,
    isPublic: true,
    publishedAt: at,
    createdAt: at,
    updatedAt: at,
    ...extra,
  }
  await h.db.collection("generations").insertOne(doc)
  return doc
}

const BAR_REPLY = {
  ready: true,
  assets: {
    like: "https://mh.test/like.png",
    dislike: "https://mh.test/dislike.png",
    star: "https://mh.test/star.png",
    exclude: "https://mh.test/exclude.png",
    lift: "https://mh.test/lift.png",
    lift_tip: "https://mh.test/tip.png",
  },
  badges: {
    "77": [
      {
        src: "https://mh.test/key.png",
        title: "Key",
        status: "Soon",
        body: "b",
      },
      { src: "javascript:alert(1)", title: "bad", status: "", body: "" },
    ],
  },
  signals: {},
  lifted: [],
  excluded: [],
  lifts: 2,
  price: "50.00",
  balance: "120.00",
}

beforeEach(async () => {
  h.db = fakeDb({ rate_limits: [["key"]] })
  h.user = { id: VIEWER.toHexString(), email: "v@example.com", role: "user" }
  h.calls = []
  h.reply = {}
  await seedUser(VIEWER, 11, "viewer")
  await seedUser(AUTHOR, 77, "author")
})

describe("THE LIFT's feed order", () => {
  it("puts a lifted post first, and pages through both streams without skipping", async () => {
    const t = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m))
    const old = await seedPost(t(1))
    const posts = [old]
    for (let m = 2; m <= 6; m++) posts.push(await seedPost(t(m)))
    await h.db
      .collection("generations")
      .updateOne({ _id: old._id }, { $set: { liftedAt: t(30) } })

    const first = await community.listPublicGenerations(null, 3)
    expect(first.items.map((i) => i.id)).toEqual([
      old._id.toHexString(),
      posts[5]._id.toHexString(),
      posts[4]._id.toHexString(),
    ])
    const second = await community.listPublicGenerations(first.nextCursor, 3)
    expect(second.items.map((i) => i.id)).toEqual([
      posts[3]._id.toHexString(),
      posts[2]._id.toHexString(),
      posts[1]._id.toHexString(),
    ])
    expect(second.nextCursor).toBeNull()
  })
})

describe("the action bar", () => {
  it("asks MarketHive about the page's authors and hides excluded members", async () => {
    const kept = await seedPost(new Date(2026, 9, 2))
    const otherAuthor = new ObjectId()
    await seedUser(otherAuthor, 88, "other")
    const gone = await seedPost(new Date(2026, 9, 3), { userId: otherAuthor })
    h.reply = { ...BAR_REPLY, excluded: [88] }

    const view = await feed.loadCommunityFeed(null, {
      id: VIEWER.toHexString(),
    })
    expect(h.calls[0].action).toBe("media_bar")
    expect(h.calls[0].fields.member_id).toBe(11)
    expect(view.items.map((i) => i.id)).toEqual([kept._id.toHexString()])
    expect(view.items.map((i) => i.id)).not.toContain(gone._id.toHexString())
    const post = view.bar!.posts[kept._id.toHexString()]
    // Only MarketHive's http(s) art is ever drawn.
    expect(post.badges.map((b) => b.title)).toEqual(["Key"])
    expect(view.bar!.lifts).toBe(2)
    // Member ids never reach the page.
    expect(JSON.stringify(view)).not.toContain('"77"')
  })

  it("carries everyone's Like / Dislike totals only when MarketHive sends them (S624)", async () => {
    const counted = await seedPost(new Date(2026, 9, 2))
    const silent = await seedPost(new Date(2026, 9, 3))
    h.reply = {
      ...BAR_REPLY,
      counts: {
        [counted._id.toHexString()]: { like: 4, dislike: 1 },
        "not-an-id": { like: 9, dislike: 9 },
      },
    }
    const view = await feed.loadCommunityFeed(null, {
      id: VIEWER.toHexString(),
    })
    const shown = view.bar!.posts[counted._id.toHexString()]
    expect([shown.likes, shown.dislikes]).toEqual([4, 1])
    // No number from MarketHive: none is made up.
    const quiet = view.bar!.posts[silent._id.toHexString()]
    expect(quiet.likes).toBeUndefined()
    expect(quiet.dislikes).toBeUndefined()
  })

  it("carries tip totals and what the viewer may tip with, only when MarketHive reports tips (S627)", async () => {
    const tipped = await seedPost(new Date(2026, 9, 2))
    const untipped = await seedPost(new Date(2026, 9, 3))
    // An older MarketHive says nothing about tips: the row shows no Tip.
    h.reply = { ...BAR_REPLY }
    let view = await feed.loadCommunityFeed(null, { id: VIEWER.toHexString() })
    expect(view.bar!.tip).toBeNull()
    expect(view.bar!.posts[tipped._id.toHexString()].tips).toBeUndefined()

    h.reply = {
      ...BAR_REPLY,
      tips: {
        [tipped._id.toHexString()]: "1.25",
        "not-an-id": "9",
        [untipped._id.toHexString()]: "<b>9</b>",
      },
      tip: { balance: "100", max: "50" },
    }
    view = await feed.loadCommunityFeed(null, { id: VIEWER.toHexString() })
    expect(view.bar!.tip).toEqual({ balance: "100", max: "50" })
    expect(view.bar!.posts[tipped._id.toHexString()].tips).toBe("1.25")
    // Nothing tipped, or not a number: 0, never the raw text.
    expect(view.bar!.posts[untipped._id.toHexString()].tips).toBe("0")
  })

  it("sends a tip as the viewer to the post's author, never on their own post or for a bad amount (S627)", async () => {
    const post = await seedPost(new Date(2026, 9, 2))
    h.reply = {
      status: "tipped",
      message: "Tip sent.",
      total: "2.5",
      balance: "97.5",
    }
    const result = await actions.mediaTipAction(post._id.toHexString(), " 2.5 ")
    expect(result).toEqual({
      ok: true,
      data: {
        status: "tipped",
        message: "Tip sent.",
        total: "2.5",
        balance: "97.5",
      },
    })
    expect(h.calls.at(-1)).toEqual({
      action: "media_tip",
      fields: {
        member_id: 11,
        author_id: 77,
        media_id: post._id.toHexString(),
        amount: "2.5",
      },
    })

    // A refusal from MarketHive is an outcome to show, not an error.
    h.reply = {
      status: "insufficient",
      message: "Cannot tip more than your Coin Clip balance.",
      balance: "1",
    }
    const refused = await actions.mediaTipAction(post._id.toHexString(), "900")
    expect(refused.ok && refused.data.status).toBe("insufficient")

    const sent = h.calls.length
    for (const bad of ["0", "-1", "1.2345", "abc", "1e3", "", 5, null]) {
      const r = await actions.mediaTipAction(post._id.toHexString(), bad)
      expect(r.ok).toBe(false)
    }
    const mine = await seedPost(new Date(2026, 9, 3), { userId: VIEWER })
    const own = await actions.mediaTipAction(mine._id.toHexString(), "1")
    expect(own.ok).toBe(false)
    // None of those reached MarketHive.
    expect(h.calls.length).toBe(sent)

    h.user = null
    const anon = await actions.mediaTipAction(post._id.toHexString(), "1")
    expect(anon.ok).toBe(false)
    expect(h.calls.length).toBe(sent)
  })

  it("still shows the feed when MarketHive does not answer", async () => {
    await seedPost(new Date(2026, 9, 2))
    h.reply = { price: "nope" }
    const view = await feed.loadCommunityFeed(null, {
      id: VIEWER.toHexString(),
    })
    expect(view.items).toHaveLength(1)
    expect(view.bar).toBeNull()
  })

  it("sends a signal as the viewer about the post's author, never on their own post", async () => {
    const post = await seedPost(new Date(2026, 9, 2))
    const result = await actions.mediaFeedbackAction(
      post._id.toHexString(),
      "star"
    )
    expect(result.ok).toBe(true)
    expect(h.calls.at(-1)).toEqual({
      action: "media_feedback",
      fields: {
        member_id: 11,
        author_id: 77,
        media_id: post._id.toHexString(),
        signal: "star",
      },
    })

    const mine = await seedPost(new Date(2026, 9, 3), { userId: VIEWER })
    const own = await actions.mediaFeedbackAction(
      mine._id.toHexString(),
      "like"
    )
    expect(own.ok).toBe(false)
  })

  it("orders a lifted post to the top only when MarketHive spent the Lift", async () => {
    const post = await seedPost(new Date(2026, 9, 2))
    h.reply = { status: "need_purchase", message: "", price: "50.00", lifts: 0 }
    const asked = await actions.mediaLiftAction(post._id.toHexString(), {
      buy: false,
      expectedPrice: null,
    })
    expect(asked.ok && asked.data.status).toBe("need_purchase")
    let doc = await h.db.collection("generations").findOne({ _id: post._id })
    expect((doc as unknown as GenerationDoc).liftedAt).toBeUndefined()

    h.reply = {
      status: "lifted",
      message: "ok",
      price: "50.00",
      lifts: 0,
      balance: "70.00",
    }
    const done = await actions.mediaLiftAction(post._id.toHexString(), {
      buy: true,
      expectedPrice: "50.00",
    })
    expect(done.ok && done.data.status).toBe("lifted")
    expect(h.calls.at(-1)?.fields).toMatchObject({
      buy: true,
      expected_price: "50.00",
    })
    doc = await h.db.collection("generations").findOne({ _id: post._id })
    expect((doc as unknown as GenerationDoc).liftedAt).toBeInstanceOf(Date)
  })
})

const VIDEO = {
  surface: "video",
  outputs: [{ kind: "video", url: "https://media.test/0.mp4", r2Key: "v" }],
} as Partial<GenerationDoc>

describe("Watch Later and playlists", () => {
  it("keeps pictures out: their menu is Share only", async () => {
    const picture = await seedPost(new Date(2026, 9, 2))
    const result = await actions.watchLaterAction(
      picture._id.toHexString(),
      true
    )
    expect(result.ok).toBe(false)
    const made = await actions.createPlaylistAction(
      "Mine",
      picture._id.toHexString()
    )
    expect(made.ok).toBe(false)
  })

  it("saves and removes a published post, and refuses an unpublished one", async () => {
    const post = await seedPost(new Date(2026, 9, 2), VIDEO)
    const hidden = await seedPost(new Date(2026, 9, 3), {
      ...VIDEO,
      isPublic: false,
    })
    const id = post._id.toHexString()

    expect((await actions.watchLaterAction(id, true)).ok).toBe(true)
    expect((await actions.watchLaterAction(id, true)).ok).toBe(true)
    expect(await saved.watchLaterIds(VIEWER.toHexString(), [id])).toEqual([id])
    const list = await saved.listItemIds(VIEWER.toHexString(), {
      kind: "watch_later",
    })
    expect(list?.ids.map((i) => i.toHexString())).toEqual([id])

    expect(
      (await actions.watchLaterAction(hidden._id.toHexString(), true)).ok
    ).toBe(false)
    expect((await actions.watchLaterAction(id, false)).ok).toBe(true)
    expect(await saved.watchLaterIds(VIEWER.toHexString(), [id])).toEqual([])
  })

  it("makes a playlist with the post in it and ticks posts in and out", async () => {
    const a = await seedPost(new Date(2026, 9, 2), VIDEO)
    const b = await seedPost(new Date(2026, 9, 3), VIDEO)
    const made = await actions.createPlaylistAction(
      "  Road   trips ",
      a._id.toHexString()
    )
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.data.name).toBe("Road trips")

    await actions.playlistItemAction(made.data.id, b._id.toHexString(), true)
    const forB = await actions.playlistsForAction(b._id.toHexString())
    expect(forB.ok && forB.data[0]).toMatchObject({ has: true, count: 2 })

    await actions.playlistItemAction(made.data.id, a._id.toHexString(), false)
    const list = await saved.listItemIds(VIEWER.toHexString(), {
      kind: "playlist",
      id: made.data.id,
    })
    expect(list?.ids.map((i) => i.toHexString())).toEqual([b._id.toHexString()])

    // Someone else's playlist looks like a missing one.
    h.user = {
      id: new ObjectId().toHexString(),
      email: "x@example.com",
      role: "user",
    }
    const theirs = await actions.playlistItemAction(
      made.data.id,
      a._id.toHexString(),
      true
    )
    expect(theirs.ok).toBe(false)
  })
})

describe("comments", () => {
  it("posts a comment as the viewer's MarketHive name and shows it under the post", async () => {
    const post = await seedPost(new Date(2026, 9, 2))
    h.reply = {
      person: {
        name: "Viewer Name",
        pic: "https://mh.test/v.png",
        url: "https://mh.test/viewer",
      },
    }
    const added = await actions.addCommentAction(
      post._id.toHexString(),
      "  Great   shot!\n\n\n\nLove it  "
    )
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.data).toMatchObject({
      name: "Viewer Name",
      text: "Great   shot!\n\nLove it",
      canDelete: true,
    })
    expect(h.calls.at(-1)).toEqual({
      action: "media_comment",
      fields: {
        member_id: 11,
        author_id: 77,
        media_id: post._id.toHexString(),
      },
    })

    h.reply = { ...BAR_REPLY, people: { "11": h.reply.person } }
    const view = await feed.loadCommunityFeed(null, {
      id: VIEWER.toHexString(),
    })
    const c = view.comments[post._id.toHexString()]
    expect(c.count).toBe(1)
    expect(c.latest[0]).toMatchObject({ name: "Viewer Name", mine: true })
  })

  it("refuses an empty comment", async () => {
    const post = await seedPost(new Date(2026, 9, 2))
    const empty = await actions.addCommentAction(post._id.toHexString(), "   ")
    expect(empty.ok).toBe(false)
  })

  it("lets the writer or the post's owner delete a comment, nobody else", async () => {
    const post = await seedPost(new Date(2026, 9, 2))
    h.reply = { person: { name: "V", pic: "", url: "" } }
    const added = await actions.addCommentAction(post._id.toHexString(), "hi")
    if (!added.ok) throw new Error(added.message)

    h.user = {
      id: new ObjectId().toHexString(),
      email: "x@example.com",
      role: "user",
    }
    expect((await actions.deleteCommentAction(added.data.id)).ok).toBe(false)

    h.user = { id: AUTHOR.toHexString(), email: "a@example.com", role: "user" }
    expect((await actions.deleteCommentAction(added.data.id)).ok).toBe(true)
  })
})
