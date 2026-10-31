/** Generates Hive Studio's own illustration set and mark from lib/brand.ts.
    Re-run after a palette change (e.g. the Markethive colours, D-002):
      pnpm brand:art
    Outputs: public/brand/art-{1..4}.svg (600×800), public/brand/mark.svg,
    app/icon.svg. Pure SVG: no third-party or generated-model media. */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { BRAND } from "../lib/brand"

const W = 600
const H = 800
const P = BRAND.primary
const BG = BRAND.background

/** Flat-top hexagon path centred at (cx, cy) with radius r. */
function hex(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  })
  return `M${pts.join("L")}Z`
}

/** Deterministic pseudo-random so the art is stable across runs. */
function rng(seed: number) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
}

function honeycomb(
  seed: number,
  r: number,
  focus: [number, number],
  density: number
): string {
  const rand = rng(seed)
  const cells: string[] = []
  const dx = r * 1.5
  const dy = r * Math.sqrt(3)
  for (let col = -1; col * dx < W + r; col += 1)
    for (let row = -1; row * dy < H + r; row += 1) {
      const cx = col * dx
      const cy = row * dy + (col % 2 ? dy / 2 : 0)
      const dist = Math.hypot(cx - focus[0], cy - focus[1]) / Math.hypot(W, H)
      const lit = rand() < density * (1 - dist * 1.6)
      const opacity = Math.max(0.04, 0.5 - dist)
      cells.push(
        lit
          ? `<path d="${hex(cx, cy, r * 0.9)}" fill="${P}" fill-opacity="${(opacity * 0.9).toFixed(2)}"/>`
          : `<path d="${hex(cx, cy, r * 0.9)}" fill="none" stroke="#ffffff" stroke-opacity="${(opacity * 0.35).toFixed(2)}" stroke-width="1.2"/>`
      )
    }
  return cells.join("")
}

function frame(body: string, glow: [number, number], id: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<radialGradient id="glow${id}" cx="${glow[0] / W}" cy="${glow[1] / H}" r="0.75">
<stop offset="0" stop-color="${P}" stop-opacity="0.38"/><stop offset="0.45" stop-color="${P}" stop-opacity="0.08"/><stop offset="1" stop-color="${P}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="fade${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity="0.85"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="${BG}"/>
<rect width="${W}" height="${H}" fill="url(#glow${id})"/>
${body}
<rect width="${W}" height="${H}" fill="url(#fade${id})"/>
</svg>
`
}

const ART: Array<{ body: string; glow: [number, number] }> = [
  { body: honeycomb(1, 46, [300, 260], 0.55), glow: [300, 260] },
  { body: honeycomb(2, 30, [120, 640], 0.7), glow: [120, 640] },
  {
    body:
      honeycomb(3, 62, [480, 180], 0.4) +
      `<circle cx="300" cy="420" r="150" fill="none" stroke="${P}" stroke-opacity="0.55" stroke-width="2"/>` +
      `<circle cx="300" cy="420" r="96" fill="${P}" fill-opacity="0.12"/>`,
    glow: [300, 420],
  },
  {
    body:
      honeycomb(4, 38, [300, 760], 0.6) +
      Array.from(
        { length: 6 },
        (_, i) =>
          `<path d="M0 ${300 + i * 34} C 180 ${240 + i * 30}, 420 ${380 + i * 22}, 600 ${300 + i * 34}" fill="none" stroke="${P}" stroke-opacity="${(0.5 - i * 0.07).toFixed(2)}" stroke-width="2"/>`
      ).join(""),
    glow: [300, 320],
  },
]

/** The mark: a hexagon with a three-cell "hive" inside. */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<path d="${hex(32, 32, 30)}" fill="${P}"/>
<path d="${hex(23, 26.8, 7.4)}" fill="${BRAND.primaryText}"/>
<path d="${hex(41, 26.8, 7.4)}" fill="${BRAND.primaryText}"/>
<path d="${hex(32, 42.2, 7.4)}" fill="${BRAND.primaryText}"/>
</svg>
`

const root = join(import.meta.dirname, "..")
mkdirSync(join(root, "public/brand"), { recursive: true })
ART.forEach((art, i) =>
  writeFileSync(
    join(root, `public/brand/art-${i + 1}.svg`),
    frame(art.body, art.glow, i + 1)
  )
)
writeFileSync(join(root, "public/brand/mark.svg"), MARK)
writeFileSync(join(root, "app/icon.svg"), MARK)
console.log(
  "[brand] wrote public/brand/art-1..4.svg, public/brand/mark.svg, app/icon.svg"
)
