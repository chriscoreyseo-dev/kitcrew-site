// End-to-end stand-ins for every external service (D-062). One process:
//   - MongoDB: an in-memory single-node replica set (transactions work)
//   - Higgsfield:  /hf/*                  submit, status, cancel, uploads, output media
//   - MarketHive:  /hive_studio_api.php   the wallet API (HMAC-checked, same rules as PHP)
//                  /launch?mid=…          what the dashboard badge does: sign a handoff
//                  /dashboard?mid=…       a page that frames the studio, like the overlay
//   - Resend:      /emails                captures magic-link emails
//   - control:     /_state, /_reset, /_emails
// Nothing here talks to the network beyond 127.0.0.1.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"

import { MongoMemoryReplSet } from "mongodb-memory-server"

export const PORT = Number(process.env.E2E_MOCK_PORT ?? 4010)
export const MONGO_PORT = Number(process.env.E2E_MONGO_PORT ?? 27117)
const SECRET =
  process.env.E2E_SHARED_SECRET ?? "e2e-shared-secret-0123456789abcdef"
const STUDIO_MH = process.env.E2E_STUDIO_MH ?? "http://localhost:3101"

const replSet = await MongoMemoryReplSet.create({
  replSet: { name: "rs0e2e", count: 1, storageEngine: "wiredTiger" },
  instanceOpts: [{ port: MONGO_PORT }],
})
await replSet.waitUntilRunning()

// ---------------------------------------------------------------- state
const fresh = () => ({
  members: new Map([
    [
      101,
      {
        balance: 1000,
        email: "admin@markethive.test",
        name: "Hive Admin",
        admin: true,
      },
    ],
    [
      102,
      {
        balance: 5000,
        email: "member@markethive.test",
        name: "Hive Member",
        admin: false,
      },
    ],
    [
      103,
      {
        balance: 20,
        email: "low@markethive.test",
        name: "Low Balance Admin",
        admin: true,
      },
    ],
  ]),
  prices: { image: "0.50", video: "2.00", audio: null },
  charges: new Map(), // ref -> { mid, amount, status }
  ledger: [], // what COINS_PAYMENT would hold
  jobs: new Map(), // request_id -> { prompt, polls, outcome }
  emails: [],
})
let state = fresh()

const cents = (dollars) => Math.round(Number(dollars) * 100)
const dollars = (c) => (c / 100).toFixed(2)

// ---------------------------------------------------------------- helpers
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
  })
}
function send(res, status, data, headers = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data)
  res.writeHead(status, {
    "content-type": typeof data === "string" ? "text/html" : "application/json",
    ...headers,
  })
  res.end(body)
}
const hmac = (data) => createHmac("sha256", SECRET).update(data).digest()

function signHandoff(mid) {
  const m = state.members.get(mid)
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      mid,
      email: m.email,
      name: m.name,
      admin: m.admin,
      iat: now,
      exp: now + 90,
      nonce: randomBytes(16).toString("hex"),
    })
  ).toString("base64url")
  return `${payload}.${hmac("hive-studio-handoff.v1." + payload).toString("base64url")}`
}

// The wallet API, mirroring includes/hive_studio_lib.php.
function wallet(body) {
  const mid = Number(body.member_id)
  const m = state.members.get(mid)
  const p = state.prices
  const prices = { image: p.image, video: p.video, audio: p.audio }
  if (body.action === "prices") return { ok: true, prices }
  if (!m)
    return { ok: false, error: "unknown_member", message: "Unknown member." }
  if (body.action === "balance")
    return { ok: true, balance: dollars(m.balance), prices }
  if (body.action === "debit") {
    const prior = state.charges.get(body.ref)
    if (prior)
      return {
        ok: true,
        charged: dollars(prior.amount),
        balance: dollars(m.balance),
      }
    const price = p[body.surface]
    if (price === null || price === undefined)
      return { ok: false, error: "unpriced", message: "Not priced yet." }
    const amount = cents(price)
    if (m.balance < amount)
      return {
        ok: false,
        error: "insufficient",
        message: "Not enough MarketHive credits.",
        balance: dollars(m.balance),
      }
    m.balance -= amount
    state.charges.set(body.ref, { mid, amount, status: "debited" })
    state.ledger.push({ mid, amount: -amount, ref: body.ref })
    return { ok: true, charged: dollars(amount), balance: dollars(m.balance) }
  }
  if (body.action === "refund") {
    const charge = state.charges.get(body.ref)
    if (!charge || charge.status !== "debited" || charge.mid !== mid)
      return { ok: true, refunded: false, balance: dollars(m.balance) }
    charge.status = "refunded"
    m.balance += charge.amount
    state.ledger.push({ mid, amount: charge.amount, ref: body.ref })
    return { ok: true, refunded: true, balance: dollars(m.balance) }
  }
  return { ok: false, error: "action", message: "Unknown action." }
}

// A tiny PNG (1x1, hive gold) served as every image output.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mM8NOv/fwAGsQLNdV1qjgAAAABJRU5ErkJggg==",
  "base64"
)

