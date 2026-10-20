/* Preset poses are stored as hand and foot targets and solved with IK when applied, so they adapt if bone lengths change. */
import type { Character, LimbId, Pose, PosePreset, PoseTargets, Vec } from '../types';
import { tags } from '../parts/draw';
import { LIMBS, LIMB_IDS } from './geometry';
import { fk, ik } from './ik';

export const T_IDLE: PoseTargets = { aL: [[-34, -30], 1], aR: [[34, -30], 1], lL: [[-20, 174], -1], lR: [[20, 174], -1] };
const withT = (o: Partial<PoseTargets>): PoseTargets => Object.assign({}, T_IDLE, o);

export const POSES: PosePreset[] = [
  { id: 'idle', name: 'Standing', tags: tags('stand idle neutral'), t: T_IDLE },
  { id: 'wave', name: 'Waving', tags: tags('wave hello greeting'), t: withT({ aR: [[62, -262], 1] }) },
  { id: 'cheer', name: 'Cheering', tags: tags('cheer arms up celebrate'), t: withT({ aL: [[-62, -262], -1], aR: [[62, -262], 1] }) },
  { id: 'hips', name: 'Hands on hips', tags: tags('hips confident akimbo'), t: withT({ aL: [[-26, -56], 1], aR: [[26, -56], -1] }) },
  { id: 'crossed', name: 'Arms crossed', tags: tags('crossed arms folded'), t: withT({ aL: [[22, -112], 1], aR: [[-24, -104], -1] }) },
  { id: 'walk', name: 'Walking', tags: tags('walk step stride'), t: { aL: [[30, -68], 1], aR: [[8, -72], 1], lL: [[-50, 168], -1], lR: [[46, 170], -1] } },
  { id: 'point', name: 'Pointing', tags: tags('point direct show'), t: withT({ aR: [[140, -156], 1] }) },
  { id: 'sit', name: 'Sitting', tags: tags('sit seated chair'), t: { aL: [[22, -44], 1], aR: [[50, -40], 1], lL: [[60, 84], -1], lR: [[76, 86], -1] } }
];

export function poseFrom(t: PoseTargets): Pose {
  const one = (l: LimbId) => ik(LIMBS[l][0], LIMBS[l][1], LIMBS[l][2], t[l][0], t[l][1]);
  return { aL: one('aL'), aR: one('aR'), lL: one('lL'), lR: one('lR') };
}
export const presetPose = (id: string): Pose => poseFrom((POSES.find(p => p.id === id) ?? POSES[0]).t);

/** joint positions [origin, elbow or knee, hand or foot] for each limb, in rig space */
export function rig(c: Pick<Character, 'pose'>): Record<LimbId, [Vec, Vec, Vec]> {
  const o = {} as Record<LimbId, [Vec, Vec, Vec]>;
  for (const k of LIMB_IDS) o[k] = fk(LIMBS[k][0], LIMBS[k][1], LIMBS[k][2], c.pose[k][0], c.pose[k][1]);
  return o;
}
