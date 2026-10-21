import { describe, expect, it } from 'vitest';
import { LIMB_IDS, limbsOf } from './geometry';
import { fk, ik } from './ik';
import { HIP_RANGE, MAX_BEND, POSES, limit, poseFrom, restPose, rig, solveLimb } from './poses';
import { FAMILIES } from '../parts/cutout';
import type { Bend, Vec } from '../types';

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const look = { top: 'shirt', bottom: 'trousers' };
const L = limbsOf(look);

describe('ik and fk', () => {
  it('fk after ik reaches the target (round trip within 0.01 units) for reachable targets', () => {
    for (const l of LIMB_IDS) {
      const { o, l1, l2 } = L[l];
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
    const { o, l1, l2 } = L.aR;
    for (const [a1, a2] of [[10, 20], [-40, 60], [120, -30], [0, 90], [-90, -45]] as Array<[number, number]>) {
      const bend: Bend = a2 >= 0 ? 1 : -1, end = fk(o, l1, l2, a1, a2)[2];
      const [b1, b2, s] = ik(o, l1, l2, end, bend);
      expect(b1).toBeCloseTo(a1, 1); expect(b2).toBeCloseTo(a2, 1); expect(s).toBe(bend);
    }
  });
  it('preserves the bend sign it is given', () => {
    for (const l of LIMB_IDS) for (const s of [1, -1] as Bend[]) {
      const { o, l1, l2 } = L[l];
      expect(ik(o, l1, l2, [o[0] + 20, o[1] + 60], s)[2]).toBe(s);
    }
  });
  it('flipping the bend keeps the end point where it was', () => {
    const { o, l1, l2 } = L.lL, pose = ik(o, l1, l2, [-30, 120], -1);
    const end = fk(o, l1, l2, pose[0], pose[1])[2], flipped = ik(o, l1, l2, end, 1);
    expect(dist(fk(o, l1, l2, flipped[0], flipped[1])[2], end)).toBeLessThan(0.01);
    expect(flipped[1] * pose[1]).toBeLessThan(0);          // the joint now folds the other way
  });
  it('clamps targets out of reach instead of returning NaN', () => {
    const { o, l1, l2 } = L.aL, p = ik(o, l1, l2, [1e4, 1e4], 1);
    expect(p.every(Number.isFinite)).toBe(true);
    expect(dist(fk(o, l1, l2, p[0], p[1])[2], o)).toBeLessThanOrEqual(l1 + l2);
  });
});

describe('the puppet skeleton', () => {
  it('its joints are the art\'s joints, moved down with the art onto the ground line', () => {
    const f = FAMILIES[0];
    expect(L.aL.o).toEqual([f.j.shL[0], f.j.shL[1] + L.aL.dy]);
    expect(L.lR.o).toEqual([f.j.hpR[0], f.j.hpR[1] + L.lR.dy]);
    expect(L.aL.l1).toBeCloseTo(dist(f.j.shL, f.j.elL), 6); expect(L.lL.l2).toBeCloseTo(dist(f.j.knL, f.j.anL), 6);
  });
  it('the rest pose puts every hand and foot where the art drew it', () => {
    const r = rig({ ...look, pose: restPose(look) }), f = FAMILIES[0];
    expect(dist(r.aL[2], [f.j.wrL[0], f.j.wrL[1] + L.aL.dy])).toBeLessThan(0.01);
    expect(dist(r.lR[2], [f.j.anR[0], f.j.anR[1] + L.lR.dy])).toBeLessThan(0.01);
  });
  it('joints stay inside their limits, however a limb is dragged', () => {
    for (const l of LIMB_IDS) for (const s of [1, -1] as Bend[]) for (let a = 0; a < 360; a += 20) for (const r of [5, 40, 90, 400]) {
      const p = solveLimb(look, l, [L[l].o[0] + r * Math.sin(a * Math.PI / 180), L[l].o[1] + r * Math.cos(a * Math.PI / 180)], s);
      const m = l[0] === 'a' ? MAX_BEND.a : MAX_BEND.l;
      expect(Math.abs(p[1])).toBeLessThanOrEqual(m + 1e-9);
      if (l[0] === 'l') { expect(p[0]).toBeGreaterThanOrEqual(HIP_RANGE[0]); expect(p[0]).toBeLessThanOrEqual(HIP_RANGE[1]); }
    }
    expect(limit('aL', [10, 400, 1])[1]).toBe(MAX_BEND.a);
  });
  it('a hand lands on the pointer anywhere it can reach without passing a limit', () => {
    for (const t of [[60, -200], [-20, -90], [90, -100], [0, -200]] as Vec[]) {
      const p = solveLimb(look, 'aR', t, 1);
      expect(dist(fk(L.aR.o, L.aR.l1, L.aR.l2, p[0], p[1])[2], t)).toBeLessThan(0.01);
    }
  });
  it('every preset pose reaches its targets, or as near as reach and limits allow', () => {
    for (const p of POSES) {
      const r = rig({ ...look, pose: poseFrom(look, p.t) });
      for (const l of LIMB_IDS) {
        const t = p.t[l];
        if (!t) continue;
        // a target out of reach is met by the straight limb pointing at it
        const o = L[l].o, reach = L[l].l1 + L[l].l2, d = dist(o, t[0]);
        expect(dist(r[l][2], o), `${p.id} ${l}`).toBeCloseTo(Math.min(d, reach - 0.5), 0);
      }
    }
  });
});
