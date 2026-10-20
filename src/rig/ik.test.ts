import { describe, expect, it } from 'vitest';
import { G, LIMBS, LIMB_IDS } from './geometry';
import { fk, ik } from './ik';
import { POSES, poseFrom, rig } from './poses';
import type { Bend, Vec } from '../types';

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('ik and fk', () => {
  it('fk after ik reaches the target (round trip within 0.01 units) for reachable targets', () => {
    for (const l of LIMB_IDS) {
      const [o, l1, l2] = LIMBS[l];
      for (const s of [1, -1] as Bend[]) {
        for (let a = 0; a < 360; a += 15) for (const r of [0.35, 0.6, 0.9]) {
          const reach = (l1 + l2) * r, t: Vec = [o[0] + reach * Math.sin(a * Math.PI / 180), o[1] + reach * Math.cos(a * Math.PI / 180)];
          const end = fk(o, l1, l2, ...(ik(o, l1, l2, t, s).slice(0, 2) as [number, number]))[2];
          expect(dist(end, t)).toBeLessThan(0.01);
        }
      }
    }
  });
  it('ik after fk recovers the angles within 0.01 degrees', () => {
    const [o, l1, l2] = LIMBS.aR;
    for (const [a1, a2] of [[10, 20], [-40, 60], [120, -30], [0, 90], [-90, -45]] as Array<[number, number]>) {
      const bend: Bend = a2 >= 0 ? 1 : -1, end = fk(o, l1, l2, a1, a2)[2];
      const [b1, b2, s] = ik(o, l1, l2, end, bend);
      expect(b1).toBeCloseTo(a1, 1); expect(b2).toBeCloseTo(a2, 1); expect(s).toBe(bend);
    }
  });
  it('preserves the bend sign it is given', () => {
    for (const l of LIMB_IDS) for (const s of [1, -1] as Bend[]) {
      const [o, l1, l2] = LIMBS[l];
      expect(ik(o, l1, l2, [o[0] + 20, o[1] + 60], s)[2]).toBe(s);
    }
  });
  it('flipping the bend keeps the end point where it was', () => {
    const [o, l1, l2] = LIMBS.lL, pose = ik(o, l1, l2, [-30, 120], -1);
    const end = fk(o, l1, l2, pose[0], pose[1])[2], flipped = ik(o, l1, l2, end, 1);
    expect(dist(fk(o, l1, l2, flipped[0], flipped[1])[2], end)).toBeLessThan(0.01);
    expect(flipped[1] * pose[1]).toBeLessThan(0);          // the joint now folds the other way
  });
  it('clamps targets out of reach instead of returning NaN', () => {
    const [o, l1, l2] = LIMBS.aL, p = ik(o, l1, l2, [1e4, 1e4], 1);
    expect(p.every(Number.isFinite)).toBe(true);
    const end = fk(o, l1, l2, p[0], p[1])[2];
    expect(dist(end, o)).toBeLessThanOrEqual(l1 + l2);
  });
  it('every preset pose reaches its stored targets', () => {
    for (const p of POSES) {
      const r = rig({ pose: poseFrom(p.t) });
      for (const l of LIMB_IDS) {
        const target = p.t[l][0], origin = LIMBS[l][0], reach = LIMBS[l][1] + LIMBS[l][2];
        // targets beyond reach are clamped, so compare against the clamped point
        const d = dist(origin, target), clamped = Math.min(d, reach - 0.5);
        expect(dist(r[l][2], origin)).toBeCloseTo(clamped, 0);
      }
    }
  });
  it('rig anchors match the spec', () => {
    expect(G.sh.L).toEqual([-33, -150]); expect(G.hip.R).toEqual([19, -4]);
    expect([G.A1, G.A2, G.L1, G.L2]).toEqual([64, 58, 92, 88]);
  });
});
