import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { ObjectId } from "mongodb"

import { db } from "@/lib/db/mongo"
import { env, EnvError } from "@/lib/env"

import { LOCAL_KEY, localPublicUrl } from "./local"

/** Who may read a file under /media (D-063). Keys are two ObjectIds deep, and
    ObjectIds are a timestamp plus a counter, so a key is guessable: the path
    is not a secret and never grants access by itself. A file is served when:
    - the viewer is signed in and owns it, or is an admin;
    - its generation is published to Community (completed + isPublic);
    - it is an effect's cover image;
    - the URL carries a valid expiring signature. Only the server signs, and
      only when it hands the member's own media to the platform as an input
      (Higgsfield fetches it with no cookie). */

export const MEDIA_LINK_TTL_SECONDS = 24 * 60 * 60

export type MediaViewer = { id: string; role?: string } | null

/** "private" may only be cached by the viewer's browser; "public" by anyone. */
export type MediaAccess = "private" | "public" | null

function signingKey(): Buffer {
  const e = env()
  // Studio-side secrets only; no new variable to set. Derived under its own
  // label so a media link can never double as a webhook or session token.
  const base = e.AUTH_SECRET ?? e.HF_WEBHOOK_SECRET
  if (!base)
    throw new EnvError(
      "Missing AUTH_SECRET or HF_WEBHOOK_SECRET (needed to sign media links for the platform). See .env.example."
    )
  return createHmac("sha256", base).update("hive-studio-media-link.v1").digest()
}

function mac(key: string, exp: number): string {
  return createHmac("sha256", signingKey())
    .update(`${key}\n${exp}`)
    .digest("base64url")
}

export function signMediaKey(
  key: string,
  now = Date.now(),
  ttlSeconds = MEDIA_LINK_TTL_SECONDS
): { exp: number; sig: string } {
  if (!LOCAL_KEY.test(key)) throw new Error("Invalid media key")
  const exp = Math.floor(now / 1000) + ttlSeconds
  return { exp, sig: mac(key, exp) }
}

export function verifyMediaSignature(
  key: string,
  exp: string | null,
  sig: string | null,
  now = Date.now()
): boolean {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp)) return false
  const expires = Number(exp)
  if (expires * 1000 < now) return false
  // A link can't be minted for longer than the TTL, so a far-future exp is forged.
  if (expires * 1000 > now + (MEDIA_LINK_TTL_SECONDS + 60) * 1000) return false
  let expected: Buffer
  try {
    expected = Buffer.from(mac(key, expires))
  } catch (error) {
    if (error instanceof EnvError) return false
    throw error
  }
  const given = Buffer.from(sig)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** The /media key of one of our own local-storage URLs, else null. */
export function localKeyFromUrl(url: string): string | null {
  const prefix = `${env().APP_URL.replace(/\/$/, "")}/media/`
  if (!url.startsWith(prefix)) return null
  const key = url.slice(prefix.length)
  return LOCAL_KEY.test(key) ? key : null
}

/** Our own /media URL with an expiring signature; any other URL unchanged. */
export function signedMediaUrl(url: string, now = Date.now()): string {
  const key = localKeyFromUrl(url)
  if (!key) return url
  const { exp, sig } = signMediaKey(key, now)
  return `${localPublicUrl(key)}?exp=${exp}&sig=${sig}`
}

/** Signs every /media URL inside a platform request body, at any depth. */
export function signLocalMediaUrls<T>(value: T, now = Date.now()): T {
  if (typeof value === "string") return signedMediaUrl(value, now) as T
  if (Array.isArray(value))
    return value.map((item) => signLocalMediaUrls(item, now)) as T
  if (value && typeof value === "object" && value.constructor === Object)
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, signLocalMediaUrls(v, now)])
    ) as T
  return value
}

/** Whether `viewer` may read `key`, and how the response may be cached. */
export async function mediaAccess(
  key: string,
  viewer: MediaViewer
): Promise<MediaAccess> {
  const match = /^u\/([a-f0-9]{24})\/([a-f0-9]{24})\//.exec(key)
  if (!match || !LOCAL_KEY.test(key)) return null
  const [, ownerId, generationId] = match
  if (viewer && (viewer.id === ownerId || viewer.role === "admin"))
    return "private"

  const published = await db()
    .collection<{ _id: ObjectId; userId: ObjectId }>("generations")
    .findOne(
      {
        _id: new ObjectId(generationId),
        userId: new ObjectId(ownerId),
        isPublic: true,
        status: "completed",
      },
      { projection: { _id: 1 } }
    )
  if (published) return "public"

  const cover = await db()
    .collection<{ coverUrl?: string }>("presets")
    .findOne({ coverUrl: localPublicUrl(key) }, { projection: { _id: 1 } })
  return cover ? "public" : null
}
