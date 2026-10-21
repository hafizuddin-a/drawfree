/* The pen: Drawfree's own art is drawn with one ink and one line weight everywhere. Every outline is a stroke of
   LW, never a filled outline, so the weight is the same at any pose or size. Shapes are smooth curves through points
   (Catmull-Rom turned into cubic Beziers). Pure string builders: no DOM, no React. */

export type P = readonly [number, number];
export const INK = '#141414';
/** the one line weight, in rig units */
export const LW = 2.6;

const r1 = (n: number): number => Math.round(n * 10) / 10;
const pt = (p: P): string => `${r1(p[0])},${r1(p[1])}`;

/** A smooth curve through `pts` (Catmull-Rom with tension `k`, as cubic Beziers). Closed curves loop back. */
export function curve(pts: readonly P[], closed = false, k = 0.5): string {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2 && !closed) return `M${pt(pts[0])}L${pt(pts[1])}`;
  const at = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), t = k / 3;
    const c1: P = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2: P = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? d + 'Z' : d;
}

/** a filled shape with the ink outline */
export const shape = (d: string, fill: string): string =>
  `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${LW}" stroke-linejoin="round" stroke-linecap="round"/>`;
/** a fill with no outline (an outline drawn separately covers only the edges that need one) */
export const fillOnly = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;
/** an ink line; `w` thins it for small details (a crease, a button) but keeps the round ends */
export const line = (d: string, w = LW): string =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
export const dot = (x: number, y: number, r: number): string => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${INK}"/>`;

const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const mul = (a: P, s: number): P => [a[0] * s, a[1] * s];
const len = (a: P): number => Math.hypot(a[0], a[1]);
const unit = (a: P): P => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };

/** Points along a limb's centre: straight from `a` to `b` to `c`, the corner at `b` rounded off so a bent elbow or
    knee reads as one soft curve. `round` is how much of each bone the bend uses (0 to 0.5). */
export function bonePath(a: P, b: P, c: P, round = 0.38, step = 3): P[] {
  const ab = sub(b, a), bc = sub(c, b), la = len(ab), lc = len(bc);
  const turn = Math.abs(Math.atan2(ab[0] * bc[1] - ab[1] * bc[0], ab[0] * bc[0] + ab[1] * bc[1]));
  // a straight limb needs no rounding; the more it bends, the longer the curve
  const r = Math.min(la, lc) * round * Math.min(1, turn / 0.6);
  const p = add(b, mul(unit(ab), -r)), q = add(b, mul(unit(bc), r));
  const out: P[] = [];
  const push = (from: P, to: P) => { const n = Math.max(1, Math.ceil(len(sub(to, from)) / step)); for (let i = 0; i < n; i++) out.push(add(from, mul(sub(to, from), i / n))); };
  push(a, p);
  const n = Math.max(2, Math.ceil(r / step) * 2);
  for (let i = 0; i < n; i++) { const t = i / n; out.push(add(add(mul(p, (1 - t) * (1 - t)), mul(b, 2 * t * (1 - t))), mul(q, t * t))); }
  push(q, c);
  out.push(c);
  return out;
}

/** cumulative length along a polyline */
function lengths(pts: readonly P[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + len(sub(pts[i], pts[i - 1])));
  return out;
}

/** The part of a centre line between fractions t0 and t1 of its length. */
export function part(pts: readonly P[], t0: number, t1: number): P[] {
  const L = lengths(pts), total = L[L.length - 1], a = t0 * total, b = t1 * total;
  const at = (d: number): P => {
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const s = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
    return add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), s));
  };
  const out: P[] = [at(a)];
  for (let i = 1; i < pts.length - 1; i++) if (L[i] > a && L[i] < b) out.push(pts[i]);
  out.push(at(b));
  return out;
}

/** Offsets of a centre line by half of `width(t)` on each side (t from 0 to 1 along it), as [left, right]. */
export function sides(pts: readonly P[], width: (t: number) => number): [P[], P[]] {
  const L = lengths(pts), total = L[L.length - 1] || 1, left: P[] = [], right: P[] = [];
  pts.forEach((p, i) => {
    const d = unit(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])), nrm: P = [-d[1], d[0]], h = width(L[i] / total) / 2;
    left.push(add(p, mul(nrm, h))); right.push(add(p, mul(nrm, -h)));
  });
  return [left, right];
}

/** Thins a dense point list (a curve does not need a point every 3 units) and drops points that fold back. */
export function thin(pts: readonly P[], every = 3): P[] {
  const out = pts.filter((_, i) => i % every === 0 || i === pts.length - 1);
  return out;
}

/** A tube along a centre line, rounded at the start and (unless `capEnd` is false) the end. Returns the outline. */
export function tube(pts: readonly P[], width: (t: number) => number, capEnd = true): P[] {
  const [l, r] = sides(pts, width), n = pts.length;
  // a half circle round the end: from the left side, out along the line, to the right side
  const cap = (c: P, dir: P, h: number): P[] => {
    const nrm: P = [-dir[1], dir[0]], out: P[] = [];
    for (let i = 1; i < 6; i++) { const a = (Math.PI * i) / 6; out.push(add(c, add(mul(nrm, Math.cos(a) * h), mul(dir, Math.sin(a) * h)))); }
    return out;
  };
  const dEnd = unit(sub(pts[n - 1], pts[n - 2])), dStart = unit(sub(pts[0], pts[1]));
  return [
    ...thin(l), ...(capEnd ? cap(pts[n - 1], dEnd, width(1) / 2) : []),
    ...thin([...r].reverse()), ...cap(pts[0], dStart, width(0) / 2)
  ];
}
