/** Our own illustration set (scripts/brand-art.ts), used wherever the app
    needs art before real generated media exists. */
export const BRAND_ART = [
  "/brand/art-1.svg",
  "/brand/art-2.svg",
  "/brand/art-3.svg",
  "/brand/art-4.svg",
] as const

export function brandArt(index: number): string {
  return BRAND_ART[
    ((index % BRAND_ART.length) + BRAND_ART.length) % BRAND_ART.length
  ]!
}

/** Three distinct pieces for triptych-style empty states and heroes. */
export const BRAND_TRIPTYCH = [
  BRAND_ART[0],
  BRAND_ART[2],
  BRAND_ART[3],
] as const
