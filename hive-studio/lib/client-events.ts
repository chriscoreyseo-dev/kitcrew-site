/** Tiny cross-component signal for the credit balance (header pill ↔ studio). */
export const BALANCE_EVENT = "hive:balance"

export function announceBalance(credits: number): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<number>(BALANCE_EVENT, { detail: credits })
  )
}

/** MarketHive's LIBRARY menu asks the library view for: home | all | new |
    project:<id> (S584). */
export const LIBRARY_EVENT = "hive:library"
