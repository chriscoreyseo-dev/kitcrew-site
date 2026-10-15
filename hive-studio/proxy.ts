import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** Redirect-only convenience. Signed-out visitors to private areas go to
    /login. This checks that a session cookie exists, nothing more; every page
    and handler still calls auth() and checks ownership itself. */

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
]

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
  if (hasSession) return NextResponse.next()
  const login = new URL("/login", request.url)
  login.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search
  )
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/assets/:path*", "/account/:path*", "/admin/:path*"],
}
