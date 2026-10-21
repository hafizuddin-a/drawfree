/* Hand-drawn line art in the Open Peeps manner, as pure SVG path data. Open Peeps lines are brush strokes: filled shapes
   that wobble a little, swell and thin along their length and taper at loose ends. A sketch turns plain geometry (point
   lists) into that. It is seeded, so a part always draws the same way (thumbnails, exports and tests stay stable). */
import { f1 } from './draw';

export type Pt = readonly [number, number];

/** a small seeded random number generator (mulberry32 over an FNV hash of the seed) */
export function rng(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- geometry: point lists ---------- */

/** a straight polyline */
export const seg = (...pts: Pt[]): Pt[] => pts;
/** a rectangle, clockwise from the top left */
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** an arc about (cx, cy), angles in degrees, 0 pointing right, clockwise on screen */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Pt[] {
  const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) / 12)), out: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return out;
}
/** a closed ellipse */
export const ell = (cx: number, cy: number, rx: number, ry = rx): Pt[] => arc(cx, cy, rx, ry, 0, 360).slice(0, -1);
/** a rectangle with rounded corners, clockwise from the top left */
export const rrect = (x: number, y: number, w: number, h: number, r: number): Pt[] => [
  ...arc(x + r, y + r, r, r, 180, 270), ...arc(x + w - r, y + r, r, r, 270, 360),
  ...arc(x + w - r, y + h - r, r, r, 0, 90), ...arc(x + r, y + h - r, r, r, 90, 180)
];
/** a quadratic curve, sampled */
export function qd(p0: Pt, c: Pt, p1: Pt, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}
/** a cubic curve, sampled */
export function cb(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]);
  }
  return out;
}

/* ---------- the hand ---------- */

/** points every `step` units along the line, corners kept, repeated points dropped */
function resample(pts: readonly Pt[], step: number, closed: boolean): Pt[] {
  const src = closed ? [...pts, pts[0]] : pts, out: Pt[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    const [ax, ay] = src[i], [bx, by] = src[i + 1], d = Math.hypot(bx - ax, by - ay);
    if (d < 0.01) continue;
    const n = Math.ceil(d / step);
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
}

/** smooth noise in -1..1 along a length: random knots every `gap` units, eased between. A closed loop wraps around. */
function noise(len: number, gap: number, r: () => number, closed: boolean): (s: number) => number {
  const n = Math.max(2, Math.ceil(len / gap) + 1), k = Array.from({ length: n }, () => r() * 2 - 1);
  if (closed) k[n - 1] = k[0];
  return s => {
    const t = Math.max(0, Math.min(n - 1, (s / len) * (n - 1))), i = Math.min(n - 2, Math.floor(t)), f = (1 - Math.cos((t - i) * Math.PI)) / 2;
    return k[i] * (1 - f) + k[i + 1] * f;
  };
}

/** compact path data: absolute start, then relative steps rounded so the error never builds up */
function poly(pts: readonly Pt[]): string {
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`, px = f1(pts[0][0]), py = f1(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const x = f1(pts[i][0]), y = f1(pts[i][1]);
    d += `l${f1(x - px)} ${f1(y - py)}`;
    px = x; py = y;
  }
  return d + 'z';
}

interface Hand { p: Pt[]; s: number[]; len: number }

/** the line as a hand would draw it: resampled and nudged by smooth noise */
function wobble(pts: readonly Pt[], closed: boolean, amp: number, r: () => number): Hand {
  const p0 = resample(pts, 5, closed), s = [0];
  for (let i = 1; i < p0.length; i++) s.push(s[i - 1] + Math.hypot(p0[i][0] - p0[i - 1][0], p0[i][1] - p0[i - 1][1]));
  const last = p0[p0.length - 1], len = closed ? s[s.length - 1] + Math.hypot(p0[0][0] - last[0], p0[0][1] - last[1]) : s[s.length - 1];
  const nx = noise(len, 50, r, closed), ny = noise(len, 50, r, closed);
  return { p: p0.map((q, i) => [q[0] + nx(s[i]) * amp, q[1] + ny(s[i]) * amp] as Pt), s, len };
}

/** the brush stroke along a line: a filled ribbon that swells and thins, and tapers at the ends of an open line */
function ribbon({ p, s, len }: Hand, closed: boolean, w: number, r: () => number): string {
  const wn = noise(len, 30, r, closed), n = p.length, L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = closed ? p[(i - 1 + n) % n] : p[Math.max(0, i - 1)], b = closed ? p[(i + 1) % n] : p[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const taper = closed ? 1 : Math.min(1, 0.35 + (0.65 * Math.min(s[i], len - s[i])) / 9);
    const hw = (w / 2) * (1 + 0.25 * wn(s[i])) * taper;
    L.push([p[i][0] - (dy / d) * hw, p[i][1] + (dx / d) * hw]);
    R.push([p[i][0] + (dy / d) * hw, p[i][1] - (dx / d) * hw]);
  }
  R.reverse();
  return closed ? poly(L) + poly(R) : poly([...L, ...R]);
}

export interface SketchOpts {
  /** brush width */
  w: number;
  /** how far the line wanders, in units */
  amp: number;
  /** ink colour. Given: every shape's fill and ink go out in drawing order (props). Left out: fills and ink collect
      apart, ink uncoloured, so the caller can wrap the ink in one group (scenes) */
  ink?: string;
}
export interface Sketch {
  /** an open line */
  line: (pts: readonly Pt[], w?: number) => void;
  /** a closed outline, with a fill under it (an attribute string such as `fill="#fff"`) when given */
  shape: (pts: readonly Pt[], fill?: string, w?: number) => void;
  /** a fill with no outline */
  wash: (pts: readonly Pt[], fill: string) => void;
  /** raw markup into the ink layer (small dots) */
  raw: (markup: string) => void;
  /** [fills, ink]; with `ink` set everything is in the first */
  done: () => readonly [string, string];
}

export function sketch(seed: string, o: SketchOpts): Sketch {
  const r = rng(seed);
  let under = '', ink = '';
  const inkAttr = o.ink ? ` fill="${o.ink}"` : '';
  const put = (fill: string, path: string) => { if (o.ink) under += fill + path; else { under += fill; ink += path; } };
  return {
    line: (pts, w = o.w) => put('', `<path${inkAttr} d="${ribbon(wobble(pts, false, o.amp, r), false, w, r)}"/>`),
    shape: (pts, fill, w = o.w) => {
      const h = wobble(pts, true, o.amp, r);
      put(fill ? `<path ${fill} d="${poly(h.p)}"/>` : '', `<path${inkAttr} d="${ribbon(h, true, w, r)}"/>`);
    },
    wash: (pts, fill) => put(`<path ${fill} d="${poly(wobble(pts, true, o.amp, r).p)}"/>`, ''),
    raw: markup => put('', markup),
    done: () => [under, ink]
  };
}
