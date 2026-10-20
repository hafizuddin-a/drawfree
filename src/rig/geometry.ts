/* Rig anchors and geometry. Local space: pelvis at (0,0), figure faces +x, y grows downward.
   Head centre (0,-212), shoulders (+-33,-150), hips (+-19,-4). Anything new a part needs to anchor to goes here. */
import type { LimbId, Vec } from '../types';
import { ln } from '../parts/draw';

export const RAD = Math.PI / 180;
export const G = {
  sh: { L: [-33, -150] as Vec, R: [33, -150] as Vec },
  hip: { L: [-19, -4] as Vec, R: [19, -4] as Vec },
  A1: 64, A2: 58, L1: 92, L2: 88
};
/** origin, upper-bone length, lower-bone length for each limb */
export const LIMBS: Record<LimbId, readonly [Vec, number, number]> = {
  aL: [G.sh.L, G.A1, G.A2], aR: [G.sh.R, G.A1, G.A2], lL: [G.hip.L, G.L1, G.L2], lR: [G.hip.R, G.L1, G.L2]
};
export const LIMB_IDS: readonly LimbId[] = ['aL', 'aR', 'lL', 'lR'];

/* head outline and ear: hair, hats and glasses are drawn against these */
export const HEAD_D = 'M0,-247 C17,-247 29,-234 29,-214 C29,-208 31,-205 33,-203 C31,-201 29,-200 29,-196 C28,-180 16,-174 0,-174 C-16,-174 -29,-186 -29,-208 C-29,-232 -17,-247 0,-247 Z';
export const EAR = ln('M-27,-216 C-37,-217 -37,-199 -27,-200');
/** torso outline for tops; `h` is the hem y */
export const torsoPath = (h: number): string =>
  `M-33,-167 C-20,-171 20,-171 33,-167 C43,-164 43,-150 41,-138 L32,-60 L33,${h} L-33,${h} L-32,-60 L-41,-138 C-43,-150 -43,-164 -33,-167 Z`;

function pointAt(pts: readonly Vec[], dist: number): Vec {
  let left = dist;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= seg) { const t = seg ? left / seg : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    left -= seg;
  }
  return pts[pts.length - 1];
}
/** the part of a polyline between distances d0 and d1 along it */
export function slice(pts: readonly Vec[], d0: number, d1: number): Vec[] {
  const out: Vec[] = [pointAt(pts, d0)];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc > d0 && acc < d1) out.push(pts[i]);
  }
  out.push(pointAt(pts, d1));
  return out;
}
