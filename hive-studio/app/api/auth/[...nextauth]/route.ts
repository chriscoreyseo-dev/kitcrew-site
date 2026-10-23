import type { NextRequest } from "next/server"

import { handlers } from "@/auth"
import { isMarketHive } from "@/lib/mode"

/** Auth.js serves standalone sign-in only; markethive mode signs in through
    /auth/markethive (D-056), so these endpoints don't exist there. */
const notFound = () => new Response("Not found", { status: 404 })

export function GET(request: NextRequest) {
  return isMarketHive() ? notFound() : handlers.GET(request)
}

export function POST(request: NextRequest) {
  return isMarketHive() ? notFound() : handlers.POST(request)
}
