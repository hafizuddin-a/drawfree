// Region splitting for the Open Peeps importer. The pack's black-and-white art has one white silhouette
// under the ink, so skin, hair and clothes are all the same white. This rasterises an atom, finds the
// white areas the ink encloses (flood fill), and traces the chosen ones back to polygons, grown a little
// so their edges hide under the ink. Used only by tools/import-peeps.ts.
import { Resvg } from '@resvg/resvg-js';

export type Pt = [number, number];
/** pixels per source unit when rasterising */
const R = 2;
/** source units rasterised around the canvas: some art runs past its file's edges (a leg cut off at x = 0) */
const M = 300;

export interface Region { id: number; area: number; mask: Uint8Array }
/** `pad`: pixels the ink was thickened by (see `close`), added back when tracing */
export interface Raster { w: number; h: number; regions: Region[]; label: Int32Array; pad: number }

/** Rasterises `fills` (white silhouette pieces) under `inks` and labels the enclosed white areas. `close` thickens
    the ink by that many units first, which shuts small gaps between strokes (a collar line that stops just short
    of the neck) without hand-placed cuts; `trace` grows the regions back by the same amount. */
export function segment(width: number, height: number, fills: string[], inks: string[], cuts: Pt[][] = [], close = 0): Raster {
  const w = Math.ceil((width + 2 * M) * R), h = Math.ceil((height + 2 * M) * R);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-M} ${-M} ${width + 2 * M} ${height + 2 * M}">` +
    fills.map(d => `<path d="${d}" fill="#ff0000" fill-rule="evenodd"/>`).join('') +
    inks.map(d => `<path d="${d}" fill="#000000" fill-rule="evenodd"${close ? ` stroke="#000000" stroke-width="${close}" stroke-linejoin="round"` : ''}/>`).join('') +
    cuts.map(c => `<polyline points="${c.map(p => p.join(',')).join(' ')}" fill="none" stroke="#000000" stroke-width="6" stroke-linecap="round"/>`).join('') + '</svg>';
  const px = new Resvg(svg, { shapeRendering: 0 }).render().pixels;
  const inside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inside[i] = px[i * 4 + 3] > 200 && px[i * 4] > 200 && px[i * 4 + 1] < 60 ? 1 : 0;
  const label = new Int32Array(w * h).fill(-1);
  const regions: Region[] = [];
  const queue = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!inside[s] || label[s] >= 0) continue;
    const id = regions.length, mask = new Uint8Array(w * h);
    let head = 0, tail = 0;
    queue[tail++] = s; label[s] = id;
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i - x) / w;
      mask[i] = 1;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && inside[j] && label[j] < 0) { label[j] = id; queue[tail++] = j; }
      }
    }
    regions.push({ id, area: tail / (R * R), mask });
  }
  return { w, h, regions, label, pad: Math.ceil((close / 2) * R) };
}

/** A point well inside a region (the pixel with the most of the region around it). Unlike the centroid,
    it is never outside a curved region, so it makes a safe seed point for REGIONS. */
export function innerPoint(r: Raster, g: Region): Pt {
  let best = -1, bx = 0, by = 0;
  for (let i = 0; i < g.mask.length; i += 3) {
    if (!g.mask[i]) continue;
    const x = i % r.w, y = (i - x) / r.w;
    let n = 0;
    for (let d = -12; d <= 12; d += 4) for (let e = -12; e <= 12; e += 4) {
      const xx = x + e, yy = y + d;
      if (xx >= 0 && yy >= 0 && xx < r.w && yy < r.h) n += g.mask[yy * r.w + xx];
    }
    if (n > best) { best = n; bx = x; by = y; }
  }
  return [Math.round(bx / R - M), Math.round(by / R - M)];
}

/** the region under a source-space point, or the nearest one within 6 units */
export function regionAt(r: Raster, p: Pt): Region | undefined {
  const x0 = Math.round((p[0] + M) * R), y0 = Math.round((p[1] + M) * R);
  for (let rad = 0; rad <= 6 * R; rad++) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue;
      const l = r.label[y * r.w + x];
      if (l >= 0) return r.regions[l];
    }
  }
  return undefined;
}

