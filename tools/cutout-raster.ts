// Raster helpers for tools/cutout.ts: segment an Open Peeps body (already in rig space) into puppet pieces and trace
// each piece back to a clip polygon. Rig space is rasterised at R pixels per unit, with the art drawn crisp (no
// anti-aliasing) in layer order, so every pixel knows its top layer: ink, a fill kind (skin, top, ...) or nothing.
import { Resvg } from '@resvg/resvg-js';

export type Pt = [number, number];
export const R = 8;

export interface Grid {
  w: number; h: number; x0: number; y0: number;
  /** top layer per pixel: -1 nothing, 0 ink, 1 + index into `kinds` for a fill */
  top: Int8Array;
  kinds: string[];
  /** cut lines: pixels nothing may cross */
  cut: Uint8Array;
}

const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Rasterises the layers [kind, d] in order, plus the cut polylines, over the box [x0, y0, x1, y1]. */
export function rasterise(layers: ReadonlyArray<readonly [string, string]>, box: readonly number[], cuts: Pt[][]): Grid {
  const x0 = Math.floor(box[0]) - 6, y0 = Math.floor(box[1]) - 6, x1 = Math.ceil(box[2]) + 6, y1 = Math.ceil(box[3]) + 6;
  const w = (x1 - x0) * R, h = (y1 - y0) * R;
  const kinds = [...new Set(layers.map(l => l[0]).filter(k => k !== 'i'))];
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" shape-rendering="crispEdges">`;
  // the fill kind is coded in the red channel (1 + index, times 10), ink is pure blue
  const art = layers.map(([k, d]) => `<path d="${ESC(d)}" fill-rule="evenodd" fill="${k === 'i' ? 'rgb(0,0,255)' : `rgb(${(1 + kinds.indexOf(k)) * 10},0,0)`}"/>`).join('');
  const px = new Resvg(head + art + '</svg>', { shapeRendering: 0 }).render().pixels;
  const top = new Int8Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4 + 3] < 128) continue;
    top[i] = px[i * 4 + 2] > 128 ? 0 : Math.round(px[i * 4] / 10);
  }
  const cs = cuts.map(c => `<polyline points="${c.map(p => p.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="${2.2 / R}"/>`).join('');
  const cpx = new Resvg(head + cs + '</svg>', { shapeRendering: 0 }).render().pixels;
  const cut = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cut[i] = cpx[i * 4 + 3] > 0 ? 1 : 0;
  return { w, h, x0, y0, top, kinds, cut };
}

export const toPx = (g: Grid, p: Pt): number => Math.round((p[1] - g.y0) * R) * g.w + Math.round((p[0] - g.x0) * R);
export const toPt = (g: Grid, i: number): Pt => [(i % g.w) / R + g.x0, Math.floor(i / g.w) / R + g.y0];

export interface Fill { id: number; kind: string; px: number[] }

/** Connected areas of one fill kind, split by ink and cut lines (4-connected). */
export function fills(g: Grid): Fill[] {
  const { w, h, top, cut } = g;
  const seen = new Int32Array(w * h).fill(-1);
  const out: Fill[] = [];
  for (let s = 0; s < w * h; s++) {
    if (top[s] <= 0 || cut[s] || seen[s] >= 0) continue;
    const id = out.length, k = top[s], px: number[] = [s];
    seen[s] = id;
    for (let q = 0; q < px.length; q++) {
      const i = px[q], x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] >= 0 || cut[j] || top[j] !== k) continue;
        seen[j] = id; px.push(j);
      }
    }
    out.push({ id, kind: g.kinds[k - 1], px });
  }
  return out;
}

/** Distance in units from `src` pixels through ink only (8-connected, chamfer), never crossing a cut. Infinity where unreachable. */
export function inkDistance(g: Grid, src: Uint8Array): Float32Array {
  const { w, h, top, cut } = g;
  const d = new Float32Array(w * h).fill(Infinity);
  // bucketed Dijkstra on integer chamfer costs (2 straight, 3 diagonal)
  const buckets: number[][] = [[]];
  for (let i = 0; i < w * h; i++) if (src[i]) { d[i] = 0; buckets[0].push(i); }
  const steps = [[1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [1, 1, 3], [1, -1, 3], [-1, 1, 3], [-1, -1, 3]];
  const cost = new Int32Array(w * h).fill(0x7fffffff);
  for (let i = 0; i < w * h; i++) if (src[i]) cost[i] = 0;
  for (let c = 0; c < buckets.length; c++) {
    const b = buckets[c];
    if (!b) continue;
    for (const i of b) {
      if (cost[i] !== c) continue;
      const x = i % w, y = (i - x) / w;
      for (const [dx, dy, k] of steps) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (top[j] !== 0 || cut[j]) continue;
        const nc = c + k;
        if (nc < cost[j]) {
          cost[j] = nc;
          if (!buckets[nc]) buckets[nc] = [];
          buckets[nc].push(j);
        }
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (cost[i] !== 0x7fffffff) d[i] = cost[i] / 2 / R;
  return d;
}

/** Grows `m` by n pixels (4-connected), but only into pixels where `into` is set. */
export function grow(g: Grid, m: Uint8Array, n: number, into: (i: number) => boolean): Uint8Array {
  const { w, h } = g;
  let cur = m;
  for (let k = 0; k < n; k++) {
    const next = cur.slice();
    for (let i = 0; i < w * h; i++) {
      if (cur[i] || !into(i)) continue;
      const x = i % w;
      if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (i >= w && cur[i - w]) || (i < w * h - w && cur[i + w])) next[i] = 1;
    }
    cur = next;
  }
  return cur;
}

/** Ramer-Douglas-Peucker on a closed loop. */
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) { const dd = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (dd > fd) { fd = dd; far = i; } }
  const loop = [...pts, pts[0]];
  const keep = new Uint8Array(loop.length);
  keep[0] = 1; keep[far] = 1;
  const rdp = (a: number, b: number) => {
    const [ax, ay] = loop[a], [bx, by] = loop[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const dd = Math.abs((bx - ax) * (ay - loop[i][1]) - (ax - loop[i][0]) * (by - ay)) / len;
      if (dd > best) { best = dd; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; rdp(a, bi); rdp(bi, b); }
  };
  rdp(0, far); rdp(far, loop.length - 1);
  return pts.filter((_, i) => keep[i]);
}

/** Every boundary loop of the mask (outer edges and holes) as rig-space polygons, simplified to `tol` units. */
export function trace(g: Grid, m: Uint8Array, tol: number): Pt[][] {
  const { w, h } = g;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
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
        loop.push([(k % (w + 1)) / R + g.x0, Math.floor(k / (w + 1)) / R + g.y0]);
        k = n;
        if (k === start) break;
      }
      // drop specks: a few stray pixels are not worth a polygon
      if (loop.length >= 12) loops.push(simplify(loop, tol));
    }
  }
  return loops.filter(l => l.length >= 3);
}
