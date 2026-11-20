/** True when a browser request's Origin header is this studio itself.
    Behind a proxy (Coolify/Traefik) `request.url` carries the container's
    internal address, never the public one, so the configured APP_URL is the
    origin members actually use; the request's own origin still counts for
    local development. A missing Origin (same-origin GETs, server calls) passes. */
export function isSameOrigin(
  origin: string | null,
  requestUrl: string,
  appUrl: string
): boolean {
  if (!origin) return true
  const allowed = new Set([new URL(requestUrl).origin])
  try {
    allowed.add(new URL(appUrl).origin)
  } catch {
    // An unparseable APP_URL adds nothing; the request origin still applies.
  }
  return allowed.has(origin)
}
