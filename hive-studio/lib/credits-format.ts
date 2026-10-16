/** Credit amounts as people read them. Standalone credits are whole numbers;
    Hive credits (markethive mode) are dollars held as integer cents (D-057). */
export type CreditUnit = "credits" | "hive"

export function formatCredits(amount: number, unit: CreditUnit): string {
  if (unit === "hive")
    return (amount / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  return amount.toLocaleString("en-US")
}

export function creditNoun(unit: CreditUnit): string {
  return unit === "hive" ? "Hive credits" : "credits"
}