/** Grows a mask by `n` pixels (square), so a traced edge tucks under the neighbouring ink. */
function dilate(mask: Uint8Array, w: number, h: number, n: number): Uint8Array {
  let cur = mask;
  for (let k = 0; k < n; k++) {
    const next = cur.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (cur[y * w + x]) continue;
      if ((x > 0 && cur[y * w + x - 1]) || (x < w - 1 && cur[y * w + x + 1]) || (y > 0 && cur[(y - 1) * w + x]) || (y < h - 1 && cur[(y + 1) * w + x])) next[y * w + x] = 1;
    }
    cur = next;
  }
  return cur;
}

/** Ramer-Douglas-Peucker on a closed loop: split at the point farthest from the start, simplify both halves. */
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  const loop = [...pts, pts[0]];
  const keep = new Uint8Array(loop.length);
  keep[0] = 1; keep[far] = 1;
  const rdp = (a: number, b: number) => {
    const [ax, ay] = loop[a], [bx, by] = loop[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - loop[i][1]) - (ax - loop[i][0]) * (by - ay)) / len;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; rdp(a, bi); rdp(bi, b); }
  };
  rdp(0, far); rdp(far, loop.length - 1);
  return pts.filter((_, i) => keep[i]);
}

/** Traces every boundary loop of the union of `masks` (outer edges and holes) as source-space polygons. */
export function trace(r: Raster, masks: Uint8Array[], grow = 3, tol = 3): Pt[][] {
  const { w, h } = r;
  const m0 = new Uint8Array(w * h);
  for (const m of masks) for (let i = 0; i < m.length; i++) if (m[i]) m0[i] = 1;
  const m = dilate(m0, w, h, grow + r.pad);
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
  // directed edges on the pixel-corner lattice, clockwise around filled pixels
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (w + 1) + x;
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const k = key(x1, y1), list = next.get(k);
    if (list) list.push(key(x2, y2)); else next.set(k, [key(x2, y2)]);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    if (!at(x, y - 1)) add(x, y, x + 1, y);
    if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!at(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops: Pt[][] = [];
  for (const [start] of next) {
    while ((next.get(start)?.length ?? 0) > 0) {
      const loop: Pt[] = [];
      let k = start;
      for (;;) {
        const list = next.get(k);
        if (!list?.length) break;
        const n = list.pop() as number;
        loop.push([(k % (w + 1)) / R - M, Math.floor(k / (w + 1)) / R - M]);
        k = n;
        if (k === start) break;
      }
      if (loop.length >= 4) loops.push(simplify(loop, tol / R));
    }
  }
  return loops.filter(l => l.length >= 3);
}

/** A labelled review image: each region filled with its own tint and numbered at its centroid. */
export function reviewSVG(width: number, height: number, r: Raster, inks: string[]): string {
  const hue = (i: number) => `hsl(${(i * 67) % 360} 70% 70%)`;
  const parts = r.regions.filter(g => g.area > 4).map(g => {
    const loops = trace(r, [g.mask], 0, 1.5);
    const d = loops.map(l => 'M' + l.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z').join('');
    return `<path d="${d}" fill="${hue(g.id)}" fill-rule="evenodd"/>`;
  }).join('');
  const labels = r.regions.filter(g => g.area > (process.env.MINAREA ? +process.env.MINAREA : 30)).map(g => ({ g, p: innerPoint(r, g) })).map(({ g, p }) =>
    `<text x="${p[0]}" y="${p[1]}" font-size="${Math.max(10, width / 40)}" font-family="sans-serif" font-weight="700" fill="#0028ff" text-anchor="middle">${g.id}</text>`).join('');
  let grid = '';
  for (let x = 25; x < width; x += 25) grid += `<path d="M${x} 0V${height}" stroke="#000" stroke-opacity="${x % 100 ? 0.12 : 0.3}"/>` + (x % 100 ? '' : `<text x="${x + 2}" y="12" font-size="11" fill="#c00">${x}</text>`);
  for (let y = 25; y < height; y += 25) grid += `<path d="M0 ${y}H${width}" stroke="#000" stroke-opacity="${y % 100 ? 0.12 : 0.3}"/>` + (y % 100 ? '' : `<text x="2" y="${y - 2}" font-size="11" fill="#c00">${y}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>${parts}${inks.map(d => `<path d="${d}" fill="#000" fill-opacity=".55" fill-rule="evenodd"/>`).join('')}${grid}${labels}</svg>`;
}
