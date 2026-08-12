// Per-category glyphs, drawn inline as SVG.
//
// Hand-built rather than pulled from an icon font: the page is self-contained
// and a strict local server means no CDN, no webfont, nothing to load. Each
// icon is a list of plain SVG elements on a 24x24 grid, stroked in
// currentColor so the category hue drives it with no extra plumbing.

const stroke = (el, attrs) => [el, attrs];

export const ICONS = {
  accounts: [
    stroke('circle', { cx: 12, cy: 8, r: 3.6 }),
    stroke('path', { d: 'M4.8 20a7.2 7.2 0 0 1 14.4 0' }),
  ],
  youtube: [
    stroke('rect', { x: 2.2, y: 5.4, width: 19.6, height: 13.2, rx: 4 }),
    stroke('path', { d: 'M10.3 9.4 15.7 12l-5.4 2.6z', fill: 'currentColor' }),
  ],
  reddit: [
    stroke('circle', { cx: 12, cy: 13.4, r: 7.2 }),
    stroke('circle', { cx: 18.6, cy: 4.6, r: 1.7 }),
    stroke('path', { d: 'M12 6.2 13.4 3l4 1.1' }),
    stroke('circle', { cx: 9.3, cy: 12.6, r: 1.05, fill: 'currentColor', stroke: 'none' }),
    stroke('circle', { cx: 14.7, cy: 12.6, r: 1.05, fill: 'currentColor', stroke: 'none' }),
    stroke('path', { d: 'M9 16.2a4.6 4.6 0 0 0 6 0' }),
  ],
  twitch: [
    stroke('path', { d: 'M4 3.2h16v10.4l-4.2 4.2h-3.4L9 21v-3.2H4z' }),
    stroke('path', { d: 'M11.2 7.4v4.4M15.6 7.4v4.4' }),
  ],
  x: [stroke('path', { d: 'M5.2 5.2 18.8 18.8M18.8 5.2 5.2 18.8' })],
  tiktok: [
    stroke('path', { d: 'M13.4 3.2v11.4a3.6 3.6 0 1 1-3.6-3.6' }),
    stroke('path', { d: 'M13.4 5.6a5.2 5.2 0 0 0 5.2 4.4' }),
  ],
  // Not a platform - the Draft check header glyph.
  draft: [
    stroke('path', { d: 'M3.4 17.6 8 11.4l3.6 3.2 4-5.4 4.6 5.6' }),
    stroke('path', { d: 'M3.4 20.6h17.2' }),
    stroke('circle', { cx: 8, cy: 11.4, r: 1.05, fill: 'currentColor', stroke: 'none' }),
    stroke('circle', { cx: 15.6, cy: 9.2, r: 1.05, fill: 'currentColor', stroke: 'none' }),
    stroke('path', { d: 'M18.2 3.2v3.4M16.5 4.9h3.4' }),
  ],
  instagram: [
    stroke('rect', { x: 3.4, y: 3.4, width: 17.2, height: 17.2, rx: 5 }),
    stroke('circle', { cx: 12, cy: 12, r: 4 }),
    stroke('circle', { cx: 17, cy: 7, r: 1.05, fill: 'currentColor', stroke: 'none' }),
  ],
};

const NS = 'http://www.w3.org/2000/svg';

/** Build an <svg> for a category id. Unknown ids get a neutral dot. */
export function icon(id) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const spec = ICONS[id] ?? [stroke('circle', { cx: 12, cy: 12, r: 5, fill: 'currentColor', stroke: 'none' })];
  for (const [tag, attrs] of spec) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    svg.append(node);
  }
  return svg;
}
