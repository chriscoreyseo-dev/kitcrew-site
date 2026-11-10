/** Common throwaway-inbox domains refused at sign-in. Not exhaustive by design:
    it blocks the casual case; rate limits and per-user credits do the rest. */
const DOMAINS = new Set([
  "10minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmailo.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@").pop()?.toLowerCase() ?? ""
  return DOMAINS.has(domain)
}
