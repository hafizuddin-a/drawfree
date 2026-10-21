/* Poses. A pose is two bone angles per limb (see types.ts). Presets are stored as hand and foot targets in local
   space and solved with IK for the character's own limbs, so they adapt to each garment family's bone lengths.
   Joint angles are limited: the cutout pieces are flat art, and past these bends their cut ends would show. */
import type { Bend, Character, LimbId, LimbPose, Pose, PosePreset, PoseTargets, Vec } from '../types';
import { tags } from '../parts/draw';
import { LIMB_IDS, limbsOf } from './geometry';
import { fk, ik } from './ik';

/** the furthest an elbow or knee folds, either way, in degrees */
export const MAX_BEND = { a: 150, l: 145 } as const;
/** how far a thigh swings back and forward from straight down */
export const HIP_RANGE: readonly [number, number] = [-80, 125];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** a limb pose with its joints kept inside their limits */
export function limit(l: LimbId, p: LimbPose): LimbPose {
  const a1 = l[0] === 'l' ? clamp(p[0], HIP_RANGE[0], HIP_RANGE[1]) : p[0];
  const m = MAX_BEND[l[0] as 'a' | 'l'];
  return [a1, clamp(p[1], -m, m), p[2]];
}

type Limbs = Pick<Character, 'top' | 'bottom'>;
/** Solves one limb of `c` so its hand or foot reaches `t` (local space), bending the way `s` says, within limits. */
export function solveLimb(c: Limbs, l: LimbId, t: Vec, s: Bend): LimbPose {
  const L = limbsOf(c)[l];
  return limit(l, ik(L.o, L.l1, L.l2, t, s));
}

/** The pose the art was drawn in: every piece where it was cut from. Arms prefer to fold forward, knees too. */
export function restPose(c: Limbs): Pose {
  const L = limbsOf(c), one = (l: LimbId, s: Bend): LimbPose => [L[l].rest[0], L[l].rest[1] - L[l].rest[0], s];
  return { aL: one('aL', 1), aR: one('aR', 1), lL: one('lL', -1), lR: one('lR', -1) };
}

/** idle moves nothing: it is the pose the art was drawn in */
export const POSES: PosePreset[] = [
  { id: 'idle', name: 'Standing', tags: tags('stand idle neutral'), t: {} },
  { id: 'wave', name: 'Waving', tags: tags('wave hello greeting'), t: { aR: [[86, -214], 1] } },
  { id: 'cheer', name: 'Cheering', tags: tags('cheer arms up celebrate'), t: { aL: [[-80, -222], -1], aR: [[86, -214], 1] } },
  { id: 'hips', name: 'Hands on hips', tags: tags('hips confident akimbo'), t: { aL: [[-24, -50], 1], aR: [[46, -46], -1] } },
  { id: 'crossed', name: 'Arms crossed', tags: tags('crossed arms folded'), t: { aL: [[40, -95], 1], aR: [[-15, -100], 1] } },
  { id: 'walk', name: 'Walking', tags: tags('walk step stride'), t: { aL: [[5, -40], 1], aR: [[70, -40], 1], lL: [[-58, 128], -1], lR: [[44, 150], -1] } },
  { id: 'point', name: 'Pointing', tags: tags('point direct show'), t: { aR: [[156, -126], 1] } },
  { id: 'sit', name: 'Sitting', tags: tags('sit seated chair'), t: { aL: [[16, -28], 1], aR: [[66, -30], 1], lL: [[86, 60], -1], lR: [[108, 56], -1] } }
];

/** the pose that reaches `targets`, with every limb they leave out at rest */
export function poseFrom(c: Limbs, targets: Partial<PoseTargets>): Pose {
  const rest = restPose(c), one = (l: LimbId): LimbPose => { const t = targets[l]; return t ? solveLimb(c, l, t[0], t[1]) : rest[l]; };
  return { aL: one('aL'), aR: one('aR'), lL: one('lL'), lR: one('lR') };
}
export const presetPose = (id: string, c: Limbs): Pose => poseFrom(c, (POSES.find(p => p.id === id) ?? POSES[0]).t);

/** joint positions [root, elbow or knee, hand or foot] for each limb, in local space, joints limited */
export function rig(c: Pick<Character, 'pose' | 'top' | 'bottom'>): Record<LimbId, [Vec, Vec, Vec]> {
  const L = limbsOf(c), o = {} as Record<LimbId, [Vec, Vec, Vec]>;
  for (const k of LIMB_IDS) { const p = limit(k, c.pose[k]); o[k] = fk(L[k].o, L[k].l1, L[k].l2, p[0], p[1]); }
  return o;
}