// ---------------------------------------------------------------- server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const path = url.pathname
  const raw = req.method === "POST" ? await readBody(req) : ""

  // control
  if (path === "/_reset") {
    state = fresh()
    return send(res, 200, { ok: true })
  }
  if (path === "/_state") {
    return send(res, 200, {
      members: Object.fromEntries(
        [...state.members].map(([k, v]) => [k, dollars(v.balance)])
      ),
      charges: Object.fromEntries(state.charges),
      ledger: state.ledger,
    })
  }
  if (path === "/_prices" && req.method === "POST") {
    state.prices = { ...state.prices, ...JSON.parse(raw) }
    return send(res, 200, { ok: true })
  }
  if (path === "/_emails") {
    const to = url.searchParams.get("to")
    return send(
      res,
      200,
      state.emails.filter((e) => !to || e.to.includes(to))
    )
  }
  if (path === "/_mongo") return send(res, 200, { uri: replSet.getUri() })

  // MarketHive
  if (path === "/hive_studio_api.php") {
    const ts = Number(req.headers["x-hive-studio-ts"])
    const sig = String(req.headers["x-hive-studio-sig"] ?? "")
    const expected = hmac(`hive-studio-wallet.v1\n${ts}\n${raw}`)
    const given = /^[0-9a-f]{64}$/.test(sig)
      ? Buffer.from(sig, "hex")
      : Buffer.alloc(0)
    if (
      Math.abs(Date.now() / 1000 - ts) > 300 ||
      given.length !== expected.length ||
      !timingSafeEqual(given, expected)
    )
      return send(res, 401, { ok: false, error: "bad_signature" })
    return send(res, 200, wallet(JSON.parse(raw)))
  }
  if (path === "/launch") {
    const mid = Number(url.searchParams.get("mid"))
    const target = `${STUDIO_MH}/auth/markethive?token=${encodeURIComponent(signHandoff(mid))}&next=${encodeURIComponent(url.searchParams.get("next") ?? "/image")}`
    return send(res, 302, "", { location: target })
  }
  if (path === "/dashboard") {
    const mid = Number(url.searchParams.get("mid") ?? 101)
    const src = `${STUDIO_MH}/auth/markethive?token=${encodeURIComponent(signHandoff(mid))}&next=%2Fimage`
    return send(
      res,
      200,
      `<!doctype html><title>MarketHive dashboard (mock)</title><h1>Dashboard</h1><iframe id="studio" title="Hive Studio" src="${src}" style="width:1280px;height:900px;border:0"></iframe>`
    )
  }
  if (path === "/wallet")
    return send(res, 200, "<!doctype html><h1>MarketHive wallet (mock)</h1>")

  // Resend
  if (path === "/emails" && req.method === "POST") {
    const mail = JSON.parse(raw)
    const to = Array.isArray(mail.to) ? mail.to : [mail.to]
    const link = /href="([^"]*\/api\/auth\/callback\/resend[^"]*)"/.exec(
      mail.html ?? ""
    )?.[1]
    state.emails.push({
      to,
      subject: mail.subject,
      link: link?.replaceAll("&amp;", "&"),
    })
    return send(res, 200, { id: `email_${state.emails.length}` })
  }

  // Higgsfield
  if (path.startsWith("/hf/")) {
    const sub = path.slice(3)
    if (sub.startsWith("/media/")) {
      res.writeHead(200, {
        "content-type": "image/png",
        "content-length": PNG.length,
      })
      return res.end(PNG)
    }
    const status = /^\/requests\/([^/]+)\/status$/.exec(sub)
    if (status) {
      const job = state.jobs.get(status[1])
      if (!job) return send(res, 404, { detail: "not found" })
      job.polls += 1
      if (job.polls < 2)
        return send(res, 200, { status: "in_progress", request_id: status[1] })
      if (job.outcome === "completed")
        return send(res, 200, {
          status: "completed",
          request_id: status[1],
          images: [
            { url: `http://127.0.0.1:${PORT}/hf/media/${status[1]}.png` },
          ],
        })
      return send(res, 200, { status: job.outcome, request_id: status[1] })
    }
    const cancel = /^\/requests\/([^/]+)\/cancel$/.exec(sub)
    if (cancel) {
      const job = state.jobs.get(cancel[1])
      if (job && job.polls === 0) {
        job.outcome = "canceled"
        job.polls = 5
        return send(res, 202, { status: "canceled" })
      }
      return send(res, 400, { detail: "already started" })
    }
    if (sub === "/files/generate-upload-url")
      return send(res, 200, {
        upload_url: `http://127.0.0.1:${PORT}/hf/upload`,
        public_url: `http://127.0.0.1:${PORT}/hf/media/upload.png`,
        content_type: "image/png",
        upload_headers: {},
      })
    if (req.method === "POST") {
      if (!String(req.headers.authorization ?? "").startsWith("Key "))
        return send(res, 401, { detail: "no key" })
      const body = raw ? JSON.parse(raw) : {}
      const prompt = String(body.prompt ?? "")
      const id = `req_${state.jobs.size + 1}_${randomBytes(3).toString("hex")}`
      const outcome = prompt.includes("FAILME")
        ? "failed"
        : prompt.includes("NSFWME")
          ? "nsfw"
          : "completed"
      state.jobs.set(id, { prompt, polls: 0, outcome, path: sub })
      return send(res, 200, {
        status: "queued",
        request_id: id,
        status_url: `/requests/${id}/status`,
        cancel_url: `/requests/${id}/cancel`,
      })
    }
  }
  send(res, 404, { error: "not found", path })
})

server.listen(PORT, "127.0.0.1", () =>
  console.log(`[e2e-mocks] http://127.0.0.1:${PORT}  mongo ${replSet.getUri()}`)
)

const stop = async () => {
  server.close()
  await replSet.stop()
  process.exit(0)
}
process.on("SIGTERM", stop)
process.on("SIGINT", stop)
