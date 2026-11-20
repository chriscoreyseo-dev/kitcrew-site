import "server-only"

/** The platform key is one server-side value, `HF_CREDENTIALS=key_id:key_secret`
    (console.higgsfield.ai). It never reaches the browser. */
export function toAuthorizationHeader(credentials: string): string {
  const key = credentials.trim()
  if (!/^[^\s:]+:[^\s:]+$/.test(key))
    throw new Error("HF_CREDENTIALS must be key_id:key_secret")
  return `Key ${key}`
}
