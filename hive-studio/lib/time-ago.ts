/** "6 years ago", "3 hours ago", "just now" - YouTube's post time (D-079). */
export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  const steps: [number, string][] = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24 * 7, "week"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ]
  for (const [size, unit] of steps) {
    const n = Math.floor(s / size)
    if (n >= 1) return `${n} ${unit}${n === 1 ? "" : "s"} ago`
  }
  return "just now"
}

/** "1 view", "12K views", "1.2M views". */
export function viewCount(n: number): string {
  const f = (v: number) => (v >= 10 ? Math.floor(v) : Math.floor(v * 10) / 10)
  const text =
    n >= 1_000_000
      ? `${f(n / 1_000_000)}M`
      : n >= 1_000
        ? `${f(n / 1_000)}K`
        : String(n)
  return `${text} ${n === 1 ? "view" : "views"}`
}
