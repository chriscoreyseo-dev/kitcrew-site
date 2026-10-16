import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** Two jobs, neither of them the security boundary for data:
    1. Security headers on every response, chosen at runtime by STUDIO_MODE
       (D-058): standalone can't be framed at all; markethive mode can be
       framed only by MarketHive's own origins (the dashboard overlay).
    2. Redirect-only convenience: signed-out visitors to private areas go to
       /login. This checks that a session cookie exists, nothing more; every
       page and handler still calls currentUser() and checks ownership itself. */

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "hive_mh_session",
]

const PRIVATE = ["/assets", "/projects", "/account", "/admin"]

function frameAncestors(): string {
  if (process.env.STUDIO_MODE !== "markethive") return "'none'"
  const list = (
    process.env.MARKETHIVE_FRAME_ANCESTORS ||
    "https://markethive.com https://www.markethive.com https://dev3.markethive.com"
  )
    .split(/\s+/)
    // Only plain origins reach the header; anything else is dropped.
    .filter((origin) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin))
  return list.length ? list.join(" ") : "'none'"
}

export function securityHeaders(): Record<string, string> {
  const ancestors = frameAncestors()
  const headers: Record<string, string> = {
    "Content-Security-Policy": `frame-ancestors ${ancestors}; base-uri 'self'; object-src 'none'; form-action 'self'`,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  }
  if (ancestors === "'none'") headers["X-Frame-Options"] = "DENY"
  if ((process.env.APP_URL ?? "").startsWith("https://"))
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
  return headers
}

function withHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(securityHeaders()))
    response.headers.set(name, value)
  return response
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isPrivate = PRIVATE.some((p) => path === p || path.startsWith(`${p}/`))
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
  if (!isPrivate || hasSession) return withHeaders(NextResponse.next())
  const login = new URL("/login", request.url)
  login.searchParams.set("next", path + request.nextUrl.search)
  return withHeaders(NextResponse.redirect(login))
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
