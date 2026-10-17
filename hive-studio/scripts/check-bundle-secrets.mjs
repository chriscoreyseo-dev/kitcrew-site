// Fails the build if a server secret appears in client-shipped assets
// (.next/static). Checks the literal values of secret env vars present at build
// time plus well-known key prefixes. Runs as `postbuild`.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = ".next/static"
const SECRET_VARS = [
  "AUTH_SECRET",
  "AUTH_RESEND_KEY",
  "MONGODB_URI",
  "HF_CREDENTIALS",
  "HF_WEBHOOK_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "CRON_SECRET",
  "MARKETHIVE_SHARED_SECRET",
]
const PREFIXES = [
  /sk_(live|test)_[A-Za-z0-9]{10,}/,
  /rk_(live|test)_[A-Za-z0-9]{10,}/,
  /whsec_[A-Za-z0-9]{10,}/,
  /mongodb(\+srv)?:\/\/[^"'\s]*:[^"'\s]*@/,
]

const needles = SECRET_VARS.flatMap((name) => {
  const value = process.env[name]?.trim()
  return value && value.length >= 8 ? [{ name, value }] : []
})

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(js|css|map|json|html|txt)$/.test(entry)) yield path
  }
}

const hits = []
let scanned = 0
for (const path of files(ROOT)) {
  scanned += 1
  const text = readFileSync(path, "utf8")
  for (const { name, value } of needles)
    if (text.includes(value)) hits.push(`${path}: value of ${name}`)
  for (const pattern of PREFIXES)
    if (pattern.test(text)) hits.push(`${path}: matches ${pattern}`)
}

if (hits.length) {
  console.error(
    `[secrets] server secrets found in client assets:\n  ${hits.join("\n  ")}`
  )
  process.exit(1)
}
console.log(
  `[secrets] ${scanned} client files clean (${needles.length} env values checked)`
)
