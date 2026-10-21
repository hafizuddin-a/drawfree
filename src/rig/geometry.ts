/* Rig anchors and geometry. Local space: pelvis at (0,0), figure faces +x, y grows downward.
   Head anchor (0,-212), shoulders (+-33,-140), hips (+-19,-4). The posable figure draws its torso TORSO_DROP and its
   head HEAD_DROP below the coordinates the torso and head art use (renderCharacter.ts). Anything new a part needs to anchor to goes here. */
import type { LimbId, Vec } from '../types';

export const RAD = Math.PI / 180;
export const G = {
  // TORSO_DROP below the torso art's own shoulder line (-150), for the stockier Open Peeps proportions
  sh: { L: [-33, -140] as Vec, R: [33, -140] as Vec },
  hip: { L: [-19, -4] as Vec, R: [19, -4] as Vec },
  A1: 64, A2: 58, L1: 92, L2: 88
};
/** origin, upper-bone length, lower-bone length for each limb */
export const LIMBS: Record<LimbId, readonly [Vec, number, number]> = {
  aL: [G.sh.L, G.A1, G.A2], aR: [G.sh.R, G.A1, G.A2], lL: [G.hip.L, G.L1, G.L2], lR: [G.hip.R, G.L1, G.L2]
};
export const LIMB_IDS: readonly LimbId[] = ['aL', 'aR', 'lL', 'lR'];

/** torso outline for tops; `h` is the hem y */
export const torsoPath = (h: number): string =>
  `M-34,-167 C-20,-171 20,-171 34,-167 C45,-163 46,-150 44,-137 C41,-110 38,-82 38,-60 L38,${h} Q0,${h + 4} -38,${h} L-38,-60 C-38,-82 -41,-110 -44,-137 C-46,-150 -45,-163 -34,-167 Z`;

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
