/** Brand constants shared by UI and emails. MarketHive palette (S566-DRL-01,
    D-002 resolved by D-060): hive gold for the CTA and active states, white
    as the secondary. The same gold lives in styles/quanta (--hf-color-hive-*);
    change both together, then run `pnpm brand:art`. Dark text on gold reads
    7.2:1; white on gold would fail AA. */
export const BRAND = {
  name: "Hive Studio",
  supportEmail: "support@kitcrew.ai",
  primary: "#d39725",
  secondary: "#ffffff",
  primaryText: "#141414",
  background: "#0b0b0c",
} as const
