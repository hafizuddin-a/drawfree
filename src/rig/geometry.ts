/* Rig geometry. Local space: pelvis near (0,0), figure faces +x, y grows downward. The posable figure is a cutout
   puppet sliced from an Open Peeps body (parts/cutout.ts), so its joints are that body's joints, moved down with the
   art onto the ground line. Arms come from the top's family, legs from the bottom's: each limb is two bones with
   the lengths and rest angles of the art it was cut from. */
import type { Character, LimbId, Vec } from '../types';
import { FAMILIES, type Family, type JointId } from '../parts/cutout';
import { PEEP_BODY_BOX } from '../parts/peeps/bodies.box.gen';
import { BOTTOMS, TOPS, lookup } from '../parts';

export const RAD = Math.PI / 180;
/** The ground line in rig space. Open Peeps bodies, the puppet's included, are moved down to stand on it (waist-up
    bodies rest their bottom edge on it), so swapping a body keeps the character on the same floor. */
export const GROUND = 189;
export const LIMB_IDS: readonly LimbId[] = ['aL', 'aR', 'lL', 'lR'];

const famById = new Map(FAMILIES.map(f => [f.id, f]));
export const familyOf = (id: string): Family => famById.get(id) ?? FAMILIES[0];
/** how far a family's art moves down to stand on the ground line */
export const dropOf = (f: Family): number => GROUND - (PEEP_BODY_BOX[f.base]?.[3] ?? GROUND);

/** the angle of the bone a -> b in degrees: 0 straight down, positive toward +x */
export const boneAngle = (a: Vec, b: Vec): number => Math.atan2(b[0] - a[0], b[1] - a[1]) / RAD;

export interface Limb {
  /** the limb's root (shoulder or hip) in local space */
  o: Vec;
  l1: number;
  l2: number;
  /** the two bones' angles in the art at rest */
  rest: [number, number];
  /** the family whose art the limb is cut from, its drop, and the limb's joints in that art */
  fam: Family;
  dy: number;
  j: readonly [JointId, JointId, JointId];
}
export const LIMB_JOINTS: Readonly<Record<LimbId, readonly [JointId, JointId, JointId]>> = {
  aL: ['shL', 'elL', 'wrL'], aR: ['shR', 'elR', 'wrR'], lL: ['hpL', 'knL', 'anL'], lR: ['hpR', 'knR', 'anR']
};

const topOf = lookup(TOPS), bottomOf = lookup(BOTTOMS);
const cache = new Map<string, Record<LimbId, Limb>>();
/** the four limbs of a character's puppet: arms from its top's family, legs from its bottom's */
export function limbsOf(c: Pick<Character, 'top' | 'bottom'>): Record<LimbId, Limb> {
  const key = c.top + '|' + c.bottom, hit = cache.get(key);
  if (hit) return hit;
  const arms = familyOf(topOf(c.top).fam), legs = familyOf(bottomOf(c.bottom).fam);
  const one = (l: LimbId): Limb => {
    const fam = l[0] === 'a' ? arms : legs, dy = dropOf(fam), [a, b, e] = LIMB_JOINTS[l].map(k => fam.j[k]);
    return {
      o: [a[0], a[1] + dy], l1: Math.hypot(b[0] - a[0], b[1] - a[1]), l2: Math.hypot(e[0] - b[0], e[1] - b[1]),
      rest: [boneAngle(a, b), boneAngle(b, e)], fam, dy, j: LIMB_JOINTS[l]
    };
  };
  const out = { aL: one('aL'), aR: one('aR'), lL: one('lL'), lR: one('lR') };
  cache.set(key, out);
  return out;
}
